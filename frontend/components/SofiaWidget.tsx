"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type SofiaMessage = {
  role: "user" | "assistant";
  content: string;
};

const cleanMarkdown = (value: string) => {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/#+\s?/g, "")
    .replace(/`/g, "")
    .trim();
};

const formatAssistant = (value: string) => {
  const cleaned = cleanMarkdown(value);
  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { title: "Respuesta", bullets: [] as string[] };

  const firstLine = lines[0];
  let title = firstLine.length <= 60 ? firstLine : "Respuesta";
  let rest = lines.slice(title === firstLine ? 1 : 0);

  if (rest.length === 0) {
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1) {
      title = sentences[0].slice(0, 60);
      rest = sentences.slice(1);
    }
  }

  const bullets = rest
    .join(" ")
    .split(/·|\s-\s|;\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  return { title, bullets };
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
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const result = await apiFetch<{ answer: string; responseId?: string | null }>("/sofia/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, previousResponseId: responseId })
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
      setResponseId(result.responseId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 40,
          width: "52px", height: "52px", borderRadius: "50%",
          background: "linear-gradient(135deg, #1e3a8a 0%, #0d1b3e 100%)",
          border: "1.5px solid rgba(212,168,67,0.5)",
          boxShadow: "0 4px 20px rgba(13,27,62,0.5), 0 0 0 0 rgba(212,168,67,0.3)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 150ms ease"
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(212,168,67,0.15)" stroke="#d4a843" strokeWidth="1.5"/>
          <path d="M8 10h8M8 13h5" stroke="#d4a843" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="17" cy="7" r="3" fill="#d4a843"/>
          <text x="15.5" y="9" fontSize="4" fill="#07101f" fontWeight="bold" textAnchor="middle">AI</text>
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: "88px", right: "24px", zIndex: 50,
            width: "380px", borderRadius: "16px", overflow: "hidden",
            background: "#0d1b3e",
            border: "1px solid rgba(212,168,67,0.2)",
            boxShadow: "0 24px 60px rgba(7,16,31,0.7), 0 0 0 1px rgba(255,255,255,0.05)"
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "linear-gradient(135deg, #1a2e5a 0%, #0d1b3e 100%)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "rgba(212,168,67,0.15)",
                border: "1px solid rgba(212,168,67,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <span style={{ color: "#d4a843", fontSize: "11px", fontWeight: 700 }}>AI</span>
              </div>
              <div>
                <p style={{ color: "#d4a843", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Sof IA</p>
                <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "14px", fontWeight: 600 }}>{t("Asistente inteligente")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px", padding: "6px 12px", color: "rgba(255,255,255,0.6)",
                fontSize: "12px", cursor: "pointer"
              }}
            >
              {t("Cerrar")}
            </button>
          </div>

          {/* Messages */}
          <div style={{ maxHeight: "45vh", overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.length === 0 && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", lineHeight: 1.6 }}>
                {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
              </p>
            )}
            {messages.map((message, index) => {
              if (message.role === "assistant") {
                const formatted = formatAssistant(message.content);
                return (
                  <div key={`${message.role}-${index}`} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px", padding: "12px 14px"
                  }}>
                    <p style={{ color: "#ffffff", fontSize: "13px", fontWeight: 600 }}>{formatted.title}</p>
                    {formatted.bullets.length > 0 && (
                      <ul style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {formatted.bullets.map((item, idx) => (
                          <li key={`${index}-${idx}`} style={{ display: "flex", gap: "8px", color: "rgba(255,255,255,0.65)", fontSize: "12px" }}>
                            <span style={{ marginTop: "5px", width: "5px", height: "5px", borderRadius: "50%", background: "#d4a843", flexShrink: 0 }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              return (
                <div key={`${message.role}-${index}`} style={{
                  background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.2)",
                  borderRadius: "10px", padding: "10px 14px", marginLeft: "24px",
                  color: "#e8c96a", fontSize: "13px"
                }}>
                  {message.content}
                </div>
              );
            })}
            {loading && (
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{t("Preparando respuesta...")}</p>
            )}
            {error && (
              <p style={{ color: "#fca5a5", fontSize: "12px" }}>{error}</p>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#ffffff", fontSize: "13px", outline: "none"
                }}
                placeholder={t("Escribe tu pregunta")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); sendMessage(); } }}
              />
              <button
                onClick={sendMessage}
                disabled={loading}
                style={{
                  padding: "10px 16px", borderRadius: "10px",
                  background: loading ? "rgba(212,168,67,0.3)" : "linear-gradient(135deg, #d4a843, #c9a84c)",
                  color: "#07101f", fontWeight: 700, fontSize: "13px",
                  border: "none", cursor: loading ? "not-allowed" : "pointer"
                }}
              >
                {loading ? t("...") : t("Enviar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
