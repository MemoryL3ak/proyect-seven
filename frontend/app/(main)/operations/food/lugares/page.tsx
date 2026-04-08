"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type FoodLocation = {
  id: string;
  accommodationId?: string | null;
  name: string;
  description?: string | null;
  capacity?: number | null;
  clientTypes: string[];
  createdAt: string;
  updatedAt: string;
};

type Accommodation = {
  id: string;
  name?: string | null;
};

const CLIENT_TYPES: { value: string; label: string; color: string; bg: string; border: string }[] = [
  { value: "VIP",               label: "VIP",               color: "#a855f7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)" },
  { value: "T1",                label: "T1",                color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)" },
  { value: "FAMILIA_PARAPAN",   label: "Familia Parapan",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)" },
  { value: "TA",                label: "TA",                color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)" },
  { value: "TF",                label: "TF",                color: "#06b6d4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.3)"  },
  { value: "TM",                label: "TM",                color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.3)" },
  { value: "COMITE_ORGANIZADOR",label: "Comité Org.",       color: "#64748b", bg: "rgba(100,116,139,0.1)",  border: "rgba(100,116,139,0.25)"},
  { value: "PROVEEDORES",       label: "Proveedores",       color: "#94a3b8", bg: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.25)"},
];

const CLIENT_MAP = Object.fromEntries(CLIENT_TYPES.map((c) => [c.value, c]));

type FormState = {
  name: string;
  accommodationId: string;
  description: string;
  capacity: string;
  clientTypes: string[];
};

const EMPTY_FORM: FormState = {
  name: "",
  accommodationId: "",
  description: "",
  capacity: "",
  clientTypes: [],
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
  marginBottom: "6px",
};

