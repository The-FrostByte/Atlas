import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskDetail from './pages/TaskDetail';
import DailySchedule from './pages/DailySchedule';
import UserManagement from './pages/UserManagement';
import NotificationSettings from './pages/NotificationSettings';
import RecurringTasks from './pages/RecurringTasks';
import DigestPopup from './components/DigestPopup';
import Layout from './components/Layout';
import { WebSocketProvider, useWebSocket } from './contexts/WebSocketContext';
import { Toaster } from './components/ui/sonner';
import './index.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function AppContent({ user, setUser }) {
  const navigate = useNavigate();
  const { connect, disconnect } = useWebSocket();
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (user && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connect();
    } else if (!user && hasConnectedRef.current) {
      hasConnectedRef.current = false;
      disconnect();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage setUser={setUser} />} />
        <Route path="*" element={<Navigate to="/auth" />} />
      </Routes>
    );
  }

  // ── Authenticated — ONE persistent Layout wraps all routes ─────────────────
  // This ensures the sidebar never remounts on navigation, preserving
  // collapsed/expanded state without any workarounds.
  return (
    <>
      <DigestPopup onNavigateToTasks={() => navigate('/tasks')} />
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/tasks" element={<TaskList user={user} />} />
          <Route path="/tasks/:taskId" element={<TaskDetail user={user} />} />
          <Route path="/schedule" element={<DailySchedule user={user} />} />
          <Route path="/users" element={<UserManagement user={user} />} />
          <Route path="/recurring" element={<RecurringTasks user={user} />} />

          {/* ── Settings: admin-only guard at route level ── */}
          <Route
            path="/settings"
            element={
              user.role === 'admin'
                ? <NotificationSettings user={user} />
                : <Navigate to="/" replace />
            }
          />

          <Route path="/auth" element={<Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/users/me')
        .then(res => { setUser(res.data); setLoading(false); })
        .catch(() => { localStorage.removeItem('token'); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <WebSocketProvider>
        <BrowserRouter>
          <AppContent user={user} setUser={setUser} />
        </BrowserRouter>
      </WebSocketProvider>
      <Toaster position="top-right" />
    </>
  );
}

export default App;