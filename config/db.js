import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    // Hide any username and password that may be inside the connection string.
    const where = env.mongoUri.replace(/\/\/[^@]*@/, '//***@');
    throw new Error(`Could not connect to MongoDB at ${where}. Is mongod running? (${err.message})`);
  }
  console.log(`MongoDB connected to database "${mongoose.connection.name}".`);
}
