"use client";

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
          background: "linear-gradient(135deg,#041a2e,#062240)",
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
            color: "#34F3C6",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Volver
        </button>
        <p
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: "#fff",
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
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Guardar
          </button>
        )}
      </div>
      {srcDoc ? (
        <iframe
          srcDoc={srcDoc}
          title={title}
          style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
        />
      ) : (
        <iframe
          src={src ?? dataUri}
          title={title}
          style={{ flex: 1, width: "100%", border: "none", background: "#334155" }}
        />
      )}
    </div>
  );
}
