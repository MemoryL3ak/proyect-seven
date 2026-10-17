"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StyledSelect from "@/components/StyledSelect";
import { apiDownload, apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { archivosDePersona, guardarBlob, urlDeDescarga } from "@/lib/descarga-documentos";
import {
  cumpleFiltroDocumentacion,
  cumpleFiltroTipo,
  documentacionDe,
  ESTADO_DOCUMENTACION_LABEL,
  type EstadoDocumentacion,
  type FiltroDocumentacion,
  type FiltroTipoPersona,
  OPCIONES_FILTRO_DOCUMENTACION,
  planillaDocumentacion,
  TIPO_PERSONA_LABEL,
  tipoDePersona,
} from "@/lib/documentos-personas";
import { DownloadIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";
import { useEventoActivo } from "@/lib/evento-activo-provider";
import { proveedorEnEvento } from "@/lib/conductores-del-evento";
import { personaQuitadaDelEvento } from "@/lib/proveedores-evento";

/**
 * Documentación recibida de las personas de los proveedores: quién subió qué
 * y, sobre todo, quién no ha subido nada. Los conductores son participantes
 * de proveedores de transporte y sus archivos van en la metadata de la ficha,
 * así que hasta ahora la única forma de saberlo era abrir cada ficha en
 * Registro → Proveedores.
 */
type Proveedor = { id: string; name: string; type?: string | null; eventIds?: string[] | null };
type Persona = {
  id: string;
  providerId: string;
  fullName: string;
  rut?: string | null;
  phone?: string | null;
  userType?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

const COLOR_ESTADO: Record<EstadoDocumentacion, { bg: string; border: string; color: string }> = {
  SIN_DOCUMENTOS: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", color: STATE.dangerText },
  INCOMPLETA: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.35)", color: STATE.warningText },
  COMPLETA: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.3)", color: STATE.successText },
  NO_APLICA: { bg: SURFACE.borderMuted, border: SURFACE.border, color: SURFACE.textMuted },
};

const etiqueta: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: SURFACE.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4,
};

const fechaCorta = (d: Date | null) =>
  d ? d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

