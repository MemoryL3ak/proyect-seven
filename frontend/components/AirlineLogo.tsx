"use client";

import { useEffect, useState } from "react";
import { SURFACE } from "@/lib/design";

/**
 * Logo de aerolínea. Si el código IATA no viene, lo deduce del número de vuelo
 * (LA476 → LA). Si el logo no existe o el CDN falla, cae a una insignia con las
 * iniciales, de modo que la tarjeta nunca queda con un hueco roto.
 */
export default function AirlineLogo({
  iata,
  flightNumber,
  name,
  size = 34,
}: {
  iata?: string | null;
  flightNumber?: string | null;
  name?: string | null;
  size?: number;
}) {
  const code = (
    iata || /^([A-Z]{2,3})\s?\d/.exec((flightNumber ?? "").toUpperCase())?.[1] || ""
  ).toUpperCase();

  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [code]);

  const box: React.CSSProperties = {
    width: size, height: size, borderRadius: "10px", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: SURFACE.card, border: `1px solid ${SURFACE.border}`, overflow: "hidden",
  };

  if (!code || failed) {
    return (
      <div style={{ ...box, background: `linear-gradient(135deg,${SURFACE.border},${SURFACE.borderMuted})` }} title={name ?? undefined}>
        <span style={{ fontSize: size * 0.34, fontWeight: 800, color: SURFACE.textMuted, letterSpacing: "0.04em" }}>
          {code || (name ?? "?").slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div style={box} title={name ?? code}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://pics.avs.io/${Math.round(size * 2.4)}/${Math.round(size * 0.8)}/${code}@2x.png`}
        alt={name ?? code}
        onError={() => setFailed(true)}
        style={{ maxWidth: "88%", maxHeight: "72%", objectFit: "contain" }}
      />
    </div>
  );
}
