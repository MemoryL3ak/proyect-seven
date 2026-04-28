"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getStoredUser } from "@/lib/api";

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
  first_response_at?: string | null;
  resolved_at?: string | null;
  last_message_at: string;
  last_message_preview?: string | null;
  created_at: string;
};

type Message = {
  id: string;
  chat_id: string;
  sender_type: string;
  sender_id?: string | null;
  sender_name?: string | null;
  content?: string | null;
  attachments: any[];
  is_internal_note: boolean;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Abierta", color: "#3b82f6" },
  { value: "IN_ATTENTION", label: "En atención", color: "#f59e0b" },
  { value: "ESCALATED", label: "Escalada", color: "#ef4444" },
  { value: "RESOLVED", label: "Resuelta", color: "#10b981" },
  { value: "CLOSED", label: "Cerrada", color: "#64748b" },
];

const CATEGORY_LABEL: Record<string, string> = {
  QUERY: "Consulta",
  LOST_ITEM: "Objeto perdido",
  INCIDENT: "Incidencia",
  EMERGENCY: "Emergencia",
  OTHER: "Otro",
};

const ORIGIN_LABEL: Record<string, string> = {
  driver: "Conductor",
  athlete: "Atleta",
  provider_participant: "Staff / Proveedor",
};

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#64748b",
  NORMAL: "#3b82f6",
  HIGH: "#f59e0b",
  CRITICAL: "#ef4444",
};

