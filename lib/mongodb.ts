import {
  MongoClient,
  ObjectId as DriverObjectId,
  type Db,
  type MongoClientOptions,
} from 'mongodb';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const ObjectId = DriverObjectId;

const MONGODB_OPTIONS: MongoClientOptions = {
  // The client serves a single request, which runs its queries one after the
  // other, so one socket is enough.
  maxPoolSize: 1,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  // Comfortably above the slowest real query. The old 2.5s value was below our
  // own connect time, so the driver kept retrying queries that were fine.
  socketTimeoutMS: 20_000,
  // The client is discarded with the request, so idle eviction and frequent
  // topology heartbeats would only add work it never benefits from.
  maxIdleTimeMS: 60_000,
  heartbeatFrequencyMS: 30_000,
  family: 4,
};

// Workers bind every socket to the request that opened it. A client created by
// one request cannot be used by the next: the runtime either throws "Cannot
// perform I/O on behalf of a different request" or silently cancels the
// continuation, so the await never settles and the request hangs until the
// runtime kills it. That is why the connection is cached per request and never
// on `globalThis`.
//
// OpenNext runs each request inside an AsyncLocalStorage scope and builds a
// fresh `{ env, ctx, cf }` object for it, so that object is a reliable
// per-request identity. Entries vanish when the request is collected.
const clientsByRequest = new WeakMap<object, Promise<MongoClient>>();

function connect(uri: string): Promise<MongoClient> {
  return new MongoClient(uri, MONGODB_OPTIONS).connect();
}

/**
 * Resolves the object identifying the current request, or null when there is no
 * request around it (seed scripts, build-time evaluation).
 */
async function getRequestKey(): Promise<object | null> {
  try {
    const context = await getCloudflareContext({ async: true });
    return (context as unknown as object) ?? null;
  } catch {
    return null;
  }
}

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const requestKey = await getRequestKey();
  if (!requestKey) {
    return connect(uri);
  }

  const existing = clientsByRequest.get(requestKey);
  if (existing) {
    return existing;
  }

  // A failed connect must not be cached, or every later query in the same
  // request would replay the same error.
  const pending = connect(uri).catch((error) => {
    clientsByRequest.delete(requestKey);
    throw error;
  });

  clientsByRequest.set(requestKey, pending);
  return pending;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db();
  if (!db) {
    throw new Error(
      'MongoDB connected but no database selected. MONGODB_URI must include /atom_salon'
    );
  }
  return db;
}
