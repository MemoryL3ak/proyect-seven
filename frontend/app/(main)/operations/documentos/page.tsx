"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import PdfViewerOverlay from "@/components/PdfViewerOverlay";
import StyledSelect from "@/components/StyledSelect";
import { apiFetch } from "@/lib/api";
import {
  AUDIENCE_LABELS,
  CATEGORY_LABELS,
  DOCUMENT_CATEGORIES,
  DocumentAudience,
  EventDocument,
  formatFileSize,
  isPdf,
} from "@/lib/event-documents";

type EventItem = { id: string; name?: string | null };

const ALL_AUDIENCES: DocumentAudience[] = ["PARTICIPANTE", "VIP", "CONDUCTOR"];

type DocForm = {
  eventId: string;
  title: string;
  description: string;
  category: string;
  audiences: DocumentAudience[];
  published: boolean;
  sortOrder: string;
};

const emptyForm: DocForm = {
  eventId: "",
  title: "",
  description: "",
  category: "INFORMATIVO",
  audiences: [...ALL_AUDIENCES],
  published: true,
  sortOrder: "0",
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const pal = {
  cardBg: "#ffffff",
  cardBorder: "#e2e8f0",
  shadow: "0 1px 4px rgba(15,23,42,0.06)",
  textPrimary: "#0f172a",
  textMuted: "#64748b",
  labelColor: "#94a3b8",
};

export default function EventDocumentsPage() {
  const [docs, setDocs] = useState<EventDocument[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState<DocForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<EventDocument | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EventDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docsData, eventsData] = await Promise.all([
        apiFetch<EventDocument[]>("/event-documents"),
        apiFetch<EventItem[]>("/events").catch(() => [] as EventItem[]),
      ]);
      setDocs(docsData ?? []);
      setEvents(eventsData ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar los documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFile(null);
  };

  const startEdit = (doc: EventDocument) => {
    setEditingId(doc.id);
    setFile(null);
    setForm({
      eventId: doc.eventId ?? "",
      title: doc.title,
      description: doc.description ?? "",
      category: doc.category,
      audiences: doc.audiences?.length ? doc.audiences : [...ALL_AUDIENCES],
      published: doc.published,
      sortOrder: String(doc.sortOrder ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleAudience = (audience: DocumentAudience) => {
    setForm(f => ({
      ...f,
      audiences: f.audiences.includes(audience)
        ? f.audiences.filter(a => a !== audience)
        : [...f.audiences, audience],
    }));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!form.title.trim()) { setError("El título es obligatorio."); return; }
    if (!editingId && !file) { setError("Adjunta el archivo del documento."); return; }
    if (!form.audiences.length) { setError("Selecciona al menos un portal donde publicarlo."); return; }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        eventId: form.eventId || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        audiences: form.audiences,
        published: form.published,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (file) {
        payload.dataUrl = await fileToDataUrl(file);
        payload.fileName = file.name;
      }

      if (editingId) {
        await apiFetch(`/event-documents/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Documento actualizado.");
      } else {
        await apiFetch("/event-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Documento publicado.");
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el documento");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (doc: EventDocument) => {
    try {
      await apiFetch(`/event-documents/${doc.id}`, { method: "DELETE" });
      setDeleteConfirm(null);
      setMessage("Documento eliminado.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const togglePublished = async (doc: EventDocument) => {
    try {
      await apiFetch(`/event-documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !doc.published }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar la visibilidad");
    }
  };

  const onFileChange = (ev: ChangeEvent<HTMLInputElement>) => {
    const selected = ev.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !form.title.trim()) {
      setForm(f => ({ ...f, title: selected.name.replace(/\.[^.]+$/, "") }));
    }
  };

  return (
    <div className="space-y-4">
      <section style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: 18, padding: "18px 20px", boxShadow: pal.shadow }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#a78bfa", marginBottom: 4 }}>
          Documentos del evento
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: pal.textPrimary }}>
          {editingId ? "Editar documento" : "Publicar un documento"}
        </h1>
        <p style={{ fontSize: 12.5, color: pal.textMuted, marginTop: 4 }}>
          Los documentos publicados aparecen en los portales de los usuarios que elijas, con visor y descarga.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Título</label>
              <input className="input mt-1 w-full" style={{ borderRadius: 10 }} value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Informativo de Evento" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Evento</label>
              <StyledSelect
                wrapperClassName="mt-1"
                value={form.eventId}
                onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}
              >
                <option value="">Todos los eventos</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>
                ))}
              </StyledSelect>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Descripción</label>
            <input className="input mt-1 w-full" style={{ borderRadius: 10 }} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Breve texto que verá el usuario debajo del título" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Categoría</label>
              <StyledSelect
                wrapperClassName="mt-1"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {DOCUMENT_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </StyledSelect>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Orden</label>
              <input type="number" className="input mt-1 w-full" style={{ borderRadius: 10 }} value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Archivo {editingId && <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>(opcional al editar)</span>}
              </label>
              <input type="file" accept="application/pdf,.pdf,image/*" onChange={onFileChange}
                className="mt-1 w-full" style={{ fontSize: 12, color: pal.textMuted }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: pal.labelColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Publicar en</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_AUDIENCES.map(a => {
                const active = form.audiences.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAudience(a)}
                    style={{
                      padding: "7px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${active ? "rgba(124,58,237,0.35)" : pal.cardBorder}`,
                      background: active ? "rgba(167,139,250,0.14)" : "#fff",
                      color: active ? "#7c3aed" : pal.textMuted,
                    }}>
                    {AUDIENCE_LABELS[a]}
                  </button>
                );
              })}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8, fontSize: 12, color: pal.textMuted, cursor: "pointer" }}>
                <input type="checkbox" checked={form.published}
                  onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
                Visible para los usuarios
              </label>
            </div>
          </div>

          {error && <p style={{ fontSize: 12.5, color: "#ef4444" }}>{error}</p>}
          {message && <p style={{ fontSize: 12.5, color: "#059669" }}>{message}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              style={{
                padding: "10px 22px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}>
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Publicar documento"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}
                style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${pal.cardBorder}`, background: "#fff", fontSize: 13, color: pal.textMuted, cursor: "pointer" }}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderRadius: 18, overflow: "hidden", boxShadow: pal.shadow }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${pal.cardBorder}` }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: pal.textPrimary }}>
            Documentos publicados <span style={{ color: pal.labelColor, fontWeight: 600 }}>({docs.length})</span>
          </p>
        </div>

        {loading && <p style={{ padding: 20, fontSize: 13, color: pal.textMuted }}>Cargando...</p>}
        {!loading && docs.length === 0 && (
          <p style={{ padding: 20, fontSize: 13, color: pal.textMuted }}>
            Todavía no hay documentos. Sube el primero con el formulario de arriba.
          </p>
        )}

        {!loading && docs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${pal.cardBorder}`, background: "#fafbfc" }}>
                  {["Documento", "Evento", "Portales", "Estado", "Acciones"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.labelColor }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => {
                  const size = formatFileSize(doc.sizeBytes);
                  const eventName = doc.eventId
                    ? events.find(e => e.id === doc.eventId)?.name || "—"
                    : "Todos";
                  return (
                    <tr key={doc.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <p style={{ fontWeight: 700, color: pal.textPrimary }}>{doc.title}</p>
                        <p style={{ fontSize: 11, color: pal.textMuted }}>
                          {[CATEGORY_LABELS[doc.category] ?? doc.category, size, doc.fileName].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td style={{ padding: "10px 14px", color: pal.textMuted }}>{eventName}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {doc.audiences?.map(a => (
                            <span key={a} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(167,139,250,0.14)", color: "#7c3aed" }}>
                              {AUDIENCE_LABELS[a] ?? a}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button onClick={() => togglePublished(doc)}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 99, cursor: "pointer",
                            border: `1px solid ${doc.published ? "rgba(16,185,129,0.3)" : pal.cardBorder}`,
                            background: doc.published ? "rgba(16,185,129,0.1)" : "#f1f5f9",
                            color: doc.published ? "#059669" : pal.textMuted,
                          }}>
                          {doc.published ? "Visible" : "Oculto"}
                        </button>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {isPdf(doc) && (
                            <button onClick={() => setViewing(doc)}
                              style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#21D0B3,#14AE98)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                              Ver
                            </button>
                          )}
                          <button onClick={() => startEdit(doc)}
                            style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${pal.cardBorder}`, background: "#fff", fontSize: 11, color: "#475569", cursor: "pointer" }}>
                            Editar
                          </button>
                          <button onClick={() => setDeleteConfirm(doc)}
                            style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "#fff", fontSize: 11, color: "#ef4444", cursor: "pointer" }}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewing && (
        <PdfViewerOverlay
          src={viewing.fileUrl}
          title={viewing.title}
          onClose={() => setViewing(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, maxWidth: 400, width: "100%" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: pal.textPrimary }}>Eliminar documento</h2>
            <p style={{ fontSize: 13, color: pal.textMuted, marginTop: 8 }}>
              ¿Seguro que quieres eliminar <b>{deleteConfirm.title}</b>? Dejará de verse en los portales.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${pal.cardBorder}`, background: "#fff", fontSize: 13, color: pal.textMuted, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => remove(deleteConfirm)}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
