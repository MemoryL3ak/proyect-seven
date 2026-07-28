"use client";

/**
 * Números de emergencia para la sección "Cuenta" de los portales.
 * Directorio nacional (Chile). Cada fila es un enlace tel: para llamar
 * con un toque desde el teléfono.
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
    </div>
  );
}
