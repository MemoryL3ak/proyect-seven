"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────
   Estilos custom (keyframes, glass, glow, gradients)
   ───────────────────────────────────────────────────────────── */
const CUSTOM_STYLES = `
  @keyframes ob-float-particle {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
    33% { transform: translate(8px, -12px) scale(1.15); opacity: 0.9; }
    66% { transform: translate(-6px, 8px) scale(0.95); opacity: 0.7; }
  }
  @keyframes ob-shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes ob-gradient-flow {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes ob-pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(33,208,179,0.5); }
    70% { box-shadow: 0 0 0 14px rgba(33,208,179,0); }
    100% { box-shadow: 0 0 0 0 rgba(33,208,179,0); }
  }
  @keyframes ob-bounce-in {
    0% { transform: scale(0.3); opacity: 0; }
    50% { transform: scale(1.08); }
    70% { transform: scale(0.95); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes ob-confetti-fall {
    0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
  }
  @keyframes ob-sparkle {
    0%, 100% { opacity: 0; transform: scale(0); }
    50% { opacity: 1; transform: scale(1); }
  }
  @keyframes ob-stagger-fade {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes ob-orbit {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .ob-particle {
    position: absolute; pointer-events: none; border-radius: 50%;
    animation: ob-float-particle 6s ease-in-out infinite;
  }
  .ob-shimmer-text {
    background: linear-gradient(90deg, #34F3C6 0%, #21D0B3 30%, #34F3C6 50%, #21D0B3 70%, #34F3C6 100%);
    background-size: 200% auto;
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: ob-gradient-flow 5s ease infinite;
  }
  .ob-stagger > * { animation: ob-stagger-fade 480ms cubic-bezier(0.4,0,0.2,1) backwards; }
  .ob-stagger > *:nth-child(1) { animation-delay: 60ms; }
  .ob-stagger > *:nth-child(2) { animation-delay: 130ms; }
  .ob-stagger > *:nth-child(3) { animation-delay: 200ms; }
  .ob-stagger > *:nth-child(4) { animation-delay: 270ms; }
  .ob-stagger > *:nth-child(5) { animation-delay: 340ms; }
  .ob-stagger > *:nth-child(6) { animation-delay: 410ms; }
  .ob-role-card { position: relative; isolation: isolate; }
  .ob-role-card::before {
    content: ""; position: absolute; inset: -1.5px; border-radius: 18px; z-index: -1;
    background: var(--ob-gradient, transparent);
    opacity: 0; transition: opacity 240ms ease;
  }
  .ob-role-card.is-selected::before {
    opacity: 1;
    animation: ob-gradient-flow 4s ease infinite;
    background-size: 300% 300%;
  }
  .ob-confetti {
    position: fixed; top: -10px; width: 8px; height: 14px;
    pointer-events: none; z-index: 9999;
    animation: ob-confetti-fall 3s linear forwards;
  }
  .ob-sparkle {
    position: absolute; pointer-events: none;
    animation: ob-sparkle 2.2s ease-in-out infinite;
  }
  .ob-bounce-in { animation: ob-bounce-in 600ms cubic-bezier(0.34,1.56,0.64,1) both; }
  .ob-pulse-ring { animation: ob-pulse-ring 2s ease-out infinite; }
  .ob-orbit-ring {
    position: absolute; border-radius: 50%;
    border: 1.5px dashed rgba(33,208,179,0.35);
    animation: ob-orbit 18s linear infinite;
  }
  .ob-tilt { transition: transform 220ms cubic-bezier(0.2,0.9,0.3,1.2); }
  .ob-tilt:hover { transform: translateY(-4px) scale(1.012); }
`;

/* ─────────────────────────────────────────────────────────────
   Tipos
   ───────────────────────────────────────────────────────────── */
type RoleKey = "admin" | "transport" | "hotel" | "accreditation" | "operations" | "other";
type GoalKey =
  | "create_event"
  | "import_athletes"
  | "manage_users"
  | "view_dashboard"
  | "import_schedule"
  | "auto_assign"
  | "monitor_drivers"
  | "tracking_realtime"
  | "setup_hotels"
  | "assign_rooms"
  | "manage_keys"
  | "hotel_extras"
  | "generate_credentials"
  | "qr_scanner"
  | "manage_access"
  | "monitor_incidents"
  | "premiaciones"
  | "coupons"
  | "workforce";

type WizardState = {
  step: number;
  role: RoleKey | null;
  goals: GoalKey[];
  completed: string[];
  name: string;
  startedAt?: string;
};

const STORAGE_KEY = "seven.onboarding.state";

const EMPTY: WizardState = {
  step: 0,
  role: null,
  goals: [],
  completed: [],
  name: "",
};

/* ─────────────────────────────────────────────────────────────
   Datos: roles, objetivos, tareas, tips, recursos
   ───────────────────────────────────────────────────────────── */
