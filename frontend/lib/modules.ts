// Catálogo de módulos del panel de administración — fuente única para
// Gestión de Usuarios (asignación) y Mi Cuenta (visualización). Los ids
// deben calzar con HREF_TO_MODULE de components/SideNav.tsx.

import type { IconName } from "@/components/ui/Icons";

export type AppModule = {
  id: string;
  label: string;
  group: string;
  /** Nombre del registro de iconos del kit (components/ui/Icons). */
  icon: IconName;
};

export const ALL_MODULES: AppModule[] = [
  { id: "dashboard.comercial", label: "Dashboard Comercial", group: "Dashboard", icon: "bar-chart" },
  { id: "dashboard.operacional", label: "Dashboard Operacional", group: "Dashboard", icon: "trending-up" },
  { id: "registro.eventos", label: "Registro de Eventos", group: "Registro", icon: "calendar" },
  { id: "registro.participantes", label: "Inscripción Participantes", group: "Registro", icon: "user" },
  { id: "operacion.and", label: "AND", group: "Operación", icon: "shield" },
  { id: "operacion.cumplimiento", label: "Cumplimiento AND", group: "Operación", icon: "check-circle" },
  { id: "operacion.tracking", label: "Tracking de Viajes", group: "Transporte", icon: "route" },
  { id: "operacion.viajes", label: "Viajes", group: "Transporte", icon: "bus" },
  { id: "operacion.scanner", label: "Escáner QR", group: "Transporte", icon: "qr-code" },
  // Módulo propio: el Panel Financiero expone tarifas de proveedores, costos
  // y consumo real, y no todo quien opera transporte debe verlos.
  { id: "operacion.finanzas", label: "Panel Financiero", group: "Transporte", icon: "banknote" },
  { id: "hoteleria.tracking", label: "Tracking Hotelería", group: "Hotelería", icon: "hotel" },
  { id: "hoteleria.hoteles", label: "Hoteles", group: "Hotelería", icon: "hotel" },
  { id: "hoteleria.habitaciones", label: "Habitaciones", group: "Hotelería", icon: "bed" },
  { id: "hoteleria.asignaciones", label: "Asignaciones Hotel", group: "Hotelería", icon: "clipboard" },
  { id: "hoteleria.llaves", label: "Gestión de Llaves", group: "Hotelería", icon: "key" },
  { id: "alimentacion.general", label: "Alimentación", group: "Alimentación", icon: "utensils" },
  { id: "workforce", label: "Staff & Voluntarios", group: "Operación", icon: "briefcase" },
  { id: "beneficios", label: "Beneficios", group: "Beneficios", icon: "ticket" },
  { id: "salud", label: "Salud", group: "Salud", icon: "heart-pulse" },
  { id: "clientes", label: "Clientes", group: "Clientes", icon: "handshake" },
  { id: "deportes", label: "Deportes", group: "Deportes", icon: "medal" },
  { id: "sede", label: "Sede", group: "Sede", icon: "map-pinned" },
  { id: "calendario", label: "Calendario Operacional", group: "Calendario", icon: "calendar-days" },
  { id: "acreditaciones", label: "Acreditaciones", group: "Acreditaciones", icon: "id-card" },
  { id: "documentos", label: "Documentos del Evento", group: "Documentos", icon: "file-text" },
  { id: "portales", label: "Portales", group: "Portales", icon: "globe" },
  { id: "admin.usuarios", label: "Gestión de Usuarios", group: "Administración", icon: "users" },
];

export const MODULE_GROUPS = [...new Set(ALL_MODULES.map((m) => m.group))];
