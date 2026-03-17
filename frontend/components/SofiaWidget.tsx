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

  if (lines.length === 0) {
    return { title: "Respuesta", bullets: [] as string[] };
  }

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
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full px-6 py-4 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5"
        style={{
          background: "linear-gradient(135deg, #c9a84c 0%, #a8892e 100%)",
          boxShadow: "0 8px 32px rgba(201,168,76,0.35)",
        }}
        onClick={() => setOpen(true)}
      >
        <span className="h-2 w-2 rounded-full bg-white/60" />
        <span className="text-base font-semibold tracking-[0em]">Sof IA</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/50 p-6 pointer-events-none backdrop-blur-sm">
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl pointer-events-auto shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
            style={{ background: "#0f1d35", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-sm font-semibold tracking-[0em] text-white/50">Sof IA</p>
                <h4 className="font-sans font-bold text-xl text-white">{t("Asistente inteligente")}</h4>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
              >
                {t("Cerrar")}
              </button>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="text-sm text-white/50">
                  {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
                </div>
              )}
              {messages.map((message, index) => {
                if (message.role === "assistant") {
                  const formatted = formatAssistant(message.content);
                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
                    >
                      <p className="text-sm font-semibold text-white">{formatted.title}</p>
                      {formatted.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-white/65">
                          {formatted.bullets.map((item, idx) => (
                            <li key={`${index}-${idx}`} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
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
                    className="rounded-2xl px-4 py-3 text-sm text-white ml-6"
                    style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.20) 0%, rgba(11,22,40,0.80) 100%)", border: "1px solid rgba(201,168,76,0.25)" }}
                  >
                    {message.content}
                  </div>
                );
              })}
              {loading && <div className="text-sm text-white/40">{t("Preparando respuesta...")}</div>}
              {error && <div className="text-sm text-rose-400">{error}</div>}
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <div className="flex flex-wrap gap-2">
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
                  {loading ? t("Enviando...") : t("Enviar")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