const ROLES: Array<{
  key: RoleKey;
  label: string;
  desc: string;
  color: string;
  bgGradient: string;
  iconBg: string;
  suggested: GoalKey[];
  icon: React.ReactNode;
}> = [
  {
    key: "admin",
    label: "Administrador general",
    desc: "Acceso total a la plataforma: eventos, usuarios, presupuestos y configuración.",
    color: "#5e3aab",
    bgGradient: "linear-gradient(135deg, #f4f0fb 0%, #ffffff 60%)",
    iconBg: "linear-gradient(135deg, #7c5ec4 0%, #5e3aab 100%)",
    suggested: ["create_event", "import_athletes", "manage_users", "view_dashboard"],
    icon: (
      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <linearGradient id="ob-admin-1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <path d="M16 3l10 5v6c0 7-4.5 11-10 12-5.5-1-10-5-10-12V8l10-5z" fill="url(#ob-admin-1)" stroke="currentColor" />
        <path d="M11 15.5l3.5 3.5L21 12.5" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="16" cy="6.5" r="1.5" fill="currentColor" stroke="none" opacity="0.6" />
        <circle cx="9" cy="10" r="0.8" fill="currentColor" stroke="none" opacity="0.4" />
        <circle cx="23" cy="10" r="0.8" fill="currentColor" stroke="none" opacity="0.4" />
      </svg>
    ),
  },
  {
    key: "transport",
    label: "Coordinador de transporte",
    desc: "Cronograma diario, asignación de choferes, tracking en tiempo real y panel de conductores.",
    color: "#1f4e8c",
    bgGradient: "linear-gradient(135deg, #eef4fb 0%, #ffffff 60%)",
    iconBg: "linear-gradient(135deg, #2d6aa8 0%, #1f4e8c 100%)",
    suggested: ["import_schedule", "auto_assign", "monitor_drivers", "tracking_realtime"],
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="10" width="18" height="13" rx="2" fill="rgba(255,255,255,0.18)" stroke="currentColor" />
        <path d="M21 13h6l4 5v5h-10v-10z" fill="rgba(255,255,255,0.12)" stroke="currentColor" />
        <circle cx="9" cy="26" r="3" fill="rgba(0,0,0,0.25)" stroke="currentColor" />
        <circle cx="9" cy="26" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="25" cy="26" r="3" fill="rgba(0,0,0,0.25)" stroke="currentColor" />
        <circle cx="25" cy="26" r="1.2" fill="currentColor" stroke="none" />
        <rect x="6" y="14" width="6" height="5" rx="0.8" fill="rgba(255,255,255,0.35)" stroke="none" />
        <circle cx="32" cy="6" r="2.4" fill="#fbbf24" stroke="currentColor" strokeWidth="1.2" />
        <line x1="32" y1="3.5" x2="32" y2="8.5" stroke="currentColor" strokeWidth="0.7" opacity="0.7" />
      </svg>
    ),
  },
  {
    key: "hotel",
    label: "Coordinador de hotelería",
    desc: "Configuración de hoteles, asignación de habitaciones, gestión de llaves y servicios extras.",
    color: "#ec4899",
    bgGradient: "linear-gradient(135deg, #fce7f3 0%, #ffffff 60%)",
    iconBg: "linear-gradient(135deg, #f472b6 0%, #ec4899 100%)",
    suggested: ["setup_hotels", "assign_rooms", "manage_keys", "hotel_extras"],
    icon: (
      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 28V8a2 2 0 012-2h18a2 2 0 012 2v20" fill="rgba(255,255,255,0.18)" stroke="currentColor" />
        <rect x="9" y="10" width="3.5" height="3" rx="0.4" fill="#fbbf24" stroke="none" opacity="0.9" />
        <rect x="14.5" y="10" width="3.5" height="3" rx="0.4" fill="#fbbf24" stroke="none" opacity="0.4" />
        <rect x="20" y="10" width="3.5" height="3" rx="0.4" fill="#fbbf24" stroke="none" opacity="0.9" />
        <rect x="9" y="15" width="3.5" height="3" rx="0.4" fill="#fbbf24" stroke="none" opacity="0.6" />
        <rect x="14.5" y="15" width="3.5" height="3" rx="0.4" fill="#fbbf24" stroke="none" opacity="0.9" />
        <rect x="20" y="15" width="3.5" height="3" rx="0.4" fill="#fbbf24" stroke="none" opacity="0.4" />
        <rect x="13" y="20" width="6" height="8" rx="0.6" fill="rgba(0,0,0,0.2)" stroke="currentColor" />
        <circle cx="17" cy="24" r="0.6" fill="currentColor" stroke="none" />
        <path d="M3 28h26" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: "accreditation",
    label: "Encargado de acreditación",
    desc: "Generación de credenciales QR, escáner en puertas, control de tipos de acceso.",
    color: "#10b981",
    bgGradient: "linear-gradient(135deg, #e7f5ec 0%, #ffffff 60%)",
    iconBg: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
    suggested: ["generate_credentials", "qr_scanner", "manage_access"],
    icon: (
      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="24" height="20" rx="2" fill="rgba(255,255,255,0.15)" stroke="currentColor" />
        <circle cx="11" cy="14" r="3.2" fill="rgba(255,255,255,0.4)" stroke="currentColor" />
        <path d="M6.5 22c1-2.5 3-4 4.5-4s3.5 1.5 4.5 4" stroke="currentColor" />
        <rect x="17" y="11" width="8" height="1.4" rx="0.6" fill="currentColor" opacity="0.9" />
        <rect x="17" y="14" width="6" height="1.4" rx="0.6" fill="currentColor" opacity="0.7" />
        <rect x="17" y="17" width="7" height="1.4" rx="0.6" fill="currentColor" opacity="0.5" />
        <rect x="17" y="20" width="4" height="1.4" rx="0.6" fill="currentColor" opacity="0.3" />
        <rect x="13" y="2" width="6" height="4" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="14.5" y="3.2" width="3" height="1.6" rx="0.4" fill="rgba(255,255,255,0.8)" stroke="none" />
      </svg>
    ),
  },
  {
    key: "operations",
    label: "Supervisor operativo",
    desc: "Vista panorámica de la operación, incidencias, premiaciones y workforce.",
    color: "#f59e0b",
    bgGradient: "linear-gradient(135deg, #fff4d6 0%, #ffffff 60%)",
    iconBg: "linear-gradient(135deg, #fbbf24 0%, #d97706 100%)",
    suggested: ["view_dashboard", "monitor_incidents", "premiaciones", "workforce"],
    icon: (
      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="26" height="20" rx="2" fill="rgba(255,255,255,0.12)" stroke="currentColor" />
        <line x1="3" y1="9" x2="29" y2="9" stroke="currentColor" opacity="0.7" />
        <circle cx="6" cy="6" r="0.9" fill="currentColor" />
        <rect x="6" y="13" width="4" height="7" rx="0.6" fill="#34d399" stroke="none" />
        <rect x="11.5" y="11" width="4" height="9" rx="0.6" fill="#fbbf24" stroke="none" />
        <rect x="17" y="14" width="4" height="6" rx="0.6" fill="#fb7185" stroke="none" />
        <polyline points="6,16 11,12 17,15 23,10 27,13" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" fill="none" />
        <circle cx="27" cy="13" r="1.4" fill="rgba(255,255,255,0.95)" stroke="none" />
        <path d="M11 27l5-3 5 3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    key: "other",
    label: "Otro perfil",
    desc: "Quiero explorar libremente todos los módulos de la plataforma.",
    color: "#64748b",
    bgGradient: "linear-gradient(135deg, #f1f5f9 0%, #ffffff 60%)",
    iconBg: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
    suggested: ["view_dashboard", "coupons", "premiaciones", "workforce"],
    icon: (
      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="12" fill="rgba(255,255,255,0.15)" stroke="currentColor" />
        <polygon points="16,8 20,17 16,15 12,17" fill="#fbbf24" stroke="currentColor" strokeWidth="1.2" />
        <polygon points="16,24 12,15 16,17 20,15" fill="rgba(255,255,255,0.65)" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="16" cy="16" r="1.6" fill="currentColor" stroke="rgba(255,255,255,0.95)" strokeWidth="1.2" />
        <line x1="16" y1="2" x2="16" y2="4" stroke="currentColor" opacity="0.5" />
        <line x1="16" y1="28" x2="16" y2="30" stroke="currentColor" opacity="0.5" />
        <line x1="2" y1="16" x2="4" y2="16" stroke="currentColor" opacity="0.5" />
        <line x1="28" y1="16" x2="30" y2="16" stroke="currentColor" opacity="0.5" />
      </svg>
    ),
  },
];

const GOALS: Array<{ key: GoalKey; label: string; emoji: string; tags: RoleKey[] }> = [
  { key: "create_event",         label: "Crear y configurar evento",          emoji: "📅", tags: ["admin"] },
  { key: "import_athletes",      label: "Importar participantes desde Excel", emoji: "👥", tags: ["admin"] },
  { key: "manage_users",         label: "Crear cuentas de usuario",           emoji: "🛡️", tags: ["admin"] },
  { key: "view_dashboard",       label: "Ver dashboards y métricas",          emoji: "📊", tags: ["admin", "operations", "other"] },
  { key: "import_schedule",      label: "Importar planilla de viajes diaria", emoji: "📄", tags: ["transport"] },
  { key: "auto_assign",          label: "Asignar conductores automáticamente",emoji: "⚙️", tags: ["transport"] },
  { key: "monitor_drivers",      label: "Monitorear conductores activos",     emoji: "🚗", tags: ["transport", "operations"] },
  { key: "tracking_realtime",    label: "Tracking GPS en tiempo real",        emoji: "📍", tags: ["transport", "operations"] },
  { key: "setup_hotels",         label: "Configurar hoteles y habitaciones",  emoji: "🏨", tags: ["hotel"] },
  { key: "assign_rooms",         label: "Asignar habitaciones a atletas",     emoji: "🛏️", tags: ["hotel"] },
  { key: "manage_keys",          label: "Gestionar entrega de llaves",        emoji: "🔑", tags: ["hotel"] },
  { key: "hotel_extras",         label: "Reservar salones y servicios",       emoji: "✨", tags: ["hotel"] },
  { key: "generate_credentials", label: "Generar credenciales QR",            emoji: "🪪", tags: ["accreditation", "admin"] },
  { key: "qr_scanner",           label: "Escanear QR en accesos",             emoji: "📱", tags: ["accreditation"] },
  { key: "manage_access",        label: "Configurar tipos de acceso",         emoji: "🔐", tags: ["accreditation"] },
  { key: "monitor_incidents",    label: "Resolver incidencias y soporte",     emoji: "🆘", tags: ["operations"] },
  { key: "premiaciones",         label: "Coordinar premiaciones",             emoji: "🏆", tags: ["operations"] },
  { key: "coupons",              label: "Administrar cupones y partners",     emoji: "🎟️", tags: ["operations", "other"] },
  { key: "workforce",            label: "Gestionar staff y voluntarios",      emoji: "👷", tags: ["operations"] },
];

type Task = {
  key: string;
  title: string;
  description: string;
  href: string;
  goal: GoalKey;
  optional?: boolean;
};

const TASKS: Task[] = [
  // Admin
  { key: "t-event", title: "Configurar el evento principal", description: "Definí nombre, fechas, sede y disciplinas. Es el contenedor de toda la operación.", href: "/registro/eventos", goal: "create_event" },
  { key: "t-athletes-import", title: "Importar participantes", description: "Subí el Excel con atletas. Descargá la plantilla desde la sección de Inscripción.", href: "/registro/participantes", goal: "import_athletes" },
  { key: "t-users", title: "Crear cuentas para tu equipo", description: "Asigná roles (Admin, Supervisor, Operador, Coordinador) y módulos por usuario.", href: "/admin/usuarios", goal: "manage_users" },
  { key: "t-dashboard", title: "Revisar dashboards", description: "Comercial (presupuestos) y Operacional (viajes/hoteles/salud en tiempo real).", href: "/dashboard/operacional", goal: "view_dashboard" },

  // Transporte
  { key: "t-daily", title: "Importar planilla operativa", description: "Subí el Excel del cronograma diario. Descargá la plantilla con el formato esperado.", href: "/operations/daily-transport", goal: "import_schedule" },
  { key: "t-assign", title: "Auto-asignar conductores", description: "Corré la asignación con restricciones (tipo flota, cliente, capacidad, sillas de ruedas).", href: "/operations/daily-transport", goal: "auto_assign" },
  { key: "t-monitor", title: "Monitorear conductores conectados", description: "Ver quién tiene la app abierta, su GPS en vivo y los viajes activos.", href: "/operations/driver-monitoring", goal: "monitor_drivers" },
  { key: "t-tracking", title: "Tracking en vivo de viajes", description: "Mapa con todos los vehículos en ruta, alertas de retrasos y GPS atrasado.", href: "/operations/vehicle-positions", goal: "tracking_realtime" },

  // Hotelería
  { key: "t-hotels", title: "Cargar hoteles y habitaciones", description: "Definí los alojamientos del evento, las habitaciones disponibles y sus tipos.", href: "/masters/accommodations", goal: "setup_hotels" },
  { key: "t-rooms", title: "Asignar habitaciones", description: "Distribuí atletas en habitaciones — individual o automática por tipo.", href: "/operations/hotel-assignments", goal: "assign_rooms" },
  { key: "t-keys", title: "Entregar llaves con firma", description: "Registrá entregas y devoluciones de llaves con firma digital.", href: "/operations/hotel-keys", goal: "manage_keys" },
  { key: "t-extras", title: "Reservar salones y extras", description: "Coordina salones para reuniones y servicios adicionales (lavandería, gym).", href: "/operations/hotel-extras", goal: "hotel_extras" },

  // Acreditación
  { key: "t-credentials", title: "Emitir credenciales QR", description: "Generá credenciales personalizadas con QR para cada participante.", href: "/accreditations", goal: "generate_credentials" },
  { key: "t-scanner", title: "Configurar el scanner de acceso", description: "El portal de control de acceso lee QR y valida permisos en tiempo real.", href: "/portal/access-control", goal: "qr_scanner" },
  { key: "t-access", title: "Definir tipos de acceso", description: "Campo (C), Tribuna (TR), Hotel (H), Reuniones (R), Restringidas (A), Dirección (RD).", href: "/accreditations", goal: "manage_access" },

  // Operaciones
  { key: "t-incidents", title: "Centro de incidencias", description: "Recibí, asigná y resolvé tickets de soporte de los portales.", href: "/operations/support-chats", goal: "monitor_incidents" },
  { key: "t-premiaciones", title: "Calendario de premiaciones", description: "Agendá ceremonias, asigná entregadores y confirmá asistencia.", href: "/operations/premiaciones", goal: "premiaciones" },
  { key: "t-coupons", title: "Catálogo de cupones", description: "Definí beneficios, partners y revisá los canjes desde el portal del comercio.", href: "/operations/coupons", goal: "coupons" },
  { key: "t-workforce", title: "Gestionar workforce", description: "Personal contratado, voluntariado, catálogo del kit y entregas validadas.", href: "/operations/workforce", goal: "workforce" },
];

const TIPS_BY_ROLE: Record<RoleKey, Array<{ icon: string; text: string }>> = {
  admin: [
    { icon: "🤖", text: "SofIA puede crear viajes, asignar choferes y generar reportes con solo pedírselo en lenguaje natural." },
    { icon: "🔑", text: "Cada usuario ve solo los módulos asignados. Configurás esto en Administración → Gestión de Usuarios." },
    { icon: "📈", text: "El dashboard comercial se actualiza solo cuando ingresás los montos licitados de los conductores." },
  ],
  transport: [
    { icon: "📥", text: "En 'Operatividad Diaria' tenés un botón para descargar la plantilla con todas las columnas que reconoce el importador." },
    { icon: "⚙️", text: "La auto-asignación respeta tipo de flota, capacidad, sillas de ruedas, ventana horaria y máx. viajes por chofer." },
    { icon: "📍", text: "El portal del conductor usa Wake Lock para mantener el GPS activo aunque la pantalla se apague." },
  ],
  hotel: [
    { icon: "🛏️", text: "Podés asignar habitaciones manualmente o usar la asignación automática por tipo de habitación." },
    { icon: "✍️", text: "La entrega de llaves queda registrada con firma digital — útil para auditorías." },
    { icon: "📅", text: "Early/late check-in se gestiona desde la misma ficha de la asignación, sin doble entrada." },
  ],
  accreditation: [
    { icon: "📷", text: "El scanner funciona desde cualquier celular con cámara, sin instalar nada." },
    { icon: "🟢", text: "El QR muestra en verde/rojo si el acceso al área es válido en tiempo real." },
    { icon: "🛡️", text: "Cada credencial puede combinar múltiples tipos de acceso (C+TR+H, por ejemplo)." },
  ],
  operations: [
    { icon: "🆘", text: "El Centro de Incidencias recibe tickets de los portales (conductor, atleta) y los podés asignar al equipo." },
    { icon: "🏆", text: "Las premiaciones tienen estados (Programada/Realizada) y soportan multi-entregador con confirmación." },
    { icon: "🖨️", text: "En Workforce podés imprimir códigos de barra de los productos del kit para inventario." },
  ],
  other: [
    { icon: "🌐", text: "Cambiá el idioma en la parte inferior del menú lateral — soporta ES/EN/PT." },
    { icon: "🌙", text: "4 temas visuales disponibles: Light, Dark, Obsidian y Atlas." },
    { icon: "💬", text: "El widget de SofIA en la esquina inferior derecha responde cualquier consulta operativa." },
  ],
};

const RESOURCES = [
  { icon: "📚", title: "Centro de Ayuda", desc: "Módulos, FAQ y Cuaderno de Cargo filtrable.", href: "/ayuda" },
  { icon: "📄", title: "Manual completo (PDF)", desc: "Documento descargable con toda la operación detallada.", href: "/ayuda/manual" },
  { icon: "💬", title: "SofIA — asistente IA", desc: "Pídele acciones, predicciones o resúmenes en lenguaje natural.", href: "/dashboard/operacional" },
  { icon: "📞", title: "Soporte técnico", desc: "Si el equipo se queda atorado, contactalos directo.", href: "mailto:soporte@sevenarena.cl" },
];

/* ─────────────────────────────────────────────────────────────
   Sub-componentes
   ───────────────────────────────────────────────────────────── */
function StepIndicator({ current, total, onJump }: { current: number; total: number; onJump?: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= current;
        return (
          <button
            key={i}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onJump?.(i)}
            title={`Paso ${i + 1}`}
            className={`rounded-full transition-all ${active ? "ob-pulse-ring" : ""}`}
            style={{
              width: active ? 32 : done ? 10 : 8,
              height: active ? 10 : done ? 10 : 8,
              background: done
                ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
                : active
                ? "linear-gradient(135deg, #34F3C6 0%, #21D0B3 100%)"
                : "rgba(241,245,249,0.25)",
              boxShadow: active
                ? "0 0 14px rgba(33,208,179,0.7), 0 2px 8px rgba(33,208,179,0.4)"
                : done ? "0 2px 6px rgba(33,208,179,0.3)" : "none",
              border: "none",
              padding: 0,
              cursor: reachable ? "pointer" : "not-allowed",
              transition: "width 280ms cubic-bezier(0.4,0,0.2,1), background 200ms, box-shadow 200ms",
            }}
          />
        );
      })}
    </div>
  );
}

