"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { clRegions } from "@clregions/data/object";
import PageHeader from "@/components/PageHeader";
import StyledSelect from "@/components/StyledSelect";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type EventItem = {
  id: string;
  name?: string | null;
};

type Venue = {
  id: string;
  eventId: string;
  name: string;
  address?: string | null;
  region?: string | null;
  commune?: string | null;
  photoUrl?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type VenueForm = {
  eventId: string;
  name: string;
  address: string;
  region: string;
  commune: string;
};

const initialForm: VenueForm = {
  eventId: "",
  name: "",
  address: "",
  region: "",
  commune: "",
};

const regionOptions = Object.values(clRegions.regions)
  .map((region) => ({ label: region.name, value: region.name, provinces: region.provinces }))
  .sort((a, b) => a.label.localeCompare(b.label, "es"));

function buildCommuneOptions(regionName: string) {
  const selectedRegion = regionOptions.find((region) => region.value === regionName);
  if (!selectedRegion) return [] as { label: string; value: string }[];
  const communes = Object.values(selectedRegion.provinces)
    .flatMap((province) => Object.values(province.communes))
    .map((commune) => ({ label: commune.name, value: commune.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return communes.filter((c, i, list) => list.findIndex((x) => x.value === c.value) === i);
}

function mapsUrl(venue: Pick<VenueForm, "address" | "commune" | "region">) {
  const query = [venue.address, venue.commune, venue.region, "Chile"].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function mapsEmbedUrl(venue: Pick<VenueForm, "address" | "commune" | "region">) {
  const query = [venue.address, venue.commune, venue.region, "Chile"].filter(Boolean).join(", ");
  return query ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed&hl=es&z=15` : "";
}

function formatDate(value?: string | Date) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(parsed);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VenuesMasterPage() {
  const { t } = useI18n();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState<VenueForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const communeOptions = useMemo(() => buildCommuneOptions(form.region), [form.region]);
  const currentMapsUrl = useMemo(() => mapsUrl(form), [form]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [venuesData, eventsData] = await Promise.all([
        apiFetch<Venue[]>("/venues"),
        apiFetch<EventItem[]>("/events"),
      ]);
      setVenues((venuesData || []).sort((a, b) => a.name.localeCompare(b.name, "es")));
      setEvents(eventsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar sedes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.eventId || !form.name.trim() || !form.address.trim() || !form.region || !form.commune) {
      setError("Completa evento, sede, dirección, región y comuna.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        eventId: form.eventId,
        name: form.name.trim(),
        address: form.address.trim(),
        region: form.region,
        commune: form.commune,
      };

      let venueId = editingId;

      if (editingId) {
        await apiFetch(`/venues/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const created = await apiFetch<Venue>("/venues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        venueId = created.id;
      }

      // Upload photo if one was selected
      if (photoFile && venueId) {
        const dataUrl = await fileToDataUrl(photoFile);
        await apiFetch(`/venues/${venueId}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
      }

      setMessage(editingId ? "Sede actualizada." : "Sede creada.");
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la sede.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setForm({
      eventId: venue.eventId,
      name: venue.name || "",
      address: venue.address || "",
      region: venue.region || "",
      commune: venue.commune || "",
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhoto(venue.photoUrl || null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/venues/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      setMessage("Sede eliminada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la sede.");
    }
  };

  const previewSrc = photoPreview ?? existingPhoto ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Sedes")}
        description={t("Registro maestro de sedes operativas con dirección, foto y mapa.")}
        action={
          <button className="btn btn-ghost" type="button" onClick={loadData} disabled={loading}>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        }
      />

      {/* Form */}
      <section className="surface rounded-[28px] p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{t("Registro maestro")}</p>
          <h3 className="mt-2 text-2xl font-semibold text-ink">{editingId ? t("Editar sede") : t("Nueva sede")}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {t("Define la sede con dirección, región, comuna y foto. El mapa se genera automáticamente.")}
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{t("Evento")}</span>
              <StyledSelect value={form.eventId}
                onChange={(e) => setForm((prev) => ({ ...prev, eventId: e.target.value }))}>
                <option value="">{t("Selecciona un evento")}</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>
                ))}
              </StyledSelect>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{t("Sede")}</span>
              <input className="input" value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("Ej: Estadio Nacional")} />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">{t("Dirección")}</span>
              <input className="input" value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder={t("Ej: Avenida Grecia 1851")} />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t("Región")}</span>
              <StyledSelect value={form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value, commune: "" }))}>
                <option value="">{t("Selecciona una región")}</option>
                {regionOptions.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </StyledSelect>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">{t("Comuna")}</span>
              <StyledSelect value={form.commune} disabled={!form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, commune: e.target.value }))}>
                <option value="">{form.region ? t("Selecciona una comuna") : t("Primero selecciona una región")}</option>
                {communeOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </StyledSelect>
            </label>

            {/* Photo upload */}
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">
                {t("Foto de la sede")}{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </span>

              {/* Preview */}
              {previewSrc && (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewSrc} alt={t("Vista previa")} className="h-48 w-full object-cover" />
                  {photoPreview && (
                    <div className="absolute right-3 top-3 rounded-lg bg-black/50 px-2 py-1 text-xs text-white">
                      {t("Nueva foto seleccionada")}
                    </div>
                  )}
                </div>
              )}

              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-slate-400 hover:bg-slate-100 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {photoFile ? photoFile.name : t("Haz clic para subir una foto")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t("JPG, PNG, WEBP · Máx. 4 MB")}</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-sm text-slate-600">
              {currentMapsUrl
                ? t("La dirección ya puede abrirse en Google Maps.")
                : t("Completa dirección, región y comuna para habilitar el mapa.")}
            </div>
            <div className="flex flex-wrap gap-3">
              {currentMapsUrl && (
                <Link href={currentMapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  {t("Ver en Maps")}
                </Link>
              )}
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? t("Guardando...") : editingId ? t("Actualizar sede") : t("Crear sede")}
              </button>
              {editingId && (
                <button className="btn btn-ghost" type="button" onClick={resetForm}>
                  {t("Cancelar edición")}
                </button>
              )}
            </div>
          </div>
        </form>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
      </section>

      {/* Cards */}
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "28px", padding: "28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#94a3b8" }}>{t("Registros")}</span>
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0 }}>{t("Sedes registradas")}</h3>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "6px 14px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 6px #21D0B3", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#21D0B3" }}>{venues.length} {t("sede(s)")}</span>
          </div>
        </div>

        {venues.length === 0 ? (
          <div style={{ marginTop: "24px", borderRadius: "16px", border: "2px dashed #e2e8f0", background: "#f8fafc", padding: "32px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
            {t("No hay sedes registradas todavía.")}
          </div>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {venues.map((venue) => {
              const eventName = events.find((ev) => ev.id === venue.eventId)?.name || venue.eventId;
              return (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  eventName={eventName}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function VenueCard({
  venue,
  eventName,
  onEdit,
  onDelete,
}: {
  venue: Venue;
  eventName: string;
  onEdit: (v: Venue) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const hasPhoto = Boolean(venue.photoUrl);
  const embedUrl = mapsEmbedUrl({
    address: venue.address || "",
    region: venue.region || "",
    commune: venue.commune || "",
  });
  const openMapsUrl = mapsUrl({
    address: venue.address || "",
    region: venue.region || "",
    commune: venue.commune || "",
  });

  return (
    <article style={{
      overflow: "hidden", borderRadius: "24px",
      border: "1px solid #e2e8f0", background: "#ffffff",
      boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
      borderTop: hasPhoto ? undefined : "3px solid #21D0B3",
      transition: "transform 120ms ease, box-shadow 120ms ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(15,23,42,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.08)"; }}
    >
      {/* Photo hero */}
      {hasPhoto && (
        <div style={{ position: "relative", height: "210px", width: "100%", overflow: "hidden", background: "#f1f5f9" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={venue.photoUrl!}
            alt={venue.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, padding: "20px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.2)", border: "1px solid rgba(33,208,179,0.4)", borderRadius: "99px", padding: "2px 10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#21D0B3" }}>{eventName}</span>
            </span>
            <h4 style={{ fontSize: "22px", fontWeight: 800, color: "#ffffff", margin: 0, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>{venue.name}</h4>
          </div>
          <div style={{ position: "absolute", right: "16px", top: "16px", display: "flex", gap: "8px" }}>
            <button
              style={{ borderRadius: "10px", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#ffffff", cursor: "pointer", backdropFilter: "blur(4px)" }}
              type="button"
              onClick={() => onEdit(venue)}
            >
              {t("Editar")}
            </button>
            <button
              style={{ borderRadius: "10px", background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.3)", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#fca5a5", cursor: "pointer", backdropFilter: "blur(4px)" }}
              type="button"
              onClick={() => onDelete(venue.id)}
            >
              {t("Eliminar")}
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "20px" }}>
        {!hasPhoto && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.2)", borderRadius: "99px", padding: "2px 10px", marginBottom: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#21D0B3" }}>{eventName}</span>
              </span>
              <h4 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>{venue.name}</h4>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={{ borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
                type="button"
                onClick={() => onEdit(venue)}
              >{t("Editar")}</button>
              <button
                style={{ borderRadius: "10px", border: "1px solid #fecaca", background: "#fff1f2", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}
                type="button"
                onClick={() => onDelete(venue.id)}
              >{t("Eliminar")}</button>
            </div>
          </div>
        )}

        <div className={`grid gap-3 ${embedUrl ? "sm:grid-cols-2" : ""} ${!hasPhoto ? "" : "mt-3"}`}>
          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "3px solid #21D0B3", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "6px" }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t("Dirección")}
              </div>
              <p style={{ fontSize: "13px", color: "#1e293b", fontWeight: 500, margin: 0 }}>{venue.address || "—"}</p>
            </div>
            <div style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "3px solid #21D0B3", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#21D0B3", marginBottom: "6px" }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                {t("Ubicación")}
              </div>
              <p style={{ fontSize: "13px", color: "#1e293b", fontWeight: 500, margin: 0 }}>
                {[venue.commune, venue.region].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>

          {/* Embedded map */}
          {embedUrl && (
            <div style={{ overflow: "hidden", borderRadius: "14px", border: "1px solid #e2e8f0", background: "#f1f5f9" }}>
              <iframe
                src={embedUrl}
                title={t("Mapa de {name}").replace("{name}", venue.name)}
                style={{ width: "100%", minHeight: "180px", height: "100%", border: 0, display: "block" }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>

        <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>{t("Actualizada: ")}{formatDate(venue.updatedAt)}</span>
          {openMapsUrl && (
            <Link
              href={openMapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#21D0B3", textDecoration: "none" }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {t("Abrir en Maps")}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
