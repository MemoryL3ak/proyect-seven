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
  "OTRO",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  INFORMATIVO: "Informativo",
  REGLAMENTO: "Reglamento",
  PROGRAMA: "Programa",
  FORMULARIO: "Formulario",
  OTRO: "Otro",
};

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
