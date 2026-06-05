import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import useAuthStore from './store/authStore';

import LoginPage       from './pages/LoginPage';
import RegisterPage, { ProfilePage as ProfilePageStub } from './pages/RegisterPage';
import ProfilePage    from './pages/ProfilePage';
import AdminPage      from './pages/AdminPage';
import DashboardPage   from './pages/DashboardPage';
import LabRoomPage     from './pages/LabRoomPage';
import LeaderboardPage from './pages/LeaderboardPage';


import ProtectedRoute  from './components/common/ProtectedRoute';
import Layout          from './components/common/Layout';

export default function App() {
  const { accessToken, fetchMe } = useAuthStore();

  useEffect(() => {
    if (accessToken) fetchMe();
  }, [accessToken]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1c2333', color: '#e6edf3', border: '1px solid #30363d' },
          success: { iconTheme: { primary: '#3fb950', secondary: '#1c2333' } },
          error:   { iconTheme: { primary: '#f85149', secondary: '#1c2333' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/"             element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<DashboardPage />} />
            <Route path="/room/:slug"   element={<LabRoomPage />} />
            <Route path="/leaderboard"  element={<LeaderboardPage />} />
            <Route path="/profile"      element={<ProfilePage />} />
            <Route path="/profile/:id"  element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
