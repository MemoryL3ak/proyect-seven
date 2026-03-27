"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

// ── Print styles injected via a style tag ────────────────────────────────────
const PRINT_CSS = `
  @media print {
    html, body { margin: 0; padding: 0; background: #fff !important; color: #000 !important; }
    #manual-topbar { display: none !important; }
    #manual-body { padding: 0 !important; max-width: 100% !important; }
    .page-break { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
    a { color: inherit !important; text-decoration: none !important; }
    .print-hide { display: none !important; }
    .print-show { display: block !important; }
    @page { margin: 20mm 18mm; size: A4; }
  }
  @media screen {
    .print-show { display: none !important; }
  }
`;

// ── Types ────────────────────────────────────────────────────────────────────
type Locale = "es" | "en" | "pt";
type Subsection = { title: string; content: string };
type Section = { num: string; title: string; icon: string; content: string; subsections: Subsection[] };

// ── Data ─────────────────────────────────────────────────────────────────────
const SECTIONS_ES: Section[] = [
  {
    num: "1",
    title: "Introducción a Seven Arena",
    icon: "🏟️",
    content: `Seven Arena es una plataforma integral de gestión de eventos deportivos. Centraliza en un único sistema todas las operaciones logísticas de un evento: inscripción de participantes, transporte, hotelería, alimentación, salud, acreditación y seguimiento comercial.

La plataforma está diseñada para equipos de organización de eventos de mediano y gran escala, con soporte multiusuario, roles diferenciados y acceso desde cualquier dispositivo (desktop y móvil).`,
    subsections: [
      {
        title: "Módulos principales",
        content: `La plataforma se organiza en los siguientes módulos: Dashboard (Comercial y Operacional), Registro (Eventos, Participantes, Proveedores), Operación (Transporte, Hotelería, Alimentación, Salud), Acreditación, Calendario Operacional, Portales y Administración.`,
      },
      {
        title: "Requisitos de acceso",
        content: `Se requiere un navegador moderno (Chrome, Firefox, Safari o Edge actualizados). No es necesario instalar ninguna aplicación adicional. Para uso móvil, el sistema está completamente optimizado para pantallas táctiles.`,
      },
    ],
  },
  {
    num: "2",
    title: "Inicio de sesión y acceso",
    icon: "🔐",
    content: `Accede a la plataforma desde la URL provista por tu organización. El sistema admite dos modalidades de login: con correo electrónico y contraseña, o con nombre de usuario y contraseña (para usuarios sin email corporativo).`,
    subsections: [
      {
        title: "Recuperar contraseña",
        content: `En la pantalla de login haz clic en "¿Olvidaste tu contraseña?". Ingresa tu email y recibirás un enlace de recuperación. Si tu cuenta usa nombre de usuario sin email, contacta al administrador de la plataforma para que restablezca tu contraseña manualmente.`,
      },
      {
        title: "Roles de usuario",
        content: `Cada usuario tiene asignado uno de los siguientes roles:\n• Administrador: acceso total a todos los módulos y configuración.\n• Supervisor: acceso de lectura y escritura a módulos operativos.\n• Operador: acceso a módulos específicos asignados por el administrador.\n• Coordinador: acceso a coordinación de equipos y reportes.\n• Visualizador: acceso de solo lectura.`,
      },
    ],
  },
  {
    num: "3",
    title: "Dashboard",
    icon: "📊",
    content: `La sección Dashboard ofrece dos vistas ejecutivas de la operación del evento: el Dashboard Comercial y el Dashboard Operacional.`,
    subsections: [
      {
        title: "Dashboard Comercial",
        content: `Muestra el presupuesto adjudicado, consumido y el forecast por área operativa (Transporte, Hotelería, Alimentación, Producción). Las tarjetas con badge "Real" están alimentadas por datos reales de la plataforma; las tarjetas "Ficticio" son datos de referencia que se actualizarán a medida que se ingresen montos reales. El total adjudicado de Transporte corresponde a la suma de los montos licitados de todos los conductores registrados.`,
      },
      {
        title: "Dashboard Operacional",
        content: `Ofrece métricas en tiempo real de los módulos operativos: viajes activos, asignaciones de hotel, alertas de salud y estado de acreditación. Se recomienda revisar este dashboard al inicio de cada jornada operativa.`,
      },
    ],
  },
  {
    num: "4",
    title: "Registro",
    icon: "📋",
    content: `El módulo de Registro centraliza la creación y configuración de los elementos base del evento: el evento mismo, los participantes y los proveedores.`,
    subsections: [
      {
        title: "4.1 Registro de Evento",
        content: `Antes de operar cualquier otro módulo, crea el evento principal en Registro → Registro Evento. Configura: nombre del evento, fechas de inicio y término, sede principal, disciplinas deportivas y categorías. El evento es el contenedor de todos los datos de la plataforma.`,
      },
      {
        title: "4.2 Inscripción de Participantes",
        content: `Gestiona el registro de atletas, técnicos y delegaciones.\n\nAlta individual: Haz clic en "+ Nuevo" y completa el formulario con nombre completo, RUT, delegación, disciplina, categoría, datos de contacto y documentos de salud.\n\nImportación masiva: Usa el botón "Importar", descarga la plantilla Excel, completa los datos y carga el archivo. El sistema validará cada fila antes de importar y mostrará un resumen de errores si los hay.\n\nCada participante tiene un código QR único generado automáticamente que sirve como credencial de acceso al evento.`,
      },
      {
        title: "4.3 Proveedores",
        content: `Registra y clasifica a todos los proveedores externos del evento.\n\nTipos disponibles: Transporte, Logística, Hotelería, Alimentación, Productora, Voluntarios, Seguridad, Broadcast y Medios, Tecnología, Recursos Humanos, Aseo y Mantención, Acreditación.\n\nTipos con subtipos:\n• Staff → Recursos Humanos, Dpto de Compras, Sport Manager, Comité Organizador\n• Infraestructura → Recintos\n• Control Técnico → Jueces, Mesa de Control\n• Salud → Antidopaje\n• Merchandising → Marketing, Equipamiento Deportivo\n\nCada proveedor registra: nombre, tipo, subtipo, RUT y email de contacto.`,
      },
    ],
  },
  {
    num: "5",
    title: "Operación — Transporte",
    icon: "🚌",
    content: `El módulo de transporte gestiona todo el ciclo de vida de los traslados del evento: conductores, vehículos, viajes y seguimiento en tiempo real.`,
    subsections: [
      {
        title: "Registro de conductores",
        content: `En Operación → Transporte → Conductores registra cada conductor con: nombre completo, RUT, número de licencia, teléfono, tipo y marca de vehículo, placa patente, capacidad y monto licitado/presupuesto (CLP). El campo "Monto licitado" alimenta directamente el Dashboard Comercial. Completa este campo para que el dashboard refleje datos reales de inversión en transporte.`,
      },
      {
        title: "Gestión de viajes",
        content: `En Operación → Transporte → Viajes crea los traslados del evento. Cada viaje requiere: conductor asignado, origen, destino, fecha y hora, lista de pasajeros y estado (Pendiente / En curso / Completado). Los viajes pueden asignarse desde el panel de administración o solicitarse a través del Portal de Solicitud de Vehículo.`,
      },
      {
        title: "Tracking en tiempo real",
        content: `El mapa de tracking (Tracking de Viajes) muestra la posición en tiempo real de los vehículos activos. Las posiciones se actualizan desde la app del conductor a través del Portal Conductor.`,
      },
      {
        title: "Escáner QR",
        content: `El escáner QR permite validar credenciales de participantes en puntos de acceso. Accede desde Operación → Transporte → Escáner QR, activa la cámara y apunta al código QR de la credencial. El sistema mostrará nombre, delegación, tipo de acceso permitido y estado de acreditación.`,
      },
    ],
  },
  {
    num: "6",
    title: "Operación — Hotelería",
    icon: "🏨",
    content: `El módulo de hotelería gestiona el alojamiento de todos los participantes del evento, desde la configuración de los hoteles hasta la entrega de llaves y servicios extra.`,
    subsections: [
      {
        title: "Configuración inicial",
        content: `Antes de asignar habitaciones, configura la estructura en este orden:\n1. Hoteles/Villa Panamericana: crea cada establecimiento con nombre, dirección y capacidad total.\n2. Habitaciones: agrega las habitaciones de cada hotel con tipo (simple, doble, triple, suite), piso y número.\n3. Camas: opcionalmente registra las camas individuales dentro de cada habitación.`,
      },
      {
        title: "Asignaciones de hotel",
        content: `En Asignaciones Hotel busca al participante por nombre o delegación y selecciona la habitación disponible. La asignación automática por tipo de habitación distribuye a los atletas según el tipo de alojamiento acordado por delegación. Puedes ver el estado de ocupación en el Tracking de Hotelería.`,
      },
      {
        title: "Gestión de llaves",
        content: `Registra la entrega y devolución de llaves o tarjetas de acceso. Cada transacción queda registrada con fecha, hora y el operador que realizó la gestión.`,
      },
      {
        title: "Salones y extras",
        content: `Reserva de Salones permite gestionar las salas de reuniones del hotel para delegaciones y comités. Reserva de Extras gestiona servicios adicionales como lavandería, gimnasio, sala de prensa y catering especial.`,
      },
    ],
  },
  {
    num: "7",
    title: "Operación — Alimentación",
    icon: "🍽️",
    content: `Gestiona todos los servicios de alimentación del evento: comedores, menús y servicios por tipo (desayuno, almuerzo, cena).`,
    subsections: [
      {
        title: "Configuración",
        content: `Define primero los Tipos de Alimentación (categorías de menú especial: vegetariano, sin gluten, alérgenos, etc.) y los Lugares de Comida (comedores y puntos de servicio con su ubicación y capacidad).`,
      },
      {
        title: "Servicios de alimentación",
        content: `Registra los menús por servicio (Desayuno, Almuerzo, Cena) con la descripción del menú del día y los grupos o delegaciones que lo reciben. Esto permite planificar la cantidad de raciones por servicio y llevar control de restricciones alimentarias.`,
      },
    ],
  },
  {
    num: "8",
    title: "Operación — Salud",
    icon: "🏥",
    content: `Módulo de control sanitario y médico del evento, incluyendo la gestión del programa antidopaje (AND).`,
    subsections: [
      {
        title: "Atenciones médicas",
        content: `Registra cada atención médica que se realice durante el evento: participante atendido, fecha, tipo de atención, diagnóstico y derivaciones. Esto genera el historial médico del evento para efectos de reportería.`,
      },
      {
        title: "Control AND",
        content: `El módulo AND gestiona el listado de sustancias prohibidas y el seguimiento de los atletas sujetos a controles antidopaje. El submódulo Cumplimiento AND permite registrar la entrega de formularios de declaración y el estado de cumplimiento por atleta.`,
      },
    ],
  },
  {
    num: "9",
    title: "Acreditación",
    icon: "🛡️",
    content: `Sistema de control de acceso basado en credenciales QR para todos los participantes y personal del evento.`,
    subsections: [
      {
        title: "Tipos de acceso",
        content: `Cada credencial puede tener uno o más tipos de acceso:\n• C — Campo de juego\n• TR — Tribunas\n• H — Hotel / Villa\n• R — Salas de reuniones\n• A — Áreas restringidas (técnicas, médicas)\n• RD — Acceso dirección / VIP`,
      },
      {
        title: "Estados de acreditación",
        content: `Pendiente: la solicitud está en revisión.\nAprobada: la credencial es válida y puede usarse.\nRechazada: la credencial no fue aprobada.\nVencida: la credencial expiró según la fecha de término del evento.\n\nEl estado se puede actualizar manualmente desde el perfil del participante o de forma masiva desde el listado de acreditaciones.`,
      },
      {
        title: "Validación con escáner",
        content: `Usa el escáner QR (Operación → Escáner QR) en cada punto de control. El escáner muestra en tiempo real si el acceso está permitido, el nombre del participante y sus tipos de acceso activos.`,
      },
    ],
  },
  {
    num: "10",
    title: "Portales de usuario",
    icon: "🖥️",
    content: `La plataforma ofrece portales simplificados para usuarios finales que no necesitan acceso al sistema completo de administración.`,
    subsections: [
      {
        title: "Portal de usuario / Atleta",
        content: `Vista personalizada para atletas y técnicos. Muestra: datos del participante, habitación asignada, credencial QR, viajes programados e información del evento. Accesible desde dispositivos móviles.`,
      },
      {
        title: "Portal Conductor",
        content: `Vista optimizada para conductores. Muestra los viajes asignados del día con origen, destino, pasajeros y estado. El conductor puede actualizar el estado del viaje (En curso / Completado) y su posición se transmite al mapa de tracking.`,
      },
      {
        title: "Solicitud de vehículo",
        content: `Portal para que los responsables de delegación o coordinadores soliciten traslados. La solicitud queda en estado Pendiente hasta que un operador la aprueba y asigna un conductor.`,
      },
    ],
  },
  {
    num: "11",
    title: "Administración de Usuarios",
    icon: "👥",
    content: `Módulo exclusivo para administradores. Gestiona los accesos y permisos de todos los usuarios de la plataforma.`,
    subsections: [
      {
        title: "Crear un usuario",
        content: `En Administración → Gestión de Usuarios haz clic en "+ Nuevo usuario". Completa: nombre completo, email (o nombre de usuario para cuentas sin email), rol y módulos a los que tendrá acceso. El sistema enviará un email de bienvenida con las instrucciones de acceso. Si el usuario no tiene email, el administrador establece la contraseña inicial.`,
      },
      {
        title: "Modificar permisos",
        content: `Abre el usuario y edita su rol o los módulos asignados. Los cambios toman efecto inmediatamente. El usuario deberá refrescar su sesión para ver los nuevos accesos.`,
      },
      {
        title: "Resetear contraseña",
        content: `Desde el perfil del usuario usa "Resetear contraseña". Para cuentas con email se envía un enlace de recuperación automáticamente. Para cuentas con nombre de usuario, el administrador puede establecer una nueva contraseña directamente.`,
      },
      {
        title: "Desactivar un usuario",
        content: `Para revocar el acceso de un usuario sin eliminarlo, cambia su estado a "Inactivo". El usuario no podrá iniciar sesión pero sus datos históricos se conservan en el sistema.`,
      },
    ],
  },
  {
    num: "12",
    title: "Calendario Operacional",
    icon: "📅",
    content: `Vista de planificación de disciplinas, competencias y actividades del evento organizadas por día.`,
    subsections: [
      {
        title: "Uso del calendario",
        content: `Navega por días usando las flechas de navegación o haciendo clic en una fecha específica. Cada día muestra las disciplinas programadas con su venue, hora de inicio, categoría y estado. El calendario está vinculado a los datos del Registro de Eventos, por lo que cualquier modificación en las disciplinas se refleja automáticamente.`,
      },
    ],
  },
  {
    num: "13",
    title: "Preguntas frecuentes",
    icon: "💬",
    content: "",
    subsections: [
      {
        title: "¿Cómo importo participantes de forma masiva?",
        content: `En Registro → Inscripción Participantes, usa el botón "Importar". Descarga la plantilla Excel, completa los datos siguiendo el formato de columnas indicado y sube el archivo. El sistema validará el formato antes de importar y mostrará un resumen de registros exitosos y errores.`,
      },
      {
        title: "¿Por qué el Dashboard Comercial muestra valores ficticios?",
        content: `Las tarjetas marcadas como "Ficticio" contienen datos de ejemplo. Para ver datos reales en Transporte, ingresa el "Monto licitado/presupuesto" en el registro de cada conductor. Las otras áreas (Hotelería, Alimentación, Producción) se actualizarán a medida que se integre su seguimiento presupuestario.`,
      },
      {
        title: "¿Cómo cambio el idioma de la interfaz?",
        content: `Al final del menú lateral hay un selector con tres opciones: Español (ES), English (EN) y Português (PT). Haz clic en el idioma deseado y la interfaz cambiará inmediatamente.`,
      },
      {
        title: "¿Puedo acceder desde el celular?",
        content: `Sí. La plataforma es completamente responsiva. En pantallas pequeñas el menú lateral se convierte en un cajón deslizable que se abre con el botón ☰. Los portales de conductor y usuario están especialmente optimizados para uso móvil.`,
      },
      {
        title: "¿Cómo funciona la asignación automática de hotel?",
        content: `En Asignaciones Hotel hay un botón de asignación automática. El sistema distribuye a los atletas en las habitaciones disponibles según el tipo de habitación (simple, doble, triple) asignado a cada delegación. Asegúrate de que las habitaciones estén creadas y disponibles antes de ejecutar la asignación automática.`,
      },
      {
        title: "¿Qué pasa si escaneo una credencial inválida o vencida?",
        content: `El escáner mostrará un mensaje de alerta en rojo indicando el motivo del rechazo (credencial pendiente de aprobación, rechazada, vencida o sin los permisos de acceso para esa zona). El acceso debe ser denegado en ese caso.`,
      },
      {
        title: "¿Cómo crear un usuario sin correo electrónico?",
        content: `En Administración → Gestión de Usuarios, al crear un nuevo usuario desmarca la opción de email y usa el campo "Nombre de usuario". El administrador establecerá la contraseña inicial y la comunicará al usuario por otro medio.`,
      },
    ],
  },
];

