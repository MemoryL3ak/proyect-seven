"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import StyledSelect from "@/components/StyledSelect";
import { XIcon } from "@/components/ui/Icons";
import {
  FLOTAS,
  MODALIDADES,
  PLANTILLA_RUGBY_U20,
  pesos,
  type CobroTransporte,
  type FlotaCobro,
  type ModalidadCobro,
} from "@/lib/cobros-transporte";

type Proveedor = { id: string; name: string };

type Props = {
  eventoId: string;
  eventoNombre?: string | null;
  cobros: CobroTransporte[];
  proveedores: Proveedor[];
  onCerrar: () => void;
  onGuardado: (cobros: CobroTransporte[]) => void;
};

type Fila = Omit<CobroTransporte, "id"> & { id?: string; clave: string };

const nuevaFila = (base?: Partial<Fila>): Fila => ({
  clave: `f-${Math.random().toString(36).slice(2, 9)}`,
  sistema: "",
  modalidad: "POR_VIAJE",
  flota: "VAN",
  clientPrice: 0,
  cantidad: 0,
  providerIds: [],
  notas: null,
  ...base,
});

const label: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SURFACE.textMuted, marginBottom: 4,
};
const input: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${SURFACE.border}`, fontSize: 13, background: SURFACE.card, color: SURFACE.text,
};

/**
 * Editor de los cobros de licitación de un evento (30-09-2026). Cada cobro
 * es una línea del plan: sistema, modalidad (por viaje o por vehículo-día),
 * clase de flota, valor al cliente, cantidad licitada y los proveedores que
 * lo operan. Se guarda entero con PUT /events/:id/cobros-transporte.
 */
export default function EditorCobros({ eventoId, eventoNombre, cobros, proveedores, onCerrar, onGuardado }: Props) {
  const [filas, setFilas] = useState<Fila[]>(() => cobros.map((c) => ({ ...c, clave: c.id })));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  const cambiar = (clave: string, cambio: Partial<Fila>) =>
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));

  const alternarProveedor = (clave: string, providerId: string) =>
    setFilas((prev) =>
      prev.map((f) => {
        if (f.clave !== clave) return f;
        const tiene = f.providerIds.includes(providerId);
        return { ...f, providerIds: tiene ? f.providerIds.filter((p) => p !== providerId) : [...f.providerIds, providerId] };
      }),
    );

  const total = filas.reduce((s, f) => s + (Number(f.clientPrice) || 0) * (Number(f.cantidad) || 0), 0);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = filas
        .filter((f) => f.sistema.trim())
        .map(({ clave: _clave, ...f }) => f);
      const guardados = await apiFetch<CobroTransporte[]>(`/events/${eventoId}/cobros-transporte`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cobros: cuerpo }),
      });
      onGuardado(Array.isArray(guardados) ? guardados : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,26,46,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ width: "min(980px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", background: SURFACE.card, borderRadius: 20, boxShadow: "0 24px 64px rgba(4,26,46,0.35)", overflow: "hidden", animation: "scaleIn 0.25s ease" }}>
        {/* Cabecera */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${SURFACE.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.navyLight})` }}>
          <div>
            <p style={{ fontSize: 10, color: BRAND.teal, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, margin: 0 }}>Licitación de transporte</p>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: "3px 0 0" }}>Cobros del evento{eventoNombre ? ` · ${eventoNombre}` : ""}</h2>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <XIcon size={16} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {filas.length === 0 && (
            <div style={{ padding: 22, borderRadius: 14, border: `1px dashed ${SURFACE.border}`, background: SURFACE.bg, textAlign: "center", color: SURFACE.textMuted, fontSize: 13 }}>
              Sin cobros todavía. Agrega uno o parte de la plantilla del Plan Rugby U20.
            </div>
          )}
          {filas.map((f, i) => {
            const subtotal = (Number(f.clientPrice) || 0) * (Number(f.cantidad) || 0);
            return (
              <div key={f.clave} style={{ borderRadius: 16, border: `1px solid ${SURFACE.border}`, padding: 14, background: SURFACE.card, boxShadow: "0 1px 4px rgba(15,23,42,0.04)", animation: "fadeUp 0.25s ease both", animationDelay: `${i * 0.03}s` }}>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span style={label}>Sistema</span>
                    <input style={input} value={f.sistema} placeholder="Ej: Bus dedicado delegaciones (TA), 16 h" onChange={(e) => cambiar(f.clave, { sistema: e.target.value })} />
                  </label>
                  <label>
                    <span style={label}>Modalidad</span>
                    <StyledSelect value={f.modalidad} onChange={(e) => cambiar(f.clave, { modalidad: e.target.value as ModalidadCobro })}>
                      {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </StyledSelect>
                  </label>
                  <label>
                    <span style={label}>Flota</span>
                    <StyledSelect value={f.flota} onChange={(e) => cambiar(f.clave, { flota: e.target.value as FlotaCobro })}>
                      {FLOTAS.map((fl) => <option key={fl.value} value={fl.value}>{fl.label}</option>)}
                    </StyledSelect>
                  </label>
                  <label>
                    <span style={label}>Valor cliente</span>
                    <input style={{ ...input, textAlign: "right" }} inputMode="numeric" value={f.clientPrice ? `$${Number(f.clientPrice).toLocaleString("es-CL")}` : ""} placeholder="$0"
                      onChange={(e) => cambiar(f.clave, { clientPrice: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} />
                  </label>
                  <label>
                    <span style={label}>{f.modalidad === "POR_VIAJE" ? "Viajes licitados" : "Vehículo-días licitados"}</span>
                    <input style={{ ...input, textAlign: "right" }} inputMode="numeric" value={f.cantidad || ""} placeholder="0"
                      onChange={(e) => cambiar(f.clave, { cantidad: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} />
                  </label>
                </div>

                <div style={{ marginTop: 10 }}>
                  <span style={label}>Proveedores que lo operan</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {proveedores.length === 0 && <span style={{ fontSize: 12, color: SURFACE.textFaint }}>Sin proveedores de transporte en el evento.</span>}
                    {proveedores.map((p) => {
                      const activo = f.providerIds.includes(p.id);
                      return (
                        <button key={p.id} type="button" onClick={() => alternarProveedor(f.clave, p.id)} aria-pressed={activo}
                          style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, cursor: "pointer", transition: "all 150ms ease",
                            border: `1px solid ${activo ? BRAND.teal : SURFACE.border}`, background: activo ? "rgba(33,208,179,0.12)" : SURFACE.card, color: activo ? BRAND.tealInk : SURFACE.textSecondary }}>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: SURFACE.textMuted }}>
                    Subtotal <b style={{ color: SURFACE.text, fontVariantNumeric: "tabular-nums" }}>{pesos(subtotal)}</b>
                  </span>
                  <button type="button" onClick={() => setFilas((prev) => prev.filter((x) => x.clave !== f.clave))}
                    style={{ fontSize: 11, fontWeight: 700, color: STATE.dangerText, background: STATE.dangerSoft, border: `1px solid ${STATE.dangerBorder}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setFilas((prev) => [...prev, nuevaFila()])}
              style={{ fontSize: 12, fontWeight: 700, color: BRAND.tealInk, background: "rgba(33,208,179,0.10)", border: `1px solid ${BRAND.teal}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
              + Agregar cobro
            </button>
            {filas.length === 0 && (
              <button type="button" onClick={() => setFilas(PLANTILLA_RUGBY_U20.map((c) => nuevaFila(c)))}
                style={{ fontSize: 12, fontWeight: 700, color: SURFACE.textSecondary, background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
                Partir de la plantilla Rugby U20 (Rev_01-sep)
              </button>
            )}
          </div>
        </div>

        {/* Pie */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${SURFACE.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: SURFACE.bg }}>
          <div>
            <span style={{ fontSize: 11, color: SURFACE.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Total licitado</span>
            <p style={{ fontSize: 20, fontWeight: 800, color: SURFACE.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{pesos(total)}</p>
            {error && <p style={{ fontSize: 12, color: STATE.dangerText, margin: "4px 0 0" }}>{error}</p>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onCerrar} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
            <button type="button" onClick={guardar} disabled={guardando}
              style={{ fontSize: 13, fontWeight: 800, color: BRAND.navy, background: `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.tealLight})`, border: "none", borderRadius: 10, padding: "9px 18px", cursor: guardando ? "wait" : "pointer", boxShadow: "0 4px 14px rgba(33,208,179,0.35)", opacity: guardando ? 0.7 : 1 }}>
              {guardando ? "Guardando…" : "Guardar cobros"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
