"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AppNotification = {
  id: string;
  message: string;
  emoji: string;
  timestamp: number;
  read: boolean;
};

/* ------------------------------------------------------------------ */
/*  Hook: useNotifications                                             */
/* ------------------------------------------------------------------ */

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const push = useCallback((message: string, emoji: string) => {
    const n: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      emoji,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => [n, ...prev].slice(0, 50));

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification(`${emoji} Seven Arena`, {
        body: message,
        icon: "/branding/LOGO-SEVEN-1.png",
      });
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, push, markAllRead, clear };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type Props = {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onClear: () => void;
};

export default function NotificationBell({
  notifications,
  unreadCount,
  onMarkAllRead,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Position dropdown relative to bell button, rendered via portal
  useEffect(() => {
    if (!open || !bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const dropdownWidth = Math.min(300, window.innerWidth - 24);
    // Try to align right edge with the bell button
    let right = window.innerWidth - rect.right;
    // If it would go off the left edge, center it instead
    if (window.innerWidth - right - dropdownWidth < 12) {
      right = Math.round((window.innerWidth - dropdownWidth) / 2);
    }
    setDropdownPos({
      top: rect.bottom + 6,
      right,
    });
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // Don't close if clicking the bell button itself
      if (bellRef.current?.contains(e.target as Node)) return;
      // Check if clicking inside the dropdown
      const dropdown = document.getElementById("notifbell-portal");
      if (dropdown?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = () => {
    if (!open && unreadCount > 0) onMarkAllRead();
    setOpen((v) => !v);
  };

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return new Date(ts).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  };

  const dropdown = open && dropdownPos && createPortal(
    <div
      id="notifbell-portal"
      style={{
        position: "fixed",
        top: dropdownPos.top,
        right: Math.max(dropdownPos.right, 10),
        width: Math.min(300, window.innerWidth - 24),
        maxHeight: 320,
        borderRadius: 14,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 12px 40px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column" as const,
        zIndex: 9999,
        animation: "notifDrop .2s cubic-bezier(0.16,1,0.3,1) both",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px 8px",
        borderBottom: "1px solid #f1f5f9",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
          Notificaciones
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                fontSize: 11, fontWeight: 600, color: "#94a3b8",
                background: "none", border: "none", cursor: "pointer",
                padding: "3px 6px", borderRadius: 4,
              }}
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 7,
              border: "1px solid #e2e8f0", background: "#f8fafc",
              color: "#94a3b8", cursor: "pointer", flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" as any }}>
        {notifications.length === 0 ? (
          <div style={{
            padding: "20px 14px",
            textAlign: "center",
            color: "#b0b8c9",
            fontSize: 12.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Sin notificaciones
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid #f8fafc",
                background: n.read ? "transparent" : "rgba(33,208,179,0.04)",
              }}
            >
              {(() => {
                const e = n.emoji;
                const isError = e === "❌" || e === "error";
                const isSuccess = e === "✅" || e === "ok" || e === "done";
                const isStar = e === "⭐" || e === "star";
                const isChat = e === "💬" || e === "chat";
                const isCar = e === "🚖" || e === "🚗" || e === "car";
                const isPin = e === "📍" || e === "pin" || e === "location";
                const isWarning = e.includes("⚠") || e === "warning";
                const isCamera = e === "📷" || e === "camera" || e === "photo";
                const isCal = e === "📅" || e === "cal" || e === "calendar";
                const bg = isError ? "rgba(239,68,68,0.08)" : isStar ? "rgba(245,158,11,0.08)" : isWarning ? "rgba(245,158,11,0.08)" : "rgba(33,208,179,0.08)";
                return (
                  <span style={{ flexShrink:0, width:30, height:30, borderRadius:8, background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isError ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    ) : isSuccess ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : isStar ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ) : isChat ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    ) : isCar ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    ) : isPin ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ) : isWarning ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    ) : isCamera ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    ) : isCal ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    )}
                  </span>
                );
              })()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12.5, fontWeight: n.read ? 500 : 600,
                  color: "#1e293b", margin: 0, lineHeight: 1.4,
                }}>
                  {n.message}
                </p>
                <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>
                  {formatTime(n.timestamp)}
                </p>
              </div>
              {!n.read && (
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "#21D0B3", flexShrink: 0,
                  boxShadow: "0 0 6px rgba(33,208,179,0.5)",
                }} />
              )}
            </div>
          ))
        )}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {/* Bell button */}
      <button
        ref={bellRef}
        type="button"
        onClick={toggle}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 42,
          height: 42,
          borderRadius: 14,
          border: "1px solid rgba(33,208,179,0.4)",
          background: open ? "rgba(33,208,179,0.18)" : "rgba(33,208,179,0.08)",
          cursor: "pointer",
          transition: "all .15s",
          flexShrink: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            minWidth: 18, height: 18, borderRadius: 9,
            background: "#f43f5e", color: "#fff",
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 5px",
            boxShadow: "0 2px 8px rgba(244,63,94,0.5)",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {dropdown}

      <style jsx global>{`
        @keyframes notifDrop {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