const SECTIONS_EN: Section[] = [
  {
    num: "1",
    title: "Introduction to Seven Arena",
    icon: "🏟️",
    content: `Seven Arena is a comprehensive sports event management platform. It centralizes all logistical operations of an event in a single system: participant registration, transport, hospitality, food, health, accreditation and commercial tracking.

The platform is designed for medium and large-scale event organization teams, with multi-user support, differentiated roles and access from any device (desktop and mobile).`,
    subsections: [
      {
        title: "Main modules",
        content: `The platform is organized into the following modules: Dashboard (Commercial and Operational), Registration (Events, Participants, Providers), Operations (Transport, Hospitality, Food, Health), Accreditation, Operational Calendar, Portals and Administration.`,
      },
      {
        title: "Access requirements",
        content: `A modern browser is required (updated Chrome, Firefox, Safari or Edge). No additional application installation is necessary. For mobile use, the system is fully optimized for touchscreens.`,
      },
    ],
  },
  {
    num: "2",
    title: "Login and access",
    icon: "🔐",
    content: `Access the platform from the URL provided by your organization. The system supports two login methods: with email and password, or with username and password (for users without a corporate email).`,
    subsections: [
      {
        title: "Recover password",
        content: `On the login screen click "Forgot your password?". Enter your email and you will receive a recovery link. If your account uses a username without email, contact the platform administrator to reset your password manually.`,
      },
      {
        title: "User roles",
        content: `Each user has one of the following roles assigned:\n• Administrator: full access to all modules and configuration.\n• Supervisor: read and write access to operational modules.\n• Operator: access to specific modules assigned by the administrator.\n• Coordinator: access to team coordination and reports.\n• Viewer: read-only access.`,
      },
    ],
  },
  {
    num: "3",
    title: "Dashboard",
    icon: "📊",
    content: `The Dashboard section offers two executive views of the event operation: the Commercial Dashboard and the Operational Dashboard.`,
    subsections: [
      {
        title: "Commercial Dashboard",
        content: `Shows the awarded, consumed and forecast budget by operational area (Transport, Hospitality, Food, Production). Cards with the "Real" badge are fed by real platform data; "Fictitious" cards are reference data that will be updated as real amounts are entered. The total awarded for Transport corresponds to the sum of the tendered amounts of all registered drivers.`,
      },
      {
        title: "Operational Dashboard",
        content: `Provides real-time metrics from the operational modules: active trips, hotel assignments, health alerts and accreditation status. It is recommended to review this dashboard at the start of each operational day.`,
      },
    ],
  },
  {
    num: "4",
    title: "Registration",
    icon: "📋",
    content: `The Registration module centralizes the creation and configuration of the base elements of the event: the event itself, participants and providers.`,
    subsections: [
      {
        title: "4.1 Event Registration",
        content: `Before operating any other module, create the main event in Registration → Event Registration. Configure: event name, start and end dates, main venue, sports disciplines and categories. The event is the container for all platform data.`,
      },
      {
        title: "4.2 Participant Registration",
        content: `Manage the registration of athletes, coaches and delegations.\n\nIndividual registration: Click "+ New" and complete the form with full name, RUT, delegation, discipline, category, contact details and health documents.\n\nBulk import: Use the "Import" button, download the Excel template, complete the data and upload the file. The system will validate each row before importing and will show an error summary if there are any.\n\nEach participant has a unique QR code automatically generated that serves as an event access credential.`,
      },
      {
        title: "4.3 Providers",
        content: `Register and classify all external event providers.\n\nAvailable types: Transport, Logistics, Hospitality, Food, Production, Volunteers, Security, Broadcast and Media, Technology, Human Resources, Cleaning and Maintenance, Accreditation.\n\nTypes with subtypes:\n• Staff → Human Resources, Purchasing Dept, Sport Manager, Organizing Committee\n• Infrastructure → Venues\n• Technical Control → Judges, Control Table\n• Health → Anti-doping\n• Merchandising → Marketing, Sports Equipment\n\nEach provider registers: name, type, subtype, RUT and contact email.`,
      },
    ],
  },
  {
    num: "5",
    title: "Operations — Transport",
    icon: "🚌",
    content: `The transport module manages the entire lifecycle of event transfers: drivers, vehicles, trips and real-time tracking.`,
    subsections: [
      {
        title: "Driver registration",
        content: `In Operations → Transport → Drivers register each driver with: full name, RUT, license number, phone, vehicle type and brand, license plate, capacity and tendered/budget amount (CLP). The "Tendered amount" field directly feeds the Commercial Dashboard. Complete this field so the dashboard reflects real transport investment data.`,
      },
      {
        title: "Trip management",
        content: `In Operations → Transport → Trips create the event transfers. Each trip requires: assigned driver, origin, destination, date and time, passenger list and status (Pending / In progress / Completed). Trips can be assigned from the administration panel or requested through the Vehicle Request Portal.`,
      },
      {
        title: "Real-time tracking",
        content: `The tracking map (Trip Tracking) shows the real-time position of active vehicles. Positions are updated from the driver app through the Driver Portal.`,
      },
      {
        title: "QR Scanner",
        content: `The QR scanner allows validating participant credentials at access points. Access from Operations → Transport → QR Scanner, activate the camera and point at the credential QR code. The system will show name, delegation, allowed access type and accreditation status.`,
      },
    ],
  },
  {
    num: "6",
    title: "Operations — Hospitality",
    icon: "🏨",
    content: `The hospitality module manages the accommodation of all event participants, from hotel configuration to key delivery and extra services.`,
    subsections: [
      {
        title: "Initial configuration",
        content: `Before assigning rooms, configure the structure in this order:\n1. Hotels/Villa Panamericana: create each establishment with name, address and total capacity.\n2. Rooms: add the rooms of each hotel with type (single, double, triple, suite), floor and number.\n3. Beds: optionally register individual beds within each room.`,
      },
      {
        title: "Hotel assignments",
        content: `In Hotel Assignments search for the participant by name or delegation and select the available room. Automatic assignment by room type distributes athletes according to the type of accommodation agreed per delegation. You can view occupancy status in the Hospitality Tracking.`,
      },
      {
        title: "Key management",
        content: `Record the delivery and return of keys or access cards. Each transaction is recorded with date, time and the operator who performed the management.`,
      },
      {
        title: "Rooms and extras",
        content: `Room Reservations allows managing hotel meeting rooms for delegations and committees. Extra Reservations manages additional services such as laundry, gym, press room and special catering.`,
      },
    ],
  },
  {
    num: "7",
    title: "Operations — Food",
    icon: "🍽️",
    content: `Manage all event food services: dining rooms, menus and services by type (breakfast, lunch, dinner).`,
    subsections: [
      {
        title: "Configuration",
        content: `First define the Food Types (special menu categories: vegetarian, gluten-free, allergens, etc.) and the Food Venues (dining rooms and service points with their location and capacity).`,
      },
      {
        title: "Food services",
        content: `Record menus by service (Breakfast, Lunch, Dinner) with the daily menu description and the groups or delegations that receive it. This allows planning the number of servings per service and keeping track of dietary restrictions.`,
      },
    ],
  },
  {
    num: "8",
    title: "Operations — Health",
    icon: "🏥",
    content: `Event health and medical control module, including management of the anti-doping program (AND).`,
    subsections: [
      {
        title: "Medical care",
        content: `Record each medical consultation that takes place during the event: participant treated, date, type of care, diagnosis and referrals. This generates the event's medical history for reporting purposes.`,
      },
      {
        title: "AND Control",
        content: `The AND module manages the list of prohibited substances and tracks athletes subject to anti-doping controls. The AND Compliance sub-module allows recording the delivery of declaration forms and compliance status per athlete.`,
      },
    ],
  },
  {
    num: "9",
    title: "Accreditation",
    icon: "🛡️",
    content: `QR credential-based access control system for all event participants and personnel.`,
    subsections: [
      {
        title: "Access types",
        content: `Each credential can have one or more access types:\n• C — Playing field\n• TR — Stands / Tribune\n• H — Hotel / Villa\n• R — Meeting rooms\n• A — Restricted areas (technical, medical)\n• RD — Management / VIP access`,
      },
      {
        title: "Accreditation statuses",
        content: `Pending: the request is under review.\nApproved: the credential is valid and can be used.\nRejected: the credential was not approved.\nExpired: the credential expired according to the event end date.\n\nThe status can be updated manually from the participant profile or in bulk from the accreditations list.`,
      },
      {
        title: "Scanner validation",
        content: `Use the QR scanner (Operations → QR Scanner) at each checkpoint. The scanner shows in real time whether access is permitted, the participant's name and their active access types.`,
      },
    ],
  },
  {
    num: "10",
    title: "User portals",
    icon: "🖥️",
    content: `The platform offers simplified portals for end users who do not need access to the full administration system.`,
    subsections: [
      {
        title: "User / Athlete portal",
        content: `Personalized view for athletes and coaches. Shows: participant data, assigned room, QR credential, scheduled trips and event information. Accessible from mobile devices.`,
      },
      {
        title: "Driver portal",
        content: `Optimized view for drivers. Shows the day's assigned trips with origin, destination, passengers and status. The driver can update the trip status (In progress / Completed) and their position is transmitted to the tracking map.`,
      },
      {
        title: "Vehicle request",
        content: `Portal for delegation managers or coordinators to request transfers. The request stays in Pending status until an operator approves it and assigns a driver.`,
      },
    ],
  },
  {
    num: "11",
    title: "User Administration",
    icon: "👥",
    content: `Exclusive module for administrators. Manages the access and permissions of all platform users.`,
    subsections: [
      {
        title: "Create a user",
        content: `In Administration → User Management click "+ New user". Complete: full name, email (or username for accounts without email), role and modules they will have access to. The system will send a welcome email with access instructions. If the user has no email, the administrator sets the initial password.`,
      },
      {
        title: "Modify permissions",
        content: `Open the user and edit their role or assigned modules. Changes take effect immediately. The user will need to refresh their session to see the new access.`,
      },
      {
        title: "Reset password",
        content: `From the user profile use "Reset password". For accounts with email, a recovery link is automatically sent. For accounts with username, the administrator can set a new password directly.`,
      },
      {
        title: "Deactivate a user",
        content: `To revoke a user's access without deleting them, change their status to "Inactive". The user will not be able to log in but their historical data is preserved in the system.`,
      },
    ],
  },
  {
    num: "12",
    title: "Operational Calendar",
    icon: "📅",
    content: `Planning view of event disciplines, competitions and activities organized by day.`,
    subsections: [
      {
        title: "Using the calendar",
        content: `Navigate by day using the navigation arrows or by clicking on a specific date. Each day shows the scheduled disciplines with their venue, start time, category and status. The calendar is linked to the Event Registration data, so any changes to disciplines are automatically reflected.`,
      },
    ],
  },
  {
    num: "13",
    title: "Frequently asked questions",
    icon: "💬",
    content: "",
    subsections: [
      {
        title: "How do I bulk import participants?",
        content: `In Registration → Participant Registration, use the "Import" button. Download the Excel template, complete the data following the indicated column format and upload the file. The system will validate the format before importing and show a summary of successful records and errors.`,
      },
      {
        title: "Why does the Commercial Dashboard show fictitious values?",
        content: `Cards marked as "Fictitious" contain sample data. To see real data in Transport, enter the "Tendered/budget amount" in each driver's record. The other areas (Hospitality, Food, Production) will be updated as their budget tracking is integrated.`,
      },
      {
        title: "How do I change the interface language?",
        content: `At the bottom of the sidebar there is a selector with three options: Spanish (ES), English (EN) and Portuguese (PT). Click on the desired language and the interface will change immediately.`,
      },
      {
        title: "Can I access from my phone?",
        content: `Yes. The platform is fully responsive. On small screens the sidebar becomes a slide-out drawer that opens with the ☰ button. The driver and user portals are especially optimized for mobile use.`,
      },
      {
        title: "How does the automatic hotel assignment work?",
        content: `In Hotel Assignments there is an automatic assignment button. The system distributes athletes to available rooms according to the room type (single, double, triple) assigned to each delegation. Make sure rooms are created and available before running the automatic assignment.`,
      },
      {
        title: "What happens if I scan an invalid or expired credential?",
        content: `The scanner will show a red alert message indicating the reason for rejection (credential pending approval, rejected, expired or without access permissions for that area). Access must be denied in that case.`,
      },
      {
        title: "How do I create a user without email?",
        content: `In Administration → User Management, when creating a new user uncheck the email option and use the "Username" field. The administrator will set the initial password and communicate it to the user by another means.`,
      },
    ],
  },
];

