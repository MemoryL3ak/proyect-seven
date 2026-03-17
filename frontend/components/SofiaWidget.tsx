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
      {/* FAB button */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        style={{
          background: "var(--gold)",
          color: "var(--gold-btn-text)",
          boxShadow: "0 4px 16px rgba(201,168,76,0.4)",
        }}
        onClick={() => setOpen(!open)}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "rgba(26,20,0,0.4)" }}
        />
        <span className="font-bold tracking-wide">Sof IA</span>
      </button>

      {/* Panel — no overlay, floats above content */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-[380px] overflow-hidden rounded-xl shadow-2xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 20px 60px rgba(15,23,42,0.15), 0 4px 16px rgba(15,23,42,0.08)"
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--gold)" }}>
                Sof IA
              </p>
              <h4 className="font-bold text-base" style={{ color: "var(--text)" }}>
                {t("Asistente inteligente")}
              </h4>
            </div>
            <button
              type="button"
              className="btn btn-ghost text-sm px-3 py-1.5"
              onClick={() => setOpen(false)}
            >
              {t("Cerrar")}
            </button>
          </div>

          {/* Messages */}
          <div className="max-h-[45vh] space-y-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
              </p>
            )}
            {messages.map((message, index) => {
              if (message.role === "assistant") {
                const formatted = formatAssistant(message.content);
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className="rounded-lg px-4 py-3 text-sm"
                    style={{
                      background: "var(--elevated)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                      {formatted.title}
                    </p>
                    {formatted.bullets.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {formatted.bullets.map((item, idx) => (
                          <li key={`${index}-${idx}`} className="flex gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--success)" }} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={`${message.role}-${index}`}
                  className="rounded-lg px-4 py-3 text-sm ml-8"
                  style={{
                    background: "var(--brand-dim)",
                    border: "1px solid var(--info-border)",
                    color: "var(--brand)"
                  }}
                >
                  {message.content}
                </div>
              );
            })}
            {loading && (
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {t("Preparando respuesta...")}
              </p>
            )}
            {error && (
              <p className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
          </div>

          {/* Input */}
          <div
            className="px-5 py-4"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder={t("Escribe tu pregunta")}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={loading}>
                {loading ? t("...") : t("Enviar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