const timeShort = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("es-CL", { month: "2-digit", day: "2-digit" }) + " " +
        d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export default function SupportChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [sending, setSending] = useState(false);
  const agentUser = useMemo(() => getStoredUser(), []);
  const agentId = (agentUser?.id as string) || "";
  const agentName = (agentUser?.user_metadata as any)?.name || agentUser?.email || "Agente";
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Chat[]>(filter ? `/support-chats?status=${filter}` : "/support-chats");
      setChats(data || []);
    } catch {}
    finally { setLoading(false); }
  };

  const loadMessages = async (id: string) => {
    try {
      const data = await apiFetch<Message[]>(`/support-chats/${id}/messages`);
      setMessages(data || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  };

  useEffect(() => { loadChats(); }, [filter]);
  useEffect(() => {
    const t = setInterval(() => {
      loadChats();
      if (selectedId) loadMessages(selectedId);
    }, 8000);
    return () => clearInterval(t);
  }, [selectedId, filter]);

  const selected = chats.find((c) => c.id === selectedId) || null;
  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  const takeChat = async (chat: Chat) => {
    await apiFetch(`/support-chats/${chat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_ATTENTION", agentId, agentName }),
    });
    await loadChats();
  };

  const changeStatus = async (newStatus: string) => {
    if (!selected) return;
    await apiFetch(`/support-chats/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await loadChats();
  };

  const sendMessage = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/support-chats/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderType: "agent",
          senderId: agentId,
          senderName: agentName,
          content: draft.trim(),
          isInternalNote: isNote,
        }),
      });
      setDraft("");
      setIsNote(false);
      await loadMessages(selected.id);
      await loadChats();
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <section style={{ borderRadius: "20px", background: "#ffffff", border: "1px solid #e2e8f0", padding: "20px 24px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#21D0B3" }}>Asistencia</p>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>Centro de incidencias</h1>
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[{ v: "", l: "Todas" }, ...STATUS_OPTIONS.map((s) => ({ v: s.value, l: s.label }))].map((opt) => (
              <button
                key={opt.v || "all"}
                type="button"
                onClick={() => setFilter(opt.v)}
                style={{
                  padding: "6px 12px", borderRadius: "99px",
                  background: filter === opt.v ? "#21D0B3" : "#f1f5f9",
                  color: filter === opt.v ? "#fff" : "#475569",
                  border: "none", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                }}
              >{opt.l}</button>
            ))}
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: "16px", height: "72vh" }}>
        {/* Inbox */}
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#64748b" }}>Bandeja — {chats.length}</p>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading && chats.length === 0 ? (
              <p style={{ padding: "16px", fontSize: "13px", color: "#94a3b8" }}>Cargando...</p>
            ) : chats.length === 0 ? (
              <p style={{ padding: "16px", fontSize: "13px", color: "#94a3b8", textAlign: "center" }}>Sin incidencias.</p>
            ) : chats.map((c) => {
              const statusMeta = STATUS_OPTIONS.find((s) => s.value === c.status) || STATUS_OPTIONS[0];
              const selected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "12px 14px", borderBottom: "1px solid #f1f5f9",
                    background: selected ? "#f0fdfa" : "transparent",
                    borderLeft: selected ? "3px solid #14b8a6" : "3px solid transparent",
                    cursor: "pointer", border: "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{c.origin_name}</p>
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>{timeShort(c.last_message_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "99px", background: `${statusMeta.color}15`, color: statusMeta.color }}>
                      {statusMeta.label}
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "99px", background: "#f1f5f9", color: "#64748b" }}>
                      {ORIGIN_LABEL[c.origin_type] || c.origin_type}
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "99px", background: `${PRIORITY_COLOR[c.priority] || "#64748b"}15`, color: PRIORITY_COLOR[c.priority] || "#64748b" }}>
                      {c.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.subject || c.last_message_preview || CATEGORY_LABEL[c.category] || c.category}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Chat view */}
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "13px" }}>
              Selecciona una incidencia para atenderla.
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{selected.origin_name}</p>
                  <p style={{ fontSize: "11px", color: "#64748b" }}>
                    {ORIGIN_LABEL[selected.origin_type] || selected.origin_type} · {CATEGORY_LABEL[selected.category] || selected.category} · Prioridad {selected.priority}
                    {selected.agent_name ? ` · Asignado: ${selected.agent_name}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {!selected.agent_id && (
                    <button type="button" onClick={() => takeChat(selected)} style={{ padding: "6px 12px", borderRadius: "8px", background: "#21D0B3", color: "#fff", border: "none", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                      Tomar incidencia
                    </button>
                  )}
                  <select
                    value={selected.status}
                    onChange={(e) => changeStatus(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "11px", fontWeight: 700 }}
                  >
                    {STATUS_OPTIONS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#f8fafc" }}>
                {messages.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center" }}>Sin mensajes aún.</p>
                ) : messages.map((m) => {
                  const isAgent = m.sender_type === "agent";
                  const isSystem = m.sender_type === "system";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isAgent ? "flex-end" : isSystem ? "center" : "flex-start", marginBottom: "10px" }}>
                      <div style={{
                        maxWidth: "68%",
                        background: m.is_internal_note ? "#fef3c7" : isAgent ? "#21D0B3" : "#ffffff",
                        color: m.is_internal_note ? "#92400e" : isAgent ? "#ffffff" : "#0f172a",
                        border: m.is_internal_note ? "1px dashed #fbbf24" : !isAgent ? "1px solid #e2e8f0" : "none",
                        padding: "10px 14px",
                        borderRadius: "14px",
                        fontSize: "13px",
                      }}>
                        {m.is_internal_note && (
                          <p style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "4px", opacity: 0.85 }}>Nota interna</p>
                        )}
                        <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</p>
                        <p style={{ fontSize: "10px", marginTop: "4px", opacity: 0.7 }}>
                          {m.sender_name || m.sender_type} · {timeShort(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    rows={2}
                    placeholder={isNote ? "Nota interna (no visible al usuario)..." : "Responder al usuario..."}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: "10px",
                      border: isNote ? "1px dashed #f59e0b" : "1px solid #e2e8f0",
                      background: isNote ? "#fffbeb" : "#ffffff",
                      fontSize: "13px", resize: "none", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                      <input type="checkbox" checked={isNote} onChange={(e) => setIsNote(e.target.checked)} />
                      Nota interna
                    </label>
                    <button type="button" onClick={sendMessage} disabled={sending || !draft.trim()} style={{ padding: "8px 14px", borderRadius: "10px", background: sending ? "#cbd5e1" : "#21D0B3", color: "#fff", border: "none", fontSize: "12px", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer" }}>
                      {sending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
