"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch, getTokens } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* ------------------------------------------------------------------ */
/*  Icon                                                               */
/* ------------------------------------------------------------------ */

function SofiaIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22 3 C22 3 24.2 16.5 34 22 C24.2 27.5 22 41 22 41 C22 41 19.8 27.5 10 22 C19.8 16.5 22 3 22 3Z"
        fill="white"
      />
      <path
        d="M3 22 C3 22 16.5 24.2 22 34 C27.5 24.2 41 22 41 22 C41 22 27.5 19.8 22 10 C16.5 19.8 3 22 3 22Z"
        fill="white"
        opacity="0.6"
      />
      <circle cx="22" cy="22" r="3" fill="rgba(20,215,185,0.9)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

type SofiaMessage = { role: "user" | "assistant"; content: string };

type StreamChunk = {
  type: "delta" | "done" | "error" | "tool_call";
  content: string;
  responseId?: string | null;
};

/** Try multiple API base URLs and return the first that connects. */
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
  path: string,
  body: Record<string, unknown>,
  onChunk: (chunk: StreamChunk) => void,
  signal?: AbortSignal,
) {
  const tokens = getTokens();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens?.accessToken) headers["Authorization"] = `Bearer ${tokens.accessToken}`;

  const bases = [
    ...(preferredBase ? [preferredBase] : []),
    ...apiCandidates().filter((b) => b !== preferredBase),
  ];

  let response: Response | null = null;
  for (const base of bases) {
    try {
      response = await fetch(`${base}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
      preferredBase = base;
      break;
    } catch {
      continue;
    }
  }

  if (!response) throw new Error("No se pudo conectar con la API");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const chunk: StreamChunk = JSON.parse(jsonStr);
        onChunk(chunk);
      } catch { /* skip malformed */ }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SofiaWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SofiaMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolInfo, setToolInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when messages change
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

    // Add a placeholder assistant message that will be filled via streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    let streamWorked = false;
    try {
      await fetchStream(
        "/sofia/ask-stream",
        { question, previousResponseId: responseId },
        (chunk) => {
          streamWorked = true;
          switch (chunk.type) {
            case "delta":
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + chunk.content,
                  };
                }
                return updated;
              });
              break;
            case "tool_call":
              setToolInfo(chunk.content);
              break;
            case "done":
              if (chunk.responseId) setResponseId(chunk.responseId);
              setToolInfo(null);
              break;
            case "error":
              setError(chunk.content);
              break;
          }
        },
        controller.signal,
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
          return prev;
        });
        setLoading(false);
        abortRef.current = null;
        return;
      }

      // Fallback to classic /sofia/ask if streaming failed
      if (!streamWorked) {
        try {
          const result = await apiFetch<{ answer: string; responseId?: string | null }>("/sofia/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, previousResponseId: responseId }),
          });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: result.answer };
            return updated;
          });
          setResponseId(result.responseId ?? null);
        } catch (fallbackErr) {
          setError(fallbackErr instanceof Error ? fallbackErr.message : t("No se pudo cargar"));
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
            return prev;
          });
        }
      } else {
        setError(err instanceof Error ? err.message : t("No se pudo cargar"));
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
          return prev;
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, responseId, t]);

  return (
    <>
      {/* FAB */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 40, width: "62px", height: "62px" }}>
        {/* Outer glow bloom */}
        <div style={{
          position: "absolute", inset: "-10px", borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(33,208,179,0.22) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Pulse rings */}
        <div style={{
          position: "absolute", inset: "-7px", borderRadius: "50%",
          border: "2px solid rgba(33,208,179,0.5)",
          animation: "sofiaRing 2.2s ease-out infinite",
        }} />
        <div style={{
          position: "absolute", inset: "-14px", borderRadius: "50%",
          border: "2px solid rgba(33,208,179,0.25)",
          animation: "sofiaRing 2.2s ease-out infinite 0.7s",
        }} />
        {/* Button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            position: "relative", width: "68px", height: "68px", borderRadius: "50%",
            background: "linear-gradient(160deg, #1b3347 0%, #0d1d2b 100%)",
            border: "2px solid rgba(33,208,179,0.75)",
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 4px rgba(33,208,179,0.12), 0 8px 30px rgba(33,208,179,0.38), 0 4px 14px rgba(0,0,0,0.5)",
            animation: "sofiaFloat 3.5s ease-in-out infinite",
            transition: "transform 140ms ease, box-shadow 140ms ease",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "scale(1.09)";
            el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 5px rgba(33,208,179,0.2), 0 10px 38px rgba(33,208,179,0.58), 0 4px 14px rgba(0,0,0,0.5)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.transform = "scale(1)";
            el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 4px rgba(33,208,179,0.12), 0 8px 30px rgba(33,208,179,0.38), 0 4px 14px rgba(0,0,0,0.5)";
          }}
        >
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "5px" }}>
            <div style={{
              position: "absolute", width: "34px", height: "34px", borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(33,208,179,0.28) 0%, transparent 72%)",
              pointerEvents: "none",
            }} />
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              <path d="M10 0.5 C10 0.5 11.4 7 17 10 C11.4 13 10 19.5 10 19.5 C10 19.5 8.6 13 3 10 C8.6 7 10 0.5 10 0.5Z" fill="#21D0B3"/>
              <path d="M10 0.5 C10 0.5 11.4 7 17 10 C11.4 13 10 19.5 10 19.5 C10 19.5 8.6 13 3 10 C8.6 7 10 0.5 10 0.5Z" fill="url(#starShine)" opacity="0.4"/>
            </svg>
          </div>
          <div style={{ width: "30px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(33,208,179,0.5), transparent)", marginBottom: "5px" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}>Sof</span>
            <span style={{ color: "#21D0B3", fontSize: "11px", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 0 8px rgba(33,208,179,0.7)" }}>IA</span>
          </div>
        </button>
      </div>

      {open && (
        <div style={{
          position: "fixed", bottom: "92px", right: "24px", zIndex: 50,
          width: "390px", borderRadius: "20px", overflow: "hidden",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 24px 64px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)",
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #30455B 0%, #243550 100%)",
            borderBottom: "2px solid #21D0B3",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "linear-gradient(145deg, #1ce8c8, #0d8f7a)",
                  border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(33,208,179,0.4)",
                }}>
                  <SofiaIcon size={36} />
                </div>
                <div>
                  <p style={{
                    color: "#21D0B3", fontSize: "10px",
                    fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0,
                  }}>Sof IA</p>
                  <p style={{ color: "#ffffff", fontSize: "15px", fontWeight: 700, marginTop: "1px", margin: 0 }}>
                    {t("Asistente inteligente")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "8px", padding: "5px 13px",
                  color: "rgba(255,255,255,0.75)", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}
              >{t("Cerrar")}</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            maxHeight: "44vh", overflowY: "auto", padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: "10px",
            background: "#f8fafc",
          }}>
            {messages.length === 0 && (
              <div style={{
                background: "#ffffff", border: "1px solid #e8edf5",
                borderRadius: "12px", padding: "14px 16px",
                display: "flex", gap: "10px", alignItems: "flex-start",
              }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(145deg, #1ce8c8, #0d8f7a)", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(33,208,179,0.35)",
                }}>
                  <SofiaIcon size={18} />
                </div>
                <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
                  {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
                </p>
              </div>
            )}
            {messages.map((msg, i) => {
              if (msg.role === "assistant") {
                return (
                  <div key={i} style={{
                    background: "#ffffff", border: "1px solid #e2e8f0",
                    borderRadius: "12px", padding: "12px 14px",
                    boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
                    display: "flex", gap: "10px", alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                      background: "linear-gradient(145deg, #1ce8c8, #0d8f7a)", overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(33,208,179,0.35)",
                    }}>
                      <SofiaIcon size={17} />
                    </div>
                    <div style={{
                      flex: 1, color: "#1e293b", fontSize: "13px", lineHeight: 1.65,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {msg.content || (loading && i === messages.length - 1 ? "" : "...")}
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} style={{
                  background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.22)",
                  borderRadius: "12px", padding: "10px 14px", marginLeft: "36px",
                  color: "#0A6B5E", fontSize: "13px", lineHeight: 1.5,
                }}>
                  {msg.content}
                </div>
              );
            })}
            {/* Tool call indicator */}
            {toolInfo && (
              <div style={{
                display: "flex", gap: "8px", alignItems: "center", padding: "6px 12px",
                background: "rgba(33,208,179,0.06)", borderRadius: "8px",
                border: "1px solid rgba(33,208,179,0.15)",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
                <span style={{ color: "#0d7a6a", fontSize: "11.5px", fontWeight: 600 }}>
                  Consultando: {toolInfo}
                </span>
              </div>
            )}
            {/* Streaming dots */}
            {loading && !toolInfo && messages[messages.length - 1]?.content === "" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "4px 0" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3",
                    animation: `sofiaRing 1s ease-in-out infinite ${i * 0.2}s`,
                    display: "inline-block",
                  }} />
                ))}
                <span style={{ color: "#94a3b8", fontSize: "12px", marginLeft: "4px" }}>{t("Preparando respuesta...")}</span>
              </div>
            )}
            {error && <p style={{ color: "#f43f5e", fontSize: "12px", margin: 0 }}>{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "12px 16px 16px",
            borderTop: "1px solid #e8edf5",
            background: "#ffffff",
          }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: "10px",
                  background: "#f4f7fc", border: "1px solid #e2e8f0",
                  color: "#0f172a", fontSize: "13px", outline: "none",
                }}
                placeholder={t("Escribe tu pregunta")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                style={{
                  padding: "10px 18px", borderRadius: "10px",
                  background: loading ? "#a7f3ed" : "linear-gradient(135deg, #21D0B3, #14AE98)",
                  color: loading ? "#0B7A6D" : "#ffffff",
                  fontWeight: 700, fontSize: "13px", border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: loading ? "none" : "0 2px 10px rgba(33,208,179,0.35)",
                }}
              >{loading ? "···" : t("Enviar")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