const SECTIONS_PT: Section[] = [
  {
    num: "1",
    title: "Introdução ao Seven Arena",
    icon: "🏟️",
    content: `Seven Arena é uma plataforma abrangente de gestão de eventos esportivos. Centraliza em um único sistema todas as operações logísticas de um evento: inscrição de participantes, transporte, hotelaria, alimentação, saúde, acreditação e acompanhamento comercial.

A plataforma é projetada para equipes de organização de eventos de médio e grande porte, com suporte multiusuário, funções diferenciadas e acesso de qualquer dispositivo (desktop e celular).`,
    subsections: [
      {
        title: "Módulos principais",
        content: `A plataforma é organizada nos seguintes módulos: Painel (Comercial e Operacional), Registro (Eventos, Participantes, Fornecedores), Operação (Transporte, Hotelaria, Alimentação, Saúde), Acreditação, Calendário Operacional, Portais e Administração.`,
      },
      {
        title: "Requisitos de acesso",
        content: `É necessário um navegador moderno (Chrome, Firefox, Safari ou Edge atualizados). Não é necessário instalar nenhum aplicativo adicional. Para uso móvel, o sistema é completamente otimizado para telas sensíveis ao toque.`,
      },
    ],
  },
  {
    num: "2",
    title: "Login e acesso",
    icon: "🔐",
    content: `Acesse a plataforma pela URL fornecida pela sua organização. O sistema suporta dois métodos de login: com e-mail e senha, ou com nome de usuário e senha (para usuários sem e-mail corporativo).`,
    subsections: [
      {
        title: "Recuperar senha",
        content: `Na tela de login clique em "Esqueceu sua senha?". Insira seu e-mail e você receberá um link de recuperação. Se sua conta usa nome de usuário sem e-mail, contate o administrador da plataforma para redefinir sua senha manualmente.`,
      },
      {
        title: "Funções de usuário",
        content: `Cada usuário tem uma das seguintes funções atribuídas:\n• Administrador: acesso total a todos os módulos e configurações.\n• Supervisor: acesso de leitura e escrita aos módulos operacionais.\n• Operador: acesso a módulos específicos atribuídos pelo administrador.\n• Coordenador: acesso à coordenação de equipes e relatórios.\n• Visualizador: acesso somente leitura.`,
      },
    ],
  },
  {
    num: "3",
    title: "Painel",
    icon: "📊",
    content: `A seção Painel oferece duas visões executivas da operação do evento: o Painel Comercial e o Painel Operacional.`,
    subsections: [
      {
        title: "Painel Comercial",
        content: `Mostra o orçamento adjudicado, consumido e a previsão por área operacional (Transporte, Hotelaria, Alimentação, Produção). Cartões com o badge "Real" são alimentados por dados reais da plataforma; cartões "Fictício" são dados de referência que serão atualizados à medida que valores reais forem inseridos. O total adjudicado de Transporte corresponde à soma dos valores licitados de todos os motoristas registrados.`,
      },
      {
        title: "Painel Operacional",
        content: `Fornece métricas em tempo real dos módulos operacionais: viagens ativas, atribuições de hotel, alertas de saúde e status de acreditação. Recomenda-se revisar este painel no início de cada jornada operacional.`,
      },
    ],
  },
  {
    num: "4",
    title: "Registro",
    icon: "📋",
    content: `O módulo de Registro centraliza a criação e configuração dos elementos base do evento: o próprio evento, os participantes e os fornecedores.`,
    subsections: [
      {
        title: "4.1 Registro de Evento",
        content: `Antes de operar qualquer outro módulo, crie o evento principal em Registro → Registro de Evento. Configure: nome do evento, datas de início e término, sede principal, disciplinas esportivas e categorias. O evento é o contêiner de todos os dados da plataforma.`,
      },
      {
        title: "4.2 Inscrição de Participantes",
        content: `Gerencie o registro de atletas, técnicos e delegações.\n\nAlta individual: Clique em "+ Novo" e preencha o formulário com nome completo, RUT, delegação, disciplina, categoria, dados de contato e documentos de saúde.\n\nImportação em massa: Use o botão "Importar", baixe o modelo Excel, preencha os dados e faça upload do arquivo. O sistema validará cada linha antes de importar e mostrará um resumo de erros se houver.\n\nCada participante tem um código QR único gerado automaticamente que serve como credencial de acesso ao evento.`,
      },
      {
        title: "4.3 Fornecedores",
        content: `Registre e classifique todos os fornecedores externos do evento.\n\nTipos disponíveis: Transporte, Logística, Hotelaria, Alimentação, Produtora, Voluntários, Segurança, Broadcast e Mídia, Tecnologia, Recursos Humanos, Limpeza e Manutenção, Acreditação.\n\nTipos com subtipos:\n• Staff → Recursos Humanos, Dpto de Compras, Sport Manager, Comitê Organizador\n• Infraestrutura → Recintos\n• Controle Técnico → Juízes, Mesa de Controle\n• Saúde → Antidopagem\n• Merchandising → Marketing, Equipamento Esportivo\n\nCada fornecedor registra: nome, tipo, subtipo, RUT e e-mail de contato.`,
      },
    ],
  },
  {
    num: "5",
    title: "Operação — Transporte",
    icon: "🚌",
    content: `O módulo de transporte gerencia todo o ciclo de vida dos traslados do evento: motoristas, veículos, viagens e rastreio em tempo real.`,
    subsections: [
      {
        title: "Registro de motoristas",
        content: `Em Operação → Transporte → Motoristas registre cada motorista com: nome completo, RUT, número de carteira, telefone, tipo e marca de veículo, placa, capacidade e valor licitado/orçamento (CLP). O campo "Valor licitado" alimenta diretamente o Painel Comercial. Preencha este campo para que o painel reflita dados reais de investimento em transporte.`,
      },
      {
        title: "Gestão de viagens",
        content: `Em Operação → Transporte → Viagens crie os traslados do evento. Cada viagem requer: motorista atribuído, origem, destino, data e hora, lista de passageiros e status (Pendente / Em curso / Concluído). As viagens podem ser atribuídas pelo painel de administração ou solicitadas pelo Portal de Solicitação de Veículo.`,
      },
      {
        title: "Rastreio em tempo real",
        content: `O mapa de rastreio (Rastreio de Viagens) mostra a posição em tempo real dos veículos ativos. As posições são atualizadas pelo app do motorista através do Portal do Motorista.`,
      },
      {
        title: "Scanner QR",
        content: `O scanner QR permite validar credenciais de participantes em pontos de acesso. Acesse em Operação → Transporte → Scanner QR, ative a câmera e aponte para o código QR da credencial. O sistema mostrará nome, delegação, tipo de acesso permitido e status de acreditação.`,
      },
    ],
  },
  {
    num: "6",
    title: "Operação — Hotelaria",
    icon: "🏨",
    content: `O módulo de hotelaria gerencia a acomodação de todos os participantes do evento, desde a configuração dos hotéis até a entrega de chaves e serviços extras.`,
    subsections: [
      {
        title: "Configuração inicial",
        content: `Antes de atribuir quartos, configure a estrutura nesta ordem:\n1. Hotéis/Vila Panamericana: crie cada estabelecimento com nome, endereço e capacidade total.\n2. Quartos: adicione os quartos de cada hotel com tipo (single, double, triple, suite), andar e número.\n3. Camas: opcionalmente registre as camas individuais dentro de cada quarto.`,
      },
      {
        title: "Atribuições de hotel",
        content: `Em Atribuições de Hotel procure o participante por nome ou delegação e selecione o quarto disponível. A atribuição automática por tipo de quarto distribui os atletas segundo o tipo de acomodação acordado por delegação. Você pode ver o status de ocupação no Rastreio de Hotelaria.`,
      },
      {
        title: "Gestão de chaves",
        content: `Registre a entrega e devolução de chaves ou cartões de acesso. Cada transação é registrada com data, hora e o operador que realizou a gestão.`,
      },
      {
        title: "Salões e extras",
        content: `Reserva de Salões permite gerenciar as salas de reuniões do hotel para delegações e comitês. Reserva de Extras gerencia serviços adicionais como lavanderia, academia, sala de imprensa e catering especial.`,
      },
    ],
  },
  {
    num: "7",
    title: "Operação — Alimentação",
    icon: "🍽️",
    content: `Gerencie todos os serviços de alimentação do evento: refeitórios, cardápios e serviços por tipo (café da manhã, almoço, jantar).`,
    subsections: [
      {
        title: "Configuração",
        content: `Defina primeiro os Tipos de Alimentação (categorias de cardápio especial: vegetariano, sem glúten, alérgenos, etc.) e os Locais de Alimentação (refeitórios e pontos de serviço com sua localização e capacidade).`,
      },
      {
        title: "Serviços de alimentação",
        content: `Registre os cardápios por serviço (Café da manhã, Almoço, Jantar) com a descrição do cardápio do dia e os grupos ou delegações que o recebem. Isso permite planejar a quantidade de porções por serviço e controlar restrições alimentares.`,
      },
    ],
  },
  {
    num: "8",
    title: "Operação — Saúde",
    icon: "🏥",
    content: `Módulo de controle sanitário e médico do evento, incluindo a gestão do programa antidopagem (AND).`,
    subsections: [
      {
        title: "Atendimentos médicos",
        content: `Registre cada atendimento médico realizado durante o evento: participante atendido, data, tipo de atendimento, diagnóstico e encaminhamentos. Isso gera o histórico médico do evento para fins de relatório.`,
      },
      {
        title: "Controle AND",
        content: `O módulo AND gerencia a lista de substâncias proibidas e o acompanhamento dos atletas sujeitos a controles antidopagem. O submódulo Conformidade AND permite registrar a entrega de formulários de declaração e o status de conformidade por atleta.`,
      },
    ],
  },
  {
    num: "9",
    title: "Acreditação",
    icon: "🛡️",
    content: `Sistema de controle de acesso baseado em credenciais QR para todos os participantes e pessoal do evento.`,
    subsections: [
      {
        title: "Tipos de acesso",
        content: `Cada credencial pode ter um ou mais tipos de acesso:\n• C — Campo de jogo\n• TR — Tribunas\n• H — Hotel / Vila\n• R — Salas de reuniões\n• A — Áreas restritas (técnicas, médicas)\n• RD — Acesso direção / VIP`,
      },
      {
        title: "Status de acreditação",
        content: `Pendente: a solicitação está em análise.\nAprovada: a credencial é válida e pode ser usada.\nRejeitada: a credencial não foi aprovada.\nVencida: a credencial expirou segundo a data de término do evento.\n\nO status pode ser atualizado manualmente no perfil do participante ou em massa na lista de acreditações.`,
      },
      {
        title: "Validação com scanner",
        content: `Use o scanner QR (Operação → Scanner QR) em cada ponto de controle. O scanner mostra em tempo real se o acesso está permitido, o nome do participante e seus tipos de acesso ativos.`,
      },
    ],
  },
  {
    num: "10",
    title: "Portais de usuário",
    icon: "🖥️",
    content: `A plataforma oferece portais simplificados para usuários finais que não precisam de acesso ao sistema completo de administração.`,
    subsections: [
      {
        title: "Portal de usuário / Atleta",
        content: `Visão personalizada para atletas e técnicos. Mostra: dados do participante, quarto atribuído, credencial QR, viagens programadas e informações do evento. Acessível de dispositivos móveis.`,
      },
      {
        title: "Portal do motorista",
        content: `Visão otimizada para motoristas. Mostra as viagens atribuídas do dia com origem, destino, passageiros e status. O motorista pode atualizar o status da viagem (Em curso / Concluído) e sua posição é transmitida ao mapa de rastreio.`,
      },
      {
        title: "Solicitação de veículo",
        content: `Portal para que responsáveis de delegação ou coordenadores solicitem traslados. A solicitação fica em status Pendente até que um operador a aprove e atribua um motorista.`,
      },
    ],
  },
  {
    num: "11",
    title: "Administração de Usuários",
    icon: "👥",
    content: `Módulo exclusivo para administradores. Gerencia os acessos e permissões de todos os usuários da plataforma.`,
    subsections: [
      {
        title: "Criar um usuário",
        content: `Em Administração → Gestão de Usuários clique em "+ Novo usuário". Preencha: nome completo, e-mail (ou nome de usuário para contas sem e-mail), função e módulos aos quais terá acesso. O sistema enviará um e-mail de boas-vindas com as instruções de acesso. Se o usuário não tiver e-mail, o administrador define a senha inicial.`,
      },
      {
        title: "Modificar permissões",
        content: `Abra o usuário e edite sua função ou os módulos atribuídos. As alterações têm efeito imediato. O usuário precisará atualizar sua sessão para ver os novos acessos.`,
      },
      {
        title: "Redefinir senha",
        content: `No perfil do usuário use "Redefinir senha". Para contas com e-mail, um link de recuperação é enviado automaticamente. Para contas com nome de usuário, o administrador pode definir uma nova senha diretamente.`,
      },
      {
        title: "Desativar um usuário",
        content: `Para revogar o acesso de um usuário sem excluí-lo, altere seu status para "Inativo". O usuário não poderá fazer login, mas seus dados históricos são preservados no sistema.`,
      },
    ],
  },
  {
    num: "12",
    title: "Calendário Operacional",
    icon: "📅",
    content: `Vista de planejamento de disciplinas, competições e atividades do evento organizadas por dia.`,
    subsections: [
      {
        title: "Uso do calendário",
        content: `Navegue por dias usando as setas de navegação ou clicando em uma data específica. Cada dia mostra as disciplinas programadas com seu local, horário de início, categoria e status. O calendário está vinculado aos dados do Registro de Eventos, portanto qualquer modificação nas disciplinas é refletida automaticamente.`,
      },
    ],
  },
  {
    num: "13",
    title: "Perguntas frequentes",
    icon: "💬",
    content: "",
    subsections: [
      {
        title: "Como importo participantes em massa?",
        content: `Em Registro → Inscrição de Participantes, use o botão "Importar". Baixe o modelo Excel, preencha os dados seguindo o formato de colunas indicado e faça upload do arquivo. O sistema validará o formato antes de importar e mostrará um resumo de registros bem-sucedidos e erros.`,
      },
      {
        title: "Por que o Painel Comercial mostra valores fictícios?",
        content: `Os cartões marcados como "Fictício" contêm dados de exemplo. Para ver dados reais em Transporte, insira o "Valor licitado/orçamento" no registro de cada motorista. As outras áreas (Hotelaria, Alimentação, Produção) serão atualizadas à medida que seu acompanhamento orçamentário for integrado.`,
      },
      {
        title: "Como mudo o idioma da interface?",
        content: `No final do menu lateral há um seletor com três opções: Espanhol (ES), Inglês (EN) e Português (PT). Clique no idioma desejado e a interface mudará imediatamente.`,
      },
      {
        title: "Posso acessar pelo celular?",
        content: `Sim. A plataforma é completamente responsiva. Em telas pequenas o menu lateral se torna uma gaveta deslizante que abre com o botão ☰. Os portais do motorista e do usuário são especialmente otimizados para uso móvel.`,
      },
      {
        title: "Como funciona a atribuição automática de hotel?",
        content: `Em Atribuições de Hotel há um botão de atribuição automática. O sistema distribui os atletas nos quartos disponíveis segundo o tipo de quarto (single, double, triple) atribuído a cada delegação. Certifique-se de que os quartos estão criados e disponíveis antes de executar a atribuição automática.`,
      },
      {
        title: "O que acontece se eu escanear uma credencial inválida ou vencida?",
        content: `O scanner mostrará uma mensagem de alerta em vermelho indicando o motivo da rejeição (credencial pendente de aprovação, rejeitada, vencida ou sem as permissões de acesso para essa área). O acesso deve ser negado nesse caso.`,
      },
      {
        title: "Como criar um usuário sem e-mail?",
        content: `Em Administração → Gestão de Usuários, ao criar um novo usuário desmarque a opção de e-mail e use o campo "Nome de usuário". O administrador definirá a senha inicial e a comunicará ao usuário por outro meio.`,
      },
    ],
  },
];

