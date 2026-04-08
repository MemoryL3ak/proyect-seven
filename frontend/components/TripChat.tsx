"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

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
  tripStatus?: string | null;
  pollInterval?: number;
  onNewMessage?: (senderName: string, content: string) => void;
};

export default function TripChat({ tripId, senderType, senderName, tripStatus, pollInterval = 1500, onNewMessage }: Props) {
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

  const isFinished = tripStatus === "COMPLETED" || tripStatus === "DROPPED_OFF";

  // Auto-minimize when trip finishes
  useEffect(() => {
    if (isFinished && open) setOpen(false);
  }, [isFinished]);

  // Scroll to bottom
  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Focus when opening
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Polling — stop when trip finished
  useEffect(() => {
    if (isFinished && messages.length > 0) return;
    let lastTimestamp: string | null = null;
    let isFirst = true;
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const params = lastTimestamp ? `?since=${encodeURIComponent(lastTimestamp)}` : "";
        const data = await apiFetch<ChatMessage[]>(`/trips/${tripId}/messages${params}`);
        if (data.length > 0) {
          let otherMsgs: ChatMessage[] = [];
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            // Also exclude local optimistic messages by content match
            const localContents = new Set(prev.filter((m) => m.id.startsWith("local-")).map((m) => m.content));
            const fresh = data.filter((m) => !ids.has(m.id));
            if (fresh.length === 0) return prev;
            // Replace local messages with server versions
            const mergedPrev = prev.filter((m) => !(m.id.startsWith("local-") && fresh.some((f) => f.content === m.content && f.senderType === m.senderType)));
            if (!isFirst) {
              otherMsgs = fresh.filter((m) => m.senderType !== senderType && !localContents.has(m.content));
              if (!openRef.current && otherMsgs.length > 0) setUnread((u) => u + otherMsgs.length);
            }
            return [...mergedPrev, ...fresh];
          });
          if (otherMsgs.length > 0) {
            const latest = otherMsgs[otherMsgs.length - 1];
            onNewMessageRef.current?.(latest.senderName, latest.content);
          }
          lastTimestamp = data[data.length - 1].createdAt;
        }
      } catch { /* silent */ }
      isFirst = false;
    };

    poll();
    timer = setInterval(poll, pollInterval);
    return () => clearInterval(timer);
  }, [tripId, pollInterval, senderType, isFinished]);

  const send = useCallback(async () => {
    const text = input.replace(/\n/g, " ").trim();
    if (!text || sending || isFinished) return;
    setInput("");
    setSending(true);
    try {
      const saved = await apiFetch<ChatMessage>(`/trips/${tripId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderType, senderName, content: text }),
      });
      if (saved?.id) {
        setMessages((prev) => prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]);
      } else {
        setMessages((prev) => [...prev, { id: `local-${Date.now()}`, tripId, senderType, senderName, content: text, createdAt: new Date().toISOString() }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, tripId, senderType, senderName, content: text, createdAt: new Date().toISOString() }]);
    }
    setSending(false);
    inputRef.current?.focus();
  }, [input, sending, tripId, senderType, senderName, isFinished]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const isMine = (msg: ChatMessage) => msg.senderType === senderType;
  const otherLabel = senderType === "PASSENGER" ? "Conductor" : "Pasajero";

  // Group consecutive messages from same sender
  const grouped = messages.map((msg, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const next = i < messages.length - 1 ? messages[i + 1] : null;
    const isFirstInGroup = !prev || prev.senderType !== msg.senderType;
    const isLastInGroup = !next || next.senderType !== msg.senderType;
    return { msg, isFirstInGroup, isLastInGroup };
  });

  // Don't show FAB for finished trips with no messages
  if (isFinished && messages.length === 0) return null;

  return (
    <>
      {/* ─── FAB ─── */}
      <button type="button" onClick={() => setOpen((v) => !v)} className="tripchat-fab">
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {unread > 0 && !open && (
          <span className="tripchat-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* ─── Panel ─── */}
      {open && (
        <div className="tripchat-panel">
          {/* Header */}
          <div className="tripchat-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <div className="tripchat-avatar">
                {senderType === "PASSENGER"
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                }
              </div>
              <div>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                  {otherLabel}
                </p>
                <p style={{ color: isFinished ? "rgba(255,255,255,0.4)" : "rgba(33,208,179,0.8)", fontSize: 11, fontWeight: 600, margin: 0 }}>
                  {isFinished ? "Viaje finalizado" : "En línea"}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="tripchat-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="tripchat-messages">
            {messages.length === 0 && (
              <div className="tripchat-empty">
                <div className="tripchat-empty-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                Envía un mensaje para<br />comunicarte con {senderType === "PASSENGER" ? "tu conductor" : "el pasajero"}
              </div>
            )}
            {grouped.map(({ msg, isFirstInGroup, isLastInGroup }) => (
              <div
                key={msg.id}
                className="tripchat-msg-row"
                style={{
                  alignSelf: isMine(msg) ? "flex-end" : "flex-start",
                  marginTop: isFirstInGroup ? 8 : 1,
                }}
              >
                {/* Avatar for other sender (first in group only) */}
                {!isMine(msg) && isFirstInGroup && (
                  <div className="tripchat-msg-avatar">
                    {senderType === "PASSENGER"
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    }
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMine(msg) ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                  {!isMine(msg) && isFirstInGroup && (
                    <span className="tripchat-sender-name">{msg.senderName}</span>
                  )}
                  <div className={isMine(msg) ? "tripchat-bubble-mine" : "tripchat-bubble-other"}>
                    {msg.content}
                  </div>
                  {isLastInGroup && (
                    <span className="tripchat-time" style={{ textAlign: isMine(msg) ? "right" : "left" }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {isFinished ? (
            <div className="tripchat-finished-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              Viaje finalizado — chat cerrado
            </div>
          ) : (
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
                  background: sending || !input.trim() ? "#e2e8f0" : "linear-gradient(135deg, #21D0B3, #14AE98)",
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
          )}
        </div>
      )}

      <style jsx global>{`
        .tripchat-fab {
          position: fixed;
          bottom: calc(70px + env(safe-area-inset-bottom, 0px));
          right: 16px;
          width: 52px; height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #21D0B3, #14AE98);
          border: none;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(33,208,179,0.4), 0 2px 6px rgba(0,0,0,0.1);
          z-index: 45;
          transition: all .2s cubic-bezier(0.34,1.2,0.64,1);
          -webkit-tap-highlight-color: transparent;
        }
        .tripchat-fab:hover { transform: scale(1.05); box-shadow: 0 6px 24px rgba(33,208,179,0.5); }
        .tripchat-fab:active { transform: scale(0.92); }

        .tripchat-badge {
          position: absolute; top: -6px; right: -6px;
          min-width: 20px; height: 20px; border-radius: 10px;
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          color: #fff; font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          padding: 0 5px;
          box-shadow: 0 2px 8px rgba(244,63,94,0.5);
          animation: tripChatPulse .4s ease-out;
          border: 2px solid #fff;
        }

        .tripchat-panel {
          position: fixed; bottom: 0; left: 0; right: 0;
          height: 55vh; max-height: 420px;
          border-radius: 20px 20px 0 0;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid #e2e8f0; border-bottom: none;
          box-shadow: 0 -8px 40px rgba(15,23,42,0.15);
          z-index: 200;
          display: flex; flex-direction: column;
          animation: tripChatSlideUp .3s cubic-bezier(0.16,1,0.3,1) both;
        }

        .tripchat-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          display: flex; align-items: center; gap: 8px;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(33,208,179,0.2);
        }

        .tripchat-avatar {
          width: 36px; height: 36px; border-radius: 12px;
          background: rgba(33,208,179,0.12);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(33,208,179,0.2);
        }

        .tripchat-close-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 6px;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          flex-shrink: 0;
          transition: all .15s;
        }
        .tripchat-close-btn:hover { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); }

        .tripchat-messages {
          flex: 1; overflow-y: auto;
          padding: 8px 14px;
          display: flex; flex-direction: column;
          gap: 1px;
          background: linear-gradient(180deg, #f8fafc, #ffffff);
          -webkit-overflow-scrolling: touch;
        }

        .tripchat-empty {
          text-align: center; color: #94a3b8; font-size: 12.5px;
          padding: 32px 16px; line-height: 1.7;
        }
        .tripchat-empty-icon {
          width: 52px; height: 52px; border-radius: 16px;
          background: #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px;
        }

        .tripchat-msg-row {
          display: flex; align-items: flex-end; gap: 6px;
        }

        .tripchat-msg-avatar {
          width: 24px; height: 24px; border-radius: 8px;
          background: rgba(33,208,179,0.08);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          margin-bottom: 16px;
        }

        .tripchat-sender-name {
          font-size: 10px; font-weight: 700; color: #21D0B3;
          margin: 0 0 2px 2px;
          letter-spacing: 0.02em;
        }

        .tripchat-bubble-mine {
          padding: 10px 14px;
          border-radius: 18px 18px 6px 18px;
          background: linear-gradient(135deg, #21D0B3, #14AE98);
          color: #fff;
          font-size: 14px; line-height: 1.45;
          word-break: break-word;
          box-shadow: 0 1px 4px rgba(33,208,179,0.2);
          animation: tripMsgIn .25s ease-out both;
        }
        .tripchat-bubble-other {
          padding: 10px 14px;
          border-radius: 18px 18px 18px 6px;
          background: #fff;
          color: #1e293b;
          font-size: 14px; line-height: 1.45;
          word-break: break-word;
          border: 1px solid #edf0f5;
          box-shadow: 0 1px 3px rgba(15,23,42,0.04);
          animation: tripMsgIn .25s ease-out both;
        }

        .tripchat-time {
          font-size: 10px; color: #94a3b8;
          margin-top: 3px; padding: 0 4px;
          display: block;
        }

        .tripchat-finished-bar {
          padding: 12px 16px;
          border-top: 1px solid #f1f5f9;
          background: #f8fafc;
          display: flex; align-items: center; justify-content: center;
          gap: 8px;
          color: #94a3b8; font-size: 12px; font-weight: 600;
          flex-shrink: 0;
        }

        .tripchat-input-bar {
          padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid #f1f5f9;
          background: #fff;
          display: flex; gap: 8px;
          flex-shrink: 0;
        }
        .tripchat-input {
          flex: 1; padding: 11px 14px;
          border-radius: 14px;
          background: #f4f7fc;
          border: 1px solid #e2e8f0;
          color: #0f172a; font-size: 14px;
          outline: none; -webkit-appearance: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .tripchat-input:focus {
          border-color: #21D0B3;
          box-shadow: 0 0 0 3px rgba(33,208,179,0.12);
        }
        .tripchat-send-btn {
          width: 42px; height: 42px;
          border-radius: 14px;
          border: none;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all .15s;
        }
        .tripchat-send-btn:active { transform: scale(0.9); }

        @media (min-width: 640px) {
          .tripchat-fab { bottom: calc(70px + env(safe-area-inset-bottom, 0px)); right: 20px; width: 54px; height: 54px; }
          .tripchat-panel {
            bottom: calc(134px + env(safe-area-inset-bottom, 0px));
            left: auto; right: 20px;
            width: 380px; height: auto; max-height: 500px;
            border-radius: 20px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 20px 60px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.06);
            animation: tripChatFadeIn .25s cubic-bezier(0.16,1,0.3,1) both;
          }
          .tripchat-input-bar { padding-bottom: 12px; }
        }

        @keyframes tripChatSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tripChatFadeIn { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tripChatPulse { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes tripMsgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
