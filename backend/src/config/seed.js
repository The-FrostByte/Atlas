import User from '../models/User.js';
import Department from '../models/Department.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const DEFAULT_DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Operations', 'Finance', 'Support'];

export const initializeSystem = async () => {
  try {
    // 1. Check if Admin exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        id: uuidv4(),
        email: 'admin@orbit.com',
        phone: '+1234567890',
        name: 'Admin User',
        department: 'Administration',
        role: 'admin',
        password: hashedPassword, // Added password for Node auth
        created_at: new Date().toISOString()
      });
      console.log('✅ Default admin created: admin@orbit.com / admin123');
    }

    // 2. Check if Departments exist
    const deptCount = await Department.countDocuments();
    if (deptCount === 0) {
      const deptObjects = DEFAULT_DEPARTMENTS.map(name => ({
        id: uuidv4(),
        name,
        created_at: new Date().toISOString()
      }));
      await Department.insertMany(deptObjects);
      console.log(`✅ Initialized ${DEFAULT_DEPARTMENTS.length} default departments`);
    }
  } catch (error) {
    console.error('❌ Initialization error:', error.message);
  }
};