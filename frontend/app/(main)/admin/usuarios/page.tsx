"use client";

import { useState, useMemo, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { apiFetch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
type SupabaseUser = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  banned_until?: string | null;
  user_metadata: Record<string, string>;
};

type Role = "Administrador" | "Operador" | "Supervisor" | "Visualizador" | "Coordinador";
type UserStatus = "active" | "inactive" | "pending";

type AppModule = {
  id: string;
  label: string;
  group: string;
  icon: string;
};

type AppUser = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  modules: string[];
  status: UserStatus;
  createdAt: string;
  lastLogin?: string;
  initials: string;
  color: string;
};

// ── Module catalog ─────────────────────────────────────────────────────────
const ALL_MODULES: AppModule[] = [
  { id: "dashboard.comercial", label: "Dashboard Comercial", group: "Dashboard", icon: "📊" },
  { id: "dashboard.operacional", label: "Dashboard Operacional", group: "Dashboard", icon: "📈" },
  { id: "registro.eventos", label: "Registro de Eventos", group: "Registro", icon: "📅" },
  { id: "registro.participantes", label: "Inscripción Participantes", group: "Registro", icon: "👤" },
  { id: "operacion.and", label: "AND", group: "Operación", icon: "🛡️" },
  { id: "operacion.cumplimiento", label: "Cumplimiento AND", group: "Operación", icon: "✅" },
  { id: "operacion.tracking", label: "Tracking de Viajes", group: "Transporte", icon: "📍" },
  { id: "operacion.viajes", label: "Viajes", group: "Transporte", icon: "🚌" },
  { id: "operacion.scanner", label: "Escáner QR", group: "Transporte", icon: "🔍" },
  { id: "hoteleria.tracking", label: "Tracking Hotelería", group: "Hotelería", icon: "🏨" },
  { id: "hoteleria.hoteles", label: "Hoteles", group: "Hotelería", icon: "🏩" },
  { id: "hoteleria.habitaciones", label: "Habitaciones", group: "Hotelería", icon: "🛏️" },
  { id: "hoteleria.asignaciones", label: "Asignaciones Hotel", group: "Hotelería", icon: "🔑" },
  { id: "hoteleria.llaves", label: "Gestión de Llaves", group: "Hotelería", icon: "🗝️" },
  { id: "alimentacion.general", label: "Alimentación", group: "Alimentación", icon: "🍽️" },
  { id: "salud", label: "Salud", group: "Salud", icon: "🏥" },
  { id: "clientes", label: "Clientes", group: "Clientes", icon: "🤝" },
  { id: "deportes", label: "Deportes", group: "Deportes", icon: "🏅" },
  { id: "sede", label: "Sede", group: "Sede", icon: "📍" },
  { id: "calendario", label: "Calendario Deportivo", group: "Calendario", icon: "📆" },
  { id: "acreditaciones", label: "Acreditaciones", group: "Acreditaciones", icon: "🎫" },
  { id: "portales", label: "Portales", group: "Portales", icon: "🌐" },
  { id: "admin.usuarios", label: "Gestión de Usuarios", group: "Administración", icon: "👥" },
];

const MODULE_GROUPS = [...new Set(ALL_MODULES.map((m) => m.group))];

