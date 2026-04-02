"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ChatMessage = {
  id: string;
  tripId: string;
  senderType: "DRIVER" | "PASSENGER";
  senderName: string;
  content: string;
  createdAt: string;
};

type Props = {
  tripId: string;
  senderType: "DRIVER" | "PASSENGER";
  senderName: string;
  pollInterval?: number;
  /** Called when a new message arrives from the other party */
  onNewMessage?: (senderName: string, content: string) => void;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TripChat({ tripId, senderType, senderName, pollInterval = 3000, onNewMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  // Scroll to bottom
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Reset unread & focus when opening
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Polling
  useEffect(() => {
    let lastTimestamp: string | null = null;
    let isFirstPoll = true;
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const params = lastTimestamp ? `?since=${encodeURIComponent(lastTimestamp)}` : "";
        const data = await apiFetch<ChatMessage[]>(`/trips/${tripId}/messages${params}`);
        if (data.length > 0) {
          let otherMsgs: ChatMessage[] = [];
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = data.filter((m) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            if (!isFirstPoll) {
              otherMsgs = newMsgs.filter((m) => m.senderType !== senderType);
              if (!openRef.current && otherMsgs.length > 0) {
                setUnread((u) => u + otherMsgs.length);
              }
            }
            return [...prev, ...newMsgs];
          });
          // Notify for new messages (skip initial load)
          if (otherMsgs.length > 0) {
            const latest = otherMsgs[otherMsgs.length - 1];
            onNewMessageRef.current?.(latest.senderName, latest.content);
          }
          lastTimestamp = data[data.length - 1].createdAt;
        }
      } catch { /* silent */ }
      isFirstPoll = false;
    };

    poll();
    timer = setInterval(poll, pollInterval);
    return () => clearInterval(timer);
  }, [tripId, pollInterval, senderType]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      const saved = await apiFetch<ChatMessage>(`/trips/${tripId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderType, senderName, content: text }),
      });
      if (saved?.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === saved.id) ? prev : [...prev, saved],
        );
      } else {
        // Optimistic: show message locally even if backend didn't return it
        setMessages((prev) => [...prev, {
          id: `local-${Date.now()}`,
          tripId,
          senderType,
          senderName,
          content: text,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch {
      // Optimistic: show message locally even on error
      setMessages((prev) => [...prev, {
        id: `local-${Date.now()}`,
        tripId,
        senderType,
        senderName,
        content: text,
        createdAt: new Date().toISOString(),
      }]);
    }
    setSending(false);
    inputRef.current?.focus();
  }, [input, sending, tripId, senderType, senderName]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  };

  const isMine = (msg: ChatMessage) => msg.senderType === senderType;
  const otherLabel = senderType === "PASSENGER" ? "Conductor" : "Pasajero";

  return (
    <>
      {/* ─── FAB ─── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tripchat-fab"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {unread > 0 && !open && (
          <span className="tripchat-badge">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ─── Panel ─── */}
      {open && (
        <div className="tripchat-panel">
          {/* Header */}
          <div className="tripchat-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "rgba(33,208,179,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                  Chat del viaje
                </p>
                <p style={{ color: "rgba(33,208,179,0.8)", fontSize: 11, fontWeight: 600, margin: 0 }}>
                  {otherLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8, padding: "4px 10px",
                color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              Cerrar
            </button>
          </div>

          {/* Messages */}
          <div className="tripchat-messages">
            {messages.length === 0 && (
              <div style={{
                textAlign: "center", color: "#94a3b8", fontSize: 12.5,
                padding: "28px 16px", lineHeight: 1.7,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "#f1f5f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 10px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                Envía un mensaje para<br />comunicarte con {senderType === "PASSENGER" ? "tu conductor" : "el pasajero"}
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMine(msg) ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                  alignSelf: isMine(msg) ? "flex-end" : "flex-start",
                }}
              >
                {!isMine(msg) && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#21D0B3",
                    marginBottom: 2, marginLeft: 10,
                    letterSpacing: "0.02em",
                  }}>
                    {msg.senderName}
                  </span>
                )}
                <div className={isMine(msg) ? "tripchat-bubble-mine" : "tripchat-bubble-other"}>
                  {msg.content}
                </div>
                <span style={{
                  fontSize: 10, color: "#94a3b8",
                  marginTop: 2,
                  marginRight: isMine(msg) ? 6 : 0,
                  marginLeft: isMine(msg) ? 0 : 10,
                }}>
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="tripchat-input-bar">
            <input
              ref={inputRef}
              className="tripchat-input"
              placeholder="Escribe un mensaje..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
              maxLength={1000}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="tripchat-send-btn"
              style={{
                background: sending || !input.trim()
                  ? "#e2e8f0"
                  : "linear-gradient(135deg, #21D0B3, #14AE98)",
                cursor: sending || !input.trim() ? "not-allowed" : "pointer",
                boxShadow: sending || !input.trim() ? "none" : "0 2px 8px rgba(33,208,179,0.3)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sending || !input.trim() ? "#94a3b8" : "#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* ─── FAB ─── */
        .tripchat-fab {
          position: fixed;
          bottom: calc(70px + env(safe-area-inset-bottom, 0px));
          right: 16px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #21D0B3, #14AE98);
          border: 2px solid rgba(33,208,179,0.6);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(33,208,179,0.35), 0 2px 6px rgba(0,0,0,0.15);
          z-index: 45;
          transition: all .15s;
          -webkit-tap-highlight-color: transparent;
        }
        .tripchat-fab:active {
          transform: scale(0.9);
        }

        /* ─── Badge ─── */
        .tripchat-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          background: #f43f5e;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          box-shadow: 0 2px 8px rgba(244,63,94,0.5);
          animation: tripChatPulse .5s ease-out;
        }

        /* ─── Panel — mobile: compact bottom sheet ─── */
        .tripchat-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50vh;
          max-height: 380px;
          border-radius: 18px 18px 0 0;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-bottom: none;
          box-shadow: 0 -6px 30px rgba(15,23,42,0.12);
          z-index: 200;
          display: flex;
          flex-direction: column;
          animation: tripChatSlideUp .25s cubic-bezier(0.16,1,0.3,1) both;
        }

        /* ─── Header ─── */
        .tripchat-header {
          padding: 10px 14px;
          background: linear-gradient(135deg, #30455B, #243550);
          border-bottom: 2px solid #21D0B3;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        /* ─── Messages area ─── */
        .tripchat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: #f8fafc;
          -webkit-overflow-scrolling: touch;
        }

        /* ─── Bubbles ─── */
        .tripchat-bubble-mine {
          padding: 8px 12px;
          border-radius: 16px 16px 4px 16px;
          background: linear-gradient(135deg, #21D0B3, #14AE98);
          color: #fff;
          font-size: 13.5px;
          line-height: 1.4;
          word-break: break-word;
          box-shadow: 0 1px 4px rgba(33,208,179,0.15);
        }
        .tripchat-bubble-other {
          padding: 8px 12px;
          border-radius: 16px 16px 16px 4px;
          background: #ffffff;
          color: #1e293b;
          font-size: 13.5px;
          line-height: 1.4;
          word-break: break-word;
          border: 1px solid #e8edf3;
          box-shadow: 0 1px 2px rgba(15,23,42,0.03);
        }

        /* ─── Input bar ─── */
        .tripchat-input-bar {
          padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid #f1f5f9;
          background: #fff;
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .tripchat-input {
          flex: 1;
          padding: 10px 12px;
          border-radius: 12px;
          background: #f4f7fc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          -webkit-appearance: none;
        }
        .tripchat-input:focus {
          border-color: #21D0B3;
          box-shadow: 0 0 0 3px rgba(33,208,179,0.1);
        }
        .tripchat-send-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all .15s;
        }
        .tripchat-send-btn:active {
          transform: scale(0.9);
        }

        /* ─── Desktop: floating panel ─── */
        @media (min-width: 640px) {
          .tripchat-fab {
            bottom: calc(70px + env(safe-area-inset-bottom, 0px));
            right: 20px;
            width: 50px;
            height: 50px;
          }
          .tripchat-panel {
            bottom: calc(130px + env(safe-area-inset-bottom, 0px));
            left: auto;
            right: 20px;
            width: 360px;
            height: auto;
            max-height: 460px;
            border-radius: 16px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 16px 48px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.06);
            animation: tripChatFadeIn .2s cubic-bezier(0.16,1,0.3,1) both;
          }
          .tripchat-input-bar {
            padding-bottom: 10px;
          }
        }

        /* ─── Animations ─── */
        @keyframes tripChatSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes tripChatFadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes tripChatPulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.25); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
