// Catálogo de módulos del panel de administración — fuente única para
// Gestión de Usuarios (asignación) y Mi Cuenta (visualización). Los ids
// deben calzar con HREF_TO_MODULE de components/SideNav.tsx.

export type AppModule = {
  id: string;
  label: string;
  group: string;
  icon: string;
};

export const ALL_MODULES: AppModule[] = [
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
  { id: "workforce", label: "Staff & Voluntarios", group: "Operación", icon: "🧑‍💼" },
  { id: "beneficios", label: "Beneficios", group: "Beneficios", icon: "🎟️" },
  { id: "salud", label: "Salud", group: "Salud", icon: "🏥" },
  { id: "clientes", label: "Clientes", group: "Clientes", icon: "🤝" },
  { id: "deportes", label: "Deportes", group: "Deportes", icon: "🏅" },
  { id: "sede", label: "Sede", group: "Sede", icon: "📍" },
  { id: "calendario", label: "Calendario Operacional", group: "Calendario", icon: "📆" },
  { id: "acreditaciones", label: "Acreditaciones", group: "Acreditaciones", icon: "🎫" },
  { id: "documentos", label: "Documentos del Evento", group: "Documentos", icon: "📄" },
  { id: "portales", label: "Portales", group: "Portales", icon: "🌐" },
  { id: "admin.usuarios", label: "Gestión de Usuarios", group: "Administración", icon: "👥" },
];

export const MODULE_GROUPS = [...new Set(ALL_MODULES.map((m) => m.group))];
