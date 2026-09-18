"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "@/lib/api";
import {
  FileTextIcon,
  XIcon,
  BellIcon,
  CheckIcon,
  StarIcon,
  MessageIcon,
  TruckIcon,
  PinIcon,
  AlertIcon,
  CameraIcon,
  CalendarIcon,
  ChevronRightIcon,
} from "@/components/ui/Icons";
import { BRAND } from "@/lib/design";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AppNotification = {
  id: string;
  message: string;
  emoji: string;
  timestamp: number;
  read: boolean;
  /** Destino al pinchar la notificación (módulo/contexto relacionado). */
  href?: string;
};

type ServerNotificationRow = {
  id: string;
  user_kind: string;
  user_id: string;
  title: string;
  body: string;
  emoji: string | null;
  kind: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type UserKind = "athlete" | "driver" | "admin" | "provider_participant";

export type UseNotificationsOptions = {
  /** Type of user — when set together with userId, the bell pulls from
   *  the API and persists across reloads. Without this, the bell stays
   *  fully in-memory (legacy mode). */
  userKind?: UserKind;
  userId?: string | null;
  /** Polling interval in ms. Default 30s. */
  pollIntervalMs?: number;
};

const DEFAULT_POLL_MS = 30_000;
const SERVER_PREFIX = "srv:";

/** Deriva el destino de navegación a partir del `data` de la notificación. */
function hrefFromData(data: Record<string, unknown> | null | undefined): string | undefined {
  if (!data) return undefined;
  const rawUrl = typeof data.url === "string" ? data.url : undefined;
  if (!rawUrl) return undefined;
  let href = rawUrl;
  // Adjunta el contexto (viaje / premiación) como query para que el destino
  // pueda abrir el detalle o el tab correspondiente.
  if (typeof data.tripId === "string" && data.tripId) {
    href += (href.includes("?") ? "&" : "?") + `tripId=${encodeURIComponent(data.tripId)}`;
  }
  if (typeof data.premiacionId === "string" && data.premiacionId) {
    href += (href.includes("?") ? "&" : "?") + `premiacionId=${encodeURIComponent(data.premiacionId)}`;
  }
  return href;
}

function rowToNotification(row: ServerNotificationRow): AppNotification {
  return {
    id: `${SERVER_PREFIX}${row.id}`,
    message: row.body || row.title,
    emoji: row.emoji ?? "🔔",
    timestamp: new Date(row.created_at).getTime(),
    read: row.read_at !== null,
    href: hrefFromData(row.data),
  };
}

/* ------------------------------------------------------------------ */
/*  Hook: useNotifications                                             */
/* ------------------------------------------------------------------ */

export function useNotifications(opts: UseNotificationsOptions = {}) {
  const { userKind, userId, pollIntervalMs = DEFAULT_POLL_MS } = opts;
  const serverMode = !!(userKind && userId);

  // Local-only entries created via push(). Survive only as long as the
  // component tree lives — same as legacy behavior.
  const [localNotifs, setLocalNotifs] = useState<AppNotification[]>([]);
  // Server-backed entries pulled from the inbox.
  const [serverNotifs, setServerNotifs] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!serverMode) return;
    try {
      const rows = await apiFetch<ServerNotificationRow[]>(
        `/notifications?userKind=${encodeURIComponent(userKind!)}&userId=${encodeURIComponent(userId!)}`,
      );
      setServerNotifs(rows.map(rowToNotification));
    } catch {
      // Polling errors are silent — try again next tick.
    }
  }, [serverMode, userKind, userId]);

  useEffect(() => {
    if (!serverMode) {
      setServerNotifs([]);
      return;
    }
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [serverMode, refresh, pollIntervalMs]);

  const push = useCallback((message: string, emoji: string) => {
    const n: AppNotification = {
      id: `local:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      emoji,
      timestamp: Date.now(),
      read: false,
    };
    setLocalNotifs((prev) => [n, ...prev].slice(0, 50));

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("Seven Arena", {
        body: message,
        icon: "/branding/LOGO-SEVEN-1.png",
      });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setLocalNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    if (serverMode) {
      // Optimistic: mark visually first, then sync.
      setServerNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        await apiFetch("/notifications/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKind, userId }),
        });
      } catch {
        // If the call fails, the next poll re-syncs reality.
        void refresh();
      }
    }
  }, [serverMode, userKind, userId, refresh]);

  const clear = useCallback(async () => {
    setLocalNotifs([]);
    if (serverMode) {
      setServerNotifs([]);
      try {
        await apiFetch("/notifications/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKind, userId }),
        });
      } catch {
        void refresh();
      }
    }
  }, [serverMode, userKind, userId, refresh]);

  // Merge + dedupe + sort by timestamp desc.
  const notifications = useMemo(() => {
    const map = new Map<string, AppNotification>();
    for (const n of [...serverNotifs, ...localNotifs]) {
      map.set(n.id, n);
    }
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [serverNotifs, localNotifs]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, push, markAllRead, clear, refresh };
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

  const handleNotifClick = (n: AppNotification) => {
    if (!n.href) return;
    setOpen(false);
    if (typeof window !== "undefined") {
      window.location.href = n.href;
    }
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
            <XIcon size={12} strokeWidth={2.5} />
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
            <BellIcon size={16} color="#cbd5e1" strokeWidth={1.8} />
            Sin notificaciones
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotifClick(n)}
              role={n.href ? "button" : undefined}
              tabIndex={n.href ? 0 : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid #f8fafc",
                background: n.read ? "transparent" : "rgba(33,208,179,0.04)",
                cursor: n.href ? "pointer" : "default",
              }}
            >
              {(() => {
                const e = n.emoji;
                const isError = e === "❌" || e === "error";
                const isSuccess = e === "✅" || e === "ok" || e === "done";
                const isStar = e === "⭐" || e === "star";
                const isChat = e === "💬" || e === "chat";
                const isCar = e === "🚖" || e === "🚗" || e === "🚕" || e === "car";
                const isPin = e === "📍" || e === "pin" || e === "location";
                const isWarning = e.includes("⚠") || e === "warning";
                const isCamera = e === "📷" || e === "camera" || e === "photo";
                const isCal = e === "📅" || e === "cal" || e === "calendar";
                const isSupport = e === "🛟" || e === "support";
                const isDoc = e === "📄" || e === "doc";
                const bg = isError ? "rgba(239,68,68,0.08)" : isStar ? "rgba(245,158,11,0.08)" : isWarning ? "rgba(245,158,11,0.08)" : "rgba(33,208,179,0.08)";
                return (
                  <span style={{ flexShrink:0, width:30, height:30, borderRadius:8, background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {isError ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    ) : isSuccess ? (
                      <CheckIcon size={14} color="#10b981" strokeWidth={2.5} />
                    ) : isStar ? (
                      <StarIcon size={14} color="#f59e0b" strokeWidth={1} fill="#f59e0b" />
                    ) : isChat ? (
                      <MessageIcon size={14} color={BRAND.teal} strokeWidth={2} />
                    ) : isCar ? (
                      <TruckIcon size={14} color={BRAND.teal} strokeWidth={2} />
                    ) : isPin ? (
                      <PinIcon size={14} color="#3b82f6" strokeWidth={2} />
                    ) : isWarning ? (
                      <AlertIcon size={14} color="#f59e0b" strokeWidth={2} />
                    ) : isCamera ? (
                      <CameraIcon size={14} color="#64748b" strokeWidth={2} />
                    ) : isCal ? (
                      <CalendarIcon size={14} color="#0ea5e9" strokeWidth={2} />
                    ) : isDoc ? (
                      <FileTextIcon size={14} color="#64748b" />
                    ) : isSupport ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M14.83 9.17l3.53-3.53M4.93 19.07l4.24-4.24"/></svg>
                    ) : (
                      <BellIcon size={14} color={BRAND.teal} strokeWidth={2} />
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
                  background: BRAND.teal, flexShrink: 0,
                  boxShadow: "0 0 6px rgba(33,208,179,0.5)",
                }} />
              )}
              {n.href && (
                <ChevronRightIcon size={14} color="#cbd5e1" strokeWidth={2.5} style={{ flexShrink: 0 }} />
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
          // Mismo tamaño que los demás botones del header del portal
          // (asistencia / actualizar / salir son de 34×34, radio 10).
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid rgba(33,208,179,0.4)",
          background: open ? "rgba(33,208,179,0.18)" : "rgba(33,208,179,0.08)",
          cursor: "pointer",
          transition: "all .15s",
          flexShrink: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <BellIcon size={16} color={BRAND.teal} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            minWidth: 16, height: 16, borderRadius: 8,
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
