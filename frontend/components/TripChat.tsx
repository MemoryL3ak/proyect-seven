"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { REPORT_CATEGORY, REPORT_REASONS, reportReasonLabel } from "@/lib/chat-report";

type ChatMessage = {
  id: string;
  tripId: string;
  senderType: "DRIVER" | "PASSENGER";
  senderName: string;
  content: string;
  createdAt: string;
};

/** El bloqueo vive en la base de datos (core.chat_blocks, endpoints
 *  /chat-blocks/:tripId) asociado a usuario y viaje: acompaña al usuario en
 *  cualquier dispositivo. localStorage queda solo como caché local y como
 *  origen de la migración de los bloqueos guardados antes de este cambio. */
const blockStorageKey = (tripId: string) => `seven.blocked.trip.${tripId}`;

type ReportTarget =
  | { kind: "message"; msg: ChatMessage }
  | { kind: "conversation" }
  | null;

type Props = {
  tripId: string;
  senderType: "DRIVER" | "PASSENGER";
  senderName: string;
  tripStatus?: string | null;
  pollInterval?: number;
  onNewMessage?: (senderName: string, content: string) => void;
  /** Identidad de quien usa el chat. Necesaria para abrir el caso de soporte
   *  cuando denuncia o bloquea. */
  reporterOriginType: "athlete" | "driver" | "provider_participant";
  reporterOriginId: string;
  eventId?: string | null;
};

