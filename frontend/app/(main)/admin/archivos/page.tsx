"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { useI18n } from "@/lib/i18n";
import { useIsMobile } from "@/lib/useIsMobile";
import { formatFileSize } from "@/lib/event-documents";
import StyledSelect from "@/components/StyledSelect";
import { FileTextIcon, DownloadIcon } from "@/components/ui/Icons";

/**
 * Administración → Archivos cargados. Todo lo que se ha subido a la
 * plataforma en una sola lista: fotos de hoteles, recintos, conductores y
 * participantes, documentos de conductores, proveedores y del evento, fichas
 * médicas. Cada archivo dice a qué registro pertenece y si sigue existiendo.
 */

type TipoArchivo = "FOTO" | "DOCUMENTO" | "OTRO";
type EstadoArchivo = "REFERENCIADO" | "HUERFANO" | "ROTO" | "SIN_VERIFICAR";

type Archivo = {
  bucket: string;
  path: string;
  nombre: string;
  url: string;
  tipo: TipoArchivo;
  categoria: string;
  entidadTipo: string | null;
  entidadId: string | null;
  entidadNombre: string | null;
  entidadRuta: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  creadoEn: string | null;
  estado: EstadoArchivo;
};

type Inventario = {
  generadoEn: string;
  storageVerificado: boolean;
  total: number;
  totalBytes: number;
  buckets: { bucket: string; total: number; bytes: number; huerfanos: number; rotos: number }[];
  archivos: Archivo[];
};

const BUCKET_LABELS: Record<string, string> = {
  "venue-photos": "Fotos de hoteles y recintos",
  "athlete-photos": "Fotos de participantes",
  "athlete-health-docs": "Documentos médicos",
  "driver-photos": "Fotos de conductores",
  "driver-documents": "Documentos de conductores",
  "provider-documents": "Documentos de proveedores",
  "event-documents": "Documentos del evento",
};

const TIPO_LABELS: Record<TipoArchivo, string> = { FOTO: "Foto", DOCUMENTO: "Documento", OTRO: "Otro" };

const ESTADOS: Record<EstadoArchivo, { label: string; bg: string; border: string; color: string; ayuda: string }> = {
  REFERENCIADO: { label: "En uso", bg: STATE.successSoft, border: STATE.successBorder, color: STATE.successText, ayuda: "Un registro apunta a este archivo y el archivo existe." },
  HUERFANO: { label: "Sin referencia", bg: STATE.warningSoft, border: STATE.warningBorder, color: STATE.warningText, ayuda: "Está en el almacenamiento pero ningún registro lo usa: una versión reemplazada o de un registro borrado." },
  ROTO: { label: "Archivo faltante", bg: STATE.dangerSoft, border: STATE.dangerBorder, color: STATE.dangerText, ayuda: "Un registro apunta a este archivo pero ya no está en el almacenamiento." },
  SIN_VERIFICAR: { label: "Sin verificar", bg: SURFACE.bg, border: SURFACE.border, color: SURFACE.textMuted, ayuda: "No se pudo leer el almacenamiento; sólo se muestra lo que dicen los registros." },
};

const POR_PAGINA = 50;

const tamano = (bytes?: number | null) => formatFileSize(bytes) ?? "—";

const formatFecha = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
};

