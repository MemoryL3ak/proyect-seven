"use client";

import { useState, useMemo, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { cleanWhatsappPhone, formatWhatsappPhone, PHONE_PREFIX_CL } from "@/lib/external-link";
import { BRAND, STATE, SURFACE, ACCENT } from "@/lib/design";
import {
  AlertIcon,
  MailIcon,
  UserIcon,
  UsersIcon,
  CheckCircleIcon,
  ShieldIcon,
  ClockIcon,
  KeyIcon,
  BarChartIcon,
  TruckIcon,
  BedIcon,
  HeartIcon,
  TrophyIcon,
  PinIcon,
  CalendarIcon,
  MedalIcon,
  PlusIcon,
  SearchIcon,
  PencilIcon,
  BanIcon,
  TrashIcon,
  XIcon,
  CheckIcon,
  RefreshIcon,
  ChevronDownIcon,
  LoaderIcon,
} from "@/components/ui/Icons";
import { ALL_MODULES, MODULE_GROUPS, type AppModule } from "@/lib/modules";
import StyledSelect from "@/components/StyledSelect";
import { useI18n } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────
type SupabaseUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  banned_until?: string | null;
  email_confirmed_at?: string | null;
  user_metadata: Record<string, string>;
};

type Role =
  | "Administrador"
  | "Operador"
  | "Supervisor"
  | "Visualizador"
  | "Coordinador"
  | "Coordinador Bvan"
  | "Coordinador Comité"
  | "Coordinador General"
  | "Comité Transporte";
type UserStatus = "active" | "inactive" | "pending";

type AppUser = {
  id: string;
  fullName: string;
  email: string;
  /** Contacto. Con rol Coordinador General, los portales lo muestran para WhatsApp. */
  phone?: string;
  role: Role;
  modules: string[];
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  emailConfirmed: boolean;
  initials: string;
  color: string;
};

// El catálogo de módulos vive en lib/modules.ts (compartido con Mi Cuenta).

const ROLES: Role[] = [
  "Administrador",
  "Supervisor",
  "Coordinador",
  "Coordinador Bvan",
  "Coordinador Comité",
  "Coordinador General",
  "Comité Transporte",
  "Operador",
  "Visualizador",
];

// Transporte por grupo: si mañana se agrega un módulo al grupo, los
// coordinadores acotados lo heredan sin tocar cada preset.
const TRANSPORTE_MODULES = ALL_MODULES.filter((m) => m.group === "Transporte").map((m) => m.id);
// Transporte operativo, sin la información económica del Panel Financiero
// (tarifas de proveedores, costos y consumo real).
const TRANSPORTE_OPERATIVO = TRANSPORTE_MODULES.filter((id) => id !== "operacion.finanzas");

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Administrador: ALL_MODULES.map((m) => m.id),
  Supervisor: ALL_MODULES.filter((m) => m.group !== "Administración").map((m) => m.id),
  Coordinador: ALL_MODULES.filter((m) => !["Dashboard", "Administración"].includes(m.group)).map((m) => m.id),
  // Coordinadores acotados: solo los módulos que realmente operan.
  "Coordinador Bvan": [...TRANSPORTE_MODULES, "sede", "calendario", "alimentacion.general"],
  "Coordinador Comité": [...TRANSPORTE_MODULES, "sede", "calendario", "dashboard.comercial", "dashboard.operacional"],
  // Coordinador General: el contacto operativo que ven los portales (WhatsApp
  // en vez de llamar al chofer). Ve toda la operación; no administra usuarios.
  "Coordinador General": ALL_MODULES.filter((m) => m.group !== "Administración").map((m) => m.id),
  // Comité de transporte: operación y seguimiento, sin panel de proveedores
  // ni consumo real (Panel Financiero y Dashboard Comercial quedan fuera).
  "Comité Transporte": [...TRANSPORTE_OPERATIVO, "calendario"],
  Operador: ALL_MODULES.filter((m) => ["Operación", "Transporte", "Hotelería", "Alimentación", "Acreditaciones", "Documentos"].includes(m.group)).map((m) => m.id),
  Visualizador: ALL_MODULES.filter((m) => ["Dashboard", "Registro"].includes(m.group)).map((m) => m.id),
};

const AVATAR_COLORS = [ACCENT.indigo, "#ec4899", STATE.success, STATE.warning, STATE.info, ACCENT.violetLight, STATE.danger, BRAND.teal];

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_USERS: AppUser[] = [
  { id: "1", fullName: "Carlos Rodríguez", email: "carlos@sevenarana.com", role: "Administrador", modules: ROLE_PERMISSIONS["Administrador"], status: "active", emailConfirmed: true, createdAt: "2024-01-15", lastLogin: "hace 2 horas", initials: "CR", color: ACCENT.indigo },
  { id: "2", fullName: "Ana González", email: "ana@sevenarana.com", role: "Supervisor", modules: ROLE_PERMISSIONS["Supervisor"], status: "active", emailConfirmed: true, createdAt: "2024-02-20", lastLogin: "hace 1 día", initials: "AG", color: "#ec4899" },
  { id: "3", fullName: "Marco Silva", email: "marco@sevenarana.com", role: "Coordinador", modules: ROLE_PERMISSIONS["Coordinador"], status: "active", emailConfirmed: true, createdAt: "2024-03-10", lastLogin: "hace 3 días", initials: "MS", color: STATE.success },
  { id: "4", fullName: "Valentina Torres", email: "valen@sevenarana.com", role: "Operador", modules: ROLE_PERMISSIONS["Operador"], status: "active", emailConfirmed: true, createdAt: "2024-04-05", lastLogin: "hoy", initials: "VT", color: STATE.warning },
  { id: "5", fullName: "Felipe Muñoz", email: "felipe@sevenarana.com", role: "Visualizador", modules: ROLE_PERMISSIONS["Visualizador"], status: "inactive", emailConfirmed: true, createdAt: "2024-05-12", lastLogin: "hace 2 semanas", initials: "FM", color: STATE.info },
  { id: "6", fullName: "Daniela Pérez", email: "dani@sevenarana.com", role: "Operador", modules: ROLE_PERMISSIONS["Operador"], status: "pending", emailConfirmed: false, createdAt: "2024-06-01", initials: "DP", color: ACCENT.violetLight },
];

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "hace 1 día";
  if (days < 7) return `hace ${days} días`;
  return `hace ${Math.floor(days / 7)} semanas`;
}

function generateTempPassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function isUsernameUser(email: string) {
  return email.endsWith("@nomail.seven");
}
function extractUsername(email: string) {
  return isUsernameUser(email) ? email.replace("@nomail.seven", "") : email;
}

// ── Icons ────────────────────────────────────────────────────────────────────
function ActiveIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <CheckCircleIcon size={size} color={color} strokeWidth={1.8} />
  );
}

function BarChart2Icon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <BarChartIcon size={size} color={color} strokeWidth={1.8} />
  );
}
function ClipboardIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  );
}
function UtensilsIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
    </svg>
  );
}
function MapPinIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <PinIcon size={size} color={color} strokeWidth={1.8} />
  );
}
function AwardIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <MedalIcon size={size} color={color} strokeWidth={1.8} />
  );
}
function GlobeIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  );
}
function SettingsIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

type IconFC = (p: { color: string; size?: number }) => React.JSX.Element;
const GROUP_ICON: Record<string, IconFC> = {
  Dashboard: BarChart2Icon,
  Registro: ClipboardIcon,
  Operación: ShieldIcon,
  Transporte: TruckIcon,
  Hotelería: BedIcon,
  Alimentación: UtensilsIcon,
  Salud: HeartIcon,
  Clientes: UsersIcon,
  Deportes: TrophyIcon,
  Sede: MapPinIcon,
  Calendario: CalendarIcon,
  Acreditaciones: AwardIcon,
  Portales: GlobeIcon,
  Administración: SettingsIcon,
};

function ModuleIcon({ module, color, size = 11 }: { module: AppModule; color: string; size?: number }) {
  const Icon = GROUP_ICON[module.group];
  if (!Icon) return null;
  return <Icon color={color} size={size} />;
}

