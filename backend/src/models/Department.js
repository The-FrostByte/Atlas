import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  created_at: { type: String, default: () => new Date().toISOString() }
});

const Department = mongoose.model('Department', departmentSchema);
export default Department;