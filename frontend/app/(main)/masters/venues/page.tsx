"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import PlacesAutocompleteInput from "@/components/PlacesAutocompleteInput";
import Link from "next/link";
import { clRegions } from "@clregions/data/object";
import PageHeader from "@/components/PageHeader";
import StyledSelect from "@/components/StyledSelect";
import { apiFetch } from "@/lib/api";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { buildDisciplineLabelMap } from "@/lib/discipline-filters";
import { useI18n } from "@/lib/i18n";
import { downloadCSV } from "@/lib/export";
import { DownloadIcon } from "@/components/ui/Icons";

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
  /** Deportes que se compiten acá; se eligen en este mismo formulario. */
  disciplineIds?: string[] | null;
  /** Participante con rol Coordinador de Sede a cargo del recinto. */
  coordinatorId?: string | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

/**
 * Participante con rol Coordinador de Sede. La lista del formulario sale de
 * acá: antes el coordinador se escribía a mano y cada sede lo tipeaba distinto.
 */
type Coordinador = {
  id: string;
  fullName?: string | null;
  eventId?: string | null;
  userType?: string | null;
  phone?: string | null;
};

/** Deporte raíz del evento: lo que se puede asignar a una sede. */
type Discipline = {
  id: string;
  name?: string | null;
  eventId?: string | null;
  parentId?: string | null;
  category?: string | null;
  gender?: string | null;
};

type VenueForm = {
  eventId: string;
  name: string;
  address: string;
  region: string;
  commune: string;
  disciplineIds: string[];
  coordinatorId: string;
};

