"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type AssistanceChatProps = {
  originType: "driver" | "athlete" | "provider_participant";
  originId: string;
  originName: string;
  eventId?: string | null;
  label?: string;
};

type Chat = {
  id: string;
  origin_type: string;
  origin_id: string;
  origin_name: string;
  category: string;
  priority: string;
  subject?: string | null;
  status: string;
  agent_id?: string | null;
  agent_name?: string | null;
  last_message_at: string;
  last_message_preview?: string | null;
};

type Message = {
  id: string;
  chat_id: string;
  sender_type: string;
  sender_name?: string | null;
  content?: string | null;
  is_internal_note: boolean;
  created_at: string;
};

const CATEGORIES = [
  { value: "QUERY", label: "Consulta general" },
  { value: "INCIDENT", label: "Incidencia" },
  { value: "LOST_ITEM", label: "Objeto perdido" },
  { value: "EMERGENCY", label: "Emergencia" },
  { value: "OTHER", label: "Otro" },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Abierta — sin asignar", color: "#3b82f6" },
  IN_ATTENTION: { label: "Un agente la está atendiendo", color: "#f59e0b" },
  ESCALATED: { label: "Escalada", color: "#ef4444" },
  RESOLVED: { label: "Resuelta", color: "#10b981" },
  CLOSED: { label: "Cerrada", color: "#64748b" },
};

