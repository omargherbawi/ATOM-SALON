import { MongoClient, type MongoClientOptions } from 'mongodb';

const uri = process.env.MONGODB_URI;

const options: MongoClientOptions = {
  maxPoolSize: 5,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxIdleTimeMS: 10000,
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(
      new Error('MONGODB_URI environment variable is not defined')
    );
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((error) => {
      global._mongoClientPromise = undefined;
      throw error;
    });
  }

  return global._mongoClientPromise;
}

export default getClientPromise();