const initialForm: VenueForm = {
  eventId: "",
  name: "",
  address: "",
  region: "",
  commune: "",
  disciplineIds: [],
  coordinatorId: "",
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
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
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

  // Sólo los deportes del evento de la sede: cada evento tiene los suyos y
  // mezclarlos ofrecía deportes que no se compiten en este.
  const eventDisciplines = useMemo(
    () => disciplines.filter((d) => !form.eventId || d.eventId === form.eventId),
    [disciplines, form.eventId],
  );
  /**
   * El mismo deporte existe una vez por variante (género y categoría), así que
   * mostrar sólo el nombre deja varias fichas "Atletismo" idénticas sin forma
   * de saber cuál se está marcando. Misma desambiguación que usan los portales,
   * pero por evento: el sufijo sólo tiene sentido frente a los deportes con los
   * que compite en la misma lista, no contra los de otro evento.
   */
  const disciplineLabels = useMemo(() => {
    const porEvento = new Map<string, Discipline[]>();
    for (const d of disciplines) {
      const clave = d.eventId ?? "";
      porEvento.set(clave, [...(porEvento.get(clave) ?? []), d]);
    }
    const todas = new Map<string, string>();
    for (const grupo of porEvento.values()) {
      for (const [id, etiqueta] of buildDisciplineLabelMap(grupo)) todas.set(id, etiqueta);
    }
    return todas;
  }, [disciplines]);
  const disciplineLabel = (id: string) =>
    disciplineLabels.get(id) ?? disciplines.find((d) => d.id === id)?.name ?? id;

  /**
   * Listado de sedes a CSV, con los mismos nombres que muestran las tarjetas:
   * el evento y los deportes salen resueltos, no como id.
   */
  const descargarSedes = () => {
    if (venues.length === 0) return;
    const filas = venues.map((venue) => ({
      Sede: venue.name,
      Evento: events.find((ev) => ev.id === venue.eventId)?.name || venue.eventId,
      Dirección: venue.address || "",
      Región: venue.region || "",
      Comuna: venue.commune || "",
      Deportes: (venue.disciplineIds || []).map((id) => disciplineLabel(id)).join(" · "),
      "Coordinador de sede": venue.coordinatorName || "",
      Teléfono: venue.coordinatorPhone || "",
    }));
    downloadCSV(`sedes-${new Date().toISOString().slice(0, 10)}`, filas);
  };

  const [coordinadores, setCoordinadores] = useState<Coordinador[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [venuesData, eventsData, disciplinesData, participantesData] = await Promise.all([
        apiFetch<Venue[]>("/venues"),
        apiFetch<EventItem[]>("/events"),
        apiFetch<Discipline[]>("/disciplines").catch(() => [] as Discipline[]),
        apiFetch<Coordinador[]>("/athletes").catch(() => [] as Coordinador[]),
      ]);
      setVenues((venuesData || []).sort((a, b) => a.name.localeCompare(b.name, "es")));
      setEvents(eventsData || []);
      // Sólo los participantes con el rol; el resto no puede coordinar una sede.
      setCoordinadores(
        (participantesData || [])
          .filter((p) => String(p.userType ?? "").toUpperCase() === "COORDINADOR_SEDE")
          .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "", "es")),
      );
      // Sólo los deportes padre: una prueba ("100 Metros Planos") no se asigna
      // a una sede, el deporte sí.
      setDisciplines(
        (disciplinesData || [])
          .filter((d) => !d.parentId)
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "es")),
      );
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

  const toggleDiscipline = (id: string) => {
    setForm((prev) => ({
      ...prev,
      disciplineIds: prev.disciplineIds.includes(id)
        ? prev.disciplineIds.filter((x) => x !== id)
        : [...prev.disciplineIds, id],
    }));
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
        disciplineIds: form.disciplineIds,
        coordinatorId: form.coordinatorId || null,
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
      disciplineIds: [...(venue.disciplineIds ?? [])],
      coordinatorId: venue.coordinatorId ?? "",
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={descargarSedes}
              disabled={venues.length === 0}
              title={t("Descargar el listado como CSV")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", opacity: venues.length === 0 ? 0.5 : 1 }}
            >
              <DownloadIcon size={13} style={{ opacity: 0.7 }} />
              {t("Descargar")}
            </button>
            <button className="btn btn-ghost" type="button" onClick={loadData} disabled={loading}>
              {loading ? t("Actualizando...") : t("Refrescar")}
            </button>
          </div>
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
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  eventId: e.target.value,
                  // Los deportes son de un evento: al cambiarlo, lo marcado ya
                  // no existe en el nuevo y quedaría guardado como ids huérfanos.
                  disciplineIds: e.target.value === prev.eventId ? prev.disciplineIds : [],
                }))}>
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
              <PlacesAutocompleteInput
                key={editingId || "new"}
                className="input"
                value={form.address}
                onChange={(val) => setForm((prev) => ({ ...prev, address: val }))}
                onPlaceDetails={(details) => {
                  // Match Google region name to our regionOptions
                  const googleRegion = details.region || "";
                  const matchedRegion = regionOptions.find((r) =>
                    r.value.toLowerCase().includes(googleRegion.toLowerCase()) ||
                    googleRegion.toLowerCase().includes(r.value.toLowerCase().replace(/^región\s+(de\s+)?/i, ""))
                  );
                  if (matchedRegion) {
                    const communes = buildCommuneOptions(matchedRegion.value);
                    const googleCommune = details.commune || details.city || "";
                    const matchedCommune = communes.find((c) =>
                      c.value.toLowerCase() === googleCommune.toLowerCase() ||
                      c.value.toLowerCase().includes(googleCommune.toLowerCase()) ||
                      googleCommune.toLowerCase().includes(c.value.toLowerCase())
                    );
                    setForm((prev) => ({
                      ...prev,
                      region: matchedRegion.value,
                      commune: matchedCommune?.value || "",
                    }));
                  }
                }}
                placeholder={t("Ej: Avenida Grecia 1851, Ñuñoa")}
              />
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

            {/* Coordinador del recinto. Se elige de los participantes con ese
                rol en vez de escribirse: así el nombre y el teléfono salen
                siempre de su ficha y no de lo que tipeó cada quien. */}
            <label className="text-sm block md:col-span-2">
              <span className="block mb-1">
                {t("Coordinador de sede")}{" "}
                <span className="font-normal text-slate-400">({t("opcional")})</span>
              </span>
              <StyledSelect
                value={form.coordinatorId}
                onChange={(e) => setForm((prev) => ({ ...prev, coordinatorId: e.target.value }))}
              >
                <option value="">{t("Sin coordinador asignado")}</option>
                {coordinadores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName || c.id}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </StyledSelect>
              {coordinadores.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  {t("No hay participantes con el rol Coordinador de Sede. Se registran en Inscripción de Participantes con ese tipo de cliente.")}
                </p>
              )}
            </label>

            {/* Disciplinas de la sede: dato propio del recinto. Antes el portal
                las deducía calzando el nombre de la sede con el recinto escrito
                en cada prueba, y renombrar la sede las hacía desaparecer. */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {t("Disciplinas de la sede")}{" "}
                  <span className="font-normal text-slate-400">({t("opcional")})</span>
                </span>
                {form.disciplineIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, disciplineIds: [] }))}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "12px", fontWeight: 700, color: BRAND.tealInk }}
                  >
                    {t("Quitar selección")}
                  </button>
                )}
              </div>

              {!form.eventId ? (
                <p className="text-xs text-slate-400">{t("Primero selecciona un evento.")}</p>
              ) : eventDisciplines.length === 0 ? (
                <p className="text-xs text-slate-400">{t("El evento no tiene deportes registrados.")}</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: 180, overflowY: "auto", padding: "8px", borderRadius: "12px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg }}>
                  {eventDisciplines.map((d) => {
                    const activo = form.disciplineIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDiscipline(d.id)}
                        style={{
                          borderRadius: "99px", padding: "5px 11px", fontSize: "12px", fontWeight: 700,
                          border: activo ? `1px solid ${BRAND.teal}` : `1px solid ${SURFACE.border}`,
                          background: activo ? "rgba(33,208,179,0.12)" : SURFACE.card,
                          color: activo ? BRAND.tealInk : SURFACE.textMuted,
                          cursor: "pointer",
                        }}
                      >
                        {disciplineLabel(d.id)}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-slate-400">
                {form.disciplineIds.length === 0
                  ? t("Sin marcar: la sede no declara disciplinas.")
                  : `${form.disciplineIds.length} ${form.disciplineIds.length === 1 ? t("disciplina") : t("disciplinas")}`}
              </p>
            </div>

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
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "28px", padding: "28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: SURFACE.textFaint }}>{t("Registros")}</span>
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: 800, color: SURFACE.text, margin: 0 }}>{t("Sedes registradas")}</h3>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "6px 14px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: BRAND.teal, boxShadow: `0 0 6px ${BRAND.teal}`, flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: BRAND.teal }}>{venues.length} {t("sede(s)")}</span>
          </div>
        </div>

        {venues.length === 0 ? (
          <div style={{ marginTop: "24px", borderRadius: "16px", border: `2px dashed ${SURFACE.border}`, background: SURFACE.bg, padding: "32px", textAlign: "center", fontSize: "13px", color: SURFACE.textFaint }}>
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
                  disciplineLabel={disciplineLabel}
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
  disciplineLabel,
  onEdit,
  onDelete,
}: {
  venue: Venue;
  eventName: string;
  disciplineLabel: (id: string) => string;
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
      border: `1px solid ${SURFACE.border}`, background: SURFACE.card,
      boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
      borderTop: hasPhoto ? undefined : `3px solid ${BRAND.teal}`,
      transition: "transform 120ms ease, box-shadow 120ms ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(15,23,42,0.12)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.08)"; }}
    >
      {/* Photo hero */}
      {hasPhoto && (
        <div style={{ position: "relative", height: "210px", width: "100%", overflow: "hidden", background: SURFACE.borderMuted }}>
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
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal }}>{eventName}</span>
            </span>
            <h4 style={{ fontSize: "22px", fontWeight: 800, color: SURFACE.card, margin: 0, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>{venue.name}</h4>
          </div>
          <div style={{ position: "absolute", right: "16px", top: "16px", display: "flex", gap: "8px" }}>
            <button
              style={{ borderRadius: "10px", background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: SURFACE.card, cursor: "pointer", backdropFilter: "blur(4px)" }}
              type="button"
              onClick={() => onEdit(venue)}
            >
              {t("Editar")}
            </button>
            <button
              style={{ borderRadius: "10px", background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.3)", padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: STATE.dangerBorder, cursor: "pointer", backdropFilter: "blur(4px)" }}
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
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.teal }}>{eventName}</span>
              </span>
              <h4 style={{ fontSize: "18px", fontWeight: 800, color: SURFACE.text, margin: 0 }}>{venue.name}</h4>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={{ borderRadius: "10px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: SURFACE.textSecondary, cursor: "pointer" }}
                type="button"
                onClick={() => onEdit(venue)}
              >{t("Editar")}</button>
              <button
                style={{ borderRadius: "10px", border: `1px solid ${STATE.dangerBorder}`, background: "#fff1f2", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: STATE.danger, cursor: "pointer" }}
                type="button"
                onClick={() => onDelete(venue.id)}
              >{t("Eliminar")}</button>
            </div>
          </div>
        )}

        <div className={`grid gap-3 ${embedUrl ? "sm:grid-cols-2" : ""} ${!hasPhoto ? "" : "mt-3"}`}>
          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ borderRadius: "14px", background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderLeft: `3px solid ${BRAND.teal}`, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "6px" }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t("Dirección")}
              </div>
              <p style={{ fontSize: "13px", color: "#1e293b", fontWeight: 500, margin: 0 }}>{venue.address || "—"}</p>
            </div>
            <div style={{ borderRadius: "14px", background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderLeft: `3px solid ${BRAND.teal}`, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "6px" }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                {t("Ubicación")}
              </div>
              <p style={{ fontSize: "13px", color: "#1e293b", fontWeight: 500, margin: 0 }}>
                {[venue.commune, venue.region].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <div style={{ borderRadius: "14px", background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderLeft: `3px solid ${BRAND.teal}`, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "6px" }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t("Disciplinas")}
              </div>
              {(venue.disciplineIds ?? []).length === 0 ? (
                <p style={{ fontSize: "13px", color: SURFACE.textFaint, fontWeight: 500, margin: 0 }}>
                  {t("Sin disciplinas asignadas")}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(venue.disciplineIds ?? []).map((id) => (
                    <span
                      key={id}
                      style={{ borderRadius: "99px", padding: "3px 10px", fontSize: "11.5px", fontWeight: 700, border: `1px solid ${BRAND.teal}`, background: "rgba(33,208,179,0.12)", color: BRAND.tealInk }}
                    >
                      {disciplineLabel(id)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quién responde por el recinto: sin esto había que abrir la
                edición de cada sede para saberlo. */}
            <div style={{ borderRadius: "14px", background: SURFACE.bg, border: `1px solid ${SURFACE.border}`, borderLeft: `3px solid ${BRAND.teal}`, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "6px" }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {t("Coordinador de sede")}
              </div>
              {venue.coordinatorName ? (
                <p style={{ fontSize: "13px", color: SURFACE.text, fontWeight: 600, margin: 0 }}>
                  {venue.coordinatorName}
                  {venue.coordinatorPhone && (
                    <span style={{ fontWeight: 500, color: SURFACE.textMuted }}> · {venue.coordinatorPhone}</span>
                  )}
                </p>
              ) : (
                <p style={{ fontSize: "13px", color: SURFACE.textFaint, fontWeight: 500, margin: 0 }}>
                  {t("Sin coordinador asignado")}
                </p>
              )}
            </div>
          </div>

          {/* Embedded map */}
          {embedUrl && (
            <div style={{ overflow: "hidden", borderRadius: "14px", border: `1px solid ${SURFACE.border}`, background: SURFACE.borderMuted }}>
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

        <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px", borderTop: `1px solid ${SURFACE.borderMuted}`, paddingTop: "16px" }}>
          <span style={{ fontSize: "11px", color: SURFACE.textFaint }}>{t("Actualizada: ")}{formatDate(venue.updatedAt)}</span>
          {openMapsUrl && (
            <Link
              href={openMapsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: BRAND.teal, textDecoration: "none" }}
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
