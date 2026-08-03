import { useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "../context/NotificationContext.jsx";

const ICONS = {
  info:    { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>, cls: "notif-info" },
  success: { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, cls: "notif-success" },
  warning: { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, cls: "notif-warning" },
  error:   { svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, cls: "notif-error" },
};

export default function NotificationPanel({ onClose }) {
  const { notifications, markAllRead, dismiss, clearAll } = useNotifications();
  const panelRef = useRef(null);

  // Mark all as read when panel opens
  useEffect(() => { markAllRead(); }, [markAllRead]);

  // Close on outside click
  useEffect(() => {
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="notif-panel" ref={panelRef} role="dialog" aria-label="Notifications">
      <div className="notif-panel-header">
        <h3>Notifications</h3>
        <div className="notif-panel-actions">
          {notifications.length > 0 && (
            <button className="notif-clear-btn" onClick={clearAll} title="Clear all">Clear all</button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close notifications">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div className="notif-list">
        {notifications.length === 0 ? (
          <div className="notif-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <p>All caught up!</p>
          </div>
        ) : (
          notifications.map(n => {
            const icon = ICONS[n.type] || ICONS.info;
            return (
              <div key={n.id} className={`notif-item ${icon.cls}${n.read ? " read" : ""}`}>
                <div className={`notif-icon`}>{icon.svg}</div>
                <div className="notif-content">
                  <p className="notif-msg">{n.msg}</p>
                  <span className="notif-time">{formatDistanceToNow(new Date(n.ts))} ago</span>
                </div>
                <button
                  className="notif-dismiss"
                  onClick={() => dismiss(n.id)}
                  title="Dismiss"
                  aria-label="Dismiss notification"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
