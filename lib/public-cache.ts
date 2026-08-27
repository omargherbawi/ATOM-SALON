import { getCloudflareContext } from '@opennextjs/cloudflare';

const MEMORY_TTL_MS = 60_000;
const CACHE_NAME = 'atom-salon-public';

type MemoryEntry = {
  expiresAt: number;
  value: unknown;
};

const memoryCache = new Map<string, MemoryEntry>();

export const PUBLIC_CACHE_KEYS = {
  barbers: 'public:barbers',
  settings: 'public:settings',
} as const;

function availabilityKey(barberId: string, date: string) {
  return `public:availability:${barberId}:${date}`;
}

function cacheRequest(key: string) {
  return new Request(`https://atom-salon.cache/${key}`);
}

function getCacheStorage(): CacheStorage | undefined {
  return (globalThis as { caches?: CacheStorage }).caches;
}

async function openCache(): Promise<Cache | null> {
  const cacheStorage = getCacheStorage();
  if (!cacheStorage) return null;
  try {
    return await cacheStorage.open(CACHE_NAME);
  } catch {
    return null;
  }
}

export async function readPublicCache<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const memoryHit = memoryCache.get(key);
  if (memoryHit && memoryHit.expiresAt > now) {
    return memoryHit.value as T;
  }

  const cache = await openCache();
  if (!cache) return null;

  try {
    const match = await cache.match(cacheRequest(key));
    if (!match) return null;
    const value = (await match.json()) as T;
    memoryCache.set(key, { expiresAt: now + MEMORY_TTL_MS, value });
    return value;
  } catch {
    return null;
  }
}

export async function writePublicCache(
  key: string,
  value: unknown,
  maxAgeSeconds: number
) {
  memoryCache.set(key, {
    expiresAt: Date.now() + Math.min(MEMORY_TTL_MS, maxAgeSeconds * 1000),
    value,
  });

  const cache = await openCache();
  if (!cache) return;

  const put = cache.put(
    cacheRequest(key),
    new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${maxAgeSeconds}`,
      },
    })
  );

  try {
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(put);
  } catch {
    await put;
  }
}

export async function invalidatePublicCache(key: string) {
  memoryCache.delete(key);
  const cache = await openCache();
  if (!cache) return;
  try {
    await cache.delete(cacheRequest(key));
  } catch {
    // local dev or runtime without Cache API
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