/** Confetti pieces for completion step */
function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#21D0B3", "#34F3C6", "#fbbf24", "#f472b6", "#7c5ec4", "#34d399"];
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2.4 + Math.random() * 1.4,
      color: colors[i % colors.length],
      width: 6 + Math.random() * 6,
      height: 10 + Math.random() * 8,
      rotate: Math.random() * 360,
    }));
  }, []);
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="ob-confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.width, height: p.height,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
            borderRadius: 2,
          }}
        />
      ))}
    </>
  );
}

function RoleCard({
  role,
  selected,
  onClick,
}: {
  role: (typeof ROLES)[number];
  selected: boolean;
  onClick: () => void;
}) {
  const gradient = `linear-gradient(135deg, ${role.color}, ${role.color}aa, ${role.color})`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ob-role-card ob-tilt text-left rounded-2xl p-4 transition-all ${selected ? "is-selected" : ""}`}
      style={{
        ["--ob-gradient" as any]: gradient,
        background: selected ? role.bgGradient : "#ffffff",
        border: `2px solid ${selected ? "transparent" : "#e2e8f0"}`,
        boxShadow: selected
          ? `0 16px 32px ${role.color}33, 0 2px 6px rgba(15,23,42,0.1)`
          : "0 1px 3px rgba(15,23,42,0.06)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = `${role.color}80`;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 10px 22px ${role.color}14`;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(15,23,42,0.06)";
        }
      }}
    >
      <div className="flex items-start gap-3 relative">
        {/* Icon wrap con anillo orbital cuando seleccionado */}
        <div className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
          {selected && (
            <>
              <div className="ob-orbit-ring" style={{ inset: -4, borderColor: `${role.color}55` }} />
              <div className="ob-sparkle" style={{ top: -6, right: -4, color: role.color, animationDelay: "0s" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" /></svg>
              </div>
              <div className="ob-sparkle" style={{ bottom: 4, left: -8, color: role.color, animationDelay: "0.8s" }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" /></svg>
              </div>
            </>
          )}
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${selected ? "ob-bounce-in" : ""}`}
            style={{
              background: role.iconBg,
              color: "#fff",
              boxShadow: selected
                ? `0 10px 24px ${role.color}66, 0 0 0 4px ${role.color}1a, inset 0 1px 0 rgba(255,255,255,0.3)`
                : `0 6px 16px ${role.color}33, inset 0 1px 0 rgba(255,255,255,0.25)`,
              position: "absolute", top: 3, left: 3,
              transition: "box-shadow 280ms",
            }}
          >
            {role.icon}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[15px] font-bold leading-tight" style={{ color: "#0f172a" }}>
              {role.label}
            </p>
            {selected && (
              <span
                className="inline-flex items-center justify-center rounded-full ob-bounce-in"
                style={{
                  width: 22, height: 22,
                  background: `linear-gradient(135deg, ${role.color} 0%, ${role.color}dd 100%)`,
                  color: "#fff",
                  boxShadow: `0 4px 12px ${role.color}66`,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </div>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {role.desc}
          </p>
          {selected && (
            <div className="mt-2 flex flex-wrap gap-1">
              {role.suggested.slice(0, 3).map((g) => {
                const goal = GOALS.find((x) => x.key === g);
                if (!goal) return null;
                return (
                  <span key={g} className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5"
                    style={{ background: `${role.color}18`, color: role.color, border: `1px solid ${role.color}30` }}>
                    <span>{goal.emoji}</span>{goal.label}
                  </span>
                );
              })}
              {role.suggested.length > 3 && (
                <span className="text-[10px] font-semibold" style={{ color: role.color }}>
                  +{role.suggested.length - 3} más
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function GoalChip({
  label,
  emoji,
  selected,
  onClick,
}: {
  label: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-all"
      style={{
        background: selected
          ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
          : "#ffffff",
        color: selected ? "#fff" : "#334155",
        border: `1.5px solid ${selected ? "#15B09A" : "#e2e8f0"}`,
        boxShadow: selected
          ? "0 6px 16px rgba(33,208,179,0.30), inset 0 1px 0 rgba(255,255,255,0.2)"
          : "0 1px 3px rgba(15,23,42,0.05)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(33,208,179,0.5)";
          (e.currentTarget as HTMLElement).style.background = "#f0fdfb";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
          (e.currentTarget as HTMLElement).style.background = "#ffffff";
        }
      }}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      {label}
      {selected && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function TaskRow({
  task,
  done,
  onToggle,
}: {
  task: Task;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{
        background: done
          ? "linear-gradient(135deg, #f0fdfb 0%, #ffffff 70%)"
          : "#ffffff",
        border: `1px solid ${done ? "#34d39966" : "#e2e8f0"}`,
        opacity: done ? 0.85 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5"
          style={{
            width: 24, height: 24, borderRadius: 8,
            background: done
              ? "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)"
              : "transparent",
            border: `2px solid ${done ? "#15B09A" : "#cbd5e1"}`,
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "all 180ms",
            boxShadow: done ? "0 3px 10px rgba(33,208,179,0.3)" : "none",
          }}
        >
          {done && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className="text-[14px] font-bold leading-tight"
            style={{
              color: done ? "#475569" : "#0f172a",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {task.description}
          </p>
        </div>
        <Link
          href={task.href}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition-all"
          style={{
            background: done ? "transparent" : "linear-gradient(135deg, #21D0B3 0%, #15B09A 100%)",
            color: done ? "#1eb19a" : "#fff",
            border: done ? "1px solid #34d39966" : "none",
            boxShadow: done ? "none" : "0 4px 14px rgba(33,208,179,0.32)",
            textDecoration: "none",
          }}
        >
          {done ? "Ir igual" : "Ir ahora"}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente principal
   ───────────────────────────────────────────────────────────── */
export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Restaurar estado de localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as WizardState;
        setState({ ...EMPTY, ...s });
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persistir
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const TOTAL_STEPS = 5; // 0..4 (sin contar el welcome 0)

  const setRole = (role: RoleKey) => {
    const selected = ROLES.find((r) => r.key === role);
    setState((s) => ({
      ...s,
      role,
      goals: selected?.suggested.slice() ?? [],
      startedAt: s.startedAt || new Date().toISOString(),
    }));
  };

  const toggleGoal = (g: GoalKey) => {
    setState((s) => ({
      ...s,
      goals: s.goals.includes(g) ? s.goals.filter((x) => x !== g) : [...s.goals, g],
    }));
  };

  const toggleTask = (key: string) => {
    setState((s) => ({
      ...s,
      completed: s.completed.includes(key) ? s.completed.filter((x) => x !== key) : [...s.completed, key],
    }));
  };

  const next = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, TOTAL_STEPS) }));
  const prev = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 0) }));
  const reset = () => setState({ ...EMPTY, name: state.name });

  const role = ROLES.find((r) => r.key === state.role);
  const relevantTasks = useMemo(
    () => TASKS.filter((t) => state.goals.includes(t.goal)),
    [state.goals],
  );
  const progressTasks = useMemo(
    () => relevantTasks.filter((t) => state.completed.includes(t.key)).length,
    [relevantTasks, state.completed],
  );

  // Estimación dinámica de tiempo restante según paso y selecciones
  // (debe declararse ANTES de cualquier return condicional para mantener
  // el orden de los hooks estable entre renders)
  const estMinutes = useMemo(() => {
    if (state.step >= 5) return 0;
    const base = [3, 2.5, 2, 1.5, 1][state.step] ?? 1;
    const extra = Math.max(0, (relevantTasks.length - progressTasks)) * 0.2;
    return Math.max(1, Math.round(base + extra));
  }, [state.step, relevantTasks.length, progressTasks]);

  if (!hydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <style jsx global>{CUSTOM_STYLES}</style>

      {/* Confetti en el paso final */}
      {state.step === 5 && <Confetti />}

      {/* Header inmersivo */}
      <section
        className="rounded-3xl p-7 relative overflow-hidden anim-fade-up-soft"
        style={{
          background: "linear-gradient(135deg, #020c18 0%, #062240 50%, #041a2e 100%)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        {/* Grilla decorativa */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(33,208,179,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(33,208,179,0.06) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }} />
        {/* Orbs */}
        <div style={{
          position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(33,208,179,0.20) 0%, transparent 65%)", filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: -60, left: "20%", width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,160,23,0.16) 0%, transparent 65%)", filter: "blur(36px)",
        }} />

        {/* Partículas flotantes */}
        {[
          { top: "12%", left: "8%",  size: 6, color: "#21D0B3", delay: "0s" },
          { top: "22%", left: "30%", size: 4, color: "#34F3C6", delay: "1s" },
          { top: "60%", left: "12%", size: 5, color: "#21D0B3", delay: "2s" },
          { top: "32%", left: "60%", size: 3, color: "#fbbf24", delay: "1.5s" },
          { top: "75%", left: "55%", size: 5, color: "#34F3C6", delay: "0.5s" },
          { top: "18%", left: "85%", size: 4, color: "#fbbf24", delay: "2.5s" },
          { top: "65%", left: "88%", size: 6, color: "#21D0B3", delay: "1.8s" },
        ].map((p, i) => (
          <span key={i} className="ob-particle"
            style={{
              top: p.top, left: p.left,
              width: p.size, height: p.size,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              animationDelay: p.delay,
            }} />
        ))}

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2"
              style={{ background: "rgba(33,208,179,0.12)", border: "1px solid rgba(33,208,179,0.28)", borderRadius: 99, padding: "4px 12px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#21D0B3", boxShadow: "0 0 10px #21D0B3", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#21D0B3" }}>
                Inicio guiado
              </span>
              {estMinutes > 0 && (
                <span className="inline-flex items-center gap-1"
                  style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "rgba(241,245,249,0.65)", marginLeft: 6, paddingLeft: 8, borderLeft: "1px solid rgba(33,208,179,0.3)" }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  ~{estMinutes} min
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: "#f1f5f9", letterSpacing: "-0.02em" }}>
              {state.step === 0
                ? <>Bienvenido a <span className="ob-shimmer-text">Seven Arena</span></>
                : state.step === 1 ? "Contanos qué hacés"
                : state.step === 2 ? "Tus objetivos iniciales"
                : state.step === 3 ? "Tu plan de arranque"
                : state.step === 4 ? "Tips y recursos"
                : <span className="ob-shimmer-text">¡Todo listo!</span>}
            </h1>
            <p className="mt-1.5 text-sm md:text-base max-w-xl" style={{ color: "rgba(241,245,249,0.65)" }}>
              {state.step === 0 && "Te llevamos en menos de 3 minutos por los módulos que necesitás. Personalizado, sin manuales."}
              {state.step === 1 && "Vamos a recomendarte tareas y atajos según tu rol — podés cambiarlo después en cualquier momento."}
              {state.step === 2 && "Elegí lo que querés resolver primero. Las tareas se ajustan a tu selección."}
              {state.step === 3 && `Estos son tus próximos pasos. Marcá cada uno cuando lo termines — guardamos tu progreso.`}
              {state.step === 4 && "Trucos para que aproveches al máximo la plataforma."}
              {state.step === 5 && "Tenés todo lo que necesitás. Volvé acá cuando quieras revisar tu progreso."}
            </p>
          </div>

          <div className="text-right">
            <StepIndicator
              current={state.step}
              total={TOTAL_STEPS + 1}
              onJump={(i) => setState((s) => ({ ...s, step: i }))}
            />
            <p className="text-[11px] mt-2 font-semibold" style={{ color: "rgba(241,245,249,0.5)", letterSpacing: "0.04em" }}>
              Paso {state.step + 1} de {TOTAL_STEPS + 1}
            </p>
          </div>
        </div>
      </section>

      {/* Contenido del paso */}
      <section className="surface-premium p-6 relative overflow-hidden anim-fade-up-soft">

        {/* Paso 0 — Bienvenida */}
        {state.step === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ob-stagger">
              {[
                { icon: "⚡", title: "3 minutos",        text: "Lo que dura este recorrido — adaptado a vos.",       accent: "#fbbf24", bg: "linear-gradient(135deg, #fff4d6 0%, #ffffff 70%)" },
                { icon: "🎯", title: "Personalizado",    text: "Las recomendaciones cambian según tu rol y objetivos.", accent: "#21D0B3", bg: "linear-gradient(135deg, #f0fdfb 0%, #ffffff 70%)" },
                { icon: "💾", title: "Progreso guardado",text: "Cerrás y volvés cuando quieras — todo queda registrado.", accent: "#7c5ec4", bg: "linear-gradient(135deg, #f4f0fb 0%, #ffffff 70%)" },
              ].map((b) => (
                <div key={b.title} className="ob-tilt rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: b.bg, border: `1px solid ${b.accent}40`, boxShadow: `0 2px 8px ${b.accent}18` }}>
                  <div style={{
                    position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%",
                    background: `radial-gradient(circle, ${b.accent}30 0%, transparent 65%)`, pointerEvents: "none",
                  }} />
                  <span className="text-3xl relative">{b.icon}</span>
                  <p className="text-sm font-bold mt-2 relative" style={{ color: "#0f172a" }}>{b.title}</p>
                  <p className="text-xs mt-1 relative" style={{ color: "var(--text-muted)" }}>{b.text}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(135deg, #f0fdfb 0%, #ffffff 70%)",
                border: "1px solid rgba(33,208,179,0.25)",
              }}>
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#1eb19a" }}>
                ¿Cómo te llamamos?
              </label>
              <input
                type="text"
                placeholder="Tu nombre (opcional)"
                value={state.name}
                onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
                style={{
                  marginTop: 6, width: "100%", padding: "10px 14px",
                  borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff",
                  fontSize: 14, color: "#0f172a", outline: "none",
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => router.push("/dashboard/operacional")}
                className="btn btn-ghost">
                Saltar el tour
              </button>
              <button type="button" onClick={next}
                className="btn btn-primary text-base px-6 py-3 inline-flex items-center gap-2">
                Empezar
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Paso 1 — Rol */}
        {state.step === 1 && (
          <div className="space-y-5">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {state.name ? `Hola ${state.name}, ` : ""}
              ¿Cuál es tu rol principal en el evento?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ob-stagger">
              {ROLES.map((r) => (
                <RoleCard key={r.key} role={r} selected={state.role === r.key} onClick={() => setRole(r.key)} />
              ))}
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={prev} className="btn btn-ghost">← Atrás</button>
              <button type="button" onClick={next} disabled={!state.role}
                className="btn btn-primary inline-flex items-center gap-2">
                Continuar
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Paso 2 — Objetivos */}
        {state.step === 2 && (
          <div className="space-y-5">
            {role && (
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: role.iconBg, color: "#fff" }}>
                  {role.icon}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: role.color }}>
                    Tu rol
                  </p>
                  <p className="text-sm font-bold" style={{ color: "#0f172a" }}>{role.label}</p>
                </div>
                <button type="button" onClick={prev}
                  className="text-xs underline ml-auto"
                  style={{ color: "var(--text-muted)" }}>
                  Cambiar
                </button>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#1eb19a" }}>
                Sugeridos para tu rol
              </p>
              <div className="flex flex-wrap gap-2">
                {GOALS.filter((g) => role && g.tags.includes(role.key)).map((g) => (
                  <GoalChip key={g.key} label={g.label} emoji={g.emoji}
                    selected={state.goals.includes(g.key)}
                    onClick={() => toggleGoal(g.key)} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--text-muted)" }}>
                Otros que podrías necesitar
              </p>
              <div className="flex flex-wrap gap-2">
                {GOALS.filter((g) => !role || !g.tags.includes(role.key)).map((g) => (
                  <GoalChip key={g.key} label={g.label} emoji={g.emoji}
                    selected={state.goals.includes(g.key)}
                    onClick={() => toggleGoal(g.key)} />
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={prev} className="btn btn-ghost">← Atrás</button>
              <div className="inline-flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {state.goals.length} {state.goals.length === 1 ? "seleccionado" : "seleccionados"}
                </span>
                <button type="button" onClick={next} disabled={state.goals.length === 0}
                  className="btn btn-primary inline-flex items-center gap-2">
                  Ver mi plan
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3 — Plan de tareas */}
        {state.step === 3 && (
          <div className="space-y-5">
            {/* Barra de progreso */}
            <div className="rounded-2xl p-4"
              style={{
                background: "linear-gradient(135deg, #f0fdfb 0%, #ffffff 70%)",
                border: "1px solid rgba(33,208,179,0.25)",
              }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold" style={{ color: "#0f172a" }}>
                  Tu progreso
                </p>
                <span className="text-[13px] font-bold tabular-nums"
                  style={{ color: "#1eb19a" }}>
                  {progressTasks} / {relevantTasks.length}
                </span>
              </div>
              <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${relevantTasks.length > 0 ? (progressTasks / relevantTasks.length) * 100 : 0}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #34F3C6 0%, #21D0B3 100%)",
                    borderRadius: 999,
                    transition: "width 400ms cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: "0 0 12px rgba(33,208,179,0.5)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2.5 ob-stagger">
              {relevantTasks.map((t) => (
                <TaskRow
                  key={t.key}
                  task={t}
                  done={state.completed.includes(t.key)}
                  onToggle={() => toggleTask(t.key)}
                />
              ))}
              {relevantTasks.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
                  No seleccionaste objetivos. <button type="button" onClick={prev}
                    className="underline font-semibold" style={{ color: "#1eb19a" }}>
                    Volver atrás
                  </button> para elegir.
                </p>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={prev} className="btn btn-ghost">← Atrás</button>
              <button type="button" onClick={next} className="btn btn-primary inline-flex items-center gap-2">
                Ver tips
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Paso 4 — Tips + Recursos */}
        {state.step === 4 && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "#1eb19a" }}>
                Tips para tu rol
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ob-stagger">
                {(TIPS_BY_ROLE[state.role || "other"] || []).map((tip, i) => (
                  <div key={i} className="rounded-2xl p-4"
                    style={{
                      background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                      border: "1px solid #e2e8f0",
                    }}>
                    <span className="text-2xl">{tip.icon}</span>
                    <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "#334155" }}>
                      {tip.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "#d4a017" }}>
                Recursos a mano
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ob-stagger">
                {RESOURCES.map((r) => {
                  const isExternal = r.href.startsWith("mailto:");
                  const inner = (
                    <div className="rounded-2xl p-4 transition-all flex items-start gap-3"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(33,208,179,0.5)";
                        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 20px rgba(15,23,42,0.08)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
                        (e.currentTarget as HTMLElement).style.transform = "none";
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      <span className="text-2xl flex-shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: "#0f172a" }}>{r.title}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{r.desc}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  );
                  return isExternal ? (
                    <a key={r.title} href={r.href} style={{ textDecoration: "none" }}>{inner}</a>
                  ) : (
                    <Link key={r.title} href={r.href} style={{ textDecoration: "none" }}>{inner}</Link>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button type="button" onClick={prev} className="btn btn-ghost">← Atrás</button>
              <button type="button" onClick={next} className="btn btn-primary inline-flex items-center gap-2">
                Finalizar
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Paso 5 — Cierre */}
        {state.step === 5 && (
          <div className="space-y-6 text-center py-6">
            <div className="inline-flex items-center justify-center mx-auto rounded-full"
              style={{
                width: 96, height: 96,
                background: "linear-gradient(135deg, #34F3C6 0%, #21D0B3 50%, #15B09A 100%)",
                boxShadow: "0 12px 36px rgba(33,208,179,0.4), inset 0 2px 0 rgba(255,255,255,0.3)",
              }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: "#0f172a" }}>
                {state.name ? `¡Listo, ${state.name}!` : "¡Estás listo!"}
              </h2>
              <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
                Configuraste tu rol como <strong style={{ color: role?.color }}>{role?.label}</strong>{" "}
                con {state.goals.length} objetivo{state.goals.length === 1 ? "" : "s"}.
                Completaste {progressTasks} de {relevantTasks.length} tareas iniciales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
              <Link href="/dashboard/operacional" className="btn btn-primary py-3"
                style={{ textDecoration: "none" }}>
                Ir al dashboard
              </Link>
              <Link href="/ayuda" className="btn btn-ghost py-3"
                style={{ textDecoration: "none" }}>
                Centro de Ayuda
              </Link>
              <button type="button" onClick={reset} className="btn btn-ghost py-3">
                Reiniciar guía
              </button>
            </div>

            {progressTasks < relevantTasks.length && (
              <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                Quedaron {relevantTasks.length - progressTasks} tareas pendientes —
                <button type="button" onClick={() => setState((s) => ({ ...s, step: 3 }))}
                  className="ml-1 underline font-semibold" style={{ color: "#1eb19a" }}>
                  retomalas cuando quieras
                </button>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
