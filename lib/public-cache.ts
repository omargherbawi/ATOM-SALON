import { getCloudflareContext } from '@opennextjs/cloudflare';

// Cold MongoDB connects from a Worker isolate can hang for 15-20s, which used
// to surface as a 1101 "Worker threw exception". So reads never block on Atlas:
// we keep entries in KV long after they go stale, serve the stale copy
// instantly, and refresh in the background.
//
// Layers, fastest first:
//   1. isolate memory - free, dies with the isolate
//   2. Cache API      - per data center
//   3. Workers KV     - global, so a cold city never waits on Atlas
const CACHE_NAME = 'atom-salon-public';
const KV_MIN_TTL_SECONDS = 60;
const LOAD_TIMEOUT_MS = 20_000;

type Envelope<T> = {
  v: T;
  f: number;
};

// Minimal shape of the KV binding. Pulling in the full Workers type package
// globally would shadow the DOM types the client components rely on.
type PublicCacheKv = {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
};

// Values only, no promises: plain JSON is safe to share between requests.
const memoryCache = new Map<string, Envelope<unknown>>();

// Collapsing duplicate loads is only safe *within* one request. Handing a
// promise created by another request to this one is the cross-request I/O that
// Workers refuses: it either throws "Cannot perform I/O on behalf of a
// different request" or cancels the continuation, leaving this request awaiting
// a promise that can never settle. Keyed per request, so entries die with it.
const inFlightByRequest = new WeakMap<object, Map<string, Promise<unknown>>>();

// Outside a request (scripts, build) there is no per-request identity and no
// cross-request hazard, so a plain map is fine.
const inFlightFallback = new Map<string, Promise<unknown>>();

export const PUBLIC_CACHE_KEYS = {
  barbers: 'public:barbers',
  settings: 'public:settings',
} as const;

function availabilityKey(barberId: string, date: string) {
  return `public:availability:${barberId}:${date}`;
}

function cacheRequest(key: string) {
  return new Request(`https://atom-salon.cache/${encodeURIComponent(key)}`);
}

async function openCache(): Promise<Cache | null> {
  const cacheStorage = (globalThis as { caches?: CacheStorage }).caches;
  if (!cacheStorage) return null;
  try {
    return await cacheStorage.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function getContext() {
  try {
    return await getCloudflareContext({ async: true });
  } catch {
    return null;
  }
}

async function getInFlight(): Promise<Map<string, Promise<unknown>>> {
  const context = await getContext();
  if (!context) return inFlightFallback;

  const key = context as unknown as object;
  let map = inFlightByRequest.get(key);
  if (!map) {
    map = new Map();
    inFlightByRequest.set(key, map);
  }
  return map;
}

async function getKv(): Promise<PublicCacheKv | null> {
  const context = await getContext();
  const kv = (context?.env as { PUBLIC_CACHE?: PublicCacheKv } | undefined)
    ?.PUBLIC_CACHE;
  return kv ?? null;
}

/**
 * Keeps the request alive while a background refresh finishes. The guarded
 * promise is created immediately so a rejection can never go unhandled.
 */
async function background(promise: Promise<unknown>) {
  const guarded = promise.catch(() => {});
  const context = await getContext();
  context?.ctx.waitUntil(guarded);
}

async function readEnvelope<T>(key: string): Promise<Envelope<T> | null> {
  const fromMemory = memoryCache.get(key) as Envelope<T> | undefined;
  if (fromMemory) return fromMemory;

  const cache = await openCache();
  if (cache) {
    try {
      const match = await cache.match(cacheRequest(key));
      if (match) {
        const envelope = (await match.json()) as Envelope<T>;
        memoryCache.set(key, envelope);
        return envelope;
      }
    } catch {
      // fall through to KV
    }
  }

  const kv = await getKv();
  if (kv) {
    try {
      const envelope = await kv.get<Envelope<T>>(key, 'json');
      if (envelope) {
        memoryCache.set(key, envelope);
        return envelope;
      }
    } catch {
      return null;
    }
  }

  return null;
}

async function writeEnvelope<T>(
  key: string,
  envelope: Envelope<T>,
  keepSeconds: number
) {
  memoryCache.set(key, envelope);

  const body = JSON.stringify(envelope);
  const writes: Promise<unknown>[] = [];

  const cache = await openCache();
  if (cache) {
    writes.push(
      cache.put(
        cacheRequest(key),
        new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${keepSeconds}`,
          },
        })
      )
    );
  }

  const kv = await getKv();
  if (kv) {
    writes.push(
      kv.put(key, body, {
        expirationTtl: Math.max(KV_MIN_TTL_SECONDS, keepSeconds),
      })
    );
  }

  if (writes.length > 0) {
    await Promise.allSettled(writes);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Database timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function refresh<T>(
  key: string,
  load: () => Promise<T>,
  freshSeconds: number,
  keepSeconds: number
): Promise<T> {
  const inFlight = await getInFlight();

  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const task = (async () => {
    try {
      const value = await withTimeout(load(), LOAD_TIMEOUT_MS);
      await writeEnvelope(
        key,
        { v: value, f: Date.now() + freshSeconds * 1000 },
        keepSeconds
      );
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

/**
 * Returns cached data immediately when present. A stale entry is served right
 * away and refreshed in the background, so a slow Atlas connect never delays
 * the visitor.
 */
export async function cachedRead<T>(options: {
  key: string;
  freshSeconds: number;
  keepSeconds: number;
  load: () => Promise<T>;
}): Promise<T> {
  const { key, freshSeconds, keepSeconds, load } = options;
  const envelope = await readEnvelope<T>(key);

  if (envelope) {
    if (envelope.f <= Date.now()) {
      void background(refresh(key, load, freshSeconds, keepSeconds));
    }
    return envelope.v;
  }

  return refresh(key, load, freshSeconds, keepSeconds);
}

export async function invalidatePublicCache(key: string) {
  memoryCache.delete(key);

  const cache = await openCache();
  if (cache) {
    try {
      await cache.delete(cacheRequest(key));
    } catch {
      // runtime without Cache API
    }
  }

  const kv = await getKv();
  if (kv) {
    try {
      await kv.delete(key);
    } catch {
      // ignore, entry will expire
    }
  }
}

export function availabilityCacheKey(barberId: string, date: string) {
  return availabilityKey(barberId, date);
}

export async function invalidateBarberCaches() {
  await invalidatePublicCache(PUBLIC_CACHE_KEYS.barbers);
}

export async function invalidateSettingsCache() {
  await invalidatePublicCache(PUBLIC_CACHE_KEYS.settings);
}

export async function invalidateAvailabilityCache(
  barberId: string,
  date: string
) {
  await invalidatePublicCache(availabilityKey(barberId, date));
}
