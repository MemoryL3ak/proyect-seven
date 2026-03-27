"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function SofiaIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 4-pointed star — vertical arm */}
      <path
        d="M22 3 C22 3 24.2 16.5 34 22 C24.2 27.5 22 41 22 41 C22 41 19.8 27.5 10 22 C19.8 16.5 22 3 22 3Z"
        fill="white"
      />
      {/* 4-pointed star — horizontal arm (softer) */}
      <path
        d="M3 22 C3 22 16.5 24.2 22 34 C27.5 24.2 41 22 41 22 C41 22 27.5 19.8 22 10 C16.5 19.8 3 22 3 22Z"
        fill="white"
        opacity="0.6"
      />
      {/* Center glow dot */}
      <circle cx="22" cy="22" r="3" fill="rgba(20,215,185,0.9)" />
    </svg>
  );
}

type SofiaMessage = { role: "user" | "assistant"; content: string };

const cleanMarkdown = (value: string) =>
  value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/#+\s?/g, "").replace(/`/g, "").trim();

const formatAssistant = (value: string) => {
  const cleaned = cleanMarkdown(value);
  const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: "Respuesta", bullets: [] as string[] };
  let title = lines[0].length <= 60 ? lines[0] : "Respuesta";
  let rest = lines.slice(title === lines[0] ? 1 : 0);
  if (rest.length === 0) {
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) { title = sentences[0].slice(0, 60); rest = sentences.slice(1); }
  }
  return { title, bullets: rest.join(" ").split(/·|\s-\s|;\s+/).map((i) => i.trim()).filter(Boolean).slice(0, 8) };
};


export default function SofiaWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SofiaMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setError(null); setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const result = await apiFetch<{ answer: string; responseId?: string | null }>("/sofia/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, previousResponseId: responseId })
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
      setResponseId(result.responseId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally { setLoading(false); }
  };

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
          {/* Star with radial glow behind */}
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
          {/* Divider */}
          <div style={{ width: "30px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(33,208,179,0.5), transparent)", marginBottom: "5px" }} />
          {/* Name */}
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
                    fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase",
                  }}>Sof IA</p>
                  <p style={{ color: "#ffffff", fontSize: "15px", fontWeight: 700, marginTop: "1px" }}>
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
                const f = formatAssistant(msg.content);
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
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#0f172a", fontSize: "13px", fontWeight: 600, margin: 0 }}>{f.title}</p>
                      {f.bullets.length > 0 && (
                        <ul style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "5px", paddingLeft: 0, listStyle: "none", margin: "8px 0 0" }}>
                          {f.bullets.map((item, idx) => (
                            <li key={idx} style={{ display: "flex", gap: "8px", color: "#475569", fontSize: "12.5px", lineHeight: 1.5 }}>
                              <span style={{ marginTop: "6px", width: "5px", height: "5px", borderRadius: "50%", background: "#21D0B3", flexShrink: 0 }} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
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
            {loading && (
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
            {error && <p style={{ color: "#f43f5e", fontSize: "12px" }}>{error}</p>}
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