const SECTIONS_BY_LOCALE: Record<Locale, Section[]> = {
  es: SECTIONS_ES,
  en: SECTIONS_EN,
  pt: SECTIONS_PT,
};

// ── Component ────────────────────────────────────────────────────────────────
export default function ManualPage() {
  const { locale, t } = useI18n();
  const sections = SECTIONS_BY_LOCALE[locale as Locale];

  function handlePrint() {
    window.print();
  }

  const dateLocale = locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : "es-CL";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Top bar (hidden when printing) */}
      <div
        id="manual-topbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/ayuda"
            style={{
              fontSize: 13,
              color: "#64748b",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t("← Volver a Ayuda")}
          </Link>
          <span style={{ color: "#e2e8f0" }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
            {t("Manual de Usuario — Seven Arena")}
          </span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 20px",
            borderRadius: 8,
            background: "#1e4ed8",
            color: "#fff",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span>⬇</span>
          {t("Descargar PDF")}
        </button>
      </div>

      {/* Manual body */}
      <div
        id="manual-body"
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "40px 32px 80px",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#0f172a",
          background: "#fff",
          lineHeight: 1.7,
        }}
      >
        {/* ── Cover page ─────────────────────────────────────────────────── */}
        <div
          className="no-break"
          style={{
            textAlign: "center",
            padding: "60px 0 50px",
            borderBottom: "3px solid #1e4ed8",
            marginBottom: 48,
          }}
        >
          <img
            src="/branding/LOGO-SEVEN-1.png"
            alt="Seven Arena"
            style={{ height: 80, width: "auto", margin: "0 auto 20px", display: "block" }}
          />
          <h1
            style={{
              fontSize: 30,
              fontWeight: 700,
              margin: "0 0 8px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              letterSpacing: "-0.02em",
              color: "#0f172a",
            }}
          >
            Seven Arena
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "#1e4ed8",
              fontWeight: 600,
              margin: "0 0 4px",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {t("Manual de Usuario")}
          </p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "12px 0 0", fontFamily: "system-ui, sans-serif" }}>
            {t("Plataforma de Gestión de Eventos Deportivos")}
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0", fontFamily: "system-ui, sans-serif" }}>
            {t("Versión")} 1.0 · {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long" })}
          </p>
        </div>

        {/* ── Table of contents ──────────────────────────────────────────── */}
        <div className="no-break" style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 16,
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: 8,
            }}
          >
            {t("Contenido")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sections.map((s) => (
              <div
                key={s.num}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 0,
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#1e4ed8", fontWeight: 700, minWidth: 28 }}>{s.num}.</span>
                <span style={{ color: "#0f172a" }}>{s.title}</span>
                <span
                  style={{
                    flex: 1,
                    borderBottom: "1px dotted #cbd5e1",
                    margin: "0 8px",
                    alignSelf: "center",
                    minWidth: 20,
                  }}
                />
                <span style={{ color: "#64748b", fontSize: 12 }}>{s.icon}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sections ───────────────────────────────────────────────────── */}
        {sections.map((section, idx) => (
          <div key={section.num} className={idx > 0 ? "page-break" : ""}>
            {/* Section header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "2px solid #1e4ed8",
              }}
            >
              <span style={{ fontSize: 24 }}>{section.icon}</span>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#1e4ed8",
                    fontFamily: "system-ui, sans-serif",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    margin: "0 0 2px",
                  }}
                >
                  {t("Capítulo")} {section.num}
                </p>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: "system-ui, sans-serif",
                    color: "#0f172a",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {section.title}
                </h2>
              </div>
            </div>

            {/* Section intro text */}
            {section.content && (
              <p
                style={{
                  fontSize: 13.5,
                  color: "#334155",
                  marginBottom: 20,
                  fontFamily: "Georgia, serif",
                  lineHeight: 1.75,
                }}
              >
                {section.content}
              </p>
            )}

            {/* Subsections */}
            {section.subsections.map((sub) => (
              <div key={sub.title} className="no-break" style={{ marginBottom: 20 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "system-ui, sans-serif",
                    color: "#0f172a",
                    margin: "0 0 6px",
                    paddingLeft: 12,
                    borderLeft: "3px solid #1e4ed8",
                  }}
                >
                  {sub.title}
                </h3>
                {sub.content.split("\n").map((line, li) =>
                  line.trim() === "" ? null : line.startsWith("•") ? (
                    <div
                      key={li}
                      style={{
                        display: "flex",
                        gap: 8,
                        paddingLeft: 20,
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ color: "#1e4ed8", flexShrink: 0, fontFamily: "system-ui, sans-serif" }}>•</span>
                      <span style={{ fontSize: 13, color: "#334155", fontFamily: "Georgia, serif", lineHeight: 1.65 }}>
                        {line.replace(/^•\s*/, "")}
                      </span>
                    </div>
                  ) : (
                    <p
                      key={li}
                      style={{
                        fontSize: 13,
                        color: "#334155",
                        fontFamily: "Georgia, serif",
                        lineHeight: 1.75,
                        margin: "0 0 6px",
                        paddingLeft: 20,
                      }}
                    >
                      {line}
                    </p>
                  )
                )}
              </div>
            ))}

            <div style={{ marginBottom: 40 }} />
          </div>
        ))}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div
          style={{
            borderTop: "2px solid #e2e8f0",
            paddingTop: 24,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>
            {t("Seven Arena · Manual de Usuario v1.0")}
          </p>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
            {t("Para soporte técnico contacta al equipo administrador de la plataforma.")}
          </p>
        </div>
      </div>
    </>
  );
}
