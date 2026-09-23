"use client";

import { useEffect, useId, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useIsMobile } from "@/lib/useIsMobile";
import { apiFetch } from "@/lib/api";
import { CLIENT_TYPE_OPTIONS, isEventCoordinator } from "@/lib/clientTypes";
import { BRAND } from "@/lib/design";
import { useI18n } from "@/lib/i18n";

type ImportType = "athletes" | "drivers" | "hospitality";
type ParseMode = "template" | "and-itinerary";
type AthleteMode = "registration" | "and";

type ImportError = {
  row: number;
  field?: string;
  message: string;
};

type EventOption = {
  id: string;
  name: string;
};

const athleteHeaders = [
  "event_name",
  "country_code",
  "full_name",
  "gender",
  "passport_number",
  "email",
  "phone",
  "date_of_birth",
  "user_type",
  "discipline_name",
  "category",
  "is_delegation_lead",
  "visa_required",
  "fecha_hora_llegada",
  "aerolinea_llegada",
  "vuelo_llegada",
  "retiro_equipaje_llegada",
  "llegada_bolso_count",
  "llegada_maleta_8_count",
  "llegada_maleta_10_count",
  "llegada_maleta_15_count",
  "llegada_maleta_23_count",
  "llegada_sobreequipaje",
  "llegada_volumen",
  "fecha_hora_salida",
  "aerolinea_salida",
  "vuelo_salida",
  "puerta_embarque_salida",
  "salida_bolso_count",
  "salida_maleta_8_count",
  "salida_maleta_10_count",
  "salida_maleta_15_count",
  "salida_maleta_23_count",
  "salida_sobreequipaje",
  "salida_volumen",
  "wheelchair_user",
  "wheelchair_standard_count",
  "wheelchair_sport_count",
  "sports_equipment",
  "requires_assistance",
  "observations",
  "hotel_name",
  "room_type",
  "room_number",
  "bed_type",
  "status"
] as const;

const athleteRegistrationHeaders = [
  "event_name",
  "country_code",
  // Delegación a la que pertenece. En los Juegos Escolares es la región, y no
  // se deduce del país: sin esta columna todo el mundo caía en "CHL".
  "delegation",
  "full_name",
  "rut",
  "passport_number",
  "email",
  "phone",
  "date_of_birth",
  "gender",
  "user_type",
  "discipline_name",
  "is_delegation_lead",
  "visa_required"
] as const;

/**
 * Filas de ejemplo de la plantilla de inscripción. Una plantilla con solo
 * encabezados no dice qué escribir en "user_type" ni que un Coordinador
 * Comité va sin delegación ni disciplina, y esas dos cosas eran justamente
 * las que llegaban mal.
 */
const athleteRegistrationExamples: Array<Record<string, string>> = [
  {
    event_name: "Final Nacional Sub 14 Juegos Deportivos Escolares 2026",
    country_code: "CHL",
    delegation: "Región de Ñuble",
    full_name: "María Fernanda Soto Reyes",
    rut: "21.345.678-9",
    passport_number: "",
    email: "maria.soto@ejemplo.cl",
    phone: "+56912345678",
    date_of_birth: "2012-05-14",
    gender: "Femenino",
    user_type: "TA",
    discipline_name: "Atletismo",
    is_delegation_lead: "NO",
    visa_required: "NO",
  },
  {
    event_name: "Final Nacional Sub 14 Juegos Deportivos Escolares 2026",
    country_code: "CHL",
    delegation: "Región de Ñuble",
    full_name: "Rodrigo Pérez Lagos",
    rut: "13.456.789-0",
    passport_number: "",
    email: "rodrigo.perez@ejemplo.cl",
    phone: "+56987654321",
    date_of_birth: "1978-03-02",
    gender: "Masculino",
    user_type: "JEFE_MISION",
    discipline_name: "",
    is_delegation_lead: "SI",
    visa_required: "NO",
  },
  {
    // El coordinador de evento no pertenece a una región ni a un deporte:
    // delegación y disciplina van vacías a propósito.
    event_name: "Final Nacional Sub 14 Juegos Deportivos Escolares 2026",
    country_code: "CHL",
    delegation: "",
    full_name: "Camila Castillo Véliz",
    rut: "12.620.486-8",
    passport_number: "",
    email: "camila.castillo@ejemplo.cl",
    phone: "+56911223344",
    date_of_birth: "1974-11-04",
    gender: "Femenino",
    user_type: "COORDINADOR_COMITE",
    discipline_name: "",
    is_delegation_lead: "NO",
    visa_required: "NO",
  },
];

const hospitalityHeaders = [
  "event_id",
  "hotel_name",
  "hotel_address",
  "room_number",
  "room_type",
  "bed_type",
  "bed_status"
] as const;

const driverHeaders = [
  "event_id",
  "provider_id",
  "full_name",
  "rut",
  "email",
  "license_number",
  "phone",
  "vehicle_plate",
  "vehicle_type",
  "vehicle_brand",
  "vehicle_model",
  "vehicle_capacity",
  "vehicle_status",
  "status"
] as const;

const roomTypes = new Set(["SINGLE", "DOUBLE", "TRIPLE", "SUITE"]);
const bedStatuses = new Set(["AVAILABLE", "OCCUPIED"]);
const vehicleTypes = new Set(["SEDAN", "VAN", "MINI_BUS", "BUS"]);
const tripTypes = new Set(["ARRIVAL", "DEPARTURE"]);

const countryCodeByName: Record<string, string> = {
  argentina: "ARG",
  bolivia: "BOL",
  brasil: "BRA",
  brazil: "BRA",
  chile: "CHL",
  colombia: "COL",
  ecuador: "ECU",
  paraguay: "PRY",
  peru: "PER",
  uruguay: "URY",
  venezuela: "VEN",
  mexico: "MEX",
  "estados unidos": "USA",
  "united states": "USA",
  canada: "CAN",
  espana: "ESP",
  spain: "ESP",
  francia: "FRA",
  france: "FRA",
  alemania: "DEU",
  germany: "DEU",
  italia: "ITA",
  italy: "ITA",
  portugal: "PRT",
  "reino unido": "GBR",
  "united kingdom": "GBR"
};

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "_");

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const excelEpochUtc = Date.UTC(1899, 11, 30);
const pad = (value: number) => String(value).padStart(2, "0");
const normalizeTwoDigitYear = (value: number) => (value >= 70 ? 1900 + value : 2000 + value);

