"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

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
  const { theme } = useTheme();
  const isDark = theme === "dark";
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
      {/* FAB wrapper with animated rings */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 40, width: "56px", height: "56px" }}>
        {/* Pulse rings */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: isDark ? "rgba(212,168,67,0.3)" : "rgba(99,102,241,0.3)",
          animation: "sofiaRing 2s ease-out infinite"
        }} />
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: isDark ? "rgba(212,168,67,0.2)" : "rgba(99,102,241,0.2)",
          animation: "sofiaRing2 2s ease-out infinite 0.5s"
        }} />
        {/* Main button */}
        <button type="button" onClick={() => setOpen(!open)} style={{
          position: "relative", width: "56px", height: "56px", borderRadius: "50%",
          background: isDark
            ? "linear-gradient(135deg, #c9a84c 0%, #1e3a8a 60%, #0d1b3e 100%)"
            : "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)",
          backgroundSize: "200% 200%",
          border: "none",
          animation: isDark ? "sofiaFloat 3s ease-in-out infinite, sofiaGlowGold 3s ease-in-out infinite" : "sofiaFloat 3s ease-in-out infinite, sofiaGlow 3s ease-in-out infinite",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: "1px"
        }}>
          {/* Sparkle icon */}
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            {/* Big sparkle center */}
            <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5Z"
              fill="#ffffff" opacity="0.95"/>
            {/* Small sparkle top-right */}
            <path d="M19 2L19.8 5.2L23 6L19.8 6.8L19 10L18.2 6.8L15 6L18.2 5.2Z"
              fill="#ffffff" opacity="0.7" transform="scale(0.55) translate(16, -2)"/>
            {/* Small sparkle bottom-left */}
            <path d="M5 16L5.6 18.4L8 19L5.6 19.6L5 22L4.4 19.6L2 19L4.4 18.4Z"
              fill="#ffffff" opacity="0.6" transform="scale(0.5) translate(-2, 8)"/>
          </svg>
        </button>
      </div>

      {open && (
        <div style={{
          position: "fixed", bottom: "88px", right: "24px", zIndex: 50,
          width: "380px", borderRadius: "16px", overflow: "hidden",
          background: isDark ? "#0d1b3e" : "#ffffff",
          border: isDark ? "1px solid rgba(212,168,67,0.2)" : "1px solid #e2e8f0",
          boxShadow: isDark ? "0 24px 60px rgba(7,16,31,0.7)" : "0 20px 60px rgba(15,23,42,0.18)"
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid transparent",
            background: isDark ? "linear-gradient(135deg, #1a2e5a, #0d1b3e)" : "linear-gradient(135deg, #1e4ed8, #1a42c0)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                background: isDark ? "rgba(212,168,67,0.15)" : "rgba(255,255,255,0.2)",
                border: isDark ? "1px solid rgba(212,168,67,0.4)" : "1px solid rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <span style={{ color: isDark ? "#d4a843" : "#ffffff", fontSize: "11px", fontWeight: 700 }}>AI</span>
              </div>
              <div>
                <p style={{ color: isDark ? "#d4a843" : "rgba(255,255,255,0.75)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Sof IA</p>
                <p style={{ color: "#ffffff", fontSize: "14px", fontWeight: 600 }}>{t("Asistente inteligente")}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "8px", padding: "5px 12px", color: "#ffffff", fontSize: "12px", cursor: "pointer"
            }}>{t("Cerrar")}</button>
          </div>

          {/* Messages */}
          <div style={{ maxHeight: "45vh", overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px", background: isDark ? "#0a1628" : "#f8faff" }}>
            {messages.length === 0 && (
              <p style={{ color: isDark ? "rgba(255,255,255,0.4)" : "#94a3b8", fontSize: "13px", lineHeight: 1.6 }}>
                {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
              </p>
            )}
            {messages.map((msg, i) => {
              if (msg.role === "assistant") {
                const f = formatAssistant(msg.content);
                return (
                  <div key={i} style={{ background: isDark ? "rgba(255,255,255,0.05)" : "#ffffff", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e8edf5", borderRadius: "10px", padding: "12px 14px", boxShadow: isDark ? "none" : "0 1px 4px rgba(15,23,42,0.06)" }}>
                    <p style={{ color: isDark ? "#ffffff" : "#0f172a", fontSize: "13px", fontWeight: 600 }}>{f.title}</p>
                    {f.bullets.length > 0 && (
                      <ul style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {f.bullets.map((item, idx) => (
                          <li key={idx} style={{ display: "flex", gap: "8px", color: isDark ? "rgba(255,255,255,0.65)" : "#475569", fontSize: "12px" }}>
                            <span style={{ marginTop: "5px", width: "5px", height: "5px", borderRadius: "50%", background: isDark ? "#d4a843" : "#1e4ed8", flexShrink: 0 }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              return (
                <div key={i} style={{ background: isDark ? "rgba(212,168,67,0.1)" : "#eff3ff", border: isDark ? "1px solid rgba(212,168,67,0.2)" : "1px solid #bfdbfe", borderRadius: "10px", padding: "10px 14px", marginLeft: "24px", color: isDark ? "#e8c96a" : "#1e4ed8", fontSize: "13px" }}>
                  {msg.content}
                </div>
              );
            })}
            {loading && <p style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#94a3b8", fontSize: "12px" }}>{t("Preparando respuesta...")}</p>}
            {error && <p style={{ color: "#fca5a5", fontSize: "12px" }}>{error}</p>}
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px 16px", borderTop: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e8edf5", background: isDark ? "#0d1b3e" : "#ffffff" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.07)" : "#f4f7fc", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0", color: isDark ? "#ffffff" : "#0f172a", fontSize: "13px", outline: "none" }}
                placeholder={t("Escribe tu pregunta")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
              />
              <button onClick={sendMessage} disabled={loading} style={{
                padding: "10px 16px", borderRadius: "10px",
                background: isDark ? (loading ? "rgba(212,168,67,0.3)" : "linear-gradient(135deg, #d4a843, #c9a84c)") : (loading ? "#bfdbfe" : "linear-gradient(135deg, #1e4ed8, #1a42c0)"),
                color: isDark ? "#07101f" : "#ffffff", fontWeight: 700, fontSize: "13px", border: "none", cursor: loading ? "not-allowed" : "pointer"
              }}>{loading ? t("...") : t("Enviar")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
