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
  }, [user, connect, disconnect]);

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage setUser={setUser} />} />
        <Route path="*" element={<Navigate to="/auth" />} />
      </Routes>
    );
  }

  return (
    <>
      
      <div style={{ position: 'relative', zIndex: 100 }}>
        <DigestPopup onNavigateToTasks={() => navigate('/tasks')} />
      </div>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/tasks" element={<TaskList user={user} />} />
          <Route path="/tasks/:taskId" element={<TaskDetail user={user} />} />
          <Route path="/schedule" element={<DailySchedule user={user} />} />
          <Route path="/users" element={<UserManagement user={user} />} />
          <Route path="/recurring" element={<RecurringTasks user={user} />} />
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

  // Here is the new loader properly placed where the 'loading' state exists
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background fixed inset-0 z-50">
        <svg viewBox="0 0 100 100" className="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-xl" xmlns="http://www.w3.org/2000/svg">
          <style>
            {`
              @keyframes satellite-orbit {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes globe-pulse {
                0%, 100% { opacity: 0.8; transform: scale(0.96); }
                50% { opacity: 1; transform: scale(1.02); }
              }
              .orbiting-dot {
                transform-origin: 50px 48px;
                animation: satellite-orbit 1.5s linear infinite;
              }
              .pulsing-globe {
                transform-origin: 50px 48px;
                animation: globe-pulse 2s ease-in-out infinite;
              }
            `}
          </style>

          <defs>
            <mask id="loader-mask">
              <circle cx="50" cy="48" r="42" fill="white" />
              <path d="M 15 105 L 50 45 L 85 105 Z" fill="black" />
              <ellipse cx="50" cy="48" rx="20" ry="42" stroke="black" strokeWidth="3" fill="none" />
              <line x1="50" y1="6" x2="50" y2="90" stroke="black" strokeWidth="3" />
              <line x1="8" y1="48" x2="92" y2="48" stroke="black" strokeWidth="3" />
            </mask>
          </defs>

          {/* Pulsing Globe Base */}
          <circle
            cx="50" cy="48" r="42"
            className="fill-primary pulsing-globe"
            mask="url(#loader-mask)"
          />

          {/* Orbiting Crimson Dot */}
          {/* Orbiting Glowing Crimson Dot */}
          <g className="orbiting-dot">
            <circle cx="50" cy="72" r="8" fill="#FF2E63" style={{ filter: 'drop-shadow(0px 0px 4px #FF2E63)' }} />
          </g>
        </svg>
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