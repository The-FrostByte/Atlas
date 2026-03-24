import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// These two lines are needed in ES Modules to get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly point to the .env file one level up from 'config'
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URL;

  if (!mongoUri) {
    console.error('[ERROR] MONGO_URL is not defined in .env file');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: process.env.DB_NAME || 'atlas_db',
    });
    console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[ERROR] Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;