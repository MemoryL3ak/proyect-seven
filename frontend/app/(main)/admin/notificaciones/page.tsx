"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Recipient = {
  userKind: "athlete" | "driver" | "admin" | "provider_participant";
  userId: string;
  fullName: string | null;
  platforms: string[];
  lastActiveAt: string;
};

type SendResult =
  | { kind: "ok"; at: number }
  | { kind: "error"; message: string };

const EMOJI_OPTIONS = ["🔔", "🚖", "💬", "📍", "✅", "⚠️", "🛟", "📅", "🎉"];

export default function AdminNotificacionesPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState<string>("🔔");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<Recipient[]>("/push-notifications/recipients");
      setRecipients(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudieron cargar los destinatarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((r) => {
      return (
        (r.fullName ?? "").toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q) ||
        r.userKind.includes(q)
      );
    });
  }, [recipients, filter]);

  const selected = useMemo(
    () => recipients.find((r) => `${r.userKind}:${r.userId}` === selectedKey) ?? null,
    [recipients, selectedKey],
  );

  const canSend =
    !!selected && title.trim().length > 0 && body.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    setResult(null);
    try {
      await apiFetch("/push-notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userKind: selected.userKind,
          userId: selected.userId,
          title: title.trim(),
          body: body.trim(),
          data: { url: selected.userKind === "driver" ? "/portal/conductor" : "/portal/user", emoji },
        }),
      });
      setResult({ kind: "ok", at: Date.now() });
      setBody("");
    } catch (err) {
      setResult({
        kind: "error",
        message: err instanceof Error ? err.message : "No se pudo enviar",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
          Notificaciones push
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
          Envia un push de prueba a un usuario que ya registró su dispositivo. La notificación
          aparecerá tanto en la campanita del portal como en el sistema operativo.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 1.4fr", gap: 18, alignItems: "stretch" }}>
        {/* ────── Recipients column ────── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                Destinatarios ({recipients.length})
              </span>
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                style={{
                  fontSize: 11, fontWeight: 600, color: "#64748b",
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 8, padding: "4px 10px", cursor: loading ? "default" : "pointer",
                }}
              >
                {loading ? "Cargando…" : "Actualizar"}
              </button>
            </div>
            <input
              type="search"
              placeholder="Buscar por nombre o tipo"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                marginTop: 8, width: "100%", padding: "8px 10px", fontSize: 13,
                borderRadius: 8, border: "1px solid #e2e8f0", outline: "none",
                background: "#f8fafc", color: "#0f172a",
              }}
            />
          </div>

          <div style={{ overflowY: "auto", maxHeight: 480 }}>
            {loadError && (
              <div style={{ padding: 14, fontSize: 12, color: "#b91c1c", background: "#FEE2E2" }}>
                {loadError}
              </div>
            )}
            {!loadError && filtered.length === 0 && !loading && (
              <div style={{ padding: 22, fontSize: 12.5, color: "#94a3b8", textAlign: "center" }}>
                {recipients.length === 0
                  ? "Aún no hay dispositivos registrados. Pedí al usuario que abra la app móvil y dé permiso de notificaciones."
                  : "Ningún destinatario coincide con el filtro."}
              </div>
            )}
            {filtered.map((r) => {
              const key = `${r.userKind}:${r.userId}`;
              const isSelected = selectedKey === key;
              const display = r.fullName ?? `${r.userKind} ${r.userId.slice(0, 8)}`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "10px 14px",
                    border: "none", borderBottom: "1px solid #f8fafc",
                    background: isSelected ? "rgba(33,208,179,0.08)" : "#fff",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                      background: r.userKind === "driver" ? "rgba(59,130,246,0.1)" : "rgba(33,208,179,0.1)",
                      color: r.userKind === "driver" ? "#3b82f6" : "#0a7a6b",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    {r.userKind === "driver" ? "🚗" : "🏃"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {display}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#94a3b8" }}>
                      {r.userKind} · {r.platforms.join(", ")}
                    </p>
                  </div>
                  {isSelected && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#21D0B3" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ────── Compose column ────── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Para:</span>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: selected ? "#0f172a" : "#94a3b8" }}>
              {selected ? selected.fullName ?? selected.userId : "Selecciona un destinatario"}
            </p>
            {selected && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                {selected.userKind} · {selected.userId}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
              Emoji
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: emoji === e ? "2px solid #21D0B3" : "1px solid #e2e8f0",
                    background: emoji === e ? "rgba(33,208,179,0.08)" : "#fff",
                    fontSize: 18, cursor: "pointer",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Recordatorio de viaje"
              maxLength={80}
              style={{
                width: "100%", padding: "9px 11px", fontSize: 13,
                borderRadius: 8, border: "1px solid #e2e8f0", outline: "none",
                color: "#0f172a",
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>
              Mensaje
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribí el cuerpo de la notificación…"
              rows={4}
              maxLength={300}
              style={{
                width: "100%", padding: "9px 11px", fontSize: 13,
                borderRadius: 8, border: "1px solid #e2e8f0", outline: "none",
                color: "#0f172a", resize: "vertical", fontFamily: "inherit",
              }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 10.5, color: "#94a3b8", textAlign: "right" }}>
              {body.length}/300
            </p>
          </div>

          {result?.kind === "ok" && (
            <div
              style={{
                marginBottom: 12, padding: "8px 10px", borderRadius: 8,
                background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)",
                fontSize: 12, color: "#0a7a6b",
              }}
            >
              ✓ Enviado a las {new Date(result.at).toLocaleTimeString("es-CL")}. Revisá el dispositivo y la campanita del portal.
            </div>
          )}
          {result?.kind === "error" && (
            <div
              style={{
                marginBottom: 12, padding: "8px 10px", borderRadius: 8,
                background: "#FEE2E2", border: "1px solid rgba(239,68,68,0.25)",
                fontSize: 12, color: "#b91c1c",
              }}
            >
              {result.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: "100%", padding: 12, borderRadius: 10, border: "none",
              background: canSend ? "linear-gradient(135deg,#21D0B3,#14AE98)" : "#cbd5e1",
              color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {sending ? "Enviando…" : "Enviar push"}
          </button>
        </div>
      </div>
    </div>
  );
}
