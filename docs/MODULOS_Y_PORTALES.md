# Módulos y Portales — Plataforma Seven Arena

**Versión:** 1.0 — Agosto 2026

Listado completo de los módulos de la plataforma de administración (tal como aparecen en el menú lateral) y de los portales de usuario final, con sus rutas y propósito.

---

## 1. Plataforma de administración (menú lateral)

### Dashboard

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Dashboard Comercial | `/dashboard/comercial` | Indicadores comerciales del evento |
| Dashboard Operacional | `/dashboard/operacional` | Indicadores operativos del día |

### Registro

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Registro Evento | `/registro/eventos` | Creación y configuración de eventos |
| Inscripción Participantes | `/registro/participantes` | Alta y validación de participantes (atletas, VIP, jefes) |
| Proveedores | `/registro/proveedores` | Proveedores y sus participantes (choferes, staff) con documentos |
| Clientes | `/clientes` | Tipos de cliente y su configuración |

### Operación → Arribos & Salidas

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| AND | `/operacion/and` | Planilla de llegadas y salidas (Arrivals & Departures) |
| Cumplimiento AND | `/operacion/cumplimiento-and` | Control del cumplimiento del plan AND |
| Monitor de Vuelos | `/operations/flights` | Vuelos en tiempo real, transfers vinculados y timeline clickeable |
| Monitoreo de Salidas | `/operacion/salidas` | Seguimiento de salidas de delegaciones |

### Operación → Transporte

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Operatividad Diaria | `/operations/daily-transport` | Gestión del día: cobertura, asignación automática, carga XLSX |
| Calendario Operacional | `/sports-calendar` | Calendario deportivo/operacional sincronizado |
| Tracking de Viajes | `/operations/vehicle-positions` | Mapa en tiempo real de vehículos en viaje |
| Viajes | `/operations/trips` | Listado y gestión completa de viajes |
| Solicitudes (T1/VIP) | `/operations/trip-requests` | Solicitudes de vehículo de VIPs y T1 |
| Flota (disponibilidad) | `/operations/fleet` | Disponibilidad de vehículos y flota VIP/T1 |
| Panel Conductores | `/operations/driver-heatmap` | Heatmap de carga horaria por conductor |
| Monitoreo de Conductores | `/operations/driver-monitoring` | Presencia y última posición de cada conductor |
| Monitoreo VIP | `/operations/vip-monitoring` | Tracking permanente de VIPs con ficha y timeline |
| Panel Financiero | `/operations/transport-finance` | Ingreso, costo y margen de la operación de transporte |

### Operación → Sede / Hotelería / Alimentación / Salud / Asistencia / Workforce

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Sede | `/sede` | Sedes (venues) del evento |
| Tracking Hotelería | `/operations/hotel-tracking` | Estado de check-in/out y ocupación |
| Hoteles / Villa Panamericana | `/masters/accommodations` | Maestro de hoteles |
| Habitaciones | `/masters/hotel-rooms` | Inventario de habitaciones |
| Asignaciones Hotel | `/operations/hotel-assignments` | Asignación de habitaciones a participantes |
| Gestión de llaves | `/operations/hotel-keys` | Entrega y devolución de llaves |
| Reserva de salones | `/operations/salones` | Reserva de salones y espacios comunes |
| Reserva de Extras | `/operations/hotel-extras` | Extras de hotel (coffee break, equipamiento) |
| Tipos de Alimentación | `/operations/food/tipos` | Tipos y restricciones dietarias |
| Desayuno / Almuerzos / Cenas | `/operations/food/{desayuno,almuerzos,cenas}` | Menús por servicio |
| Lugares de comida | `/operations/food/lugares` | Ubicaciones de alimentación |
| Salud | `/health` | Fichas de salud de participantes con detalle individual |
| Centro de Incidencias | `/operations/support-chats` | Chats de asistencia de todos los portales |
| Staff & Voluntarios | `/operations/workforce` | Personal operativo, productos y entregas |