const buildIsoDate = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
};

const buildIsoDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
) => {
  const dateOnly = buildIsoDate(year, month, day);
  if (!dateOnly) return null;
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  const parsed = new Date(
    `${dateOnly}T${pad(hour)}:${pad(minute)}:${pad(second)}`,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const excelSerialToDateOnly = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const date = new Date(excelEpochUtc + Math.floor(numeric) * 86400000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const excelSerialToTimeOnly = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 1) {
    const date = new Date(excelEpochUtc + numeric * 86400000);
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  }
  const minutes = Math.round(numeric * 24 * 60);
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${pad(hours)}:${pad(mins)}`;
};

const excelSerialToDateTime = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const parsed = new Date(excelEpochUtc + numeric * 86400000);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toDateOnly = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return buildIsoDate(year, month, day);
  }
  if (/^\d{1,2}-\d{1,2}-\d{2}$/.test(text)) {
    const [day, month, year] = text.split("-").map(Number);
    return buildIsoDate(normalizeTwoDigitYear(year), month, day);
  }
  if (/^\d{2}-\d{2}-\d{2}$/.test(text)) {
    const [day, month, year] = text.split("-").map(Number);
    return buildIsoDate(normalizeTwoDigitYear(year), month, day);
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split("-").map(Number);
    return buildIsoDate(year, month, day);
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split("-").map(Number);
    return buildIsoDate(year, month, day);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);
    return buildIsoDate(normalizeTwoDigitYear(year), month, day);
  }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);
    return buildIsoDate(normalizeTwoDigitYear(year), month, day);
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);
    return buildIsoDate(year, month, day);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/").map(Number);
    return buildIsoDate(year, month, day);
  }
  const excelDate = excelSerialToDateOnly(value);
  if (excelDate) return excelDate;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const toDateTime = (value: unknown) => {
  const excelDateTime = excelSerialToDateTime(value);
  if (excelDateTime) return excelDateTime;

  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return null;
  const genericMatch = text.match(
    /^(\d{1,2})([/-])(\d{1,2})\2(\d{2}|\d{4})(?:\s+|T)(\d{1,2})[:.-](\d{2})(?:[:.-](\d{2}))?$/,
  );
  if (genericMatch) {
    const [, day, , month, year, hour, minute, second] = genericMatch;
    const normalizedYear =
      year.length === 2 ? normalizeTwoDigitYear(Number(year)) : Number(year);
    return buildIsoDateTime(
      normalizedYear,
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "00"),
    );
  }
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const combineDateTime = (dateValue: unknown, timeValue: unknown) => {
  const dateOnly = toDateOnly(dateValue);
  if (!dateOnly) return null;
  const rawTime = String(timeValue ?? "").trim();
  if (!rawTime) return `${dateOnly}T00:00:00.000Z`;
  let timeOnly: string | null = null;
  if (/^\d{2}:\d{2}$/.test(rawTime)) {
    timeOnly = rawTime;
  } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(rawTime)) {
    const [hh, mm] = rawTime.split(":");
    timeOnly = `${pad(Number(hh))}:${pad(Number(mm))}`;
  } else {
    timeOnly = excelSerialToTimeOnly(timeValue);
  }
  if (!timeOnly) return null;
  return new Date(`${dateOnly}T${timeOnly}:00`).toISOString();
};

const toBooleanString = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (["si", "s", "yes", "y", "true", "1"].includes(normalized)) return "true";
  if (["no", "n", "false", "0"].includes(normalized)) return "false";
  return "";
};

const toBoolean = (value: string) =>
  value === "true" ? true : value === "false" ? false : undefined;

const normalizeBooleanLike = (value: unknown) => toBooleanString(value);

const normalizeTripTypeValue = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (["arrival", "llegada"].includes(normalized)) return "ARRIVAL";
  if (["departure", "salida"].includes(normalized)) return "DEPARTURE";
  return String(value ?? "").trim().toUpperCase();
};

const toNumber = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Tipos de cliente válidos, sacados del catálogo y no de una copia a mano. */
const CLIENT_TYPE_REFERENCE: string[][] = CLIENT_TYPE_OPTIONS.map((o) => [
  o.value,
  o.label,
]);

const normalizeCountryCode = (value: unknown) => {
  const text = String(value ?? "").trim().toUpperCase();
  if (text.length === 3) return text;
  return countryCodeByName[normalizeText(value)] ?? "";
};

/**
 * Clave de comparación de una delegación: minúsculas, sin tildes ni apóstrofos
 * y sin el prefijo "Región de/del", para que "ÑUBLE", "Region Ñuble" y
 * "Región de Ñuble" sean lo mismo. Igual criterio que el importador de viajes.
 */
const claveDelegacion = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['’´`]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^region\s+(del\s+|de\s+)?/, "")
    .trim();

const normalizeDisciplineName = (value: unknown) =>
  normalizeText(value).replace(/\s+/g, " ");

const rowValue = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "") return value;
  }
  return "";
};

const resolveEventId = (
  row: Record<string, string>,
  selectedEventId: string,
  eventIdByName: Map<string, string>
) => {
  if (row.event_id) return row.event_id;
  const eventName = normalizeText(row.event_name);
  if (eventName) {
    const resolved = eventIdByName.get(eventName);
    if (resolved) return resolved;
  }
  return selectedEventId;
};