const ROLES: Role[] = ["Administrador", "Supervisor", "Coordinador", "Operador", "Visualizador"];

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  Administrador: ALL_MODULES.map((m) => m.id),
  Supervisor: ALL_MODULES.filter((m) => m.group !== "Administración").map((m) => m.id),
  Coordinador: ALL_MODULES.filter((m) => !["Dashboard", "Administración"].includes(m.group)).map((m) => m.id),
  Operador: ALL_MODULES.filter((m) => ["Operación", "Transporte", "Hotelería", "Alimentación", "Acreditaciones"].includes(m.group)).map((m) => m.id),
  Visualizador: ALL_MODULES.filter((m) => ["Dashboard", "Registro"].includes(m.group)).map((m) => m.id),
};

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_USERS: AppUser[] = [
  { id: "1", fullName: "Carlos Rodríguez", email: "carlos@sevenarana.com", role: "Administrador", modules: ROLE_PERMISSIONS["Administrador"], status: "active", createdAt: "2024-01-15", lastLogin: "hace 2 horas", initials: "CR", color: "#6366f1" },
  { id: "2", fullName: "Ana González", email: "ana@sevenarana.com", role: "Supervisor", modules: ROLE_PERMISSIONS["Supervisor"], status: "active", createdAt: "2024-02-20", lastLogin: "hace 1 día", initials: "AG", color: "#ec4899" },
  { id: "3", fullName: "Marco Silva", email: "marco@sevenarana.com", role: "Coordinador", modules: ROLE_PERMISSIONS["Coordinador"], status: "active", createdAt: "2024-03-10", lastLogin: "hace 3 días", initials: "MS", color: "#10b981" },
  { id: "4", fullName: "Valentina Torres", email: "valen@sevenarana.com", role: "Operador", modules: ROLE_PERMISSIONS["Operador"], status: "active", createdAt: "2024-04-05", lastLogin: "hoy", initials: "VT", color: "#f59e0b" },
  { id: "5", fullName: "Felipe Muñoz", email: "felipe@sevenarana.com", role: "Visualizador", modules: ROLE_PERMISSIONS["Visualizador"], status: "inactive", createdAt: "2024-05-12", lastLogin: "hace 2 semanas", initials: "FM", color: "#3b82f6" },
  { id: "6", fullName: "Daniela Pérez", email: "dani@sevenarana.com", role: "Operador", modules: ROLE_PERMISSIONS["Operador"], status: "pending", createdAt: "2024-06-01", initials: "DP", color: "#8b5cf6" },
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

// ── Empty form ─────────────────────────────────────────────────────────────
function emptyForm() {
  return {
    fullName: "",
    email: "",
    role: "Operador" as Role,
    modules: ROLE_PERMISSIONS["Operador"],
    tempPassword: generateTempPassword(),
    status: "active" as UserStatus,
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function UsuariosPage() {
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const isObsidian = theme === "obsidian";
  const isAtlas = theme === "atlas";
  const isLight = theme === "light";

  const pal = isObsidian ? {
    panelBg: "linear-gradient(135deg, #070d1c 0%, #0d1b35 100%)",
    titleColor: "#e2e8f0",
    accent: "#22d3ee",
    accent2: "#a855f7",
    inputBg: "rgba(255,255,255,0.06)",
    inputColor: "#e2e8f0",
    inputBorder: "rgba(34,211,238,0.15)",
    orb1: "rgba(34,211,238,0.15)",
    orb2: "rgba(168,85,247,0.12)",
    kpiGlow: "rgba(34,211,238,0.3)",
    rowHover: "rgba(34,211,238,0.04)",
    tableBorder: "rgba(34,211,238,0.08)",
    headerBg: "rgba(34,211,238,0.06)",
    modalBg: "#070d1c",
    modalBorder: "rgba(34,211,238,0.15)",
    mText: "#e2e8f0",
    mTextMuted: "rgba(255,255,255,0.55)",
    mTextFaint: "rgba(255,255,255,0.28)",
    mElevated: "rgba(255,255,255,0.06)",
    mBorder: "rgba(34,211,238,0.12)",
  } : isAtlas ? {
    panelBg: "linear-gradient(135deg, #1c2333 0%, #243047 100%)",
    titleColor: "#e2e8f0",
    accent: "#6481f0",
    accent2: "#38bdf8",
    inputBg: "rgba(255,255,255,0.07)",
    inputColor: "#e2e8f0",
    inputBorder: "rgba(100,129,240,0.2)",
    orb1: "rgba(100,129,240,0.2)",
    orb2: "rgba(56,189,248,0.15)",
    kpiGlow: "rgba(100,129,240,0.35)",
    rowHover: "rgba(100,129,240,0.05)",
    tableBorder: "rgba(100,129,240,0.1)",
    headerBg: "rgba(100,129,240,0.08)",
    modalBg: "#1c2333",
    modalBorder: "rgba(100,129,240,0.2)",
    mText: "#e2e8f0",
    mTextMuted: "rgba(255,255,255,0.55)",
    mTextFaint: "rgba(255,255,255,0.28)",
    mElevated: "rgba(255,255,255,0.07)",
    mBorder: "rgba(100,129,240,0.15)",
  } : isDark ? {
    panelBg: "linear-gradient(135deg, #07101f 0%, #0d1b3e 100%)",
    titleColor: "#f1f5f9",
    accent: "#c9a84c",
    accent2: "#6481f0",
    inputBg: "rgba(255,255,255,0.07)",
    inputColor: "#f1f5f9",
    inputBorder: "rgba(201,168,76,0.2)",
    orb1: "rgba(30,58,138,0.6)",
    orb2: "rgba(201,168,76,0.15)",
    kpiGlow: "rgba(201,168,76,0.4)",
    rowHover: "rgba(201,168,76,0.04)",
    tableBorder: "rgba(255,255,255,0.05)",
    headerBg: "rgba(255,255,255,0.04)",
    modalBg: "#07101f",
    modalBorder: "rgba(201,168,76,0.15)",
    mText: "#f1f5f9",
    mTextMuted: "rgba(255,255,255,0.55)",
    mTextFaint: "rgba(255,255,255,0.28)",
    mElevated: "rgba(255,255,255,0.07)",
    mBorder: "rgba(255,255,255,0.1)",
  } : {
    panelBg: "linear-gradient(135deg, #1e3a6e 0%, #1e4ed8 100%)",
    titleColor: "#f8fafc",
    accent: "#1e4ed8",
    accent2: "#7c3aed",
    inputBg: "rgba(255,255,255,0.15)",
    inputColor: "#f8fafc",
    inputBorder: "rgba(255,255,255,0.25)",
    orb1: "rgba(30,78,216,0.15)",
    orb2: "rgba(124,58,237,0.1)",
    kpiGlow: "rgba(30,78,216,0.3)",
    rowHover: "rgba(30,78,216,0.04)",
    tableBorder: "rgba(30,78,216,0.08)",
    headerBg: "rgba(30,78,216,0.05)",
    modalBg: "#ffffff",
    modalBorder: "rgba(30,78,216,0.15)",
    mText: "#1e293b",
    mTextMuted: "#64748b",
    mTextFaint: "#94a3b8",
    mElevated: "#f1f5f9",
    mBorder: "#e2e8f0",
  };

  const sel: React.CSSProperties = { background: pal.inputBg, color: pal.inputColor, border: `1px solid ${pal.inputBorder}` };
  const selFlat: React.CSSProperties = { background: "var(--elevated)", color: "var(--text)", border: "1px solid var(--border)" };
  // Inside modal: use explicit pal colors (not CSS vars) since modal has explicit dark bg
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
  const [deleting, setDeleting] = useState(false);

  // ── Load users from API ───────────────────────────────────────────────
  useEffect(() => {
    apiFetch<{ users: SupabaseUser[] }>("/auth/users")
      .then(({ users: raw }) => {
        const mapped: AppUser[] = raw.map((u, i) => ({
          id: u.id,
          fullName: u.user_metadata?.name || u.email?.split("@")[0] || "Sin nombre",
          email: u.email || "",
          role: (u.user_metadata?.role as Role) || "Operador",
          modules: ROLE_PERMISSIONS[(u.user_metadata?.role as Role) || "Operador"] || [],
          status: u.banned_until ? "inactive" : "active",
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
    setForm({ fullName: user.fullName, email: user.email, role: user.role, modules: user.modules, tempPassword: generateTempPassword(), status: user.status });
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
    if (!form.fullName || !form.email) return;
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
            password: form.tempPassword,
          }),
        });
        setUsers((us) => us.map((u) => u.id === editingUser.id ? { ...u, ...form } : u));
      } else {
        // Create: register via backend → Supabase Auth
        const result = await apiFetch<{ user: SupabaseUser }>("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.fullName,
            email: form.email,
            password: form.tempPassword,
            role: form.role,
          }),
        });
        const newUser: AppUser = {
          id: result.user.id,
          fullName: form.fullName,
          email: form.email,
          role: form.role,
          modules: form.modules,
          status: form.status,
          createdAt: new Date().toISOString().split("T")[0],
          initials: getInitials(form.fullName),
          color: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
        };
        setUsers((us) => [...us, newUser]);
      }
      setShowModal(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar el usuario");
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
      alert(err instanceof Error ? err.message : "Error al actualizar el usuario");
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
    if (role === "Administrador") return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", color: "#ef4444" };
    if (role === "Supervisor") return { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", color: "#f97316" };
    if (role === "Coordinador") return { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", color: "#10b981" };
    if (role === "Operador") return { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", color: "#3b82f6" };
    return { bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.3)", color: "#64748b" };
  }

  function statusInfo(s: UserStatus) {
    if (s === "active") return { label: "Activo", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    if (s === "inactive") return { label: "Inactivo", color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
    return { label: "Pendiente", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  }

  const inputCls: React.CSSProperties = {
    ...sel,
    padding: "10px 14px",
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  };

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: "0 0 60px", minHeight: "100vh" }}>

      {/* ── Command Panel ───────────────────────────────────────────── */}
      <div style={{ padding: "28px 40px 0" }}>
      <div style={{
        background: pal.panelBg,
        padding: "36px 40px 32px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "24px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        marginBottom: "28px",
      }}>
        {/* Orbs */}
        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: `radial-gradient(ellipse, ${pal.orb1} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-40px", left: "30%", width: "200px", height: "200px", borderRadius: "50%", background: `radial-gradient(ellipse, ${pal.orb2} 0%, transparent 70%)`, pointerEvents: "none" }} />

        {/* Grid texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", marginBottom: "14px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: pal.accent, boxShadow: `0 0 10px ${pal.accent}`, animation: "pulse 2s ease-in-out infinite", display: "inline-block" }} />
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: pal.accent, opacity: 0.85 }}>
              Administración del Sistema
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, color: pal.titleColor, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                Gestión de Usuarios
              </h1>
              <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                Administra accesos, roles y permisos del sistema
              </p>
            </div>

            {/* Create button */}
            <button
              onClick={openCreate}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "12px 22px",
                background: `linear-gradient(135deg, ${pal.accent}, ${pal.accent2 ?? pal.accent})`,
                color: isLight ? "#fff" : "#0d1b3e",
                border: "none", borderRadius: "12px",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
                boxShadow: `0 4px 20px ${pal.kpiGlow}`,
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${pal.kpiGlow}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 20px ${pal.kpiGlow}`; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nuevo Usuario
            </button>
          </div>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginTop: "28px" }}>
            {[
              { label: "Total Usuarios", value: kpis.total, icon: "👥", color: pal.accent },
              { label: "Activos", value: kpis.active, icon: "✅", color: "#22c55e" },
              { label: "Administradores", value: kpis.admins, icon: "🔐", color: "#ef4444" },
              { label: "Pendientes", value: kpis.pending, icon: "⏳", color: "#f59e0b" },
            ].map((k) => (
              <div key={k.label} style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderTop: `3px solid ${k.color}`,
                borderRadius: "12px",
                padding: "16px",
                backdropFilter: "blur(12px)",
                transition: "all 200ms ease",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "20px" }}>{k.icon}</span>
                  <span style={{
                    fontSize: "28px", fontWeight: 800, color: k.color,
                    textShadow: `0 0 20px ${k.color}80`,
                    lineHeight: 1,
                  }}>{k.value}</span>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0, fontWeight: 500 }}>{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div style={{ padding: "0 40px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
          {(["usuarios", "roles"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px",
                background: "none", border: "none",
                borderBottom: activeTab === tab ? `2px solid ${pal.accent}` : "2px solid transparent",
                color: activeTab === tab ? pal.accent : "var(--text-muted)",
                fontSize: "14px", fontWeight: activeTab === tab ? 700 : 500,
                cursor: "pointer", transition: "all 150ms", marginBottom: "-1px",
                textTransform: "capitalize",
              }}
            >
              {tab === "usuarios" ? "👥 Usuarios" : "🔑 Roles y Permisos"}
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
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", pointerEvents: "none" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Buscar usuarios..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ ...selFlat, padding: "10px 14px 10px 38px", borderRadius: "10px", fontSize: "13.5px", outline: "none", width: "100%" }}
                />
              </div>

              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as Role | "")}
                style={{ ...selFlat, padding: "10px 14px", borderRadius: "10px", fontSize: "13.5px", outline: "none", minWidth: "160px" }}
              >
                <option value="">Todos los roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as UserStatus | "")}
                style={{ ...selFlat, padding: "10px 14px", borderRadius: "10px", fontSize: "13.5px", outline: "none", minWidth: "150px" }}
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="pending">Pendientes</option>
              </select>

              <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {filtered.length} usuario{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table */}
            <div style={{
              border: `1px solid ${pal.tableBorder}`,
              borderRadius: "16px",
              overflow: "hidden",
              background: "var(--surface)",
            }}>
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
                  <span key={h} style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-faint)" }}>{h}</span>
                ))}
              </div>

              {loadingUsers ? (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                  Cargando usuarios...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>
                  No hay usuarios que coincidan con los filtros
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
                          fontSize: "13px", fontWeight: 700, color: "#fff",
                          flexShrink: 0,
                          boxShadow: `0 2px 8px ${user.color}60`,
                        }}>
                          {user.initials}
                        </div>
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)", margin: 0 }}>{user.fullName}</p>
                          {user.lastLogin && <p style={{ fontSize: "11.5px", color: "var(--text-faint)", margin: "1px 0 0" }}>Último: {user.lastLogin}</p>}
                        </div>
                      </div>

                      {/* Email */}
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>{user.email}</p>

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
                        {user.role}
                      </span>

                      {/* Modules */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          fontSize: "14px", fontWeight: 700,
                          color: pal.accent,
                        }}>
                          {user.modules.length}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>
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
                        <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: 500 }}>{si.label}</span>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openEdit(user)}
                          style={{
                            background: "var(--elevated)", border: "1px solid var(--border)",
                            borderRadius: "8px", padding: "6px",
                            cursor: "pointer", color: "var(--text-muted)",
                            transition: "all 150ms",
                          }}
                          title="Editar"
                          onMouseEnter={(e) => { e.currentTarget.style.color = pal.accent; e.currentTarget.style.borderColor = pal.accent; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(user)}
                          style={{
                            background: "var(--elevated)", border: "1px solid var(--border)",
                            borderRadius: "8px", padding: "6px",
                            cursor: "pointer",
                            color: user.status === "active" ? "var(--text-muted)" : "#22c55e",
                            transition: "all 150ms",
                          }}
                          title={user.status === "active" ? "Deshabilitar acceso" : "Habilitar acceso"}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = user.status === "active" ? "#ef4444" : "#22c55e";
                            e.currentTarget.style.borderColor = user.status === "active" ? "#ef4444" : "#22c55e";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = user.status === "active" ? "var(--text-muted)" : "#22c55e";
                            e.currentTarget.style.borderColor = "var(--border)";
                          }}
                        >
                          {user.status === "active" ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
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
                  background: "var(--surface)",
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
                      }}>{role}</span>
                      <span style={{
                        fontSize: "12px", color: "var(--text-faint)", fontWeight: 500,
                      }}>
                        {roleUsers.length} usuario{roleUsers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                      {perms.length} de {ALL_MODULES.length} módulos habilitados
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
                            textTransform: "uppercase", color: "var(--text-faint)",
                            margin: "0 0 6px",
                          }}>{group}</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {enabledInGroup.map((m) => (
                              <span key={m.id} style={{
                                display: "inline-flex", alignItems: "center", gap: "4px",
                                padding: "3px 9px",
                                background: `${rc.color}12`,
                                border: `1px solid ${rc.color}25`,
                                borderRadius: "100px",
                                fontSize: "11px", color: "var(--text-muted)", fontWeight: 500,
                              }}>
                                {m.icon} {m.label}
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
                              border: "2px solid var(--surface)",
                              marginLeft: i > 0 ? "-8px" : "0",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "10px", fontWeight: 700, color: "#fff",
                              flexShrink: 0,
                            }}>
                              {u.initials}
                            </div>
                          ))}
                        </div>
                        {roleUsers.length > 4 && (
                          <span style={{ fontSize: "11px", color: "var(--text-faint)" }}>+{roleUsers.length - 4} más</span>
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
                  {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
                </h2>
                <p style={{ fontSize: "13px", color: pal.mTextMuted, margin: 0 }}>
                  {editingUser ? "Modifica los datos y permisos del usuario" : "Crea una cuenta y asigna accesos al sistema"}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: pal.mElevated, border: `1px solid ${pal.mBorder}`, borderRadius: "10px", padding: "8px", cursor: "pointer", color: pal.mTextMuted, transition: "all 150ms" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = pal.mText; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = pal.mTextMuted; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "22px" }}>

              {/* Basic info */}
              <div>
                <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: "0 0 14px" }}>
                  Información personal
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      placeholder="Nombre Apellido"
                      style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="email@ejemplo.com"
                      style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                    />
                  </div>
                </div>
              </div>

              {/* Role + Status */}
              <div>
                <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: "0 0 14px" }}>
                  Rol y estado
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>Rol</label>
                    <select
                      value={form.role}
                      onChange={(e) => handleRoleChange(e.target.value as Role)}
                      style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, color: pal.mTextMuted, marginBottom: "6px" }}>Estado</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}
                      style={{ ...selM, padding: "10px 14px", borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%" }}
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                      <option value="pending">Pendiente</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Temp password */}
              <div>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: "0 0 14px" }}>
                    {editingUser ? "Restablecer contraseña" : "Contraseña temporal"}
                  </h3>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showTempPassword ? "text" : "password"}
                      value={form.tempPassword}
                      readOnly
                      style={{
                        ...selM,
                        padding: "11px 80px 11px 14px",
                        borderRadius: "10px", fontSize: "14px", outline: "none", width: "100%",
                        fontFamily: "monospace", letterSpacing: "0.05em",
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
                        title="Copiar"
                        style={{ background: "none", border: "none", cursor: "pointer", color: copiedPwd ? "#22c55e" : pal.mTextMuted, padding: "2px", transition: "color 150ms" }}
                      >
                        {copiedPwd ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, tempPassword: generateTempPassword() }))}
                        title="Regenerar"
                        style={{ background: "none", border: "none", cursor: "pointer", color: pal.mTextMuted, padding: "2px", transition: "color 150ms" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = pal.mText}
                        onMouseLeave={(e) => e.currentTarget.style.color = pal.mTextMuted}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: "11.5px", color: pal.mTextFaint, margin: "6px 0 0" }}>
                    {editingUser
                      ? "Generá una nueva contraseña y compartila con el usuario."
                      : "Esta contraseña temporal debe ser cambiada en el primer inicio de sesión."}
                  </p>
              </div>

              {/* Module assignment */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pal.mTextFaint, margin: 0 }}>
                    Módulos asignados
                  </h3>
                  <span style={{
                    fontSize: "12px", fontWeight: 600,
                    color: pal.accent,
                  }}>
                    {form.modules.length} / {ALL_MODULES.length} seleccionados
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
                              {allSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isLight ? "#fff" : "#0d1b3e"} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              {someSelected && !allSelected && <div style={{ width: 8, height: 2, background: pal.accent, borderRadius: "1px" }} />}
                            </div>
                            <span style={{ fontSize: "13.5px", fontWeight: 600, color: pal.mText }}>{group}</span>
                            <span style={{
                              fontSize: "11px",
                              padding: "2px 7px",
                              borderRadius: "100px",
                              background: allSelected ? `${pal.accent}22` : isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)",
                              color: allSelected ? pal.accent : pal.mTextFaint,
                              fontWeight: 600,
                            }}>
                              {groupModules.filter((m) => form.modules.includes(m.id)).length}/{groupModules.length}
                            </span>
                          </div>
                          <svg
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pal.mTextFaint} strokeWidth="2"
                            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
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
                                  onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = checked ? `${pal.accent}10` : "transparent"; }}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: "4px",
                                    background: checked ? pal.accent : "transparent",
                                    border: `1.5px solid ${checked ? pal.accent : pal.mBorder}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0, transition: "all 150ms",
                                  }}>
                                    {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={isLight ? "#fff" : "#0d1b3e"} strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                                  </div>
                                  <span style={{ fontSize: "14px" }}>{m.icon}</span>
                                  <span style={{ fontSize: "13px", color: checked ? pal.mText : pal.mTextMuted, fontWeight: checked ? 500 : 400, transition: "color 150ms" }}>
                                    {m.label}
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
                color: "#fca5a5",
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
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.fullName || !form.email || saving}
                style={{
                  padding: "10px 24px",
                  background: (!form.fullName || !form.email || saving) ? "rgba(100,116,139,0.3)" : `linear-gradient(135deg, ${pal.accent}, ${pal.accent2 ?? pal.accent})`,
                  border: "none",
                  borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                  color: (!form.fullName || !form.email || saving) ? "rgba(100,116,139,0.6)" : (isLight ? "#fff" : "#0d1b3e"),
                  cursor: (!form.fullName || !form.email || saving) ? "not-allowed" : "pointer",
                  transition: "all 150ms",
                  boxShadow: (!form.fullName || !form.email || saving) ? "none" : `0 4px 16px ${pal.kpiGlow}`,
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                {saving && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin-slow 0.8s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                )}
                {saving ? "Creando..." : (editingUser ? "Guardar cambios" : "Crear usuario")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ─────────────────────────────────────── */}
      {confirmDelete && (() => {
        const isDisabling = confirmDelete.status === "active";
        const actionColor = isDisabling ? "#ef4444" : "#22c55e";
        const actionColorLight = isDisabling ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)";
        const actionColorBorder = isDisabling ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)";
        const actionGlow = isDisabling ? "rgba(239,68,68,0.35)" : "rgba(34,197,94,0.35)";
        const actionGradient = isDisabling
          ? "linear-gradient(135deg, #ef4444, #dc2626)"
          : "linear-gradient(135deg, #22c55e, #16a34a)";
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
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={actionColor} strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={actionColor} strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  )}
                </div>
                <p style={{ fontSize: "17px", fontWeight: 700, color: pal.mText, margin: "0 0 8px" }}>
                  {isDisabling ? "Deshabilitar acceso" : "Habilitar acceso"}
                </p>
                <p style={{ fontSize: "13px", color: pal.mTextMuted, margin: 0, lineHeight: 1.6 }}>
                  {isDisabling
                    ? <>¿Deshabilitar el acceso de <span style={{ color: pal.mText, fontWeight: 600 }}>{confirmDelete.fullName}</span>?<br />No podrá iniciar sesión hasta que se reactive su cuenta.</>
                    : <>¿Habilitar nuevamente el acceso de <span style={{ color: pal.mText, fontWeight: 600 }}>{confirmDelete.fullName}</span>?<br />Podrá volver a iniciar sesión en la plataforma.</>
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
                  fontSize: "13px", fontWeight: 700, color: "#fff",
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
                  Cancelar
                </button>
                <button
                  onClick={confirmAndToggleStatus}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: "11px",
                    background: deleting ? `${actionColor}4d` : actionGradient,
                    border: "none",
                    borderRadius: "10px", fontSize: "14px", fontWeight: 700,
                    color: "#fff", cursor: deleting ? "not-allowed" : "pointer",
                    boxShadow: deleting ? "none" : `0 4px 16px ${actionGlow}`,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  }}
                >
                  {deleting && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin-slow 0.8s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  )}
                  {deleting
                    ? (isDisabling ? "Deshabilitando..." : "Habilitando...")
                    : (isDisabling ? "Sí, deshabilitar" : "Sí, habilitar")
                  }
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
