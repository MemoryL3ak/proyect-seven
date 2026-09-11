"use client";

import type { ReactNode } from "react";

type DetailRowProps = {
  label: ReactNode;
  value: ReactNode;
  /** Color del valor (por defecto texto principal). */
  color?: string;
  bold?: boolean;
};

/** Fila etiqueta/valor para paneles de detalle y resúmenes. */
export default function DetailRow({ label, value, color, bold }: DetailRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || "#0f172a", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{value}</span>
    </div>
  );
}
