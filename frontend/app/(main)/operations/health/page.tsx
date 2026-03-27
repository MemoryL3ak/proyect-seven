"use client";

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import { filterValidatedAthletes } from "@/lib/athletes";
import { useI18n } from "@/lib/i18n";
import StyledSelect from "@/components/StyledSelect";

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

type KpiIconType = "clipboard" | "utensils" | "alert" | "activity" | "leaf" | "sprout" | "pill" | "syringe" | "heart";
const KpiIcon = ({ type, color, size = 18 }: { type: KpiIconType; color: string; size?: number }) => {
  const s: React.CSSProperties = { width: size, height: size, display: "block", flexShrink: 0 };
  const p = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "clipboard") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/></svg>;
  if (type === "utensils") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4v11h2V11h4a2 2 0 002-2V2"/><line x1="15" y1="2" x2="15" y2="22"/></svg>;
  if (type === "alert") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
  if (type === "activity") return <svg style={s} viewBox="0 0 24 24" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
  if (type === "leaf") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M17 8C8 10 5.9 16.17 3.82 19.34L2 21"/><path d="M17 8c1.46 1.46 2.39 3.58 2 6-1.39 5.56-7.35 7-11 7"/><path d="M2 21c0-5.43 2.18-9.53 5-12"/></svg>;
  if (type === "sprout") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 20h10"/><path d="M10 20c5.5-2.5 8.5-7 4-14 0 0-5.5 6-8 14"/><path d="M10.9 7c3.1-4.5 7.9-4.5 8.9 0-1 .5-4 1-5.9 1"/><path d="M7.1 7c-3.1-4.5-7.9-4.5-8.9 0 1 .5 4 1 5.9 1"/></svg>;
  if (type === "pill") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M10.5 20.5l10-10a4.95 4.95 0 10-7-7l-10 10a4.95 4.95 0 107 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>;
  if (type === "syringe") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M18 2l4 4-10 10-5-5L18 2z"/><path d="M7.5 13.5L4 17l3 3 3.5-3.5"/><line x1="6" y1="20" x2="2" y2="22"/><line x1="9" y1="8" x2="14" y2="13"/></svg>;
  if (type === "heart") return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
  return null;
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
  const { t } = useI18n();

  const pal = {
    panelBg: "#ffffff", panelBorder: "#e2e8f0", panelShadow: "0 1px 4px rgba(15,23,42,0.06)",
    accent: "#21D0B3", titleColor: "#0f172a", subtitleColor: "#64748b",
    cardBg: "#ffffff", cardBorder: "#e2e8f0", cardShadow: "0 1px 4px rgba(15,23,42,0.06)",
    labelColor: "#94a3b8", textMuted: "#64748b",
    rowBg: "#f8fafc", rowHover: "#f1f5f9",
    universeBg: "#f1f5f9", universeBorder: "#e2e8f0",
  };

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
  const bulkFileRef = useRef<HTMLInputElement>(null);
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

      setBulkResult(t("Carga masiva finalizada. {n} fichas actualizadas.").replace("{n}", String(updated)));
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

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: "10px",
    border: "1px solid #e2e8f0", background: "#f8fafc",
    fontSize: "14px", color: "#0f172a", outline: "none",
  };

  const yesNo = (label: string, value: YesNo, onChange: (value: YesNo) => void) => (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{label}</span>
      <StyledSelect value={value} onChange={(e) => onChange(e.target.value as YesNo)}>
        <option value="">{t("Selecciona")}</option>
        <option value="SI">Sí</option>
        <option value="NO">No</option>
      </StyledSelect>
    </label>
  );

  return (
    <div className="space-y-6">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: "12px", marginBottom: "8px" }}>
        <div style={{ borderRadius: "8px", padding: "6px 12px", fontSize: "13px", background: "#ffffff", border: "1px solid #e2e8f0", color: "#64748b" }}>
          {activeSubsection === "record" ? <>{t("Avance ficha")}: <span style={{ fontWeight: 600, color: "#0f172a" }}>{completion}%</span></> : <>{t("Subsección")}: <span style={{ fontWeight: 600, color: "#0f172a" }}>{t(HEALTH_SUBSECTIONS.find((item) => item.id === activeSubsection)?.label ?? "")}</span></>}
        </div>
      </div>

      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="grid gap-3 lg:grid-cols-12">
          <StyledSelect wrapperClassName="lg:col-span-4" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
            <option value="">{t("Selecciona evento")}</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>{item.name || item.id}</option>
            ))}
          </StyledSelect>
          <StyledSelect wrapperClassName="lg:col-span-3" value={selectedDelegationId} onChange={(e) => setSelectedDelegationId(e.target.value)}>
            <option value="">{t("Todas las delegaciones")}</option>
            {filteredDelegations.map((item) => (
              <option key={item.id} value={item.id}>{item.countryCode || item.id}</option>
            ))}
          </StyledSelect>
          <div className="relative lg:col-span-5">
            <input
              style={{ width: "100%", paddingRight: "36px", padding: "8px 36px 8px 12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc", fontSize: "14px", color: "#0f172a", outline: "none" }}
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
              placeholder={t("Buscar y seleccionar participante")}
            />
            <button
              type="button"
              style={{ position: "absolute", inset: "0 8px 0 auto", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px" }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAthletePickerOpen((prev) => !prev)}
              aria-label="Mostrar participantes"
            >
              v
            </button>
            {athletePickerOpen ? (
              <div style={{ position: "absolute", zIndex: 30, marginTop: "4px", maxHeight: "224px", width: "100%", overflowY: "auto", borderRadius: "12px", padding: "4px", boxShadow: "0 8px 24px rgba(15,23,42,0.12)", background: "#ffffff", border: "1px solid #e2e8f0" }}>
                {searchableAthletes.length === 0 ? (
                  <div style={{ padding: "8px 12px", fontSize: "14px", color: "#94a3b8" }}>{t("Sin resultados")}</div>
                ) : (
                  searchableAthletes.slice(0, 60).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      style={{ display: "block", width: "100%", borderRadius: "8px", padding: "8px 12px", textAlign: "left", fontSize: "14px", color: "#0f172a", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
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
        {loading ? <p style={{ marginTop: "12px", fontSize: "13px", color: "#94a3b8" }}>{t("Cargando...")}</p> : null}
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "12px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "inline-flex", flexWrap: "wrap", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "4px" }}>
          {HEALTH_SUBSECTIONS.map((item) => {
            const active = item.id === activeSubsection;
            return (
              <button
                key={item.id}
                type="button"
                style={{
                  minWidth: "132px", borderRadius: "10px", padding: "8px 16px",
                  fontSize: "14px", fontWeight: 600, border: "none", cursor: "pointer", transition: "all 150ms",
                  background: active ? "linear-gradient(135deg, #21D0B3, #14AE98)" : "transparent",
                  color: active ? "#ffffff" : "#64748b",
                  boxShadow: active ? "0 2px 8px rgba(33,208,179,0.3)" : "none",
                }}
                onClick={() => setActiveSubsection(item.id)}
              >
                <span style={{ display: "block", textAlign: "center" }}>{t(item.label)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {activeSubsection === "dashboard" ? (
        <section style={{ borderRadius: "24px", overflow: "hidden", boxShadow: pal.panelShadow }}>
          {/* ── Command panel header */}
          <div style={{ background: pal.panelBg, border: `1px solid ${pal.panelBorder}`, borderRadius: "24px", padding: "28px 32px 24px", position: "relative", overflow: "hidden" }}>
            {/* Ambient orbs */}
            <div style={{ position: "absolute", top: "-60px", right: "-40px", width: "260px", height: "260px", borderRadius: "50%", background: "rgba(33,208,179,0.06)", filter: "blur(60px)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: "-40px", left: "20%", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(33,208,179,0.04)", filter: "blur(50px)", pointerEvents: "none" }} />

            <div className="flex flex-wrap items-start justify-between gap-4" style={{ position: "relative" }}>
              <div>
                <div className="flex items-center gap-2" style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: pal.labelColor }}>{t("Salud")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.1)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 10px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#21D0B3", display: "inline-block" }} />
                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: "#21D0B3" }}>EN VIVO</span>
                  </span>
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: 800, color: pal.titleColor, margin: 0 }}>{t("Inteligencia de salud")}</h2>
                <p style={{ fontSize: "13px", color: pal.subtitleColor, marginTop: "4px" }}>
                  {t("Métricas calculadas sobre las fichas del filtro actual para detectar dietas, alergias y condiciones relevantes.")}
                </p>
              </div>
              <div style={{ background: pal.universeBg, border: `1px solid ${pal.universeBorder}`, borderRadius: "14px", padding: "10px 18px", fontSize: "13px", color: pal.textMuted, flexShrink: 0 }}>
                {t("Universo analizado:")} <span style={{ fontWeight: 700, color: pal.titleColor }}>{healthDashboard.totalAthletes}</span> {t("participantes")}
              </div>
            </div>
          </div>

          <div style={{ background: pal.cardBg, border: `1px solid ${pal.cardBorder}`, borderTop: "none", borderRadius: "0 0 24px 24px", padding: "24px 28px 28px" }}>

            {/* ── Primary KPI cards */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t("Fichas cargadas"),     value: healthDashboard.savedRecords,    color: "#10b981", icon: "clipboard" as KpiIconType, sub: t("Con info de salud registrada"),    glow: "rgba(16,185,129,0.18)" },
                { label: t("Alimentación especial"), value: healthDashboard.specialDietCount, color: "#f59e0b", icon: "utensils" as KpiIconType, sub: t("Requerimiento dietario declarado"),  glow: "rgba(245,158,11,0.15)" },
                { label: t("Alergias"),             value: healthDashboard.allergicCount,  color: "#ef4444", icon: "alert" as KpiIconType, sub: t("Participantes con alergias activas"), glow: "rgba(239,68,68,0.15)"  },
                { label: t("Enfermedad crónica"),   value: healthDashboard.chronicCount,   color: "#38bdf8", icon: "activity" as KpiIconType, sub: t("Patología crónica declarada"),        glow: "rgba(56,189,248,0.15)" },
              ].map((card) => (
                <article key={card.label} style={{
                  background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
                  borderTop: `3px solid ${card.color}`, borderRadius: "18px",
                  padding: "18px 20px", boxShadow: pal.cardShadow,
                  transition: "transform 120ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: card.color }}>{card.label}</p>
                    <KpiIcon type={card.icon} color={card.color} size={20} />
                  </div>
                  <div className="flex items-end gap-2">
                    <p style={{
                      fontSize: "2.4rem", fontWeight: 800, lineHeight: 1, color: card.color,
                    }}>{card.value}</p>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: card.color, marginBottom: "8px", boxShadow: `0 0 8px ${card.color}` }} />
                  </div>
                  <p style={{ fontSize: "11px", color: pal.textMuted, marginTop: "6px" }}>{card.sub}</p>
                </article>
              ))}
            </div>

            {/* ── Secondary KPI row */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" style={{ marginTop: "16px" }}>
              {[
                { label: t("Celíacos"),       value: healthDashboard.celiacCount,      color: "#a78bfa", icon: "leaf" as KpiIconType },
                { label: t("Veganos"),         value: healthDashboard.veganCount,       color: "#34d399", icon: "sprout" as KpiIconType },
                { label: t("Vegetarianos"),    value: healthDashboard.vegetarianCount,  color: "#6ee7b7", icon: "leaf" as KpiIconType },
                { label: t("Con medicación"),  value: healthDashboard.medicationsCount, color: "#f472b6", icon: "syringe" as KpiIconType },
              ].map((card) => (
                <article key={card.label} style={{
                  background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
                  borderLeft: `3px solid ${card.color}`, borderRadius: "16px",
                  padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px",
                  boxShadow: pal.cardShadow, transition: "transform 120ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                  <KpiIcon type={card.icon} color={card.color} size={24} />
                  <div>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: card.color, marginBottom: "2px" }}>{card.label}</p>
                    <p style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1, color: card.color }}>{card.value}</p>
                  </div>
                </article>
              ))}
            </div>

            {/* ── Top lists */}
            <div className="grid gap-4 xl:grid-cols-3" style={{ marginTop: "20px" }}>
              {[
                {
                  label: t("Top condiciones"), icon: "heart" as KpiIconType, color: "#38bdf8",
                  items: healthDashboard.topConditions,
                  empty: t("Sin enfermedades crónicas detalladas."),
                  chipColor: "rgba(56,189,248,0.18)", chipText: "#38bdf8",
                },
                {
                  label: t("Top alergias"), icon: "alert" as KpiIconType, color: "#ef4444",
                  items: healthDashboard.topAllergies,
                  empty: t("Sin alergias detalladas."),
                  chipColor: "rgba(239,68,68,0.18)", chipText: "#ef4444",
                },
                {
                  label: t("Top dietas y restricciones"), icon: "utensils" as KpiIconType, color: "#f59e0b",
                  items: healthDashboard.topDiets,
                  empty: t("Sin alimentación especial detallada."),
                  chipColor: "rgba(245,158,11,0.18)", chipText: "#f59e0b",
                },
              ].map((section) => (
                <div key={section.label} style={{
                  background: pal.cardBg, border: `1px solid ${pal.cardBorder}`,
                  borderTop: `3px solid ${section.color}`, borderRadius: "18px",
                  padding: "18px 18px 16px", boxShadow: pal.cardShadow,
                }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: "14px" }}>
                    <KpiIcon type={section.icon} color={section.color} size={16} />
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: section.color }}>{section.label}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {section.items.length === 0
                      ? <p style={{ fontSize: "13px", color: pal.textMuted }}>{section.empty}</p>
                      : section.items.map((item) => (
                        <div key={item.label} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: pal.rowBg, borderRadius: "10px", padding: "8px 12px",
                        }}>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: pal.titleColor }}>{item.label}</span>
                          <span style={{
                            background: section.chipColor, borderRadius: "99px",
                            padding: "2px 10px", fontSize: "12px", fontWeight: 700, color: section.chipText,
                          }}>{item.count}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeSubsection === "bulk" ? (
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>{t("Subsección Salud / Carga masiva")}</span>
              <h2 style={{ marginTop: "4px", fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{t("Importar fichas de salud")}</h2>
              <p style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
                {t("Actualiza fichas por lote usando `athlete_id` o `passport_number`, respetando el filtro actual.")}
              </p>
            </div>
            <button type="button" onClick={downloadHealthTemplate} style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
              {t("Descargar template")}
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>{t("Archivo Excel")}</span>
              <input ref={bulkFileRef} id="health-bulk-file" className="sr-only" type="file" accept=".xlsx,.xls" onChange={onBulkFileChange} />
              <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                <label htmlFor="health-bulk-file" style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                  {t("Seleccionar archivo")}
                </label>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{bulkFileName ?? t("Sin archivo seleccionado")}</span>
              </div>
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "#64748b" }}>
                <p><strong style={{ color: "#0f172a" }}>{t("Filas detectadas:")}</strong> {bulkRows.length}</p>
                <p><strong style={{ color: "#0f172a" }}>{t("Evento filtrado:")}</strong> {events.find((item) => item.id === selectedEventId)?.name || t("Sin filtro")}</p>
              </div>
              <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button type="button" onClick={runBulkImport} disabled={bulkLoading || bulkRows.length === 0} style={{ padding: "9px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontWeight: 700, fontSize: "13px", cursor: bulkLoading || bulkRows.length === 0 ? "not-allowed" : "pointer", opacity: bulkLoading || bulkRows.length === 0 ? 0.6 : 1, boxShadow: "0 2px 8px rgba(33,208,179,0.3)" }}>
                  {bulkLoading ? t("Importando...") : t("Ejecutar carga")}
                </button>
                <button type="button" onClick={() => { setBulkRows([]); setBulkFileName(null); setBulkErrors([]); setBulkResult(null); if (bulkFileRef.current) bulkFileRef.current.value = ""; }} style={{ padding: "9px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                  {t("Limpiar")}
                </button>
              </div>
              {bulkResult ? <p style={{ marginTop: "12px", fontSize: "13px", fontWeight: 600, color: "#21D0B3" }}>{bulkResult}</p> : null}
            </div>

            <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", background: "#f8fafc", padding: "16px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>{t("Vista previa")}</p>
              {bulkPreview.length === 0 ? (
                <p style={{ marginTop: "12px", fontSize: "13px", color: "#94a3b8" }}>{t("Aún no hay archivo cargado.")}</p>
              ) : (
                <div style={{ marginTop: "12px", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {[t("Fila"), "Athlete ID", t("Pasaporte"), t("Nombre"), t("Dieta"), t("Crónico")].map((h) => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((row, index) => (
                        <tr key={`${row.athlete_id}-${index}`} style={{ background: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                          <td style={{ padding: "6px 10px", color: "#0f172a" }}>{index + 2}</td>
                          <td style={{ padding: "6px 10px", color: "#64748b" }}>{row.athlete_id || "-"}</td>
                          <td style={{ padding: "6px 10px", color: "#64748b" }}>{row.passport_number || "-"}</td>
                          <td style={{ padding: "6px 10px", color: "#0f172a" }}>{row.full_name || "-"}</td>
                          <td style={{ padding: "6px 10px", color: "#64748b" }}>{row.special_diet_detail || row.special_diet || "-"}</td>
                          <td style={{ padding: "6px 10px", color: "#64748b" }}>{row.chronic_detail || row.chronic_diseases || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bulkErrors.length ? (
                <div style={{ marginTop: "16px", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", padding: "16px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#ef4444" }}>{t("Errores detectados")}</p>
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "#ef4444" }}>
                    {bulkErrors.slice(0, 12).map((item, index) => (
                      <p key={`${item.row}-${item.field}-${index}`}>
                        {item.row > 0 ? `${t("Fila")} ${item.row}` : t("Sistema")}{item.field ? ` · ${item.field}` : ""}: {item.message}
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
        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>{t("Antecedentes personales")}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Deporte")}</span>
              <StyledSelect
                value={record.sport}
                onChange={(e) => setRecord((p) => ({ ...p, sport: e.target.value }))}
              >
                <option value="">{t("Selecciona disciplina")}</option>
                {filteredDisciplineOptions.map((item) => (
                  <option key={item.id} value={item.name || item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </StyledSelect>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Nombre completo")}</span><input style={fieldStyle} value={record.personal.fullName} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, fullName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Nombre social")}</span><input style={fieldStyle} value={record.personal.socialName} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, socialName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Género con que te identificas")}</span><input style={fieldStyle} value={record.personal.genderIdentity} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, genderIdentity: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Género cédula")}</span><input style={fieldStyle} value={record.personal.idCardGender} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, idCardGender: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>RUT</span><input style={fieldStyle} value={record.personal.rut} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, rut: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Estatura")}</span><input style={fieldStyle} value={record.personal.height} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, height: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Peso corporal")}</span><input style={fieldStyle} value={record.personal.weight} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, weight: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Fecha nacimiento")}</span><input style={fieldStyle} type="date" value={record.personal.birthDate} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, birthDate: e.target.value } }))} /></label>
            {yesNo(t("Alérgico"), record.personal.allergic, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, allergic: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Alérgico a")}</span><input style={fieldStyle} value={record.personal.allergicTo} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, allergicTo: e.target.value } }))} /></label>
            {yesNo(t("Enfermedades crónicas"), record.personal.chronicDiseases, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, chronicDiseases: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Detalle crónico / medicamentos")}</span><input style={fieldStyle} value={record.personal.chronicDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, chronicDetail: e.target.value } }))} /></label>
            {yesNo(t("Tratamiento psiquiátrico"), record.personal.psychiatricTreatment, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricTreatment: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Detalle tratamiento")}</span><input style={fieldStyle} value={record.personal.psychiatricDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDetail: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Diagnóstico psiquiátrico")}</span><input style={fieldStyle} value={record.personal.psychiatricDiagnosis} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDiagnosis: e.target.value } }))} /></label>
            {yesNo(t("Medicamentos psiquiátricos"), record.personal.psychiatricMedications, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricMedications: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Dosis y horarios")}</span><input style={fieldStyle} value={record.personal.psychiatricDoseSchedule} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDoseSchedule: e.target.value } }))} /></label>
            {yesNo(t("Alimentación especial"), record.personal.specialDiet, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, specialDiet: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("¿Cuál?")}</span><input style={fieldStyle} value={record.personal.specialDietDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, specialDietDetail: e.target.value } }))} /></label>
          </div>
        </section>

        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>{t("Contacto, representación y emergencia")}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Dirección")}</span><input style={fieldStyle} value={record.contact.address} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, address: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Comuna")}</span><input style={fieldStyle} value={record.contact.commune} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, commune: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Ciudad")}</span><input style={fieldStyle} value={record.contact.city} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, city: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Región")}</span><input style={fieldStyle} value={record.contact.region} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, region: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Fono")}</span><input style={fieldStyle} value={record.contact.phone} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Email</span><input style={fieldStyle} value={record.contact.email} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))} /></label>
            {yesNo(t("Pueblo originario"), record.contact.indigenous, (value) => setRecord((p) => ({ ...p, contact: { ...p.contact, indigenous: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("¿Cuál?")}</span><input style={fieldStyle} value={record.contact.indigenousDetail} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, indigenousDetail: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Talla ropa")}</span><StyledSelect value={record.contact.shirtSize} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, shirtSize: e.target.value } }))}><option value="">{t("Selecciona")}</option>{SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</StyledSelect></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Dependencia establecimiento")}</span><StyledSelect value={record.representation.dependencyType} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, dependencyType: e.target.value } }))}><option value="">{t("Selecciona")}</option>{DEPENDENCY_OPTIONS.map((item) => <option key={item} value={item}>{t(item)}</option>)}</StyledSelect></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Institución que representa")}</span><input style={fieldStyle} value={record.representation.institutionName} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, institutionName: e.target.value } }))} /></label>
            {yesNo(t("Inscrito en club"), record.representation.enrolledClub, (value) => setRecord((p) => ({ ...p, representation: { ...p.representation, enrolledClub: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Nombre del club")}</span><input style={fieldStyle} value={record.representation.clubName} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, clubName: e.target.value } }))} /></label>
            {yesNo(t("Promesas Chile"), record.representation.promesasChile, (value) => setRecord((p) => ({ ...p, representation: { ...p.representation, promesasChile: value } })))}
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Emergencia: nombre")}</span><input style={fieldStyle} value={record.emergency.name} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, name: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Emergencia: teléfono")}</span><input style={fieldStyle} value={record.emergency.phone} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, phone: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Emergencia: email")}</span><input style={fieldStyle} value={record.emergency.email} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, email: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Emergencia: dirección")}</span><input style={fieldStyle} value={record.emergency.address} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, address: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Parentesco/Relación")}</span><input style={fieldStyle} value={record.emergency.relation} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, relation: e.target.value } }))} /></label>
          </div>
        </section>

        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#94a3b8" }}>{t("Certificados y autorizaciones")}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Cert. salud: nombre deportista")}</span><input style={fieldStyle} value={record.healthCertificate.athleteName} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, athleteName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Aptitud física")}</span><StyledSelect value={record.healthCertificate.fitness} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, fitness: e.target.value as "" | "APTO" | "NO_APTO" } }))}><option value="">{t("Selecciona")}</option><option value="APTO">{t("Apto(a)")}</option><option value="NO_APTO">{t("No apto(a)")}</option></StyledSelect></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Médico: nombre")}</span><input style={fieldStyle} value={record.healthCertificate.doctorName} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, doctorName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Médico: RUT")}</span><input style={fieldStyle} value={record.healthCertificate.doctorRut} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, doctorRut: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Firma y timbre médico")}</span><input style={fieldStyle} value={record.healthCertificate.signatureStamp} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, signatureStamp: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Apoderado(a): nombre")}</span><input style={fieldStyle} value={record.guardianAuthorization.guardianName} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Apoderado(a): RUT")}</span><input style={fieldStyle} value={record.guardianAuthorization.guardianRut} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianRut: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Firma apoderado(a)")}</span><input style={fieldStyle} value={record.guardianAuthorization.guardianSignature} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianSignature: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }} className="md:col-span-2"><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Cert. escolar: establecimiento")}</span><input style={fieldStyle} value={record.schoolCertificate.establishmentName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, establishmentName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Alumno(a)")}</span><input style={fieldStyle} value={record.schoolCertificate.studentName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, studentName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("RUT alumno(a)")}</span><input style={fieldStyle} value={record.schoolCertificate.studentRut} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, studentRut: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Director(a): nombre")}</span><input style={fieldStyle} value={record.schoolCertificate.directorName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorName: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Director(a): RUT")}</span><input style={fieldStyle} value={record.schoolCertificate.directorRut} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorRut: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Firma director(a)")}</span><input style={fieldStyle} value={record.schoolCertificate.directorSignature} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorSignature: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Timbre director(a)")}</span><input style={fieldStyle} value={record.schoolCertificate.directorStamp} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorStamp: e.target.value } }))} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}><span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{t("Fecha certificado")}</span><input style={fieldStyle} type="date" value={record.schoolCertificate.certificateDate} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, certificateDate: e.target.value } }))} /></label>
          </div>
        </section>

        <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {selectedAthlete ? `${t("Participante seleccionado:")} ${selectedAthlete.fullName || selectedAthlete.id}` : t("Selecciona un participante para guardar la ficha.")}
            </div>
            <button style={{ padding: "9px 28px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #21D0B3, #14AE98)", color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: !selectedAthleteId || saving ? "not-allowed" : "pointer", opacity: !selectedAthleteId || saving ? 0.6 : 1, boxShadow: "0 2px 8px rgba(33,208,179,0.3)" }} type="submit" disabled={!selectedAthleteId || saving}>
              {saving ? t("Guardando...") : t("Guardar ficha de salud")}
            </button>
            <button style={{ padding: "9px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#ffffff", color: "#64748b", fontWeight: 600, fontSize: "14px", cursor: !selectedAthleteId ? "not-allowed" : "pointer", opacity: !selectedAthleteId ? 0.5 : 1 }} type="button" disabled={!selectedAthleteId} onClick={exportHealthSheet}>
              {t("Exportar ficha (PDF)")}
            </button>
          </div>
          {error ? <p style={{ marginTop: "12px", fontSize: "13px", color: "#ef4444" }}>{error}</p> : null}
          {message ? <p style={{ marginTop: "12px", fontSize: "13px", color: "#21D0B3" }}>{message}</p> : null}
        </section>
      </form> : null}
    </div>
  );
}


