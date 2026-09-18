import { apiFetch } from "@/lib/api";

export type DocumentAudience = "PARTICIPANTE" | "VIP" | "CONDUCTOR";

export type EventDocument = {
  id: string;
  eventId?: string | null;
  title: string;
  description?: string | null;
  category: string;
  fileUrl: string;
  fileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | string | null;
  audiences: DocumentAudience[];
  published: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export const DOCUMENT_CATEGORIES = [
  "INFORMATIVO",
  "REGLAMENTO",
  "PROGRAMA",
  "FORMULARIO",
  // Cuaderno de Cargo del evento (PDF): Ayuda y los portales lo muestran en
  // lugar del texto fijo de referencia.
  "CUADERNO_CARGO",
  "OTRO",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  INFORMATIVO: "Informativo",
  REGLAMENTO: "Reglamento",
  PROGRAMA: "Programa",
  FORMULARIO: "Formulario",
  CUADERNO_CARGO: "Cuaderno de Cargo",
  OTRO: "Otro",
};

/** Cuaderno de Cargo publicado del evento vigente (el más reciente), o null. */
export async function fetchCuadernoCargo(eventId?: string | null): Promise<EventDocument | null> {
  let resolvedEventId = eventId ?? null;
  if (!resolvedEventId) {
    const events = await apiFetch<Array<{ id: string }>>("/events").catch(() => []);
    resolvedEventId = events[0]?.id ?? null;
  }
  const params = new URLSearchParams();
  if (resolvedEventId) params.set("eventId", resolvedEventId);
  const docs = await apiFetch<EventDocument[]>(`/event-documents?${params.toString()}`).catch(() => []);
  return (
    (docs || []).find((d) => d.category === "CUADERNO_CARGO" && d.published !== false) ?? null
  );
}

export const AUDIENCE_LABELS: Record<DocumentAudience, string> = {
  PARTICIPANTE: "Participantes",
  VIP: "VIP",
  CONDUCTOR: "Conductores",
};

/** Documentos publicados para un público y evento concretos. */
export async function fetchPortalDocuments(
  audience: DocumentAudience,
  eventId?: string | null,
): Promise<EventDocument[]> {
  const params = new URLSearchParams({ audience });
  if (eventId) params.set("eventId", eventId);
  return apiFetch<EventDocument[]>(`/event-documents?${params.toString()}`);
}

export function formatFileSize(bytes?: number | string | null) {
  // TypeORM devuelve bigint como string.
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (!n || Number.isNaN(n)) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPdf(doc: EventDocument) {
  return (
    doc.contentType === "application/pdf" ||
    /\.pdf($|\?)/i.test(doc.fileUrl) ||
    /\.pdf$/i.test(doc.fileName ?? "")
  );
}
