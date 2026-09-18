"use client";

import { useEffect, useState } from "react";
import PdfViewerOverlay from "@/components/PdfViewerOverlay";
import { isAvailable as isNativeBridge, send as nativeSend } from "@/lib/native-bridge";
import {
  CATEGORY_LABELS,
  DocumentAudience,
  EventDocument,
  fetchPortalDocuments,
  formatFileSize,
  isPdf,
} from "@/lib/event-documents";
import { FileTextIcon, DownloadIcon } from "@/components/ui/Icons";

/**
 * Lista de documentos informativos del evento para los portales de usuario.
 *
 * Los PDF se abren en el visor interno (nunca se sale del portal) y además se
 * pueden guardar; dentro de la app nativa la descarga se delega al navegador
 * del sistema por el puente `url.open`, igual que la credencial.
 */
export default function EventDocumentsSection({
  audience,
  eventId,
  title = "Documentos del evento",
  subtitle = "Información oficial para consultar o descargar",
}: {
  audience: DocumentAudience;
  eventId?: string | null;
  title?: string;
  subtitle?: string;
}) {
  const [docs, setDocs] = useState<EventDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<EventDocument | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPortalDocuments(audience, eventId)
      .then(list => { if (alive) setDocs(list); })
      .catch(() => { if (alive) { setDocs([]); setError("No se pudieron cargar los documentos."); } });
    return () => { alive = false; };
  }, [audience, eventId]);

  const download = (doc: EventDocument) => {
    if (isNativeBridge()) {
      nativeSend("url.open", { url: doc.fileUrl });
      return;
    }
    const a = document.createElement("a");
    a.href = doc.fileUrl;
    a.target = "_blank";
    a.rel = "noopener";
    a.download = doc.fileName || `${doc.title}.pdf`;
    a.click();
  };

  return (
    <>
      {/* Estilos propios: los tres portales usan clases de tarjeta distintas
          (db-card / vr-card / dc-card), así que el componente no depende de
          ninguna y se ve igual en todos. */}
      <div style={{
        background: "#fff",
        border: "1px solid rgba(226,232,240,0.8)",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
        marginBottom: 14,
      }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>{subtitle}</p>

        {docs === null && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ height: 62, borderRadius: 14, background: "#eef1f8" }} />
            ))}
          </div>
        )}

        {docs?.length === 0 && (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>
            {error ?? "Aún no hay documentos publicados."}
          </p>
        )}

        {docs && docs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {docs.map(doc => {
              const size = formatFileSize(doc.sizeBytes);
              const pdf = isPdf(doc);
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 14,
                    border: "1px solid #e2e8f0", background: "#f8fafc",
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  }}>
                    <FileTextIcon size={18} color="#ef4444" strokeWidth={2} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.title}
                    </p>
                    {doc.description && (
                      <p style={{ fontSize: 11.5, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.description}
                      </p>
                    )}
                    <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                      {[CATEGORY_LABELS[doc.category] ?? doc.category, size].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {pdf && (
                      <button
                        type="button"
                        onClick={() => setViewing(doc)}
                        style={{
                          padding: "8px 12px", borderRadius: 10, border: "none",
                          background: "linear-gradient(135deg,#21D0B3,#14AE98)",
                          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Ver
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => download(doc)}
                      title="Descargar"
                      style={{
                        padding: "8px 12px", borderRadius: 10,
                        border: "1px solid #e2e8f0", background: "#fff",
                        color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      <DownloadIcon size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewing && (
        <PdfViewerOverlay
          src={viewing.fileUrl}
          title={viewing.title}
          onClose={() => setViewing(null)}
          onDownload={() => download(viewing)}
        />
      )}
    </>
  );
}
