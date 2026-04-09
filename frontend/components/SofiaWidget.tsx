"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch, getTokens } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* ── Sparkle icon (replaces old diamond) ── */
function SofiaBotIcon({ size = 24, eyeColor = "#21D0B3" }: { size?: number; eyeColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="4" width="26" height="20" rx="10" fill="currentColor" />
      <path d="M8 24 C8 24 6 28 4 29 C6 28 10 27 12 25" fill="currentColor" />
      <circle cx="12" cy="14" r="3" fill={eyeColor} />
      <circle cx="20" cy="14" r="3" fill={eyeColor} />
    </svg>
  );
}

/* ── Types ── */
type SofiaMessage = { role: "user" | "assistant"; content: string };
type StreamChunk = { type: "delta" | "done" | "error" | "tool_call"; content: string; responseId?: string | null };

function apiCandidates(): string[] {
  if (typeof window === "undefined") return [];
  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase) return [envBase];
  const proto = window.location.protocol;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1")
    return [`${proto}//localhost:3000`, `${proto}//localhost:3001`];
  return [`${proto}//${host}:3000`, `${proto}//${host}:3001`, `${proto}//${host}:3002`];
}

let preferredBase: string | null = null;

async function fetchStream(
  path: string, body: Record<string, unknown>,
  onChunk: (chunk: StreamChunk) => void, signal?: AbortSignal,
) {
  const tokens = getTokens();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens?.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;
  const bases = [...(preferredBase ? [preferredBase] : []), ...apiCandidates().filter((b) => b !== preferredBase)];
  let response: Response | null = null;
  for (const base of bases) {
    try { response = await fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal }); preferredBase = base; break; } catch { continue; }
  }
  if (!response) throw new Error("No se pudo conectar con la API");
  if (!response.ok) { const text = await response.text(); throw new Error(text || `Error ${response.status}`); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let lastChunkTime = Date.now();
  while (true) {
    const readPromise = reader.read();
    // Timeout: if no data in 15 seconds, abort and fall back to non-streaming
    const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
      setTimeout(() => reject(new Error("Stream timeout")), 15000);
    });
    const { done, value } = await Promise.race([readPromise, timeoutPromise]);
    if (done) break;
    lastChunkTime = Date.now();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try { onChunk(JSON.parse(jsonStr)); } catch {}
    }
  }
}

/* ── Notification chime using Web Audio API ── */
function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.04);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.35);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