export default function FoodLocationsPage() {
  const [locations, setLocations] = useState<FoodLocation[]>([]);
  const [accommodations, setAccommodations] = useState<Record<string, Accommodation>>({});
  const [loading, setLoading] = useState(false);
  const [selectedClientType, setSelectedClientType] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [locData, accData] = await Promise.all([
        apiFetch<FoodLocation[]>("/food-locations"),
        apiFetch<Accommodation[]>("/accommodations"),
      ]);
      setLocations(locData || []);
      setAccommodations(
        (accData || []).reduce<Record<string, Accommodation>>((acc, a) => {
          acc[a.id] = a;
          return acc;
        }, {})
      );
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!selectedClientType) return locations;
    return locations.filter((loc) => loc.clientTypes.includes(selectedClientType));
  }, [locations, selectedClientType]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const loc of locations) {
      for (const ct of loc.clientTypes) {
        counts[ct] = (counts[ct] || 0) + 1;
      }
    }
    return counts;
  }, [locations]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (loc: FoodLocation) => {
    setForm({
      name: loc.name,
      accommodationId: loc.accommodationId || "",
      description: loc.description || "",
      capacity: loc.capacity != null ? String(loc.capacity) : "",
      clientTypes: [...loc.clientTypes],
    });
    setEditingId(loc.id);
    setShowForm(true);
    setError(null);
  };

  const toggleClientType = (value: string) => {
    setForm((f) => ({
      ...f,
      clientTypes: f.clientTypes.includes(value)
        ? f.clientTypes.filter((v) => v !== value)
        : [...f.clientTypes, value],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("El nombre del lugar es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        accommodationId: form.accommodationId || undefined,
        description: form.description || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        clientTypes: form.clientTypes,
      };
      if (editingId) {
        await apiFetch(`/food-locations/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch("/food-locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este lugar de comida?")) return;
    try {
      await apiFetch(`/food-locations/${id}`, { method: "DELETE" });
      await loadData();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "3px 10px", fontSize: "11px", fontWeight: 700, color: "#21D0B3", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Alimentación
            </span>
            <h1 style={{ marginTop: "8px", fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>Lugares de Comida</h1>
            <p style={{ marginTop: "4px", fontSize: "13px", color: "#94a3b8" }}>Recintos de alimentación y tipos de cliente asignados.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            style={{ background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", border: "none", borderRadius: "10px", padding: "9px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(33,208,179,0.3)", whiteSpace: "nowrap" }}
          >
            + Nuevo lugar
          </button>
        </div>

        {/* Client type filter chips */}
        <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setSelectedClientType("")}
            style={{
              borderRadius: "99px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              border: !selectedClientType ? "2px solid #21D0B3" : "1px solid #e2e8f0",
              background: !selectedClientType ? "rgba(33,208,179,0.1)" : "transparent",
              color: !selectedClientType ? "#21D0B3" : "#64748b",
              cursor: "pointer",
              transition: "all 120ms",
            }}
          >
            Todos ({locations.length})
          </button>
          {CLIENT_TYPES.map((ct) => {
            const count = countByType[ct.value] || 0;
            const active = selectedClientType === ct.value;
            return (
              <button
                key={ct.value}
                type="button"
                onClick={() => setSelectedClientType(active ? "" : ct.value)}
                style={{
                  borderRadius: "99px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: active ? `2px solid ${ct.color}` : `1px solid ${ct.border}`,
                  background: active ? ct.bg : "transparent",
                  color: active ? ct.color : "#64748b",
                  cursor: "pointer",
                  transition: "all 120ms",
                  opacity: count === 0 ? 0.4 : 1,
                }}
              >
                {ct.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Location cards */}
      {loading ? (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "64px 24px", textAlign: "center", color: "#94a3b8", fontSize: "13px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "64px 24px", textAlign: "center", color: "#94a3b8", fontSize: "13px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          {selectedClientType
            ? `No hay lugares asignados a ${CLIENT_MAP[selectedClientType]?.label ?? selectedClientType}.`
            : "No hay lugares de comida registrados."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((loc) => {
            const hotel = loc.accommodationId ? accommodations[loc.accommodationId] : null;
            return (
              <article
                key={loc.id}
                style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.name}</h3>
                    {hotel && (
                      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hotel.name || hotel.id}</p>
                    )}
                  </div>
                  {loc.capacity != null && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "11px",
                        fontWeight: 700,
                        background: "rgba(33,208,179,0.08)",
                        border: "1px solid rgba(33,208,179,0.25)",
                        color: "#21D0B3",
                        borderRadius: "99px",
                        padding: "3px 10px",
                      }}
                    >
                      Aforo {loc.capacity}
                    </span>
                  )}
                </div>

                {loc.description && (
                  <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.4 }}>{loc.description}</p>
                )}

                {/* Client type chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "auto" }}>
                  {loc.clientTypes.length === 0 ? (
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>Sin tipos asignados</span>
                  ) : (
                    loc.clientTypes.map((ct) => {
                      const meta = CLIENT_MAP[ct];
                      if (!meta) return (
                        <span key={ct} style={{ fontSize: "11px", borderRadius: "99px", padding: "2px 8px", background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", color: "#64748b" }}>
                          {ct}
                        </span>
                      );
                      return (
                        <span
                          key={ct}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            borderRadius: "99px",
                            padding: "3px 10px",
                            background: meta.bg,
                            border: `1px solid ${meta.border}`,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      );
                    })
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => openEdit(loc)}
                    style={{ flex: 1, fontSize: "12px", padding: "7px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontWeight: 600, cursor: "pointer" }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(loc.id)}
                    style={{ fontSize: "12px", padding: "7px 10px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "#ef4444", fontWeight: 600, cursor: "pointer" }}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 8px 32px rgba(15,23,42,0.15)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontWeight: 700, fontSize: "17px", color: "#0f172a" }}>{editingId ? "Editar lugar" : "Nuevo lugar de comida"}</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ fontSize: "16px", padding: "4px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input
                  type="text"
                  style={fieldStyle}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Comedor principal Villa Deportiva"
                />
              </div>

              <div>
                <label style={labelStyle}>Hotel / Villa</label>
                <select
                  style={fieldStyle}
                  value={form.accommodationId}
                  onChange={(e) => setForm((f) => ({ ...f, accommodationId: e.target.value }))}
                >
                  <option value="">Sin asignar</option>
                  {Object.values(accommodations).map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name || acc.id}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Descripción</label>
                  <input
                    type="text"
                    style={fieldStyle}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Descripción opcional"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Aforo</label>
                  <input
                    type="number"
                    min={1}
                    style={fieldStyle}
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                    placeholder="Ej: 200"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Tipos de cliente asignados</label>
                <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {CLIENT_TYPES.map((ct) => {
                    const active = form.clientTypes.includes(ct.value);
                    return (
                      <button
                        key={ct.value}
                        type="button"
                        onClick={() => toggleClientType(ct.value)}
                        style={{
                          borderRadius: "99px",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 700,
                          border: active ? `2px solid ${ct.color}` : `1px solid ${ct.border}`,
                          background: active ? ct.bg : "transparent",
                          color: active ? ct.color : "#64748b",
                          cursor: "pointer",
                          transition: "all 120ms",
                        }}
                      >
                        {ct.label}
                      </button>
                    );
                  })}
                </div>
                {form.clientTypes.length === 0 && (
                  <p style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8" }}>Ningún tipo seleccionado — selecciona al menos uno.</p>
                )}
              </div>
            </div>

            {error && <p style={{ fontSize: "13px", color: "#ef4444" }}>{error}</p>}

            <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: "9px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, padding: "9px 16px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, boxShadow: "0 2px 8px rgba(33,208,179,0.3)" }}
              >
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear lugar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
