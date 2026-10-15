import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import ProfilePage from './pages/ProfilePage';
import CalendarPage from './pages/CalendarPage';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import OrganizerDashboardPage from './pages/OrganizerDashboardPage';
import ReportsPage from './pages/ReportsPage';
import EventFormPage from './pages/EventFormPage';
import RosterCheckInPage from './pages/RosterCheckInPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminEventsPage from './pages/AdminEventsPage';
import EventDetailsPage from './pages/EventDetailsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected Routes (Role-Aware AppShell layout automatically attached) */}
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:id"
            element={
              <ProtectedRoute>
                <EventDetailsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/my-registrations"
            element={
              <ProtectedRoute allowedRoles={['member', 'admin']}>
                <MyRegistrationsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <OrganizerDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/new"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <EventFormPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <EventFormPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:id/roster"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <RosterCheckInPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/events"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminEventsPage />
              </ProtectedRoute>
            }
          />

          {/* Root and Fallback redirection */}
          <Route path="/" element={<Navigate to="/calendar" replace />} />
          <Route path="*" element={<Navigate to="/calendar" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