/* ── Component ── */
export default function SofiaWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SofiaMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolInfo, setToolInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Welcome alert on every page load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(true);
      playChime();
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, toolInfo]);

  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    setError(null);
    setInput("");
    setToolInfo(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || /^192\.168\./.test(window.location.hostname));

    if (isLocal) {
      // Local: use streaming for real-time response
      const controller = new AbortController();
      abortRef.current = controller;
      let streamWorked = false;
      try {
        await fetchStream("/sofia/ask-stream", { question, previousResponseId: responseId }, (chunk) => {
          streamWorked = true;
          switch (chunk.type) {
            case "delta":
              setMessages((prev) => { const u = [...prev]; const l = u[u.length - 1]; if (l?.role === "assistant") u[u.length - 1] = { ...l, content: l.content + chunk.content }; return u; });
              break;
            case "tool_call": setToolInfo(chunk.content); break;
            case "done": if (chunk.responseId) setResponseId(chunk.responseId); setToolInfo(null); break;
            case "error": setError(chunk.content); break;
          }
        }, controller.signal);
      } catch (err) {
        if ((err as Error).name === "AbortError") { setMessages((p) => { const l = p[p.length - 1]; return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p; }); setLoading(false); abortRef.current = null; return; }
        if (!streamWorked) {
          try {
            const result = await apiFetch<{ answer: string; responseId?: string | null }>("/sofia/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, previousResponseId: responseId }) });
            setMessages((p) => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: result.answer }; return u; });
            setResponseId(result.responseId ?? null);
          } catch (fe) { setError(fe instanceof Error ? fe.message : t("No se pudo cargar")); setMessages((p) => { const l = p[p.length - 1]; return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p; }); }
        } else { setError(err instanceof Error ? err.message : t("No se pudo cargar")); setMessages((p) => { const l = p[p.length - 1]; return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p; }); }
      } finally { setLoading(false); abortRef.current = null; }
    } else {
      // Production: use non-streaming to avoid Vercel SSE buffering issues
      try {
        setToolInfo("Consultando...");
        const result = await apiFetch<{ answer: string; responseId?: string | null }>("/sofia/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, previousResponseId: responseId }) });
        setMessages((p) => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: result.answer }; return u; });
        setResponseId(result.responseId ?? null);
        setToolInfo(null);
      } catch (fe) { setError(fe instanceof Error ? fe.message : t("No se pudo cargar")); setMessages((p) => { const l = p[p.length - 1]; return l?.role === "assistant" && !l.content ? p.slice(0, -1) : p; }); }
      finally { setLoading(false); }
    }
  }, [input, loading, responseId, t]);

  return (
    <>
      {/* ── Welcome toast ── */}
      {showWelcome && (
        <div
          onClick={() => { setShowWelcome(false); setOpen(true); }}
          style={{
            position: "fixed", bottom: 100, right: 24, zIndex: 41,
            maxWidth: 280, padding: "14px 18px", borderRadius: 16,
            background: "#fff", border: "1px solid #e2e8f0",
            boxShadow: "0 8px 32px rgba(15,23,42,0.15), 0 0 0 1px rgba(33,208,179,0.1)",
            cursor: "pointer",
            animation: "sofiaToastIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#30455B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              <div style={{ color: "#fff" }}><SofiaBotIcon size={20} eyeColor="#21D0B3" /></div>
            </div>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Sof</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#21D0B3" }}> IA</span>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "#475569", margin: 0, lineHeight: 1.5 }}>
            Puedo ayudarte con viajes, delegaciones, hoteles y transporte. Toca para preguntar.
          </p>
          <button type="button" onClick={(e) => { e.stopPropagation(); setShowWelcome(false); }}
            style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "#94a3b8", fontSize: 14, cursor: "pointer", padding: 2 }}>
            ✕
          </button>
        </div>
      )}

      {/* ── FAB ── */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 40 }}>
        {/* Pulse ring */}
        {!open && (
          <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid rgba(33,208,179,0.4)", animation: "sofiaRing 2.5s ease-out infinite", pointerEvents: "none" }} />
        )}
        <button
          type="button"
          onClick={() => { setOpen(!open); setShowWelcome(false); }}
          style={{
            position: "relative", width: 96, height: 96, borderRadius: "50%",
            background: open
              ? "linear-gradient(135deg, #e2e8f0, #f1f5f9)"
              : "#30455B",
            border: open ? "1px solid #cbd5e1" : "none",
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
            boxShadow: open
              ? "0 2px 8px rgba(0,0,0,0.1)"
              : "0 4px 24px rgba(48,69,91,0.35), 0 8px 32px rgba(15,23,42,0.2)",
            transition: "all 200ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {open ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ color: "#fff" }}>
                <SofiaBotIcon size={44} eyeColor="#21D0B3" />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginTop: -1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", fontFamily: "system-ui" }}>Sof</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#21D0B3", letterSpacing: "0.02em" }}>IA</span>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 92, right: 24, zIndex: 50,
          width: 390, borderRadius: 20, overflow: "hidden",
          background: "linear-gradient(180deg, #1e293b 0%, #263548 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)",
          animation: "sofiaToastIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          {/* Header */}
          <div style={{ padding: "16px 20px", background: "rgba(33,208,179,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#30455B", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.2)" }}>
                  <div style={{ color: "#fff" }}><SofiaBotIcon size={24} eyeColor="#21D0B3" /></div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800 }}>Sof</span>
                    <span style={{ color: "#21D0B3", fontSize: 16, fontWeight: 900, textShadow: "0 0 8px rgba(33,208,179,0.4)" }}>IA</span>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, margin: 0 }}>{t("Asistente inteligente")}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 12px", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {t("Cerrar")}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ maxHeight: "44vh", overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, background: "transparent" }}>
            {messages.length === 0 && (
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ color: "rgba(255,255,255,0.6)" }}><SofiaBotIcon size={18} eyeColor="#21D0B3" /></div>
                </div>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
                </p>
              </div>
            )}
            {messages.map((msg, i) => msg.role === "assistant" ? (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, marginTop: 1, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ color: "rgba(255,255,255,0.6)" }}><SofiaBotIcon size={16} eyeColor="#21D0B3" /></div>
                </div>
                <div style={{ flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {msg.content || (loading && i === messages.length - 1 ? "" : "...")}
                </div>
              </div>
            ) : (
              <div key={i} style={{ background: "rgba(33,208,179,0.12)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: 14, padding: "10px 14px", marginLeft: 34, color: "#21D0B3", fontSize: 13, lineHeight: 1.5 }}>
                {msg.content}
              </div>
            ))}
            {toolInfo && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 12px", background: "rgba(33,208,179,0.06)", borderRadius: 8, border: "1px solid rgba(33,208,179,0.12)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
                <span style={{ color: "#21D0B3", fontSize: 11.5, fontWeight: 600 }}>Consultando: {toolInfo}</span>
              </div>
            )}
            {loading && !toolInfo && messages[messages.length - 1]?.content === "" && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#21D0B3", animation: `sofiaRing 1s ease-in-out infinite ${i * 0.2}s`, display: "inline-block" }} />
                ))}
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginLeft: 4 }}>{t("Preparando respuesta...")}</span>
              </div>
            )}
            {error && <p style={{ color: "#f43f5e", fontSize: 12, margin: 0 }}>{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", fontSize: 13, outline: "none" }}
                placeholder={t("Escribe tu pregunta")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
              />
              <button onClick={sendMessage} disabled={loading}
                style={{ padding: "10px 18px", borderRadius: 12, background: loading ? "rgba(33,208,179,0.2)" : "linear-gradient(135deg, #21D0B3, #14AE98)", color: loading ? "#21D0B3" : "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 2px 12px rgba(33,208,179,0.35)" }}>
                {loading ? "···" : t("Enviar")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes sofiaRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes sofiaToastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