export default function AdminArchivosPage() {
  const { t } = useI18n();
  // Filtros con estilos inline: en teléfono cada select ocupa el ancho completo.
  const isMobile = useIsMobile();
  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [bucket, setBucket] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(0);
  const [vistaPrevia, setVistaPrevia] = useState<Archivo | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setInventario(await apiFetch<Inventario>("/admin/files"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar el inventario de archivos"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const archivos = useMemo(() => inventario?.archivos ?? [], [inventario]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return archivos.filter((a) => {
      if (bucket && a.bucket !== bucket) return false;
      if (tipo && a.tipo !== tipo) return false;
      if (estado && a.estado !== estado) return false;
      if (!q) return true;
      return [a.nombre, a.path, a.categoria, a.entidadNombre ?? "", a.entidadTipo ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [archivos, busqueda, bucket, tipo, estado]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = filtrados.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  const conteo = (e: EstadoArchivo) => archivos.filter((a) => a.estado === e).length;

  const exportarExcel = async () => {
    const XLSX = await import("xlsx");
    const filas = filtrados.map((a) => ({
      [t("Nombre")]: a.nombre,
      [t("Categoría")]: a.categoria,
      [t("Tipo")]: TIPO_LABELS[a.tipo],
      [t("Registro")]: a.entidadNombre ?? "",
      [t("Tipo de registro")]: a.entidadTipo ?? "",
      [t("Estado")]: ESTADOS[a.estado].label,
      [t("Almacén")]: BUCKET_LABELS[a.bucket] ?? a.bucket,
      [t("Ruta")]: `${a.bucket}/${a.path}`,
      [t("Tamaño (bytes)")]: a.sizeBytes ?? "",
      [t("Subido")]: a.creadoEn ?? "",
      [t("URL")]: a.url,
    }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), t("Archivos"));
    XLSX.writeFile(libro, `archivos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tile = (label: string, value: string, color?: string) => (
    <div key={label} style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 14, padding: "12px 16px", minWidth: 150 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: SURFACE.textFaint, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: color ?? SURFACE.text, margin: "4px 0 0", fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );

  const chipEstado = (e: EstadoArchivo) => {
    const s = ESTADOS[e];
    return (
      <span title={t(s.ayuda)} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: s.bg, border: `1px solid ${s.border}`, color: s.color, whiteSpace: "nowrap" }}>
        {t(s.label)}
      </span>
    );
  };

  const th = (label: string) => (
    <th key={label} style={{ textAlign: "left", padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: SURFACE.textFaint, borderBottom: `1px solid ${SURFACE.border}`, whiteSpace: "nowrap" }}>
      {t(label)}
    </th>
  );

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.teal, margin: 0 }}>{t("Administración")}</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: SURFACE.text, margin: "2px 0 0" }}>{t("Archivos cargados")}</h1>
          <p style={{ fontSize: 12.5, color: SURFACE.textMuted, margin: "4px 0 0", maxWidth: 720 }}>
            {t("Todas las fotos y documentos subidos a la plataforma, con el registro al que pertenecen y si el archivo sigue existiendo en el almacenamiento.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-xs font-bold rounded-lg"
            style={{ padding: "7px 14px", background: SURFACE.card, color: SURFACE.textSecondary, border: `1px solid ${SURFACE.borderStrong}`, cursor: loading ? "wait" : "pointer" }}
          >
            {loading ? t("Cargando…") : t("Actualizar")}
          </button>
          <button
            type="button"
            onClick={() => void exportarExcel()}
            disabled={filtrados.length === 0}
            className="inline-flex items-center gap-1 text-xs font-bold rounded-lg"
            style={{ padding: "7px 14px", background: SURFACE.card, color: SURFACE.textSecondary, border: `1px solid ${SURFACE.borderStrong}`, cursor: filtrados.length === 0 ? "not-allowed" : "pointer", opacity: filtrados.length === 0 ? 0.6 : 1 }}
          >
            <DownloadIcon size={14} className="inline mr-1" />{t("Exportar Excel")}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 12, background: STATE.dangerSoft, border: `1px solid ${STATE.dangerBorder}`, color: STATE.dangerText, fontSize: 13 }}>
          {error}
        </div>
      )}

      {inventario && !inventario.storageVerificado && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 12, background: STATE.warningSoft, border: `1px solid ${STATE.warningBorder}`, color: STATE.warningText, fontSize: 13 }}>
          {t("No se pudo leer el almacenamiento: se muestran sólo los archivos que los registros nombran, sin verificar que existan.")}
        </div>
      )}

      {inventario && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {tile(t("Archivos"), String(inventario.total))}
          {tile(t("Espacio usado"), tamano(inventario.totalBytes))}
          {tile(t("Fotos"), String(archivos.filter((a) => a.tipo === "FOTO").length))}
          {tile(t("Documentos"), String(archivos.filter((a) => a.tipo === "DOCUMENTO").length))}
          {tile(t("Sin referencia"), String(conteo("HUERFANO")), conteo("HUERFANO") ? STATE.warningText : undefined)}
          {tile(t("Faltantes"), String(conteo("ROTO")), conteo("ROTO") ? STATE.dangerText : undefined)}
        </div>
      )}

      {inventario && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {inventario.buckets.filter((b) => b.total > 0).map((b) => (
            <button
              key={b.bucket}
              type="button"
              onClick={() => { setBucket(bucket === b.bucket ? "" : b.bucket); setPagina(0); }}
              style={{
                fontSize: 12, padding: "6px 10px", borderRadius: 99, cursor: "pointer",
                background: bucket === b.bucket ? "rgba(33,208,179,0.10)" : SURFACE.card,
                border: `1px solid ${bucket === b.bucket ? BRAND.teal : SURFACE.border}`,
                color: bucket === b.bucket ? BRAND.tealInk : SURFACE.textSecondary,
              }}
            >
              {`${t(BUCKET_LABELS[b.bucket] ?? b.bucket)} · ${b.total} · ${tamano(b.bytes)}`}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
        <label className="text-sm block" style={{ flex: 1, minWidth: 220 }}>
          <span className="block mb-1" style={{ fontSize: 12, color: SURFACE.textMuted }}>{t("Buscar")}</span>
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }}
            placeholder={t("Nombre, registro, categoría o ruta")}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, color: SURFACE.text, fontSize: 13 }}
          />
        </label>
        <label className="text-sm block" style={{ minWidth: 200, flex: isMobile ? "1 1 200px" : undefined }}>
          <span className="block mb-1" style={{ fontSize: 12, color: SURFACE.textMuted }}>{t("Almacén")}</span>
          <StyledSelect value={bucket} onChange={(e) => { setBucket(e.target.value); setPagina(0); }}>
            <option value="">{t("Todos")}</option>
            {Object.entries(BUCKET_LABELS).map(([id, label]) => (
              <option key={id} value={id}>{t(label)}</option>
            ))}
          </StyledSelect>
        </label>
        <label className="text-sm block" style={{ minWidth: 150, flex: isMobile ? "1 1 150px" : undefined }}>
          <span className="block mb-1" style={{ fontSize: 12, color: SURFACE.textMuted }}>{t("Tipo")}</span>
          <StyledSelect value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(0); }}>
            <option value="">{t("Todos")}</option>
            {(Object.keys(TIPO_LABELS) as TipoArchivo[]).map((k) => (
              <option key={k} value={k}>{t(TIPO_LABELS[k])}</option>
            ))}
          </StyledSelect>
        </label>
        <label className="text-sm block" style={{ minWidth: 170, flex: isMobile ? "1 1 150px" : undefined }}>
          <span className="block mb-1" style={{ fontSize: 12, color: SURFACE.textMuted }}>{t("Estado")}</span>
          <StyledSelect value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(0); }}>
            <option value="">{t("Todos")}</option>
            {(Object.keys(ESTADOS) as EstadoArchivo[]).map((k) => (
              <option key={k} value={k}>{t(ESTADOS[k].label)}</option>
            ))}
          </StyledSelect>
        </label>
        {(busqueda || bucket || tipo || estado) && (
          <button
            type="button"
            onClick={() => { setBusqueda(""); setBucket(""); setTipo(""); setEstado(""); setPagina(0); }}
            style={{ border: `1px solid ${SURFACE.border}`, borderRadius: 8, background: SURFACE.card, color: SURFACE.textMuted, padding: "9px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
          >
            {t("Limpiar filtros")}
          </button>
        )}
      </div>

      <div style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: 14, overflow: "hidden" }}>
        {loading && !inventario ? (
          <p style={{ padding: 32, textAlign: "center", color: SURFACE.textMuted, fontSize: 13 }}>{t("Leyendo los registros y el almacenamiento…")}</p>
        ) : filtrados.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: SURFACE.textMuted, fontSize: 13 }}>
            {archivos.length === 0 ? t("No hay archivos cargados.") : t("Ningún archivo coincide con los filtros.")}
          </p>
        ) : (
          <div style={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>{["", "Archivo", "Categoría", "Registro", "Tamaño", "Subido", "Estado", ""].map((h, i) => (h ? th(h) : <th key={`v${i}`} style={{ borderBottom: `1px solid ${SURFACE.border}` }} />))}</tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={`${a.bucket}/${a.path}`} style={{ borderBottom: `1px solid ${SURFACE.borderMuted}` }}>
                    <td style={{ padding: "8px 12px", width: 52 }}>
                      {a.tipo === "FOTO" && a.estado !== "ROTO" ? (
                        <button type="button" onClick={() => setVistaPrevia(a)} title={t("Ver foto")} style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer" }}>
                          <img src={a.url} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: `1px solid ${SURFACE.border}`, display: "block" }} />
                        </button>
                      ) : (
                        <span style={{ width: 40, height: 40, borderRadius: 8, border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <FileTextIcon size={16} color={SURFACE.textFaint} />
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", maxWidth: 320 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: SURFACE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.nombre}>{a.nombre}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: SURFACE.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${a.bucket}/${a.path}`}>{`${a.bucket}/${a.path}`}</p>
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <p style={{ margin: 0, color: SURFACE.text }}>{t(a.categoria)}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: SURFACE.textFaint }}>{t(TIPO_LABELS[a.tipo])}{a.contentType ? ` · ${a.contentType}` : ""}</p>
                    </td>
                    <td style={{ padding: "8px 12px", maxWidth: 240 }}>
                      {a.entidadNombre ? (
                        a.entidadRuta ? (
                          <Link href={a.entidadRuta} style={{ color: BRAND.tealInk, fontWeight: 600, textDecoration: "none" }} title={t("Abrir el módulo donde vive este registro")}>{a.entidadNombre}</Link>
                        ) : (
                          <span style={{ color: SURFACE.text }}>{a.entidadNombre}</span>
                        )
                      ) : (
                        <span style={{ color: SURFACE.textFaint }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: SURFACE.textSecondary, fontVariantNumeric: "tabular-nums" }}>{tamano(a.sizeBytes)}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap", color: SURFACE.textSecondary }}>{formatFecha(a.creadoEn)}</td>
                    <td style={{ padding: "8px 12px" }}>{chipEstado(a.estado)}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {a.estado !== "ROTO" && (
                        <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: BRAND.tealInk, textDecoration: "none" }}>
                          {t("Abrir")}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtrados.length > POR_PAGINA && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderTop: `1px solid ${SURFACE.border}`, fontSize: 12, color: SURFACE.textMuted }}>
            <span>{`${paginaActual * POR_PAGINA + 1}–${Math.min((paginaActual + 1) * POR_PAGINA, filtrados.length)} ${t("de")} ${filtrados.length}`}</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, cursor: paginaActual === 0 ? "not-allowed" : "pointer", opacity: paginaActual === 0 ? 0.5 : 1 }}>{t("Anterior")}</button>
              <button type="button" disabled={paginaActual >= totalPaginas - 1} onClick={() => setPagina(paginaActual + 1)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, cursor: paginaActual >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: paginaActual >= totalPaginas - 1 ? 0.5 : 1 }}>{t("Siguiente")}</button>
            </span>
          </div>
        )}
      </div>

      {inventario && (
        <p style={{ fontSize: 11, color: SURFACE.textFaint, margin: "10px 0 0" }}>
          {t("Inventario generado")} {formatFecha(inventario.generadoEn)}. {t("Las imágenes de cupones no aparecen: se guardan dentro del propio cupón, no como archivo.")}
        </p>
      )}

      {vistaPrevia && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setVistaPrevia(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 12 : 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE.card, borderRadius: 16, padding: isMobile ? 10 : 16, maxWidth: isMobile ? "calc(100vw - 24px)" : "90vw", maxHeight: isMobile ? "calc(100dvh - 24px)" : "90vh", display: "flex", flexDirection: "column", gap: 10 }}>
            <img src={vistaPrevia.url} alt={vistaPrevia.nombre} style={{ maxWidth: isMobile ? "100%" : "85vw", maxHeight: isMobile ? "calc(100dvh - 120px)" : "75vh", objectFit: "contain", borderRadius: 10 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, fontSize: 12, color: SURFACE.textMuted }}>
              <span>{t(vistaPrevia.categoria)}{vistaPrevia.entidadNombre ? ` · ${vistaPrevia.entidadNombre}` : ""}</span>
              <button type="button" onClick={() => setVistaPrevia(null)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${SURFACE.border}`, background: SURFACE.card, cursor: "pointer", fontSize: 12, fontWeight: 600, color: SURFACE.textSecondary }}>{t("Cerrar")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
