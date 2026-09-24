"use client";

import { useEffect, useMemo, useState } from "react";
import SelectorFiltro from "@/components/portal/SelectorFiltro";
import { SegmentedFilter } from "@/components/ui/FilterControls";
import { BusIcon, PhoneIcon, RefreshIcon, SearchIcon, WhatsappIcon, XIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import {
  type ConductorDirectorio,
  describirVehiculo,
  ESTADO_CONDUCTOR_LABEL,
  type EstadoConductor,
  estadoDe,
  filtrarConductores,
  inicialesDe,
  type PresenciaConductor,
  saludoWhatsapp,
  vehiculoDe,
} from "@/lib/directorio-conductores";
import { openExternal, whatsappHref } from "@/lib/external-link";
import { useI18n } from "@/lib/i18n";
import { nombrePropio } from "@/lib/nombres";

/**
 * Directorio de conductores para el Coordinador de Transporte (app).
 *
 * Todos los choferes de la plataforma en una lista que se lee de un vistazo:
 * foto o iniciales, nombre, proveedor, vehículo y patente, si está en línea
 * o manejando ahora, y dos botones grandes para llamar o escribir por
 * WhatsApp. Antes el coordinador sólo podía contactar al chofer desde la
 * tarjeta de un traslado concreto.
 */
type Proveedor = { id: string; name?: string | null; type?: string | null };
type Snapshot = { drivers: PresenciaConductor[]; stats?: { onlineNow?: number } };

const REFRESH_MS = 30_000;

const TONO: Record<EstadoConductor, { color: string; bg: string; borde: string }> = {
  EN_VIAJE: { color: "#7c3aed", bg: "rgba(139,92,246,0.12)", borde: "rgba(139,92,246,0.35)" },
  EN_LINEA: { color: BRAND.tealInk, bg: "rgba(33,208,179,0.12)", borde: "rgba(33,208,179,0.35)" },
  SIN_SENAL: { color: STATE.warningText, bg: "rgba(245,158,11,0.12)", borde: "rgba(245,158,11,0.35)" },
  DESCONECTADO: { color: SURFACE.textMuted, bg: SURFACE.borderMuted, borde: SURFACE.border },
};

const ago = (s: number | null, t: (v: string) => string) => {
  if (s == null) return "";
  if (s < 60) return `${t("hace")} ${s}s`;
  if (s < 3600) return `${t("hace")} ${Math.floor(s / 60)} min`;
  if (s < 86400) return `${t("hace")} ${Math.floor(s / 3600)} h`;
  return `${t("hace")} ${Math.floor(s / 86400)} d`;
};

export default function DirectorioConductores({
  eventId,
  nombreCoordinador,
}: {
  eventId?: string | null;
  /** Quién escribe, para que el WhatsApp llegue firmado. */
  nombreCoordinador?: string | null;
}) {
  const { t } = useI18n();
  const [conductores, setConductores] = useState<ConductorDirectorio[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [presencia, setPresencia] = useState<Map<string, PresenciaConductor>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [estado, setEstado] = useState<"" | EstadoConductor>("");

  // Conductores y proveedores: una vez. Presencia: cada 30 s.
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [d, p] = await Promise.all([
          apiFetch<ConductorDirectorio[]>("/drivers"),
          apiFetch<Proveedor[]>("/providers").catch(() => [] as Proveedor[]),
        ]);
        if (!vivo) return;
        setConductores(Array.isArray(d) ? d : []);
        setProveedores(Array.isArray(p) ? p : []);
        setError(null);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : t("No se pudo cargar el directorio."));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [t]);

  const cargarPresencia = async () => {
    setActualizando(true);
    try {
      const q = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
      const snap = await apiFetch<Snapshot>(`/driver-presence/snapshot${q}`);
      setPresencia(new Map((snap?.drivers ?? []).map((d) => [d.driverId, d])));
    } catch {
      // Sin presencia el directorio sigue sirviendo: sólo faltan los estados.
    } finally {
      setActualizando(false);
    }
  };
  useEffect(() => {
    void cargarPresencia();
    const id = window.setInterval(() => void cargarPresencia(), REFRESH_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const proveedorPorId = useMemo(() => new Map(proveedores.map((p) => [p.id, p])), [proveedores]);
  const proveedoresConChoferes = useMemo(() => {
    const ids = new Set(conductores.map((c) => c.providerId).filter(Boolean));
    return proveedores
      .filter((p) => ids.has(p.id))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "es"))
      .map((p) => ({ value: p.id, label: `${p.name ?? p.id} · ${conductores.filter((c) => c.providerId === p.id).length}` }));
  }, [proveedores, conductores]);

  const visibles = useMemo(
    () => filtrarConductores(conductores, presencia, { busqueda, proveedorId, estado }),
    [conductores, presencia, busqueda, proveedorId, estado],
  );

  const resumen = useMemo(() => {
    const activos = conductores.filter((c) => String(c.status ?? "").toUpperCase() !== "DELETED");
    const cuenta = (e: EstadoConductor) => activos.filter((c) => estadoDe(presencia.get(c.id)) === e).length;
    return { total: activos.length, enViaje: cuenta("EN_VIAJE"), enLinea: cuenta("EN_LINEA") };
  }, [conductores, presencia]);

  const llamar = (c: ConductorDirectorio) => {
    if (c.phone) openExternal(`tel:${String(c.phone).replace(/\s+/g, "")}`);
  };
  const escribir = (c: ConductorDirectorio) => {
    if (c.phone) openExternal(whatsappHref(String(c.phone), saludoWhatsapp(c.fullName, nombreCoordinador)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* ── Cabecera con el pulso de la flota ── */}
      <section
        style={{
          borderRadius: 18,
          padding: "16px 16px 14px",
          background: "linear-gradient(135deg, #0f766e 0%, #115e59 55%, #134e4a 100%)",
          color: SURFACE.card,
          boxShadow: "0 10px 30px rgba(15,118,110,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", margin: 0 }}>
              {t("Coordinación de transporte")}
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "2px 0 0", color: SURFACE.card }}>{t("Conductores")}</h2>
          </div>
          <button
            type="button"
            onClick={() => void cargarPresencia()}
            title={t("Actualizar estados")}
            style={{
              width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.12)", color: SURFACE.card, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            <RefreshIcon size={15} style={{ animation: actualizando ? "spin 1s linear infinite" : undefined }} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
          {[
            { label: t("Conductores"), valor: resumen.total, punto: "rgba(255,255,255,0.7)" },
            { label: t("En viaje"), valor: resumen.enViaje, punto: "#c4b5fd" },
            { label: t("En línea"), valor: resumen.enLinea, punto: BRAND.tealLight },
          ].map((k) => (
            <div key={k.label} style={{ background: "rgba(255,255,255,0.10)", borderRadius: 12, padding: "10px 12px" }}>
              <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", margin: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: k.punto, flexShrink: 0 }} />
                {k.label}
              </p>
              <p style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 0", lineHeight: 1.1, fontVariantNumeric: "tabular-nums", color: SURFACE.card }}>{k.valor}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Buscador y filtros ── */}
      <section style={{ background: SURFACE.card, borderRadius: 14, border: `1px solid ${SURFACE.border}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <SearchIcon size={15} color={SURFACE.textFaint} strokeWidth={2} style={{ position: "absolute", top: "50%", left: 12, transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            className="input"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={t("Nombre, patente o teléfono…")}
            style={{ width: "100%", paddingLeft: 36, paddingRight: busqueda ? 36 : 12, borderRadius: 12 }}
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} aria-label={t("Limpiar")}
              style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", width: 24, height: 24, borderRadius: 99, border: "none", background: SURFACE.borderMuted, color: SURFACE.textMuted, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <XIcon size={12} />
            </button>
          )}
        </div>
        <SegmentedFilter
          value={estado}
          onChange={(v) => setEstado(v as "" | EstadoConductor)}
          options={[
            { value: "", label: t("Todos") },
            { value: "EN_VIAJE", label: t("En viaje") },
            { value: "EN_LINEA", label: t("En línea") },
            { value: "DESCONECTADO", label: t("Desconectados") },
          ]}
        />
        {proveedoresConChoferes.length > 1 && (
          <SelectorFiltro
            rotulo={t("Proveedor")}
            titulo={t("Proveedor de transporte")}
            opciones={proveedoresConChoferes}
            etiquetaTodos={t("Todos los proveedores")}
            valor={proveedorId}
            onChange={setProveedorId}
          />
        )}
        <p style={{ fontSize: 11.5, color: SURFACE.textFaint, margin: 0 }}>
          {visibles.length} {visibles.length === 1 ? t("conductor") : t("conductores")}
          {busqueda || proveedorId || estado ? ` · ${t("con el filtro")}` : ""}
        </p>
      </section>

      {/* ── Lista ── */}
      {cargando && <p style={{ fontSize: 13, color: SURFACE.textMuted, textAlign: "center", padding: 20 }}>{t("Cargando conductores…")}</p>}
      {error && <p style={{ fontSize: 13, color: STATE.danger, textAlign: "center", padding: 20 }}>{error}</p>}
      {!cargando && !error && visibles.length === 0 && (
        <div style={{ borderRadius: 14, border: `1px dashed ${SURFACE.border}`, padding: "28px 16px", textAlign: "center", color: SURFACE.textMuted, fontSize: 13 }}>
          {conductores.length === 0 ? t("No hay conductores registrados.") : t("Ningún conductor coincide con el filtro.")}
        </div>
      )}

      {visibles.map((c) => {
        const p = presencia.get(c.id);
        const est = estadoDe(p);
        const tono = TONO[est];
        const prov = c.providerId ? proveedorPorId.get(c.providerId) : null;
        const vehiculo = describirVehiculo(vehiculoDe(c.metadata));
        const foto = typeof c.photoUrl === "string" && c.photoUrl.startsWith("http") ? c.photoUrl : null;
        const tel = c.phone ? String(c.phone).trim() : "";
        return (
          <article
            key={c.id}
            style={{
              background: SURFACE.card,
              borderRadius: 16,
              border: `1px solid ${SURFACE.border}`,
              borderLeft: `4px solid ${tono.color}`,
              boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
              padding: "12px 12px 12px 14px",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {/* Avatar con el punto de estado encima */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                {foto ? (
                  <img src={foto} alt="" style={{ width: 52, height: 52, borderRadius: 16, objectFit: "cover", border: `2px solid ${tono.borde}` }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${BRAND.teal}, #14AE98)`, color: SURFACE.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, letterSpacing: "0.02em" }}>
                    {inicialesDe(c.fullName)}
                  </div>
                )}
                <span style={{ position: "absolute", right: -3, bottom: -3, width: 14, height: 14, borderRadius: "50%", background: tono.color, border: `2px solid ${SURFACE.card}` }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: SURFACE.text, margin: 0, lineHeight: 1.2 }}>{nombrePropio(c.fullName) || t("Conductor")}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 99, background: tono.bg, border: `1px solid ${tono.borde}`, color: tono.color }}>
                    {t(ESTADO_CONDUCTOR_LABEL[est])}
                  </span>
                  {p && est !== "EN_VIAJE" && p.secondsSinceSeen != null && (
                    <span style={{ fontSize: 11, color: SURFACE.textFaint }}>{ago(p.secondsSinceSeen, t)}</span>
                  )}
                  {p && p.dayTripCount > 0 && (
                    <span style={{ fontSize: 11, color: SURFACE.textMuted }}>· {p.dayTripCount} {p.dayTripCount === 1 ? t("viaje hoy") : t("viajes hoy")}</span>
                  )}
                </div>
                {prov?.name && (
                  <p style={{ fontSize: 12, fontWeight: 700, color: BRAND.tealInk, margin: "5px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prov.name}</p>
                )}
                {vehiculo && (
                  <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: SURFACE.textMuted, margin: "3px 0 0" }}>
                    <BusIcon size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vehiculo}</span>
                  </p>
                )}
                <p style={{ fontSize: 12.5, color: tel ? SURFACE.textSecondary : SURFACE.textFaint, margin: "3px 0 0", fontVariantNumeric: "tabular-nums" }}>
                  {tel || t("Sin teléfono registrado")}
                </p>
              </div>
            </div>

            {/* Llamar y WhatsApp: los dos del mismo tamaño, para el pulgar. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                disabled={!tel}
                onClick={() => llamar(c)}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "11px 12px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: tel ? "pointer" : "not-allowed",
                  border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.text, opacity: tel ? 1 : 0.45,
                }}
              >
                <PhoneIcon size={15} strokeWidth={2.2} /> {t("Llamar")}
              </button>
              <button
                type="button"
                disabled={!tel}
                onClick={() => escribir(c)}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "11px 12px", borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: tel ? "pointer" : "not-allowed",
                  border: "none", background: tel ? "linear-gradient(135deg, #25D366, #128C7E)" : SURFACE.borderMuted, color: SURFACE.card, opacity: tel ? 1 : 0.6,
                  boxShadow: tel ? "0 6px 16px rgba(37,211,102,0.28)" : "none",
                }}
              >
                <WhatsappIcon size={15} /> WhatsApp
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
