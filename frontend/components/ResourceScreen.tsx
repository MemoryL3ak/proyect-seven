"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { isAthletePersonalDataValidated } from "@/lib/athletes";
import type { FieldDef, ResourceConfig } from "@/lib/resources";
import { useI18n } from "@/lib/i18n";
import StyledSelect from "@/components/StyledSelect";
import PlacesAutocompleteInput from "@/components/PlacesAutocompleteInput";

type Option = { label: string; value: string };

type EventOption = Option;

type DisciplineOption = Option;

type ColumnDef = { key: string; label: string };

type FormState = Record<string, string | string[]>;
type EventCapacityTotals = Record<string, string>;
type EventCapacityMatrix = Record<string, Record<string, string>>;
const DELEGATION_COUNTRY_OPTIONS: Option[] = [
  { label: "Argentina", value: "ARG" },
  { label: "Bolivia", value: "BOL" },
  { label: "Brasil", value: "BRA" },
  { label: "Chile", value: "CHL" },
  { label: "Colombia", value: "COL" },
  { label: "Ecuador", value: "ECU" },
  { label: "Paraguay", value: "PRY" },
  { label: "Perú", value: "PER" },
  { label: "Uruguay", value: "URY" },
  { label: "Venezuela", value: "VEN" },
  { label: "México", value: "MEX" },
  { label: "Estados Unidos", value: "USA" },
  { label: "Canadá", value: "CAN" },
  { label: "España", value: "ESP" },
  { label: "Francia", value: "FRA" },
  { label: "Alemania", value: "DEU" },
  { label: "Italia", value: "ITA" },
  { label: "Portugal", value: "PRT" },
  { label: "Reino Unido", value: "GBR" },
];

const emptyValue = (type: FieldDef["type"]) => {
  if (type === "json") return "";
  if (type === "multiselect") return [];
  if (type === "file") return "";
  return "";
};

function buildInitial(fields: FieldDef[]) {
  return fields.reduce<FormState>((acc, field) => {
    acc[field.key] = field.defaultValue ?? emptyValue(field.type);
    return acc;
  }, {});
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boolToFormValue(value: unknown) {
  return value === true ? "true" : value === false ? "false" : "";
}

function numberToFormValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  }
  if (typeof value === "string" && /\d{4}-\d{2}-\d{2}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("es-ES");
    }
  }
  return String(value);
}

function toDateTimeLocalInput(value?: string | Date | null) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function readEventAndConfig(configValue: unknown) {
  const raw =
    typeof configValue === "string"
      ? (() => {
          try {
            return configValue.trim() ? JSON.parse(configValue) : {};
          } catch {
            return {};
          }
        })()
      : typeof configValue === "object" && configValue !== null
        ? (configValue as Record<string, unknown>)
        : {};

  const totals: EventCapacityTotals = {};
  const matrix: EventCapacityMatrix = {};

  const byDiscipline = raw.andExpectedByDiscipline;
  if (byDiscipline && typeof byDiscipline === "object" && !Array.isArray(byDiscipline)) {
    Object.entries(byDiscipline as Record<string, unknown>).forEach(([disciplineId, value]) => {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n) && n >= 0) totals[disciplineId] = String(n);
    });
  }

  const byDisciplineDelegation = raw.andExpectedByDisciplineDelegation;
  if (
    byDisciplineDelegation &&
    typeof byDisciplineDelegation === "object" &&
    !Array.isArray(byDisciplineDelegation)
  ) {
    Object.entries(byDisciplineDelegation as Record<string, unknown>).forEach(
      ([disciplineId, rowValue]) => {
        if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) return;
        matrix[disciplineId] = {};
        Object.entries(rowValue as Record<string, unknown>).forEach(([delegationId, value]) => {
          const n = typeof value === "number" ? value : Number(value);
          if (Number.isFinite(n) && n >= 0) matrix[disciplineId][delegationId] = String(n);
        });
      },
    );
  }

  if (Object.keys(totals).length === 0 && Object.keys(matrix).length > 0) {
    Object.entries(matrix).forEach(([disciplineId, row]) => {
      const sum = Object.values(row).reduce((acc, raw) => {
        const n = Number(raw);
        return Number.isFinite(n) ? acc + n : acc;
      }, 0);
      totals[disciplineId] = String(sum);
    });
  }

  return { raw, totals, matrix };
}