### Deportes

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Planificación deportiva | `/deportes` | Deportes, disciplinas, pruebas y cupos |
| Premiaciones | `/deportes/premiaciones` | Ceremonias de premiación y equipos VIP |

### Beneficios

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Administrar beneficios | `/operations/coupons` | Cupones, partners (comercios) y reportería de canjes |
| Portal Partner | `/portal/partner` | Acceso directo al portal del comercio |

### Acreditación

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Acreditación | `/accreditations` | Flujo de acreditación y emisión de credenciales (incluye conductores de proveedor) |

### Portales (accesos directos)

| Módulo | Ruta |
|--------|------|
| Portal de usuario | `/portal/user` |
| Portal Conductor | `/portal/conductor` |
| Solicitud de vehículo | `/portal/vehicle-request` |
| Control de Acceso | `/portal/access-control` |

### Administración

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Gestión de Usuarios | `/admin/usuarios` | Usuarios admin, roles y módulos |
| Notificaciones Push | `/admin/notificaciones` | Envío manual de push a dispositivos registrados |
| Acciones de SofIA | `/operations/sofia-actions` | Auditoría de operaciones del asistente de IA |

### Otros

| Módulo | Ruta | Propósito |
|--------|------|-----------|
| Inicio guiado | `/inicio-guiado` | Recorrido de bienvenida por rol |
| Ayuda | `/ayuda` | Centro de ayuda y Cuaderno de Cargo |

---

## 2. Portales de usuario final

| Portal | URL | Quién lo usa | Autenticación | Funciones principales |
|--------|-----|--------------|---------------|------------------------|
| **Portal de usuario** | `/portal/user` | Participantes TA (atletas y jefes de delegación) | Código de 6 caracteres | Itinerario, actividades/viajes, calendario deportivo, sedes, alimentación, premiaciones, cupones, ficha de salud, credencial QR, cuenta (con eliminar cuenta) |
| **Solicitud de Vehículo** | `/portal/vehicle-request` | Participantes tipo **VIP** (el login de `/portal/user` redirige automáticamente) | Código de 6 caracteres | Solicitar vehículo, seguimiento del viaje con mapa, premiaciones, cupones, sedes/hoteles/comida, SofIA, credencial, cuenta (con eliminar cuenta) |
| **Portal Conductor** | `/portal/conductor` | Conductores propios y de proveedor (`isDriver`) | Código de 6 caracteres | Bandeja de viajes, flujo del viaje (iniciar → recoger con código → finalizar), tracking GPS, reportes/fotos de jornada, documentos, credencial, cuenta (con eliminar cuenta) |
| **Control de Acceso** | `/portal/access-control` | Staff de proveedores tipo **Staff** | Código de 6 caracteres | Escáner QR de credenciales con respuesta verde/rojo/amarillo y bitácora de accesos; eliminar cuenta |
| **Portal Partner** | `/portal/partner` | Comercios aliados de beneficios | Código de comercio + PIN (sesión de 12 h) | Escanear/canjear cupones, código manual, estadísticas de canje; eliminar cuenta |
| **Login móvil** | `/m/login` | Participantes y conductores desde la app nativa | Código de 6 caracteres | Resuelve automáticamente el portal según el código; recuperación por correo en `/m/recover` |
| **Credencial sin login** | `/credencial` | Operación en terreno | Enlace directo | Descarga del PDF de la credencial completa sin iniciar sesión |

### Reglas transversales de los portales

- **Código de acceso** = últimos 6 caracteres del ID del registro (participante, conductor o staff).
- **Sesión única por dispositivo**: una sola sesión activa por cuenta; la sesión existente manda.
- **Eliminar mi cuenta**: disponible en los cinco portales; soft delete reversible solo desde administración (badge ELIMINADA + botón Reactivar).
- **Notificaciones push + campana**: los avisos llegan al dispositivo y quedan en la bandeja del portal.
- **Asistencia**: chat de soporte disponible en todos los portales, atendido desde el Centro de Incidencias.
- **Idiomas**: español, inglés y portugués.