export default function TripChat({ tripId, senderType, senderName, tripStatus, pollInterval = 1500, onNewMessage, reporterOriginType, reporterOriginId, eventId }: Props) {
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

  // ── Denuncia y bloqueo (política de contenido generado por usuarios) ──
  const [blocked, setBlocked] = useState(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0].value);
  const [reportDetail, setReportDetail] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Restaurar el bloqueo desde el servicio (con la caché local como arranque
  // rápido y respaldo sin red). Si había un bloqueo guardado solo en este
  // dispositivo (versión anterior), se migra al servicio.
  useEffect(() => {
    let localBlocked = false;
    try {
      localBlocked = window.localStorage.getItem(blockStorageKey(tripId)) === "1";
    } catch { /* almacenamiento no disponible */ }
    setBlocked(localBlocked);

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ blocked: boolean }>(`/chat-blocks/${tripId}`);
        if (cancelled) return;
        if (res.blocked) {
          setBlocked(true);
          try { window.localStorage.setItem(blockStorageKey(tripId), "1"); } catch {}
        } else if (localBlocked) {
          // Migración: bloqueo previo solo local → persistirlo en el servicio.
          await apiFetch(`/chat-blocks/${tripId}`, { method: "POST" });
        }
      } catch { /* sin red o backend antiguo: rige la caché local */ }
    })();
    return () => { cancelled = true; };
  }, [tripId]);

  // El aviso es informativo; se retira solo para no tapar la conversación
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

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
            // Bloqueado: no se acumulan no leídos ni se emiten notificaciones
            if (!isFirst && !blockedRef.current) {
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
    if (!text || sending || isFinished || blocked) return;
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
  }, [input, sending, tripId, senderType, senderName, isFinished, blocked]);

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const isMine = (msg: ChatMessage) => msg.senderType === senderType;
  const otherLabel = senderType === "PASSENGER" ? "Conductor" : "Pasajero";
  const otherRole = senderType === "PASSENGER" ? "DRIVER" : "PASSENGER";

  /** Abre un caso en el módulo de soporte que ya existe. No hace falta un
   *  endpoint nuevo: `category`, `priority` y `metadata` son libres en el DTO. */
  const openSupportCase = useCallback(
    async (payload: { subject: string; initialMessage: string; metadata: Record<string, unknown> }) => {
      await apiFetch(`/support-chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventId || undefined,
          originType: reporterOriginType,
          originId: reporterOriginId,
          originName: senderName,
          category: REPORT_CATEGORY,
          priority: "HIGH",
          subject: payload.subject,
          initialMessage: payload.initialMessage,
          metadata: payload.metadata,
        }),
      });
    },
    [eventId, reporterOriginType, reporterOriginId, senderName],
  );

  const submitReport = useCallback(async () => {
    if (!reportTarget || reportSending) return;
    setReportSending(true);
    const reasonLabel = reportReasonLabel(reportReason);
    const reported = reportTarget.kind === "message" ? reportTarget.msg : null;
    try {
      await openSupportCase({
        subject: "Denuncia de contenido en chat de viaje",
        initialMessage: [
          `Motivo: ${reasonLabel}`,
          reported
            ? `Mensaje denunciado de ${reported.senderName}: "${reported.content}"`
            : "Denuncia de la conversación completa.",
          reportDetail.trim() ? `Detalle: ${reportDetail.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          source: "trip_chat",
          tripId,
          reason: reportReason,
          reportedMessageId: reported?.id ?? null,
          reportedContent: reported?.content ?? null,
          reportedSenderType: reported?.senderType ?? otherRole,
          reportedSenderName: reported?.senderName ?? null,
        },
      });
      setNotice("Recibimos tu denuncia. Operaciones la revisará.");
    } catch {
      setNotice("No pudimos enviar la denuncia. Vuelve a intentarlo.");
    }
    setReportSending(false);
    setReportTarget(null);
    setReportDetail("");
    setReportReason(REPORT_REASONS[0].value);
  }, [reportTarget, reportSending, reportReason, reportDetail, tripId, otherRole, openSupportCase]);

  /** El bloqueo corta el canal directo pero no el traslado: avisa a operaciones
   *  para que tome la coordinación y nadie quede incomunicado. */
  const toggleBlock = useCallback(async () => {
    const next = !blocked;
    setBlocked(next);
    setMenuOpen(false);
    try {
      if (next) window.localStorage.setItem(blockStorageKey(tripId), "1");
      else window.localStorage.removeItem(blockStorageKey(tripId));
    } catch { /* almacenamiento no disponible: rige el registro del servicio */ }
    try {
      await apiFetch(`/chat-blocks/${tripId}`, { method: next ? "POST" : "DELETE" });
    } catch { /* sin red: la caché local mantiene el estado y se migra al reabrir */ }
    if (!next) {
      setNotice(null);
      return;
    }
    try {
      await openSupportCase({
        subject: "Usuario bloqueado en chat de viaje",
        initialMessage: `${senderName} bloqueó a su ${otherLabel.toLowerCase()} en el chat del viaje. La coordinación debe seguir por operaciones.`,
        metadata: { source: "trip_chat_block", tripId, blockedRole: otherRole },
      });
    } catch { /* el bloqueo local ya está aplicado */ }
    setNotice("Bloqueaste este chat. Operaciones fue notificada.");
  }, [blocked, tripId, senderName, otherLabel, otherRole, openSupportCase]);

  // Bloqueado: solo se ven los mensajes propios
  const visibleMessages = blocked ? messages.filter(isMine) : messages;

  // Group consecutive messages from same sender
  const grouped = visibleMessages.map((msg, i) => {
    const prev = i > 0 ? visibleMessages[i - 1] : null;
    const next = i < visibleMessages.length - 1 ? visibleMessages[i + 1] : null;
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
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="tripchat-close-btn"
                aria-label="Opciones de seguridad del chat"
                aria-expanded={menuOpen}
                title="Opciones de seguridad"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="tripchat-menu-scrim" onClick={() => setMenuOpen(false)} />
                  <div className="tripchat-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setReportTarget({ kind: "conversation" }); }}>
                      Denunciar conversación
                    </button>
                    <button type="button" role="menuitem" className="tripchat-menu-danger" onClick={toggleBlock}>
                      {blocked ? `Desbloquear al ${otherLabel.toLowerCase()}` : `Bloquear al ${otherLabel.toLowerCase()}`}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="tripchat-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="tripchat-messages">
            {visibleMessages.length === 0 && !blocked && (
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
                <div style={{ maxWidth: "78%" }}>
                  {!isMine(msg) && isFirstInGroup && (
                    <span className="tripchat-sender-name">{msg.senderName}</span>
                  )}
                  {/* `overflow-wrap: break-word` (de la clase) y no `anywhere`:
                      `anywhere` colapsa el ancho intrínseco del bubble y parte
                      mensajes cortos en dos líneas. */}
                  <div className={isMine(msg) ? "tripchat-bubble-mine" : "tripchat-bubble-other"}>
                    {msg.content}
                  </div>
                  {isLastInGroup && (
                    <span className="tripchat-time" style={{ textAlign: isMine(msg) ? "right" : "left" }}>
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>
                {!isMine(msg) && (
                  <button
                    type="button"
                    className="tripchat-report-btn"
                    title="Denunciar este mensaje"
                    aria-label={`Denunciar el mensaje de ${msg.senderName}`}
                    onClick={() => setReportTarget({ kind: "message", msg })}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {notice && (
            <div className="tripchat-notice" role="status">{notice}</div>
          )}

          {/* Input */}
          {blocked ? (
            <div className="tripchat-blocked-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
              </svg>
              <span style={{ flex: 1 }}>
                Bloqueaste al {otherLabel.toLowerCase()}. La coordinación del viaje sigue por operaciones.
              </span>
              <button type="button" className="tripchat-unblock-btn" onClick={toggleBlock}>
                Desbloquear
              </button>
            </div>
          ) : isFinished ? (
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

      {/* ─── Hoja de denuncia ─── */}
      {reportTarget && (
        <div className="tripchat-report-scrim" onClick={() => !reportSending && setReportTarget(null)}>
          <div className="tripchat-report-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Denunciar contenido">
            <p className="tripchat-report-title">Denunciar contenido</p>
            <p className="tripchat-report-sub">
              {reportTarget.kind === "message"
                ? `Mensaje de ${reportTarget.msg.senderName}: “${reportTarget.msg.content.slice(0, 120)}”`
                : "Se denunciará la conversación completa de este viaje."}
            </p>

            <label className="tripchat-report-label" htmlFor="tripchat-report-reason">Motivo</label>
            <select
              id="tripchat-report-reason"
              className="tripchat-report-select"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <label className="tripchat-report-label" htmlFor="tripchat-report-detail">Detalle (opcional)</label>
            <textarea
              id="tripchat-report-detail"
              className="tripchat-report-textarea"
              value={reportDetail}
              onChange={(e) => setReportDetail(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Cuéntanos qué ocurrió"
            />

            <div className="tripchat-report-actions">
              <button type="button" className="tripchat-report-cancel" disabled={reportSending} onClick={() => setReportTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="tripchat-report-submit" disabled={reportSending} onClick={submitReport}>
                {reportSending ? "Enviando…" : "Enviar denuncia"}
              </button>
            </div>
          </div>
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
          display: block; /* en línea compartía renglón con el bubble y lo empujaba a una 2ª línea */
          font-size: 10px; font-weight: 700; color: #21D0B3;
          margin: 0 0 2px 2px;
          letter-spacing: 0.02em;
        }

        .tripchat-bubble-mine {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 18px 18px 6px 18px;
          background: linear-gradient(135deg, #21D0B3, #14AE98);
          color: #fff;
          font-size: 14px; line-height: 1.45;
          overflow-wrap: break-word;
          word-break: normal;
          white-space: pre-wrap; /* respeta los saltos de línea que escribe el usuario */
          max-width: 100%;
          box-shadow: 0 1px 4px rgba(33,208,179,0.2);
          animation: tripMsgIn .25s ease-out both;
        }
        .tripchat-bubble-other {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 18px 18px 18px 6px;
          background: #fff;
          color: #1e293b;
          font-size: 14px; line-height: 1.45;
          overflow-wrap: break-word;
          word-break: normal;
          white-space: pre-wrap; /* respeta los saltos de línea que escribe el usuario */
          max-width: 100%;
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

        /* ── Denuncia y bloqueo ── */

        .tripchat-menu-scrim {
          position: fixed; inset: 0;
          z-index: 205;
        }
        .tripchat-menu {
          position: absolute; top: calc(100% + 6px); right: 0;
          z-index: 206;
          min-width: 210px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(15,23,42,0.18);
          overflow: hidden;
          display: flex; flex-direction: column;
        }
        .tripchat-menu button {
          appearance: none; border: none; background: none;
          text-align: left;
          padding: 11px 14px;
          font-size: 13px; font-weight: 600;
          color: #1e293b;
          cursor: pointer;
        }
        .tripchat-menu button:hover { background: #f4f7fc; }
        .tripchat-menu-danger { color: #dc2626 !important; border-top: 1px solid #f1f5f9; }

        .tripchat-report-btn {
          appearance: none;
          background: none; border: none;
          padding: 4px;
          margin-bottom: 14px;
          color: #cbd5e1;
          cursor: pointer;
          flex-shrink: 0;
          border-radius: 6px;
          transition: color .15s, background .15s;
          -webkit-tap-highlight-color: transparent;
        }
        .tripchat-report-btn:hover { color: #ef4444; background: rgba(239,68,68,0.08); }

        .tripchat-notice {
          padding: 9px 14px;
          background: #ecfdf5;
          border-top: 1px solid #d1fae5;
          color: #047857;
          font-size: 11.5px; font-weight: 600;
          text-align: center;
          flex-shrink: 0;
        }

        .tripchat-blocked-bar {
          padding: 11px 14px calc(11px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid #fde68a;
          background: #fffbeb;
          display: flex; align-items: center; gap: 8px;
          color: #92400e; font-size: 11.5px; font-weight: 600;
          line-height: 1.4;
          flex-shrink: 0;
        }
        .tripchat-unblock-btn {
          appearance: none;
          border: 1px solid #fcd34d;
          background: #fff;
          color: #b45309;
          border-radius: 9px;
          padding: 6px 10px;
          font-size: 11.5px; font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
        }
        .tripchat-unblock-btn:hover { background: #fffbeb; }

        .tripchat-report-scrim {
          position: fixed; inset: 0;
          z-index: 250;
          background: rgba(2,12,24,0.6);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: tripChatFadeIn .2s ease-out both;
        }
        .tripchat-report-card {
          width: 100%; max-width: 380px;
          background: #fff;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 24px 60px rgba(15,23,42,0.3);
        }
        .tripchat-report-title {
          margin: 0 0 4px; font-size: 15px; font-weight: 800; color: #0f172a;
        }
        .tripchat-report-sub {
          margin: 0 0 14px; font-size: 12px; color: #64748b; line-height: 1.5;
          overflow-wrap: break-word;
        }
        .tripchat-report-label {
          display: block;
          font-size: 11px; font-weight: 700; color: #475569;
          margin: 0 0 5px; letter-spacing: .02em;
        }
        .tripchat-report-select, .tripchat-report-textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a; font-size: 13px;
          outline: none; font-family: inherit;
          margin-bottom: 12px;
        }
        .tripchat-report-textarea { resize: vertical; }
        .tripchat-report-select:focus, .tripchat-report-textarea:focus {
          border-color: #21D0B3; box-shadow: 0 0 0 3px rgba(33,208,179,0.12);
        }
        .tripchat-report-actions {
          display: flex; gap: 8px; justify-content: flex-end;
        }
        .tripchat-report-cancel, .tripchat-report-submit {
          appearance: none;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px; font-weight: 700;
          cursor: pointer;
        }
        .tripchat-report-cancel {
          border: 1px solid #e2e8f0; background: #fff; color: #475569;
        }
        .tripchat-report-submit {
          border: none;
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          color: #fff;
          box-shadow: 0 2px 8px rgba(244,63,94,0.3);
        }
        .tripchat-report-cancel:disabled, .tripchat-report-submit:disabled {
          opacity: .6; cursor: not-allowed;
        }

        @keyframes tripChatSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tripChatFadeIn { from { opacity: 0; transform: translateY(10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tripChatPulse { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.2); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes tripMsgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
