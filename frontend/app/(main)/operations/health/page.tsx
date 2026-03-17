"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";

type EventItem = { id: string; name?: string | null };
type DelegationItem = { id: string; eventId?: string | null; countryCode?: string | null };
type DisciplineItem = {
  id: string;
  name?: string | null;
  eventId?: string | null;
  category?: string | null;
  gender?: string | null;
};
type AthleteItem = {
  id: string;
  eventId?: string | null;
  delegationId?: string | null;
  disciplineId?: string | null;
  fullName?: string | null;
  passportNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};

type YesNo = "" | "SI" | "NO";
type HealthRecord = {
  sport: string;
  personal: {
    fullName: string;
    socialName: string;
    genderIdentity: string;
    idCardGender: string;
    rut: string;
    height: string;
    weight: string;
    birthDate: string;
    allergic: YesNo;
    allergicTo: string;
    chronicDiseases: YesNo;
    chronicDetail: string;
    medications: string;
    psychiatricTreatment: YesNo;
    psychiatricDetail: string;
    psychiatricDiagnosis: string;
    psychiatricMedications: YesNo;
    psychiatricDoseSchedule: string;
    specialDiet: YesNo;
    specialDietDetail: string;
  };
  contact: {
    address: string;
    commune: string;
    city: string;
    region: string;
    phone: string;
    email: string;
    indigenous: YesNo;
    indigenousDetail: string;
    shirtSize: string;
  };
  representation: {
    dependencyType: string;
    institutionName: string;
    enrolledClub: YesNo;
    clubName: string;
    promesasChile: YesNo;
  };
  emergency: {
    name: string;
    phone: string;
    email: string;
    address: string;
    relation: string;
  };
  healthCertificate: {
    athleteName: string;
    fitness: "" | "APTO" | "NO_APTO";
    doctorName: string;
    doctorRut: string;
    signatureStamp: string;
  };
  guardianAuthorization: {
    guardianName: string;
    guardianRut: string;
    guardianSignature: string;
  };
  schoolCertificate: {
    establishmentName: string;
    studentName: string;
    studentRut: string;
    directorName: string;
    directorRut: string;
    directorSignature: string;
    directorStamp: string;
    certificateDate: string;
  };
};

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const DEPENDENCY_OPTIONS = ["Municipal", "Particular subvencionado", "Particular pagado"];
const HEALTH_SUBSECTIONS = [
  { id: "record", label: "Ficha" },
  { id: "dashboard", label: "Dashboard" },
  { id: "bulk", label: "Carga masiva" },
] as const;
const HEALTH_BULK_HEADERS = [
  "athlete_id",
  "event_id",
  "passport_number",
  "full_name",
  "sport",
  "social_name",
  "gender_identity",
  "id_card_gender",
  "rut",
  "height",
  "weight",
  "birth_date",
  "allergic",
  "allergic_to",
  "chronic_diseases",
  "chronic_detail",
  "medications",
  "psychiatric_treatment",
  "psychiatric_detail",
  "psychiatric_diagnosis",
  "psychiatric_medications",
  "psychiatric_dose_schedule",
  "special_diet",
  "special_diet_detail",
  "address",
  "commune",
  "city",
  "region",
  "phone",
  "email",
  "indigenous",
  "indigenous_detail",
  "shirt_size",
  "dependency_type",
  "institution_name",
  "enrolled_club",
  "club_name",
  "promesas_chile",
  "emergency_name",
  "emergency_phone",
  "emergency_email",
  "emergency_address",
  "emergency_relation",
  "health_certificate_athlete_name",
  "health_certificate_fitness",
  "health_certificate_doctor_name",
  "health_certificate_doctor_rut",
  "health_certificate_signature_stamp",
  "guardian_name",
  "guardian_rut",
  "guardian_signature",
  "school_establishment_name",
  "school_student_name",
  "school_student_rut",
  "school_director_name",
  "school_director_rut",
  "school_director_signature",
  "school_director_stamp",
  "school_certificate_date",
] as const;
type HealthSubsection = (typeof HEALTH_SUBSECTIONS)[number]["id"];
type BulkImportError = { row: number; field?: string; message: string };
type BulkHealthRow = Record<string, string>;

function emptyHealthRecord(): HealthRecord {
  return {
    sport: "",
    personal: {
      fullName: "",
      socialName: "",
      genderIdentity: "",
      idCardGender: "",
      rut: "",
      height: "",
      weight: "",
      birthDate: "",
      allergic: "",
      allergicTo: "",
      chronicDiseases: "",
      chronicDetail: "",
      medications: "",
      psychiatricTreatment: "",
      psychiatricDetail: "",
      psychiatricDiagnosis: "",
      psychiatricMedications: "",
      psychiatricDoseSchedule: "",
      specialDiet: "",
      specialDietDetail: "",
    },
    contact: {
      address: "",
      commune: "",
      city: "",
      region: "",
      phone: "",
      email: "",
      indigenous: "",
      indigenousDetail: "",
      shirtSize: "",
    },
    representation: {
      dependencyType: "",
      institutionName: "",
      enrolledClub: "",
      clubName: "",
      promesasChile: "",
    },
    emergency: {
      name: "",
      phone: "",
      email: "",
      address: "",
      relation: "",
    },
    healthCertificate: {
      athleteName: "",
      fitness: "",
      doctorName: "",
      doctorRut: "",
      signatureStamp: "",
    },
    guardianAuthorization: {
      guardianName: "",
      guardianRut: "",
      guardianSignature: "",
    },
    schoolCertificate: {
      establishmentName: "",
      studentName: "",
      studentRut: "",
      directorName: "",
      directorRut: "",
      directorSignature: "",
      directorStamp: "",
      certificateDate: "",
    },
  };
}

function safeRecord(raw: unknown, fallbackName = "", fallbackRut = ""): HealthRecord {
  const base = emptyHealthRecord();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    base.personal.fullName = fallbackName;
    base.personal.rut = fallbackRut;
    base.healthCertificate.athleteName = fallbackName;
    base.schoolCertificate.studentName = fallbackName;
    base.schoolCertificate.studentRut = fallbackRut;
    return base;
  }
  const merged = {
    ...base,
    ...(raw as Record<string, unknown>),
    personal: { ...base.personal, ...((raw as any).personal ?? {}) },
    contact: { ...base.contact, ...((raw as any).contact ?? {}) },
    representation: { ...base.representation, ...((raw as any).representation ?? {}) },
    emergency: { ...base.emergency, ...((raw as any).emergency ?? {}) },
    healthCertificate: { ...base.healthCertificate, ...((raw as any).healthCertificate ?? {}) },
    guardianAuthorization: {
      ...base.guardianAuthorization,
      ...((raw as any).guardianAuthorization ?? {}),
    },
    schoolCertificate: { ...base.schoolCertificate, ...((raw as any).schoolCertificate ?? {}) },
  } as HealthRecord;
  if (!merged.personal.fullName) merged.personal.fullName = fallbackName;
  if (!merged.personal.rut) merged.personal.rut = fallbackRut;
  if (!merged.healthCertificate.athleteName) merged.healthCertificate.athleteName = fallbackName;
  if (!merged.schoolCertificate.studentName) merged.schoolCertificate.studentName = fallbackName;
  if (!merged.schoolCertificate.studentRut) merged.schoolCertificate.studentRut = fallbackRut;
  return merged;
}

