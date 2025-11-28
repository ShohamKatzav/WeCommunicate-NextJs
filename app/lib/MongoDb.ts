import { env } from '@/app/config/env';
import mongoose from 'mongoose';

const MONGO_URI = env.DB_URI;
const cached: { connection?: typeof mongoose; promise?: Promise<typeof mongoose> } = {};
async function connectMongo() {
  if (cached.connection) {
    return cached.connection;
  }
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    cached.promise = mongoose.connect(MONGO_URI, opts);
  }
  try {
    cached.connection = await cached.promise;
  } catch (e) {
    cached.promise = undefined;
    throw e;
  }
  return cached.connection;
}

export default connectMongo;