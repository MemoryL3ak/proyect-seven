"use client";

import { useState } from "react";

/**
 * Mapa de sede/hotel para los portales.
 *
 * La vista previa es una imagen estática del embed (pointer-events: none, así
 * el mapa no captura los toques del scroll). Al tocarla se abre el mapa en
 * pantalla completa DENTRO del portal, con un botón "← Volver" siempre
 * visible — antes el embed navegaba a Google Maps dentro del WebView y no
 * había forma de regresar.
 */
export default function VenueMap({ title, query }: { title: string; query: string }) {
  const [open, setOpen] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const embedSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}`
    : null;
  const externalHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  // Ruta de navegación: en el teléfono abre la app de Google Maps con las
  // indicaciones para llegar desde la ubicación actual.
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`;

  return (
    <>
      {/* Vista previa (no interactiva) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ver mapa de ${title}`}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          padding: 0,
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          cursor: "pointer",
          background: "#eef2f6",
        }}
      >
        {embedSrc ? (
          <iframe
            src={embedSrc}
            title={`Mapa de ${title}`}
            loading="lazy"
            tabIndex={-1}
            aria-hidden
            style={{ width: "100%", height: 180, border: "none", pointerEvents: "none", display: "block" }}
          />
        ) : (
          <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          </div>
        )}
        <span
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(4,26,46,0.85)",
            color: "#34F3C6",
            fontSize: 11,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" />
          </svg>
          Ver mapa
        </span>
      </button>

      {/* Mapa en pantalla completa con botón de volver */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#fff", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "linear-gradient(135deg,#041a2e,#062240)",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(52,243,198,0.4)",
                background: "rgba(33,208,179,0.15)",
                color: "#34F3C6",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
              Volver
            </button>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                margin: 0,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </p>
            <a
              href={directionsHref}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(52,243,198,0.4)",
                background: "rgba(33,208,179,0.15)",
                color: "#34F3C6",
                fontSize: 12.5,
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Cómo llegar
            </a>
          </div>
          {embedSrc ? (
            <iframe src={embedSrc} title={`Mapa de ${title}`} style={{ flex: 1, width: "100%", border: "none" }} allowFullScreen />
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 }}>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0, textAlign: "center" }}>{query}</p>
              <a
                href={externalHref}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "rgba(33,208,179,0.1)",
                  border: "1px solid rgba(33,208,179,0.3)",
                  color: "#0a7a6b",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Abrir en Google Maps
              </a>
              <a
                href={directionsHref}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "rgba(31,205,255,0.08)",
                  border: "1px solid rgba(31,205,255,0.3)",
                  color: "#0369a1",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Cómo llegar
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
