import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      methods: ["GET", "POST"]
    }
  });

  // Authentication Middleware for Sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ id: decoded.user_id });

      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Socket connected: ${socket.user.name} (${socket.id})`);

    // Join a personal room for private notifications
    socket.join(`user:${socket.user.id}`);

    // Handle joining a Task Room (Matches your Python class join_room)
    socket.on('join_task', (taskId) => {
      socket.join(`task:${taskId}`);
      console.log(`👥 User ${socket.user.name} joined task room: ${taskId}`);
    });

    // Handle leaving a Task Room
    socket.on('leave_task', (taskId) => {
      socket.leave(`task:${taskId}`);
    });

    socket.on('disconnect', () => {
      console.log('🔥 Socket disconnected');
    });
  });

  return io;
};

// Helper to emit events from controllers (Broadcast)
export const emitToTask = (taskId, event, data) => {
  if (io) {
    io.to(`task:${taskId}`).emit(event, data);
  }
};

export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};