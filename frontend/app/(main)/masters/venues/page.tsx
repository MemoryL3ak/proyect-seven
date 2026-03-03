"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clRegions } from "@clregions/data/object";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";

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

  return communes.filter((commune, index, list) => list.findIndex((item) => item.value === commune.value) === index);
}

function mapsUrl(venue: Pick<VenueForm, "address" | "commune" | "region">) {
  const query = [venue.address, venue.commune, venue.region, "Chile"].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function formatDate(value?: string | Date) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function VenuesMasterPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState<VenueForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.eventId || !form.name.trim() || !form.address.trim() || !form.region || !form.commune) {
      setError("Completa evento, sede, direccion, region y comuna.");
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

      if (editingId) {
        await apiFetch(`/venues/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Sede actualizada.");
      } else {
        await apiFetch("/venues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Sede creada.");
      }

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
    setMessage(null);
    setError(null);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sedes"
        description="Registro maestro de sedes operativas con direccion estructurada y acceso rapido a Maps."
        action={
          <button className="btn btn-ghost" type="button" onClick={loadData} disabled={loading}>
            {loading ? "Actualizando..." : "Refrescar"}
          </button>
        }
      />

      <section className="surface rounded-[28px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Registro maestro</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">{editingId ? "Editar sede" : "Nueva sede"}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Define la sede con direccion, region y comuna. El enlace a Maps se genera automaticamente a partir de la direccion registrada.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Evento</span>
              <select
                className="input"
                value={form.eventId}
                onChange={(e) => setForm((prev) => ({ ...prev, eventId: e.target.value }))}
              >
                <option value="">Selecciona un evento</option>
                {events.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {eventItem.name || eventItem.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Sede</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Estadio Nacional"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Dirección</span>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Ej: Avenida Grecia 1851"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Región</span>
              <select
                className="input"
                value={form.region}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    region: e.target.value,
                    commune: "",
                  }))
                }
              >
                <option value="">Selecciona una región</option>
                {regionOptions.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Comuna</span>
              <select
                className="input"
                value={form.commune}
                onChange={(e) => setForm((prev) => ({ ...prev, commune: e.target.value }))}
                disabled={!form.region}
              >
                <option value="">{form.region ? "Selecciona una comuna" : "Primero selecciona una región"}</option>
                {communeOptions.map((commune) => (
                  <option key={commune.value} value={commune.value}>
                    {commune.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-sm text-slate-600">
              {currentMapsUrl
                ? "La direccion ya puede abrirse directamente en Google Maps."
                : "Completa direccion, region y comuna para habilitar Google Maps."}
            </div>
            <div className="flex flex-wrap gap-3">
              {currentMapsUrl ? (
                <Link href={currentMapsUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  Ver en Maps
                </Link>
              ) : null}
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Actualizar sede" : "Crear sede"}
              </button>
              {editingId ? (
                <button className="btn btn-ghost" type="button" onClick={resetForm}>
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </div>
        </form>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      </section>

      <section className="surface rounded-[28px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Registros</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">Sedes registradas</h3>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
            {venues.length} sede(s)
          </div>
        </div>

        {venues.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No hay sedes registradas todavía.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {venues.map((venue) => {
              const venueMapsUrl = mapsUrl({
                address: venue.address || "",
                region: venue.region || "",
                commune: venue.commune || "",
              });
              const eventName = events.find((eventItem) => eventItem.id === venue.eventId)?.name || venue.eventId;
              return (
                <article key={venue.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{eventName}</p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-950">{venue.name}</h4>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost" type="button" onClick={() => handleEdit(venue)}>
                        Editar
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => handleDelete(venue.id)}>
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Dirección</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{venue.address || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Ubicación</div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{[venue.commune, venue.region].filter(Boolean).join(" · ") || "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                    <span>Actualizada: {formatDate(venue.updatedAt)}</span>
                    {venueMapsUrl ? (
                      <Link href={venueMapsUrl} target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:text-teal-800">
                        Ver en Maps
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
