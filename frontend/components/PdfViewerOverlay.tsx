"use client";

import dynamic from "next/dynamic";
import { ArrowLeftIcon, DownloadIcon } from "@/components/ui/Icons";
import { BRAND, SURFACE } from "@/lib/design";

// PDF.js pesa: se carga sólo cuando se abre un documento.
const PdfCanvasViewer = dynamic(() => import("@/components/PdfCanvasViewer"), {
  ssr: false,
});

/**
 * Visor de PDF a pantalla completa DENTRO del portal, con botón "← Volver"
 * siempre visible. Se usa en la app nativa: descargar con doc.save() hacía
 * que el WebView navegara al visor del sistema y volver al portal era muy
 * difícil. Aquí la página nunca navega.
 */
export default function PdfViewerOverlay({
  dataUri,
  src,
  srcDoc,
  title,
  onClose,
  onDownload,
}: {
  /** PDF como data URI (no siempre renderiza en WebView Android). */
  dataUri?: string;
  /** URL del documento, por ejemplo la pública del Storage. */
  src?: string;
  /** HTML directo — renderiza en cualquier WebView; preferido para la credencial. */
  srcDoc?: string;
  title: string;
  onClose: () => void;
  onDownload?: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "#0d1a28", display: "flex", flexDirection: "column" }}>
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
          onClick={onClose}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(52,243,198,0.4)",
            background: "rgba(33,208,179,0.15)",
            color: BRAND.tealLight,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <ArrowLeftIcon size={15} strokeWidth={2.5} />
          Volver
        </button>
        <p
          style={{
            fontSize: 13.5,
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
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            title="Guardar en el teléfono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.08)",
              color: SURFACE.card,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <DownloadIcon size={14} strokeWidth={2} />
            Guardar
          </button>
        )}
      </div>
      {srcDoc ? (
        <iframe
          srcDoc={srcDoc}
          title={title}
          style={{ flex: 1, width: "100%", border: "none", background: SURFACE.card }}
        />
      ) : (
        // Los PDF se dibujan con PDF.js: en un iframe iOS muestra sólo la
        // primera página y Android no muestra nada.
        <PdfCanvasViewer src={(src ?? dataUri) as string} />
      )}
    </div>
  );
}
