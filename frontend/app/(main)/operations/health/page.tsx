"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

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
      const safeAthletes = Array.isArray(athleteData) ? athleteData : [];
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
      <span className="text-sm font-medium text-slate-700">{label}</span>
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
        className="rounded-3xl border border-slate-300 p-6 text-white shadow-xl"
        style={{ background: "linear-gradient(110deg, #0f172a 0%, #075985 58%, #0ea5a0 100%)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/85">SALUD · FUPD JDE</p>
            <h1 className="mt-1 text-3xl font-semibold">Ficha única de participación del deportista</h1>
            <p className="mt-1 text-sm text-white/85">Registro clínico-administrativo completo por participante.</p>
          </div>
          <div className="rounded-2xl border border-white/35 bg-black/20 px-4 py-3 text-sm">
            Avance ficha: <span className="font-semibold">{completion}%</span>
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
              className="absolute inset-y-0 right-2 text-slate-500"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setAthletePickerOpen((prev) => !prev)}
              aria-label="Mostrar participantes"
            >
              v
            </button>
            {athletePickerOpen ? (
              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                {searchableAthletes.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Sin resultados</div>
                ) : (
                  searchableAthletes.slice(0, 60).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
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
        {loading ? <p className="mt-3 text-sm text-slate-500">Cargando...</p> : null}
      </section>

      <form onSubmit={save} className="space-y-4">
        <section className="surface rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Antecedentes personales</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Deporte</span>
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
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Nombre completo</span><input className="input" value={record.personal.fullName} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, fullName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Nombre social</span><input className="input" value={record.personal.socialName} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, socialName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Género con que te identificas</span><input className="input" value={record.personal.genderIdentity} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, genderIdentity: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Género cédula</span><input className="input" value={record.personal.idCardGender} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, idCardGender: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">RUT</span><input className="input" value={record.personal.rut} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, rut: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Estatura</span><input className="input" value={record.personal.height} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, height: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Peso corporal</span><input className="input" value={record.personal.weight} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, weight: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Fecha nacimiento</span><input className="input" type="date" value={record.personal.birthDate} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, birthDate: e.target.value } }))} /></label>
            {yesNo("Alérgico", record.personal.allergic, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, allergic: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Alérgico a</span><input className="input" value={record.personal.allergicTo} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, allergicTo: e.target.value } }))} /></label>
            {yesNo("Enfermedades crónicas", record.personal.chronicDiseases, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, chronicDiseases: value } })))}
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Detalle crónico / medicamentos</span><input className="input" value={record.personal.chronicDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, chronicDetail: e.target.value } }))} /></label>
            {yesNo("Tratamiento psiquiátrico", record.personal.psychiatricTreatment, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricTreatment: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Detalle tratamiento</span><input className="input" value={record.personal.psychiatricDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDetail: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Diagnóstico psiquiátrico</span><input className="input" value={record.personal.psychiatricDiagnosis} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDiagnosis: e.target.value } }))} /></label>
            {yesNo("Medicamentos psiquiátricos", record.personal.psychiatricMedications, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricMedications: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Dosis y horarios</span><input className="input" value={record.personal.psychiatricDoseSchedule} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, psychiatricDoseSchedule: e.target.value } }))} /></label>
            {yesNo("Alimentación especial", record.personal.specialDiet, (value) => setRecord((p) => ({ ...p, personal: { ...p.personal, specialDiet: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">¿Cuál?</span><input className="input" value={record.personal.specialDietDetail} onChange={(e) => setRecord((p) => ({ ...p, personal: { ...p.personal, specialDietDetail: e.target.value } }))} /></label>
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contacto, representación y emergencia</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Dirección</span><input className="input" value={record.contact.address} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, address: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Comuna</span><input className="input" value={record.contact.commune} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, commune: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Ciudad</span><input className="input" value={record.contact.city} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, city: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Región</span><input className="input" value={record.contact.region} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, region: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Fono</span><input className="input" value={record.contact.phone} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Email</span><input className="input" value={record.contact.email} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))} /></label>
            {yesNo("Pueblo originario", record.contact.indigenous, (value) => setRecord((p) => ({ ...p, contact: { ...p.contact, indigenous: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">¿Cuál?</span><input className="input" value={record.contact.indigenousDetail} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, indigenousDetail: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Talla ropa</span><select className="input" value={record.contact.shirtSize} onChange={(e) => setRecord((p) => ({ ...p, contact: { ...p.contact, shirtSize: e.target.value } }))}><option value="">Selecciona</option>{SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Dependencia establecimiento</span><select className="input" value={record.representation.dependencyType} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, dependencyType: e.target.value } }))}><option value="">Selecciona</option>{DEPENDENCY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Institución que representa</span><input className="input" value={record.representation.institutionName} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, institutionName: e.target.value } }))} /></label>
            {yesNo("Inscrito en club", record.representation.enrolledClub, (value) => setRecord((p) => ({ ...p, representation: { ...p.representation, enrolledClub: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Nombre del club</span><input className="input" value={record.representation.clubName} onChange={(e) => setRecord((p) => ({ ...p, representation: { ...p.representation, clubName: e.target.value } }))} /></label>
            {yesNo("Promesas Chile", record.representation.promesasChile, (value) => setRecord((p) => ({ ...p, representation: { ...p.representation, promesasChile: value } })))}
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Emergencia: nombre</span><input className="input" value={record.emergency.name} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, name: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Emergencia: teléfono</span><input className="input" value={record.emergency.phone} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, phone: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Emergencia: email</span><input className="input" value={record.emergency.email} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, email: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Emergencia: dirección</span><input className="input" value={record.emergency.address} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, address: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Parentesco/Relación</span><input className="input" value={record.emergency.relation} onChange={(e) => setRecord((p) => ({ ...p, emergency: { ...p.emergency, relation: e.target.value } }))} /></label>
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Certificados y autorizaciones</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Cert. salud: nombre deportista</span><input className="input" value={record.healthCertificate.athleteName} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, athleteName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Aptitud física</span><select className="input" value={record.healthCertificate.fitness} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, fitness: e.target.value as "" | "APTO" | "NO_APTO" } }))}><option value="">Selecciona</option><option value="APTO">Apto(a)</option><option value="NO_APTO">No apto(a)</option></select></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Médico: nombre</span><input className="input" value={record.healthCertificate.doctorName} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, doctorName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Médico: RUT</span><input className="input" value={record.healthCertificate.doctorRut} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, doctorRut: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Firma y timbre médico</span><input className="input" value={record.healthCertificate.signatureStamp} onChange={(e) => setRecord((p) => ({ ...p, healthCertificate: { ...p.healthCertificate, signatureStamp: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Apoderado(a): nombre</span><input className="input" value={record.guardianAuthorization.guardianName} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Apoderado(a): RUT</span><input className="input" value={record.guardianAuthorization.guardianRut} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianRut: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Firma apoderado(a)</span><input className="input" value={record.guardianAuthorization.guardianSignature} onChange={(e) => setRecord((p) => ({ ...p, guardianAuthorization: { ...p.guardianAuthorization, guardianSignature: e.target.value } }))} /></label>
            <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium text-slate-700">Cert. escolar: establecimiento</span><input className="input" value={record.schoolCertificate.establishmentName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, establishmentName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Alumno(a)</span><input className="input" value={record.schoolCertificate.studentName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, studentName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">RUT alumno(a)</span><input className="input" value={record.schoolCertificate.studentRut} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, studentRut: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Director(a): nombre</span><input className="input" value={record.schoolCertificate.directorName} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorName: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Director(a): RUT</span><input className="input" value={record.schoolCertificate.directorRut} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorRut: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Firma director(a)</span><input className="input" value={record.schoolCertificate.directorSignature} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorSignature: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Timbre director(a)</span><input className="input" value={record.schoolCertificate.directorStamp} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, directorStamp: e.target.value } }))} /></label>
            <label className="space-y-1"><span className="text-sm font-medium text-slate-700">Fecha certificado</span><input className="input" type="date" value={record.schoolCertificate.certificateDate} onChange={(e) => setRecord((p) => ({ ...p, schoolCertificate: { ...p.schoolCertificate, certificateDate: e.target.value } }))} /></label>
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
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
          {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        </section>
      </form>
    </div>
  );
}