export default function DocumentacionPersonas() {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const { eventoId } = useEventoActivo();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [tipo, setTipo] = useState<FiltroTipoPersona>("");
  // Arranca en "pendientes": la pregunta que trae al módulo es quién falta.
  const [documentos, setDocumentos] = useState<FiltroDocumentacion>("PENDIENTE");
  // Persona cuyo .zip se está bajando, y el último error de descarga.
  const [bajando, setBajando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  /**
   * Todos los documentos de la persona en un .zip (17-10-2026, pedido de
   * Ariel). Lo arma el backend; el navegador lo guarda con el nombre que
   * manda el servidor.
   */
  const descargarTodo = async (p: Persona) => {
    if (bajando) return;
    setBajando(p.id);
    setErrorDescarga(null);
    try {
      const { blob, fileName } = await apiDownload(`/provider-participants/${p.id}/documentos.zip`);
      guardarBlob(blob, fileName || `documentos_${p.fullName.replace(/\s+/g, "-")}.zip`);
    } catch (e) {
      setErrorDescarga(`${p.fullName}: ${e instanceof Error ? e.message : t("No se pudo descargar.")}`);
    } finally {
      setBajando(null);
    }
  };

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const [pp, pr] = await Promise.all([
          apiFetch<Persona[]>("/provider-participants"),
          apiFetch<Proveedor[]>("/providers").catch(() => [] as Proveedor[]),
        ]);
        if (!vivo) return;
        setPersonas(Array.isArray(pp) ? pp : []);
        setProveedores(Array.isArray(pr) ? pr : []);
        setError(null);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : t("No se pudo cargar la documentación."));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [t]);

  const proveedorPorId = useMemo(() => new Map(proveedores.map((p) => [p.id, p])), [proveedores]);

  /**
   * Sólo los proveedores de transporte (su gente sube documentos) y del evento
   * activo: con World Rugby creado se veía a toda la gente de los Juegos
   * Escolares. El proveedor ya elegido se conserva en el desplegable.
   */
  const proveedoresConDocs = useMemo(
    () =>
      proveedores.filter(
        (p) =>
          String(p.type ?? "").toUpperCase() === "TRANSPORTE" &&
          (p.id === proveedor || proveedorEnEvento(p, eventoId)),
      ),
    [proveedores, proveedor, eventoId],
  );

  /** La gente de los proveedores del evento activo, menos la quitada de él. */
  const personasDelEvento = useMemo(
    () =>
      personas.filter(
        (p) => proveedorEnEvento(proveedorPorId.get(p.providerId), eventoId) && !personaQuitadaDelEvento(p, eventoId),
      ),
    [personas, proveedorPorId, eventoId],
  );

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return personasDelEvento
      .map((p) => {
        const prov = proveedorPorId.get(p.providerId) ?? null;
        return { p, prov, doc: documentacionDe(p, prov?.type) };
      })
      .filter(({ p, prov, doc }) => {
        if (doc.estado === "NO_APLICA") return false;
        if (String(p.status ?? "").toUpperCase() === "INACTIVE") return false;
        if (proveedor && p.providerId !== proveedor) return false;
        if (!cumpleFiltroTipo(p, tipo)) return false;
        if (!cumpleFiltroDocumentacion(doc.estado, documentos)) return false;
        if (q && !(p.fullName ?? "").toLowerCase().includes(q) && !(p.rut ?? "").toLowerCase().includes(q) && !(prov?.name ?? "").toLowerCase().includes(q)) return false;
        return true;
      })
      // Primero quien no tiene nada, después incompletos, después completos; dentro, por nombre.
      .sort((a, b) => {
        const orden: Record<EstadoDocumentacion, number> = { SIN_DOCUMENTOS: 0, INCOMPLETA: 1, COMPLETA: 2, NO_APLICA: 3 };
        return orden[a.doc.estado] - orden[b.doc.estado] || (a.p.fullName ?? "").localeCompare(b.p.fullName ?? "", "es");
      });
  }, [personasDelEvento, proveedorPorId, busqueda, proveedor, tipo, documentos]);

  /**
   * Descarga lo que se ve: con los filtros aplicados, una fila por persona y
   * una columna por documento. La librería de Excel se carga recién al tocar
   * el botón.
   */
  const exportar = async () => {
    if (filas.length === 0) return;
    const { downloadExcel } = await import("@/lib/reports");
    const { headers, rows } = planillaDocumentacion(
      filas.map(({ p, prov, doc }) => ({
        nombre: p.fullName,
        rut: p.rut,
        telefono: p.phone,
        proveedor: prov?.name ?? null,
        tipo: tipoDePersona(p),
        doc,
      })),
    );
    const partes = [
      proveedor ? proveedorPorId.get(proveedor)?.name : null,
      tipo === "CONDUCTOR" ? "conductores" : tipo === "OTRO" ? "otros" : null,
      documentos === "PENDIENTE" ? "pendientes" : documentos ? documentos.toLowerCase() : null,
    ].filter(Boolean);
    const sufijo = [...partes, new Date().toISOString().slice(0, 10)].join("_").replace(/\s+/g, "-");
    downloadExcel(`documentacion_${sufijo}`, [{ title: "Documentación", headers, rows }]);
  };

  const resumen = useMemo(() => {
    const r = { total: 0, sin: 0, incompleta: 0, completa: 0 };
    for (const p of personasDelEvento) {
      const prov = proveedorPorId.get(p.providerId);
      const d = documentacionDe(p, prov?.type);
      if (d.estado === "NO_APLICA" || String(p.status ?? "").toUpperCase() === "INACTIVE") continue;
      r.total += 1;
      if (d.estado === "SIN_DOCUMENTOS") r.sin += 1;
      else if (d.estado === "INCOMPLETA") r.incompleta += 1;
      else r.completa += 1;
    }
    return r;
  }, [personasDelEvento, proveedorPorId]);

  return (
    <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${SURFACE.border}` }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.tealInk, marginBottom: 4 }}>
          {t("Documentación recibida")}
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: SURFACE.text, margin: 0 }}>{t("Quién ha subido sus documentos")}</h2>
        <p style={{ fontSize: 12.5, color: SURFACE.textMuted, marginTop: 4 }}>
          {t("Personas de los proveedores de transporte: al conductor se le piden sus documentos y los del vehículo; al resto, sólo los personales.")}
        </p>

        {/* Resumen: tres números para saber cómo va la recolección. */}
        <div className="mobile-strip md:grid md:grid-cols-4 gap-3 mt-4" style={{ "--strip-w": "150px" } as React.CSSProperties}>
          {[
            { label: t("Personas"), value: resumen.total, color: SURFACE.text },
            { label: t("Sin documentos"), value: resumen.sin, color: STATE.dangerText },
            { label: t("Incompletas"), value: resumen.incompleta, color: STATE.warningText },
            { label: t("Completas"), value: resumen.completa, color: STATE.successText },
          ].map((k) => (
            <div key={k.label} style={{ background: SURFACE.bg, border: `1px solid ${SURFACE.borderMuted}`, borderRadius: 12, padding: "10px 14px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SURFACE.textFaint, margin: 0 }}>{k.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: "2px 0 0" }}>{k.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 14, gridTemplateColumns: isMobile ? "1fr" : "2fr repeat(3, minmax(160px, 1fr)) auto", alignItems: "end" }}>
          <label className="text-sm block" style={{ minWidth: 0 }}>
            <span style={etiqueta}>{t("Buscar")}</span>
            <input className="input" style={{ width: "100%" }} placeholder={t("Nombre, RUT o proveedor…")} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </label>
          <label className="text-sm block" style={{ minWidth: 0 }}>
            <span style={etiqueta}>{t("Tipo")}</span>
            <StyledSelect value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipoPersona)}>
              <option value="">{t("Todos")}</option>
              <option value="CONDUCTOR">{t("Conductores")}</option>
              <option value="OTRO">{t("Otros participantes")}</option>
            </StyledSelect>
          </label>
          <label className="text-sm block" style={{ minWidth: 0 }}>
            <span style={etiqueta}>{t("Proveedor")}</span>
            <StyledSelect value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
              <option value="">{t("Todos")}</option>
              {proveedoresConDocs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </StyledSelect>
          </label>
          <label className="text-sm block" style={{ minWidth: 0 }}>
            <span style={etiqueta}>{t("Documentos")}</span>
            <StyledSelect value={documentos} onChange={(e) => setDocumentos(e.target.value as FiltroDocumentacion)}>
              {OPCIONES_FILTRO_DOCUMENTACION.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </StyledSelect>
          </label>
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={filas.length === 0}
            title={t("Descarga la lista con los filtros aplicados")}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
              height: 40, padding: "0 16px", borderRadius: 10, whiteSpace: "nowrap",
              border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: SURFACE.textSecondary,
              fontSize: 13, fontWeight: 700, cursor: filas.length === 0 ? "not-allowed" : "pointer", opacity: filas.length === 0 ? 0.5 : 1,
            }}
          >
            <DownloadIcon size={14} /> {t("Exportar")} ({filas.length})
          </button>
        </div>
      </div>

      {cargando && <p style={{ padding: 20, fontSize: 13, color: SURFACE.textMuted }}>{t("Cargando...")}</p>}
      {error && <p style={{ padding: 20, fontSize: 13, color: STATE.danger }}>{error}</p>}
      {errorDescarga && (
        <p role="alert" style={{ margin: "12px 20px 0", padding: "8px 12px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: STATE.dangerSoft, color: STATE.dangerText, border: `1px solid ${STATE.dangerBorder}` }}>
          {errorDescarga}
        </p>
      )}
      {!cargando && !error && filas.length === 0 && (
        <p style={{ padding: 20, fontSize: 13, color: SURFACE.textMuted }}>
          {resumen.total === 0 ? t("No hay personas de proveedores de transporte registradas.") : t("Nadie coincide con el filtro.")}
        </p>
      )}

      {!cargando && filas.length > 0 && (
        <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", minWidth: 960, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${SURFACE.border}`, background: SURFACE.bg }}>
                {[t("Persona"), t("Proveedor"), t("Tipo"), t("Documentos"), t("Faltan"), t("Última subida"), t("Descargar")].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: SURFACE.textFaint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(({ p, prov, doc }) => {
                const c = COLOR_ESTADO[doc.estado];
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
                    <td style={{ padding: "10px 14px" }}>
                      <Link href={`/registro/proveedores?buscar=${encodeURIComponent(p.fullName)}`} title={t("Abrir en Registro → Proveedores")} style={{ fontWeight: 700, color: SURFACE.text, textDecoration: "none" }}>
                        {p.fullName}
                      </Link>
                      {p.rut && <p style={{ fontSize: 11, color: SURFACE.textMuted, margin: 0 }}>{p.rut}</p>}
                    </td>
                    <td style={{ padding: "10px 14px", color: SURFACE.textMuted }}>{prov?.name ?? "—"}</td>
                    <td style={{ padding: "10px 14px", color: SURFACE.textMuted }}>{t(TIPO_PERSONA_LABEL[tipoDePersona(p)])}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: c.bg, border: `1px solid ${c.border}`, color: c.color, whiteSpace: "nowrap" }}>
                        {doc.subidos.length}/{doc.requeridos.length} · {t(ESTADO_DOCUMENTACION_LABEL[doc.estado])}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: SURFACE.textMuted, maxWidth: 320 }}>
                      {doc.faltantes.length === 0
                        ? "—"
                        : doc.faltantes.length === doc.requeridos.length
                          ? t("Todos")
                          : doc.faltantes.map((d) => t(d.label)).join(", ")}
                    </td>
                    <td style={{ padding: "10px 14px", color: SURFACE.textMuted, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fechaCorta(doc.ultimaSubida)}</td>
                    <td style={{ padding: "10px 14px", minWidth: 220, maxWidth: 360 }}>
                      {(() => {
                        // Un botón por documento y otro con todos en un .zip.
                        const archivos = archivosDePersona(p, prov?.type);
                        if (archivos.length === 0) return <span style={{ color: SURFACE.textFaint }}>—</span>;
                        const estaBajando = bajando === p.id;
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => void descargarTodo(p)}
                              disabled={Boolean(bajando)}
                              title={t("Descarga todos sus documentos en un .zip")}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, border: "none",
                                background: `linear-gradient(135deg,${BRAND.teal},#14AE98)`, color: SURFACE.card,
                                fontSize: 11, fontWeight: 700, cursor: bajando ? "wait" : "pointer", opacity: bajando && !estaBajando ? 0.6 : 1, whiteSpace: "nowrap",
                              }}
                            >
                              <DownloadIcon size={12} /> {estaBajando ? t("Armando .zip…") : `${t("Todo")} (${archivos.length})`}
                            </button>
                            {archivos.map((a) => (
                              <a
                                key={a.key}
                                href={urlDeDescarga(a.url, a.nombre)}
                                download={a.nombre}
                                title={`${t("Descargar")} ${t(a.label)}`}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99,
                                  border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.textSecondary,
                                  fontSize: 11, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap",
                                }}
                              >
                                <DownloadIcon size={11} /> {t(a.label)}
                              </a>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
