import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || "guest";
  const STORAGE_KEY = `syncwrite_notifications_${userId}`;

  const [notifications, setNotifications] = useState([]);

  // Load on mount or user change
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      setNotifications(saved);
    } catch {
      setNotifications([]);
    }
  }, [STORAGE_KEY]);

  const save = useCallback((items) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  }, [STORAGE_KEY]);

  const add = useCallback((msg, type = "info", link = null) => {
    const n = { id: crypto.randomUUID(), msg, type, link, ts: Date.now(), read: false };
    setNotifications(prev => {
      const next = [n, ...prev].slice(0, 50);
      save(next);
      return next;
    });
  }, [save]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      save(next);
      return next;
    });
  }, [save]);

  const dismiss = useCallback((id) => {
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== id);
      save(next);
      return next;
    });
  }, [save]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    save([]);
  }, [save]);

  const unread = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, add, markAllRead, dismiss, clearAll, unread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