export default function ResourceScreen({
  config,
  externalEditingId,
  refreshKey,
  onDataChanged,
  onEditRequested,
  onEditCancelled,
  viewMode = "both",
  athleteScope = "validated",
  queryParams,
}: {
  config?: ResourceConfig;
  externalEditingId?: string | null;
  refreshKey?: number;
  onDataChanged?: () => void;
  onEditRequested?: (id: string) => void;
  onEditCancelled?: () => void;
  viewMode?: "both" | "form" | "table";
  athleteScope?: "all" | "validated";
  queryParams?: Record<string, string>;
}) {
  const { t } = useI18n();
  if (!config) {
    return (
      <section className="surface p-6">
        <p className="text-sm text-rose-400">
          {t("No se pudo cargar la configuraci\u00f3n de este m\u00f3dulo.")}
        </p>
      </section>
    );
  }
  const [items, setItems] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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
  const [venueOptions, setVenueOptions] = useState<Option[]>([]);
  const [venuesRaw, setVenuesRaw] = useState<Record<string, any>[]>([]);
  const [accommodationsRaw, setAccommodationsRaw] = useState<Record<string, any>[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<Option[]>([]);
  const [vehicleLookup, setVehicleLookup] = useState<Record<string, any>>({});
  const [vehicleLookupByPlate, setVehicleLookupByPlate] = useState<Record<string, any>>({});
  const [flightLookup, setFlightLookup] = useState<Record<string, any>>({});
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athleteStatusFilter, setAthleteStatusFilter] = useState<"all" | "validated" | "pending">("all");
  const [andSearch, setAndSearch] = useState("");
  const [andTripFilter, setAndTripFilter] = useState<"all" | "ARRIVAL" | "DEPARTURE">("all");
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const [driverOptions, setDriverOptions] = useState<Option[]>([]);
  const [driverUserOptions, setDriverUserOptions] = useState<Option[]>([]);
  const [athleteOptions, setAthleteOptions] = useState<Option[]>([]);
  const [hotelRooms, setHotelRooms] = useState<Record<string, any>[]>([]);
  const [hotelRoomOptions, setHotelRoomOptions] = useState<Option[]>([]);
  const [hotelBeds, setHotelBeds] = useState<Record<string, any>[]>([]);
  const [hotelBedOptions, setHotelBedOptions] = useState<Option[]>([]);
  const [hotelExtraOptions, setHotelExtraOptions] = useState<Option[]>([]);
  const [driverLookup, setDriverLookup] = useState<Record<string, any>>({});
  const [eventCapacityTotals, setEventCapacityTotals] = useState<EventCapacityTotals>({});
  const [eventCapacityMatrix, setEventCapacityMatrix] = useState<EventCapacityMatrix>({});
  const [eventPlannerDisciplineId, setEventPlannerDisciplineId] = useState<string>("");
  const [eventPlannerDelegationCode, setEventPlannerDelegationCode] = useState<string>(
    DELEGATION_COUNTRY_OPTIONS[0]?.value ?? "",
  );
  const [eventPlannerExpectedValue, setEventPlannerExpectedValue] = useState<string>("");
  const flightLookupTimerRef = useRef<number | null>(null);
  const lastFlightLookupRef = useRef<string>("");
  const plateLookupTimerRef = useRef<number | null>(null);
  const lastPlateLookupRef = useRef<string>("");
  const isAccommodation = config.endpoint === "/accommodations";
  const isTrips = config.endpoint === "/trips";
  const isEventsEndpoint = config.endpoint === "/events";
  const roomCapacityByType: Record<string, number> = {
    SINGLE: 1,
    DOUBLE: 2,
    TRIPLE: 3,
    SUITE: 2
  };

  useEffect(() => {
    if (config.endpoint !== "/accommodations") return;
    const roomMap: Record<string, string> = {
      roomSingle: "SINGLE",
      roomDouble: "DOUBLE",
      roomTriple: "TRIPLE",
      roomSuite: "SUITE"
    };
    const totalCapacity = Object.entries(roomMap).reduce((sum, [key, type]) => {
      const raw = form[key];
      const count = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
      if (Number.isNaN(count) || count <= 0) return sum;
      return sum + count * (roomCapacityByType[type] ?? 1);
    }, 0);
    if (form.totalCapacity !== String(totalCapacity)) {
      setForm((prev) => ({ ...prev, totalCapacity: String(totalCapacity) }));
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
    () =>
      config.fields.some((field) => field.optionsSource === "delegations") ||
      config.endpoint === "/events",
    [config.fields, config.endpoint]
  );
  const needsProviders = useMemo(
    () => config.fields.some((field) => field.optionsSource === "providers"),
    [config.fields]
  );
  const needsAccommodations = useMemo(
    () => config.fields.some((field) => field.optionsSource === "accommodations" || field.optionsSource === "accommodationTowers"),
    [config.fields]
  );
  const needsHotelExtras = useMemo(
    () => config.fields.some((field) => field.optionsSource === "hotelExtras"),
    [config.fields]
  );
  const needsVenues = useMemo(
    () => config.fields.some((field) => field.optionsSource === "venues"),
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
          const metadata = readRecord(athlete.metadata);
          const luggage = readRecord(metadata.luggage);
          const arrival = readRecord(metadata.arrival);
          const departure = readRecord(metadata.departure);
          const arrivalLuggage = readRecord(arrival.luggage);
          const departureLuggage = readRecord(departure.luggage);
          const mobility = readRecord(metadata.mobility);
          const inferredTripType =
            athlete.tripType ??
            metadata.tripType ??
            (athlete.arrivalTime || arrival.time
              ? "ARRIVAL"
              : athlete.departureTime || departure.time
                ? "DEPARTURE"
                : "");
          const primaryLuggage =
            inferredTripType === "DEPARTURE" ? departureLuggage : arrivalLuggage;
          const primaryFlightNumber =
            athlete.flightNumber ??
            (inferredTripType === "DEPARTURE"
              ? String(departure.flightNumber ?? "")
              : String(arrival.flightNumber ?? ""));
          const primaryAirline =
            athlete.airline ??
            (inferredTripType === "DEPARTURE"
              ? String(departure.airline ?? "")
              : String(arrival.airline ?? ""));

          const toDateTimeLocal = (value?: string | null) =>
            toDateTimeLocalInput(value);

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
            participantBirthDate: athlete.dateOfBirth
              ? new Date(athlete.dateOfBirth).toISOString().slice(0, 10)
              : typeof metadata.dateOfBirth === "string"
                ? String(metadata.dateOfBirth)
              : "",
            participantUserType: athlete.userType ?? String(metadata.userType ?? ""),
            participantPhone: athlete.phone ?? String(metadata.phone ?? ""),
            participantVisaRequired:
              boolToFormValue(
                athlete.visaRequired ??
                  metadata.visaRequired ??
                  (typeof metadata.visaType === "string"
                    ? String(metadata.visaType).trim().toLowerCase() === "si"
                    : undefined),
              ),
            participantTripType: String(inferredTripType),
            participantArrivalTime: toDateTimeLocal(athlete.arrivalTime ?? String(arrival.time ?? "")),
            participantDepartureTime: toDateTimeLocal(athlete.departureTime ?? String(departure.time ?? "")),
            participantDepartureGate: athlete.departureGate ?? String(departure.gate ?? ""),
            participantArrivalBaggage: athlete.arrivalBaggage ?? String(arrival.baggageClaim ?? ""),
            participantFlightNumber: primaryFlightNumber,
            participantAirline: primaryAirline,
            participantOrigin: athlete.origin ?? "",
            participantBolsoCount: numberToFormValue(
              athlete.bolsoCount ?? primaryLuggage.bolsoCount ?? luggage.bolsoCount,
            ),
            participantBag8Count: numberToFormValue(
              athlete.bag8Count ?? primaryLuggage.bag8Count ?? luggage.bag8Count,
            ),
            participantSuitcase10Count: numberToFormValue(
              athlete.suitcase10Count ?? primaryLuggage.suitcase10Count ?? luggage.suitcase10Count,
            ),
            participantSuitcase15Count: numberToFormValue(
              athlete.suitcase15Count ?? primaryLuggage.suitcase15Count ?? luggage.suitcase15Count,
            ),
            participantSuitcase23Count: numberToFormValue(
              athlete.suitcase23Count ?? primaryLuggage.suitcase23Count ?? luggage.suitcase23Count,
            ),
            participantOversizeText: String(
              athlete.oversizeText ?? primaryLuggage.oversizeText ?? luggage.oversizeText ?? "",
            ),
            participantVolume: String(
              athlete.luggageVolume ?? primaryLuggage.volume ?? luggage.volume ?? ""
            ),
            participantWheelchairUser: boolToFormValue(
              athlete.wheelchairUser ?? mobility.wheelchairUser,
            ),
            participantWheelchairStandardCount: numberToFormValue(
              athlete.wheelchairStandardCount ?? mobility.wheelchairStandardCount,
            ),
            participantWheelchairSportCount: numberToFormValue(
              athlete.wheelchairSportCount ?? mobility.wheelchairSportCount,
            ),
            participantSportsEquipment: String(
              athlete.sportsEquipment ?? metadata.sportsEquipment ?? "",
            ),
            participantRequiresAssistance: boolToFormValue(
              athlete.requiresAssistance ?? metadata.requiresAssistance,
            ),
            participantObservations: String(
              athlete.observations ?? metadata.observations ?? "",
            ),
            participantHotelAccommodationId: athlete.hotelAccommodationId ?? "",
            participantRoomType: athlete.roomType ?? "",
            participantBedType: athlete.bedType ?? "",
            participantRoomNumber: athlete.roomNumber ?? "",
            participantPassportNumber: athlete.passportNumber ?? "",
            participantMetadata: metadata,
            participantRut:
              athlete.countryCode === "CHL" && athlete.passportNumber
                ? athlete.passportNumber
                : "",
            participantRegion: athlete.region ?? "",
            participantTransportType: athlete.transportType ?? "",
            participantBusPlate: athlete.busPlate ?? "",
            participantBusDriverName: athlete.busDriverName ?? "",
            participantBusCompany: athlete.busCompany ?? ""
          };
        });

        setItems(mapped);
        return;
      }

      const fetchUrl = queryParams && Object.keys(queryParams).length > 0
        ? `${config.endpoint}?${new URLSearchParams(queryParams).toString()}`
        : config.endpoint;
      const data = await apiFetch<Record<string, any>[]>(fetchUrl);
      if (config.endpoint === "/events") {
        const mapped = (Array.isArray(data) ? data : []).map((item) => {
          const parsed = readEventAndConfig(item.config);
          return {
            ...item,
            disciplineCategory:
              item.disciplineCategory ??
              (parsed.raw.disciplineCategory as string | undefined) ??
              "",
            disciplineGender:
              item.disciplineGender ??
              (parsed.raw.disciplineGender as string | undefined) ??
              "",
          };
        });
        setItems(mapped);
        return;
      }
      if (config.endpoint === "/athletes") {
        const safe = Array.isArray(data) ? data : [];
        setItems(
          athleteScope === "all"
            ? safe
            : safe.filter((item) => isAthletePersonalDataValidated(item)),
        );
        return;
      }
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
      // Only show parent disciplines (not pruebas/children which have parentId)
      const options = (data || [])
        .filter((discipline) => !discipline.parentId)
        .map((discipline) => ({
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
        value: delegation.id,
        eventId: delegation.eventId
      }));
      setDelegationOptions(options);
    } catch (err) {
      setDelegationOptions([]);
    }
  };

  const loadAccommodations = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/accommodations");
      const options = (data || []).map((hotel) => {
        const type = String(hotel.accommodationType || "HOTEL").toUpperCase();
        const tower = hotel.tower ? String(hotel.tower) : null;
        const label = type === "VILLA" && tower
          ? `${hotel.name ?? hotel.id} – Torre ${tower}`
          : (hotel.name ?? hotel.id);
        return { label, value: hotel.id, accommodationType: type, tower };
      });
      setAccommodationOptions(options);
      setAccommodationsRaw(data || []);
    } catch (err) {
      setAccommodationOptions([]);
    }
  };

  const loadHotelExtras = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/hotel-extras");
      const options = (data || []).map((extra) => ({
        label: extra.name ?? extra.id,
        value: extra.id,
        hotelId: extra.hotelId,
      }));
      setHotelExtraOptions(options);
    } catch (err) {
      setHotelExtraOptions([]);
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
      const plateLookup = (data || []).reduce<Record<string, any>>((acc, vehicle) => {
        if (vehicle?.plate) acc[vehicle.plate.trim().toUpperCase()] = vehicle;
        return acc;
      }, {});
      setVehicleLookupByPlate(plateLookup);
    } catch (err) {
      setVehicleOptions([]);
      setVehicleLookup({});
      setVehicleLookupByPlate({});
    }
  };

  const loadDrivers = async () => {
    try {
      const [data, participantsData] = await Promise.all([
        apiFetch<Record<string, any>[]>("/drivers"),
        apiFetch<Record<string, any>[]>("/provider-participants").catch(() => []),
      ]);
      const participantDrivers = (participantsData || []).filter((p) => {
        const meta = (p.metadata ?? {}) as Record<string, unknown>;
        return meta.isDriver === true || meta.isDriver === "true";
      });
      const allDrivers = [...(data || []), ...participantDrivers];
      const options = allDrivers.map((driver) => ({
        label: driver.fullName ?? driver.id,
        value: driver.id
      }));
      setDriverOptions(options);
      const lookup = allDrivers.reduce<Record<string, any>>((acc, driver) => {
        if (driver.userId) acc[driver.userId] = driver;
        acc[driver.id] = driver;
        return acc;
      }, {});
      setDriverLookup(lookup);
      // Regular drivers: indexed by userId (linked auth user)
      // Provider participant choferes: no userId, use their own id
      const CAPACITY_BY_TYPE: Record<string, number> = {
        SEDAN: 4, sedan: 4, "sedán": 4, SUV: 6, suv: 6,
        VAN_10: 10, van_10: 10, VAN_15: 17, van_15: 17, VAN_19: 19, van_19: 19,
        VAN: 10, van: 10, MINIBUS: 33, minibus: 33, "minibús": 33, MINI_BUS: 33,
        BUS: 64, bus: 64, camioneta: 6, furgon: 6, "furgón": 6,
      };
      const resolveVehicleInfo = (driver: any) => {
        if (driver.vehicleId) {
          const v = vehicleLookup[driver.vehicleId];
          const vType = v?.type ?? null;
          const cap = (v?.capacity && v.capacity > 0) ? v.capacity : (vType ? CAPACITY_BY_TYPE[vType] ?? null : null);
          return { plate: v?.plate ?? null, capacity: cap, vehicleType: vType };
        }
        const meta = driver.metadata ?? {};
        const vType = (meta.vehicleTipo as string) ?? (meta.vehicleType as string) ?? null;
        const cap = meta.vehicleCapacity ? Number(meta.vehicleCapacity) : (vType ? CAPACITY_BY_TYPE[vType] ?? null : null);
        return { plate: meta.vehiclePatente ?? meta.vehiclePlate ?? null, capacity: cap, vehicleType: vType };
      };
      const userOptions = [
        ...(data || [])
          .filter((driver) => driver.userId)
          .map((driver) => {
            const vi = resolveVehicleInfo(driver);
            return {
              label: vi.plate ? `${driver.fullName ?? driver.userId} · ${vi.plate}` : (driver.fullName ?? driver.userId),
              value: driver.userId,
              capacity: vi.capacity,
              vehicleType: vi.vehicleType,
            };
          }),
        ...participantDrivers.map((p) => {
          const vi = resolveVehicleInfo(p);
          return {
            label: vi.plate ? `${p.fullName ?? p.id} · ${vi.plate}` : (p.fullName ?? p.id),
            value: p.id,
            capacity: vi.capacity,
            vehicleType: vi.vehicleType,
          };
        }),
      ];
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
        isDelegationLead: athlete.isDelegationLead,
        userType: String(athlete.userType ?? "").trim().toUpperCase()
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
  }, [refreshKey]);

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
    if (!isEventsEndpoint) return;
    const selectedDisciplineIds = ((form.disciplineIds as string[]) || []).filter(Boolean);

    setEventCapacityTotals((prev) => {
      const next: EventCapacityTotals = {};
      selectedDisciplineIds.forEach((id) => {
        next[id] = prev[id] ?? "";
      });
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });

    setEventCapacityMatrix((prev) => {
      const next: EventCapacityMatrix = {};
      selectedDisciplineIds.forEach((disciplineId) => {
        next[disciplineId] = prev[disciplineId] ?? {};
      });
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });

    setEventPlannerDisciplineId((prev) => {
      if (prev && selectedDisciplineIds.includes(prev)) return prev;
      return selectedDisciplineIds[0] ?? "";
    });
  }, [isEventsEndpoint, form.disciplineIds]);

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
    if (needsHotelExtras) {
      loadHotelExtras();
    }
  }, [needsHotelExtras]);

  useEffect(() => {
    if (needsVenues) {
      loadVenues();
    }
  }, [needsVenues]);

  useEffect(() => {
    if (needsVehicles) {
      loadVehicles();
    }
  }, [needsVehicles]);

  useEffect(() => {
    if (!isTrips) return;
    const tripType = String(form.tripType ?? "");
    const vehicleId = String(form.vehicleId ?? "");
    const requestedVType = String(form.requestedVehicleType ?? "");
    const vehicleType = vehicleId ? vehicleLookup[vehicleId]?.type : requestedVType;
    if (!tripType || !vehicleType) return;
    const costs: Record<string, Record<string, number>> = {
      TRANSFER_IN_OUT: {
        SEDAN: 45000, SUV: 55000, VAN_10: 70000, VAN_15: 85000, VAN_19: 95000, MINIBUS: 150000, BUS: 180000,
        VAN: 70000, MINI_BUS: 150000,
      },
      DISPOSICION_12H: {
        SEDAN: 120000, SUV: 140000, VAN_10: 180000, VAN_15: 200000, VAN_19: 220000, MINIBUS: 300000, BUS: 400000,
        VAN: 180000, MINI_BUS: 300000,
      },
      IDA_VUELTA: {
        SEDAN: 70000, SUV: 80000, VAN_10: 110000, VAN_15: 125000, VAN_19: 135000, MINIBUS: 160000, BUS: 190000,
        VAN: 110000, MINI_BUS: 160000,
      },
      VIAJE_IDA: {
        SEDAN: 45000, SUV: 55000, VAN_10: 70000, VAN_15: 85000, VAN_19: 95000, MINIBUS: 150000, BUS: 180000,
        VAN: 70000, MINI_BUS: 150000,
      },
      VIAJE_IDA_REGRESO: {
        SEDAN: 70000, SUV: 80000, VAN_10: 110000, VAN_15: 125000, VAN_19: 135000, MINIBUS: 160000, BUS: 190000,
        VAN: 110000, MINI_BUS: 160000,
      },
    };
    const nextCost = costs[tripType]?.[vehicleType];
    if (!nextCost) return;
    setForm((prev) => ({ ...prev, tripCost: formatCurrencyCLP(nextCost) }));
  }, [form.tripType, form.vehicleId, form.requestedVehicleType, isTrips, vehicleLookup]);

  useEffect(() => {
    if (needsDrivers) {
      loadDrivers();
    }
  }, [needsDrivers, vehicleLookup]);
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
    if (!selected) {
      setForm((prev) => ({ ...prev, vehicleId: "", vehiclePlateDisplay: "" }));
      return;
    }
    const driver = driverLookup[selected];
    if (driver?.vehicleId) {
      const v = vehicleLookup[driver.vehicleId];
      const plate = v?.plate || "";
      setForm((prev) => ({ ...prev, vehicleId: driver.vehicleId, vehiclePlate: plate.toUpperCase(), vehiclePlateDisplay: plate.toUpperCase() }));
    } else if (driver?.metadata?.vehiclePatente) {
      const plate = String(driver.metadata.vehiclePatente).trim().toUpperCase();
      const vehicle = vehicleLookupByPlate[plate];
      if (vehicle?.id) {
        setForm((prev) => ({ ...prev, vehicleId: vehicle.id, vehiclePlate: plate, vehiclePlateDisplay: plate }));
      } else {
        setForm((prev) => ({ ...prev, vehicleId: "", vehiclePlate: plate, vehiclePlateDisplay: plate }));
      }
    } else {
      setForm((prev) => ({ ...prev, vehicleId: "", vehiclePlate: "", vehiclePlateDisplay: "Sin vehículo asignado" }));
    }
  }, [config.endpoint, form.driverId, driverLookup, vehicleLookup, vehicleLookupByPlate]);

  useEffect(() => {
    if (config.endpoint !== "/trips") return;
    const selected = form.requesterAthleteId as string | undefined;
    if (!selected) return;
    const athlete = (athleteOptions as any[]).find((o) => o.value === selected);
    if (athlete) {
      setForm((prev) => ({
        ...prev,
        ...(athlete.userType ? { clientType: athlete.userType } : {}),
        ...(athlete.delegationId ? { delegationId: athlete.delegationId } : {}),
      }));
    }
  }, [config.endpoint, form.requesterAthleteId, athleteOptions]);

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
    const value = raw?.trim().toUpperCase();
    if (!value) return;
    if (lastFlightLookupRef.current === value) return;
    const hasDigits = /\d/.test(value);
    const looksValid =
      /^[A-Z]{2,3}\d+$/.test(value) || (hasDigits && value.replace(/\D/g, "").length >= 2);
    if (!looksValid) return;

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

  useEffect(() => {
    if (config.endpoint !== "/athletes") return;
    if (!editingId) return;
    const flightId = form.arrivalFlightId as string | undefined;
    if (!flightId) return;
    if (flightLookup[flightId]) return;
    let cancelled = false;
    (async () => {
      try {
        const flight = await apiFetch<Record<string, any>>(`/flights/${flightId}`);
        if (cancelled) return;
        setFlightLookup((prev) => ({ ...prev, [flightId]: flight }));
      } catch {
        // ignore missing flight
      }
    })();
    return () => {
      cancelled = true;
    };
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

      // RUT chileno validation
      if (config.endpoint === "/athletes" && (form.countryCode as string) === "CHL") {
        const rutRaw = ((form.rut as string) ?? "").replace(/[.\-\s]/g, "").toUpperCase();
        if (rutRaw) {
          const body = rutRaw.slice(0, -1);
          const dv = rutRaw.slice(-1);
          let sum = 0, mul = 2;
          for (let i = body.length - 1; i >= 0; i--) {
            sum += Number(body[i]) * mul;
            mul = mul === 7 ? 2 : mul + 1;
          }
          const expected = 11 - (sum % 11);
          const dvExpected = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
          if (dv !== dvExpected) {
            setError(t("El RUT ingresado no es válido. Verifica el dígito verificador."));
            return;
          }
        }
      }

      if (config.endpoint === "/accommodations") {
        const roomMap: Record<string, string> = {
          roomSingle: "SINGLE",
          roomDouble: "DOUBLE",
          roomTriple: "TRIPLE",
          roomSuite: "SUITE"
        };
        const totalRooms = Object.keys(roomMap).reduce((sum, key) => {
          const raw = form[key];
          const count = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
          return Number.isNaN(count) ? sum : sum + count;
        }, 0);
        if (totalRooms <= 0) {
          setError(t("Debes ingresar al menos una habitación."));
          return;
        }
        const totalCapacity = Object.entries(roomMap).reduce((sum, [key, type]) => {
          const raw = form[key];
          const count = typeof raw === "string" && raw !== "" ? Number(raw) : 0;
          if (Number.isNaN(count) || count <= 0) return sum;
          return sum + count * (roomCapacityByType[type] ?? 1);
        }, 0);
        setForm((prev) => ({
          ...prev,
          totalCapacity: String(totalCapacity)
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
          const participantMetadata = (() => {
            const existing = { ...readRecord(form.participantMetadata) };
            const luggage = {
              bolsoCount: Number(form.participantBolsoCount || 0),
              bag8Count: Number(form.participantBag8Count || 0),
              suitcase10Count: Number(form.participantSuitcase10Count || 0),
              suitcase15Count: Number(form.participantSuitcase15Count || 0),
              suitcase23Count: Number(form.participantSuitcase23Count || 0),
              oversizeText:
                (form.participantOversizeText as string | undefined)?.trim() || null,
              volume: (form.participantVolume as string | undefined)?.trim() || null,
            };
            const mobility = {
              wheelchairUser: form.participantWheelchairUser === "true",
              wheelchairStandardCount: Number(
                form.participantWheelchairStandardCount || 0,
              ),
              wheelchairSportCount: Number(
                form.participantWheelchairSportCount || 0,
              ),
            };
            const phone = (form.participantPhone as string | undefined)?.trim();
            const tripType = (form.participantTripType as string | undefined)?.trim();
            const sportsEquipment = (
              form.participantSportsEquipment as string | undefined
            )?.trim();
            const observations = (
              form.participantObservations as string | undefined
            )?.trim();
            if (form.participantVisaRequired === "true") {
              existing.visaRequired = true;
            } else if (form.participantVisaRequired === "false") {
              existing.visaRequired = false;
            } else {
              delete existing.visaRequired;
            }
            if (phone) {
              existing.phone = phone;
            } else {
              delete existing.phone;
            }
            if (tripType) {
              existing.tripType = tripType;
            } else {
              delete existing.tripType;
            }
            if (sportsEquipment) {
              existing.sportsEquipment = sportsEquipment;
            } else {
              delete existing.sportsEquipment;
            }
            if (form.participantRequiresAssistance === "true") {
              existing.requiresAssistance = true;
            } else if (form.participantRequiresAssistance === "false") {
              existing.requiresAssistance = false;
            } else {
              delete existing.requiresAssistance;
            }
            if (observations) {
              existing.observations = observations;
            } else {
              delete existing.observations;
            }
            existing.luggage = luggage;
            existing.mobility = mobility;
            return existing;
          })();
          const luggageSummary = (() => {
            const bolsoCount = Number(form.participantBolsoCount || 0);
            const bag8Count = Number(form.participantBag8Count || 0);
            const suitcase10Count = Number(form.participantSuitcase10Count || 0);
            const suitcase15Count = Number(form.participantSuitcase15Count || 0);
            const suitcase23Count = Number(form.participantSuitcase23Count || 0);
            return [
              bolsoCount ? `${bolsoCount} bolso` : "",
              bag8Count ? `${bag8Count} maleta 8` : "",
              suitcase10Count ? `${suitcase10Count} maleta 10` : "",
              suitcase15Count ? `${suitcase15Count} maleta 15` : "",
              suitcase23Count ? `${suitcase23Count} maleta 23` : "",
              (form.participantOversizeText as string | undefined)?.trim() || "",
            ]
              .filter(Boolean)
              .join(", ");
          })();
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
            phone: (form.participantPhone as string | undefined) || undefined,
            countryCode: participantCountry,
            dateOfBirth: form.participantBirthDate || undefined,
            userType: form.participantUserType || undefined,
            visaRequired:
              form.participantVisaRequired === "true"
                ? true
                : form.participantVisaRequired === "false"
                  ? false
                  : undefined,
            tripType: form.participantTripType || undefined,
            luggageNotes: luggageSummary || undefined,
            bolsoCount: Number(form.participantBolsoCount || 0),
            bag8Count: Number(form.participantBag8Count || 0),
            suitcase10Count: Number(form.participantSuitcase10Count || 0),
            suitcase15Count: Number(form.participantSuitcase15Count || 0),
            suitcase23Count: Number(form.participantSuitcase23Count || 0),
            oversizeText:
              (form.participantOversizeText as string | undefined) || undefined,
            luggageVolume: (form.participantVolume as string | undefined) || undefined,
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
            roomNumber: form.participantRoomNumber || undefined,
            wheelchairUser:
              form.participantWheelchairUser === "true"
                ? true
                : form.participantWheelchairUser === "false"
                  ? false
                  : undefined,
            wheelchairStandardCount: Number(
              form.participantWheelchairStandardCount || 0,
            ),
            wheelchairSportCount: Number(
              form.participantWheelchairSportCount || 0,
            ),
            sportsEquipment:
              (form.participantSportsEquipment as string | undefined) || undefined,
            requiresAssistance:
              form.participantRequiresAssistance === "true"
                ? true
                : form.participantRequiresAssistance === "false"
                  ? false
                  : undefined,
            observations:
              (form.participantObservations as string | undefined) || undefined,
            region: (form.participantRegion as string | undefined) || undefined,
            transportType: (form.participantTransportType as string | undefined) || undefined,
            busPlate: (form.participantBusPlate as string | undefined) || undefined,
            busDriverName: (form.participantBusDriverName as string | undefined) || undefined,
            busCompany: (form.participantBusCompany as string | undefined) || undefined,
            metadata: participantMetadata
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
      if (config.endpoint === "/events") {
        const previousConfig = readEventAndConfig((payload as any).config).raw;
        const andExpectedByDisciplineDelegation: Record<string, Record<string, number>> = {};
        Object.entries(eventCapacityMatrix).forEach(([disciplineId, row]) => {
          const nextRow: Record<string, number> = {};
          Object.entries(row || {}).forEach(([delegationId, raw]) => {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0) nextRow[delegationId] = n;
          });
          if (Object.keys(nextRow).length > 0) {
            andExpectedByDisciplineDelegation[disciplineId] = nextRow;
          }
        });
        const andExpectedByDiscipline: Record<string, number> = {};
        Object.entries(andExpectedByDisciplineDelegation).forEach(([disciplineId, row]) => {
          const total = Object.values(row).reduce((sum, n) => sum + Number(n || 0), 0);
          if (Number.isFinite(total) && total >= 0) andExpectedByDiscipline[disciplineId] = total;
        });
        Object.entries(eventCapacityTotals).forEach(([disciplineId, raw]) => {
          if (andExpectedByDiscipline[disciplineId] !== undefined) return;
          const n = Number(raw);
          if (Number.isFinite(n) && n >= 0) andExpectedByDiscipline[disciplineId] = n;
        });

        const disciplineCategory = String(form.disciplineCategory ?? "").trim();
        const disciplineGender = String(form.disciplineGender ?? "").trim();

        finalPayload = {
          ...finalPayload,
          expectedCapacities: Object.entries(andExpectedByDisciplineDelegation).flatMap(
            ([disciplineId, row]) =>
              Object.entries(row)
                .map(([delegationKey, expectedCount]) => {
                  const delegationOption = delegationOptions.find(
                    (option) => String(option.value) === String(delegationKey),
                  );
                  const resolvedDelegationCode = String(
                    delegationOption?.label ?? delegationKey,
                  )
                    .trim()
                    .toUpperCase();

                  return {
                    disciplineId,
                    delegationCode: resolvedDelegationCode,
                    expectedCount: Number(expectedCount) || 0,
                  };
                })
                .filter((item) => item.delegationCode.length === 3),
          ),
          config: {
            ...previousConfig,
            ...(disciplineCategory
              ? { disciplineCategory }
              : { disciplineCategory: undefined }),
            ...(disciplineGender
              ? { disciplineGender }
              : { disciplineGender: undefined }),
            andExpectedByDiscipline,
            andExpectedByDisciplineDelegation
          }
        };
        if (finalPayload.config && typeof finalPayload.config === "object") {
          Object.keys(finalPayload.config as Record<string, unknown>).forEach((key) => {
            if ((finalPayload.config as Record<string, unknown>)[key] === undefined) {
              delete (finalPayload.config as Record<string, unknown>)[key];
            }
          });
        }
      }
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

        const totalCapacity = Object.entries(roomInventory).reduce((sum, [type, count]) => {
          return sum + Number(count || 0) * (roomCapacityByType[type] ?? 1);
        }, 0);

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
            finalPayload = {
              ...payload,
              arrivalFlightId: existingFlightId,
              flightNumber,
              airline,
              origin
            };
          } else {
            const flight = await apiFetch<{ id: string }>("/flights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(flightPayload),
            });
            finalPayload = {
              ...payload,
              arrivalFlightId: flight.id,
              flightNumber,
              airline,
              origin
            };
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

      if (config.endpoint === "/accommodations") {
        const accommodationId = (editingId ?? result?.id) as string | undefined;
        const roomInventory =
          (finalPayload as { roomInventory?: Record<string, number> }).roomInventory ?? {};
        if (accommodationId) {
          await apiFetch<Record<string, any>>(`/accommodations/${accommodationId}/sync-rooms`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomInventory })
          });
        }
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

      if (config.endpoint === "/athletes") {
        const photoDataUrl = form.photoDataUrl as string | undefined;
        const athleteId = editingId ?? result?.id;
        // Only upload if it's a new base64 image, not an existing URL
        const isNewPhoto = photoDataUrl && photoDataUrl.startsWith("data:");
        if (isNewPhoto && athleteId) {
          try {
            await apiFetch(`/athletes/${athleteId}/photo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataUrl: photoDataUrl })
            });
          } catch (photoErr) {
            console.error("Error subiendo foto:", photoErr);
            setError(t("Registro guardado pero la foto no se pudo subir. Intenta de nuevo."));
          }
        }
      }

      const wasEditing = !!editingId;
      setForm(buildInitial(config.fields));
      setEditingId(null);
      onEditCancelled?.();
      if (config.endpoint === "/events") {
        setEventCapacityTotals({});
        setEventCapacityMatrix({});
        setEventPlannerDisciplineId("");
        setEventPlannerDelegationCode(DELEGATION_COUNTRY_OPTIONS[0]?.value ?? "");
        setEventPlannerExpectedValue("");
      }
      setSuccessMsg(wasEditing ? t("Registro actualizado correctamente") : t("Registro creado correctamente"));
      setTimeout(() => setSuccessMsg(null), 4000);
      loadItems();
      onDataChanged?.();
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
      next.participantUserType = item.participantUserType ?? "";
      next.participantPhone = item.participantPhone ?? "";
      next.participantVisaRequired = item.participantVisaRequired ?? "";
      next.participantTripType = item.participantTripType ?? "";
      next.participantArrivalTime = item.participantArrivalTime ?? "";
      next.participantDepartureTime = item.participantDepartureTime ?? "";
      next.participantDepartureGate = item.participantDepartureGate ?? "";
      next.participantArrivalBaggage = item.participantArrivalBaggage ?? "";
      next.participantFlightNumber = item.participantFlightNumber ?? "";
      next.participantAirline = item.participantAirline ?? "";
      next.participantOrigin = item.participantOrigin ?? "";
      next.participantBolsoCount = item.participantBolsoCount ?? "";
      next.participantBag8Count = item.participantBag8Count ?? "";
      next.participantSuitcase10Count = item.participantSuitcase10Count ?? "";
      next.participantSuitcase15Count = item.participantSuitcase15Count ?? "";
      next.participantSuitcase23Count = item.participantSuitcase23Count ?? "";
      next.participantOversizeText = item.participantOversizeText ?? "";
      next.participantVolume = item.participantVolume ?? "";
      next.participantWheelchairUser = item.participantWheelchairUser ?? "";
      next.participantWheelchairStandardCount =
        item.participantWheelchairStandardCount ?? "";
      next.participantWheelchairSportCount =
        item.participantWheelchairSportCount ?? "";
      next.participantSportsEquipment = item.participantSportsEquipment ?? "";
      next.participantRequiresAssistance = item.participantRequiresAssistance ?? "";
      next.participantObservations = item.participantObservations ?? "";
      next.participantHotelAccommodationId = item.participantHotelAccommodationId ?? "";
      next.participantRoomType = item.participantRoomType ?? "";
      next.participantBedType = item.participantBedType ?? "";
      next.participantRoomNumber = item.participantRoomNumber ?? "";
      next.participantPassportNumber = item.participantPassportNumber ?? "";
      next.participantMetadata =
        item.participantMetadata && typeof item.participantMetadata === "object"
          ? item.participantMetadata
          : {};
      next.participantRut = item.participantRut ?? "";
      next.participantRegion = item.participantRegion ?? "";
      next.participantTransportType = item.participantTransportType ?? "";
      next.participantBusPlate = item.participantBusPlate ?? "";
      next.participantBusDriverName = item.participantBusDriverName ?? "";
      next.participantBusCompany = item.participantBusCompany ?? "";
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
      if (item.destinationHotelId) {
        next.destinationTypeFilter = "HOTEL";
      } else if (item.destinationVenueId) {
        next.destinationTypeFilter = "SEDE";
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

      // Load existing photo from metadata before other checks
      if ((config.endpoint === "/athletes" || config.endpoint === "/drivers") && field.key === "photoDataUrl") {
        const meta = item.metadata as Record<string, unknown> | null;
        next[field.key] = (meta?.photoUrl as string) || item.photoUrl || "";
        return;
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
        next[field.key] = toDateTimeLocalInput(value);
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
    if (config.endpoint === "/events") {
      const parsedConfig = readEventAndConfig(item.config);
      setEventCapacityTotals(parsedConfig.totals);
      setEventCapacityMatrix(parsedConfig.matrix);
      const itemDisciplineIds = Array.isArray(item.disciplineIds) ? item.disciplineIds : [];
      setEventPlannerDisciplineId(itemDisciplineIds[0] ?? "");
      setEventPlannerDelegationCode(DELEGATION_COUNTRY_OPTIONS[0]?.value ?? "");
      setEventPlannerExpectedValue("");
      if (!next.disciplineCategory) {
        next.disciplineCategory = String(parsedConfig.raw.disciplineCategory ?? "");
      }
      if (!next.disciplineGender) {
        next.disciplineGender = String(parsedConfig.raw.disciplineGender ?? "");
      }
    }
    setForm(next);
    setEditingId(item.id ?? null);
  };

  const loadVenues = async () => {
    try {
      const data = await apiFetch<Record<string, any>[]>("/venues");
      const options = (data || []).map((venue) => ({
        label: venue.name ? `${venue.name}${venue.address ? ` · ${venue.address}` : ""}` : venue.id,
        value: venue.id
      }));
      setVenueOptions(options);
      setVenuesRaw(data || []);
    } catch (err) {
      setVenueOptions([]);
    }
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

  useEffect(() => {
    if (!externalEditingId || externalEditingId === editingId) return;

    const localItem = items.find((item) => item.id === externalEditingId);
    if (localItem) {
      handleEdit(localItem);
      return;
    }

    let cancelled = false;
    apiFetch<Record<string, any>>(`${config.endpoint}/${externalEditingId}`)
      .then((item) => {
        if (cancelled || !item) return;
        handleEdit(item);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("No se pudo cargar"));
      });

    return () => {
      cancelled = true;
    };
  }, [config.endpoint, editingId, externalEditingId, items, t]);

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      if (config.endpoint === "/delegations") {
        await apiFetch(`/athletes/${id}`, { method: "DELETE" });
        loadItems();
        onDataChanged?.();
        return;
      }
      await apiFetch(`${config.endpoint}/${id}`, { method: "DELETE" });
      loadItems();
      onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error al eliminar"));
    }
  };

  const missingAthleteValidationFields = (item: Record<string, any>) => {
    const required = [
      { key: "eventId", label: "Evento" },
      { key: "fullName", label: "Nombre completo" },
      { key: "countryCode", label: "País" },
      { key: "dateOfBirth", label: "Fecha nacimiento" },
      { key: "userType", label: "Tipo de cliente" },
      { key: "disciplineId", label: "Disciplina" },
      { key: "passportNumber", label: "Pasaporte" },
    ];

    return required.filter((field) => {
      const value = item[field.key];
      if (value === null || value === undefined) return true;
      if (typeof value === "string" && value.trim() === "") return true;
      return false;
    });
  };

  const handleValidateAthlete = async (item: Record<string, any>) => {
    const missing = missingAthleteValidationFields(item);
    if (missing.length > 0) {
      setError(`Pendiente (${missing.length}): ${missing.map((field) => field.label).join(", ")}`);
      return;
    }

    const metadata =
      item.metadata && typeof item.metadata === "object"
        ? { ...item.metadata }
        : {};

    await apiFetch(`/athletes/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "PERSONAL_DATA_VALIDATED",
        metadata: {
          ...metadata,
          personalDataValidated: true,
        },
      }),
    });

    await loadItems();
    onDataChanged?.();
  };

  const getOptionsForField = (field: FieldDef): Option[] => {
    const source = field.optionsSource as string | undefined;
    const normalizeGender = (value: unknown) => {
      const normalized = String(value ?? "")
        .trim()
        .toUpperCase();
      if (!normalized) return "";
      if (normalized === "M") return "MALE";
      if (normalized === "F") return "FEMALE";
      if (normalized === "MASCULINO") return "MALE";
      if (normalized === "FEMENINO") return "FEMALE";
      if (normalized === "HOMBRES") return "MALE";
      if (normalized === "MUJERES") return "FEMALE";
      return normalized;
    };
    const normalizeCategory = (value: unknown) => {
      const normalized = String(value ?? "")
        .trim()
        .toUpperCase();
      if (!normalized) return "";
      if (normalized === "CONVENCIONAL") return "CONVENTIONAL";
      if (normalized === "PARALIMPICA") return "PARALYMPIC";
      if (normalized === "PARALÍMPICA") return "PARALYMPIC";
      return normalized;
    };
    if (field.optionsSource === "providers") {
      return providerOptions;
    }
    if (field.optionsSource === "disciplines") {
      const category = normalizeCategory(form.disciplineCategory);
      const gender = normalizeGender(form.disciplineGender);
      const base = (disciplineOptions as any[]).filter((option) => {
        const optionCategory = normalizeCategory(option.category);
        const optionGender = normalizeGender(option.gender);
        if (category && optionCategory !== category) return false;
        if (gender && optionGender !== gender) return false;
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
    if (source === "events") return eventOptions;
    if (source === "disciplines") return disciplineOptions;
    if (source === "delegations") return delegationOptions;
    if (source === "accommodationTowers") {
      const villas = (accommodationOptions as any[]).filter((opt) => opt.accommodationType === "VILLA");
      const seen = new Set<string>();
      const towers: Option[] = [{ label: "Todas", value: "" }];
      for (const opt of villas) {
        const t = opt.tower ? String(opt.tower) : null;
        if (t && !seen.has(t)) {
          seen.add(t);
          towers.push({ label: `Torre ${t}`, value: t });
        }
      }
      return towers;
    }
    if (source === "accommodations") {
      if (config.endpoint === "/hotel-assignments") {
        const typeFilter = (form.accommodationTypeFilter as string | undefined) ?? "";
        const towerFilter = (form.towerFilter as string | undefined) ?? "";
        let opts = accommodationOptions as any[];
        if (typeFilter) opts = opts.filter((opt) => opt.accommodationType === typeFilter.toUpperCase());
        if (towerFilter) opts = opts.filter((opt) => opt.tower === towerFilter);
        return opts;
      }
      return accommodationOptions;
    }
    if (source === "venues") return venueOptions;
    if (source === "vehicles") return vehicleOptions;
    if (source === "drivers") return driverOptions;
    if (source === "driverUsers") {
      if (config.endpoint === "/trips") {
        const paxCount = Number(form.passengerCount as string) || 0;
        const reqVehicleType = String(form.requestedVehicleType ?? "");
        const CAPACITY_ORDER: Record<string, number> = { SEDAN: 4, SUV: 6, VAN_10: 10, VAN_15: 17, VAN_19: 19, MINIBUS: 33, BUS: 64 };
        const minCapacity = CAPACITY_ORDER[reqVehicleType] ?? 0;
        const effectiveMin = Math.max(paxCount, minCapacity);
        if (effectiveMin > 0) {
          return (driverUserOptions as any[]).filter(
            (opt) => !opt.capacity || opt.capacity >= effectiveMin
          );
        }
      }
      return driverUserOptions;
    }
    if (source === "hotelExtras") return hotelExtraOptions;
    if (source === "hotelRooms") return hotelRoomOptions;
    if (source === "hotelBeds") return hotelBedOptions;
    if (field.optionsSource === "athletes") {
      if (config.endpoint === "/trips") {
        const delegationId = form.delegationId as string | undefined;
        if (delegationId) {
          return (athleteOptions as any[]).filter(
            (option) => option.delegationId === delegationId
          );
        }
      }
      if (config.endpoint === "/hotel-assignments") {
        const clientTypeFilter = (form.clientTypeFilter as string | undefined) ?? "";
        if (clientTypeFilter) {
          return (athleteOptions as any[]).filter(
            (option) => option.userType === clientTypeFilter.toUpperCase()
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

      {viewMode !== "table" ? (
      <section className="surface p-6" style={{ borderTop: "2px solid var(--brand)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h4 className="font-bold text-xl" style={{ color: "var(--text)" }}>
            {editingId ? t("Editar registro") : t("Nuevo registro")}
          </h4>
          {editingId && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setEditingId(null);
                setForm(buildInitial(config.fields));
                onEditCancelled?.();
                if (config.endpoint === "/events") {
                  setEventCapacityTotals({});
                  setEventCapacityMatrix({});
                  setEventPlannerDisciplineId("");
                }
              }}
            >
              {t("Cancelar edición")}
            </button>
          )}
        </div>

        {/* Visa warning */}
        {config.endpoint === "/athletes" && (form.visaRequired as string) === "true" && (
          <div style={{ padding: "12px 16px", borderRadius: "12px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#92400e", margin: 0 }}>{t("Atención: Visa requerida")}</p>
              <p style={{ fontSize: "12px", color: "#b45309", margin: "2px 0 0" }}>{t("Este participante requiere visa para ingresar al país. Asegúrate de gestionar la documentación correspondiente.")}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          {(() => {
            const renderField = (field: FieldDef) => {
              if (
                config.endpoint === "/trips" &&
                field.key === "athleteIds" &&
                !form.delegationId
              ) {
                return (
                  <div key={field.key} className="flex flex-col gap-2 text-sm">
                  {t("Participantes")}
                    <div className="input opacity-50">
                      {t("Selecciona una delegación para cargar participantes.")}
                    </div>
                  </div>
                );
              }

              if (field.showWhen) {
                const depValue = form[field.showWhen.field] as string | undefined;
                if ((depValue ?? "") !== field.showWhen.value) return null;
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
                const tripType = (form.participantTripType as string | undefined) ?? "";
                const wheelchairUser =
                  (form.participantWheelchairUser as string | undefined) === "true";
                if (
                  tripType === "ARRIVAL" &&
                  ["participantDepartureTime", "participantDepartureGate"].includes(field.key)
                ) {
                  return null;
                }
                if (
                  tripType === "DEPARTURE" &&
                  ["participantArrivalBaggage"].includes(field.key)
                ) {
                  return null;
                }
                if (
                  !wheelchairUser &&
                  [
                    "participantWheelchairStandardCount",
                    "participantWheelchairSportCount",
                  ].includes(field.key)
                ) {
                  return null;
                }
              }

              return (
                <label key={field.key} className="flex flex-col gap-2 text-sm">
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
                    <StyledSelect
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
                          if (field.key === "accommodationTypeFilter") {
                            setForm({ ...form, accommodationTypeFilter: nextValue, towerFilter: "", hotelId: "", roomId: "", bedId: "" });
                            return;
                          }
                          if (field.key === "towerFilter") {
                            setForm({ ...form, towerFilter: nextValue, hotelId: "", roomId: "", bedId: "" });
                            return;
                          }
                          if (field.key === "hotelId") {
                            setForm({ ...form, hotelId: nextValue, roomId: "", bedId: "" });
                            return;
                          }
                          if (field.key === "roomId") {
                            setForm({ ...form, roomId: nextValue, bedId: "" });
                            return;
                          }
                        }
                        if (config.endpoint === "/trips" && field.key === "destinationVenueId") {
                          const venue = venuesRaw.find((v) => v.id === nextValue);
                          const addr = venue
                            ? [venue.address, venue.commune, venue.region, "Chile"].filter(Boolean).join(", ") || venue.name || ""
                            : "";
                          setForm({ ...form, destinationVenueId: nextValue, destination: addr });
                          return;
                        }
                        if (config.endpoint === "/trips" && field.key === "destinationHotelId") {
                          const hotel = accommodationsRaw.find((h) => h.id === nextValue);
                          const addr = hotel
                            ? [hotel.address, hotel.commune, hotel.region, "Chile"].filter(Boolean).join(", ") || hotel.name || ""
                            : "";
                          setForm({ ...form, destinationHotelId: nextValue, destination: addr });
                          return;
                        }
                        if (config.endpoint === "/drivers" && field.key === "vehicleType") {
                          const capacityByType: Record<string, number> = {
                            SEDAN: 4,
                            SUV: 6,
                            VAN_10: 10,
                            VAN_15: 17,
                            VAN_19: 19,
                            MINIBUS: 33,
                            BUS: 64
                          };
                          setForm({
                            ...form,
                            vehicleType: nextValue,
                            vehicleCapacity:
                              capacityByType[nextValue] !== undefined
                                ? String(capacityByType[nextValue])
                                : (form.vehicleCapacity as string) || ""
                          });
                          return;
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
                    </StyledSelect>
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
                                ? "rounded-lg px-2 py-1 badge badge-amber"
                                : ""
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
                            <span className="flex-1" style={{ color: "var(--text)" }}>
                              {t(option.label)}
                              {(option as any).category || (option as any).gender ? (
                                <span style={{ fontSize: "10px", color: "var(--text-faint)", marginLeft: "6px" }}>
                                  {[(option as any).gender, (option as any).category].filter(Boolean).join(" · ")}
                                </span>
                              ) : null}
                            </span>
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
                  ) : field.type === "phone" ? (
                    (() => {
                      const PHONE_CODES = [
                        { code: "+56", iso: "cl", country: "Chile" },
                        { code: "+54", iso: "ar", country: "Argentina" },
                        { code: "+591", iso: "bo", country: "Bolivia" },
                        { code: "+55", iso: "br", country: "Brasil" },
                        { code: "+57", iso: "co", country: "Colombia" },
                        { code: "+593", iso: "ec", country: "Ecuador" },
                        { code: "+595", iso: "py", country: "Paraguay" },
                        { code: "+51", iso: "pe", country: "Perú" },
                        { code: "+598", iso: "uy", country: "Uruguay" },
                        { code: "+58", iso: "ve", country: "Venezuela" },
                        { code: "+52", iso: "mx", country: "México" },
                        { code: "+1", iso: "us", country: "USA" },
                        { code: "+34", iso: "es", country: "España" },
                        { code: "+33", iso: "fr", country: "Francia" },
                        { code: "+49", iso: "de", country: "Alemania" },
                        { code: "+39", iso: "it", country: "Italia" },
                        { code: "+44", iso: "gb", country: "Reino Unido" },
                      ];
                      const fullVal = (form[field.key] as string) || "";
                      const matchedCode = PHONE_CODES.find(pc => fullVal.startsWith(pc.code));
                      const currentCode = matchedCode?.code || "+56";
                      const currentNumber = matchedCode ? fullVal.slice(matchedCode.code.length).trim() : fullVal;
                      const currentEntry = PHONE_CODES.find(pc => pc.code === currentCode) || PHONE_CODES[0];
                      return (
                        <div style={{ display: "flex", gap: "6px", position: "relative" }}>
                          {/* Custom dropdown trigger */}
                          <button
                            type="button"
                            className="input"
                            onClick={() => setPhoneDropdownOpen(!phoneDropdownOpen)}
                            style={{ width: "140px", flexShrink: 0, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", textAlign: "left", padding: "0 10px" }}
                          >
                            <img src={`https://flagcdn.com/w40/${currentEntry.iso}.png`} alt={currentEntry.country} width={22} height={16} style={{ borderRadius: "3px", flexShrink: 0, objectFit: "cover" }} />
                            <span style={{ fontWeight: 600 }}>{currentEntry.code}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ marginLeft: "auto", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {/* Dropdown list */}
                          {phoneDropdownOpen && (
                            <>
                              <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setPhoneDropdownOpen(false)} />
                              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", zIndex: 51, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 8px 30px rgba(15,23,42,0.15)", maxHeight: "240px", overflowY: "auto", width: "220px" }}>
                                {PHONE_CODES.map(pc => (
                                  <button
                                    key={pc.code}
                                    type="button"
                                    onClick={() => {
                                      setForm({ ...form, [field.key]: `${pc.code} ${currentNumber}` });
                                      setPhoneDropdownOpen(false);
                                    }}
                                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", border: "none", background: pc.code === currentCode ? "rgba(33,208,179,0.08)" : "transparent", cursor: "pointer", fontSize: "13px", color: "#0f172a", textAlign: "left" }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = pc.code === currentCode ? "rgba(33,208,179,0.08)" : "transparent"; }}
                                  >
                                    <img src={`https://flagcdn.com/w40/${pc.iso}.png`} alt={pc.country} width={22} height={16} style={{ borderRadius: "3px", flexShrink: 0, objectFit: "cover" }} />
                                    <span style={{ flex: 1 }}>{pc.country}</span>
                                    <span style={{ fontWeight: 600, color: "#64748b", fontSize: "12px" }}>{pc.code}</span>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                          <input
                            className="input flex-1"
                            type="tel"
                            value={currentNumber}
                            placeholder={field.placeholder || "912345678"}
                            onChange={(e) => {
                              setForm({ ...form, [field.key]: `${currentCode} ${e.target.value}` });
                            }}
                          />
                        </div>
                      );
                    })()
                  ) : field.type === "places" ? (
                    <PlacesAutocompleteInput
                      className={`input ${field.readOnly ? "opacity-60" : ""}`}
                      value={(form[field.key] as string) || ""}
                      onChange={(val) => setForm({ ...form, [field.key]: val })}
                      onPlaceDetails={config.endpoint === "/venues" && field.key === "address" ? (details) => {
                        setForm(prev => ({
                          ...prev,
                          ...(details.region ? { region: details.region } : {}),
                          ...(details.commune ? { commune: details.commune } : {}),
                        }));
                      } : undefined}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "file" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        id={`file-${field.key}`}
                        className="sr-only"
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
                      {/* Preview */}
                      <label htmlFor={`file-${field.key}`} className="cursor-pointer" style={{ width: "52px", height: "52px", borderRadius: "12px", border: form[field.key] ? "2px solid #21D0B3" : "2px dashed #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, transition: "border-color 0.15s" }}>
                        {form[field.key] ? (
                          <img src={form[field.key] as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        )}
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label htmlFor={`file-${field.key}`} className="cursor-pointer" style={{ fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "8px", border: "none", color: "#fff", background: form[field.key] ? "#64748b" : "linear-gradient(135deg, #21D0B3, #14AE98)", display: "inline-flex", alignItems: "center", gap: "5px", boxShadow: form[field.key] ? "none" : "0 2px 8px rgba(33,208,179,0.25)" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          {form[field.key] ? "Cambiar foto" : "Subir foto"}
                        </label>
                        <span style={{ fontSize: "10px", color: form[field.key] ? "#10b981" : "#94a3b8" }}>
                          {form[field.key] ? "✓ Foto cargada" : "JPG, PNG — máx 5MB"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <input
                      className={`input ${field.readOnly ? "opacity-60" : ""}`}
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
                      {...(field.min !== undefined ? { min: field.min } : {})}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        if (config.endpoint === "/drivers" && field.key === "vehiclePlate") {
                          const normalized = rawValue
                            .trim()
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "");
                          setForm({ ...form, [field.key]: rawValue });
                          if (normalized.length < 5) return;
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
                                year?: number | null;
                              }>(`/transports/lookup-plate/${encodeURIComponent(normalized)}`);
                              setForm((prev) => {
                                const currentPlate = String(prev.vehiclePlate ?? "")
                                  .trim()
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, "");
                                if (currentPlate !== normalized) return prev;
                                const modelParts = [
                                  data?.model ?? "",
                                  data?.year !== undefined && data?.year !== null
                                    ? String(data.year)
                                    : ""
                                ]
                                  .map((part) => String(part).trim())
                                  .filter(Boolean);
                                return {
                                  ...prev,
                                  vehicleBrand: data?.brand ?? prev.vehicleBrand ?? "",
                                  vehicleModel:
                                    modelParts.length > 0
                                      ? modelParts.join(" ")
                                      : (prev.vehicleModel as string) ?? ""
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
                        if (field.type === "number" && field.min !== undefined) {
                          const num = Number(rawValue);
                          if (rawValue !== "" && Number.isFinite(num) && num < field.min) {
                            setForm({ ...form, [field.key]: String(field.min) });
                            return;
                          }
                        }
                        setForm({ ...form, [field.key]: rawValue });
                      }}
                    />
                  )}
                  {isAccommodation && field.key === "totalCapacity" && (
                    <span className="text-xs" style={{color:"var(--text-faint)"}}>
                      {t("Calculado automáticamente desde habitaciones")}
                    </span>
                  )}
                  {config.endpoint === "/athletes" && field.key === "rut" && (() => {
                    const rutRaw = ((form.rut as string) ?? "").replace(/[.\-\s]/g, "").toUpperCase();
                    if (!rutRaw || rutRaw.length < 2) return null;
                    const body = rutRaw.slice(0, -1);
                    const dv = rutRaw.slice(-1);
                    if (!/^\d+$/.test(body)) return <span style={{ fontSize: "11px", color: "#ef4444" }}>RUT debe contener solo números y dígito verificador</span>;
                    let sum = 0, mul = 2;
                    for (let i = body.length - 1; i >= 0; i--) { sum += Number(body[i]) * mul; mul = mul === 7 ? 2 : mul + 1; }
                    const expected = 11 - (sum % 11);
                    const dvExpected = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
                    if (dv !== dvExpected) return <span style={{ fontSize: "11px", color: "#ef4444", display: "flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      RUT inválido — dígito verificador incorrecto (esperado: {dvExpected})
                    </span>;
                    return <span style={{ fontSize: "11px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      RUT válido
                    </span>;
                  })()}
                </label>
              );
            };

            const fields = config.fields.filter((field) => !field.formHidden);
            if (config.endpoint === "/delegations") {
              const participantCountry =
                (form.participantCountryCode as string | undefined) ?? "";
              const showRut = participantCountry === "CHL";
              const showPassport = participantCountry !== "CHL";
              const delegationCountry = (form.countryCode as string | undefined) ?? "";
              const participantTransportType = (form.participantTransportType as string | undefined) ?? "";
              const participantTripType = (form.participantTripType as string | undefined) ?? "";
              const shouldRender = (field: FieldDef) => {
                if (field.key === "participantRut") return showRut;
                if (field.key === "participantPassportNumber") return showPassport;
                if (field.key === "participantRegion") return delegationCountry === "CHL";
                if (field.key === "participantArrivalTime") return participantTripType === "ARRIVAL";
                if (field.key === "participantDepartureTime") return participantTripType === "DEPARTURE";
                if (field.key === "participantDepartureGate") return participantTripType === "DEPARTURE" && participantTransportType === "AVION";
                if (field.key === "participantArrivalBaggage") return participantTripType === "ARRIVAL" && participantTransportType === "AVION";
                if (["participantFlightNumber", "participantAirline", "participantOrigin"].includes(field.key)) return participantTransportType === "AVION";
                if (["participantBusPlate", "participantBusDriverName", "participantBusCompany"].includes(field.key)) return participantTransportType === "BUS";
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
                "participantUserType",
                "participantPhone",
                "participantEmail",
                "participantDisciplineId",
                "participantIsDelegationLead",
                "participantCountryCode",
                "participantRut",
                "participantPassportNumber",
                "participantVisaRequired",
                "participantBirthDate"
              ]);
              const tripKeys = new Set([
                "participantTripType",
                "participantFlightNumber",
                "participantAirline",
                "participantOrigin",
                "participantArrivalTime",
                "participantDepartureTime",
                "participantDepartureGate",
                "participantArrivalBaggage",
                "participantRegion",
                "participantTransportType",
                "participantBusPlate",
                "participantBusDriverName",
                "participantBusCompany"
              ]);
              const luggageKeys = new Set([
                "participantBolsoCount",
                "participantBag8Count",
                "participantSuitcase10Count",
                "participantSuitcase15Count",
                "participantSuitcase23Count",
                "participantOversizeText",
                "participantVolume"
              ]);
              const assistanceKeys = new Set([
                "participantWheelchairUser",
                "participantWheelchairStandardCount",
                "participantWheelchairSportCount",
                "participantSportsEquipment",
                "participantRequiresAssistance",
                "participantObservations"
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
              const tripType = (form.participantTripType as string | undefined) ?? "";
              const tripFields = fields.filter(
                (field) => tripKeys.has(field.key) && shouldRender(field)
              );
              const luggageFields = fields.filter(
                (field) => luggageKeys.has(field.key) && shouldRender(field)
              );
              const assistanceFields = fields.filter(
                (field) => assistanceKeys.has(field.key) && shouldRender(field)
              );
              const hotelFields = fields.filter(
                (field) => hotelKeys.has(field.key) && shouldRender(field)
              );

              return (
                <>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Información general")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {generalFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Información personal")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {personalFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Itinerario")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {tripFields.map((field) => renderField(field))}
                    </div>
                    {tripType ? (
                      <p className="mt-3 text-xs" style={{color:"var(--text-muted)"}}>
                        {tripType === "ARRIVAL"
                          ? t("Se muestran los campos operativos de llegada.")
                          : t("Se muestran los campos operativos de salida.")}
                      </p>
                    ) : null}
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Equipaje")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {luggageFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Movilidad y asistencia")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {assistanceFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
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
              const athleteCountry = (form.countryCode as string | undefined) ?? "";
              const personalKeys = new Set([
                "eventId",
                "delegationId",
                "disciplineCategory",
                "disciplineGender",
                "disciplineId",
                "isDelegationLead",
                "fullName",
                "email",
                "countryCode",
                "rut",
                "passportNumber",
                "dateOfBirth",
                "dietaryNeeds",
                "region"
              ]);
              const flightKeys = new Set([
                "tripType",
                "transportType",
                "flightNumber",
                "airline",
                "origin",
                "arrivalTime",
                "departureTime",
                "departureGate",
                "luggageType",
                "luggageNotes"
              ]);
              const transportKeys = new Set([
                "busPlate",
                "busDriverName",
                "busCompany"
              ]);
              const personalFields = fields.filter((field) => {
                if (!personalKeys.has(field.key)) return false;
                if (field.key === "region") return athleteCountry === "CHL";
                return true;
              });
              const luggageType =
                (form.luggageType as string | undefined) ?? "";
              const showLuggageNotes = luggageType === "EXTRA_BAGGAGE";
              const tripTypeValue = (form.tripType as string | undefined) ?? "";
              const transportTypeValue = (form.transportType as string | undefined) ?? "";
              const flightFields = fields.filter((field) => {
                if (!flightKeys.has(field.key)) return false;
                if (field.key === "luggageNotes") return showLuggageNotes;
                if (field.key === "arrivalTime") return tripTypeValue === "ARRIVAL";
                if (field.key === "departureTime") return tripTypeValue === "DEPARTURE";
                if (field.key === "departureGate") return tripTypeValue === "DEPARTURE" && transportTypeValue === "AVION";
                if (["flightNumber", "airline", "origin"].includes(field.key)) return transportTypeValue === "AVION";
                return true;
              });
              const transportFields = fields.filter((field) => {
                if (!transportKeys.has(field.key)) return false;
                return transportTypeValue === "BUS";
              });
              const otherFields = fields.filter(
                (field) =>
                  !hotelKeys.has(field.key) &&
                  !personalKeys.has(field.key) &&
                  !flightKeys.has(field.key) &&
                  !transportKeys.has(field.key)
              );

              return (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    {otherFields.map((field) => renderField(field))}
                  </div>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Información personal")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {personalFields.map((field) => renderField(field))}
                    </div>
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Viaje")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {flightFields.map((field) => renderField(field))}
                      {transportFields.map((field) => renderField(field))}
                    </div>
                    {transportTypeValue === "BUS" && (
                      <p className="mt-3 text-xs" style={{color:"var(--text-muted)"}}>
                        {t("Complete los datos del bus de traslado.")}
                      </p>
                    )}
                  </section>
                  <section className="surface md:col-span-2 p-5">
                    <div className="mb-4">
                      <p className="section-label">
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
            if (config.endpoint === "/events") {
              const byKey = new Map(fields.map((field) => [field.key, field]));
              const renderKeys = (keys: string[]) =>
                keys.map((key) => {
                  const field = byKey.get(key);
                  return field ? renderField(field) : null;
                });

              const selectedDisciplineIds = ((form.disciplineIds as string[]) || []).filter(Boolean);
              const selectedDisciplineOptions = (disciplineOptions as any[])
                .filter((option) => selectedDisciplineIds.includes(option.value))
                .sort((a, b) => String(a.label || a.value).localeCompare(String(b.label || b.value)));
              const expectedByDisciplineFromMatrix = selectedDisciplineOptions.reduce<Record<string, number>>(
                (acc, option) => {
                  const row = eventCapacityMatrix[option.value] || {};
                  const subtotal = Object.values(row).reduce((sum, raw) => {
                    const n = Number(raw || 0);
                    return Number.isFinite(n) ? sum + n : sum;
                  }, 0);
                  acc[option.value] = subtotal;
                  return acc;
                },
                {},
              );
              const totalExpected = selectedDisciplineOptions.reduce((sum, option) => {
                const n = Number(expectedByDisciplineFromMatrix[option.value] || eventCapacityTotals[option.value] || 0);
                return Number.isFinite(n) ? sum + n : sum;
              }, 0);
              const plannerDisciplineId = eventPlannerDisciplineId || selectedDisciplineIds[0] || "";
              const plannerDisciplineOption = selectedDisciplineOptions.find(
                (option) => option.value === plannerDisciplineId,
              );
              const plannerRow = plannerDisciplineOption
                ? (eventCapacityMatrix[plannerDisciplineOption.value] || {})
                : {};

              return (
                <>
                  <section className="surface md:col-span-2 p-5" style={{ borderTop: "2px solid var(--brand)" }}>
                    <div className="mb-4">
                      <p className="section-label">
                        {t("Datos generales")}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {renderKeys(["name", "country", "city", "startDate", "endDate"])}
                    </div>
                  </section>

                  <section className="surface md:col-span-2 p-5" style={{ borderTop: "2px solid #1FCDFF" }}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="section-label">
                          {t("Configuración deportiva")}
                        </p>
                        <p className="mt-1 text-sm" style={{color:"var(--text-muted)"}}>
                          {t("Define disciplinas del evento y su capacidad esperada de registro AND.")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span style={{ borderRadius: "99px", border: "1px solid var(--border)", background: "var(--elevated)", padding: "2px 12px", fontSize: "11px", color: "var(--text-muted)" }}>
                          {selectedDisciplineIds.length} disciplinas
                        </span>
                        <span style={{ borderRadius: "99px", border: "1px solid rgba(33,208,179,0.35)", background: "rgba(33,208,179,0.1)", padding: "2px 12px", fontSize: "11px", fontWeight: 700, color: "var(--brand)" }}>
                          Total esperado {totalExpected}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {renderKeys(["disciplineCategory", "disciplineGender"])}
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <div style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)", borderTop: "2px solid var(--brand)", padding: "16px" }}>
                        <div className="mb-3">
                          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand)", marginBottom: "3px" }}>
                            {t("Disciplinas del evento")}
                          </p>
                          <p className="text-sm" style={{color:"var(--text-muted)"}}>
                            {t("Selecciona las disciplinas que participarán en este evento.")}
                          </p>
                        </div>
                        {renderKeys(["disciplineIds"])}
                      </div>

                      <div style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface)", borderTop: "2px solid #1FCDFF", padding: "16px" }}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1FCDFF", marginBottom: "3px" }}>Planificación AND</p>
                            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Capacidad esperada por delegación y disciplina</p>
                          </div>
                          <span style={{ borderRadius: "99px", border: "1px solid rgba(31,205,255,0.35)", background: "rgba(31,205,255,0.1)", padding: "2px 12px", fontSize: "11px", fontWeight: 700, color: "#1FCDFF" }}>
                            Total esperado {totalExpected}
                          </span>
                        </div>

                        {selectedDisciplineIds.length === 0 ? (
                          <div style={{ borderRadius: "8px", border: "1px dashed var(--border-strong)", background: "transparent", padding: "16px" }}>
                            <p className="text-xs" style={{color:"var(--text-muted)"}}>
                              {t("Selecciona disciplinas para definir la capacidad esperada AND.")}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid gap-2 md:grid-cols-[1fr_1fr_140px_auto]">
                              <StyledSelect
                                value={plannerDisciplineId}
                                onChange={(e) => setEventPlannerDisciplineId(e.target.value)}
                              >
                                <option value="">{t("Selecciona disciplina")}</option>
                                {selectedDisciplineOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {String(option.label || option.value)}
                                  </option>
                                ))}
                              </StyledSelect>
                              <StyledSelect
                                value={eventPlannerDelegationCode}
                                onChange={(e) => setEventPlannerDelegationCode(e.target.value)}
                              >
                                {DELEGATION_COUNTRY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.value} · {option.label}
                                  </option>
                                ))}
                              </StyledSelect>
                              <input
                                className="input text-right"
                                type="number"
                                min={0}
                                step={1}
                                placeholder="Capacidad"
                                value={eventPlannerExpectedValue}
                                onChange={(e) => setEventPlannerExpectedValue(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                  if (!plannerDisciplineOption) return;
                                  const normalized = eventPlannerExpectedValue.trim();
                                  const n = Number(normalized);
                                  if (!normalized || !Number.isFinite(n) || n < 0) return;
                                  setEventCapacityMatrix((prev) => ({
                                    ...prev,
                                    [plannerDisciplineOption.value]: {
                                      ...(prev[plannerDisciplineOption.value] || {}),
                                      [eventPlannerDelegationCode]: String(Math.round(n)),
                                    },
                                  }));
                                  setEventPlannerExpectedValue("");
                                }}
                                disabled={!plannerDisciplineOption}
                              >
                                {t("Asignar")}
                              </button>
                            </div>

                            {plannerDisciplineOption ? (
                              <div style={{ borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", padding: "12px" }}>
                                <p className="text-xs uppercase tracking-[0.16em]" style={{color:"var(--text-muted)"}}>
                                  {t("Detalle disciplina")} · {String(plannerDisciplineOption.label || plannerDisciplineOption.value)}
                                </p>
                                <div className="mt-2 max-h-52 overflow-auto space-y-1.5">
                                  {DELEGATION_COUNTRY_OPTIONS.map((country) => {
                                    const value = plannerRow[country.value];
                                    if (value === undefined || value === "") return null;
                                    return (
                                      <div key={`${plannerDisciplineOption.value}-${country.value}`} className="flex items-center justify-between px-2.5 py-1.5 text-sm" style={{ borderRadius: "6px", border: "1px solid var(--border)", background: "var(--elevated)" }}>
                                        <span style={{color:"var(--text)"}}>{country.value} · {country.label}</span>
                                        <span className="font-semibold" style={{ color: "var(--brand)" }}>{value}</span>
                                      </div>
                                    );
                                  })}
                                  {Object.keys(plannerRow).length === 0 ? (
                                    <p className="text-xs" style={{color:"var(--text-muted)"}}>{t("Sin capacidad asignada para esta disciplina.")}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            <div style={{ borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", padding: "12px" }}>
                              <p className="text-xs uppercase tracking-[0.16em]" style={{color:"var(--text-muted)"}}>{t("Resumen por disciplina")}</p>
                              <div className="mt-2 space-y-1.5">
                                {selectedDisciplineOptions.map((option) => (
                                  <div key={`sum-${option.value}`} className="flex items-center justify-between text-sm">
                                    <span style={{color:"var(--text)"}}>{String(option.label || option.value)}</span>
                                    <span className="font-semibold" style={{ color: "var(--brand)" }}>
                                      {expectedByDisciplineFromMatrix[option.value] ?? 0}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
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
                {["eventId", "accommodationType", "tower", "name", "address"].map((key) => {
                  const field = byKey.get(key);
                  return field ? renderField(field) : null;
                })}

                <div className="md:col-span-2 pt-2">
                  <p className="section-label">
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
            <button className="btn btn-primary" type="submit" style={{ padding: "9px 24px", fontSize: "13px", borderRadius: "10px", letterSpacing: "0.06em" }}>
              {editingId ? t("Actualizar") : t("Crear")}
            </button>
          </div>
        </form>
        {successMsg && (
          <div style={{ marginTop: "12px", padding: "10px 16px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", gap: "8px", animation: "fadeIn 0.3s ease" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#065f46" }}>{successMsg}</span>
          </div>
        )}
        {error && <p className="text-sm text-rose-400 mt-3">{error}</p>}
      </section>
      ) : null}

      {viewMode !== "form" ? (
      <section className="surface p-6" style={{ borderTop: "2px solid #1FCDFF" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#1FCDFF", marginBottom: "3px" }}>
              {t("Base de datos")}
            </p>
            <h4 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>{t("Registros")}</h4>
          </div>
          <button
            className="btn btn-ghost"
            onClick={loadItems}
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {loading ? t("Actualizando...") : t("Refrescar")}
          </button>
        </div>
        {items.length === 0 ? (
          <div className="text-sm" style={{color:"var(--text-muted)"}}>{t("Sin registros aún.")}</div>
        ) : config.endpoint === "/delegations" ? (() => {
          const searchLower = andSearch.toLowerCase();
          const filtered = items.filter((item) => {
            // Only show validated participants in AND view
            const isValidated = item.participantStatus === "PERSONAL_DATA_VALIDATED" || (item.participantMetadata as any)?.personalDataValidated === true;
            if (!isValidated) return false;
            const nameMatch = !andSearch || (item.participantFullName ?? "").toLowerCase().includes(searchLower);
            const trip = (item.participantTripType ?? "").toUpperCase();
            const tripMatch =
              andTripFilter === "all" ||
              (andTripFilter === "ARRIVAL" && trip === "ARRIVAL") ||
              (andTripFilter === "DEPARTURE" && trip === "DEPARTURE");
            return nameMatch && tripMatch;
          });
          const arrivalCount = items.filter((i) => (i.participantTripType ?? "").toUpperCase() === "ARRIVAL").length;
          const departureCount = items.filter((i) => (i.participantTripType ?? "").toUpperCase() === "DEPARTURE").length;
          const USER_TYPE_LABELS: Record<string, string> = {
            VIP: "VIP", FAMILIA_PARAPAN: "Familia Parapan", TA: "Deportista",
            TF: "Oficiales Técnicos", TM: "Prensa", COMITE_ORGANIZADOR: "Comité Organizador", PROVEEDORES: "Proveedores",
          };
          return (
            <div>
              {/* Stats bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#21D0B3", background: "rgba(33,208,179,0.1)", borderRadius: "20px", padding: "3px 10px", border: "1px solid rgba(33,208,179,0.2)" }}>
                  {arrivalCount} {t("llegadas")}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#a78bfa", background: "rgba(167,139,250,0.1)", borderRadius: "20px", padding: "3px 10px", border: "1px solid rgba(167,139,250,0.2)" }}>
                  {departureCount} {t("salidas")}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>— {items.length} {t("total")}</span>
              </div>
              {/* Search + filter */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder={t("Buscar por nombre...")}
                  value={andSearch}
                  onChange={(e) => setAndSearch(e.target.value)}
                  style={{ flex: 1, minWidth: "180px", maxWidth: "320px", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", background: "var(--surface)", color: "var(--text)", outline: "none" }}
                />
                {(["all", "ARRIVAL", "DEPARTURE"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setAndTripFilter(f)} style={{
                    fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "20px", cursor: "pointer", border: "1.5px solid",
                    borderColor: andTripFilter === f ? (f === "ARRIVAL" ? "#21D0B3" : f === "DEPARTURE" ? "#a78bfa" : "#1FCDFF") : "var(--border)",
                    background: andTripFilter === f ? (f === "ARRIVAL" ? "rgba(33,208,179,0.1)" : f === "DEPARTURE" ? "rgba(167,139,250,0.1)" : "rgba(31,205,255,0.1)") : "transparent",
                    color: andTripFilter === f ? (f === "ARRIVAL" ? "#21D0B3" : f === "DEPARTURE" ? "#a78bfa" : "#1FCDFF") : "var(--text-muted)",
                  }}>
                    {f === "all" ? t("Todos") : f === "ARRIVAL" ? t("Llegadas") : t("Salidas")}
                  </button>
                ))}
              </div>
              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "65vh", overflowY: "auto" }}>
                {filtered.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "16px 0" }}>{t("Sin resultados.")}</div>
                )}
                {filtered.map((item) => {
                  const trip = (item.participantTripType ?? "").toUpperCase();
                  const isArrival = trip === "ARRIVAL";
                  const isDeparture = trip === "DEPARTURE";
                  const borderColor = isArrival ? "#21D0B3" : isDeparture ? "#a78bfa" : "#cbd5e1";
                  const bgColor = isArrival ? "rgba(33,208,179,0.03)" : isDeparture ? "rgba(167,139,250,0.03)" : "#fafafa";
                  const initials = (item.participantFullName ?? "?").split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();
                  const avatarBg = isArrival ? "rgba(33,208,179,0.15)" : isDeparture ? "rgba(167,139,250,0.12)" : "rgba(148,163,184,0.12)";
                  const avatarColor = isArrival ? "#059669" : isDeparture ? "#7c3aed" : "#64748b";
                  const eventLabel = eventOptions.find((o) => o.value === item.eventId)?.label ?? null;
                  const disciplineLabel = disciplineOptions.find((o: any) => o.value === item.participantDisciplineId)?.label ?? null;
                  const userTypeLabel = USER_TYPE_LABELS[item.participantUserType ?? ""] ?? item.participantUserType ?? null;
                  const isLead = item.participantIsDelegationLead === "true";
                  const visaRequired = item.participantVisaRequired === "true";
                  return (
                    <div key={item.id ?? JSON.stringify(item)} style={{
                      borderRadius: "12px",
                      border: `1px solid ${isArrival ? "rgba(33,208,179,0.25)" : isDeparture ? "rgba(167,139,250,0.25)" : "#e2e8f0"}`,
                      borderLeft: `4px solid ${borderColor}`,
                      background: bgColor,
                      padding: "12px 14px",
                      display: "flex", alignItems: "flex-start", gap: "12px",
                    }}>
                      {/* Avatar */}
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0, background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: avatarColor }}>
                        {initials}
                      </div>
                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>{item.participantFullName ?? "-"}</span>
                          {isLead && (
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px", background: "rgba(251,191,36,0.15)", color: "#b45309", border: "1px solid rgba(251,191,36,0.3)" }}>
                              {t("Jefe delegación")}
                            </span>
                          )}
                          {trip && (
                            <span style={{
                              fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 8px", borderRadius: "20px",
                              background: isArrival ? "rgba(33,208,179,0.12)" : isDeparture ? "rgba(167,139,250,0.12)" : "rgba(148,163,184,0.1)",
                              color: isArrival ? "#21D0B3" : isDeparture ? "#a78bfa" : "var(--text-muted)",
                              border: `1px solid ${isArrival ? "rgba(33,208,179,0.25)" : isDeparture ? "rgba(167,139,250,0.25)" : "var(--border)"}`,
                            }}>
                              {isArrival ? t("LLEGADA") : isDeparture ? t("SALIDA") : trip}
                            </span>
                          )}
                        </div>
                        {/* Tags */}
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "5px" }}>
                          {item.participantCountryCode && (
                            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.15)" }}>
                              {item.participantCountryCode}
                            </span>
                          )}
                          {userTypeLabel && (
                            <span style={{ fontSize: "10px", fontWeight: 500, padding: "1px 7px", borderRadius: "4px", background: "rgba(148,163,184,0.1)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                              {userTypeLabel}
                            </span>
                          )}
                          {disciplineLabel && (
                            <span style={{ fontSize: "10px", fontWeight: 500, padding: "1px 7px", borderRadius: "4px", background: "rgba(148,163,184,0.08)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                              {disciplineLabel}
                            </span>
                          )}
                          {visaRequired && (
                            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "4px", background: "rgba(245,158,11,0.1)", color: "#b45309", border: "1px solid rgba(245,158,11,0.2)" }}>
                              {t("Visa requerida")}
                            </span>
                          )}
                        </div>
                        {/* Detail row */}
                        <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                          {item.participantPhone && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              <span style={{ fontWeight: 600 }}>{t("Tel")}: </span>{item.participantPhone}
                            </span>
                          )}
                          {item.participantEmail && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.participantEmail}</span>
                          )}
                          {eventLabel && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              <span style={{ fontWeight: 600 }}>{t("Evento")}: </span>{eventLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                        <button className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => { handleEdit(item); if (item.id) onEditRequested?.(item.id); }}>
                          {t("Editar")}
                        </button>
                        {item.id && (
                          <button className="btn btn-ghost" style={{ fontSize: "11px", padding: "4px 10px", color: "#ef4444" }} onClick={() => handleDelete(item.id)}>
                            {t("Eliminar")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })() : config.endpoint === "/athletes" ? (() => {
          const validatedCount = items.filter((i) => isAthletePersonalDataValidated(i)).length;
          const pendingCount = items.length - validatedCount;
          const searchLower = athleteSearch.toLowerCase();
          const filtered = items.filter((item) => {
            const nameMatch = !athleteSearch || (item.fullName ?? "").toLowerCase().includes(searchLower);
            const isVal = isAthletePersonalDataValidated(item);
            const statusMatch =
              athleteStatusFilter === "all" ||
              (athleteStatusFilter === "validated" && isVal) ||
              (athleteStatusFilter === "pending" && !isVal);
            return nameMatch && statusMatch;
          });
          const USER_TYPE_LABELS: Record<string, string> = {
            VIP: "VIP",
            FAMILIA_PARAPAN: "Familia Parapan",
            TA: "TA (Deportista)",
            TF: "TF (Oficiales Técnicos)",
            TM: "TM (Prensa)",
            COMITE_ORGANIZADOR: "Comité Organizador",
            PROVEEDORES: "Proveedores",
          };
          return (
            <div>
              {/* Stats bar */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#10b981", background: "rgba(16,185,129,0.1)", borderRadius: "20px", padding: "3px 10px", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {validatedCount} {t("validados")}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#f59e0b", background: "rgba(245,158,11,0.1)", borderRadius: "20px", padding: "3px 10px", border: "1px solid rgba(245,158,11,0.2)" }}>
                  {pendingCount} {t("pendientes")}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>
                  — {items.length} {t("total")}
                </span>
              </div>
              {/* Search + filter */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder={t("Buscar por nombre...")}
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  style={{ flex: 1, minWidth: "180px", maxWidth: "320px", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", background: "var(--surface)", color: "var(--text)", outline: "none" }}
                />
                {(["all", "validated", "pending"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setAthleteStatusFilter(f)}
                    style={{
                      fontSize: "12px", fontWeight: 600, padding: "5px 14px", borderRadius: "20px", cursor: "pointer", border: "1.5px solid",
                      borderColor: athleteStatusFilter === f ? (f === "validated" ? "#10b981" : f === "pending" ? "#f59e0b" : "#1FCDFF") : "var(--border)",
                      background: athleteStatusFilter === f ? (f === "validated" ? "rgba(16,185,129,0.1)" : f === "pending" ? "rgba(245,158,11,0.1)" : "rgba(31,205,255,0.1)") : "transparent",
                      color: athleteStatusFilter === f ? (f === "validated" ? "#10b981" : f === "pending" ? "#f59e0b" : "#1FCDFF") : "var(--text-muted)",
                    }}
                  >
                    {f === "all" ? t("Todos") : f === "validated" ? t("Validados") : t("Pendientes")}
                  </button>
                ))}
              </div>
              {/* Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "65vh", overflowY: "auto" }}>
                {filtered.length === 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "16px 0" }}>{t("Sin resultados.")}</div>
                )}
                {filtered.map((item) => {
                  const isVal = isAthletePersonalDataValidated(item);
                  const missing = missingAthleteValidationFields(item);
                  const initials = (item.fullName ?? "?").split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase();
                  const delegLabel = delegationOptions.find((o) => o.value === item.delegationId)?.label ?? item.delegationId ?? null;
                  const eventLabel = eventOptions.find((o) => o.value === item.eventId)?.label ?? null;
                  const disciplineLabel = disciplineOptions.find((o: any) => o.value === item.disciplineId)?.label ?? null;
                  const userTypeLabel = USER_TYPE_LABELS[item.userType ?? ""] ?? item.userType ?? null;
                  const dob = item.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
                  return (
                    <div key={item.id ?? JSON.stringify(item)} style={{
                      borderRadius: "12px",
                      border: `1px solid ${isVal ? "rgba(16,185,129,0.25)" : "#e2e8f0"}`,
                      borderLeft: `4px solid ${isVal ? "#10b981" : "#f59e0b"}`,
                      background: isVal ? "rgba(16,185,129,0.03)" : "#fafafa",
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}>
                      {/* Avatar / Photo */}
                      {(() => {
                        const photoUrl = (item.metadata as any)?.photoUrl || item.photoUrl;
                        return photoUrl && typeof photoUrl === "string" && photoUrl.startsWith("http") ? (
                          <img src={photoUrl} alt={item.fullName ?? ""} style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${isVal ? "#10b981" : "#f59e0b"}` }} />
                        ) : (
                          <div style={{
                            width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                            background: isVal ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "13px", fontWeight: 700,
                            color: isVal ? "#059669" : "#b45309",
                          }}>
                            {initials}
                          </div>
                        );
                      })()}
                      {/* Main info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>{item.fullName ?? "-"}</span>
                          {/* Status badge */}
                          <span style={{
                            fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", padding: "2px 8px", borderRadius: "20px",
                            background: isVal ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.12)",
                            color: isVal ? "#059669" : "#b45309",
                            border: `1px solid ${isVal ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
                          }}>
                            {isVal ? t("VALIDADO") : t("PENDIENTE")}
                          </span>
                          {/* Missing fields warning */}
                          {!isVal && missing.length > 0 && (
                            <span title={missing.map((f) => f.label).join(", ")} style={{
                              fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px",
                              background: "rgba(239,68,68,0.1)", color: "#dc2626",
                              border: "1px solid rgba(239,68,68,0.2)", cursor: "help",
                            }}>
                              {missing.length} {t("campos faltantes")}
                            </span>
                          )}
                        </div>
                        {/* Tags row */}
                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "5px" }}>
                          {delegLabel && (
                            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "4px", background: "rgba(31,205,255,0.1)", color: "#0891b2", border: "1px solid rgba(31,205,255,0.2)" }}>
                              {delegLabel}
                            </span>
                          )}
                          {item.countryCode && (
                            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 7px", borderRadius: "4px", background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.15)" }}>
                              {item.countryCode}
                            </span>
                          )}
                          {disciplineLabel && (
                            <span style={{ fontSize: "10px", fontWeight: 500, padding: "1px 7px", borderRadius: "4px", background: "rgba(148,163,184,0.12)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                              {disciplineLabel}
                            </span>
                          )}
                          {userTypeLabel && (
                            <span style={{ fontSize: "10px", fontWeight: 500, padding: "1px 7px", borderRadius: "4px", background: "rgba(148,163,184,0.08)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                              {userTypeLabel}
                            </span>
                          )}
                        </div>
                        {/* Detail row */}
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          {item.passportNumber && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              <span style={{ fontWeight: 600 }}>{t("Pasaporte")}: </span>{item.passportNumber}
                            </span>
                          )}
                          {dob && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              <span style={{ fontWeight: 600 }}>{t("Nac.")}: </span>{dob}
                            </span>
                          )}
                          {eventLabel && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              <span style={{ fontWeight: 600 }}>{t("Evento")}: </span>{eventLabel}
                            </span>
                          )}
                          {item.email && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{item.email}</span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", flexShrink: 0, alignItems: "flex-end" }}>
                        {!isVal && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "8px" }}
                            onClick={() => handleValidateAthlete(item)}
                          >
                            {t("Validar")}
                          </button>
                        )}
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: "11px", padding: "4px 10px" }}
                            onClick={() => {
                              handleEdit(item);
                              if (item.id) onEditRequested?.(item.id);
                            }}
                          >
                            {t("Editar")}
                          </button>
                          {item.id && (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: "11px", padding: "4px 10px", color: "#ef4444" }}
                              onClick={() => handleDelete(item.id)}
                            >
                              {t("Eliminar")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })() : (
          <div className="max-h-[70vh] overflow-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
            <table className="table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="sticky top-0 z-10" style={{ background: "linear-gradient(to bottom, #eaf4fb, #e8f0f8)", color: "#1FCDFF", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", borderBottom: "2px solid rgba(31,205,255,0.25)", fontWeight: 700 }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="sticky top-0 z-10" style={{ background: "linear-gradient(to bottom, #eaf4fb, #e8f0f8)", color: "#1FCDFF", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", borderBottom: "2px solid rgba(31,205,255,0.25)", fontWeight: 700 }}>{t("Acciones")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id ?? JSON.stringify(item)}>
                    {columns.map((col) => (
                      <td key={col.key}>{resolveDisplayValue(col.key, item)}</td>
                    ))}
                    <td className="flex gap-2">
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          handleEdit(item);
                          if (item.id) onEditRequested?.(item.id);
                        }}
                      >
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
        {successMsg && (
          <div style={{ marginTop: "12px", padding: "10px 16px", borderRadius: "10px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", gap: "8px", animation: "fadeIn 0.3s ease" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#065f46" }}>{successMsg}</span>
          </div>
        )}
        {error && <p className="text-sm text-rose-400 mt-3">{error}</p>}
      </section>
      ) : null}
    </div>
  );
}
