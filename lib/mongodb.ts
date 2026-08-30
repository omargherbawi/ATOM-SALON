import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

// maxIdleTimeMS must stay high: a Worker isolate is reused across requests, and
// dropping the socket after a few seconds forced a fresh TLS handshake to Atlas
// (~2s) on almost every request.
const MONGODB_OPTIONS: mongoose.ConnectOptions = {
  bufferCommands: false,
  autoIndex: false,
  // A pool of 1 serialized every query behind a single socket, so concurrent
  // requests queued until they timed out.
  maxPoolSize: 5,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  // A fresh socket on a cold isolate sometimes accepts a query and never
  // answers. The driver's retry then succeeds, so this timeout is kept just
  // above our slowest real query to make that retry happen quickly.
  socketTimeoutMS: 2500,
  maxIdleTimeMS: 270_000,
  family: 4,
};

function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

async function dbConnect(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (cached.conn && isConnected()) {
    return cached.conn;
  }

  if (cached.conn && !isConnected()) {
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, MONGODB_OPTIONS)
      .then((mongooseInstance) => {
        cached.conn = mongooseInstance;
        return mongooseInstance;
      })
      .catch((error) => {
        cached.promise = null;
        cached.conn = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// Use the driver instance bundled with Mongoose so ObjectId values match the
// types of the collections returned by getMongoDb().
export const ObjectId = mongoose.mongo.ObjectId;

export async function getMongoDb() {
  const mongooseInstance = await dbConnect();
  const db = mongooseInstance.connection.db;
  if (!db) {
    throw new Error(
      'MongoDB connected but no database selected. MONGODB_URI must include /atom_salon'
    );
  }
  return db;
}

export default dbConnect;
