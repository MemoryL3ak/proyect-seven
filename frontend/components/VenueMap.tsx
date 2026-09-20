"use client";

import { useState } from "react";
import { isAvailable as isNativeBridge, send as nativeSend } from "@/lib/native-bridge";
import { PinIcon, MaximizeIcon, ArrowLeftIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";

/**
 * Mapa de sede/hotel para los portales.
 *
 * La vista previa es una imagen estática del embed (pointer-events: none, así
 * el mapa no captura los toques del scroll). Al tocarla se abre el mapa en
 * pantalla completa DENTRO del portal, con un botón "← Volver" siempre
 * visible — antes el embed navegaba a Google Maps dentro del WebView y no
 * había forma de regresar.
 */
export default function VenueMap({ title, query, alto = 180 }: { title: string; query: string; alto?: number }) {
  const [open, setOpen] = useState(false);
  const [sinImagen, setSinImagen] = useState(false);
  const compacto = alto < 140;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const embedSrc = apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(query)}`
    : null;
  /**
   * La vista previa es una imagen del mapa, no el embed.
   *
   * El iframe traía consigo toda la interfaz de Google —"Combinaciones de
   * teclas", "Datos del mapa ©2026", "Condiciones"— apretada contra el borde
   * inferior de una tarjeta de 180 px, y encima cargaba un mapa interactivo
   * completo por cada sede de la lista. La imagen estática pesa una fracción,
   * se ve limpia y lleva nuestro marcador. Al tocarla sigue abriéndose el mapa
   * de verdad a pantalla completa.
   */
  const imagenSrc = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?size=640x240&scale=2&zoom=15` +
      `&center=${encodeURIComponent(query)}` +
      `&markers=${encodeURIComponent(`color:0x21d0b3|${query}`)}` +
      `&key=${apiKey}`
    : null;
  const externalHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  // Ruta de navegación: en el teléfono abre la app de Google Maps con las
  // indicaciones para llegar desde la ubicación actual.
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`;

  // Dentro de la app nativa los enlaces externos deben salir por el puente
  // url.open (abre la app de Google Maps); si navegan dentro del WebView el
  // usuario queda atrapado en Google Maps sin botón para volver.
  const openExternal = (e: React.MouseEvent, url: string) => {
    if (isNativeBridge()) {
      e.preventDefault();
      nativeSend("url.open", { url });
    }
  };

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
          border: `1px solid ${SURFACE.border}`,
          borderRadius: 10,
          overflow: "hidden",
          cursor: "pointer",
          background: "#eef2f6",
        }}
      >
        {imagenSrc && !sinImagen ? (
          <img
            src={imagenSrc}
            alt={`Mapa de ${title}`}
            loading="lazy"
            onError={() => setSinImagen(true)}
            style={{ width: "100%", height: alto, objectFit: "cover", display: "block" }}
          />
        ) : embedSrc ? (
          <iframe
            src={embedSrc}
            title={`Mapa de ${title}`}
            loading="lazy"
            tabIndex={-1}
            aria-hidden
            style={{ width: "100%", height: alto, border: "none", pointerEvents: "none", display: "block" }}
          />
        ) : (
          <div style={{ height: alto, display: "flex", alignItems: "center", justifyContent: "center", color: SURFACE.textFaint }}>
            <PinIcon size={28} strokeWidth={1.8} />
          </div>
        )}
        {/* En una vista previa chica —el mapa que comparte franja con la foto
            en la tarjeta de sede— la píldora con texto tapaba medio mapa, así
            que ahí queda sólo el icono. */}
        <span
          style={{
            position: "absolute",
            bottom: compacto ? 6 : 8,
            right: compacto ? 6 : 8,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: compacto ? 6 : "6px 12px",
            borderRadius: 999,
            background: "rgba(4,26,46,0.85)",
            color: BRAND.tealLight,
            fontSize: 11,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          <MaximizeIcon size={compacto ? 13 : 12} strokeWidth={2} />
          {!compacto && "Ver mapa"}
        </span>
      </button>

      {/* Mapa en pantalla completa con botón de volver */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: SURFACE.card, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: `linear-gradient(135deg,${BRAND.navy},${BRAND.navyLight})`,
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
                color: BRAND.tealLight,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <ArrowLeftIcon size={14} strokeWidth={2.5} />
              Volver
            </button>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: SURFACE.card,
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
              onClick={(e) => openExternal(e, directionsHref)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(52,243,198,0.4)",
                background: "rgba(33,208,179,0.15)",
                color: BRAND.tealLight,
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
              <p style={{ fontSize: 13, color: SURFACE.textMuted, margin: 0, textAlign: "center" }}>{query}</p>
              <a
                href={externalHref}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => openExternal(e, externalHref)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "rgba(33,208,179,0.1)",
                  border: "1px solid rgba(33,208,179,0.3)",
                  color: BRAND.tealInk,
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
                onClick={(e) => openExternal(e, directionsHref)}
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