// ── Empty form ─────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    fullName: "",
    email: "",
    username: "",
    phone: PHONE_PREFIX_CL,
    loginType: "email" as "email" | "username",
    role: "Operador" as Role,
    modules: ROLE_PERMISSIONS["Operador"],
    tempPassword: generateTempPassword(),
    passwordEditable: false,
    status: "active" as UserStatus,
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { t } = useI18n();

  const pal = {
    accent: BRAND.teal,
    kpiGlow: "rgba(33,208,179,0.25)",
    rowHover: "rgba(33,208,179,0.04)",
    tableBorder: SURFACE.border,
    headerBg: SURFACE.bg,
    modalBg: SURFACE.card,
    modalBorder: SURFACE.border,
    mText: SURFACE.text,
    mTextMuted: SURFACE.textMuted,
    mTextFaint: SURFACE.textFaint,
    mElevated: SURFACE.bg,
    mBorder: SURFACE.border,
  };

  const selM: React.CSSProperties = { background: pal.mElevated, color: pal.mText, border: `1px solid ${pal.mBorder}` };

  // ── State ──────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "">("");
  const [filterStatus, setFilterStatus] = useState<UserStatus | "">("");
  const [activeTab, setActiveTab] = useState<"usuarios" | "roles">("usuarios");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load users from API ───────────────────────────────────────────────
  useEffect(() => {
    apiFetch<{ users: SupabaseUser[] }>("/auth/users")
      .then(({ users: raw }) => {
        const mapped: AppUser[] = raw.map((u, i) => ({
          id: u.id,
          fullName: u.user_metadata?.name || u.email?.split("@")[0] || "Sin nombre",
          email: u.email || "",
          phone: typeof u.user_metadata?.phone === "string" ? u.user_metadata.phone : "",
          role: (u.user_metadata?.role as Role) || "Operador",
          modules: Array.isArray(u.user_metadata?.modules) ? u.user_metadata.modules : (ROLE_PERMISSIONS[(u.user_metadata?.role as Role) || "Operador"] || []),
          status: u.banned_until ? "inactive" : "active",
          emailConfirmed: Boolean(u.email_confirmed_at),
          createdAt: u.created_at?.split("T")[0] || "",
          lastLogin: u.last_sign_in_at ? formatRelative(u.last_sign_in_at) : undefined,
          initials: getInitials(u.user_metadata?.name || u.email?.split("@")[0] || "?"),
          color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        }));
        setUsers(mapped);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  // ── Filtered users ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = !filterRole || u.role === filterRole;
      const matchStatus = !filterStatus || u.status === filterStatus;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, filterRole, filterStatus]);

  const kpis = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    admins: users.filter((u) => u.role === "Administrador").length,
    pending: users.filter((u) => u.status === "pending").length,
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  function openCreate() {
    setEditingUser(null);
    setForm(emptyForm());
    setShowModal(true);
    setShowTempPassword(false);
    setSaveError(null);
  }

  function openEdit(user: AppUser) {
    setEditingUser(user);
    const uType = isUsernameUser(user.email) ? "username" : "email";
    setForm({
      fullName: user.fullName,
      email: uType === "email" ? user.email : "",
      username: uType === "username" ? extractUsername(user.email) : "",
      phone: user.phone ? formatWhatsappPhone(user.phone) : PHONE_PREFIX_CL,
      loginType: uType,
      role: user.role,
      modules: user.modules,
      tempPassword: uType === "username" ? "" : "",
      passwordEditable: uType === "username",
      status: user.status,
    });
    setShowModal(true);
    setShowTempPassword(false);
    setSaveError(null);
  }

  function handleRoleChange(role: Role) {
    setForm((f) => ({ ...f, role, modules: ROLE_PERMISSIONS[role] }));
  }

  function toggleModule(id: string) {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(id) ? f.modules.filter((m) => m !== id) : [...f.modules, id],
    }));
  }

  function toggleGroup(group: string) {
    const groupModuleIds = ALL_MODULES.filter((m) => m.group === group).map((m) => m.id);
    const allSelected = groupModuleIds.every((id) => form.modules.includes(id));
    setForm((f) => ({
      ...f,
      modules: allSelected
        ? f.modules.filter((id) => !groupModuleIds.includes(id))
        : [...new Set([...f.modules, ...groupModuleIds])],
    }));
  }

  async function handleSave() {
    const isUsername = form.loginType === "username";
    if (!form.fullName) return;
    if (isUsername && !form.username) return;
    if (!isUsername && !form.email) return;
    setSaveError(null);
    setSaving(true);
    try {
      if (editingUser) {
        await apiFetch(`/auth/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.fullName,
            role: form.role,
            modules: form.modules,
            phone: cleanWhatsappPhone(form.phone),
            ...(form.passwordEditable ? { password: form.tempPassword } : {}),
          }),
        });
        setUsers((us) => us.map((u) => u.id === editingUser.id ? { ...u, fullName: form.fullName, phone: cleanWhatsappPhone(form.phone), role: form.role, modules: form.modules, status: form.status } : u));
      } else {
        // Create: register via backend → Supabase Auth
        const result = await apiFetch<{ user: SupabaseUser }>("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.fullName,
            ...(isUsername ? { username: form.username } : { email: form.email }),
            password: form.tempPassword,
            role: form.role,
            modules: form.modules,
            isTemporaryPassword: !isUsername,
            ...(cleanWhatsappPhone(form.phone) ? { phone: cleanWhatsappPhone(form.phone) } : {}),
          }),
        });
        const displayEmail = isUsername
          ? `${form.username}@nomail.seven`
          : form.email;
        const newUser: AppUser = {
          id: result.user.id,
          fullName: form.fullName,
          email: displayEmail,
          phone: cleanWhatsappPhone(form.phone),
          role: form.role,
          modules: form.modules,
          status: form.status,
          emailConfirmed: true,
          createdAt: new Date().toISOString().split("T")[0],
          initials: getInitials(form.fullName),
          color: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
        };
        setUsers((us) => [...us, newUser]);
      }
      setShowModal(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Error al guardar el usuario"));
    } finally {
      setSaving(false);
    }
  }

  function handleToggleStatus(id: string) {
    setUsers((us) => us.map((u) => u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u));
  }

  async function confirmAndToggleStatus() {
    if (!confirmDelete) return;
    setDeleting(true);
    const isDisabling = confirmDelete.status === "active";
    try {
      await apiFetch(`/auth/users/${confirmDelete.id}/${isDisabling ? "disable" : "enable"}`, { method: "PATCH" });
      setUsers((us) => us.map((u) => u.id === confirmDelete.id ? { ...u, status: isDisabling ? "inactive" : "active" } : u));
      setConfirmDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : t("Error al actualizar el usuario"));
    } finally {
      setDeleting(false);
    }
  }

  function copyTempPassword() {
    navigator.clipboard.writeText(form.tempPassword).then(() => {
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function roleColor(role: Role) {
    if (role === "Administrador") return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", color: STATE.danger };
    if (role === "Supervisor") return { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", color: "#f97316" };
    if (role === "Coordinador") return { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", color: STATE.success };
    if (role === "Coordinador Bvan") return { bg: "rgba(33,208,179,0.12)", border: "rgba(33,208,179,0.32)", color: BRAND.tealDark };
    if (role === "Coordinador Comité") return { bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)", color: ACCENT.violet };
    if (role === "Coordinador General") return { bg: "rgba(5,150,105,0.12)", border: "rgba(5,150,105,0.32)", color: STATE.successText };
    if (role === "Comité Transporte") return { bg: "rgba(31,205,255,0.12)", border: "rgba(31,205,255,0.32)", color: "#0891b2" };
    if (role === "Operador") return { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", color: STATE.info };
    return { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)", color: SURFACE.textMuted };
  }

  function statusInfo(s: UserStatus) {
    if (s === "active") return { label: "Activo", color: STATE.success, bg: "rgba(34,197,94,0.1)" };
    if (s === "inactive") return { label: "Inactivo", color: SURFACE.textFaint, bg: "rgba(148,163,184,0.1)" };
    return { label: "Pendiente", color: STATE.warning, bg: "rgba(245,158,11,0.1)" };
  }

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header */}
      <section style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: SURFACE.textFaint }}>Seven Arena</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 10px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: BRAND.teal, display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: BRAND.teal }}>{t("ADMINISTRACIÓN")}</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: SURFACE.text, margin: 0 }}>{t("Gestión de Usuarios")}</h1>
          <button
            onClick={openCreate}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", background: BRAND.teal, color: SURFACE.card, border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(33,208,179,0.3)", transition: "all 150ms ease", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(33,208,179,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(33,208,179,0.3)"; }}
          >
            <PlusIcon size={16} strokeWidth={2.5} />
            {t("Nuevo Usuario")}
          </button>
        </div>

        {/* KPI row */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {(
            [
              { label: "Total Usuarios", value: kpis.total, Icon: UsersIcon, sub: "en el sistema", color: BRAND.teal },
              { label: "Activos", value: kpis.active, Icon: ActiveIcon, sub: "usuarios activos", color: STATE.success },
              { label: "Administradores", value: kpis.admins, Icon: ShieldIcon, sub: "con acceso total", color: STATE.danger },
              { label: "Pendientes", value: kpis.pending, Icon: ClockIcon, sub: "por confirmar", color: STATE.warning },
            ] as { label: string; value: number; Icon: (p: { color: string; size?: number }) => React.JSX.Element; sub: string; color: string }[]
          ).map((k) => (
            <div key={k.label} style={{ background: SURFACE.card, border: `1px solid ${SURFACE.border}`, borderTop: `3px solid ${k.color}`, borderRadius: "16px", padding: "16px 18px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", transition: "transform 120ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: k.color, margin: 0 }}>{t(k.label)}</p>
                <k.Icon color={k.color} size={18} />
              </div>
              <p style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, color: k.color, margin: "0 0 8px" }}>{k.value}</p>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: k.color, flexShrink: 0 }} />
                <p style={{ fontSize: "11px", color: SURFACE.textMuted, margin: 0 }}>{t(k.sub)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Body */}
      <div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: `1px solid ${SURFACE.border}`, paddingBottom: "0" }}>
          {(["usuarios", "roles"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px",
                background: "none", border: "none",
                borderBottom: activeTab === tab ? `2px solid ${pal.accent}` : "2px solid transparent",
                color: activeTab === tab ? pal.accent : SURFACE.textMuted,
                fontSize: "14px", fontWeight: activeTab === tab ? 700 : 500,
                cursor: "pointer", transition: "all 150ms", marginBottom: "-1px",
                textTransform: "capitalize",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {tab === "usuarios"
                  ? <><UsersIcon color={activeTab === tab ? pal.accent : SURFACE.textMuted} size={14} /> {t("Usuarios")}</>
                  : <><KeyIcon color={activeTab === tab ? pal.accent : SURFACE.textMuted} size={14} /> {t("Roles y Permisos")}</>
                }
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab: Usuarios ── */}
        {activeTab === "usuarios" && (
          <>
            {/* Filter bar */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1", minWidth: "220px" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: SURFACE.textFaint, pointerEvents: "none" }}>
                  <SearchIcon size={15} strokeWidth={2} />
                </span>
                <input
                  type="text"
                  placeholder={t("Buscar usuarios...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ background: SURFACE.bg, color: SURFACE.text, border: `1px solid ${SURFACE.border}`, padding: "10px 14px 10px 38px", borderRadius: "10px", fontSize: "13.5px", outline: "none", width: "100%" }}
                />
              </div>

              {/* Role filter */}
              <StyledSelect
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as Role | "")}
                wrapperStyle={{ minWidth: "160px", flex: "none" }}
              >
                <option value="">{t("Todos los roles")}</option>
                {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </StyledSelect>

              {/* Status filter */}
              <StyledSelect
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as UserStatus | "")}
                wrapperStyle={{ minWidth: "150px", flex: "none" }}
              >
                <option value="">{t("Todos los estados")}</option>
                <option value="active">{t("Activos")}</option>
                <option value="inactive">{t("Inactivos")}</option>
                <option value="pending">{t("Pendientes")}</option>
              </StyledSelect>

              <span style={{ fontSize: "13px", color: SURFACE.textMuted, whiteSpace: "nowrap" }}>
                {filtered.length} {filtered.length !== 1 ? t("usuarios") : t("usuario")}
              </span>
            </div>

            {/* Table */}
            <div style={{
              border: `1px solid ${pal.tableBorder}`,
              borderRadius: "16px",
              overflow: "hidden",
              background: SURFACE.card,
            }}>
              {/* En móvil la tabla-grid de 6 columnas scrollea horizontal en
                  vez de recortarse bajo el overflow hidden del card. */}
              <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "760px" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2.5fr 1.5fr 1.2fr 1fr 1fr 80px",
                gap: "0",
                padding: "13px 20px",
                background: pal.headerBg,
                borderBottom: `1px solid ${pal.tableBorder}`,
              }}>
                {["Usuario", "Email", "Rol", "Módulos", "Estado", ""].map((h) => (
                  <span key={h} style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SURFACE.textFaint }}>{h ? t(h) : ""}</span>
                ))}
              </div>

              {loadingUsers ? (
                <div style={{ padding: "48px", textAlign: "center", color: SURFACE.textMuted, fontSize: "14px" }}>
                  {t("Cargando usuarios...")}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: SURFACE.textMuted, fontSize: "14px" }}>
                  {t("No hay usuarios que coincidan con los filtros")}
                </div>
              ) : (
                filtered.map((user) => {
                  const rc = roleColor(user.role);
                  const si = statusInfo(user.status);
                  return (
                    <div
                      key={user.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2.5fr 1.5fr 1.2fr 1fr 1fr 80px",
                        gap: "0",
                        padding: "14px 20px",
                        borderBottom: `1px solid ${pal.tableBorder}`,
                        background: hoveredRow === user.id ? pal.rowHover : "transparent",
                        transition: "background 150ms ease",
                        alignItems: "center",
                      }}
                      onMouseEnter={() => setHoveredRow(user.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {/* User info */}
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%",
                          background: user.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "13px", fontWeight: 700, color: SURFACE.card,
                          flexShrink: 0,
                          boxShadow: `0 2px 8px ${user.color}60`,
                        }}>
                          {user.initials}
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: SURFACE.text, margin: 0 }}>{user.fullName}</p>
                          {user.lastLogin && <p style={{ fontSize: "11.5px", color: SURFACE.textFaint, margin: "1px 0 0" }}>{t("Último:")} {user.lastLogin}</p>}
                        </div>
                      </div>

                      {/* Email / Username */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {isUsernameUser(user.email) ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "13px", color: SURFACE.textMuted }}>
                            <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "99px", background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>{t("USUARIO")}</span>
                            {extractUsername(user.email)}
                          </span>
                        ) : (
                          <p style={{ fontSize: "13px", color: SURFACE.textMuted, margin: 0 }}>{user.email}</p>
                        )}
                        {!user.emailConfirmed && !isUsernameUser(user.email) && (
                          <span style={{
                            fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "99px", width: "fit-content",
                            background: "rgba(245,158,11,0.12)", color: STATE.warning, border: "1px solid rgba(245,158,11,0.3)",
                          }}>
                            <AlertIcon size={11} className="inline mr-1" />{t("Email no confirmado")}
                          </span>
                        )}
                      </div>

                      {/* Role */}
                      <span style={{
                        display: "inline-flex", alignItems: "center",
                        padding: "4px 10px",
                        background: rc.bg,
                        border: `1px solid ${rc.border}`,
                        borderRadius: "100px",
                        fontSize: "12px", fontWeight: 600, color: rc.color,
                        width: "fit-content",
                      }}>
                        {t(user.role)}
                      </span>

                      {/* Modules */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          fontSize: "14px", fontWeight: 700,
                          color: pal.accent,
                        }}>
                          {user.modules.length}
                        </span>
                        <span style={{ fontSize: "12px", color: SURFACE.textFaint }}>
                          / {ALL_MODULES.length}
                        </span>
                      </div>

                      {/* Status */}
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: si.color,
                          boxShadow: user.status === "active" ? `0 0 6px ${si.color}` : "none",
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: "12.5px", color: SURFACE.textMuted, fontWeight: 500 }}>{t(si.label)}</span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        {!user.emailConfirmed && !isUsernameUser(user.email) && (
                          <button
                            onClick={async () => {
                              try {
                                await apiFetch(`/auth/users/${user.id}/confirm-email`, { method: "PATCH" });
                                setUsers((us) => us.map((u) => u.id === user.id ? { ...u, emailConfirmed: true } : u));
                              } catch (err) {
                                alert(err instanceof Error ? err.message : t("Error confirmando email"));
                              }
                            }}
                            style={{
                              background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)",
                              borderRadius: "8px", padding: "6px 8px",
                              cursor: "pointer", color: STATE.warning, fontSize: "11px", fontWeight: 700,
                              transition: "all 150ms", whiteSpace: "nowrap",
                            }}
                            title={t("Confirmar email para permitir acceso")}
                          >
                            {t("Confirmar email")}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(user)}
                          style={{
                            background: SURFACE.bg, border: `1px solid ${SURFACE.border}`,
                            borderRadius: "8px", padding: "6px",
                            cursor: "pointer", color: SURFACE.textMuted,
                            transition: "all 150ms",
                          }}
                          title={t("Editar")}
                          onMouseEnter={(e) => { e.currentTarget.style.color = pal.accent; e.currentTarget.style.borderColor = pal.accent; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = SURFACE.textMuted; e.currentTarget.style.borderColor = SURFACE.border; }}
                        >
                          <PencilIcon size={14} strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(user)}
                          style={{
                            background: SURFACE.bg, border: `1px solid ${SURFACE.border}`,
                            borderRadius: "8px", padding: "6px",
                            cursor: "pointer",
                            color: user.status === "active" ? SURFACE.textMuted : STATE.success,
                            transition: "all 150ms",
                          }}
                          title={user.status === "active" ? t("Deshabilitar acceso") : t("Habilitar acceso")}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = user.status === "active" ? STATE.danger : STATE.success;
                            e.currentTarget.style.borderColor = user.status === "active" ? STATE.danger : STATE.success;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = user.status === "active" ? SURFACE.textMuted : STATE.success;
                            e.currentTarget.style.borderColor = SURFACE.border;
                          }}
                        >
                          {user.status === "active" ? (
                            <BanIcon size={14} strokeWidth={2} />
                          ) : (
                            <CheckCircleIcon size={14} strokeWidth={2} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(user)}
                          style={{
                            background: SURFACE.bg, border: `1px solid ${SURFACE.border}`,
                            borderRadius: "8px", padding: "6px",
                            cursor: "pointer", color: SURFACE.textFaint, transition: "all 150ms",
                          }}
                          title={t("Eliminar usuario")}
                          onMouseEnter={(e) => { e.currentTarget.style.color = STATE.danger; e.currentTarget.style.borderColor = STATE.danger; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = SURFACE.textFaint; e.currentTarget.style.borderColor = SURFACE.border; }}
                        >
                          <TrashIcon size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              </div>
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Roles ── */}
        {activeTab === "roles" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {ROLES.map((role) => {
              const rc = roleColor(role);
              const roleUsers = users.filter((u) => u.role === role);
              const perms = ROLE_PERMISSIONS[role];
              return (
                <div key={role} style={{
                  border: `1px solid ${pal.tableBorder}`,
                  borderTop: `3px solid ${rc.color}`,
                  borderRadius: "16px",
                  background: SURFACE.card,
                  overflow: "hidden",
                  transition: "transform 200ms ease, box-shadow 200ms ease",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${rc.color}20`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Header */}
                  <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${pal.tableBorder}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{
                        padding: "5px 12px",
                        background: rc.bg, border: `1px solid ${rc.border}`,
                        borderRadius: "100px",
                        fontSize: "13px", fontWeight: 700, color: rc.color,
                      }}>{t(role)}</span>
                      <span style={{
                        fontSize: "12px", color: SURFACE.textFaint, fontWeight: 500,
                      }}>
                        {roleUsers.length} {roleUsers.length !== 1 ? t("usuarios") : t("usuario")}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: SURFACE.textMuted, margin: 0 }}>
                      {perms.length} {t("de")} {ALL_MODULES.length} {t("módulos habilitados")}
                    </p>
                  </div>

                  {/* Module list */}
                  <div style={{ padding: "14px 20px", maxHeight: "280px", overflowY: "auto" }}>
                    {MODULE_GROUPS.map((group) => {
                      const groupModules = ALL_MODULES.filter((m) => m.group === group);
                      const enabledInGroup = groupModules.filter((m) => perms.includes(m.id));
                      if (enabledInGroup.length === 0) return null;
                      return (
                        <div key={group} style={{ marginBottom: "12px" }}>
                          <p style={{
                            fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
                            textTransform: "uppercase", color: SURFACE.textFaint,
                            margin: "0 0 6px",
                          }}>{t(group)}</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {enabledInGroup.map((m) => (
                              <span key={m.id} style={{
                                display: "inline-flex", alignItems: "center", gap: "4px",
                                padding: "3px 9px",
                                background: `${rc.color}12`,
                                border: `1px solid ${rc.color}25`,
                                borderRadius: "100px",
                                fontSize: "11px", color: SURFACE.textMuted, fontWeight: 500,
                              }}>
                                <ModuleIcon module={m} color={rc.color} size={10} /> {t(m.label)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Users avatars */}
                  {roleUsers.length > 0 && (
                    <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${pal.tableBorder}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ display: "flex" }}>
                          {roleUsers.slice(0, 4).map((u, i) => (
                            <div key={u.id} style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: u.color,
                              border: `2px solid ${SURFACE.card}`,
                              marginLeft: i > 0 ? "-8px" : "0",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "10px", fontWeight: 700, color: SURFACE.card,
                              flexShrink: 0,
                            }}>
                              {u.initials}
                            </div>
                          ))}
                        </div>
                        {roleUsers.length > 4 && (
                          <span style={{ fontSize: "11px", color: SURFACE.textFaint }}>+{roleUsers.length - 4} {t("más")}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Create/Edit User ─────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{
            background: pal.modalBg,
            border: `1px solid ${pal.modalBorder}`,
            borderRadius: "20px",
            width: "100%",
            maxWidth: "680px",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            animation: "slide-up 300ms cubic-bezier(0.16,1,0.3,1) both",
          }}>
            <style>{`@keyframes slide-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>

            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "24px 28px 20px",
              borderBottom: `1px solid ${pal.modalBorder}`,
            }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, color: pal.mText, margin: "0 0 3px" }}>
                  {editingUser ? t("Editar Usuario") : t("Nuevo Usuario")}
                </h2>
                <p style={{ fontSize: "13px", color: pal.mTextMuted, margin: 0 }}>
                  {editingUser ? t("Modifica los datos y permisos del usuario") : t("Crea una cuenta y asigna accesos al sistema")}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: pal.mElevated, border: `1px solid ${pal.mBorder}`, borderRadius: "10px", padding: "8px", cursor: "pointer", color: pal.mTextMuted, transition: "all 150ms" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = pal.mText; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = pal.mTextMuted; }}
              >
                <XIcon size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "22px" }}>

              {/* Basic info */}
              <div>
                <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: "0 0 14px" }}>
                  {t("Información personal")}
                </h3>
                {/* Login type toggle */}
                {!editingUser && (
                  <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                    {(["email", "username"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({
                          ...f,
                          loginType: type,
                          passwordEditable: type === "username",
                          tempPassword: type === "username" ? "" : generateTempPassword(),
                        }))}
                        style={{
                          padding: "7px 16px", borderRadius: "8px", fontSize: "12.5px", fontWeight: 600,
                          cursor: "pointer", transition: "all 150ms", border: "1px solid",
                          background: form.loginType === type ? pal.accent + "22" : pal.mElevated,
                          borderColor: form.loginType === type ? pal.accent : pal.mBorder,
                          color: form.loginType === type ? pal.accent : pal.mTextMuted,
                        }}
                      >
                        {type === "email" ? <><MailIcon size={13} className="inline mr-1" />{t("Con Email")}</> : <><UserIcon size={13} className="inline mr-1" />{t("Con Usuario")}</>}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>
                      {t("Nombre completo *")}
                    </label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder={t("Nombre Apellido")}
                      style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                    />
                  </div>
                  <div>
                    {form.loginType === "username" ? (
                      <>
                        <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>
                          {t("Nombre de usuario *")}
                        </label>
                        <input
                          type="text"
                          value={form.username}
                          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))}
                          placeholder={t("nombre.usuario")}
                          style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%", fontFamily: "monospace" }}
                        />
                      </>
                    ) : (
                      <>
                        <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>
                          {t("Email *")}
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder={t("email@ejemplo.com")}
                          style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: "12px" }}>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>
                    {t("Teléfono (WhatsApp)")}
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: formatWhatsappPhone(e.target.value) }))}
                    onBlur={() => setForm((f) => (f.phone.trim() === "+" || !f.phone ? { ...f, phone: PHONE_PREFIX_CL } : f))}
                    placeholder="+56 9 1234 5678"
                    inputMode="tel"
                    autoComplete="off"
                    style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                  />
                  {form.role === "Coordinador General" && (
                    <p style={{ fontSize: "11.5px", color: pal.mTextFaint, margin: "6px 0 0" }}>
                      {t("Con rol Coordinador General, los pasajeros lo ven como contacto de WhatsApp.")}
                    </p>
                  )}
                </div>
              </div>

              {/* Role + Status */}
              <div>
                <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: "0 0 14px" }}>
                  {t("Rol y estado")}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>{t("Rol")}</label>
                    <StyledSelect
                      value={form.role}
                      onChange={(e) => handleRoleChange(e.target.value as Role)}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                    </StyledSelect>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>{t("Estado")}</label>
                    <StyledSelect
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}
                    >
                      <option value="active">{t("Activo")}</option>
                      <option value="inactive">{t("Inactivo")}</option>
                      <option value="pending">{t("Pendiente")}</option>
                    </StyledSelect>
                  </div>
                </div>
              </div>

              {/* Temp password */}
              <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 14px" }}>
                    <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: 0 }}>
                      {editingUser ? t("Restablecer contraseña") : form.loginType === "username" ? t("Contraseña asignada") : t("Contraseña temporal")}
                    </h3>
                    {editingUser && form.loginType !== "username" && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, passwordEditable: !f.passwordEditable, tempPassword: f.passwordEditable ? "" : generateTempPassword() }))}
                        style={{ fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "8px", border: "none", cursor: "pointer", background: form.passwordEditable ? "rgba(239,68,68,0.1)" : "rgba(33,208,179,0.1)", color: form.passwordEditable ? STATE.danger : BRAND.teal }}>
                        {form.passwordEditable ? t("Cancelar cambio") : t("Cambiar contraseña")}
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showTempPassword ? "text" : "password"}
                      value={form.tempPassword}
                      onChange={form.loginType === "username" || form.passwordEditable ? (e) => setForm((f) => ({ ...f, tempPassword: e.target.value })) : undefined}
                      readOnly={form.loginType !== "username" && !form.passwordEditable}
                      placeholder={form.loginType === "username" ? t("Escribe la contraseña") : editingUser && !form.passwordEditable ? "••••••••" : undefined}
                      style={{
                        ...selM,
                        padding: "11px 80px 11px 14px",
                        borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%",
                        fontFamily: form.loginType === "username" ? "inherit" : "monospace",
                        letterSpacing: form.loginType === "username" ? "normal" : "0.05em",
                        cursor: form.loginType !== "username" && !form.passwordEditable ? "default" : "text",
                      }}
                    />
                    <div style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setShowTempPassword(!showTempPassword)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: pal.mTextMuted, padding: "2px", transition: "color 150ms" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = pal.mText}
                        onMouseLeave={(e) => e.currentTarget.style.color = pal.mTextMuted}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {showTempPassword ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={copyTempPassword}
                        title={t("Copiar")}
                        style={{ background: "none", border: "none", cursor: "pointer", color: copiedPwd ? STATE.success : pal.mTextMuted, padding: "2px", transition: "color 150ms" }}
                      >
                        {copiedPwd ? (
                          <CheckIcon size={15} strokeWidth={2.5} />
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, tempPassword: generateTempPassword() }))}
                        title={t("Regenerar")}
                        style={{ background: "none", border: "none", cursor: "pointer", color: pal.mTextMuted, padding: "2px", transition: "color 150ms" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = pal.mText}
                        onMouseLeave={(e) => e.currentTarget.style.color = pal.mTextMuted}
                      >
                        <RefreshIcon size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: "11.5px", color: pal.mTextFaint, margin: "6px 0 0" }}>
                    {editingUser
                      ? t("Genera una nueva contraseña y compártela con el usuario.")
                      : t("Esta contraseña temporal debe ser cambiada en el primer inicio de sesión.")}
                  </p>
              </div>

              {/* Module assignment */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: 0 }}>
                    {t("Módulos asignados")}
                  </h3>
                  <span style={{
                    fontSize: "12px", fontWeight: 600,
                    color: pal.accent,
                  }}>
                    {form.modules.length} / {ALL_MODULES.length} {t("seleccionados")}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {MODULE_GROUPS.map((group) => {
                    const groupModules = ALL_MODULES.filter((m) => m.group === group);
                    const allSelected = groupModules.every((m) => form.modules.includes(m.id));
                    const someSelected = groupModules.some((m) => form.modules.includes(m.id));
                    const isExpanded = expandedModule === group;

                    return (
                      <div key={group} style={{
                        border: `1px solid ${pal.mBorder}`,
                        borderRadius: "12px",
                        overflow: "hidden",
                        background: allSelected ? `${pal.accent}10` : pal.mElevated,
                        transition: "all 150ms",
                      }}>
                        {/* Group header */}
                        <div
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "11px 14px",
                            cursor: "pointer",
                          }}
                          onClick={() => setExpandedModule(isExpanded ? null : group)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {/* Checkbox */}
                            <div
                              onClick={(e) => { e.stopPropagation(); toggleGroup(group); }}
                              style={{
                                width: 18, height: 18, borderRadius: "5px",
                                background: allSelected ? pal.accent : someSelected ? `${pal.accent}30` : "transparent",
                                border: `1.5px solid ${allSelected ? pal.accent : someSelected ? pal.accent : pal.mBorder}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", flexShrink: 0, transition: "all 150ms",
                              }}
                            >
                              {allSelected && <CheckIcon size={10} color={SURFACE.card} strokeWidth={3} />}
                              {someSelected && !allSelected && <div style={{ width: 8, height: 2, background: pal.accent, borderRadius: "1px" }} />}
                            </div>
                            <span style={{ fontSize: "13.5px", fontWeight: 600, color: pal.mText }}>{t(group)}</span>
                            <span style={{
                              fontSize: "11px",
                              padding: "2px 7px",
                              borderRadius: "100px",
                              background: allSelected ? `${pal.accent}22` : "rgba(0,0,0,0.06)",
                              color: allSelected ? pal.accent : pal.mTextFaint,
                              fontWeight: 600,
                            }}>
                              {groupModules.filter((m) => form.modules.includes(m.id)).length}/{groupModules.length}
                            </span>
                          </div>
                          <ChevronDownIcon size={14} color={pal.mTextFaint} strokeWidth={2} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }} />
                        </div>

                        {/* Module items */}
                        {isExpanded && (
                          <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: "4px", borderTop: `1px solid ${pal.mBorder}` }}>
                            {groupModules.map((m) => {
                              const checked = form.modules.includes(m.id);
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => toggleModule(m.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: "10px",
                                    padding: "8px 10px",
                                    borderRadius: "8px",
                                    cursor: "pointer",
                                    background: checked ? `${pal.accent}10` : "transparent",
                                    transition: "background 150ms",
                                  }}
                                  onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = checked ? `${pal.accent}10` : "transparent"; }}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: "4px",
                                    background: checked ? pal.accent : "transparent",
                                    border: `1.5px solid ${checked ? pal.accent : pal.mBorder}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0, transition: "all 150ms",
                                  }}>
                                    {checked && <CheckIcon size={9} color={SURFACE.card} strokeWidth={3.5} />}
                                  </div>
                                  <ModuleIcon module={m} color={checked ? pal.accent : SURFACE.textFaint} size={13} />
                                  <span style={{ fontSize: "13px", color: checked ? pal.mText : pal.mTextMuted, fontWeight: checked ? 500 : 400, transition: "color 150ms" }}>
                                    {t(m.label)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            {saveError && (
              <div style={{
                margin: "0 28px 12px",
                padding: "10px 14px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "10px",
                color: STATE.danger,
                fontSize: "13px",
              }}>
                {saveError}
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px",
              padding: "18px 28px",
              borderTop: `1px solid ${pal.modalBorder}`,
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "10px 20px",
                  background: pal.mElevated, border: `1px solid ${pal.mBorder}`,
                  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
                  color: pal.mTextMuted, cursor: "pointer", transition: "all 150ms",
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = pal.mText}
                onMouseLeave={(e) => e.currentTarget.style.color = pal.mTextMuted}
              >
                {t("Cancelar")}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.fullName || (form.loginType === "username" ? !form.username : !form.email) || saving}
                style={{
                  padding: "10px 24px",
                  background: (!form.fullName || (form.loginType === "username" ? !form.username : !form.email) || saving) ? "rgba(100,116,139,0.3)" : pal.accent,
                  border: "none",
                  borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                  color: (!form.fullName || (form.loginType === "username" ? !form.username : !form.email) || saving) ? "rgba(100,116,139,0.6)" : SURFACE.card,
                  cursor: (!form.fullName || (form.loginType === "username" ? !form.username : !form.email) || saving) ? "not-allowed" : "pointer",
                  transition: "all 150ms",
                  boxShadow: (!form.fullName || (form.loginType === "username" ? !form.username : !form.email) || saving) ? "none" : `0 4px 16px ${pal.kpiGlow}`,
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                {saving && (
                  <LoaderIcon size={14} strokeWidth={2.5} style={{ animation: "spin-slow 0.8s linear infinite" }} />
                )}
                {saving ? t("Creando...") : (editingUser ? t("Guardar cambios") : t("Crear usuario"))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ─────────────────────────────────────── */}
      {confirmDelete && (() => {
        const isDisabling = confirmDelete.status === "active";
        const actionColor = isDisabling ? STATE.danger : STATE.success;
        const actionColorLight = isDisabling ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)";
        const actionColorBorder = isDisabling ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)";
        const actionGlow = isDisabling ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)";
        const actionGradient = isDisabling
          ? `linear-gradient(135deg, ${STATE.danger}, ${STATE.dangerText})`
          : `linear-gradient(135deg, ${STATE.success}, ${STATE.success})`;
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}>
            <div style={{
              background: pal.modalBg,
              border: `1px solid ${pal.modalBorder}`,
              borderRadius: "20px",
              width: "100%", maxWidth: "400px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{ padding: "24px 24px 0", textAlign: "center" }}>
                <div style={{
                  width: "52px", height: "52px", borderRadius: "14px",
                  background: actionColorLight, border: `1px solid ${actionColorBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  {isDisabling ? (
                    <BanIcon size={22} color={actionColor} strokeWidth={2} />
                  ) : (
                    <CheckCircleIcon size={22} color={actionColor} strokeWidth={2} />
                  )}
                </div>
                <p style={{ fontSize: "17px", fontWeight: 700, color: pal.mText, margin: "0 0 8px" }}>
                  {isDisabling ? t("Deshabilitar acceso") : t("Habilitar acceso")}
                </p>
                <p style={{ fontSize: "13px", color: pal.mTextMuted, margin: 0, lineHeight: 1.6 }}>
                  {isDisabling
                    ? <>{t("¿Deshabilitar el acceso de")} <span style={{ color: pal.mText, fontWeight: 600 }}>{confirmDelete.fullName}</span>?<br />{t("No podrá iniciar sesión hasta que se reactive su cuenta.")}</>
                    : <>{t("¿Habilitar nuevamente el acceso de")} <span style={{ color: pal.mText, fontWeight: 600 }}>{confirmDelete.fullName}</span>?<br />{t("Podrá volver a iniciar sesión en la plataforma.")}</>
                  }
                </p>
              </div>

              {/* User preview */}
              <div style={{
                margin: "18px 24px",
                padding: "12px 14px",
                background: pal.mElevated,
                border: `1px solid ${pal.mBorder}`,
                borderRadius: "12px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: confirmDelete.color, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 700, color: SURFACE.card,
                }}>
                  {confirmDelete.initials}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: pal.mText }}>{confirmDelete.fullName}</p>
                  <p style={{ margin: 0, fontSize: "12px", color: pal.mTextFaint }}>{confirmDelete.email}</p>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", padding: "0 24px 24px" }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: "11px",
                    background: pal.mElevated, border: `1px solid ${pal.mBorder}`,
                    borderRadius: "10px", fontSize: "14px", fontWeight: 600,
                    color: pal.mTextMuted, cursor: "pointer",
                  }}
                >
                  {t("Cancelar")}
                </button>
                <button
                  onClick={confirmAndToggleStatus}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: "11px",
                    background: deleting ? `${actionColor}4d` : actionGradient,
                    border: "none",
                    borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                    color: SURFACE.card, cursor: deleting ? "not-allowed" : "pointer",
                    boxShadow: deleting ? "none" : `0 4px 16px ${actionGlow}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}
                >
                  {deleting && (
                    <LoaderIcon size={13} strokeWidth={2.5} style={{ animation: "spin-slow 0.8s linear infinite" }} />
                  )}
                  {deleting
                    ? (isDisabling ? t("Deshabilitando...") : t("Habilitando..."))
                    : (isDisabling ? t("Sí, deshabilitar") : t("Sí, habilitar"))
                  }
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete user modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDeleteConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: SURFACE.card, borderRadius: "20px", width: "100%", maxWidth: "400px", padding: "28px", boxShadow: "0 8px 40px rgba(15,23,42,0.2)", textAlign: "center" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <TrashIcon size={24} color={STATE.danger} strokeWidth={2} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: SURFACE.text, margin: "0 0 8px" }}>{t("Eliminar usuario")}</h3>
            <p style={{ fontSize: "13px", color: SURFACE.textMuted, lineHeight: 1.5, margin: "0 0 6px" }}>
              {t("¿Estás seguro de eliminar a")} <strong style={{ color: SURFACE.text }}>{deleteConfirm.fullName}</strong>?
            </p>
            <p style={{ fontSize: "12px", color: STATE.danger, margin: "0 0 20px" }}>
              {t("Esta acción es irreversible. El usuario será eliminado de Supabase Auth.")}
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: "11px", borderRadius: "12px", border: `1px solid ${SURFACE.border}`, background: SURFACE.bg, color: SURFACE.textSecondary, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                {t("Cancelar")}
              </button>
              <button onClick={async () => {
                try {
                  await apiFetch(`/auth/users/${deleteConfirm.id}`, { method: "DELETE" });
                  setUsers((us) => us.filter((u) => u.id !== deleteConfirm.id));
                  setDeleteConfirm(null);
                } catch (e) {
                  alert(e instanceof Error ? e.message : t("Error eliminando usuario"));
                }
              }}
                style={{ flex: 1, padding: "11px", borderRadius: "12px", border: "none", background: `linear-gradient(135deg,${STATE.danger},${STATE.dangerText})`, color: SURFACE.card, fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(239,68,68,0.3)" }}>
                {t("Sí, eliminar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
