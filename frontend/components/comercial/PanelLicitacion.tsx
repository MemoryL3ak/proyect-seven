"use client";

import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ACCENT, BRAND, STATE, SURFACE } from "@/lib/design";
import { useContador } from "@/lib/contador-animado";
import {
  etiquetaFlota,
  etiquetaModalidad,
  pesos,
  pesosCortos,
  unidadesDe,
  type CobroTransporte,
  type ResumenCobro,
  type ResumenLicitacion,
} from "@/lib/cobros-transporte";
import EditorCobros from "./EditorCobros";

type Proveedor = { id: string; name: string };

type Props = {
  eventoId: string | null;
  eventoNombre?: string | null;
  cobros: CobroTransporte[];
  resumen: ResumenLicitacion;
  proveedores: Proveedor[];
  veCobros: boolean;
  cargando: boolean;
  onCobros: (cobros: CobroTransporte[]) => void;
};

/** Paleta de los gráficos: sólo tokens del sistema de diseño. */
export const PALETA = [BRAND.teal, BRAND.blue, ACCENT.violet, STATE.warning, ACCENT.indigo, STATE.success, BRAND.charcoal, ACCENT.violetLight];

const SOMBRA = "0 2px 8px rgba(15,23,42,0.06)";
const tarjeta = (borde: string, pad: string): React.CSSProperties => ({
  background: SURFACE.card, border: `1px solid ${borde}20`, borderRadius: 18, padding: pad, boxShadow: SOMBRA,
  position: "relative", overflow: "hidden", transition: "transform 200ms ease, box-shadow 200ms ease",
});
const franja = (color: string): React.CSSProperties => ({
  position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${color}, ${color}66)`,
});
const rotulo = (color: string): React.CSSProperties => ({
  fontSize: 11, color, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", margin: 0,
});

function Cifra({ valor, formato }: { valor: number; formato: (v: number) => string }) {
  const v = useContador(valor);
  return <>{formato(Math.round(v))}</>;
}

function TooltipCaja({ active, payload, ve }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; payload?: Record<string, unknown> }>; ve: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const nombre = String((p.payload?.nombre as string) ?? p.name ?? "");
  return (
    <div style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 12, padding: "8px 12px", boxShadow: "0 8px 24px rgba(15,23,42,0.12)", fontSize: 12 }}>
      <p style={{ margin: 0, fontWeight: 700, color: SURFACE.text }}>{nombre}</p>
      {payload.map((item, i) => (
        <p key={i} style={{ margin: "2px 0 0", color: SURFACE.textMuted }}>
          {item.name}: <b style={{ color: SURFACE.text }}>{ve ? pesos(Number(item.value)) : "—"}</b>
        </p>
      ))}
    </div>
  );
}

/**
 * Licitación de transporte del evento en el dashboard comercial
 * (30-09-2026): lo licitado, lo consumido a la fecha y lo programado, por
 * sistema y por proveedor, cruzando los cobros del plan con los viajes.
 */
export default function PanelLicitacion({ eventoId, eventoNombre, cobros, resumen, proveedores, veCobros, cargando, onCobros }: Props) {
  const [editando, setEditando] = useState(false);
  const [sistemaActivo, setSistemaActivo] = useState<string | null>(null);
  const nombreDe = useMemo(() => new Map(proveedores.map((p) => [p.id, p.name])), [proveedores]);
  const pad = "20px 20px";

  const semaforo = resumen.avance >= 85 ? STATE.danger : resumen.avance >= 60 ? STATE.warning : STATE.success;

  const datosSistema = resumen.porSistema.map((s, i) => ({ nombre: s.sistema, valor: s.licitado, consumido: s.consumido, color: PALETA[i % PALETA.length] }));
  const restante = Math.max(0, resumen.licitado - resumen.programado);
  const pendienteProgramado = Math.max(0, resumen.programado - resumen.consumido);
  const datosAvance = [
    { nombre: "Consumido", valor: resumen.consumido, color: BRAND.teal },
    { nombre: "Programado por realizar", valor: pendienteProgramado, color: BRAND.blue },
    { nombre: "Sin programar", valor: restante, color: SURFACE.borderStrong },
  ];
  // Por proveedor sólo se mira lo que hizo: lo licitado se reparte por
  // sistema (buses y vans compartidos) y no se puede atribuir a uno solo.
  const datosProveedor = resumen.porProveedor.map((p) => ({
    providerId: p.providerId,
    nombre: nombreDe.get(p.providerId) ?? "Proveedor",
    Consumido: p.consumido,
    "Por realizar": Math.max(0, p.programado - p.consumido),
    total: p.programado,
    realizados: p.realizados,
    programados: p.programados,
  }));

  const kpis: { etiqueta: string; valor: number; color: string; formato: (v: number) => string; nota: string }[] = [
    { etiqueta: "Licitado", valor: resumen.licitado, color: BRAND.teal, formato: pesos, nota: `${cobros.length} ${cobros.length === 1 ? "cobro" : "cobros"}` },
    { etiqueta: "Consumido a la fecha", valor: resumen.consumido, color: BRAND.blue, formato: pesos, nota: "viajes y días realizados" },
    { etiqueta: "Programado", valor: resumen.programado, color: ACCENT.violet, formato: pesos, nota: "realizado más agendado" },
    { etiqueta: "Por facturar", valor: resumen.porFacturar, color: STATE.warning, formato: pesos, nota: "licitado menos consumido" },
    { etiqueta: "Avance", valor: resumen.avance, color: semaforo, formato: (v) => `${v}%`, nota: "del contrato" },
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Cabecera del bloque */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={rotulo(BRAND.teal)}>Licitación de transporte</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: SURFACE.text, margin: "4px 0 0" }}>
            {eventoNombre ? `Cobros del plan · ${eventoNombre}` : "Cobros del plan"}
          </h2>
          {!veCobros && (
            <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "4px 0 0" }}>Los montos requieren el módulo Finanzas; se muestran cantidades.</p>
          )}
        </div>
        {veCobros && eventoId && (
          <button type="button" onClick={() => setEditando(true)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(33,208,179,0.3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(33,208,179,0.18)"; }}
            style={{ fontSize: 12, fontWeight: 800, color: BRAND.navy, background: `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.tealLight})`, border: "none", borderRadius: 10, padding: "9px 16px", cursor: "pointer", boxShadow: "0 2px 8px rgba(33,208,179,0.18)", transition: "all 200ms ease" }}>
            {cobros.length ? "Editar cobros" : "Cargar cobros"}
          </button>
        )}
      </div>

      {cobros.length === 0 ? (
        <div style={{ ...tarjeta(BRAND.teal, "28px 20px"), textAlign: "center" }}>
          <div style={franja(BRAND.teal)} />
          <p style={{ fontSize: 15, fontWeight: 700, color: SURFACE.text, margin: 0 }}>
            {cargando ? "Cargando cobros…" : eventoId ? "Este evento no tiene cobros de licitación" : "Elige un evento arriba"}
          </p>
          {!cargando && eventoId && (
            <p style={{ fontSize: 12, color: SURFACE.textMuted, margin: "6px 0 0" }}>
              {veCobros ? "Cárgalos desde el plan comercial: por viaje (aeropuerto) o por vehículo y día (buses y vans a disposición)." : "Finanzas puede cargarlos desde el plan comercial."}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            {kpis.map((k, i) => (
              <div key={k.etiqueta}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 10px 28px ${k.color}22`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = SOMBRA; }}
                style={{ ...tarjeta(k.color, "18px 16px"), animation: "fadeInUp 0.4s ease both", animationDelay: `${i * 0.05}s` }}>
                <div style={franja(k.color)} />
                <p style={{ fontSize: 10, color: SURFACE.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, margin: 0 }}>{k.etiqueta}</p>
                <p style={{ fontSize: "clamp(1.05rem, 4vw, 1.45rem)", fontWeight: 800, color: k.color, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", margin: "8px 0 0", overflowWrap: "anywhere" }}>
                  {veCobros || k.etiqueta === "Avance" ? <Cifra valor={k.valor} formato={k.formato} /> : "—"}
                </p>
                <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: "6px 0 0" }}>{k.nota}</p>
              </div>
            ))}
          </div>

          {/* Donas y proveedores */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Dona por sistema */}
            <div style={tarjeta(BRAND.teal, pad)}>
              <div style={franja(BRAND.teal)} />
              <p style={rotulo(BRAND.teal)}>Licitado por sistema</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: "2px 0 10px" }}>Dónde está el contrato</p>
              <div style={{ position: "relative", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosSistema} dataKey="valor" nameKey="nombre" innerRadius={62} outerRadius={92} paddingAngle={2} cornerRadius={6} stroke="none"
                      onMouseEnter={(_, i) => setSistemaActivo(datosSistema[i]?.nombre ?? null)} onMouseLeave={() => setSistemaActivo(null)}>
                      {datosSistema.map((d) => (
                        <Cell key={d.nombre} fill={d.color} opacity={sistemaActivo && sistemaActivo !== d.nombre ? 0.35 : 1} style={{ transition: "opacity 200ms ease", cursor: "pointer" }} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipCaja ve={veCobros} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <span style={{ fontSize: 10, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: SURFACE.text, fontVariantNumeric: "tabular-nums" }}>{veCobros ? pesosCortos(resumen.licitado) : "—"}</span>
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 5 }}>
                {datosSistema.map((d) => (
                  <li key={d.nombre} onMouseEnter={() => setSistemaActivo(d.nombre)} onMouseLeave={() => setSistemaActivo(null)}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: SURFACE.textSecondary, opacity: sistemaActivo && sistemaActivo !== d.nombre ? 0.5 : 1, transition: "opacity 200ms ease", cursor: "default" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</span>
                    <b style={{ color: SURFACE.text, fontVariantNumeric: "tabular-nums" }}>{resumen.licitado > 0 ? Math.round((d.valor / resumen.licitado) * 100) : 0}%</b>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dona de avance */}
            <div style={tarjeta(BRAND.blue, pad)}>
              <div style={franja(BRAND.blue)} />
              <p style={rotulo(BRAND.blue)}>Avance del contrato</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: "2px 0 10px" }}>Consumido, programado y sin programar</p>
              <div style={{ position: "relative", height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosAvance} dataKey="valor" nameKey="nombre" innerRadius={62} outerRadius={92} paddingAngle={2} cornerRadius={6} stroke="none" startAngle={90} endAngle={-270}>
                      {datosAvance.map((d) => <Cell key={d.nombre} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<TooltipCaja ve={veCobros} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: semaforo, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}><Cifra valor={resumen.avance} formato={(v) => `${v}%`} /></span>
                  <span style={{ fontSize: 10, color: SURFACE.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginTop: 4 }}>consumido</span>
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 5 }}>
                {datosAvance.map((d) => (
                  <li key={d.nombre} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: SURFACE.textSecondary }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{d.nombre}</span>
                    <b style={{ color: SURFACE.text, fontVariantNumeric: "tabular-nums" }}>{veCobros ? pesosCortos(d.valor) : "—"}</b>
                  </li>
                ))}
              </ul>
            </div>

            {/* Barras por proveedor */}
            <div style={tarjeta(ACCENT.violet, pad)}>
              <div style={franja(ACCENT.violet)} />
              <p style={rotulo(ACCENT.violet)}>Por proveedor</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: "2px 0 2px" }}>Cuánto lleva cada uno</p>
              <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: "0 0 10px" }}>
                Consumido a la fecha y lo agendado que falta realizar, valorizado con el cobro de cada sistema.
              </p>
              <div style={{ height: 210 + 8 + Math.max(0, datosProveedor.length - 5) * 24 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosProveedor} layout="vertical" margin={{ left: 4, right: 56, top: 4, bottom: 4 }} barCategoryGap={8}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 10, fill: SURFACE.textSecondary }} tickLine={false} axisLine={false}
                      tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)} />
                    <Tooltip content={<TooltipCaja ve={veCobros} />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                    <Bar dataKey="Consumido" stackId="a" fill={BRAND.teal} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Por realizar" stackId="a" fill={BRAND.blue} radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="total" position="right" formatter={(v: unknown) => (veCobros ? pesosCortos(Number(v)) : "")} style={{ fontSize: 10, fill: SURFACE.textSecondary, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 10, color: SURFACE.textMuted, margin: "4px 0 8px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: BRAND.teal }} />Consumido</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: BRAND.blue }} />Por realizar</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", columnGap: 10, rowGap: 5, fontSize: 11, alignItems: "baseline" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textFaint }}>Proveedor</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textFaint, textAlign: "right" }}>Realizado</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textFaint, textAlign: "right" }}>Consumido</span>
                {datosProveedor.map((p) => (
                  <Fragment key={p.providerId}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: SURFACE.textSecondary }}>{p.nombre}</span>
                    <span style={{ textAlign: "right", color: SURFACE.textMuted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{p.realizados} de {p.programados}</span>
                    <span style={{ textAlign: "right", fontWeight: 700, color: SURFACE.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{veCobros ? pesosCortos(p.Consumido) : "—"}</span>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Detalle de cobros */}
          <div style={tarjeta(BRAND.charcoal, pad)}>
            <div style={franja(BRAND.charcoal)} />
            <p style={rotulo(BRAND.charcoal)}>Detalle de cobros</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: SURFACE.text, margin: "2px 0 14px" }}>Cada línea del plan y cuánto lleva</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {resumen.cobros.map((c, i) => (
                <FilaCobro key={c.id} cobro={c} color={PALETA[resumen.porSistema.findIndex((s) => s.sistema === c.sistema) % PALETA.length] ?? BRAND.teal} nombreDe={nombreDe} ve={veCobros} indice={i} />
              ))}
            </div>
          </div>
        </>
      )}

      {editando && eventoId && (
        <EditorCobros
          eventoId={eventoId}
          eventoNombre={eventoNombre}
          cobros={cobros}
          proveedores={proveedores}
          onCerrar={() => setEditando(false)}
          onGuardado={(nuevos) => { onCobros(nuevos); setEditando(false); }}
        />
      )}
    </section>
  );
}

