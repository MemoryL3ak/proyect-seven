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
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-emerald-600 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-emerald-600/35 transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-emerald-600/40"
        onClick={() => setOpen(true)}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-200" />
        <span className="text-base font-semibold tracking-[0em]">Sof IA</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-900/30 p-6 pointer-events-none">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl pointer-events-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold tracking-[0em] text-slate-500">Sof IA</p>
                <h4 className="font-display text-xl text-ink">{t("Asistente inteligente")}</h4>
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
                <div className="text-sm text-slate-500">
                  {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
                </div>
              )}
              {messages.map((message, index) => {
                if (message.role === "assistant") {
                  const formatted = formatAssistant(message.content);
                  return (
                    <div
                      key={`${message.role}-${index}`}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-ink">{formatted.title}</p>
                      {formatted.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                          {formatted.bullets.map((item, idx) => (
                            <li key={`${index}-${idx}`} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                    className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                  >
                    {message.content}
                  </div>
                );
              })}
              {loading && <div className="text-sm text-slate-400">{t("Preparando respuesta...")}</div>}
              {error && <div className="text-sm text-rose-600">{error}</div>}
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
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