const timeShort = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function AssistanceChat({
  originType, originId, originName, eventId, label = "Asistencia",
}: AssistanceChatProps) {
  const [open, setOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState("QUERY");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    try {
      const data = await apiFetch<Chat[]>(
        `/support-chats?originType=${encodeURIComponent(originType)}&originId=${encodeURIComponent(originId)}`,
      );
      setChats(data || []);
    } catch {}
  };

  const loadMessages = async (chatId: string) => {
    try {
      const data = await apiFetch<Message[]>(
        `/support-chats/${chatId}/messages?includeInternal=false`,
      );
      setMessages(data || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    loadChats();
    const t = setInterval(() => {
      loadChats();
      if (activeChatId) loadMessages(activeChatId);
    }, 8000);
    return () => clearInterval(t);
  }, [open, activeChatId]);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
  }, [activeChatId]);

  const openChat = (id: string) => {
    setActiveChatId(id);
    setView("chat");
  };

  const backToList = () => {
    setActiveChatId(null);
    setView("list");
  };

  const createChat = async () => {
    if (!newMessage.trim()) return;
    setCreating(true);
    try {
      const chat = await apiFetch<Chat>("/support-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originType, originId, originName,
          eventId: eventId || undefined,
          category: newCategory,
          subject: newSubject.trim() || undefined,
          initialMessage: newMessage.trim(),
        }),
      });
      setNewSubject(""); setNewMessage(""); setNewCategory("QUERY");
      await loadChats();
      openChat(chat.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo abrir la sala");
    } finally { setCreating(false); }
  };

  const sendMessage = async () => {
    if (!activeChatId || !draft.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/support-chats/${activeChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderType: "origin",
          senderId: originId,
          senderName: originName,
          content: draft.trim(),
        }),
      });
      setDraft("");
      await loadMessages(activeChatId);
    } finally { setSending(false); }
  };

  const active = chats.find((c) => c.id === activeChatId) || null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          position: "fixed", bottom: 72, right: 16, zIndex: 110,
          width: open ? "48px" : "auto",
          padding: open ? 0 : "14px 20px",
          height: "48px",
          borderRadius: open ? "50%" : "24px",
          background: "linear-gradient(135deg, #21D0B3 0%, #14b8a6 100%)",
          color: "#fff", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          fontSize: "13px", fontWeight: 700,
          boxShadow: "0 8px 24px rgba(20,184,166,0.4)",
        }}
      >
        {open ? "✕" : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {label}
          </>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 132, right: 16, zIndex: 115,
            width: "min(400px, calc(100vw - 40px))",
            height: "min(580px, calc(100dvh - 180px))",
            background: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 24px 64px rgba(15,23,42,0.32)",
            overflow: "hidden",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(135deg, #21D0B3 0%, #14b8a6 100%)", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", opacity: 0.9 }}>Asistencia</p>
                <p style={{ fontSize: "15px", fontWeight: 700 }}>
                  {view === "chat" ? (active?.subject || "Conversación") : view === "new" ? "Nueva incidencia" : "Mis incidencias"}
                </p>
              </div>
              {view !== "list" && (
                <button type="button" onClick={backToList} style={{ background: "rgba(255,255,255,0.18)", color: "#fff", border: "none", borderRadius: "8px", padding: "4px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                  ← Volver
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          {view === "list" && (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                {chats.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" }}>
                    Aún no tienes incidencias abiertas. Crea una nueva para contactar al equipo operativo.
                  </p>
                ) : chats.map((c) => {
                  const meta = STATUS_LABEL[c.status] || STATUS_LABEL.OPEN;
                  return (
                    <button key={c.id} type="button" onClick={() => openChat(c.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "220px" }}>
                          {c.subject || CATEGORIES.find((x) => x.value === c.category)?.label || c.category}
                        </p>
                        <span style={{ fontSize: "10px", color: "#94a3b8" }}>{timeShort(c.last_message_at)}</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_message_preview || "Sin mensajes"}</p>
                      <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "99px", background: `${meta.color}15`, color: meta.color, marginTop: "4px", display: "inline-block" }}>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: "10px 14px", borderTop: "1px solid #e2e8f0" }}>
                <button type="button" onClick={() => setView("new")} style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "#21D0B3", color: "#fff", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  + Abrir nueva incidencia
                </button>
              </div>
            </>
          )}

          {view === "new" && (
            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>Categoría</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", marginTop: "4px" }}>
                  {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>Asunto (opcional)</label>
                <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Ej: Perdí mi acreditación" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", marginTop: "4px" }} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b" }}>Describe la situación</label>
                <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} rows={4} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", marginTop: "4px", resize: "none", flex: 1 }} />
              </div>
              <button type="button" onClick={createChat} disabled={creating || !newMessage.trim()} style={{ padding: "12px", borderRadius: "10px", background: creating ? "#cbd5e1" : "#21D0B3", color: "#fff", border: "none", fontSize: "13px", fontWeight: 700, cursor: creating ? "not-allowed" : "pointer" }}>
                {creating ? "Abriendo..." : "Abrir incidencia"}
              </button>
            </div>
          )}

          {view === "chat" && active && (
            <>
              <div style={{ padding: "8px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: `${(STATUS_LABEL[active.status] || STATUS_LABEL.OPEN).color}15`, color: (STATUS_LABEL[active.status] || STATUS_LABEL.OPEN).color }}>
                  {(STATUS_LABEL[active.status] || STATUS_LABEL.OPEN).label}
                </span>
                {active.agent_name && (
                  <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "8px" }}>Agente: {active.agent_name}</span>
                )}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px", background: "#f8fafc" }}>
                {messages.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "12px" }}>Esperando respuesta...</p>
                ) : messages.map((m) => {
                  const mine = m.sender_type === "origin";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: "8px" }}>
                      <div style={{
                        maxWidth: "76%",
                        background: mine ? "#21D0B3" : "#ffffff",
                        color: mine ? "#ffffff" : "#0f172a",
                        border: mine ? "none" : "1px solid #e2e8f0",
                        padding: "8px 12px",
                        borderRadius: "12px",
                        fontSize: "13px",
                      }}>
                        <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
                        <p style={{ fontSize: "9px", marginTop: "3px", opacity: 0.7 }}>
                          {m.sender_name || (mine ? "Tú" : "Agente")} · {timeShort(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "10px 14px", borderTop: "1px solid #e2e8f0", background: "#ffffff", display: "flex", gap: "6px" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                  rows={2}
                  placeholder="Escribe un mensaje..."
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", resize: "none", outline: "none" }}
                />
                <button type="button" onClick={sendMessage} disabled={sending || !draft.trim()} style={{ padding: "8px 14px", borderRadius: "8px", background: sending ? "#cbd5e1" : "#21D0B3", color: "#fff", border: "none", fontSize: "12px", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer" }}>
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