function FilaCobro({ cobro, color, nombreDe, ve, indice }: { cobro: ResumenCobro; color: string; nombreDe: Map<string, string>; ve: boolean; indice: number }) {
  const [hover, setHover] = useState(false);
  const pctProg = cobro.cantidad > 0 ? Math.min(100, Math.round((cobro.programados / cobro.cantidad) * 100)) : 0;
  const unidades = unidadesDe(cobro.modalidad);
  const chip = (texto: string, fondo: string, tinta: string) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: fondo, color: tinta, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{texto}</span>
  );
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: "12px 14px", borderRadius: 14, border: `1px solid ${hover ? `${color}55` : SURFACE.borderMuted}`, background: hover ? `${color}08` : SURFACE.bg,
        transition: "all 200ms ease", transform: hover ? "translateX(2px)" : "none", animation: "fadeUp 0.3s ease both", animationDelay: `${indice * 0.04}s` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: SURFACE.text }}>{cobro.sistema}</span>
            {chip(etiquetaModalidad(cobro.modalidad), `${color}18`, SURFACE.textStrong)}
            {chip(etiquetaFlota(cobro.flota), SURFACE.borderMuted, SURFACE.textSecondary)}
          </div>
          <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: "4px 0 0 18px" }}>
            {cobro.providerIds.length ? cobro.providerIds.map((p) => nombreDe.get(p) ?? "Proveedor").join(" · ") : "Sin proveedor asignado"}
            {ve && <> · {pesos(cobro.clientPrice)} por {cobro.modalidad === "POR_VIAJE" ? "viaje" : "vehículo-día"}</>}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: SURFACE.text, margin: 0, fontVariantNumeric: "tabular-nums" }}>{ve ? pesos(cobro.consumido) : `${cobro.realizados} ${unidades}`}</p>
          <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: "2px 0 0" }}>{ve ? `de ${pesos(cobro.licitado)} licitados` : `de ${cobro.cantidad} licitados`}</p>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: SURFACE.textMuted, marginBottom: 4 }}>
          <span>{cobro.realizados} realizados · {cobro.programados} programados · {cobro.cantidad} licitados ({unidades})</span>
          <span style={{ fontWeight: 700, color }}>{cobro.avance}%</span>
        </div>
        <div style={{ height: 8, background: SURFACE.borderMuted, borderRadius: 99, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pctProg}%`, background: `${color}33`, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${cobro.avance}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)`, borderRadius: 99, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }}>
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", animation: "shimmer 2.5s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
