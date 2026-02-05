"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type SofiaMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function SofiaAssistant() {
  const { t } = useI18n();
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
    <section className="surface rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">SofIA</p>
          <h4 className="font-display text-2xl text-ink mt-2">{t("Asistente inteligente")}</h4>
          <p className="text-sm text-slate-500 mt-2">
            {t("Consulta datos operativos y recibe respuestas basadas en la base de datos.")}
          </p>
        </div>
        <div className="badge badge-emerald">GPT</div>
      </div>

      <div className="mt-5 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500">
            {t("Haz una pregunta sobre viajes, participantes, delegaciones, hoteles o transporte.")}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-2xl px-4 py-3 text-sm ${
              message.role === "user"
                ? "bg-emerald-50 text-emerald-900"
                : "bg-slate-50 text-slate-700"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && <div className="text-sm text-slate-400">{t("Escribiendo respuesta...")}</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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
    </section>
  );
}
