import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.info('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}
