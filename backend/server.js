import process from 'node:process';
process.setMaxListeners(20);

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Core services
import connectDB from './src/config/db.js';
import { initializeSystem } from './src/config/seed.js';
import { startScheduler } from './src/services/schedulerService.js';
import { initSocket } from './src/socket/socketHandler.js';

// Middleware
import { protect, adminOnly } from './src/middleware/auth.js';

// Routes
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import taskRoutes from './src/routes/taskRoutes.js';
import commentRoutes from './src/routes/commentRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import attachmentRoutes from './src/routes/attachmentRoutes.js';
import departmentRoutes from './src/routes/departmentRoutes.js';

// Controllers
import { getMyNotifications, markAsRead } from './src/controllers/notificationController.js';
import { getSettings, updateSettings, getWhatsAppSettings, getNotificationDefaults } from './src/controllers/settingsController.js';
import { createUser, deleteUser } from './src/controllers/userController.js';
import { getDepartments, createDepartment } from './src/controllers/departmentController.js';
import { getPopups, markDigestSeen } from './src/controllers/digestController.js';
import { getRecurringTasks, deleteTask, deleteRecurringTask, stopRecurringTask, resumeRecurringTask } from './src/controllers/taskController.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

initSocket(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB().then(() => {
  initializeSystem();
  startScheduler();
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Modular routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/departments', departmentRoutes);

// Custom Routes
app.get('/api/notifications', protect, getMyNotifications);
app.put('/api/notifications/:id/read', protect, markAsRead);
app.get('/api/notification-settings/defaults', protect, getNotificationDefaults);

app.get('/api/digest/popups', protect, getPopups);
app.put('/api/digest/popups/:id/seen', protect, markDigestSeen);

app.post('/api/users', protect, adminOnly, createUser);
app.delete('/api/users/:id', protect, adminOnly, deleteUser);

app.get('/api/departments', protect, getDepartments);
app.post('/api/departments', protect, adminOnly, createDepartment);

app.get('/api/notification-settings', protect, getSettings);
app.put('/api/notification-settings', protect, adminOnly, updateSettings);

app.get('/api/recurrence-settings', protect, getSettings);
app.put('/api/recurrence-settings', protect, adminOnly, updateSettings);

app.get('/api/whatsapp-settings', protect, getWhatsAppSettings);

// Recurring Task Actions
app.get('/api/recurring-tasks', protect, getRecurringTasks);
app.delete('/api/recurring-tasks/:taskId', protect, deleteRecurringTask);
app.delete('/api/tasks/:taskId', protect, deleteTask);
app.post('/api/recurring-tasks/:taskId/stop', protect, stopRecurringTask);
app.post('/api/recurring-tasks/:taskId/resume', protect, resumeRecurringTask);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'atlas-operations-platform', utc_time: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT} with WebSockets`);
});