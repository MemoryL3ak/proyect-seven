"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Credencial digital para la sección "Cuenta" de los portales.
 *
 * Tarjeta premium con el QR siempre visible (sin tener que abrir la
 * credencial completa): fondo navy con brillo animado, QR enmarcado con
 * esquinas de mira, chip con el código y acción para ver la credencial
 * completa imprimible.
 */
type Props = {
  /** Contenido a codificar en el QR (el mismo de la credencial completa). */
  qrData: string;
  name: string;
  roleLabel?: string | null;
  /** Código corto de la credencial (se muestra bajo el QR). */
  code?: string | null;
  countryTag?: string | null;
  eventName?: string | null;
  /** Abre la credencial completa (HTML imprimible). */
  onOpenFull?: () => void;
};

export default function CredentialQrCard({ qrData, name, roleLabel, code, countryTag, eventName, onOpenFull }: Props) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrData, { width: 260, margin: 1, color: { dark: "#062240", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrUrl(url); })
      .catch(() => { if (!cancelled) setQrUrl(null); });
    return () => { cancelled = true; };
  }, [qrData]);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        overflow: "hidden",
        background: "linear-gradient(150deg,#041a2e 0%,#0a3356 55%,#062240 100%)",
        border: "1px solid rgba(52,243,198,0.25)",
        boxShadow: "0 10px 30px rgba(4,26,46,0.35)",
      }}
    >
      {/* Brillo holográfico */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "45%",
          background: "linear-gradient(105deg,transparent 0%,rgba(52,243,198,0.10) 45%,rgba(255,255,255,0.16) 50%,rgba(52,243,198,0.10) 55%,transparent 100%)",
          animation: "credShine 4.5s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 190,
          height: 190,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(33,208,179,0.22) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Filete inferior de marca */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg,transparent,#21D0B3 35%,#34F3C6 50%,#21D0B3 65%,transparent)",
        }}
      />

      <div style={{ position: "relative", padding: "16px 16px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {/* Encabezado */}
        <div style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#34F3C6", margin: 0 }}>
              Credencial digital
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </p>
            {eventName && (
              <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {eventName}
              </p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            {roleLabel && (
              <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 99, background: "rgba(52,243,198,0.14)", color: "#34F3C6", border: "1px solid rgba(52,243,198,0.35)" }}>
                {roleLabel}
              </span>
            )}
            {countryTag && (
              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.18)" }}>
                {countryTag}
              </span>
            )}
          </div>
        </div>

        {/* QR con esquinas de mira */}
        <div style={{ position: "relative", padding: 10 }}>
          {([
            { top: 0, left: 0, borderTop: "3px solid #34F3C6", borderLeft: "3px solid #34F3C6", borderTopLeftRadius: 10 },
            { top: 0, right: 0, borderTop: "3px solid #34F3C6", borderRight: "3px solid #34F3C6", borderTopRightRadius: 10 },
            { bottom: 0, left: 0, borderBottom: "3px solid #34F3C6", borderLeft: "3px solid #34F3C6", borderBottomLeftRadius: 10 },
            { bottom: 0, right: 0, borderBottom: "3px solid #34F3C6", borderRight: "3px solid #34F3C6", borderBottomRightRadius: 10 },
          ] as const).map((pos, i) => (
            <span key={i} aria-hidden style={{ position: "absolute", width: 22, height: 22, opacity: 0.9, ...pos }} />
          ))}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 10,
              boxShadow: "0 0 0 1px rgba(52,243,198,0.25), 0 8px 24px rgba(0,0,0,0.35), 0 0 32px rgba(33,208,179,0.18)",
            }}
          >
            {qrUrl ? (
              <img src={qrUrl} alt={`Código QR de la credencial de ${name}`} style={{ width: 168, height: 168, display: "block" }} />
            ) : (
              <div style={{ width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 11 }}>
                Generando QR…
              </div>
            )}
          </div>
        </div>

        {/* Código corto */}
        {code && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ width: 26, height: 1, background: "rgba(52,243,198,0.35)" }} />
            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "0.35em", color: "#34F3C6", fontVariantNumeric: "tabular-nums", textShadow: "0 0 12px rgba(52,243,198,0.5)" }}>
              {code.toUpperCase()}
            </span>
            <span aria-hidden style={{ width: 26, height: 1, background: "rgba(52,243,198,0.35)" }} />
          </div>
        )}

        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", margin: 0, textAlign: "center" }}>
          Presenta este código en accesos y validaciones
        </p>

        {onOpenFull && (
          <button
            type="button"
            onClick={onOpenFull}
            style={{
              alignSelf: "stretch",
              padding: "11px 0",
              borderRadius: 12,
              border: "1px solid rgba(52,243,198,0.4)",
              background: "rgba(33,208,179,0.12)",
              color: "#34F3C6",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
            </svg>
            Ver credencial completa
          </button>
        )}
      </div>

      <style>{`@keyframes credShine { 0% { left: -50%; } 55% { left: 110%; } 100% { left: 110%; } }`}</style>
    </div>
  );
}
