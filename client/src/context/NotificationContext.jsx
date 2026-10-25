import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useAuth } from './AuthContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!user) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setError('');
    } catch (requestError) {
      if (!silent) setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError('');
      return undefined;
    }

    refresh();
    const intervalId = window.setInterval(() => {
      refresh({ silent: true });
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [refresh, user]);

  const markRead = async (notificationId) => {
    const { data } = await api.patch(`/notifications/${notificationId}/read`);
    setNotifications((current) => current.map((notification) => (
      notification._id === notificationId ? data.notification : notification
    )));
    setUnreadCount((count) => Math.max(0, count - 1));
    return data.notification;
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, error, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
