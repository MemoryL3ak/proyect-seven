"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Números de emergencia para la sección "Cuenta" de los portales.
 * Directorio nacional (Chile). Cada fila marca la llamada con un toque.
 *
 * El marcado se hace con un iframe oculto en vez de navegar la página:
 * en los contenedores WebView que no manejan el esquema tel:, navegar el
 * documento mostraba su página de error ("Sin conexión"). El iframe dispara
 * el marcador sin tocar la página; si el sistema no lo abre, se muestra un
 * panel con el número para llamar directo o copiarlo.
 */

type EmergencyNumber = {
  label: string;
  number: string;
  detail?: string;
  emoji: string;
};

const NUMEROS: EmergencyNumber[] = [
  { label: "Ambulancia (SAMU)", number: "131", emoji: "🚑" },
  { label: "Bomberos", number: "132", emoji: "🚒" },
  { label: "Carabineros", number: "133", emoji: "🚓" },
  { label: "PDI", number: "134", detail: "Policía de Investigaciones", emoji: "🕵️" },
  { label: "Rescate marítimo", number: "137", emoji: "⚓" },
];

export default function EmergencyNumbersSection() {
  const [fallback, setFallback] = useState<EmergencyNumber | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const llamar = (n: EmergencyNumber) => {
    const tel = `tel:${n.number.replace(/\s/g, "")}`;
    let leftPage = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") leftPage = true;
    };
    document.addEventListener("visibilitychange", onVis);

    // Iframe oculto: dispara el marcador sin navegar el documento.
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.setAttribute("aria-hidden", "true");
    try {
      frame.src = tel;
      document.body.appendChild(frame);
    } catch {}

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onVis);
      try { frame.remove(); } catch {}
      // Si el marcador se abrió, la página pasó a segundo plano. Si seguimos
      // visibles, el sistema no manejó tel: → mostrar el panel de respaldo.
      if (!leftPage && document.visibilityState === "visible") {
        setCopied(false);
        setFallback(n);
      }
    }, 1200);
  };

  const copiar = async (number: string) => {
    try {
      await navigator.clipboard?.writeText(number);
      setCopied(true);
    } catch {}
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #fecaca",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ fontSize: 18 }}>🆘</span>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Números de emergencia
          </p>
          <p style={{ fontSize: 11.5, color: "#64748b", margin: 0 }}>
            Toca un número para llamar
          </p>
        </div>
      </div>
      <div style={{ padding: "0 12px 12px", display: "grid", gap: 6 }}>
        {NUMEROS.map((n) => (
          <a
            key={n.number}
            href={`tel:${n.number.replace(/\s/g, "")}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              llamar(n);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #f1f5f9",
              background: "#fff7f7",
              textDecoration: "none",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span aria-hidden style={{ fontSize: 16 }}>{n.emoji}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>
                  {n.label}
                </span>
                {n.detail && (
                  <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>{n.detail}</span>
                )}
              </span>
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#b91c1c",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {n.number}
            </span>
          </a>
        ))}
      </div>

      {/* Respaldo: el sistema no abrió el marcador */}
      {fallback && (
        <div
          onClick={() => setFallback(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: "rgba(2,12,24,0.6)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              padding: "20px 18px 26px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              {fallback.emoji} {fallback.label}
            </p>
            <p
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: "#b91c1c",
                margin: "8px 0 4px",
                letterSpacing: "0.06em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fallback.number}
            </p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px" }}>
              Marca este número desde el teléfono si la llamada no se abre sola.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <a
                href={`tel:${fallback.number}`}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "#b91c1c",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                Llamar al {fallback.number}
              </a>
              <button
                type="button"
                onClick={() => copiar(fallback.number)}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Número copiado" : "Copiar número"}
              </button>
              <button
                type="button"
                onClick={() => setFallback(null)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: "transparent",
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
