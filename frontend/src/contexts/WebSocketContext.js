import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || socketRef.current?.connected) return;

    // Connect to Socket.io (Node backend)
    socketRef.current = io(BACKEND_URL, {
      query: { token },
      transports: ['websocket']
    });

    socketRef.current.on('connect', () => {
      console.log('⚡ Socket.io connected to Node backend');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen for task assignment
    socketRef.current.on('task_assigned', (data) => {
      toast.info(data.message || 'New Task Assigned');
    });

    // ✅ FIXED: listen to correct event name + correct data shape
    socketRef.current.on('comment_created', (data) => {
      toast.info(`New comment from ${data.payload?.author?.name || 'someone'}`);
    });

  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const joinRoom = useCallback((room) => {
    const taskId = room.replace('task:', '');
    socketRef.current?.emit('join_task', taskId);
  }, []);

  const leaveRoom = useCallback((room) => {
    const taskId = room.replace('task:', '');
    socketRef.current?.emit('leave_task', taskId);
  }, []);

  // Subscription helper
  const subscribe = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const value = useMemo(() => ({
    isConnected,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    subscribe,
    notifications
  }), [isConnected, connect, disconnect, joinRoom, leaveRoom, subscribe, notifications]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

// Hook for joining/leaving task rooms
export function useTaskRoom(taskId) {
  const { joinRoom, leaveRoom, subscribe, isConnected } = useWebSocket();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!taskId || !isConnected) return;

    joinRoom(`task:${taskId}`);

    // ✅ FIXED: correct event name + no unnecessary data reshaping
    const unsubCommentCreated = subscribe('comment_created', (data) => {
      setEvents(prev => [...prev, { type: 'comment_created', data }]);
    });

    const unsubCommentUpdated = subscribe('comment_updated', (data) => {
      setEvents(prev => [...prev, { type: 'comment_updated', data }]);
    });
    return () => {
      leaveRoom(`task:${taskId}`);
      unsubCommentCreated();
      unsubCommentUpdated();
    };
  }, [taskId, isConnected, joinRoom, leaveRoom, subscribe]);

  return { events, clearEvents: () => setEvents([]) };
}