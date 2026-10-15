import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, registerSessionExpiredHandler } from '../services/api';

const AuthContext = createContext(null);

// Detect mock mode (defined at build time via Vite)
const USE_MOCK =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK === 'true';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState(null);

  // Logout method (FR-AUTH-12)
  const logout = useCallback((reasonMessage = null) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    if (reasonMessage) {
      setAuthNotice(reasonMessage);
    }
  }, []);

  // Register session expired handler with API service (live mode only)
  useEffect(() => {
    if (!USE_MOCK) {
      registerSessionExpiredHandler((reason) => {
        logout(reason);
      });
    }
  }, [logout]);

  // Initial token validation / hydration
  useEffect(() => {
    const hydrateSession = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);

          // In mock mode, refreshing from the "live" DB just re-reads localStorage.
          // In live mode, silently refresh to catch mid-session role changes (FR-AUTH-09).
          if (parsedUser?._id) {
            try {
              const freshUser = await authAPI.getUserProfile(parsedUser._id);
              setUser(freshUser);
              localStorage.setItem('user', JSON.stringify(freshUser));
            } catch (err) {
              // If account was deactivated (403) or token expired (401), logout
              if (!USE_MOCK) {
                console.warn('Initial session refresh warning:', err?.message);
              }
            }
          }
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    hydrateSession();
  }, [logout]);

  // Authenticate user
  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    const { token: receivedToken, user: receivedUser } = data;

    localStorage.setItem('token', receivedToken);
    localStorage.setItem('user', JSON.stringify(receivedUser));
    setToken(receivedToken);
    setUser(receivedUser);
    setAuthNotice(null);

    return receivedUser;
  };

  // Register public user and auto-login
  const register = async (userData) => {
    await authAPI.register(userData);
    return await login(userData.email, userData.password);
  };

  // Live profile refresh from DB (FR-AUTH-09)
  const refreshUser = async () => {
    if (!user?._id) return null;
    try {
      const freshUser = await authAPI.getUserProfile(user._id);
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
      return freshUser;
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
      throw err;
    }
  };

  const clearAuthNotice = () => setAuthNotice(null);

  const value = {
    user,
    token,
    loading,
    role: user?.role || 'guest',
    isAuthenticated: Boolean(token && user),
    authNotice,
    setAuthNotice,
    clearAuthNotice,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
