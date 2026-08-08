"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type YesNo = "" | "SI" | "NO";

// Mantener alineado con el HealthRecord del módulo administrativo de Salud
// (frontend/app/(main)/operations/health/page.tsx): los campos que el
// participante no completa acá quedan vacíos en la ficha FUPD del admin.
type HealthRecord = {
  sport: string;
  personal: {
    fullName: string;
    socialName: string;
    genderIdentity: string;
    idCardGender: string;
    rut: string;
    birthDate: string;
    height: string;
    weight: string;
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
  participantSignature: string; // base64 dataURL of canvas
  signedAt: string;
  medicalDocumentUrl: string;
  medicalDocumentUploadedAt: string;
};

type AthleteItem = {
  id: string;
  fullName?: string | null;
  passportNumber?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyRecord(): HealthRecord {
  return {
    sport: "",
    personal: {
      fullName: "",
      socialName: "",
      genderIdentity: "",
      idCardGender: "",
      rut: "",
      birthDate: "",
      height: "",
      weight: "",
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
    contact: { address: "", commune: "", city: "", region: "", phone: "", email: "", indigenous: "", indigenousDetail: "", shirtSize: "" },
    representation: { dependencyType: "", institutionName: "", enrolledClub: "", clubName: "", promesasChile: "" },
    emergency: { name: "", phone: "", email: "", address: "", relation: "" },
    participantSignature: "",
    signedAt: "",
    medicalDocumentUrl: "",
    medicalDocumentUploadedAt: "",
  };
}

function mergeRecord(raw: unknown, fallbackName = ""): HealthRecord {
  const base = emptyRecord();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    base.personal.fullName = fallbackName;
    return base;
  }
  const r = raw as Record<string, unknown>;
  return {
    ...base,
    ...(r as Partial<HealthRecord>),
    personal: { ...base.personal, ...((r.personal as object) ?? {}) },
    contact: { ...base.contact, ...((r.contact as object) ?? {}) },
    representation: { ...base.representation, ...((r.representation as object) ?? {}) },
    emergency: { ...base.emergency, ...((r.emergency as object) ?? {}) },
    sport: (r.sport as string) ?? "",
    participantSignature: (r.participantSignature as string) ?? "",
    signedAt: (r.signedAt as string) ?? "",
    medicalDocumentUrl: (r.medicalDocumentUrl as string) ?? "",
    medicalDocumentUploadedAt: (r.medicalDocumentUploadedAt as string) ?? "",
  };
}

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STEPS = ["identificacion", "salud", "contacto", "emergencia", "firma"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABELS: Record<Step, string> = {
  identificacion: "Identificación",
  salud: "Salud",
  contacto: "Contacto",
  emergencia: "Emergencia",
  firma: "Firma y documento",
};

// ─── Fecha en español (Día / Mes / Año) ──────────────────────────────────────
// El <input type="date"> nativo muestra el selector en el idioma del WebView
// (aparecía en inglés). Con tres selects el formato queda siempre en español.

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function SpanishDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = (value || "").split("-").map(Number);
  const [year, setYear] = useState(parts[0] || 0);
  const [month, setMonth] = useState(parts[1] || 0);
  const [day, setDay] = useState(parts[2] || 0);

  // Sincroniza cuando la ficha carga async con una fecha ya guardada.
  useEffect(() => {
    const [yy, mm, dd] = (value || "").split("-").map(Number);
    if (yy && mm && dd) { setYear(yy); setMonth(mm); setDay(dd); }
  }, [value]);

  useEffect(() => {
    if (!year || !month || !day) return;
    const maxDay = new Date(year, month, 0).getDate();
    const dd = Math.min(day, maxDay);
    const formatted = `${year}-${String(month).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    if (formatted !== value) onChange(formatted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= currentYear - 100; y--) years.push(y);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 8 }}>
      <select className="input" value={day || ""} onChange={(ev) => setDay(Number(ev.target.value))} aria-label="Día">
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="input" value={month || ""} onChange={(ev) => setMonth(Number(ev.target.value))} aria-label="Mes">
        <option value="">Mes</option>
        {MESES_ES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select className="input" value={year || ""} onChange={(ev) => setYear(Number(ev.target.value))} aria-label="Año">
        <option value="">Año</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

// ─── Teléfono con código de país ─────────────────────────────────────────────

const PHONE_COUNTRIES = [
  { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "BO", dial: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brasil" },
  { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "EC", dial: "+593", flag: "🇪🇨", name: "Ecuador" },
  { code: "PY", dial: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "PE", dial: "+51", flag: "🇵🇪", name: "Perú" },
  { code: "UY", dial: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "VE", dial: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "México" },
  { code: "US", dial: "+1", flag: "🇺🇸", name: "Estados Unidos" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "España" },
  { code: "PT", dial: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "Francia" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Alemania" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italia" },
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "Reino Unido" },
];

/** Separa un teléfono guardado ("+56 912345678") en país + número local. */
function splitPhone(value: string): { country: string; local: string } {
  const raw = String(value || "").trim();
  const byLength = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLength) {
    if (raw.startsWith(c.dial)) {
      return { country: c.code, local: raw.slice(c.dial.length).trim() };
    }
  }
  return { country: "CL", local: raw };
}

function PhoneField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const initial = splitPhone(value);
  const [country, setCountry] = useState(initial.country);
  const [local, setLocal] = useState(initial.local);

  useEffect(() => {
    // Sólo re-sincroniza cuando el valor externo difiere de lo que este campo
    // ya representa (p. ej. la ficha guardada cargó async). Evita que elegir
    // país con el número vacío se resetee a Chile.
    const dial = PHONE_COUNTRIES.find((c) => c.code === country)?.dial ?? "+56";
    const current = local.trim() ? `${dial} ${local.trim()}` : "";
    if (value === current) return;
    const parsed = splitPhone(value);
    setCountry(parsed.country);
    setLocal(parsed.local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (nextCountry: string, nextLocal: string) => {
    const dial = PHONE_COUNTRIES.find((c) => c.code === nextCountry)?.dial ?? "+56";
    onChange(nextLocal.trim() ? `${dial} ${nextLocal.trim()}` : "");
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select
        className="input"
        style={{ maxWidth: 130, flexShrink: 0 }}
        value={country}
        onChange={(ev) => { setCountry(ev.target.value); emit(ev.target.value, local); }}
        aria-label="País"
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
        ))}
      </select>
      <input
        className="input"
        type="tel"
        inputMode="tel"
        value={local}
        onChange={(ev) => {
          const clean = ev.target.value.replace(/[^\d\s-]/g, "");
          setLocal(clean);
          emit(country, clean);
        }}
        placeholder="9 1234 5678"
      />
    </div>
  );
}

// ─── Dirección con autocompletado (Google Places) ────────────────────────────
// Al elegir una dirección sugerida se rellenan comuna, ciudad y región.

function loadGoogleMapsApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return;
    const w = window as any;
    if (w.google?.maps?.places) { resolve(); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}&libraries=places&language=es`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function AddressAutocompleteField({
  value,
  onChange,
  onResolved,
}: {
  value: string;
  onChange: (v: string) => void;
  onResolved: (parts: { address: string; commune: string; city: string; region: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  useEffect(() => {
    let autocomplete: any = null;
    let cancelled = false;
    loadGoogleMapsApi()
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const google = (window as any).google;
        if (!google?.maps?.places?.Autocomplete) return;
        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          fields: ["address_components", "formatted_address"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const comps: any[] = place?.address_components ?? [];
          const find = (...types: string[]) => {
            for (const type of types) {
              const comp = comps.find((cc) => (cc.types || []).includes(type));
              if (comp?.long_name) return comp.long_name as string;
            }
            return "";
          };
          const route = find("route");
          const number = find("street_number");
          const address = route ? `${route}${number ? ` ${number}` : ""}` : (place?.formatted_address || "");
          onResolvedRef.current({
            address,
            commune: find("administrative_area_level_3", "locality", "sublocality_level_1", "sublocality"),
            city: find("locality", "administrative_area_level_2"),
            region: find("administrative_area_level_1"),
          });
        });
      })
      .catch(() => {
        // Sin API de Google: el campo funciona como texto libre.
      });
    return () => {
      cancelled = true;
      const google = (window as any).google;
      if (autocomplete && google?.maps?.event) google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, []);

  return (
    <input
      ref={inputRef}
      className="input"
      value={value}
      onChange={(ev) => onChange(ev.target.value)}
      placeholder="Escribe tu dirección y elige una sugerencia…"
      autoComplete="off"
    />
  );
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────

function SignatureCanvas({
  onSign,
  existingSignature,
}: {
  onSign: (dataUrl: string) => void;
  existingSignature: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (existingSignature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => ctx?.drawImage(img, 0, 0);
      img.src = existingSignature;
      setHasDrawn(true);
    }
  }, [existingSignature]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  }, []);

  const stopDraw = useCallback(() => {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  }, [onSign]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSign("");
  };

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-2xl"
        style={{ border: "2px solid var(--border-strong)", background: "var(--surface)" }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair"
          style={{ height: "160px" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {hasDrawn ? "Firma registrada" : "Dibuja tu firma con el dedo o el mouse"}
        </p>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-rose-600 hover:text-rose-700"
        >
          Limpiar firma
        </button>
      </div>
    </div>
  );
}

// ─── YesNo field ──────────────────────────────────────────────────────────────

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex gap-3">
        {(["SI", "NO"] as YesNo[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? "" : opt)}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors"
            style={
              value === opt
                ? opt === "SI"
                  ? { borderColor: "#10b981", background: "#ecfdf5", color: "#065f46" }
                  : { borderColor: "#f87171", background: "#fff1f2", color: "#be123c" }
                : { borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text-muted)" }
            }
          >
            {opt === "SI" ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors"
              style={
                i < idx
                  ? { background: "#10b981", color: "#fff" }
                  : i === idx
                  ? { background: "var(--brand)", color: "#fff" }
                  : { background: "var(--elevated)", color: "var(--text-faint)" }
              }
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: i === idx ? "var(--text)" : "var(--text-faint)" }}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mb-4 h-0.5 flex-1"
              style={{ background: i < idx ? "#10b981" : "var(--border)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function FichaSaludContent() {
  const searchParams = useSearchParams();
  // Si el portal ya entrega el id (?id=...), la ficha carga directo: no se
  // muestra la pantalla de identificación (parecía un "login" extra).
  const cameWithId = Boolean(searchParams.get("id"));
  const [athleteId, setAthleteId] = useState(searchParams.get("id") ?? "");
  const [athlete, setAthlete] = useState<AthleteItem | null>(null);
  const [record, setRecord] = useState<HealthRecord>(emptyRecord());
  const [step, setStep] = useState<Step>("identificacion");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const p = record.personal;
  const c = record.contact;
  const e = record.emergency;
  const rp = record.representation;

  const setP = (patch: Partial<typeof p>) =>
    setRecord((r) => ({ ...r, personal: { ...r.personal, ...patch } }));
  const setC = (patch: Partial<typeof c>) =>
    setRecord((r) => ({ ...r, contact: { ...r.contact, ...patch } }));
  const setE = (patch: Partial<typeof e>) =>
    setRecord((r) => ({ ...r, emergency: { ...r.emergency, ...patch } }));
  const setRP = (patch: Partial<typeof rp>) =>
    setRecord((r) => ({ ...r, representation: { ...r.representation, ...patch } }));

  // Auto-load if ID comes from URL
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) loadAthlete(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAthlete = async (idOverride?: string) => {
    const id = (idOverride ?? athleteId).trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AthleteItem>(`/athletes/${id}`);
      setAthlete(data);
      const existing = (data.metadata as Record<string, unknown>)?.healthRecord;
      setRecord(mergeRecord(existing, data.fullName ?? ""));
      setStep("salud");
    } catch {
      setError("No se encontró el participante. Verifica tu ID.");
    } finally {
      setLoading(false);
    }
  };

  const handleDocChange = (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0] ?? null;
    setDocFile(file);
    if (file) setDocPreview(URL.createObjectURL(file));
    else setDocPreview(null);
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!athlete) return;
    if (!record.participantSignature) {
      setError("Debes dibujar tu firma antes de enviar.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // 1. Save health record + signature in metadata
      const existingMeta = (athlete.metadata as Record<string, unknown>) ?? {};
      const updatedMeta = {
        ...existingMeta,
        healthRecord: {
          ...((existingMeta.healthRecord as object) ?? {}),
          ...record,
          signedAt: new Date().toISOString(),
        },
      };
      await apiFetch(`/athletes/${athlete.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: updatedMeta }),
      });

      // 2. Upload medical document if selected
      if (docFile) {
        const dataUrl = await fileToDataUrl(docFile);
        await apiFetch(`/athletes/${athlete.id}/health-document`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la ficha.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };
  const prev = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 1) setStep(STEPS[idx - 1]); // don't go back to identificacion
  };

  // ─── Success screen ───────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 py-20 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: "var(--success-dim)" }}
        >
          <svg className="h-10 w-10" style={{ color: "var(--success)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Ficha enviada</h1>
          <p className="mt-2" style={{ color: "var(--text-muted)" }}>
            Tu ficha de salud fue guardada correctamente.
            {docFile && " El documento médico fue subido con éxito."}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSuccess(false); setStep("salud"); }}>
          Volver a la ficha
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-16 md:p-8">
      {/* Back button */}
      <button type="button" onClick={() => window.history.back()}
        style={{ display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:0,color:"#21D0B3",fontSize:13,fontWeight:600 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver al portal
      </button>

      {/* Header */}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.3em]" style={{ color: "var(--text-faint)" }}>Seven Arena</p>
        <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>Ficha de salud</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Completa tu información de salud, firma y adjunta el documento médico de respaldo.
        </p>
      </div>

      {/* Step bar (only after identification) */}
      {athlete && (
        <div className="surface rounded-2xl p-4">
          <StepBar current={step} />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── STEP 1: Identificación ─────────────────────────────────────── */}
        {/* Con ?id= en la URL (llegada desde el portal) la ficha se carga sola:
            solo se muestra un estado de carga, nunca el formulario de ID. */}
        {step === "identificacion" && cameWithId && !error && (
          <div className="surface rounded-2xl p-6 flex flex-col items-center gap-4 py-12">
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(33,208,179,0.2)", borderTopColor: "#21D0B3", animation: "fs-spin 0.8s linear infinite" }} />
            <style>{`@keyframes fs-spin{to{transform:rotate(360deg)}}`}</style>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando tu ficha de salud…</p>
          </div>
        )}
        {step === "identificacion" && (!cameWithId || error) && (
          <div className="surface rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Identifícate</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Ingresa el ID de participante que te entregó la organización.
              </p>
            </div>
            <label className="space-y-2 block">
              <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>ID de participante</span>
              <input
                className="input"
                value={athleteId}
                onChange={(ev) => setAthleteId(ev.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => loadAthlete()}
              disabled={loading || !athleteId.trim()}
            >
              {loading ? "Buscando..." : "Continuar"}
            </button>
          </div>
        )}

        {/* ── STEP 2: Salud ──────────────────────────────────────────────── */}
        {step === "salud" && athlete && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--info-dim)" }}
                >
                  <svg className="h-5 w-5" style={{ color: "var(--info)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Datos personales de salud</h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{athlete.fullName}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Nombre completo</span>
                  <input className="input" value={p.fullName} onChange={(ev) => setP({ fullName: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Nombre social <span className="font-normal" style={{ color: "var(--text-faint)" }}>(opcional)</span></span>
                  <input className="input" value={p.socialName} onChange={(ev) => setP({ socialName: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Deporte / disciplina</span>
                  <input className="input" value={record.sport} onChange={(ev) => setRecord((r) => ({ ...r, sport: ev.target.value }))} placeholder="Atletismo, natación..." />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Género con que te identificas</span>
                  <input className="input" value={p.genderIdentity} onChange={(ev) => setP({ genderIdentity: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Género en cédula de identidad</span>
                  <input className="input" value={p.idCardGender} onChange={(ev) => setP({ idCardGender: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>RUT</span>
                  <input className="input" value={p.rut} onChange={(ev) => setP({ rut: ev.target.value })} placeholder="12.345.678-9" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Fecha de nacimiento</span>
                  <SpanishDateField value={p.birthDate} onChange={(v) => setP({ birthDate: v })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Talla (cm)</span>
                  <input className="input" type="number" value={p.height} onChange={(ev) => setP({ height: ev.target.value })} placeholder="170" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Peso (kg)</span>
                  <input className="input" type="number" value={p.weight} onChange={(ev) => setP({ weight: ev.target.value })} placeholder="65" />
                </label>
              </div>
            </div>

            <div className="surface rounded-2xl p-6 space-y-5">
              <h3 className="font-medium" style={{ color: "var(--text)" }}>Condiciones de salud</h3>

              <YesNoField label="¿Tiene alergias?" value={p.allergic} onChange={(v) => setP({ allergic: v })} />
              {p.allergic === "SI" && (
                <label className="space-y-2 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>¿A qué es alérgico/a?</span>
                  <input className="input" value={p.allergicTo} onChange={(ev) => setP({ allergicTo: ev.target.value })} placeholder="Penicilina, nueces, mariscos..." />
                </label>
              )}

              <YesNoField label="¿Tiene enfermedades crónicas?" value={p.chronicDiseases} onChange={(v) => setP({ chronicDiseases: v })} />
              {p.chronicDiseases === "SI" && (
                <label className="space-y-2 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Detalle enfermedades crónicas</span>
                  <textarea className="input" rows={2} value={p.chronicDetail} onChange={(ev) => setP({ chronicDetail: ev.target.value })} />
                </label>
              )}

              <label className="space-y-2 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Medicamentos actuales <span className="font-normal" style={{ color: "var(--text-faint)" }}>(si aplica)</span></span>
                <textarea className="input" rows={2} value={p.medications} onChange={(ev) => setP({ medications: ev.target.value })} placeholder="Nombre, dosis y frecuencia..." />
              </label>

              <YesNoField label="¿Está en tratamiento psiquiátrico?" value={p.psychiatricTreatment} onChange={(v) => setP({ psychiatricTreatment: v })} />
              {p.psychiatricTreatment === "SI" && (
                <>
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Detalle del tratamiento</span>
                    <textarea className="input" rows={2} value={p.psychiatricDetail} onChange={(ev) => setP({ psychiatricDetail: ev.target.value })} />
                  </label>
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Diagnóstico</span>
                    <input className="input" value={p.psychiatricDiagnosis} onChange={(ev) => setP({ psychiatricDiagnosis: ev.target.value })} />
                  </label>
                  <YesNoField label="¿Toma medicamentos psiquiátricos?" value={p.psychiatricMedications} onChange={(v) => setP({ psychiatricMedications: v })} />
                  {p.psychiatricMedications === "SI" && (
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Dosis y horarios</span>
                      <input className="input" value={p.psychiatricDoseSchedule} onChange={(ev) => setP({ psychiatricDoseSchedule: ev.target.value })} placeholder="Ej: 20 mg cada mañana" />
                    </label>
                  )}
                </>
              )}

              <YesNoField label="¿Requiere dieta especial?" value={p.specialDiet} onChange={(v) => setP({ specialDiet: v })} />
              {p.specialDiet === "SI" && (
                <label className="space-y-2 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Tipo de dieta</span>
                  <input className="input" value={p.specialDietDetail} onChange={(ev) => setP({ specialDietDetail: ev.target.value })} placeholder="Vegetariana, celíaca, sin lactosa..." />
                </label>
              )}
            </div>

            <NavButtons onPrev={prev} onNext={next} hidePrev />
          </div>
        )}

        {/* ── STEP 3: Contacto ───────────────────────────────────────────── */}
        {step === "contacto" && athlete && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Información de contacto</h2>
              <label className="space-y-2 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Dirección</span>
                <AddressAutocompleteField
                  value={c.address}
                  onChange={(v) => setC({ address: v })}
                  onResolved={(parts) => setC({
                    address: parts.address,
                    ...(parts.commune ? { commune: parts.commune } : {}),
                    ...(parts.city ? { city: parts.city } : {}),
                    ...(parts.region ? { region: parts.region } : {}),
                  })}
                />
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  Al elegir una sugerencia se completan comuna, ciudad y región.
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Comuna</span>
                  <input className="input" value={c.commune} onChange={(ev) => setC({ commune: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Ciudad</span>
                  <input className="input" value={c.city} onChange={(ev) => setC({ city: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Región</span>
                  <input className="input" value={c.region} onChange={(ev) => setC({ region: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Teléfono</span>
                  <PhoneField value={c.phone} onChange={(v) => setC({ phone: v })} />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Correo electrónico</span>
                  <input className="input" type="email" value={c.email} onChange={(ev) => setC({ email: ev.target.value })} />
                </label>
              </div>
              <YesNoField label="¿Perteneces a un pueblo originario?" value={c.indigenous} onChange={(v) => setC({ indigenous: v })} />
              {c.indigenous === "SI" && (
                <label className="space-y-2 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>¿Cuál?</span>
                  <input className="input" value={c.indigenousDetail} onChange={(ev) => setC({ indigenousDetail: ev.target.value })} />
                </label>
              )}
              <label className="space-y-2 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Talla de ropa</span>
                <select className="input" value={c.shirtSize} onChange={(ev) => setC({ shirtSize: ev.target.value })}>
                  <option value="">Selecciona tu talla</option>
                  {SHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="surface rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Representación deportiva</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Institución o club al que representas.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Dependencia</span>
                  <input className="input" value={rp.dependencyType} onChange={(ev) => setRP({ dependencyType: ev.target.value })} placeholder="Municipal, particular, federado..." />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Institución / establecimiento</span>
                  <input className="input" value={rp.institutionName} onChange={(ev) => setRP({ institutionName: ev.target.value })} />
                </label>
              </div>
              <YesNoField label="¿Estás inscrito en un club?" value={rp.enrolledClub} onChange={(v) => setRP({ enrolledClub: v })} />
              {rp.enrolledClub === "SI" && (
                <label className="space-y-2 block">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Nombre del club</span>
                  <input className="input" value={rp.clubName} onChange={(ev) => setRP({ clubName: ev.target.value })} />
                </label>
              )}
              <YesNoField label="¿Perteneces a Promesas Chile?" value={rp.promesasChile} onChange={(v) => setRP({ promesasChile: v })} />
            </div>
            <NavButtons onPrev={prev} onNext={next} />
          </div>
        )}

        {/* ── STEP 4: Emergencia ─────────────────────────────────────────── */}
        {step === "emergencia" && athlete && (
          <div className="space-y-4">
            <div className="surface rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Contacto de emergencia</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Persona a quien llamar en caso de emergencia.</p>
              </div>
              <label className="space-y-2 block">
                <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Nombre completo</span>
                <input className="input" value={e.name} onChange={(ev) => setE({ name: ev.target.value })} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Teléfono</span>
                  <PhoneField value={e.phone} onChange={(v) => setE({ phone: v })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Relación</span>
                  <input className="input" value={e.relation} onChange={(ev) => setE({ relation: ev.target.value })} placeholder="Madre, padre, pareja..." />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Correo electrónico</span>
                  <input className="input" type="email" value={e.email} onChange={(ev) => setE({ email: ev.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Dirección</span>
                  <input className="input" value={e.address} onChange={(ev) => setE({ address: ev.target.value })} />
                </label>
              </div>
            </div>
            <NavButtons onPrev={prev} onNext={next} />
          </div>
        )}

        {/* ── STEP 5: Firma y documento ──────────────────────────────────── */}
        {step === "firma" && athlete && (
          <div className="space-y-4">
            {/* Signature */}
            <div className="surface rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Firma del participante</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Dibuja tu firma en el recuadro de abajo. Certifica que la información entregada es verdadera.
                </p>
              </div>
              <SignatureCanvas
                onSign={(dataUrl) => setRecord((r) => ({ ...r, participantSignature: dataUrl }))}
                existingSignature={record.participantSignature}
              />
            </div>

            {/* Medical document */}
            <div className="surface rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Documento médico de respaldo</h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                  Sube una foto o PDF de tu certificado médico, examen de apto físico u otro documento que avale tu condición de salud.
                </p>
              </div>

              {/* Existing document */}
              {record.medicalDocumentUrl && !docPreview && (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                  <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-emerald-800">Documento ya subido</p>
                    <a href={record.medicalDocumentUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline truncate block">
                      Ver documento actual
                    </a>
                  </div>
                </div>
              )}

              {/* Preview of new file */}
              {docPreview && docFile?.type.startsWith("image/") && (
                <div className="overflow-hidden rounded-2xl" style={{ border: "1px solid var(--border)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={docPreview} alt="Documento" className="max-h-56 w-full object-contain" style={{ background: "var(--elevated)" }} />
                </div>
              )}
              {docPreview && docFile?.type === "application/pdf" && (
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">{docFile.name}</p>
                    <p className="text-xs text-blue-600">{(docFile.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                  </div>
                </div>
              )}

              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors"
                style={{ borderColor: "var(--border-strong)", background: "var(--elevated)" }}
                onClick={() => docInputRef.current?.click()}
              >
                <svg className="h-8 w-8" style={{ color: "var(--text-faint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                    {docFile ? "Cambiar documento" : "Subir documento médico"}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>JPG, PNG, PDF · Máx. 4 MB</p>
                </div>
              </div>
              <input
                ref={docInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleDocChange}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" className="btn btn-ghost flex-1" onClick={prev}>
                Atrás
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={saving || !record.participantSignature}
              >
                {saving ? "Enviando..." : "Enviar ficha"}
              </button>
            </div>

            {!record.participantSignature && (
              <p className="text-center text-xs" style={{ color: "var(--text-faint)" }}>Debes dibujar tu firma para poder enviar.</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function NavButtons({
  onPrev,
  onNext,
  hidePrev = false,
}: {
  onPrev: () => void;
  onNext: () => void;
  hidePrev?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {!hidePrev && (
        <button type="button" className="btn btn-ghost flex-1" onClick={onPrev}>
          Atrás
        </button>
      )}
      <button type="button" className="btn btn-primary flex-1" onClick={onNext}>
        Continuar
      </button>
    </div>
  );
}

export default function FichaSaludPage() {
  return (
    <Suspense>
      <FichaSaludContent />
    </Suspense>
  );
}
