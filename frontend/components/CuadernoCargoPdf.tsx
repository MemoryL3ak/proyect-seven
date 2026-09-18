"use client";

import { useEffect, useRef, useState } from "react";
import { FileTextIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { BRAND, SURFACE } from "@/lib/design";
import { fetchCuadernoCargo, formatFileSize, type EventDocument } from "@/lib/event-documents";

/**
 * Cuaderno de Cargo del evento vigente: el PDF que operaciones sube en
 * Documentos del Evento con categoría "Cuaderno de Cargo". Si no hay uno
 * publicado no se renderiza nada y la pantalla que lo incluye muestra su
 * contenido de referencia.
 */
export default function CuadernoCargoPdf({
  eventId,
  onLoaded,
}: {
  eventId?: string | null;
  /** Avisa si hay PDF, para que el contenedor pueda ocultar el texto de referencia. */
  onLoaded?: (hasPdf: boolean) => void;
}) {
  const { t } = useI18n();
  const [doc, setDoc] = useState<EventDocument | null>(null);
  // onLoaded suele venir inline; se guarda en un ref para que el efecto sólo
  // dependa del evento y no vuelva a pedir el documento en cada render.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  useEffect(() => {
    let alive = true;
    fetchCuadernoCargo(eventId)
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        onLoadedRef.current?.(Boolean(d));
      })
      .catch(() => {
        if (alive) onLoadedRef.current?.(false);
      });
    return () => {
      alive = false;
    };
  }, [eventId]);

  if (!doc) return null;
  const size = formatFileSize(doc.sizeBytes);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <FileTextIcon size={18} color={BRAND.teal} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: SURFACE.textStrong }}>{doc.title}</p>
          <p style={{ margin: 0, fontSize: 12, color: SURFACE.textSecondary }}>
            {[doc.fileName, size].filter(Boolean).join(" · ")}
          </p>
        </div>
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
          style={{ textDecoration: "none" }}
        >
          {t("Abrir PDF")}
        </a>
      </div>
      <iframe
        src={`${doc.fileUrl}#view=FitH`}
        title={doc.title}
        style={{ width: "100%", height: "70vh", border: `1px solid ${SURFACE.border}`, borderRadius: 12, background: SURFACE.card }}
      />
    </div>
  );
}