function fillRate(record: HealthRecord) {
  const values = [
    record.sport,
    ...Object.values(record.personal),
    ...Object.values(record.contact),
    ...Object.values(record.representation),
    ...Object.values(record.emergency),
    ...Object.values(record.healthCertificate),
    ...Object.values(record.guardianAuthorization),
    ...Object.values(record.schoolCertificate),
  ];
  const filled = values.filter((value) => String(value ?? "").trim().length > 0).length;
  return Math.round((filled / values.length) * 100);
}

function athleteOptionLabel(item: AthleteItem) {
  const name = String(item.fullName ?? "").trim();
  if (name) return name;
  const passport = String(item.passportNumber ?? "").trim();
  return passport || item.id;
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function tokenizeHealthList(value?: string | null) {
  return String(value ?? "")
    .split(/,|;|\n|\/|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTitle(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseSpreadsheet(file: File) {
  return new Promise<BulkHealthRow[]>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<BulkHealthRow>(sheet, { defval: "", raw: false });
        resolve(
          rows.map((row) => {
            const next: BulkHealthRow = {};
            Object.entries(row).forEach(([key, value]) => {
              next[normalizeHeader(key)] = String(value ?? "").trim();
            });
            return next;
          }),
        );
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function downloadHealthTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([Array.from(HEALTH_BULK_HEADERS)]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "HealthImport");
  XLSX.writeFile(workbook, "template-fichas-salud.xlsx");
}

function parseYesNo(value?: string | null): YesNo {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (["si", "sí", "s"].includes(normalized)) return "SI";
  if (["no", "n"].includes(normalized)) return "NO";
  return "";
}

function parseDateInput(value?: string | null) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function mergeBulkHealthRecord(base: HealthRecord, row: BulkHealthRow) {
  const next = safeRecord(base);
  const assign = (current: string, incoming?: string) => {
    const value = String(incoming ?? "").trim();
    return value || current;
  };

  next.sport = assign(next.sport, row.sport);
  next.personal.fullName = assign(next.personal.fullName, row.full_name);
  next.personal.socialName = assign(next.personal.socialName, row.social_name);
  next.personal.genderIdentity = assign(next.personal.genderIdentity, row.gender_identity);
  next.personal.idCardGender = assign(next.personal.idCardGender, row.id_card_gender);
  next.personal.rut = assign(next.personal.rut, row.rut);
  next.personal.height = assign(next.personal.height, row.height);
  next.personal.weight = assign(next.personal.weight, row.weight);
  next.personal.birthDate = parseDateInput(row.birth_date) || next.personal.birthDate;
  next.personal.allergic = parseYesNo(row.allergic) || next.personal.allergic;
  next.personal.allergicTo = assign(next.personal.allergicTo, row.allergic_to);
  next.personal.chronicDiseases = parseYesNo(row.chronic_diseases) || next.personal.chronicDiseases;
  next.personal.chronicDetail = assign(next.personal.chronicDetail, row.chronic_detail);
  next.personal.medications = assign(next.personal.medications, row.medications);
  next.personal.psychiatricTreatment = parseYesNo(row.psychiatric_treatment) || next.personal.psychiatricTreatment;
  next.personal.psychiatricDetail = assign(next.personal.psychiatricDetail, row.psychiatric_detail);
  next.personal.psychiatricDiagnosis = assign(next.personal.psychiatricDiagnosis, row.psychiatric_diagnosis);
  next.personal.psychiatricMedications = parseYesNo(row.psychiatric_medications) || next.personal.psychiatricMedications;
  next.personal.psychiatricDoseSchedule = assign(next.personal.psychiatricDoseSchedule, row.psychiatric_dose_schedule);
  next.personal.specialDiet = parseYesNo(row.special_diet) || next.personal.specialDiet;
  next.personal.specialDietDetail = assign(next.personal.specialDietDetail, row.special_diet_detail);

  next.contact.address = assign(next.contact.address, row.address);
  next.contact.commune = assign(next.contact.commune, row.commune);
  next.contact.city = assign(next.contact.city, row.city);
  next.contact.region = assign(next.contact.region, row.region);
  next.contact.phone = assign(next.contact.phone, row.phone);
  next.contact.email = assign(next.contact.email, row.email);
  next.contact.indigenous = parseYesNo(row.indigenous) || next.contact.indigenous;
  next.contact.indigenousDetail = assign(next.contact.indigenousDetail, row.indigenous_detail);
  next.contact.shirtSize = assign(next.contact.shirtSize, row.shirt_size);

  next.representation.dependencyType = assign(next.representation.dependencyType, row.dependency_type);
  next.representation.institutionName = assign(next.representation.institutionName, row.institution_name);
  next.representation.enrolledClub = parseYesNo(row.enrolled_club) || next.representation.enrolledClub;
  next.representation.clubName = assign(next.representation.clubName, row.club_name);
  next.representation.promesasChile = parseYesNo(row.promesas_chile) || next.representation.promesasChile;

  next.emergency.name = assign(next.emergency.name, row.emergency_name);
  next.emergency.phone = assign(next.emergency.phone, row.emergency_phone);
  next.emergency.email = assign(next.emergency.email, row.emergency_email);
  next.emergency.address = assign(next.emergency.address, row.emergency_address);
  next.emergency.relation = assign(next.emergency.relation, row.emergency_relation);

  next.healthCertificate.athleteName = assign(next.healthCertificate.athleteName, row.health_certificate_athlete_name);
  const fitness = String(row.health_certificate_fitness ?? "").trim().toUpperCase();
  if (fitness === "APTO" || fitness === "NO_APTO") next.healthCertificate.fitness = fitness;
  next.healthCertificate.doctorName = assign(next.healthCertificate.doctorName, row.health_certificate_doctor_name);
  next.healthCertificate.doctorRut = assign(next.healthCertificate.doctorRut, row.health_certificate_doctor_rut);
  next.healthCertificate.signatureStamp = assign(next.healthCertificate.signatureStamp, row.health_certificate_signature_stamp);

  next.guardianAuthorization.guardianName = assign(next.guardianAuthorization.guardianName, row.guardian_name);
  next.guardianAuthorization.guardianRut = assign(next.guardianAuthorization.guardianRut, row.guardian_rut);
  next.guardianAuthorization.guardianSignature = assign(next.guardianAuthorization.guardianSignature, row.guardian_signature);

  next.schoolCertificate.establishmentName = assign(next.schoolCertificate.establishmentName, row.school_establishment_name);
  next.schoolCertificate.studentName = assign(next.schoolCertificate.studentName, row.school_student_name);
  next.schoolCertificate.studentRut = assign(next.schoolCertificate.studentRut, row.school_student_rut);
  next.schoolCertificate.directorName = assign(next.schoolCertificate.directorName, row.school_director_name);
  next.schoolCertificate.directorRut = assign(next.schoolCertificate.directorRut, row.school_director_rut);
  next.schoolCertificate.directorSignature = assign(next.schoolCertificate.directorSignature, row.school_director_signature);
  next.schoolCertificate.directorStamp = assign(next.schoolCertificate.directorStamp, row.school_director_stamp);
  next.schoolCertificate.certificateDate = parseDateInput(row.school_certificate_date) || next.schoolCertificate.certificateDate;

  return next;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function printable(value?: string | null) {
  const text = String(value ?? "").trim();
  return escapeHtml(text || "______________________________");
}

function yesNoMark(value: YesNo, expected: "SI" | "NO") {
  return value === expected ? "X" : "";
}

function formatPrintDate(iso: string) {
  const text = String(iso || "").trim();
  if (!text) return "____/____/________";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return printable(text);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function loadLogoAsDataUrl(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Logo no disponible: ${path}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`No se pudo leer logo: ${path}`));
    reader.readAsDataURL(blob);
  });
}

export default function HealthPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [athletePickerOpen, setAthletePickerOpen] = useState(false);
  const [record, setRecord] = useState<HealthRecord>(emptyHealthRecord());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSubsection, setActiveSubsection] = useState<HealthSubsection>("record");
  const [bulkRows, setBulkRows] = useState<BulkHealthRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkErrors, setBulkErrors] = useState<BulkImportError[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventData, delegationData, disciplineData, athleteData] = await Promise.all([
        apiFetch<EventItem[]>("/events"),
        apiFetch<DelegationItem[]>("/delegations"),
        apiFetch<DisciplineItem[]>("/disciplines"),
        apiFetch<AthleteItem[]>("/athletes"),
      ]);
      const safeEvents = Array.isArray(eventData) ? eventData : [];
      const safeDelegations = Array.isArray(delegationData) ? delegationData : [];
      const safeDisciplines = Array.isArray(disciplineData) ? disciplineData : [];
      const safeAthletes = filterValidatedAthletes(Array.isArray(athleteData) ? athleteData : []);
      setEvents(safeEvents);
      setDelegations(safeDelegations);
      setDisciplines(safeDisciplines);
      setAthletes(safeAthletes);
      if (!selectedEventId && safeEvents.length > 0) setSelectedEventId(safeEvents[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar sección salud.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredDelegations = useMemo(
    () => delegations.filter((item) => (selectedEventId ? item.eventId === selectedEventId : true)),
    [delegations, selectedEventId],
  );
  const filteredAthletes = useMemo(
    () =>
      athletes.filter((item) => {
        if (selectedEventId && item.eventId !== selectedEventId) return false;
        if (selectedDelegationId && item.delegationId !== selectedDelegationId) return false;
        return true;
      }),
    [athletes, selectedEventId, selectedDelegationId],
  );
  const selectedAthlete = useMemo(
    () => athletes.find((item) => item.id === selectedAthleteId) ?? null,
    [athletes, selectedAthleteId],
  );
  const selectedAthleteDiscipline = useMemo(
    () =>
      selectedAthlete?.disciplineId
        ? disciplines.find((item) => item.id === selectedAthlete.disciplineId) ?? null
        : null,
    [selectedAthlete, disciplines],
  );
  const searchableAthletes = useMemo(() => {
    const term = athleteSearch.trim().toLowerCase();
    if (!term) return filteredAthletes;
    return filteredAthletes.filter((item) => athleteOptionLabel(item).toLowerCase().includes(term));
  }, [filteredAthletes, athleteSearch]);
  const filteredDisciplineOptions = useMemo(() => {
    const byEvent = selectedEventId ? disciplines.filter((item) => item.eventId === selectedEventId) : disciplines;
    const source = byEvent.length > 0 ? byEvent : disciplines;
    const category = String(selectedAthleteDiscipline?.category ?? "").trim().toUpperCase();
    const gender = String(selectedAthleteDiscipline?.gender ?? "").trim().toUpperCase();
    if (!category && !gender) return source;
    const constrained = source.filter((item) => {
      const itemCategory = String(item.category ?? "").trim().toUpperCase();
      const itemGender = String(item.gender ?? "").trim().toUpperCase();
      return (!category || itemCategory === category) && (!gender || itemGender === gender);
    });
    return constrained.length > 0 ? constrained : source;
  }, [disciplines, selectedEventId, selectedAthleteDiscipline]);
  const completion = useMemo(() => fillRate(record), [record]);
  const healthDashboard = useMemo(() => {
    const source = filteredAthletes.map((athlete) => {
      const metadata = athlete.metadata && typeof athlete.metadata === "object" ? athlete.metadata : {};
      const safe = safeRecord(
        (metadata as Record<string, unknown>).healthRecord,
        athlete.fullName ?? "",
        athlete.passportNumber ?? "",
      );
      return { athlete, record: safe, completion: fillRate(safe) };
    });

    const savedRecords = source.filter(({ record, completion }) => {
      const hasCoreData =
        Boolean(record.personal.fullName?.trim()) ||
        Boolean(record.personal.rut?.trim()) ||
        Boolean(record.sport?.trim()) ||
        completion > 0;
      return hasCoreData;
    });

    const chronicCounts = new Map<string, number>();
    const allergyCounts = new Map<string, number>();
    const dietCounts = new Map<string, number>();

    let specialDietCount = 0;
    let celiacCount = 0;
    let veganCount = 0;
    let vegetarianCount = 0;
    let allergicCount = 0;
    let chronicCount = 0;
    let psychiatricCount = 0;
    let medicationsCount = 0;

    savedRecords.forEach(({ record }) => {
      const dietDetail = normalizeText(record.personal.specialDietDetail);
      const chronicDetail = normalizeText(record.personal.chronicDetail);
      const allergicTo = normalizeText(record.personal.allergicTo);
      const medications = normalizeText(record.personal.medications);

      if (record.personal.specialDiet === "SI") specialDietCount += 1;
      if (record.personal.allergic === "SI") allergicCount += 1;
      if (record.personal.chronicDiseases === "SI") chronicCount += 1;
      if (record.personal.psychiatricTreatment === "SI") psychiatricCount += 1;
      if (medications) medicationsCount += 1;

      if (dietDetail) {
        const tags = tokenizeHealthList(dietDetail);
        tags.forEach((tag) => {
          const normalized = normalizeText(tag);
          if (!normalized) return;
          dietCounts.set(normalized, (dietCounts.get(normalized) ?? 0) + 1);
        });
      }

      if (dietDetail.includes("celiac") || dietDetail.includes("celiac")) celiacCount += 1;
      if (dietDetail.includes("vegano") || dietDetail.includes("vegan")) veganCount += 1;
      if (dietDetail.includes("vegetarian")) vegetarianCount += 1;

      if (chronicDetail) {
        tokenizeHealthList(chronicDetail).forEach((term) => {
          const normalized = normalizeText(term);
          if (!normalized) return;
          chronicCounts.set(normalized, (chronicCounts.get(normalized) ?? 0) + 1);
        });
      }

      if (allergicTo) {
        tokenizeHealthList(allergicTo).forEach((term) => {
          const normalized = normalizeText(term);
          if (!normalized) return;
          allergyCounts.set(normalized, (allergyCounts.get(normalized) ?? 0) + 1);
        });
      }
    });

    const toSortedArray = (map: Map<string, number>) =>
      Array.from(map.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 8)
        .map(([label, count]) => ({ label: toTitle(label), count }));

    return {
      totalAthletes: filteredAthletes.length,
      savedRecords: savedRecords.length,
      specialDietCount,
      celiacCount,
      veganCount,
      vegetarianCount,
      allergicCount,
      chronicCount,
      psychiatricCount,
      medicationsCount,
      topConditions: toSortedArray(chronicCounts),
      topAllergies: toSortedArray(allergyCounts),
      topDiets: toSortedArray(dietCounts),
    };
  }, [filteredAthletes]);
  const bulkPreview = useMemo(() => bulkRows.slice(0, 5), [bulkRows]);

  useEffect(() => {
    setSelectedAthleteId("");
    setAthleteSearch("");
    setAthletePickerOpen(false);
    setRecord(emptyHealthRecord());
  }, [selectedEventId, selectedDelegationId]);

  const onPickAthlete = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    const athlete = athletes.find((item) => item.id === athleteId);
    if (!athlete) {
      setAthleteSearch("");
      setAthletePickerOpen(false);
      setRecord(emptyHealthRecord());
      return;
    }
    setAthleteSearch(athleteOptionLabel(athlete));
    setAthletePickerOpen(false);
    const md = athlete.metadata && typeof athlete.metadata === "object" ? athlete.metadata : {};
    const health = (md as Record<string, unknown>).healthRecord;
    const next = safeRecord(health, athlete.fullName ?? "", athlete.passportNumber ?? "");
    if (!next.sport && athlete.disciplineId) {
      const discipline = disciplines.find((item) => item.id === athlete.disciplineId);
      if (discipline?.name) next.sport = discipline.name;
    }
    setRecord(next);
  };

  const onBulkFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setBulkResult(null);
    setBulkErrors([]);
    if (!file) {
      setBulkFileName(null);
      setBulkRows([]);
      return;
    }
    try {
      const parsed = await parseSpreadsheet(file);
      setBulkRows(parsed);
      setBulkFileName(file.name);
    } catch {
      setBulkRows([]);
      setBulkFileName(file.name);
      setBulkErrors([{ row: 0, message: "No se pudo leer el archivo. Usa Excel con la plantilla entregada." }]);
    }
  };

  const validateBulkRows = () => {
    const nextErrors: BulkImportError[] = [];
    bulkRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const hasIdentity = Boolean(String(row.athlete_id ?? "").trim()) || Boolean(String(row.passport_number ?? "").trim());
      if (!hasIdentity) nextErrors.push({ row: rowNumber, field: "athlete_id", message: "Debes indicar athlete_id o passport_number." });
      if (row.event_id && selectedEventId && row.event_id !== selectedEventId) {
        nextErrors.push({ row: rowNumber, field: "event_id", message: "El event_id no coincide con el filtro actual." });
      }
      if (row.birth_date && !parseDateInput(row.birth_date)) nextErrors.push({ row: rowNumber, field: "birth_date", message: "Fecha invalida." });
      if (row.school_certificate_date && !parseDateInput(row.school_certificate_date)) {
        nextErrors.push({ row: rowNumber, field: "school_certificate_date", message: "Fecha invalida." });
      }
      ["allergic", "chronic_diseases", "psychiatric_treatment", "psychiatric_medications", "special_diet", "indigenous", "enrolled_club", "promesas_chile"].forEach((field) => {
        const value = String(row[field] ?? "").trim();
        if (value && !parseYesNo(value)) nextErrors.push({ row: rowNumber, field, message: "Usa SI o NO." });
      });
      const shirtSize = String(row.shirt_size ?? "").trim().toUpperCase();
      if (shirtSize && !SHIRT_SIZES.includes(shirtSize)) nextErrors.push({ row: rowNumber, field: "shirt_size", message: "Talla invalida." });
    });
    setBulkErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const runBulkImport = async () => {
    setBulkResult(null);
    if (!bulkRows.length) {
      setBulkErrors([{ row: 0, message: "Carga primero un archivo de fichas." }]);
      return;
    }
    if (!validateBulkRows()) return;

    setBulkLoading(true);
    setBulkErrors([]);
    try {
      const athleteById = new Map(filteredAthletes.map((athlete) => [athlete.id, athlete]));
      const athleteByPassport = new Map(
        filteredAthletes
          .filter((athlete) => athlete.passportNumber)
          .map((athlete) => [String(athlete.passportNumber).trim().toLowerCase(), athlete]),
      );

      let updated = 0;
      for (let index = 0; index < bulkRows.length; index += 1) {
        const row = bulkRows[index];
        const rowNumber = index + 2;
        const athlete =
          athleteById.get(String(row.athlete_id ?? "").trim()) ||
          athleteByPassport.get(String(row.passport_number ?? "").trim().toLowerCase());

        if (!athlete) {
          setBulkErrors((current) => [...current, { row: rowNumber, message: "No se encontro participante para esa fila dentro del filtro actual." }]);
          continue;
        }

        const metadata = athlete.metadata && typeof athlete.metadata === "object" ? athlete.metadata : {};
        const currentRecord = safeRecord((metadata as Record<string, unknown>).healthRecord, athlete.fullName ?? "", athlete.passportNumber ?? "");
        const mergedRecord = mergeBulkHealthRecord(currentRecord, row);

        await apiFetch(`/athletes/${athlete.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: {
              ...metadata,
              healthRecord: mergedRecord,
            },
          }),
        });
        updated += 1;
      }

      setBulkResult(`Carga masiva finalizada. ${updated} fichas actualizadas.`);
      await load();
    } catch (err) {
      setBulkErrors((current) => [
        ...current,
        { row: 0, message: err instanceof Error ? err.message : "No se pudo completar la carga masiva." },
      ]);
    } finally {
      setBulkLoading(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAthlete) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const metadata = {
        ...(selectedAthlete.metadata && typeof selectedAthlete.metadata === "object" ? selectedAthlete.metadata : {}),
        healthRecord: record,
      };
      await apiFetch(`/athletes/${selectedAthlete.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });
      setMessage("Ficha de salud guardada correctamente.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la ficha de salud.");
    } finally {
      setSaving(false);
    }
  };

  const exportHealthSheet = async () => {
    if (!selectedAthlete) {
      setError("Selecciona un participante para exportar la ficha.");
      return;
    }
    setError(null);
    const r = record;
    let leftLogoSrc = "";
    let rightLogoSrc = "";
    try {
      [leftLogoSrc, rightLogoSrc] = await Promise.all([
        loadLogoAsDataUrl("/branding/fupd-left-logo.png"),
        loadLogoAsDataUrl("/branding/fupd-right-logo.png"),
      ]);
    } catch {
      setError("No se pudieron cargar los logos institucionales para la exportacion.");
      return;
    }
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ficha FUPD - ${escapeHtml(selectedAthlete.fullName || selectedAthlete.id)}</title>
  <style>
    @page { size: A4; margin: 8mm 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; background: #e2e8f0; }
    .page {
      height: 279mm;
      page-break-after: always;
      padding: 9.5mm 8.5mm 8mm;
      background: #ffffff;
      border: 1px solid #dbe3ef;
      display: flex;
      flex-direction: column;
    }
    .page:last-child { page-break-after: auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9mm; border-bottom: 2px solid #d6e3f7; padding-bottom: 4mm; }
    .brand-left { height: 54px; width: auto; object-fit: contain; }
    .brand-right { height: 54px; width: auto; object-fit: contain; }
    .title { font-size: 22px; font-weight: 800; margin: 0 0 3mm; color: #1d4ed8; line-height: 1.24; text-transform: uppercase; }
    .subtitle { font-size: 15px; font-weight: 600; margin: 0 0 7.5mm; color: #334155; }
    .section { margin-bottom: 8.5mm; }
    .section h3 { font-size: 15px; margin: 0 0 3.4mm; text-transform: uppercase; letter-spacing: 0.08em; color: #0f172a; }
    .line { margin: 4.4mm 0; font-size: 16px; line-height: 1.75; }
    .line strong { color: #0f172a; }
    .chip { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 12px; padding: 2px 10px; margin-bottom: 3.3mm; letter-spacing: 0.12em; text-transform: uppercase; color: #0f172a; background: #f8fafc; }
    .check { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1px solid #334155; margin: 0 2px; font-weight: 700; font-size: 13px; transform: translateY(1px); }
    .box { border: 2px solid #0f172a; padding: 4mm; margin-top: 3.2mm; border-radius: 4px; background: #fcfdff; }
    .footer { margin-top: auto; border-top: 2px solid #d6e3f7; padding-top: 3mm; font-size: 13px; color: #334155; font-weight: 600; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img class="brand-left" src="${leftLogoSrc}" alt="Logo institucional izquierda" />
      <img class="brand-right" src="${rightLogoSrc}" alt="Logo institucional derecha" />
    </div>
    <div class="chip">FUPD JDE 2025</div>
    <p class="title">ANEXO N2: FICHA UNICA DE PARTICIPACION DEL DEPORTISTA</p>
    <p class="subtitle">(Se debe completar todos los datos solicitados)</p>
    <div class="line"><strong>DEPORTE:</strong> ${printable(r.sport)}</div>
    <div class="section">
      <h3>Antecedentes personales</h3>
      <div class="line">Nombre completo: ${printable(r.personal.fullName)}</div>
      <div class="line">Nombre social: ${printable(r.personal.socialName)}</div>
      <div class="line">Genero identidad: ${printable(r.personal.genderIdentity)} | Genero cedula: ${printable(r.personal.idCardGender)}</div>
      <div class="line">RUT: ${printable(r.personal.rut)} | Estatura: ${printable(r.personal.height)} | Peso corporal: ${printable(r.personal.weight)}</div>
      <div class="line">Fecha nacimiento: ${formatPrintDate(r.personal.birthDate)} | Alergico(a): SI <span class="check">${yesNoMark(r.personal.allergic, "SI")}</span> NO <span class="check">${yesNoMark(r.personal.allergic, "NO")}</span> | Alergico a: ${printable(r.personal.allergicTo)}</div>
      <div class="line">Enfermedades cronicas: SI <span class="check">${yesNoMark(r.personal.chronicDiseases, "SI")}</span> NO <span class="check">${yesNoMark(r.personal.chronicDiseases, "NO")}</span> | Cual: ${printable(r.personal.chronicDetail)}</div>
      <div class="line">Medicamentos: ${printable(r.personal.medications)}</div>
      <div class="line">Tratamiento psiquiatrico: SI <span class="check">${yesNoMark(r.personal.psychiatricTreatment, "SI")}</span> NO <span class="check">${yesNoMark(r.personal.psychiatricTreatment, "NO")}</span> | Cual: ${printable(r.personal.psychiatricDetail)}</div>
      <div class="line">Diagnostico: ${printable(r.personal.psychiatricDiagnosis)}</div>
      <div class="line">Medicamentos psiquiatricos: SI <span class="check">${yesNoMark(r.personal.psychiatricMedications, "SI")}</span> NO <span class="check">${yesNoMark(r.personal.psychiatricMedications, "NO")}</span> | Dosis/horarios: ${printable(r.personal.psychiatricDoseSchedule)}</div>
      <div class="line">Alimentacion especial: SI <span class="check">${yesNoMark(r.personal.specialDiet, "SI")}</span> NO <span class="check">${yesNoMark(r.personal.specialDiet, "NO")}</span> | Cual: ${printable(r.personal.specialDietDetail)}</div>
    </div>
    <div class="footer">Bases Administrativas JDE 2025</div>
  </div>

  <div class="page">
    <div class="header">
      <img class="brand-left" src="${leftLogoSrc}" alt="Logo institucional izquierda" />
      <img class="brand-right" src="${rightLogoSrc}" alt="Logo institucional derecha" />
    </div>
    <div class="line">Direccion particular: ${printable(r.contact.address)}</div>
    <div class="line">Comuna: ${printable(r.contact.commune)} | Ciudad: ${printable(r.contact.city)} | Region: ${printable(r.contact.region)}</div>
    <div class="line">Fono: ${printable(r.contact.phone)} | Email: ${printable(r.contact.email)}</div>
    <div class="line">Pueblo originario: SI <span class="check">${yesNoMark(r.contact.indigenous, "SI")}</span> NO <span class="check">${yesNoMark(r.contact.indigenous, "NO")}</span> | Cual: ${printable(r.contact.indigenousDetail)}</div>
    <div class="line">Talla de ropa: ${printable(r.contact.shirtSize)}</div>
    <div class="section">
      <h3>Datos de representacion</h3>
      <div class="line">Dependencia: ${printable(r.representation.dependencyType)}</div>
      <div class="line">Institucion representada: ${printable(r.representation.institutionName)}</div>
      <div class="line">Inscrito en club: SI <span class="check">${yesNoMark(r.representation.enrolledClub, "SI")}</span> NO <span class="check">${yesNoMark(r.representation.enrolledClub, "NO")}</span> | Club: ${printable(r.representation.clubName)}</div>
      <div class="line">Promesas Chile: SI <span class="check">${yesNoMark(r.representation.promesasChile, "SI")}</span> NO <span class="check">${yesNoMark(r.representation.promesasChile, "NO")}</span></div>
      <div class="box">
        <strong>En caso de emergencia avisar a:</strong>
        <div class="line">Nombre: ${printable(r.emergency.name)}</div>
        <div class="line">Telefono: ${printable(r.emergency.phone)}</div>
        <div class="line">Email: ${printable(r.emergency.email)}</div>
        <div class="line">Direccion: ${printable(r.emergency.address)}</div>
        <div class="line">Parentezco/Relacion: ${printable(r.emergency.relation)}</div>
      </div>
    </div>
    <div class="footer">Bases Administrativas JDE 2025</div>
  </div>

  <div class="page">
    <div class="header">
      <img class="brand-left" src="${leftLogoSrc}" alt="Logo institucional izquierda" />
      <img class="brand-right" src="${rightLogoSrc}" alt="Logo institucional derecha" />
    </div>
    <h3 style="font-size:22px; text-align:center; margin: 8mm 0;">CERTIFICADO DE SALUD COMPATIBLE</h3>
    <div class="line">Nombre deportista: ${printable(r.healthCertificate.athleteName)}</div>
    <div class="line">Apto(a): <span class="check">${r.healthCertificate.fitness === "APTO" ? "X" : ""}</span> &nbsp;&nbsp;&nbsp; No apto(a): <span class="check">${r.healthCertificate.fitness === "NO_APTO" ? "X" : ""}</span></div>
    <div class="line">Para practicar actividades fisicas y/o deportivas competitivas.</div>
    <div class="line">Nombre medico: ${printable(r.healthCertificate.doctorName)}</div>
    <div class="line">RUT medico: ${printable(r.healthCertificate.doctorRut)}</div>
    <div class="line" style="margin-top: 30mm;">Firma y timbre: ${printable(r.healthCertificate.signatureStamp)}</div>
    <div class="footer">Bases Administrativas JDE 2025</div>
  </div>

  <div class="page">
    <div class="header">
      <img class="brand-left" src="${leftLogoSrc}" alt="Logo institucional izquierda" />
      <img class="brand-right" src="${rightLogoSrc}" alt="Logo institucional derecha" />
    </div>
    <h3 style="font-size:22px; margin: 8mm 0;">AUTORIZACION PADRES O APODERADO(A) Y DERECHOS DE IMAGEN</h3>
    <div class="line">Yo: ${printable(r.guardianAuthorization.guardianName)} | RUT: ${printable(r.guardianAuthorization.guardianRut)}</div>
    <div class="line">
      madre, padre o apoderado de quien se encuentra identificado(a) en la presente ficha, autorizo su participacion en los Juegos Deportivos Escolares
      y cedo derechos de imagen para registro fotografico y audiovisual del evento.
    </div>
    <div class="line" style="margin-top: 35mm;">Firma: ${printable(r.guardianAuthorization.guardianSignature)}</div>
    <div class="footer">Bases Administrativas JDE 2025</div>
  </div>

  <div class="page">
    <div class="header">
      <img class="brand-left" src="${leftLogoSrc}" alt="Logo institucional izquierda" />
      <img class="brand-right" src="${rightLogoSrc}" alt="Logo institucional derecha" />
    </div>
    <h3 style="font-size:22px; margin: 8mm 0;">CERTIFICADO DE PERTENENCIA ESCOLAR</h3>
    <div class="line">Establecimiento: ${printable(r.schoolCertificate.establishmentName)}</div>
    <div class="line">Alumno(a): ${printable(r.schoolCertificate.studentName)}</div>
    <div class="line">RUT: ${printable(r.schoolCertificate.studentRut)}</div>
    <div class="line">Nombre Director(a): ${printable(r.schoolCertificate.directorName)}</div>
    <div class="line">RUT Director(a): ${printable(r.schoolCertificate.directorRut)}</div>
    <div class="line">Firma Director(a): ${printable(r.schoolCertificate.directorSignature)}</div>
    <div class="line">Timbre Director(a): ${printable(r.schoolCertificate.directorStamp)}</div>
    <div class="line">Fecha: ${formatPrintDate(r.schoolCertificate.certificateDate)}</div>
    <div class="footer">Bases Administrativas JDE 2025</div>
  </div>
</body>
</html>`;
    try {
      const popup = window.open("", "_blank", "width=1024,height=900");
      if (!popup) {
        setError("No se pudo abrir la ventana de exportacion. Habilita popups para este sitio.");
        return;
      }
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.document.title = "";

      const waitForImages = () =>
        Promise.all(
          Array.from(popup.document.images).map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) resolve();
                else {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                }
              }),
          ),
        );

      waitForImages().then(() => {
        setTimeout(() => {
          popup.focus();
          popup.print();
        }, 200);
      });
    } catch {
      setError("No se pudo generar la vista de impresion de la ficha.");
    }
  };

  const yesNo = (label: string, value: YesNo, onChange: (value: YesNo) => void) => (
    <label className="space-y-1">
      <span className="text-sm font-medium text-white/80">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as YesNo)}>
        <option value="">Selecciona</option>
        <option value="SI">Sí</option>
        <option value="NO">No</option>
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <section
        className="rounded-3xl p-6 shadow-xl"
       
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Registro clínico-administrativo completo por participante.</p>
          </div>
          <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            {activeSubsection === "record" ? <>Avance ficha: <span className="font-semibold">{completion}%</span></> : <>Subsección: <span className="font-semibold">{HEALTH_SUBSECTIONS.find((item) => item.id === activeSubsection)?.label}</span></>}
          </div>
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <div className="grid gap-3 lg:grid-cols-12">
          <select className="input lg:col-span-4" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">Selecciona evento</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            ))}
          </select>
          <select className="input lg:col-span-3" value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
            <option value="">Todas las delegaciones</option>
            {filteredDelegations.map((item) => (
              <option key={item.id} value={item.id}>{item.countryCode || item.id}</option>
            ))}
          </select>
          <div className="relative lg:col-span-5">
            <input
              className="input pr-9"
              value={athleteSearch}
              onFocus={() => setAthletePickerOpen(true)}
              onBlur={() => setTimeout(() => setAthletePickerOpen(false), 120)}
              onChange={(e) => {
                const value = e.target.value;
                setAthleteSearch(value);
                setAthletePickerOpen(true);
                if (!value.trim()) {
                  setSelectedAthleteId("");
                  setRecord(emptyHealthRecord());
                }
              }}
              placeholder="Buscar y seleccionar participante"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-2 text-white/50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAthletePickerOpen((prev) => !prev)}
              aria-label="Mostrar participantes"
            >
              v
            </button>
            {athletePickerOpen ? (
              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl p-1 shadow-xl" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
                {searchableAthletes.length === 0 ? (
                  <div className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>Sin resultados</div>
                ) : (
                  searchableAthletes.slice(0, 60).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onPickAthlete(item.id)}
                    >
                      {athleteOptionLabel(item)}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
        {loading ? <p className="mt-3 text-sm text-white/50">Cargando...</p> : null}
      </section>

      <section className="surface rounded-2xl p-3">
        <div className="inline-flex flex-wrap rounded-2xl border border-white/8 bg-white/5 p-1">
          {HEALTH_SUBSECTIONS.map((item) => {
            const active = item.id === activeSubsection;
            return (
              <button
                key={item.id}
                type="button"
                className="min-w-[132px] rounded-xl px-4 py-2.5 text-sm font-semibold transition"
                style={active ? {background:"var(--gold-dim)",color:"#92670a",border:"1px solid var(--gold)"} : {background:"transparent",color:"var(--text-muted)"}}
                onClick={() => setActiveSubsection(item.id)}
              >
                <span className="block text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeSubsection === "dashboard" ? <section className="surface rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Subsección Salud / Dashboard</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Inteligencia de salud</h2>
            <p className="mt-1 text-sm text-white/50">
              Métricas calculadas sobre las fichas del filtro actual para detectar dietas, alergias y condiciones relevantes.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
            Universo analizado: <span className="font-semibold text-white">{healthDashboard.totalAthletes}</span> participantes
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl p-4" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">Fichas cargadas</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-400">{healthDashboard.savedRecords}</p>
            <p className="mt-1 text-sm text-emerald-400/70">Con información de salud registrada</p>
          </div>
          <div className="rounded-2xl p-4" style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)"}}>
            <p className="text-xs uppercase tracking-[0.18em] text-amber-400">Alimentación especial</p>
            <p className="mt-2 text-3xl font-semibold text-amber-400">{healthDashboard.specialDietCount}</p>
            <p className="mt-1 text-sm text-amber-400/70">Casos con requerimiento dietario declarado</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-400">Alergias</p>
            <p className="mt-2 text-3xl font-semibold text-rose-400">{healthDashboard.allergicCount}</p>
            <p className="mt-1 text-sm text-rose-400/70">Participantes con alergias activas</p>
          </div>
          <div className="rounded-2xl p-4" style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)"}}>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-400">Enfermedad crónica</p>
            <p className="mt-2 text-3xl font-semibold text-blue-400">{healthDashboard.chronicCount}</p>
            <p className="mt-1 text-sm text-blue-400/70">Casos con patología crónica declarada</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Celíacos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{healthDashboard.celiacCount}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Veganos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{healthDashboard.veganCount}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Vegetarianos</p>
            <p className="mt-2 text-2xl font-semibold text-white">{healthDashboard.vegetarianCount}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Con medicación</p>
            <p className="mt-2 text-2xl font-semibold text-white">{healthDashboard.medicationsCount}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Top condiciones</p>
            <div className="mt-3 space-y-2">
              {healthDashboard.topConditions.length === 0 ? <p className="text-sm text-white/50">Sin enfermedades crónicas detalladas.</p> : null}
              {healthDashboard.topConditions.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <span className="text-sm font-medium text-white/80">{item.label}</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white/80">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Top alergias</p>
            <div className="mt-3 space-y-2">
              {healthDashboard.topAllergies.length === 0 ? <p className="text-sm text-white/50">Sin alergias detalladas.</p> : null}
              {healthDashboard.topAllergies.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-rose-500/10 px-3 py-2">
                  <span className="text-sm font-medium text-white/80">{item.label}</span>
                  <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">Top dietas y restricciones</p>
            <div className="mt-3 space-y-2">
              {healthDashboard.topDiets.length === 0 ? <p className="text-sm text-white/50">Sin alimentación especial detallada.</p> : null}
              {healthDashboard.topDiets.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2">
                  <span className="text-sm font-medium text-white/80">{item.label}</span>
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> : null}

      {activeSubsection === "bulk" ? (
        <section className="surface rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Subsección Salud / Carga masiva</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">Importar fichas de salud</h2>
              <p className="mt-1 text-sm text-white/50">
                Actualiza fichas por lote usando `athlete_id` o `passport_number`, respetando el filtro actual.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={downloadHealthTemplate}>
              Descargar template
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <label className="block">
                <span className="text-sm font-medium text-white/80">Archivo Excel</span>
                <input className="input mt-2" type="file" accept=".xlsx,.xls" onChange={onBulkFileChange} />
              </label>
              <div className="mt-3 space-y-2 text-sm text-white/65">
                <p><strong>Archivo:</strong> {bulkFileName || "-"}</p>
                <p><strong>Filas detectadas:</strong> {bulkRows.length}</p>
                <p><strong>Evento filtrado:</strong> {events.find((item) => item.id === selectedEventId)?.name || "Sin filtro"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={runBulkImport} disabled={bulkLoading || bulkRows.length === 0}>
                  {bulkLoading ? "Importando..." : "Ejecutar carga"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setBulkRows([]); setBulkFileName(null); setBulkErrors([]); setBulkResult(null); }}>
                  Limpiar
                </button>
              </div>
              {bulkResult ? <p className="mt-3 text-sm font-medium text-emerald-400">{bulkResult}</p> : null}
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">Vista previa</p>
              {bulkPreview.length === 0 ? (
                <p className="mt-3 text-sm text-white/50">Aún no hay archivo cargado.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fila</th>
                        <th>Athlete ID</th>
                        <th>Pasaporte</th>
                        <th>Nombre</th>
                        <th>Dieta</th>
                        <th>Crónico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row, index) => (
                        <tr key={`${row.athlete_id}-${index}`}>
                          <td>{index + 2}</td>
                          <td>{row.athlete_id || "-"}</td>
                          <td>{row.passport_number || "-"}</td>
                          <td>{row.full_name || "-"}</td>
                          <td>{row.special_diet_detail || row.special_diet || "-"}</td>
                          <td>{row.chronic_detail || row.chronic_diseases || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bulkErrors.length ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                  <p className="text-sm font-semibold text-rose-300">Errores detectados</p>
                  <div className="mt-2 space-y-1 text-sm text-rose-300/80">
                    {bulkErrors.slice(0, 12).map((item, index) => (
                      <p key={`${item.row}-${item.field}-${index}`}>
                        {item.row > 0 ? `Fila ${item.row}` : "Sistema"}{item.field ? ` · ${item.field}` : ""}: {item.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {activeSubsection === "record" ? <form onSubmit={save} className="space-y-4">
        <section className="surface rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Antecedentes personales</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-white/80">Deporte</span>
              <select
                className="input"
                value={record.sport}
                onChange={(e) => setRecord((p) => ({ ...p, sport: e.target.value }))}
              >
                <option value="">Selecciona disciplina</option>
                {filteredDisciplineOptions.map((item) => (
                  <option key={item.id} value={item.name || item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Nombre completo</span><input className="input" value={record.personal.fullName} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, fullName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Nombre social</span><input className="input" value={record.personal.socialName} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, socialName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Género con que te identificas</span><input className="input" value={record.personal.genderIdentity} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, genderIdentity: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Género cédula</span><input className="input" value={record.personal.idCardGender} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, idCardGender: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">RUT</span><input className="input" value={record.personal.rut} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, rut: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Estatura</span><input className="input" value={record.personal.height} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, height: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Peso corporal</span><input className="input" value={record.personal.weight} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, weight: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Fecha nacimiento</span><input className="input" type="date" value={record.personal.birthDate} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, birthDate: e.target.value } }))} /></label>
            {yesNo("Alérgico", record.personal.allergic, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, allergic: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Alérgico a</span><input className="input" value={record.personal.allergicTo} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, allergicTo: e.target.value } }))} /></label>
            {yesNo("Enfermedades crónicas", record.personal.chronicDiseases, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, chronicDiseases: value } })))}
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Detalle crónico / medicamentos</span><input className="input" value={record.personal.chronicDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, chronicDetail: e.target.value } }))} /></label>
            {yesNo("Tratamiento psiquiátrico", record.personal.psychiatricTreatment, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricTreatment: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Detalle tratamiento</span><input className="input" value={record.personal.psychiatricDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDetail: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Diagnóstico psiquiátrico</span><input className="input" value={record.personal.psychiatricDiagnosis} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDiagnosis: e.target.value } }))} /></label>
            {yesNo("Medicamentos psiquiátricos", record.personal.psychiatricMedications, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricMedications: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Dosis y horarios</span><input className="input" value={record.personal.psychiatricDoseSchedule} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDoseSchedule: e.target.value } }))} /></label>
            {yesNo("Alimentación especial", record.personal.specialDiet, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, specialDiet: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">¿Cuál?</span><input className="input" value={record.personal.specialDietDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, specialDietDetail: e.target.value } }))} /></label>
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Contacto, representación y emergencia</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Dirección</span><input className="input" value={record.contact.address} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, address: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Comuna</span><input className="input" value={record.contact.commune} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, commune: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Ciudad</span><input className="input" value={record.contact.city} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, city: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Región</span><input className="input" value={record.contact.region} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, region: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Fono</span><input className="input" value={record.contact.phone} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Email</span><input className="input" value={record.contact.email} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))} /></label>
            {yesNo("Pueblo originario", record.contact.indigenous, (value) => setRecord((p) => ({ ...p, contact: { ...p.contact, indigenous: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">¿Cuál?</span><input className="input" value={record.contact.indigenousDetail} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, indigenousDetail: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Talla ropa</span><select className="input" value={record.contact.shirtSize} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, shirtSize: e.target.value } }))}><option value="">Selecciona</option>{SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Dependencia establecimiento</span><select className="input" value={record.representation.dependencyType} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, dependencyType: e.target.value } }))}><option value="">Selecciona</option>{DEPENDENCY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Institución que representa</span><input className="input" value={record.representation.institutionName} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, institutionName: e.target.value } }))} /></label>
            {yesNo("Inscrito en club", record.representation.enrolledClub, (value) => setRecord((p) => ({ ...p, representation: { ...p.representation, enrolledClub: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Nombre del club</span><input className="input" value={record.representation.clubName} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, clubName: e.target.value } }))} /></label>
            {yesNo("Promesas Chile", record.representation.promesasChile, (value) => setRecord((p) => ({ ...p, representation: { ...p.representation, promesasChile: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Emergencia: nombre</span><input className="input" value={record.emergency.name} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, name: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Emergencia: teléfono</span><input className="input" value={record.emergency.phone} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, phone: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Emergencia: email</span><input className="input" value={record.emergency.email} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, email: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Emergencia: dirección</span><input className="input" value={record.emergency.address} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, address: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Parentesco/Relación</span><input className="input" value={record.emergency.relation} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, relation: e.target.value } }))} /></label>
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Certificados y autorizaciones</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Cert. salud: nombre deportista</span><input className="input" value={record.healthCertificate.athleteName} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, athleteName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Aptitud física</span><select className="input" value={record.healthCertificate.fitness} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, fitness: e.target.value as "" | "APTO" | "NO_APTO" } }))}><option value="">Selecciona</option><option value="APTO">Apto(a)</option><option value="NO_APTO">No apto(a)</option></select></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Médico: nombre</span><input className="input" value={record.healthCertificate.doctorName} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, doctorName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Médico: RUT</span><input className="input" value={record.healthCertificate.doctorRut} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, doctorRut: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Firma y timbre médico</span><input className="input" value={record.healthCertificate.signatureStamp} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, signatureStamp: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Apoderado(a): nombre</span><input className="input" value={record.guardianAuthorization.guardianName} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Apoderado(a): RUT</span><input className="input" value={record.guardianAuthorization.guardianRut} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianRut: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Firma apoderado(a)</span><input className="input" value={record.guardianAuthorization.guardianSignature} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianSignature: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-white/80">Cert. escolar: establecimiento</span><input className="input" value={record.schoolCertificate.establishmentName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, establishmentName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Alumno(a)</span><input className="input" value={record.schoolCertificate.studentName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, studentName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">RUT alumno(a)</span><input className="input" value={record.schoolCertificate.studentRut} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, studentRut: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Director(a): nombre</span><input className="input" value={record.schoolCertificate.directorName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Director(a): RUT</span><input className="input" value={record.schoolCertificate.directorRut} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorRut: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Firma director(a)</span><input className="input" value={record.schoolCertificate.directorSignature} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorSignature: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Timbre director(a)</span><input className="input" value={record.schoolCertificate.directorStamp} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorStamp: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-white/80">Fecha certificado</span><input className="input" type="date" value={record.schoolCertificate.certificateDate} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, certificateDate: e.target.value } }))} /></label>
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-white/65">
              {selectedAthlete ? `Participante seleccionado: ${selectedAthlete.fullName || selectedAthlete.id}` : "Selecciona un participante para guardar la ficha."}
            </div>
            <button className="btn btn-primary px-8" type="submit" disabled={!selectedAthleteId || saving}>
              {saving ? "Guardando..." : "Guardar ficha de salud"}
            </button>
            <button className="btn btn-ghost px-6" type="button" disabled={!selectedAthleteId} onClick={exportHealthSheet}>
              Exportar ficha (PDF)
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
        </section>
      </form> : null}
    </div>
  );
}