const downloadTemplate = (
  headers: readonly string[],
  fileName: string,
  examples: Array<Record<string, string>> = [],
  reference?: { sheetName: string; rows: string[][] },
) => {
  const filas = [
    Array.from(headers),
    ...examples.map((ejemplo) => headers.map((h) => ejemplo[h] ?? "")),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(filas);
  worksheet["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  // Los valores válidos van en su propia hoja: pegarlos como comentario en la
  // cabecera no sobrevive a un "guardar como CSV".
  if (reference) {
    const hoja = XLSX.utils.aoa_to_sheet(reference.rows);
    hoja["!cols"] = [{ wch: 26 }, { wch: 46 }];
    XLSX.utils.book_append_sheet(workbook, hoja, reference.sheetName);
  }
  XLSX.writeFile(workbook, fileName);
};

/** Hoja "Valores" de la plantilla de inscripción. */
const REFERENCIA_INSCRIPCION: { sheetName: string; rows: string[][] } = {
  sheetName: "Valores",
  rows: [
    ["Columna", "Qué escribir"],
    ["event_name", "Nombre exacto del evento, o dejarlo vacío y elegir el evento arriba"],
    ["country_code", "Código de 3 letras del país: CHL, ARG, BRA…"],
    ["delegation", "Delegación o región: \"Región de Ñuble\", \"ÑUBLE\", \"CL-NB\". Vacío para los coordinadores de evento"],
    ["rut", "RUT con o sin puntos, con guion y dígito verificador"],
    ["date_of_birth", "AAAA-MM-DD"],
    ["gender", "Masculino / Femenino"],
    ["is_delegation_lead", "SI / NO — marca al Jefe de Misión de esa delegación"],
    ["visa_required", "SI / NO"],
    ["discipline_name", "Nombre del deporte tal como está en el maestro de Disciplinas. Vacío si no compite"],
    ["", ""],
    ["user_type — valores válidos", ""],
    ...CLIENT_TYPE_REFERENCE,
  ],
};

const isAndWorkbook = (rows: unknown[][]) => {
  if (rows.length < 2) return false;
  const secondRow = rows[1] ?? [];
  return normalizeText(secondRow[0]) === "pais" && normalizeText(secondRow[1]) === "nombre completo";
};

const parseAndWorkbookRows = (rows: unknown[][]) =>
  rows
    .slice(2)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .map((row) => {
      const countryCode = normalizeCountryCode(row[0]);

      return {
        event_name: "",
        country_code: countryCode,
        full_name: String(row[1] ?? "").trim(),
        gender: String(row[6] ?? "").trim(),
        passport_number: String(row[2] ?? "").trim(),
        email: String(row[10] ?? "").trim(),
        phone: String(row[9] ?? "").trim(),
        date_of_birth: toDateOnly(row[5]) ?? "",
        user_type: String(row[4] ?? "").trim(),
        discipline_name: String(row[7] ?? "").trim(),
        category: String(row[8] ?? "").trim(),
        is_delegation_lead: toBooleanString(row[11]),
        visa_required: toBooleanString(row[3]),
        fecha_hora_llegada: combineDateTime(row[13], row[16]) ?? "",
        aerolinea_llegada: String(row[14] ?? "").trim(),
        vuelo_llegada: String(row[15] ?? "").trim(),
        retiro_equipaje_llegada: "",
        llegada_bolso_count: String(toNumber(row[17])),
        llegada_maleta_8_count: String(toNumber(row[18])),
        llegada_maleta_10_count: "0",
        llegada_maleta_15_count: String(toNumber(row[19])),
        llegada_maleta_23_count: String(toNumber(row[20])),
        llegada_sobreequipaje: String(row[21] ?? "").trim(),
        llegada_volumen: String(row[22] ?? "").trim(),
        fecha_hora_salida: combineDateTime(row[24], row[27]) ?? "",
        aerolinea_salida: String(row[25] ?? "").trim(),
        vuelo_salida: String(row[26] ?? "").trim(),
        puerta_embarque_salida: "",
        salida_bolso_count: String(toNumber(row[28])),
        salida_maleta_8_count: String(toNumber(row[29])),
        salida_maleta_10_count: "0",
        salida_maleta_15_count: String(toNumber(row[30])),
        salida_maleta_23_count: String(toNumber(row[31])),
        salida_sobreequipaje: String(row[32] ?? "").trim(),
        salida_volumen: String(row[33] ?? "").trim(),
        wheelchair_user: toBooleanString(row[35]),
        wheelchair_standard_count: String(toNumber(row[36])),
        wheelchair_sport_count: String(toNumber(row[37])),
        sports_equipment: "",
        requires_assistance: toBooleanString(row[38]),
        observations: String(row[39] ?? "").trim(),
        hotel_name: String(row[40] ?? "").trim(),
        room_type: "",
        room_number: "",
        bed_type: "",
        status: "REGISTERED"
      };
    });

const parseSheet = (file: File, type: ImportType) =>
  new Promise<{ rows: Record<string, string>[]; mode: ParseMode }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        if (type === "athletes") {
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: "",
            raw: true
          });
          if (isAndWorkbook(rawRows)) {
            resolve({ rows: parseAndWorkbookRows(rawRows), mode: "and-itinerary" });
            return;
          }
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false
        });
        resolve({ rows, mode: "template" });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });

