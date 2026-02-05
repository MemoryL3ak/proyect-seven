"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const normalized = Array.isArray(value) ? value[0] ?? "" : value;
  const normalizedText = String(normalized ?? "");
  if (normalizedText === "") return undefined;
  if (field.key === "isDelegationLead") {
    return normalizedText === "true";
  }
  if (field.key === "createBeds") {
    return normalizedText === "true";
  }
  if (field.key === "tripCost") {
    const digits = normalizedText.replace(/[^\d]/g, "");
    return digits ? Number(digits) : undefined;
  }
  switch (field.type) {
    case "number":
      return Number(normalizedText);
    case "date":
      return normalizedText;
    case "datetime":
      return new Date(normalizedText).toISOString();
    case "json":
      return JSON.parse(normalizedText);
    case "file":
      return normalizedText;
    default:
      return normalizedText;
  }
}

function formatCurrencyCLP(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) return "";
  return `$${Number(value).toLocaleString("es-CL")}`;
}

function parseCurrencyToNumber(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : undefined;
}

export default function ResourceScreen({ config }: { config?: ResourceConfig }) {
  const { t } = useI18n();
  if (!config) {
    return (
      <section className="surface rounded-3xl p-6">
        <p className="text-sm text-rose-600">
          {t("No se pudo cargar la configuraci\u00f3n de este m\u00f3dulo.")}
        </p>
      </section>
    );
  }
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => buildInitial(config.fields));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [participantEditingId, setParticipantEditingId] = useState<string | null>(
    null
  );
  const [eventOptions, setEventOptions] = useState<EventOption[]>([]);
  const [disciplineOptions, setDisciplineOptions] = useState<DisciplineOption[]>([]);
  const [delegationOptions, setDelegationOptions] = useState<Option[]>([]);
  const [providerOptions, setProviderOptions] = useState<Option[]>([]);
  const [accommodationOptions, setAccommodationOptions] = useState<Option[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<Option[]>([]);
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, any>>({});
  const [flightLookup, setFlightLookup] = useState<Record<string, any>>({});
  const [driverOptions, setDriverOptions] = useState<Option[]>([]);
  const [driverUserOptions, setDriverUserOptions] = useState<Option[]>([]);
  const [athleteOptions, setAthleteOptions] = useState<Option[]>([]);
  const [hotelRooms, setHotelRooms] = useState<Record<string, any>[]>([]);
  const [hotelRoomOptions, setHotelRoomOptions] = useState<Option[]>([]);
  const [hotelBeds, setHotelBeds] = useState<Record<string, any>[]>([]);
  const [hotelBedOptions, setHotelBedOptions] = useState<Option[]>([]);
  const [driverLookup, setDriverLookup] = useState<Record<string, any>>({});
  const flightLookupTimerRef = useRef<number | null>(null);
  const lastFlightLookupRef = useRef<string>("");
  const plateLookupTimerRef = useRef<number | null>(null);
  const lastPlateLookupRef = useRef<string>("");
  const isAccommodation = config.endpoint === "/accommodations";
  const isTrips = config.endpoint === "/trips";

  useEffect(() => {
    if (config.endpoint !== "/accommodations") return;
    const roomKeys = ["roomSingle", "roomDouble", "roomTriple", "roomSuite"];
    const totalRooms = roomKeys.reduce((sum, key) => {
      const raw = form[key];
      const count = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
      return Number.isNaN(count) ? sum : sum + count;
    }, 0);
    if (form.totalCapacity !== String(totalRooms)) {
      setForm((prev) => ({ ...prev, totalCapacity: String(totalRooms) }));
    }
  }, [
    config.endpoint,
    form.roomSingle,
    form.roomDouble,
    form.roomTriple,
    form.roomSuite
  ]);

  const columns = useMemo<ColumnDef[]>(() => {
    const hidden = new Set(config.tableHiddenKeys ?? []);
    const includeId =
      !hidden.has("id") &&
      (!config.tableOrder || config.tableOrder.includes("id"));
    const base = [
      ...(includeId ? [{ key: "id", label: "ID" }] : []),
      ...config.fields
        .filter((field) => !hidden.has(field.key))
        .map((field) => ({ key: field.key, label: field.label }))
    ];

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
  const needsProviders = useMemo(
    () => config.fields.some((field) => field.optionsSource === "providers"),
    [config.fields]
  );
  const needsAccommodations = useMemo(
    () => config.fields.some((field) => field.optionsSource === "accommodations"),
    [config.fields]
  );
  const needsVehicles = useMemo(
    () =>
      config.fields.some((field) => field.optionsSource === "vehicles") ||
      config.endpoint === "/drivers",
    [config.fields, config.endpoint]
  );
  const needsDrivers = useMemo(
    () =>
      config.fields.some((field) =>
        ["drivers", "driverUsers"].includes(field.optionsSource || "")
      ),
    [config.fields]
  );
  const needsHotelRooms = useMemo(
    () =>
      config.fields.some((field) => field.optionsSource === "hotelRooms") ||
      config.endpoint === "/athletes",
    [config.fields, config.endpoint]
  );
  const needsHotelBeds = useMemo(
    () =>
      config.fields.some((field) => field.optionsSource === "hotelBeds") ||
      config.endpoint === "/athletes",
    [config.fields, config.endpoint]
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
      if (config.endpoint === "/delegations") {
        const [delegationsData, athletesData, disciplinesData] = await Promise.all([
          apiFetch<Record<string, any>[]>("/delegations"),
          apiFetch<Record<string, any>[]>("/athletes"),
          apiFetch<Record<string, any>[]>("/disciplines")
        ]);

        const delegationById = (delegationsData || []).reduce<Record<string, any>>(
          (acc, delegation) => {
            if (delegation?.id) acc[delegation.id] = delegation;
            return acc;
          },
          {}
        );
        const disciplineById = (disciplinesData || []).reduce<Record<string, any>>(
          (acc, discipline) => {
            if (discipline?.id) acc[discipline.id] = discipline;
            return acc;
          },
          {}
        );

        const mapped = (athletesData || []).map((athlete) => {
          const delegation = athlete.delegationId
            ? delegationById[athlete.delegationId]
            : null;
          const discipline = athlete.disciplineId
            ? disciplineById[athlete.disciplineId]
            : null;

          return {
            id: athlete.id,
            delegationId: athlete.delegationId,
            eventId: athlete.eventId ?? delegation?.eventId,
            countryCode: delegation?.countryCode ?? athlete.countryCode,
            disciplineCategory: discipline?.category ?? "-",
            disciplineGender: discipline?.gender ?? "-",
            participantFullName: athlete.fullName,
            participantEmail: athlete.email,
            participantDisciplineId: athlete.disciplineId,
            participantIsDelegationLead: athlete.isDelegationLead ? "true" : "false",
            participantCountryCode: athlete.countryCode,
            participantBirthDate: athlete.birthDate ?? "",
            participantLuggageType: athlete.luggageType ?? "",
            participantLuggageNotes: athlete.luggageNotes ?? "",
            participantArrivalTime: athlete.arrivalTime ?? "",
            participantDepartureTime: athlete.departureTime ?? "",
            participantDepartureGate: athlete.departureGate ?? "",
            participantArrivalBaggage: athlete.arrivalBaggage ?? "",
            participantFlightNumber: athlete.flightNumber ?? "",
            participantAirline: athlete.airline ?? "",
            participantOrigin: athlete.origin ?? "",
            participantHotelAccommodationId: athlete.hotelAccommodationId ?? "",
            participantRoomType: athlete.roomType ?? "",
            participantBedType: athlete.bedType ?? "",
            participantRoomNumber: athlete.roomNumber ?? "",
            participantPassportNumber: athlete.passportNumber ?? "",
            participantRut:
              athlete.countryCode === "CHL" && athlete.passportNumber
                ? athlete.passportNumber
                : ""
          };
        });

        setItems(mapped);
        return;
      }

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
        value: discipline.id,
        category: discipline.category,
        gender: discipline.gender
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

  const loadProviders = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/providers");
      const options = (data || []).map((provider) => ({
        label: provider.name ?? provider.id,
        value: provider.id
      }));
      setProviderOptions(options);
    } catch (err) {
      setProviderOptions([]);
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
      const lookup = (data || []).reduce<Record<string, any>>((acc, vehicle) => {
        if (vehicle?.id) acc[vehicle.id] = vehicle;
        return acc;
      }, {});
      setVehicleLookup(lookup);
    } catch (err) {
      setVehicleOptions([]);
      setVehicleLookup({});
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
        delegationId: athlete.delegationId,
        isDelegationLead: athlete.isDelegationLead
      }));
      setAthleteOptions(options);
    } catch (err) {
      setAthleteOptions([]);
    }
  };

  const loadHotelRooms = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/hotel-rooms");
      const options = (data || []).map((room) => ({
        label: `${room.roomNumber ?? room.id} · ${room.roomType ?? ""}`.trim(),
        value: room.id,
        hotelId: room.hotelId,
        roomType: room.roomType,
        roomNumber: room.roomNumber,
        baseBedType: room.baseBedType
      }));
      setHotelRooms(data || []);
      setHotelRoomOptions(options);
    } catch (err) {
      setHotelRooms([]);
      setHotelRoomOptions([]);
    }
  };

  const loadHotelBeds = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/hotel-beds");
      const options = (data || []).map((bed) => ({
        label: `${bed.bedType ?? "Bed"} · ${bed.id?.slice(0, 8) ?? ""}`.trim(),
        value: bed.id,
        roomId: bed.roomId,
        status: bed.status
      }));
      setHotelBeds(data || []);
      setHotelBedOptions(options);
    } catch (err) {
      setHotelBeds([]);
      setHotelBedOptions([]);
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
    if (needsProviders) {
      loadProviders();
    }
  }, [needsProviders]);

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
    if (!isTrips) return;
    const tripType = String(form.tripType ?? "");
    const vehicleId = String(form.vehicleId ?? "");
    if (!tripType || !vehicleId) return;
    const vehicleType = vehicleLookup[vehicleId]?.type;
    if (!vehicleType) return;
    const costs: Record<string, Record<string, number>> = {
      TRANSFER_IN_OUT: {
      SEDAN: 45000,
        VAN: 70000,
        MINI_BUS: 150000,
        BUS: 180000
      },
      DISPOSICION_12H: {
      SEDAN: 120000,
        VAN: 180000,
        MINI_BUS: 300000,
        BUS: 400000
      },
      IDA_VUELTA: {
      SEDAN: 70000,
        VAN: 110000,
        MINI_BUS: 160000,
        BUS: 190000
      }
    };
    const nextCost = costs[tripType]?.[vehicleType];
    if (!nextCost) return;
    setForm((prev) => ({ ...prev, tripCost: formatCurrencyCLP(nextCost) }));
  }, [form.tripType, form.vehicleId, isTrips, vehicleLookup]);

  useEffect(() => {
    if (needsDrivers) {
      loadDrivers();
    }
  }, [needsDrivers]);
  useEffect(() => {
    if (needsHotelRooms) {
      loadHotelRooms();
    }
  }, [needsHotelRooms]);
  useEffect(() => {
    if (needsHotelBeds) {
      loadHotelBeds();
    }
  }, [needsHotelBeds]);

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
    if (!isTrips) return;
    const delegationId = form.delegationId as string | undefined;
    if (!delegationId) return;
    const options = (athleteOptions as any[]).filter(
      (option) => option.delegationId === delegationId
    );
    const allIds = options.map((option) => option.value);
    if (allIds.length === 0) return;
    setForm((prev) => {
      const current = (prev.athleteIds as string[]) || [];
      if (current.length === allIds.length) return prev;
      return { ...prev, athleteIds: allIds };
    });
  }, [isTrips, form.delegationId, athleteOptions]);

  useEffect(() => {
    if (needsFlights) {
      loadFlights();
    }
  }, [needsFlights]);

  useEffect(() => {
    const isDelegationsEndpoint = config.endpoint === "/delegations";
    const flightKey = isDelegationsEndpoint
      ? "participantFlightNumber"
      : "flightNumber";
    const airlineKey = isDelegationsEndpoint ? "participantAirline" : "airline";
    const originKey = isDelegationsEndpoint ? "participantOrigin" : "origin";
    const departureGateKey = isDelegationsEndpoint
      ? "participantDepartureGate"
      : "departureGate";
    const arrivalBaggageKey = isDelegationsEndpoint
      ? "participantArrivalBaggage"
      : "arrivalBaggage";
    const raw = form[flightKey] as string | undefined;
    const value = raw?.trim();
    if (!value) return;
    if (lastFlightLookupRef.current === value) return;

    if (flightLookupTimerRef.current) {
      window.clearTimeout(flightLookupTimerRef.current);
    }

    flightLookupTimerRef.current = window.setTimeout(async () => {
      try {
        const data = await apiFetch<{
          airlineName?: string | null;
          origin?: string | null;
          departureGate?: string | null;
          arrivalBaggage?: string | null;
        }>(`/flights/lookup-airline?flightNumber=${encodeURIComponent(value)}`);
        setForm((prev) => {
          const next = { ...prev };
          if (data.airlineName) {
            next[airlineKey] = data.airlineName;
          }
          if (data.origin) {
            next[originKey] = data.origin;
          }
          if (data.departureGate) {
            next[departureGateKey] = data.departureGate;
          }
          if (data.arrivalBaggage) {
            next[arrivalBaggageKey] = data.arrivalBaggage;
          }
          return next;
        });
        lastFlightLookupRef.current = value;
      } catch {
        // Silently ignore lookup failures
      }
    }, 500);

    return () => {
      if (flightLookupTimerRef.current) {
        window.clearTimeout(flightLookupTimerRef.current);
      }
    };
  }, [config.endpoint, form.flightNumber, form.participantFlightNumber]);

  useEffect(() => {
    if (config.endpoint !== "/athletes") return;
    if (!editingId) return;
    const flightId = form.arrivalFlightId as string | undefined;
    if (!flightId) return;
    const flight = flightLookup[flightId];
    if (!flight) return;
    if (!form.flightNumber || !form.airline || !form.origin) {
      setForm((prev) => ({
        ...prev,
        flightNumber: prev.flightNumber || flight.flightNumber || "",
        airline: prev.airline || flight.airline || "",
        origin: prev.origin || flight.origin || ""
      }));
    }
  }, [config.endpoint, editingId, form.arrivalFlightId, flightLookup]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      const missingRequired = config.fields
        .filter((field) => field.required)
        .filter((field) => {
          const raw = form[field.key];
          return !raw || (Array.isArray(raw) && raw.length === 0);
        })
        .map((field) => t(field.label));

      if (missingRequired.length > 0) {
        setError(`${t("Faltan campos obligatorios")}: ${missingRequired.join(", ")}`);
        return;
      }

      if (config.endpoint === "/accommodations") {
        const roomKeys = ["roomSingle", "roomDouble", "roomTriple", "roomSuite"];
        const totalRooms = roomKeys.reduce((sum, key) => {
          const raw = form[key];
          const count = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
          return Number.isNaN(count) ? sum : sum + count;
        }, 0);
        if (totalRooms <= 0) {
          setError(t("Debes ingresar al menos una habitación."));
          return;
        }
        setForm((prev) => ({
          ...prev,
          totalCapacity: String(totalRooms)
        }));
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

      if (config.endpoint === "/hotel-rooms") {
        const baseBedType = payload.baseBedType as string | undefined;
        if (baseBedType && payload.defaultBedType === undefined) {
          payload.defaultBedType = baseBedType;
        }
      }

      if (config.endpoint === "/athletes") {
        const countryCode = payload.countryCode as string | undefined;
        if (countryCode === "CHL") {
          const rut = form.rut as string | undefined;
          if (rut) {
            payload.passportNumber = rut;
          }
        }
        if (countryCode !== "CHL") {
          delete payload.rut;
        }
      }

      if (config.endpoint === "/delegations") {
        const hasParticipant = [
          form.participantFullName,
          form.participantEmail,
          form.participantDisciplineId,
          form.participantHotelAccommodationId,
          form.participantRoomType,
          form.participantBedType,
          form.participantRoomNumber
        ].some((value) => value && String(value).trim().length > 0);

        let delegationId = editingId;
        if (editingId) {
          await apiFetch(`${config.endpoint}/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        } else {
          const created = await apiFetch<Record<string, any>>(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          delegationId = created?.id ?? null;
        }

        if (hasParticipant && delegationId) {
          const participantCountry =
            (form.participantCountryCode as string | undefined) ||
            (payload.countryCode as string | undefined);
          const participantPayload: Record<string, unknown> = {
            eventId: payload.eventId,
            delegationId,
            disciplineId: form.participantDisciplineId || undefined,
            isDelegationLead:
              form.participantIsDelegationLead !== undefined
                ? form.participantIsDelegationLead === "true"
                : true,
            fullName: form.participantFullName,
            email: form.participantEmail || undefined,
            countryCode: participantCountry,
            birthDate: form.participantBirthDate || undefined,
            luggageType: form.participantLuggageType || undefined,
            luggageNotes: form.participantLuggageNotes || undefined,
            arrivalTime: form.participantArrivalTime || undefined,
            departureTime: form.participantDepartureTime || undefined,
            departureGate: form.participantDepartureGate || undefined,
            arrivalBaggage: form.participantArrivalBaggage || undefined,
            flightNumber: form.participantFlightNumber || undefined,
            airline: form.participantAirline || undefined,
            origin: form.participantOrigin || undefined,
            hotelAccommodationId: form.participantHotelAccommodationId || undefined,
            roomType: form.participantRoomType || undefined,
            bedType: form.participantBedType || undefined,
            roomNumber: form.participantRoomNumber || undefined
          };

          if (participantCountry === "CHL") {
            const rut = (form.participantRut as string | undefined) || undefined;
            if (rut) {
              participantPayload.passportNumber = rut;
              participantPayload.rut = rut;
            }
          } else {
            participantPayload.passportNumber =
              (form.participantPassportNumber as string | undefined) || undefined;
          }

          if (!participantPayload.fullName) {
            setError(t("Faltan campos obligatorios") + ": " + t("Nombre completo"));
            return;
          }

          if (participantEditingId) {
            await apiFetch(`/athletes/${participantEditingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(participantPayload)
            });
          } else {
            await apiFetch("/athletes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(participantPayload)
            });
          }
        }

        setEditingId(null);
        setParticipantEditingId(null);
        loadItems();
        setForm(buildInitial(config.fields));
        return;
      }

      let finalPayload = { ...payload };
      if (config.endpoint === "/accommodations") {
        const roomInventory: Record<string, number> = {};

        const roomMap: Record<string, string> = {
          roomSingle: "SINGLE",
          roomDouble: "DOUBLE",
          roomTriple: "TRIPLE",
          roomSuite: "SUITE"
        };

        Object.entries(roomMap).forEach(([fieldKey, type]) => {
          const value = form[fieldKey];
          const parsed = typeof value === "string" && value !== "" ? Number(value) : 0;
          if (!Number.isNaN(parsed) && parsed > 0) {
            roomInventory[type] = parsed;
          }
        });

        const totalCapacity = Object.values(roomInventory).reduce(
          (sum, count) => sum + count,
          0
        );

        finalPayload = {
          ...finalPayload,
          roomInventory,
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
          const existingFlightId = form.arrivalFlightId as string | undefined;
          if (existingFlightId) {
            await apiFetch(`/flights/${existingFlightId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(flightPayload),
            });
            finalPayload = { ...payload, arrivalFlightId: existingFlightId };
          } else {
            const flight = await apiFetch<{ id: string }>("/flights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(flightPayload),
            });
            finalPayload = { ...payload, arrivalFlightId: flight.id };
          }
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

      if (config.endpoint === "/athletes" && payload.isDelegationLead) {
        const delegationId = payload.delegationId as string | undefined;
        const athleteId = result?.id;
        if (athleteId && delegationId) {
          await setDelegationLead(athleteId, delegationId);
        }
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
    if (config.endpoint === "/delegations") {
      setParticipantEditingId(item.id ?? null);
      setEditingId(item.delegationId ?? null);
      next.eventId = item.eventId ?? "";
      next.countryCode = item.countryCode ?? "";
      next.disciplineCategory = item.disciplineCategory ?? "";
      next.disciplineGender = item.disciplineGender ?? "";
      next.participantFullName = item.participantFullName ?? "";
      next.participantEmail = item.participantEmail ?? "";
      next.participantDisciplineId = item.participantDisciplineId ?? "";
      next.participantIsDelegationLead = item.participantIsDelegationLead ?? "false";
      next.participantCountryCode = item.participantCountryCode ?? "";
      next.participantBirthDate = item.participantBirthDate ?? "";
      next.participantLuggageType = item.participantLuggageType ?? "";
      next.participantLuggageNotes = item.participantLuggageNotes ?? "";
      next.participantArrivalTime = item.participantArrivalTime ?? "";
      next.participantDepartureTime = item.participantDepartureTime ?? "";
      next.participantDepartureGate = item.participantDepartureGate ?? "";
      next.participantArrivalBaggage = item.participantArrivalBaggage ?? "";
      next.participantFlightNumber = item.participantFlightNumber ?? "";
      next.participantAirline = item.participantAirline ?? "";
      next.participantOrigin = item.participantOrigin ?? "";
      next.participantHotelAccommodationId = item.participantHotelAccommodationId ?? "";
      next.participantRoomType = item.participantRoomType ?? "";
      next.participantBedType = item.participantBedType ?? "";
      next.participantRoomNumber = item.participantRoomNumber ?? "";
      next.participantPassportNumber = item.participantPassportNumber ?? "";
      next.participantRut = item.participantRut ?? "";
      setForm(next);
      return;
    }
    if (config.endpoint === "/trips") {
      if (item.delegationId) {
        next.delegationId = item.delegationId;
      }
      if (Array.isArray(item.athleteIds)) {
        next.athleteIds = item.athleteIds;
      }
    }
    if (config.endpoint === "/athletes" && item.countryCode === "CHL") {
      if (item.passportNumber) {
        next.rut = String(item.passportNumber);
      }
    }
    if (config.endpoint === "/athletes" && item.arrivalFlightId) {
      next.arrivalFlightId = item.arrivalFlightId;
      const flight = flightLookup[item.arrivalFlightId];
      if (flight) {
        if (flight.flightNumber) next.flightNumber = String(flight.flightNumber);
        if (flight.airline) next.airline = String(flight.airline);
        if (flight.origin) next.origin = String(flight.origin);
      }
    }
    config.fields.forEach((field) => {
      if (field.transient && config.endpoint === "/accommodations") {
        const roomInventory =
          typeof item.roomInventory === "string"
            ? JSON.parse(item.roomInventory)
            : item.roomInventory ?? {};
        const roomMap: Record<string, string> = {
          roomSingle: "SINGLE",
          roomDouble: "DOUBLE",
          roomTriple: "TRIPLE",
          roomSuite: "SUITE"
        };

        if (roomMap[field.key]) {
          next[field.key] = String(roomInventory[roomMap[field.key]] ?? 0);
          return;
        }
      }

      const value = item[field.key];
      if (value === undefined || value === null) {
        next[field.key] = field.type === "multiselect" ? [] : "";
        return;
      }
      if (field.transient) {
        next[field.key] = field.type === "multiselect" ? [] : "";
        return;
      }
      if (config.endpoint === "/accommodations" && field.key === "totalCapacity") {
        const roomInventory =
          typeof item.roomInventory === "string"
            ? JSON.parse(item.roomInventory)
            : item.roomInventory ?? {};
        const totalCapacity = Object.values(roomInventory as Record<string, number>).reduce(
          (sum, count) => sum + Number(count ?? 0),
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

  useEffect(() => {
    if (!isTrips) return;
    if (!editingId) return;
    if (form.delegationId) return;
    const currentAthletes = (form.athleteIds as string[]) || [];
    if (currentAthletes.length === 0) return;
    const first = (athleteOptions as any[]).find(
      (option) => option.value === currentAthletes[0]
    );
    if (first?.delegationId) {
      setForm((prev) => ({ ...prev, delegationId: first.delegationId }));
    }
  }, [isTrips, editingId, form.delegationId, form.athleteIds, athleteOptions]);

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      if (config.endpoint === "/delegations") {
        await apiFetch(`/athletes/${id}`, { method: "DELETE" });
        loadItems();
        return;
      }
      await apiFetch(`${config.endpoint}/${id}`, { method: "DELETE" });
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error al eliminar"));
    }
  };

  const getOptionsForField = (field: FieldDef): Option[] => {
    if (field.optionsSource === "providers") {
      return providerOptions;
    }
    if (field.optionsSource === "disciplines") {
      const category = form.disciplineCategory as string | undefined;
      const gender = form.disciplineGender as string | undefined;
      const base = (disciplineOptions as any[]).filter((option) => {
        if (category && option.category !== category) return false;
        if (gender && option.gender !== gender) return false;
        return true;
      });
      if (field.key === "disciplineIds") {
        const selected = new Set((form[field.key] as string[]) || []);
        (disciplineOptions as any[]).forEach((option) => {
          if (selected.has(option.value) && !base.find((item) => item.value === option.value)) {
            base.push(option);
          }
        });
      }
      return base;
    }
    const roomById = new Map((hotelRooms || []).map((room) => [room.id, room]));
    const availableBeds = (hotelBeds || []).filter(
      (bed) => !bed.status || bed.status === "AVAILABLE"
    );
    const availableRoomIds = new Set(
      availableBeds.map((bed) => bed.roomId).filter((id) => typeof id === "string")
    );
    const roomsWithAvailability =
      (hotelBeds || []).length > 0
        ? (hotelRooms || []).filter((room) => availableRoomIds.has(room.id))
        : hotelRooms || [];

    if (config.endpoint === "/hotel-assignments") {
      if (field.key === "roomId") {
        const selectedHotel = form.hotelId as string | undefined;
        if (!selectedHotel) return [];
        const allowAllRooms = (hotelBeds || []).length === 0;
        const baseOptions = (hotelRoomOptions as any[]).filter((option) => {
          if (option.hotelId !== selectedHotel) return false;
          const room = roomById.get(option.value);
          return allowAllRooms || !room || availableRoomIds.has(room.id);
        });
        const selectedRoom = form.roomId as string | undefined;
        if (selectedRoom && !baseOptions.find((opt) => opt.value === selectedRoom)) {
          const selectedOption = (hotelRoomOptions as any[]).find(
            (opt) => opt.value === selectedRoom
          );
          if (selectedOption) baseOptions.push(selectedOption);
        }
        return baseOptions;
      }
      if (field.key === "bedId") {
        const selectedRoom = form.roomId as string | undefined;
        if (!selectedRoom) return [];
        const baseOptions = (hotelBedOptions as any[]).filter(
          (option) =>
            option.roomId === selectedRoom &&
            (!option.status || option.status === "AVAILABLE")
        );
        const selectedBed = form.bedId as string | undefined;
        if (selectedBed && !baseOptions.find((opt) => opt.value === selectedBed)) {
          const selectedOption = (hotelBedOptions as any[]).find(
            (opt) => opt.value === selectedBed
          );
          if (selectedOption) baseOptions.push(selectedOption);
        }
        return baseOptions;
      }
    }
    if (config.endpoint === "/athletes") {
      const hotelId = form.hotelAccommodationId as string | undefined;
      const roomType = form.roomType as string | undefined;
      const bedType = form.bedType as string | undefined;

      const roomsForHotel = roomsWithAvailability.filter(
        (room) => !hotelId || room.hotelId === hotelId
      );

      if (field.key === "roomType") {
        const types = Array.from(
          new Set(
            roomsForHotel
              .map((room) => room.roomType)
              .filter((value) => typeof value === "string" && value.length > 0)
          )
        );
        return types.map((value) => ({ label: value, value }));
      }

      if (field.key === "bedType") {
        const bedsForHotel = availableBeds.filter((bed) => {
          const room = roomById.get(bed.roomId);
          if (!room) return false;
          if (hotelId && room.hotelId !== hotelId) return false;
          if (roomType && room.roomType !== roomType) return false;
          return true;
        });
        const types = Array.from(
          new Set(
            (bedsForHotel.length > 0
              ? bedsForHotel.map((bed) => bed.bedType)
              : roomsForHotel.map((room) => room.baseBedType)
            ).filter((value) => typeof value === "string" && value.length > 0)
          )
        );
        return types.map((value) => ({ label: value, value }));
      }

      if (field.key === "roomNumber") {
        const filtered = roomsForHotel.filter((room) => {
          if (roomType && room.roomType !== roomType) return false;
          if (bedType) {
            const bedMatch = availableBeds.some(
              (bed) => bed.roomId === room.id && bed.bedType === bedType
            );
            if (!bedMatch && availableBeds.length > 0) return false;
          }
          return true;
        });
        return filtered
          .map((room) => ({
            label: room.roomNumber ?? room.id,
            value: room.roomNumber ?? room.id
          }))
          .filter((option) => option.value);
      }
    }

    if (field.options) return field.options;
    if (field.optionsSource === "events") return eventOptions;
    if (field.optionsSource === "disciplines") return disciplineOptions;
    if (field.optionsSource === "delegations") return delegationOptions;
    if (field.optionsSource === "accommodations") return accommodationOptions;
    if (field.optionsSource === "vehicles") return vehicleOptions;
    if (field.optionsSource === "drivers") return driverOptions;
    if (field.optionsSource === "driverUsers") return driverUserOptions;
    if (field.optionsSource === "hotelRooms") return hotelRoomOptions;
    if (field.optionsSource === "hotelBeds") return hotelBedOptions;
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

  const setDelegationLead = async (
    athleteId: string,
    delegationId?: string | null,
    options?: { value: string; delegationId?: string | null }[]
  ) => {
    if (!delegationId) return;
    try {
      let candidates = options ?? (athleteOptions as any[]);
      if (!options || options.length === 0) {
        const data = await apiFetch<Record<string, any>[]>("/athletes");
        candidates = (data || []).map((athlete) => ({
          value: athlete.id,
          delegationId: athlete.delegationId
        }));
      }
      const sameDelegation = candidates.filter(
        (option) => option.delegationId === delegationId
      );
      await Promise.all(
        sameDelegation.map((athlete) =>
          apiFetch(`/athletes/${athlete.value}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isDelegationLead: athlete.value === athleteId })
          })
        )
      );
      await loadAthletes();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("No se pudo actualizar"));
    }
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
      const roomInventory =
        typeof item.roomInventory === "string"
          ? JSON.parse(item.roomInventory)
          : item.roomInventory ?? {};
      if (roomMap[field.key]) {
        return String(roomInventory[roomMap[field.key]] ?? 0);
      }
    }
    if (field.type === "datetime") {
      return formatValue(value);
    }
    if (fieldKey === "tripCost") {
      const numeric = typeof value === "number" ? value : parseCurrencyToNumber(String(value ?? ""));
      return formatCurrencyCLP(numeric);
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
        const roomInventory =
          typeof item.roomInventory === "string"
            ? JSON.parse(item.roomInventory)
            : item.roomInventory ?? {};
        if (roomMap[field.key]) {
          return String(roomInventory[roomMap[field.key]] ?? 0);
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

              if (config.endpoint === "/athletes") {
                const country = form.countryCode as string | undefined;
                if (field.key === "rut" && country !== "CHL") {
                  return null;
                }
                if (field.key === "passportNumber" && country === "CHL") {
                  return null;
                }
                if (
                  field.key === "luggageNotes" &&
                  (form.luggageType as string | undefined) !== "EXTRA_BAGGAGE"
                ) {
                  return null;
                }
              }
              if (config.endpoint === "/delegations") {
                if (
                  field.key === "participantLuggageNotes" &&
                  (form.participantLuggageType as string | undefined) !== "EXTRA_BAGGAGE"
                ) {
                  return null;
                }
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
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (config.endpoint === "/athletes") {
                          if (field.key === "hotelAccommodationId") {
                            setForm({
                              ...form,
                              hotelAccommodationId: nextValue,
                              roomType: "",
                              bedType: "",
                              roomNumber: ""
                            });
                            return;
                          }
                          if (field.key === "countryCode") {
                            setForm({
                              ...form,
                              countryCode: nextValue,
                              rut: nextValue === "CHL" ? (form.rut as string) || "" : "",
                              passportNumber:
                                nextValue === "CHL"
                                  ? ""
                                  : (form.passportNumber as string) || ""
                            });
                            return;
                          }
                          if (field.key === "roomType") {
                            setForm({
                              ...form,
                              roomType: nextValue,
                              bedType: "",
                              roomNumber: ""
                            });
                            return;
                          }
                          if (field.key === "bedType") {
                            setForm({ ...form, bedType: nextValue, roomNumber: "" });
                            return;
                          }
                        }
                        if (config.endpoint === "/hotel-assignments") {
                          if (field.key === "hotelId") {
                            setForm({ ...form, hotelId: nextValue, roomId: "", bedId: "" });
                            return;
                          }
                          if (field.key === "roomId") {
                            setForm({ ...form, roomId: nextValue, bedId: "" });
                            return;
                          }
                        }
                        if (config.endpoint === "/hotel-rooms" && field.key === "roomType") {
                          const capacityByType: Record<string, number> = {
                            SINGLE: 1,
                            DOUBLE: 2,
                            TRIPLE: 3,
                            SUITE: 2
                          };
                          setForm({
                            ...form,
                            roomType: nextValue,
                            bedsCapacity:
                              capacityByType[nextValue] !== undefined
                                ? String(capacityByType[nextValue])
                                : (form.bedsCapacity as string) || ""
                          });
                          return;
                        }
                        setForm({ ...form, [field.key]: nextValue });
                      }}
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
                          const isLead =
                            isTrips &&
                            field.key === "athleteIds" &&
                            (athleteOptions as any[]).find((athlete) => athlete.value === option.value)
                              ?.isDelegationLead;
                        return (
                          <label
                            key={option.value}
                            className={`flex items-center gap-2 text-sm ${
                              isLead
                                ? "rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900"
                                : "text-slate-600"
                            }`}
                          >
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
                            <span className="flex-1">{t(option.label)}</span>
                            {isLead && (
                              <span className="badge badge-amber">{t("Encargado")}</span>
                            )}
                            {isTrips && field.key === "athleteIds" && (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() =>
                                  setDelegationLead(
                                    option.value,
                                    (athleteOptions as any[]).find(
                                      (athlete) => athlete.value === option.value
                                    )?.delegationId
                                  )
                                }
                              >
                                {t("Marcar encargado")}
                              </button>
                            )}
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
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        if (config.endpoint === "/drivers" && field.key === "vehiclePlate") {
                          const normalized = rawValue
                            .trim()
                            .toUpperCase()
                            .replace(/\s+/g, "");
                          setForm({ ...form, [field.key]: rawValue });
                          if (normalized.length !== 6) return;
                          if (lastPlateLookupRef.current === normalized) return;
                          if (plateLookupTimerRef.current) {
                            window.clearTimeout(plateLookupTimerRef.current);
                          }
                          plateLookupTimerRef.current = window.setTimeout(async () => {
                            try {
                              lastPlateLookupRef.current = normalized;
                              const data = await apiFetch<{
                                brand?: string | null;
                                model?: string | null;
                              }>(`/transports/lookup-plate/${encodeURIComponent(normalized)}`);
                              setForm((prev) => {
                                const currentPlate = String(prev.vehiclePlate ?? "")
                                  .trim()
                                  .toUpperCase()
                                  .replace(/\s+/g, "");
                                if (currentPlate !== normalized) return prev;
                                return {
                                  ...prev,
                                  vehicleBrand: data?.brand ?? prev.vehicleBrand ?? "",
                                  vehicleModel: data?.model ?? prev.vehicleModel ?? ""
                                };
                              });
                            } catch {
                              // ignore lookup errors
                            }
                          }, 500);
                          return;
                        }
                        if (field.key === "tripCost") {
                          const numeric = parseCurrencyToNumber(rawValue);
                          setForm({
                            ...form,
                            [field.key]: numeric ? formatCurrencyCLP(numeric) : ""
                          });
                          return;
                        }
                        setForm({ ...form, [field.key]: rawValue });
                      }}
                    />
                  )}
                  {isAccommodation && field.key === "totalCapacity" && (
                    <span className="text-xs text-slate-400">
                      {t("Calculado automáticamente desde habitaciones")}
                    </span>
                  )}
                </label>
              );
            };

            const fields = config.fields.filter((field) => !field.formHidden);
            if (config.endpoint === "/delegations") {
              const participantCountry =
                (form.participantCountryCode as string | undefined) ?? "";
              const showRut = participantCountry === "CHL";
              const showPassport = participantCountry !== "CHL";
              const shouldRender = (field: FieldConfig) => {
                if (field.key === "participantRut") {
                  return showRut;
                }
                if (field.key === "participantPassportNumber") {
                  return showPassport;
                }
                return true;
              };

              const generalKeys = new Set([
                "eventId",
                "countryCode",
                "disciplineCategory",
                "disciplineGender"
              ]);
              const personalKeys = new Set([
                "participantFullName",
                "participantEmail",
                "participantDisciplineId",
                "participantIsDelegationLead",
                "participantCountryCode",
                "participantRut",
                "participantPassportNumber",
                "participantBirthDate"
              ]);
              const flightKeys = new Set([
                "participantFlightNumber",
                "participantAirline",
                "participantOrigin",
                "participantArrivalTime",
                "participantDepartureTime",
                "participantDepartureGate",
                "participantLuggageType",
                "participantLuggageNotes"
              ]);
              const hotelKeys = new Set([
                "participantHotelAccommodationId",
                "participantRoomType",
                "participantBedType",
                "participantRoomNumber"
              ]);

              const generalFields = fields.filter(
                (field) => generalKeys.has(field.key) && shouldRender(field)
              );
              const personalFields = fields.filter(
                (field) => personalKeys.has(field.key) && shouldRender(field)
              );
              const luggageType =
                (form.participantLuggageType as string | undefined) ?? "";
              const showLuggageNotes = luggageType === "EXTRA_BAGGAGE";
              const flightFields = fields.filter((field) => {
                if (!flightKeys.has(field.key)) return false;
                if (field.key === "participantLuggageNotes") {
                  return showLuggageNotes;
                }
                return shouldRender(field);
              });
              const hotelFields = fields.filter(
                (field) => hotelKeys.has(field.key) && shouldRender(field)
              );

              return (
                <>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Información general")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {generalFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Información personal")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {personalFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Información de vuelo")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {flightFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Hotelería")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {hotelFields.map((field) => renderField(field))}
                    </div>
                  </section>
                </>
              );
            }
            if (config.endpoint === "/athletes") {
              const hotelKeys = new Set([
                "hotelAccommodationId",
                "roomType",
                "bedType",
                "roomNumber"
              ]);
              const hotelFieldOrder = [
                "hotelAccommodationId",
                "roomType",
                "bedType",
                "roomNumber"
              ];
              const hotelFields = fields
                .filter((field) => hotelKeys.has(field.key))
                .sort(
                  (a, b) =>
                    hotelFieldOrder.indexOf(a.key) - hotelFieldOrder.indexOf(b.key)
                );
              const personalKeys = new Set([
                "eventId",
                "delegationId",
                "disciplineId",
                "isDelegationLead",
                "fullName",
                "email",
                "countryCode",
                "rut",
                "passportNumber",
                "dateOfBirth"
              ]);
              const flightKeys = new Set([
                "flightNumber",
                "airline",
                "origin",
                "arrivalTime",
                "departureTime",
                "departureGate",
                "luggageType",
                "luggageNotes"
              ]);
              const personalFields = fields.filter((field) => personalKeys.has(field.key));
              const luggageType =
                (form.luggageType as string | undefined) ?? "";
              const showLuggageNotes = luggageType === "EXTRA_BAGGAGE";
              const flightFields = fields.filter((field) => {
                if (!flightKeys.has(field.key)) return false;
                if (field.key === "luggageNotes") {
                  return showLuggageNotes;
                }
                return true;
              });
              const otherFields = fields.filter(
                (field) =>
                  !hotelKeys.has(field.key) &&
                  !personalKeys.has(field.key) &&
                  !flightKeys.has(field.key)
              );

              return (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {otherFields.map((field) => renderField(field))}
                  </div>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Información personal")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {personalFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Vuelo")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {flightFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {t("Hotelería")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {hotelFields.map((field) => renderField(field))}
                    </div>
                  </section>
                </>
              );
            }
            if (!isAccommodation) {
              return fields.map((field) => renderField(field));
            }

            const byKey = new Map(fields.map((field) => [field.key, field]));
            const roomKeys = ["roomSingle", "roomDouble", "roomTriple", "roomSuite"];
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
