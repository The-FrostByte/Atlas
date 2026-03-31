import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
  try {
    // We are HARDCODING the URL here to absolutely guarantee it hits atlas_live
    const conn = await mongoose.connect('mongodb://localhost:27017/atlas_live');

    console.log(`[DATABASE] MongoDB Connected: ${conn.connection.host}`);
    console.log(`[DATABASE] Currently reading from Database: >>> ${conn.connection.name} <<<`);

  } catch (error) {
    console.error(`[ERROR] Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;