export default function BulkImportPanel({
  type,
  onImported,
  athleteMode = "and",
}: {
  type: ImportType;
  onImported?: () => void;
  athleteMode?: AthleteMode;
}) {
  const { t } = useI18n();
  const inputId = useId();
  // En el teléfono (app staff) la carga masiva ocupaba media pantalla encima
  // de la lista y casi nunca se usa desde ahí: queda plegada tras una fila.
  const isMobile = useIsMobile();
  const [abiertoEnTelefono, setAbiertoEnTelefono] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<"ok" | "error" | null>(null);
  const [parseMode, setParseMode] = useState<ParseMode>("template");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");

  const headers =
    type === "athletes"
      ? athleteMode === "registration"
        ? athleteRegistrationHeaders
        : athleteHeaders
      : type === "drivers"
        ? driverHeaders
        : hospitalityHeaders;

  const eventIdByName = useMemo(
    () => new Map(events.map((event) => [normalizeText(event.name), event.id])),
    [events]
  );

  useEffect(() => {
    if (type !== "athletes") return;
    let ignore = false;
    apiFetch<Record<string, any>[]>("/events")
      .then((data) => {
        if (ignore) return;
        const next = (data || []).map((event) => ({
          id: String(event.id),
          name: String(event.name || event.id)
        }));
        setEvents(next);
        setSelectedEventId((prev) => prev || next[0]?.id || "");
      })
      .catch(() => {
        if (ignore) return;
        setEvents([]);
      });
    return () => {
      ignore = true;
    };
  }, [type]);

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => {
        const next: Record<string, string> = {};
        Object.entries(row).forEach(([key, value]) => {
          next[normalizeHeader(key)] = String(value ?? "").trim();
        });
        return next;
      }),
    [rows]
  );

  const handleFile = async (file: File | null) => {
    setResult(null);
    setValidationStatus(null);
    setErrors([]);
    if (!file) {
      setFileName(null);
      setRows([]);
      setParseMode("template");
      return;
    }
    setFileName(file.name);
    const parsed = await parseSheet(file, type);
    setRows(parsed.rows);
    setParseMode(parsed.mode);
  };

  const validate = async () => {
    const nextErrors: ImportError[] = [];
    let disciplineByName = new Map<string, Record<string, any>>();
    if (type === "athletes") {
      try {
        const disciplines = await apiFetch<Record<string, any>[]>("/disciplines");
        disciplineByName = new Map(
          (disciplines || []).map((item) => [normalizeDisciplineName(item.name), item])
        );
      } catch {
        nextErrors.push({
          row: 0,
          field: "discipline_name",
          message: "No se pudo validar el catalogo de disciplinas"
        });
      }
    }

    normalizedRows.forEach((row, index) => {
      const rowNumber = index + (parseMode === "and-itinerary" ? 3 : 2);
      const effectiveEventId = resolveEventId(row, selectedEventId, eventIdByName);
      if (!effectiveEventId) {
        nextErrors.push({ row: rowNumber, field: "event_name", message: "Evento no reconocido o no seleccionado" });
      }
      if (type === "athletes") {
        if (!row.full_name) {
          nextErrors.push({ row: rowNumber, field: "full_name", message: "Requerido" });
        }
        if (!row.country_code || row.country_code.length !== 3) {
          nextErrors.push({ row: rowNumber, field: "country_code", message: "Pais/codigo invalido" });
        }
        if (row.gender) {
          const normalizedGender = normalizeText(row.gender);
          if (!["masculino", "femenino", "male", "female"].includes(normalizedGender)) {
            nextErrors.push({ row: rowNumber, field: "gender", message: "Genero invalido" });
          }
        }
        if (row.discipline_name && !disciplineByName.has(normalizeDisciplineName(row.discipline_name))) {
          nextErrors.push({ row: rowNumber, field: "discipline_name", message: "Disciplina no existe en el catalogo" });
        }
        if (row.date_of_birth && !toDateOnly(row.date_of_birth)) {
          nextErrors.push({ row: rowNumber, field: "date_of_birth", message: "Fecha invalida" });
        }
        if (rowValue(row, "fecha_hora_llegada", "arrival_time") && !toDateTime(rowValue(row, "fecha_hora_llegada", "arrival_time"))) {
          nextErrors.push({ row: rowNumber, field: "fecha_hora_llegada", message: "Fecha/hora de llegada invalida" });
        }
        if (rowValue(row, "fecha_hora_salida", "departure_time") && !toDateTime(rowValue(row, "fecha_hora_salida", "departure_time"))) {
          nextErrors.push({ row: rowNumber, field: "fecha_hora_salida", message: "Fecha/hora de salida invalida" });
        }
        if (row.trip_type && !tripTypes.has(normalizeTripTypeValue(row.trip_type))) {
          nextErrors.push({ row: rowNumber, field: "trip_type", message: "Tipo de viaje invalido" });
        }
      } else if (type === "drivers") {
        if (!row.full_name) {
          nextErrors.push({ row: rowNumber, field: "full_name", message: "Requerido" });
        }
        if (!row.rut) {
          nextErrors.push({ row: rowNumber, field: "rut", message: "Requerido" });
        }
        if (row.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(row.email)) {
          nextErrors.push({ row: rowNumber, field: "email", message: "Correo invalido" });
        }
        if (row.vehicle_type && !vehicleTypes.has(row.vehicle_type)) {
          nextErrors.push({ row: rowNumber, field: "vehicle_type", message: "Tipo de vehiculo invalido" });
        }
      } else {
        if (!row.hotel_name) {
          nextErrors.push({ row: rowNumber, field: "hotel_name", message: "Requerido" });
        }
        if (!row.room_number) {
          nextErrors.push({ row: rowNumber, field: "room_number", message: "Requerido" });
        }
        if (row.room_type && !roomTypes.has(row.room_type)) {
          nextErrors.push({ row: rowNumber, field: "room_type", message: "Tipo de habitacion invalido" });
        }
        if (row.bed_status && !bedStatuses.has(row.bed_status)) {
          nextErrors.push({ row: rowNumber, field: "bed_status", message: "Estado de cama invalido" });
        }
      }
    });
    setErrors(nextErrors);
    setValidationStatus(nextErrors.length === 0 ? "ok" : "error");
    setResult(
      nextErrors.length === 0
        ? `Validacion OK. ${normalizedRows.length} fila(s) revisadas sin errores.`
        : `Validacion No OK. ${nextErrors.length} observacion(es) detectada(s).`
    );
    return nextErrors.length === 0;
  };

  const importAthletes = async () => {
    setLoading(true);
    setResult(null);
    try {
      const [athletes, accommodations, disciplines, delegations] = await Promise.all([
        apiFetch<Record<string, any>[]>("/athletes"),
        apiFetch<Record<string, any>[]>("/accommodations"),
        apiFetch<Record<string, any>[]>("/disciplines"),
        apiFetch<Record<string, any>[]>("/delegations")
      ]);

      const athleteByEmail = new Map(
        (athletes || []).filter((item) => item.email).map((item) => [String(item.email).toLowerCase(), item])
      );
      const athleteByPassport = new Map(
        (athletes || [])
          .filter((item) => item.passportNumber)
          .map((item) => [String(item.passportNumber).toLowerCase(), item])
      );
      const accommodationByKey = new Map(
        (accommodations || []).map((item) => [`${item.eventId}::${String(item.name).toLowerCase()}`, item])
      );
      const disciplineById = new Map((disciplines || []).map((item) => [String(item.id), item]));
      const disciplineByName = new Map(
        (disciplines || []).map((item) => [normalizeDisciplineName(item.name), item])
      );
      const delegationCache = new Map(
        (delegations || []).map((item) => [`${item.eventId}::${String(item.countryCode).toUpperCase()}`, item])
      );
      // Índice por nombre para la columna "delegation": en los Juegos
      // Escolares la delegación es la región y no se deduce del país.
      const delegationPorNombre = new Map<string, Record<string, any>>();
      (delegations || []).forEach((item) => {
        const nombre = claveDelegacion(
          (item?.metadata as Record<string, unknown> | null)?.name ?? item?.name,
        );
        if (nombre) delegationPorNombre.set(`${item.eventId}::${nombre}`, item);
        const codigo = String(item.countryCode ?? "").trim().toLowerCase();
        if (codigo) {
          delegationPorNombre.set(`${item.eventId}::${codigo}`, item);
          const sufijo = codigo.includes("-") ? codigo.split("-")[1] : "";
          if (sufijo) delegationPorNombre.set(`${item.eventId}::${sufijo}`, item);
        }
      });
      const buscarDelegacion = (valor: string, eventoId: string) => {
        const clave = claveDelegacion(valor);
        const crudo = String(valor).trim().toLowerCase();
        const directa =
          delegationPorNombre.get(`${eventoId}::${clave}`) ??
          delegationPorNombre.get(`${eventoId}::${crudo}`);
        if (directa) return directa;
        // Nombre parcial: "ÑUBLE" contra "Región de Ñuble".
        const candidatas = (delegations || []).filter((item) => {
          if (item.eventId !== eventoId) return false;
          const otra = claveDelegacion(
            (item?.metadata as Record<string, unknown> | null)?.name ?? item?.name,
          );
          if (!otra || !clave) return false;
          return (
            (clave.length >= 4 && otra.startsWith(clave)) ||
            (otra.length >= 4 && clave.startsWith(otra)) ||
            (clave.length >= 5 && otra.includes(clave)) ||
            (otra.length >= 5 && clave.includes(otra))
          );
        });
        return candidatas.length === 1 ? candidatas[0] : undefined;
      };

      let created = 0;
      let updated = 0;
      const rowErrors: ImportError[] = [];

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const rowNumber = index + (parseMode === "and-itinerary" ? 3 : 2);
        const eventId = resolveEventId(row, selectedEventId, eventIdByName) || undefined;
        const countryCode = normalizeCountryCode(row.country_code);

        if (!eventId || !row.full_name || !countryCode) {
          rowErrors.push({ row: rowNumber, message: "Faltan campos requeridos" });
          continue;
        }

        // Los coordinadores de evento —Comité y Transporte— coordinan el
        // evento entero: no pertenecen a una delegación ni a un deporte, igual
        // que en la ficha a mano.
        const esCoordinadorDeEvento = isEventCoordinator(row.user_type);

        let delegation: Record<string, any> | undefined;
        if (row.delegation) {
          // La columna manda. No se crea la delegación al vuelo: una región
          // mal escrita crearía una delegación fantasma y los participantes
          // quedarían repartidos entre las dos.
          delegation = buscarDelegacion(row.delegation, eventId);
          if (!delegation) {
            rowErrors.push({
              row: rowNumber,
              field: "delegation",
              message: `No existe la delegación "${row.delegation}" en este evento. Créala en Registro → Delegaciones.`
            });
            continue;
          }
        } else if (!esCoordinadorDeEvento) {
          delegation = delegationCache.get(`${eventId}::${countryCode}`);
          if (!delegation) {
            try {
              delegation = await apiFetch<Record<string, any>>("/delegations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId, countryCode })
              });
              delegationCache.set(`${eventId}::${countryCode}`, delegation);
            } catch (error) {
              rowErrors.push({
                row: rowNumber,
                field: "country_code",
                message: error instanceof Error ? error.message : "No se pudo crear la delegacion"
              });
              continue;
            }
          }
        }

        let disciplineId = row.discipline_id || undefined;
        if (!disciplineId && row.discipline_name) {
          disciplineId = disciplineByName.get(normalizeDisciplineName(row.discipline_name))?.id;
        }
        if (disciplineId && !disciplineById.has(disciplineId)) {
          disciplineId = undefined;
        }

        const passportKey = row.passport_number ? String(row.passport_number).toLowerCase() : "";
        const emailKey = row.email ? String(row.email).toLowerCase() : "";
        const existing =
          (passportKey ? athleteByPassport.get(passportKey) : null) ??
          (emailKey ? athleteByEmail.get(emailKey) : null);

        const arrivalTime = rowValue(row, "fecha_hora_llegada", "arrival_time");
        const arrivalAirline = rowValue(row, "aerolinea_llegada", "airline");
        const arrivalFlightNumber = rowValue(row, "vuelo_llegada", "flight_number");
        const arrivalBaggageClaim = rowValue(row, "retiro_equipaje_llegada", "arrival_baggage");
        const departureTime = rowValue(row, "fecha_hora_salida", "departure_time");
        const departureAirline = rowValue(row, "aerolinea_salida");
        const departureFlightNumber = rowValue(row, "vuelo_salida");
        const departureGate = rowValue(row, "puerta_embarque_salida", "departure_gate");
        const arrivalLuggage = {
          bolsoCount: toNumber(rowValue(row, "llegada_bolso_count", "bolso_count")),
          bag8Count: toNumber(rowValue(row, "llegada_maleta_8_count", "maleta_8_count", "bag_8_count")),
          suitcase10Count: toNumber(rowValue(row, "llegada_maleta_10_count", "maleta_10_count", "suitcase_10_count")),
          suitcase15Count: toNumber(rowValue(row, "llegada_maleta_15_count", "maleta_15_count", "suitcase_15_count")),
          suitcase23Count: toNumber(rowValue(row, "llegada_maleta_23_count", "maleta_23_count", "suitcase_23_count")),
          oversizeText: rowValue(row, "llegada_sobreequipaje", "sobreequipaje", "oversize_text"),
          volume: rowValue(row, "llegada_volumen", "volumen", "luggage_volume")
        };
        const departureLuggage = {
          bolsoCount: toNumber(rowValue(row, "salida_bolso_count")),
          bag8Count: toNumber(rowValue(row, "salida_maleta_8_count")),
          suitcase10Count: toNumber(rowValue(row, "salida_maleta_10_count")),
          suitcase15Count: toNumber(rowValue(row, "salida_maleta_15_count")),
          suitcase23Count: toNumber(rowValue(row, "salida_maleta_23_count")),
          oversizeText: rowValue(row, "salida_sobreequipaje"),
          volume: rowValue(row, "salida_volumen")
        };
        const inferredTripType =
          arrivalTime && !departureTime
            ? "ARRIVAL"
            : departureTime && !arrivalTime
              ? "DEPARTURE"
              : "";
        const primaryTripType =
          inferredTripType || normalizeTripTypeValue(row.trip_type);
        const primaryLuggage = primaryTripType === "DEPARTURE" ? departureLuggage : arrivalLuggage;

        const payload: Record<string, any> = {
          eventId,
          delegationId: delegation?.id ?? null,
          disciplineId: esCoordinadorDeEvento ? null : disciplineId,
          fullName: row.full_name || undefined,
          rut: row.rut || undefined,
          email: row.email || undefined,
          phone: row.phone || undefined,
          countryCode,
          passportNumber: row.passport_number || undefined,
          dateOfBirth: row.date_of_birth ? toDateOnly(row.date_of_birth) : undefined,
          userType: row.user_type || undefined,
          visaRequired: toBoolean(normalizeBooleanLike(row.visa_required)),
          tripType: primaryTripType || undefined,
          flightNumber:
            (primaryTripType === "DEPARTURE" ? departureFlightNumber : arrivalFlightNumber) || undefined,
          airline:
            (primaryTripType === "DEPARTURE" ? departureAirline : arrivalAirline) || undefined,
          arrivalTime: arrivalTime ? toDateTime(arrivalTime) : undefined,
          departureTime: departureTime ? toDateTime(departureTime) : undefined,
          departureGate: departureGate || undefined,
          arrivalBaggage: arrivalBaggageClaim || undefined,
          bolsoCount: primaryLuggage.bolsoCount,
          bag8Count: primaryLuggage.bag8Count,
          suitcase10Count: primaryLuggage.suitcase10Count,
          suitcase15Count: primaryLuggage.suitcase15Count,
          suitcase23Count: primaryLuggage.suitcase23Count,
          oversizeText: primaryLuggage.oversizeText || undefined,
          luggageVolume: primaryLuggage.volume || undefined,
          wheelchairUser: toBoolean(normalizeBooleanLike(row.wheelchair_user)),
          wheelchairStandardCount: toNumber(row.wheelchair_standard_count),
          wheelchairSportCount: toNumber(row.wheelchair_sport_count),
          sportsEquipment: row.sports_equipment || undefined,
          requiresAssistance: toBoolean(normalizeBooleanLike(row.requires_assistance)),
          observations: row.observations || undefined,
          isDelegationLead: toBoolean(normalizeBooleanLike(row.is_delegation_lead)),
          metadata: {
            ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
            ...(row.gender ? { gender: row.gender } : {}),
            ...(row.category ? { category: row.category } : {}),
            arrival: {
              flightNumber: arrivalFlightNumber || null,
              airline: arrivalAirline || null,
              baggageClaim: arrivalBaggageClaim || null,
              time: arrivalTime ? toDateTime(arrivalTime) : null,
              luggage: arrivalLuggage
            },
            departure: {
              flightNumber: departureFlightNumber || null,
              airline: departureAirline || null,
              gate: departureGate || null,
              time: departureTime ? toDateTime(departureTime) : null,
              luggage: departureLuggage
            }
          },
          roomType: row.room_type || undefined,
          roomNumber: row.room_number || undefined,
          bedType: row.bed_type || undefined,
          status: row.status || undefined
        };

        if (row.hotel_name) {
          const hotel = accommodationByKey.get(`${eventId}::${row.hotel_name.toLowerCase()}`);
          if (hotel) payload.hotelAccommodationId = hotel.id;
        }

        const payloadPassportKey = payload.passportNumber ? String(payload.passportNumber).toLowerCase() : "";
        const payloadEmailKey = payload.email ? String(payload.email).toLowerCase() : "";

        try {
          const saved = existing?.id
            ? await apiFetch<Record<string, any>>(`/athletes/${existing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              })
            : await apiFetch<Record<string, any>>("/athletes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

          if (existing?.id) updated += 1;
          else created += 1;

          if (payload.passportNumber) athleteByPassport.set(payloadPassportKey, saved);
          if (payload.email) athleteByEmail.set(payloadEmailKey, saved);
        } catch (error) {
          rowErrors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : "Error al importar"
          });
        }
      }

      setErrors(rowErrors);
      setResult(`Importados: ${created} creados, ${updated} actualizados.`);
      if (created > 0 || updated > 0) {
        onImported?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const importHospitality = async () => {
    setLoading(true);
    setResult(null);
    try {
      const accommodations = await apiFetch<Record<string, any>[]>("/accommodations");
      const rooms = await apiFetch<Record<string, any>[]>("/hotel-rooms");
      const beds = await apiFetch<Record<string, any>[]>("/hotel-beds");
      const accommodationByKey = new Map(
        (accommodations || []).map((item) => [`${item.eventId}::${String(item.name).toLowerCase()}`, item])
      );
      const roomByKey = new Map(
        (rooms || []).map((item) => [`${item.hotelId}::${String(item.roomNumber).toLowerCase()}`, item])
      );
      const bedCountByKey = new Map<string, number>();
      (beds || []).forEach((bed) => {
        const key = `${bed.roomId}::${String(bed.bedType).toUpperCase()}`;
        bedCountByKey.set(key, (bedCountByKey.get(key) ?? 0) + 1);
      });
      const rowErrors: ImportError[] = [];
      const roomCounts = new Map<string, number>();
      normalizedRows.forEach((row) => {
        const key = `${row.event_id}::${row.hotel_name}::${row.room_number}`;
        roomCounts.set(key, (roomCounts.get(key) ?? 0) + 1);
      });

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const rowNumber = index + 2;
        if (!row.event_id || !row.hotel_name || !row.room_number || !row.bed_type) {
          rowErrors.push({ row: rowNumber, message: "Faltan campos requeridos" });
          continue;
        }
        const hotelKey = `${row.event_id}::${row.hotel_name.toLowerCase()}`;
        let hotel = accommodationByKey.get(hotelKey);
        if (!hotel) {
          try {
            const createdHotel = await apiFetch<Record<string, any>>("/accommodations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventId: row.event_id,
                name: row.hotel_name,
                address: row.hotel_address || undefined
              })
            });
            accommodationByKey.set(hotelKey, createdHotel);
            hotel = createdHotel;
          } catch (error) {
            rowErrors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Error creando hotel" });
            continue;
          }
        }
        const roomKey = `${hotel.id}::${row.room_number.toLowerCase()}`;
        let room = roomByKey.get(roomKey);
        if (!room) {
          const countKey = `${row.event_id}::${row.hotel_name}::${row.room_number}`;
          const bedsCapacity = roomCounts.get(countKey) ?? 1;
          try {
            const createdRoom = await apiFetch<Record<string, any>>("/hotel-rooms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                hotelId: hotel.id,
                roomNumber: row.room_number,
                roomType: row.room_type || "SINGLE",
                bedsCapacity
              })
            });
            roomByKey.set(roomKey, createdRoom);
            room = createdRoom;
          } catch (error) {
            rowErrors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Error creando habitacion" });
            continue;
          }
        }
        const bedKey = `${room.id}::${row.bed_type.toUpperCase()}`;
        const currentCount = bedCountByKey.get(bedKey) ?? 0;
        try {
          await apiFetch("/hotel-beds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id, bedType: row.bed_type, status: row.bed_status || "AVAILABLE" })
          });
          bedCountByKey.set(bedKey, currentCount + 1);
        } catch (error) {
          rowErrors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Error creando cama" });
        }
      }

      setErrors(rowErrors);
      setResult(rowErrors.length === 0 ? "Carga completada." : `Carga finalizada con ${rowErrors.length} errores.`);
      if (rowErrors.length === 0) {
        onImported?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const importDrivers = async () => {
    setLoading(true);
    setResult(null);
    try {
      const drivers = await apiFetch<Record<string, any>[]>("/drivers");
      const driverByRut = new Map(
        (drivers || []).filter((item) => item.rut).map((item) => [String(item.rut).toLowerCase(), item])
      );
      const driverByEmail = new Map(
        (drivers || []).filter((item) => item.email).map((item) => [String(item.email).toLowerCase(), item])
      );
      let created = 0;
      let updated = 0;
      const rowErrors: ImportError[] = [];

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const rowNumber = index + 2;
        const vehicleCapacity = row.vehicle_capacity ? Number(row.vehicle_capacity) : undefined;
        const payload: Record<string, any> = {
          eventId: row.event_id || undefined,
          providerId: row.provider_id || undefined,
          fullName: row.full_name || undefined,
          rut: row.rut || undefined,
          email: row.email || undefined,
          licenseNumber: row.license_number || undefined,
          phone: row.phone || undefined,
          vehiclePlate: row.vehicle_plate || undefined,
          vehicleType: row.vehicle_type || undefined,
          vehicleBrand: row.vehicle_brand || undefined,
          vehicleModel: row.vehicle_model || undefined,
          vehicleCapacity,
          vehicleStatus: row.vehicle_status || undefined,
          status: row.status || undefined
        };

        if (!payload.eventId || !payload.fullName || !payload.rut) {
          rowErrors.push({ row: rowNumber, message: "Faltan campos requeridos" });
          continue;
        }
        if (row.vehicle_capacity && Number.isNaN(vehicleCapacity)) {
          rowErrors.push({ row: rowNumber, field: "vehicle_capacity", message: "Capacidad de vehiculo invalida" });
          continue;
        }
        const rutKey = payload.rut ? String(payload.rut).toLowerCase() : "";
        const emailKey = payload.email ? String(payload.email).toLowerCase() : "";
        const existing =
          (rutKey ? driverByRut.get(rutKey) : null) ??
          (emailKey ? driverByEmail.get(emailKey) : null);

        try {
          if (existing?.id) {
            await apiFetch(`/drivers/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            updated += 1;
          } else {
            const createdDriver = await apiFetch<Record<string, any>>("/drivers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            created += 1;
            if (payload.rut) driverByRut.set(rutKey, createdDriver);
            if (payload.email) driverByEmail.set(emailKey, createdDriver);
          }
        } catch (error) {
          rowErrors.push({ row: rowNumber, message: error instanceof Error ? error.message : "Error al importar" });
        }
      }

      setErrors(rowErrors);
      setResult(`Importados: ${created} creados, ${updated} actualizados.`);
      if (created > 0 || updated > 0) {
        onImported?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const ok = await validate();
    if (!ok) return;
    if (type === "athletes") {
      await importAthletes();
    } else if (type === "drivers") {
      await importDrivers();
    } else {
      await importHospitality();
    }
  };

  const previewRows = normalizedRows.slice(0, 8);

  if (isMobile && !abiertoEnTelefono) {
    return (
      <button
        type="button"
        className="surface"
        onClick={() => setAbiertoEnTelefono(true)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "12px 14px", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND.teal }}>{t("Carga masiva")}</span>
          <span style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--text)", marginTop: "2px" }}>{t("Importar desde XLSX")}</span>
        </span>
        <span style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden>›</span>
      </button>
    );
  }

  return (
    <section
      className="surface max-w-full min-w-0 overflow-hidden rounded-3xl p-6 space-y-4"
      style={{ borderTop: `2px solid ${BRAND.teal}`, boxShadow: "0 1px 6px rgba(15,23,42,0.06)" }}
    >
      {isMobile && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-8px" }}>
          <button type="button" className="btn btn-ghost" style={{ minHeight: "36px", fontSize: "12px" }} onClick={() => setAbiertoEnTelefono(false)}>
            {t("Cerrar")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal, marginBottom: "4px" }}>{t("Carga masiva")}</p>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
            {type === "athletes"
              ? athleteMode === "registration"
                ? t("Inscripción de participantes")
                : t("Participantes AND")
              : type === "drivers"
                ? t("Conductores")
                : t("Hoteles/Villa Panamerica")}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "3px" }}>{t("Sube XLSX, revisa la vista previa y luego importa.")}</p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() =>
            downloadTemplate(
              headers,
              type === "athletes"
                ? athleteMode === "registration"
                  ? "template-inscripcion-participantes.xlsx"
                  : "template-and-vacio.xlsx"
                : type === "drivers"
                  ? "template-conductores.xlsx"
                  : "template-hoteleria.xlsx",
              type === "athletes" && athleteMode === "registration"
                ? athleteRegistrationExamples
                : [],
              type === "athletes" && athleteMode === "registration"
                ? REFERENCIA_INSCRIPCION
                : undefined,
            )
          }
        >
          {t("Descargar plantilla")}
        </button>
      </div>

      {type === "athletes" && athleteMode === "and" && (
        <div style={{ borderRadius: "14px", border: "1px solid var(--border)", background: "var(--elevated)", padding: "16px" }}>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="flex flex-col gap-2" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {t("Evento para la carga")}
              <select className="input" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                <option value="">{t("Selecciona un evento")}</option>
                {events.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ borderRadius: "10px", border: "1px solid var(--border)", padding: "12px 16px", fontSize: "13px", color: "var(--text-muted)" }}>
              {t("Formato detectado")}: <span style={{ fontWeight: 600, color: "var(--text)" }}>{parseMode === "and-itinerary" ? t("Itinerario AND real") : t("Plantilla normalizada")}</span>
            </div>
          </div>
          <p style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-faint)" }}>
            La plantilla acepta <code>event_name</code>. Si el archivo no trae evento, se usara el evento seleccionado aqui.
            Para fechas usa <code>dd-mm-yy</code> y para fecha/hora <code>dd-mm-yy hh:mm</code> o <code>dd-mm-yy hh-mm</code>.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2" style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          <span>{t("Archivo XLSX")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <input id={inputId} className="sr-only" type="file" accept=".xlsx" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} />
            <label htmlFor={inputId} className="btn btn-ghost cursor-pointer">{t("Seleccionar archivo")}</label>
            <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>{fileName ? `Archivo: ${fileName}` : t("Sin archivo seleccionado")}</span>
          </div>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => void validate()} disabled={!rows.length || loading}>{t("Validar")}</button>
        <button className="btn btn-primary" type="button" onClick={handleImport} disabled={!rows.length || loading}>{loading ? t("Cargando...") : t("Cargar")}</button>
      </div>

      {previewRows.length > 0 && (
        <div style={{ borderRadius: "14px", border: "1px solid var(--border)", background: "var(--elevated)", padding: "16px" }}>
          <div className="mb-3">
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: BRAND.teal }}>{t("Vista previa")}</p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>{t("Mostrando")} {previewRows.length} {t("de")} {normalizedRows.length} {t("fila(s).")}</p>
          </div>
          <div style={{ maxWidth: "100%", overflow: "hidden", borderRadius: "10px", border: "1px solid var(--border)" }}>
            <div className="max-w-full overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "max-content", minWidth: "100%", textAlign: "left", fontSize: "12px", color: "var(--text-muted)" }}>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      style={{ whiteSpace: "nowrap", borderBottom: "2px solid rgba(31,205,255,0.25)", background: "linear-gradient(to bottom, #eaf4fb, #e8f0f8)", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND.blue }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={`${index}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    {headers.map((header) => (
                      <td
                        key={header}
                        style={{ maxWidth: "160px", whiteSpace: "nowrap", padding: "8px 12px", verticalAlign: "top", color: "var(--text-muted)" }}
                        title={row[header] || "-"}
                      >
                        <span className="block overflow-hidden text-ellipsis">
                          {row[header] || "-"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
          <p style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-faint)" }}>
            {t("Desplaza horizontalmente para revisar todas las columnas antes de cargar.")}
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          <p className="font-semibold">{t("Errores encontrados")}</p>
          <ul className="list-disc pl-5">
            {errors.slice(0, 20).map((error, index) => (
              <li key={`${error.row}-${index}`}>
                {t("Fila")} {error.row}
                {error.field ? ` (${error.field})` : ""}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <p className={`text-sm ${validationStatus === "error" ? "text-rose-400" : "text-emerald-400"}`}>
          {result}
        </p>
      )}
    </section>
  );
}
