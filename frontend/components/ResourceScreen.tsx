"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import type { FieldDef, ResourceConfig } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";

type Option = { label: string; value: string };

type EventOption = Option;

type DisciplineOption = Option;

type ColumnDef = { key: string; label: string };

type FormState = Record<string, string | string[]>;

const emptyValue = (type: FieldDef["type"]) => {
  if (type === "json") return "";
  if (type === "multiselect") return [];
  if (type === "file") return "";
  return "";
};

function buildInitial(fields: FieldDef[]) {
  return fields.reduce<FormState>((acc, field) => {
    acc[field.key] = emptyValue(field.type);
    return acc;
  }, {});
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("es-ES");
    }
  }
  return String(value);
}

function parseValue(field: FieldDef, value: string | string[]) {
  if (field.type === "multiselect") {
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  }
  if (value === "") return undefined;
  if (field.key === "isDelegationLead") {
    return value === "true";
  }
  switch (field.type) {
    case "number":
      return Number(value);
    case "date":
      return value as string;
    case "datetime":
      return new Date(value).toISOString();
    case "json":
      return JSON.parse(value as string);
    case "file":
      return value as string;
    default:
      return value;
  }
}

export default function ResourceScreen({ config }: { config: ResourceConfig }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => buildInitial(config.fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);
  const [delegationOptions, setDelegationOptions] = useState<Option[]>([]);
  const [accommodationOptions, setAccommodationOptions] = useState<Option[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<Option[]>([]);
  const [flightLookup, setFlightLookup] = useState<Record<string, any>>({});
  const [driverOptions, setDriverOptions] = useState<Option[]>([]);
  const [driverUserOptions, setDriverUserOptions] = useState<Option[]>([]);
  const [athleteOptions, setAthleteOptions] = useState<Option[]>([]);
  const [driverLookup, setDriverLookup] = useState<Record<string, any>>({});
  const isAccommodation = config.endpoint === "/accommodations";

  useEffect(() => {
    if (config.endpoint !== "/accommodations") return;
    const bedKeys = ["bedSingle", "bedDouble", "bedQueen", "bedKing"];
    const totalCapacity = bedKeys.reduce((sum, key) => {
      const raw = form[key];
      const parsed = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
      return Number.isNaN(parsed) ? sum : sum + parsed;
    }, 0);
    if (form.totalCapacity !== String(totalCapacity)) {
      setForm((prev) => ({ ...prev, totalCapacity: String(totalCapacity) }));
    }
  }, [config.endpoint, form.bedSingle, form.bedDouble, form.bedQueen, form.bedKing]);

  const columns = useMemo<ColumnDef[]>(() => {
    const hidden = new Set(config.tableHiddenKeys ?? []);
    const base = [
      { key: "id", label: "ID" },
      ...config.fields
        .filter((field) => !hidden.has(field.key))
        .map((field) => ({ key: field.key, label: field.label }))
    ].filter((col) => !hidden.has(col.key));

    if (!config.tableOrder || config.tableOrder.length === 0) {
      return base;
    }

    const baseMap = new Map(base.map((col) => [col.key, col]));
    const ordered: ColumnDef[] = [];
    config.tableOrder.forEach((key) => {
      const col = baseMap.get(key);
      if (col) {
        ordered.push(col);
        baseMap.delete(key);
      }
    });
    baseMap.forEach((col) => ordered.push(col));
    return ordered;
  }, [config.fields, config.tableHiddenKeys, config.tableOrder]);
  const needsEvents = useMemo(
    () => config.fields.some((field) => field.optionsSource === "events"),
    [config.fields]
  );
  const needsDisciplines = useMemo(
    () => config.fields.some((field) => field.optionsSource === "disciplines"),
    [config.fields]
  );
  const needsDelegations = useMemo(
    () => config.fields.some((field) => field.optionsSource === "delegations"),
    [config.fields]
  );
  const needsAccommodations = useMemo(
    () => config.fields.some((field) => field.optionsSource === "accommodations"),
    [config.fields]
  );
  const needsVehicles = useMemo(
    () => config.fields.some((field) => field.optionsSource === "vehicles"),
    [config.fields]
  );
  const needsDrivers = useMemo(
    () =>
      config.fields.some((field) =>
        ["drivers", "driverUsers"].includes(field.optionsSource || "")
      ),
    [config.fields]
  );
  const needsAthletes = useMemo(
    () => config.fields.some((field) => field.optionsSource === "athletes"),
    [config.fields]
  );
  const needsFlights = useMemo(
    () =>
      config.endpoint === "/athletes" &&
      config.fields.some((field) =>
        ["flightNumber", "airline", "origin", "arrivalFlightId"].includes(field.key)
      ),
    [config.fields, config.endpoint]
  );

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Record<string, any>[]>(config.endpoint);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo cargar"));
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/events");
      const options = (data || []).map((event) => ({
        label: event.name ?? event.id,
        value: event.id
      }));
      setEventOptions(options);
    } catch (err) {
      setEventOptions([]);
    }
  };

  const loadDisciplines = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/disciplines");
      const options = (data || []).map((discipline) => ({
        label: discipline.name ?? discipline.id,
        value: discipline.id
      }));
      setDisciplineOptions(options);
    } catch (err) {
      setDisciplineOptions([]);
    }
  };

  const loadDelegations = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/delegations");
      const options = (data || []).map((delegation) => ({
        label: delegation.countryCode ?? delegation.id,
        value: delegation.id
      }));
      setDelegationOptions(options);
    } catch (err) {
      setDelegationOptions([]);
    }
  };

  const loadAccommodations = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/accommodations");
      const options = (data || []).map((hotel) => ({
        label: hotel.name ?? hotel.id,
        value: hotel.id
      }));
      setAccommodationOptions(options);
    } catch (err) {
      setAccommodationOptions([]);
    }
  };

  const loadVehicles = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/transports");
      const options = (data || []).map((vehicle) => ({
        label: vehicle.plate ?? vehicle.id,
        value: vehicle.id
      }));
      setVehicleOptions(options);
    } catch (err) {
      setVehicleOptions([]);
    }
  };

  const loadDrivers = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/drivers");
      const options = (data || []).map((driver) => ({
        label: driver.fullName ?? driver.id,
        value: driver.id
      }));
      setDriverOptions(options);
      const lookup = (data || []).reduce<Record<string, any>>((acc, driver) => {
        if (driver.userId) acc[driver.userId] = driver;
        acc[driver.id] = driver;
        return acc;
      }, {});
      setDriverLookup(lookup);
      const userOptions = (data || [])
        .filter((driver) => driver.userId)
        .map((driver) => ({
          label: driver.fullName ?? driver.userId,
          value: driver.userId
        }));
      setDriverUserOptions(userOptions);
    } catch (err) {
      setDriverOptions([]);
      setDriverUserOptions([]);
      setDriverLookup({});
    }
  };

  const loadAthletes = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/athletes");
      const options = (data || []).map((athlete) => ({
        label: athlete.fullName ?? athlete.id,
        value: athlete.id,
        delegationId: athlete.delegationId
      }));
      setAthleteOptions(options);
    } catch (err) {
      setAthleteOptions([]);
    }
  };

  const loadFlights = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/flights");
      const map: Record<string, any> = {};
      (data || []).forEach((flight) => {
        map[flight.id] = flight;
      });
      setFlightLookup(map);
    } catch (err) {
      setFlightLookup({});
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (needsEvents) {
      loadEvents();
    }
  }, [needsEvents]);

  useEffect(() => {
    if (needsDisciplines) {
      loadDisciplines();
    }
  }, [needsDisciplines]);

  useEffect(() => {
    if (needsDelegations) {
      loadDelegations();
    }
  }, [needsDelegations]);

  useEffect(() => {
    if (needsAccommodations) {
      loadAccommodations();
    }
  }, [needsAccommodations]);

  useEffect(() => {
    if (needsVehicles) {
      loadVehicles();
    }
  }, [needsVehicles]);

  useEffect(() => {
    if (needsDrivers) {
      loadDrivers();
    }
  }, [needsDrivers]);

  useEffect(() => {
    if (config.endpoint !== "/trips") return;
    const selected = form.driverId as string | undefined;
    if (!selected) return;
    const driver = driverLookup[selected];
    if (driver?.vehicleId) {
      setForm((prev) => ({ ...prev, vehicleId: driver.vehicleId }));
    }
  }, [config.endpoint, form.driverId, driverLookup]);

  useEffect(() => {
    if (needsAthletes) {
      loadAthletes();
    }
  }, [needsAthletes]);

  useEffect(() => {
    if (needsFlights) {
      loadFlights();
    }
  }, [needsFlights]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (config.endpoint === "/accommodations") {
        const bedKeys = ["bedSingle", "bedDouble", "bedQueen", "bedKing"];
        const totalCapacity = bedKeys.reduce((sum, key) => {
          const raw = form[key];
          const parsed = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
          return Number.isNaN(parsed) ? sum : sum + parsed;
        }, 0);
        if (totalCapacity <= 0) {
          setError(t("Debes ingresar al menos una cama."));
          return;
        }
        setForm((prev) => ({ ...prev, totalCapacity: String(totalCapacity) }));
      }

      const payload = config.fields.reduce<Record<string, unknown>>((acc, field) => {
        if (field.transient) {
          return acc;
        }
        const raw = form[field.key];
        if (
          (!raw || (Array.isArray(raw) && raw.length === 0)) &&
          !field.required
        ) {
          return acc;
        }
        const parsed = parseValue(field, raw);
        if (parsed !== undefined) {
          acc[field.key] = parsed;
        }
        return acc;
      }, {});

      let finalPayload = { ...payload };
      if (config.endpoint === "/accommodations") {
        const roomInventory: Record<string, number> = {};
        const bedInventory: Record<string, number> = {};

        const roomMap: Record<string, string> = {
          roomSingle: "SINGLE",
          roomDouble: "DOUBLE",
          roomTriple: "TRIPLE",
          roomSuite: "SUITE"
        };
        const bedMap: Record<string, string> = {
          bedSingle: "SINGLE",
          bedDouble: "DOUBLE",
          bedQueen: "QUEEN",
          bedKing: "KING"
        };

        Object.entries(roomMap).forEach(([fieldKey, type]) => {
          const value = form[fieldKey];
          const parsed = typeof value === "string" && value !== "" ? Number(value) : 0;
          if (!Number.isNaN(parsed) && parsed > 0) {
            roomInventory[type] = parsed;
          }
        });

        Object.entries(bedMap).forEach(([fieldKey, type]) => {
          const value = form[fieldKey];
          const parsed = typeof value === "string" && value !== "" ? Number(value) : 0;
          if (!Number.isNaN(parsed) && parsed > 0) {
            bedInventory[type] = parsed;
          }
        });

        const totalCapacity = Object.values(bedInventory).reduce(
          (sum, value) => sum + value,
          0
        );

        finalPayload = {
          ...finalPayload,
          roomInventory,
          bedInventory,
          totalCapacity
        };
      }
      if (config.endpoint === "/athletes") {
        const eventId = payload.eventId as string | undefined;
        const flightNumber = form.flightNumber as string | undefined;
        const airline = form.airline as string | undefined;
        const origin = form.origin as string | undefined;
        const terminal = form.terminal as string | undefined;
        const arrivalTime = payload.arrivalTime as string | undefined;

        if (eventId && flightNumber && airline && origin && arrivalTime) {
          const flightPayload = {
            eventId,
            flightNumber,
            airline,
            origin,
            terminal,
            arrivalTime,
          };
          const flight = await apiFetch<{ id: string }>("/flights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(flightPayload),
          });
          finalPayload = { ...payload, arrivalFlightId: flight.id };
        }
      }

      let result: Record<string, any> | null = null;

      if (editingId) {
        result = await apiFetch<Record<string, any>>(`${config.endpoint}/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload)
        });
      } else {
        result = await apiFetch<Record<string, any>>(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload)
        });
      }

      if (config.endpoint === "/drivers") {
        const photoDataUrl = form.photoDataUrl as string | undefined;
        const driverId = editingId ?? result?.id;
        if (photoDataUrl && driverId) {
          await apiFetch(`/drivers/${driverId}/photo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl: photoDataUrl })
          });
        }
      }

      setForm(buildInitial(config.fields));
      setEditingId(null);
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error al guardar"));
    }
  };

  const handleEdit = (item: Record<string, any>) => {
    const next = buildInitial(config.fields);
    config.fields.forEach((field) => {
      const value = item[field.key];
      if (value === undefined || value === null) {
        next[field.key] = field.type === "multiselect" ? [] : "";
        return;
      }
      if (field.transient) {
        if (config.endpoint === "/accommodations") {
          const roomInventory = item.roomInventory ?? {};
          const bedInventory = item.bedInventory ?? {};
          const roomMap: Record<string, string> = {
            roomSingle: "SINGLE",
            roomDouble: "DOUBLE",
            roomTriple: "TRIPLE",
            roomSuite: "SUITE"
          };
          const bedMap: Record<string, string> = {
            bedSingle: "SINGLE",
            bedDouble: "DOUBLE",
            bedQueen: "QUEEN",
            bedKing: "KING"
          };

          if (roomMap[field.key]) {
            next[field.key] = String(roomInventory[roomMap[field.key]] ?? "");
            return;
          }
          if (bedMap[field.key]) {
            next[field.key] = String(bedInventory[bedMap[field.key]] ?? "");
            return;
          }
        }

        next[field.key] = field.type === "multiselect" ? [] : "";
        return;
      }
      if (config.endpoint === "/accommodations" && field.key === "totalCapacity") {
        const bedInventory = item.bedInventory ?? {};
        const totalCapacity = Object.values(bedInventory).reduce(
          (sum: number, value: number) => sum + value,
          0
        );
        next[field.key] = String(totalCapacity);
        return;
      }
      if (field.type === "json") {
        next[field.key] = JSON.stringify(value, null, 2);
        return;
      }
      if (field.type === "datetime") {
        next[field.key] = new Date(value).toISOString().slice(0, 16);
        return;
      }
      if (field.type === "date") {
        const parsed = new Date(value);
        next[field.key] = Number.isNaN(parsed.getTime())
          ? ""
          : parsed.toISOString().slice(0, 10);
        return;
      }
      if (field.type === "multiselect") {
        next[field.key] = Array.isArray(value) ? value : [];
        return;
      }
      next[field.key] = String(value);
    });
    setForm(next);
    setEditingId(item.id ?? null);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`${config.endpoint}/${id}`, { method: "DELETE" });
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error al eliminar"));
    }
  };

  const getOptionsForField = (field: FieldDef): Option[] => {
    if (field.options) return field.options;
    if (field.optionsSource === "events") return eventOptions;
    if (field.optionsSource === "disciplines") return disciplineOptions;
    if (field.optionsSource === "delegations") return delegationOptions;
    if (field.optionsSource === "accommodations") return accommodationOptions;
    if (field.optionsSource === "vehicles") return vehicleOptions;
    if (field.optionsSource === "drivers") return driverOptions;
    if (field.optionsSource === "driverUsers") return driverUserOptions;
    if (field.optionsSource === "athletes") {
      if (config.endpoint === "/trips") {
        const delegationId = form.delegationId as string | undefined;
        if (delegationId) {
          return (athleteOptions as any[]).filter(
            (option) => option.delegationId === delegationId
          );
        }
      }
      return athleteOptions;
    }
    return [];
  };

  const resolveDisplayValue = (fieldKey: string, item: Record<string, any>) => {
    const value = item[fieldKey];
    const field = config.fields.find((item) => item.key === fieldKey);
    if (!field) return formatValue(value);
    if (config.endpoint === "/accommodations") {
      const roomMap: Record<string, string> = {
        roomSingle: "SINGLE",
        roomDouble: "DOUBLE",
        roomTriple: "TRIPLE",
        roomSuite: "SUITE"
      };
      const bedMap: Record<string, string> = {
        bedSingle: "SINGLE",
        bedDouble: "DOUBLE",
        bedQueen: "QUEEN",
        bedKing: "KING"
      };
      const roomInventory = item.roomInventory ?? {};
      const bedInventory = item.bedInventory ?? {};
      if (roomMap[field.key]) {
        return String(roomInventory[roomMap[field.key]] ?? 0);
      }
      if (bedMap[field.key]) {
        return String(bedInventory[bedMap[field.key]] ?? 0);
      }
    }
    if (field.type === "datetime") {
      return formatValue(value);
    }
    if (config.endpoint === "/athletes") {
      if (["flightNumber", "airline", "origin"].includes(fieldKey)) {
        const flightId = item.arrivalFlightId;
        if (flightId && flightLookup[flightId]) {
          const flight = flightLookup[flightId];
          if (fieldKey === "flightNumber") return flight.flightNumber ?? "-";
          if (fieldKey === "airline") return flight.airline ?? "-";
          if (fieldKey === "origin") return flight.origin ?? "-";
        }
        return "-";
      }
    }
    if (field.type === "select" || field.type === "multiselect") {
      if (config.endpoint === "/delegations" && field.key === "disciplineIds") {
        if (Array.isArray(value)) {
          return `${value.length}`;
        }
        return value ? "1" : "0";
      }
      if (config.endpoint === "/trips" && field.key === "athleteIds") {
        if (Array.isArray(value)) {
          return `${value.length}`;
        }
        return value ? "1" : "0";
      }
      if (config.endpoint === "/accommodations") {
        const roomMap: Record<string, string> = {
          roomSingle: "SINGLE",
          roomDouble: "DOUBLE",
          roomTriple: "TRIPLE",
          roomSuite: "SUITE"
        };
        const bedMap: Record<string, string> = {
          bedSingle: "SINGLE",
          bedDouble: "DOUBLE",
          bedQueen: "QUEEN",
          bedKing: "KING"
        };
        const roomInventory = item.roomInventory ?? {};
        const bedInventory = item.bedInventory ?? {};
        if (roomMap[field.key]) {
          return String(roomInventory[roomMap[field.key]] ?? 0);
        }
        if (bedMap[field.key]) {
          return String(bedInventory[bedMap[field.key]] ?? 0);
        }
      }
      const options = getOptionsForField(field);
      if (Array.isArray(value)) {
        const labels = value
          .map((entry) => options.find((option) => option.value === entry)?.label || entry)
          .filter(Boolean);
        return labels.map((label) => t(label)).join(", ");
      }
      const normalizedValue = typeof value === "boolean" ? String(value) : value;
      const matched = options.find((option) => option.value === normalizedValue);
      return matched ? t(matched.label) : formatValue(value);
    }
    return formatValue(value);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={config.name} description={config.description} />

      <section className="surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h4 className="font-display text-xl text-ink">
            {editingId ? t("Editar registro") : t("Nuevo registro")}
          </h4>
          {editingId && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setEditingId(null);
                setForm(buildInitial(config.fields));
              }}
            >
              {t("Cancelar edición")}
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {(() => {
            const renderField = (field: FieldDef) => {
              if (
                config.endpoint === "/trips" &&
                field.key === "athleteIds" &&
                !form.delegationId
              ) {
                return (
                  <div key={field.key} className="flex flex-col gap-2 text-sm text-slate-500">
                  {t("Participantes")}
                    <div className="input bg-slate-50 text-slate-400">
                      {t("Selecciona una delegación para cargar participantes.")}
                    </div>
                  </div>
                );
              }

              return (
                <label key={field.key} className="flex flex-col gap-2 text-sm text-slate-600">
                  {t(field.label)}
                  {field.type === "json" ? (
                    <textarea
                      className="input min-h-[120px]"
                      value={(form[field.key] as string) || ""}
                      placeholder={field.placeholder || "{}"}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    />
                  ) : field.type === "select" ? (
                    <select
                      className="input"
                      value={(form[field.key] as string) || ""}
                      disabled={field.readOnly}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    >
                      <option value="">{t("Selecciona una opcion")}</option>
                      {getOptionsForField(field).map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.label)}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "multiselect" ? (
                    <div className="input min-h-[120px] max-h-[220px] flex flex-col gap-2 overflow-y-auto">
                      {config.endpoint === "/trips" && field.key === "athleteIds" && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              const all = getOptionsForField(field).map((option) => option.value);
                              setForm({ ...form, [field.key]: all });
                            }}
                          >
                            {t("Seleccionar todos")}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setForm({ ...form, [field.key]: [] })}
                          >
                            {t("Limpiar")}
                          </button>
                        </div>
                      )}
                      {getOptionsForField(field).map((option) => {
                        const current = (form[field.key] as string[]) || [];
                        const checked = current.includes(option.value);
                        return (
                          <label key={option.value} className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...current, option.value]
                                  : current.filter((value) => value !== option.value);
                                setForm({ ...form, [field.key]: next });
                              }}
                            />
                            {t(option.label)}
                          </label>
                        );
                      })}
                    </div>
                  ) : field.type === "file" ? (
                    <input
                      className="input"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) {
                          setForm({ ...form, [field.key]: "" });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = reader.result;
                          setForm({
                            ...form,
                            [field.key]: typeof result === "string" ? result : ""
                          });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  ) : (
                    <input
                      className={`input ${field.readOnly ? "bg-slate-50 text-slate-500" : ""}`}
                      type={
                        field.type === "datetime"
                          ? "datetime-local"
                          : field.type === "date"
                          ? "date"
                          : field.type
                      }
                      value={(form[field.key] as string) || ""}
                      placeholder={field.placeholder}
                      readOnly={field.readOnly}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                    />
                  )}
                  {isAccommodation && field.key === "totalCapacity" && (
                    <span className="text-xs text-slate-400">
                      {t("Calculado automáticamente desde camas")}
                    </span>
                  )}
                </label>
              );
            };

            const fields = config.fields.filter((field) => !field.formHidden);
            if (!isAccommodation) {
              return fields.map((field) => renderField(field));
            }

            const byKey = new Map(fields.map((field) => [field.key, field]));
            const roomKeys = ["roomSingle", "roomDouble", "roomTriple", "roomSuite"];
            const bedKeys = ["bedSingle", "bedDouble", "bedQueen", "bedKing"];

            return (
              <>
                {["eventId", "name", "address"].map((key) => {
                  const field = byKey.get(key);
                  return field ? renderField(field) : null;
                })}

                <div className="md:col-span-2 pt-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {t("Inventario de habitaciones")}
                  </p>
                </div>
                {roomKeys.map((key) => {
                  const field = byKey.get(key);
                  return field ? renderField(field) : null;
                })}

                <div className="md:col-span-2 pt-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {t("Inventario de camas")}
                  </p>
                </div>
                {bedKeys.map((key) => {
                  const field = byKey.get(key);
                  return field ? renderField(field) : null;
                })}

                {(() => {
                  const field = byKey.get("totalCapacity");
                  return field ? renderField(field) : null;
                })()}
              </>
            );
          })()}

          <div className="flex items-end">
            <button className="btn btn-primary" type="submit">
              {editingId ? t("Actualizar") : t("Crear")}
            </button>
          </div>
        </form>
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </section>

      <section className="surface rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-display text-xl text-ink">{t("Registros")}</h4>
          <button className="btn btn-ghost" onClick={loadItems} disabled={loading}>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">{t("Sin registros aún.")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th>{t("Acciones")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id ?? JSON.stringify(item)}>
                    {columns.map((col) => (
                      <td key={col.key}>{resolveDisplayValue(col.key, item)}</td>
                    ))}
                    <td className="flex gap-2">
                      <button className="btn btn-ghost" onClick={() => handleEdit(item)}>
                        {t("Editar")}
                      </button>
                      {item.id && (
                        <button className="btn btn-ghost" onClick={() => handleDelete(item.id)}>
                          {t("Eliminar")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
      </section>
    </div>
  );
}
