"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

// ── Types ──────────────────────────────────────────────────────────────────
type Locale = "es" | "en" | "pt";
type FaqItem = { q: string; a: string };
type ModuleCard = {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
  items: string[];
};
type StepCard = { step: string; title: string; desc: string; icon: string; href: string };
type TipItem = { icon: string; tip: string };

// ── Module catalog ─────────────────────────────────────────────────────────
const MODULES_DATA: Record<Locale, ModuleCard[]> = {
  es: [
    {
      icon: "📊", title: "Dashboard Comercial",
      desc: "Vista ejecutiva del presupuesto y adjudicación por área operativa.",
      badge: "Comercial", badgeColor: "#6366f1",
      items: [
        "Muestra el monto adjudicado real de Transporte (suma de presupuestos de conductores).",
        "Compara adjudicado vs. consumido vs. forecast por área.",
        "Las tarjetas marcadas como 'Ficticio' son datos de ejemplo; se reemplazarán a medida que se ingresen datos reales.",
      ],
    },
    {
      icon: "📈", title: "Dashboard Operacional",
      desc: "Indicadores de operación en tiempo real: viajes, hotelería, alimentación y salud.",
      badge: "Operacional", badgeColor: "#0ea5e9",
      items: [
        "Resumen de viajes activos, pendientes y completados.",
        "Estado de asignaciones de hotel y llaves.",
        "Alertas de salud y antidopaje.",
      ],
    },
    {
      icon: "📅", title: "Registro de Eventos",
      desc: "Creación y configuración del evento deportivo principal.",
      badge: "Registro", badgeColor: "#10b981",
      items: [
        "Define nombre, fechas, sede y disciplinas del evento.",
        "El evento es el contenedor de todos los participantes, conductores y operaciones.",
        "Solo debe existir un evento activo a la vez.",
      ],
    },
    {
      icon: "👤", title: "Inscripción de Participantes",
      desc: "Gestión de atletas, delegaciones y acreditaciones.",
      badge: "Registro", badgeColor: "#10b981",
      items: [
        "Importación masiva de participantes mediante archivo Excel.",
        "Asignación de delegación, disciplina y categoría.",
        "Registro de datos médicos y documentos de salud.",
        "Generación de credenciales QR.",
      ],
    },
    {
      icon: "🏢", title: "Proveedores",
      desc: "Catálogo de proveedores externos clasificados por tipo y subtipo.",
      badge: "Registro", badgeColor: "#10b981",
      items: [
        "Tipos: Transporte, Logística, Hotelería, Alimentación, Staff, Infraestructura, etc.",
        "Cada proveedor puede tener subtipo (ej. Staff → Recursos Humanos).",
        "Asocia RUT, email y nombre de contacto a cada proveedor.",
      ],
    },
    {
      icon: "🚌", title: "Transporte",
      desc: "Gestión de conductores, vehículos y viajes.",
      badge: "Operación", badgeColor: "#f59e0b",
      items: [
        "Registro de conductores con licencia, vehículo y monto licitado/presupuesto.",
        "El campo 'Monto licitado' alimenta el Dashboard Comercial con datos reales.",
        "Asignación de viajes: origen → destino, hora, pasajeros.",
        "Tracking en tiempo real en el mapa de posiciones.",
        "Portal del conductor: vista simplificada con sus viajes del día.",
      ],
    },
    {
      icon: "🏨", title: "Hotelería",
      desc: "Asignación de habitaciones, llaves y extras de hotel.",
      badge: "Operación", badgeColor: "#f59e0b",
      items: [
        "Configuración de hoteles, habitaciones y camas.",
        "Asignación de atletas a habitaciones (individual o automática por tipo).",
        "Entrega y devolución de llaves con firma digital.",
        "Reserva de salones para reuniones.",
        "Reserva de servicios extra (lavandería, gym, etc.).",
      ],
    },
    {
      icon: "🍽️", title: "Alimentación",
      desc: "Control de menús, comedores y servicios de alimentación.",
      badge: "Operación", badgeColor: "#f59e0b",
      items: [
        "Define tipos de alimentación (Desayuno, Almuerzo, Cena).",
        "Configura lugares de comida (comedores, restaurantes).",
        "Registra menús por fecha y servicio.",
        "Asocia atletas o grupos a cada servicio.",
      ],
    },
    {
      icon: "🏥", title: "Salud",
      desc: "Registro de atenciones médicas y control antidopaje.",
      badge: "Operación", badgeColor: "#f59e0b",
      items: [
        "Registro de atenciones médicas por participante.",
        "Control de documentos de salud requeridos.",
        "Módulo AND: seguimiento del listado de sustancias prohibidas.",
        "Cumplimiento AND: control de entrega de formularios.",
      ],
    },
    {
      icon: "🛡️", title: "Acreditación",
      desc: "Control de acceso y credenciales para el evento.",
      badge: "Acreditación", badgeColor: "#8b5cf6",
      items: [
        "Generación de credenciales QR individuales.",
        "Escáner QR para validación de acceso en puertas.",
        "Tipos de acceso: Campo (C), Tribune (TR), Hotel (H), Reuniones (R), Áreas Restringidas (A), Dirección (RD).",
        "Gestión del estado de acreditación por participante.",
      ],
    },
    {
      icon: "📅", title: "Calendario Operacional",
      desc: "Vista de disciplinas, competencias y actividades por día.",
      badge: "Planificación", badgeColor: "#64748b",
      items: [
        "Navega por día para ver las competencias programadas.",
        "Cada disciplina muestra su venue, hora y estado.",
        "Vinculado a los datos del Registro de Eventos.",
      ],
    },
    {
      icon: "👥", title: "Administración de Usuarios",
      desc: "Gestión de accesos y roles de los operadores de la plataforma.",
      badge: "Admin", badgeColor: "#ef4444",
      items: [
        "Creación de usuarios con email o nombre de usuario.",
        "Roles disponibles: Administrador, Supervisor, Operador, Coordinador, Visualizador.",
        "Asignación de módulos específicos por usuario.",
        "Activación, desactivación y reseteo de contraseña.",
      ],
    },
  ],
  en: [
    {
      icon: "📊", title: "Commercial Dashboard",
      desc: "Executive budget and award-by-area view.",
      badge: "Commercial", badgeColor: "#6366f1",
      items: [
        "Shows the actual awarded amount for Transport (sum of driver budgets).",
        "Compares awarded vs. consumed vs. forecast by area.",
        "Cards marked 'Fictitious' are sample data; they will be replaced as real data is entered.",
      ],
    },
    {
      icon: "📈", title: "Operational Dashboard",
      desc: "Real-time operational indicators: trips, hospitality, food and health.",
      badge: "Operational", badgeColor: "#0ea5e9",
      items: [
        "Summary of active, pending and completed trips.",
        "Hotel assignments and key delivery status.",
        "Health and anti-doping alerts.",
      ],
    },
    {
      icon: "📅", title: "Event Registration",
      desc: "Creation and configuration of the main sports event.",
      badge: "Registration", badgeColor: "#10b981",
      items: [
        "Defines event name, dates, venue and disciplines.",
        "The event is the container for all participants, drivers and operations.",
        "Only one active event should exist at a time.",
      ],
    },
    {
      icon: "👤", title: "Participant Registration",
      desc: "Management of athletes, delegations and accreditations.",
      badge: "Registration", badgeColor: "#10b981",
      items: [
        "Bulk import of participants via Excel file.",
        "Assignment of delegation, discipline and category.",
        "Recording of medical data and health documents.",
        "QR credential generation.",
      ],
    },
    {
      icon: "🏢", title: "Providers",
      desc: "Catalog of external providers classified by type and subtype.",
      badge: "Registration", badgeColor: "#10b981",
      items: [
        "Types: Transport, Logistics, Hospitality, Food, Staff, Infrastructure, etc.",
        "Each provider can have a subtype (e.g. Staff → Human Resources).",
        "Associates RUT, email and contact name to each provider.",
      ],
    },
    {
      icon: "🚌", title: "Transport",
      desc: "Management of drivers, vehicles and trips.",
      badge: "Operations", badgeColor: "#f59e0b",
      items: [
        "Driver registration with license, vehicle and tendered/budget amount.",
        "The 'Tendered amount' field feeds the Commercial Dashboard with real data.",
        "Trip assignment: origin → destination, time, passengers.",
        "Real-time tracking on the position map.",
        "Driver portal: simplified view with their trips for the day.",
      ],
    },
    {
      icon: "🏨", title: "Hospitality",
      desc: "Room assignments, keys and hotel extras.",
      badge: "Operations", badgeColor: "#f59e0b",
      items: [
        "Configuration of hotels, rooms and beds.",
        "Assignment of athletes to rooms (individual or automatic by type).",
        "Key delivery and return with digital signature.",
        "Meeting room reservations.",
        "Reservation of extra services (laundry, gym, etc.).",
      ],
    },
    {
      icon: "🍽️", title: "Food",
      desc: "Control of menus, dining rooms and catering services.",
      badge: "Operations", badgeColor: "#f59e0b",
      items: [
        "Define food types (Breakfast, Lunch, Dinner).",
        "Configure food venues (dining rooms, restaurants).",
        "Record menus by date and service.",
        "Associate athletes or groups to each service.",
      ],
    },
    {
      icon: "🏥", title: "Health",
      desc: "Medical care registry and anti-doping control.",
      badge: "Operations", badgeColor: "#f59e0b",
      items: [
        "Medical care registry per participant.",
        "Control of required health documents.",
        "AND Module: tracking of prohibited substances list.",
        "AND Compliance: control of form delivery.",
      ],
    },
    {
      icon: "🛡️", title: "Accreditation",
      desc: "Access control and credentials for the event.",
      badge: "Accreditation", badgeColor: "#8b5cf6",
      items: [
        "Individual QR credential generation.",
        "QR scanner for access validation at doors.",
        "Access types: Field (C), Tribune (TR), Hotel (H), Meetings (R), Restricted Areas (A), Direction (RD).",
        "Accreditation status management per participant.",
      ],
    },
    {
      icon: "📅", title: "Operational Calendar",
      desc: "View of disciplines, competitions and daily activities.",
      badge: "Planning", badgeColor: "#64748b",
      items: [
        "Navigate by day to see scheduled competitions.",
        "Each discipline shows its venue, time and status.",
        "Linked to Event Registration data.",
      ],
    },
    {
      icon: "👥", title: "User Administration",
      desc: "Management of platform operator access and roles.",
      badge: "Admin", badgeColor: "#ef4444",
      items: [
        "User creation with email or username.",
        "Available roles: Administrator, Supervisor, Operator, Coordinator, Viewer.",
        "Assignment of specific modules per user.",
        "Activation, deactivation and password reset.",
      ],
    },
  ],
  pt: [
    {
      icon: "📊", title: "Painel Comercial",
      desc: "Visão executiva do orçamento e adjudicação por área operacional.",
      badge: "Comercial", badgeColor: "#6366f1",
      items: [
        "Mostra o valor adjudicado real de Transporte (soma dos orçamentos dos motoristas).",
        "Compara adjudicado vs. consumido vs. previsão por área.",
        "Cartões marcados como 'Fictício' são dados de exemplo; serão substituídos à medida que dados reais forem inseridos.",
      ],
    },
    {
      icon: "📈", title: "Painel Operacional",
      desc: "Indicadores operacionais em tempo real: viagens, hotelaria, alimentação e saúde.",
      badge: "Operacional", badgeColor: "#0ea5e9",
      items: [
        "Resumo de viagens ativas, pendentes e concluídas.",
        "Status de atribuições de hotel e chaves.",
        "Alertas de saúde e antidopagem.",
      ],
    },
    {
      icon: "📅", title: "Registro de Eventos",
      desc: "Criação e configuração do evento esportivo principal.",
      badge: "Registro", badgeColor: "#10b981",
      items: [
        "Define nome, datas, sede e disciplinas do evento.",
        "O evento é o contêiner de todos os participantes, motoristas e operações.",
        "Deve existir apenas um evento ativo por vez.",
      ],
    },
    {
      icon: "👤", title: "Inscrição de Participantes",
      desc: "Gestão de atletas, delegações e acreditações.",
      badge: "Registro", badgeColor: "#10b981",
      items: [
        "Importação em massa de participantes via arquivo Excel.",
        "Atribuição de delegação, disciplina e categoria.",
        "Registro de dados médicos e documentos de saúde.",
        "Geração de credenciais QR.",
      ],
    },
    {
      icon: "🏢", title: "Fornecedores",
      desc: "Catálogo de fornecedores externos classificados por tipo e subtipo.",
      badge: "Registro", badgeColor: "#10b981",
      items: [
        "Tipos: Transporte, Logística, Hotelaria, Alimentação, Staff, Infraestrutura, etc.",
        "Cada fornecedor pode ter subtipo (ex. Staff → Recursos Humanos).",
        "Associa RUT, e-mail e nome de contato a cada fornecedor.",
      ],
    },
    {
      icon: "🚌", title: "Transporte",
      desc: "Gestão de motoristas, veículos e viagens.",
      badge: "Operação", badgeColor: "#f59e0b",
      items: [
        "Registro de motoristas com carteira, veículo e valor licitado/orçamento.",
        "O campo 'Valor licitado' alimenta o Painel Comercial com dados reais.",
        "Atribuição de viagens: origem → destino, horário, passageiros.",
        "Rastreio em tempo real no mapa de posições.",
        "Portal do motorista: visão simplificada com suas viagens do dia.",
      ],
    },
    {
      icon: "🏨", title: "Hotelaria",
      desc: "Atribuição de quartos, chaves e extras de hotel.",
      badge: "Operação", badgeColor: "#f59e0b",
      items: [
        "Configuração de hotéis, quartos e camas.",
        "Atribuição de atletas a quartos (individual ou automática por tipo).",
        "Entrega e devolução de chaves com assinatura digital.",
        "Reserva de salões para reuniões.",
        "Reserva de serviços extras (lavanderia, academia, etc.).",
      ],
    },
    {
      icon: "🍽️", title: "Alimentação",
      desc: "Controle de cardápios, refeitórios e serviços de alimentação.",
      badge: "Operação", badgeColor: "#f59e0b",
      items: [
        "Define tipos de alimentação (Café da manhã, Almoço, Jantar).",
        "Configura locais de alimentação (refeitórios, restaurantes).",
        "Registra cardápios por data e serviço.",
        "Associa atletas ou grupos a cada serviço.",
      ],
    },
    {
      icon: "🏥", title: "Saúde",
      desc: "Registro de atendimentos médicos e controle antidopagem.",
      badge: "Operação", badgeColor: "#f59e0b",
      items: [
        "Registro de atendimentos médicos por participante.",
        "Controle de documentos de saúde necessários.",
        "Módulo AND: acompanhamento da lista de substâncias proibidas.",
        "Conformidade AND: controle de entrega de formulários.",
      ],
    },
    {
      icon: "🛡️", title: "Acreditação",
      desc: "Controle de acesso e credenciais para o evento.",
      badge: "Acreditação", badgeColor: "#8b5cf6",
      items: [
        "Geração de credenciais QR individuais.",
        "Scanner QR para validação de acesso nas entradas.",
        "Tipos de acesso: Campo (C), Tribunas (TR), Hotel (H), Reuniões (R), Áreas Restritas (A), Direção (RD).",
        "Gestão do status de acreditação por participante.",
      ],
    },
    {
      icon: "📅", title: "Calendário Operacional",
      desc: "Vista de disciplinas, competições e atividades por dia.",
      badge: "Planejamento", badgeColor: "#64748b",
      items: [
        "Navegue por dia para ver as competições programadas.",
        "Cada disciplina mostra seu local, horário e status.",
        "Vinculado aos dados do Registro de Eventos.",
      ],
    },
    {
      icon: "👥", title: "Administração de Usuários",
      desc: "Gestão de acessos e funções dos operadores da plataforma.",
      badge: "Admin", badgeColor: "#ef4444",
      items: [
        "Criação de usuários com e-mail ou nome de usuário.",
        "Funções disponíveis: Administrador, Supervisor, Operador, Coordenador, Visualizador.",
        "Atribuição de módulos específicos por usuário.",
        "Ativação, desativação e redefinição de senha.",
      ],
    },
  ],
};

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ_DATA: Record<Locale, FaqItem[]> = {
  es: [
    {
      q: "¿Cómo creo un nuevo conductor?",
      a: "Ve a Operación → Transporte → Conductores. Haz clic en '+ Nuevo' e ingresa el nombre, RUT, vehículo y monto licitado. El monto licitado aparecerá automáticamente en el Dashboard Comercial.",
    },
    {
      q: "¿Cómo importo participantes de forma masiva?",
      a: "En Registro → Inscripción Participantes, usa el botón 'Importar'. Descarga la plantilla Excel, completa los datos y sube el archivo. El sistema validará el formato antes de importar.",
    },
    {
      q: "¿Por qué algunas tarjetas del Dashboard muestran 'Ficticio'?",
      a: "Las tarjetas marcadas como 'Ficticio' contienen datos de ejemplo para dar una idea del formato. A medida que se ingresen datos reales (ej. presupuestos de conductores), las tarjetas se actualizarán automáticamente con el badge 'Real'.",
    },
    {
      q: "¿Cómo asigno una habitación a un atleta?",
      a: "En Operación → Hotelería → Asignaciones Hotel, busca al atleta por nombre o delegación y selecciona la habitación disponible. También puedes usar la asignación automática por tipo de habitación.",
    },
    {
      q: "¿Cómo funciona el escáner QR?",
      a: "Accede a Operación → Transporte → Escáner QR desde cualquier dispositivo con cámara. El sistema validará la credencial del participante y mostrará sus datos de acceso y permisos en tiempo real.",
    },
    {
      q: "¿Puedo acceder desde el celular?",
      a: "Sí. La plataforma es completamente responsiva. El menú lateral se convierte en un cajón deslizable en pantallas pequeñas. Los portales de conductor y usuario están optimizados para uso móvil.",
    },
    {
      q: "¿Cómo cambio el idioma de la interfaz?",
      a: "En la parte inferior del menú lateral encontrarás el selector de idioma. Actualmente disponible en Español, English y Português.",
    },
    {
      q: "¿Qué diferencia hay entre los temas visuales?",
      a: "La plataforma soporta 4 temas: Light (claro), Dark (oscuro con dorado), Obsidian (oscuro con cyan futurista) y Atlas (azul marino corporativo). Se configuran desde el botón de tema en la barra superior.",
    },
    {
      q: "¿Cómo creo un proveedor y le asigno un subtipo?",
      a: "En Registro → Proveedores, haz clic en '+ Nuevo'. Selecciona el tipo (ej. 'Staff') y el subtipo disponible para ese tipo (ej. 'Recursos Humanos') se habilitará automáticamente en el siguiente selector.",
    },
    {
      q: "¿Cómo reseteo la contraseña de un usuario?",
      a: "En Administración → Gestión de Usuarios, abre el usuario y usa la opción 'Resetear contraseña'. Se enviará un email de recuperación a la dirección registrada. Para usuarios sin email, el administrador puede establecer una contraseña directamente.",
    },
  ],
  en: [
    {
      q: "How do I create a new driver?",
      a: "Go to Operations → Transport → Drivers. Click '+ New' and enter the name, RUT, vehicle and tendered amount. The tendered amount will automatically appear in the Commercial Dashboard.",
    },
    {
      q: "How do I bulk import participants?",
      a: "In Registration → Participant Registration, use the 'Import' button. Download the Excel template, complete the data and upload the file. The system will validate the format before importing.",
    },
    {
      q: "Why do some Dashboard cards show 'Fictitious'?",
      a: "Cards marked as 'Fictitious' contain sample data to illustrate the format. As real data is entered (e.g. driver budgets), the cards will automatically update with the 'Real' badge.",
    },
    {
      q: "How do I assign a room to an athlete?",
      a: "In Operations → Hospitality → Hotel Assignments, search for the athlete by name or delegation and select the available room. You can also use the automatic assignment by room type.",
    },
    {
      q: "How does the QR scanner work?",
      a: "Access Operations → Transport → QR Scanner from any device with a camera. The system will validate the participant's credential and show their access data and permissions in real time.",
    },
    {
      q: "Can I access from my phone?",
      a: "Yes. The platform is fully responsive. The sidebar becomes a slide-out drawer on small screens. The driver and user portals are optimized for mobile use.",
    },
    {
      q: "How do I change the interface language?",
      a: "At the bottom of the sidebar you will find the language selector. Currently available in Spanish, English and Portuguese.",
    },
    {
      q: "What is the difference between the visual themes?",
      a: "The platform supports 4 themes: Light, Dark (dark with gold), Obsidian (futuristic dark with cyan) and Atlas (corporate navy blue). They are configured from the theme button in the top bar.",
    },
    {
      q: "How do I create a provider and assign a subtype?",
      a: "In Registration → Providers, click '+ New'. Select the type (e.g. 'Staff') and the subtype available for that type (e.g. 'Human Resources') will be automatically enabled in the next selector.",
    },
    {
      q: "How do I reset a user's password?",
      a: "In Administration → User Management, open the user and use the 'Reset password' option. A recovery email will be sent to the registered address. For users without email, the administrator can set a password directly.",
    },
  ],
  pt: [
    {
      q: "Como crio um novo motorista?",
      a: "Vá para Operação → Transporte → Motoristas. Clique em '+ Novo' e insira o nome, RUT, veículo e valor licitado. O valor licitado aparecerá automaticamente no Painel Comercial.",
    },
    {
      q: "Como importo participantes em massa?",
      a: "Em Registro → Inscrição de Participantes, use o botão 'Importar'. Baixe o modelo Excel, preencha os dados e faça upload do arquivo. O sistema validará o formato antes de importar.",
    },
    {
      q: "Por que alguns cartões do Painel mostram 'Fictício'?",
      a: "Os cartões marcados como 'Fictício' contêm dados de exemplo para ilustrar o formato. À medida que dados reais são inseridos (ex. orçamentos de motoristas), os cartões serão atualizados automaticamente com o badge 'Real'.",
    },
    {
      q: "Como atribuo um quarto a um atleta?",
      a: "Em Operação → Hotelaria → Atribuições de Hotel, procure o atleta por nome ou delegação e selecione o quarto disponível. Você também pode usar a atribuição automática por tipo de quarto.",
    },
    {
      q: "Como funciona o scanner QR?",
      a: "Acesse Operação → Transporte → Scanner QR em qualquer dispositivo com câmera. O sistema validará a credencial do participante e mostrará seus dados de acesso e permissões em tempo real.",
    },
    {
      q: "Posso acessar pelo celular?",
      a: "Sim. A plataforma é completamente responsiva. O menu lateral torna-se uma gaveta deslizante em telas pequenas. Os portais do motorista e do usuário são otimizados para uso móvel.",
    },
    {
      q: "Como mudo o idioma da interface?",
      a: "Na parte inferior do menu lateral você encontrará o seletor de idioma. Atualmente disponível em Espanhol, Inglês e Português.",
    },
    {
      q: "Qual é a diferença entre os temas visuais?",
      a: "A plataforma suporta 4 temas: Light (claro), Dark (escuro com dourado), Obsidian (escuro com ciano futurista) e Atlas (azul marinho corporativo). São configurados pelo botão de tema na barra superior.",
    },
    {
      q: "Como crio um fornecedor e atribuo um subtipo?",
      a: "Em Registro → Fornecedores, clique em '+ Novo'. Selecione o tipo (ex. 'Staff') e o subtipo disponível para esse tipo (ex. 'Recursos Humanos') será habilitado automaticamente no próximo seletor.",
    },
    {
      q: "Como redefino a senha de um usuário?",
      a: "Em Administração → Gestão de Usuários, abra o usuário e use a opção 'Redefinir senha'. Um e-mail de recuperação será enviado ao endereço registrado. Para usuários sem e-mail, o administrador pode definir uma senha diretamente.",
    },
  ],
};

// ── Steps ───────────────────────────────────────────────────────────────────
const STEPS_DATA: Record<Locale, StepCard[]> = {
  es: [
    { step: "1", title: "Configura el evento", desc: "Ve a Registro → Registro Evento y crea el evento principal con fechas, sede y disciplinas.", icon: "📅", href: "/registro/eventos" },
    { step: "2", title: "Inscribe participantes", desc: "En Registro → Inscripción Participantes agrega atletas manualmente o importa desde Excel.", icon: "👤", href: "/registro/participantes" },
    { step: "3", title: "Registra conductores", desc: "En Operación → Transporte ingresa conductores con su vehículo y monto licitado.", icon: "🚌", href: "/masters/drivers" },
    { step: "4", title: "Asigna hoteles", desc: "En Operación → Hotelería → Asignaciones Hotel distribuye atletas en las habitaciones disponibles.", icon: "🏨", href: "/operations/hotel-assignments" },
    { step: "5", title: "Monitorea el dashboard", desc: "El Dashboard Comercial y Operacional muestran el estado en tiempo real de toda la operación.", icon: "📊", href: "/dashboard/comercial" },
    { step: "6", title: "Gestiona accesos", desc: "En Administración → Gestión de Usuarios crea cuentas para tu equipo con los roles adecuados.", icon: "🛡️", href: "/admin/usuarios" },
  ],
  en: [
    { step: "1", title: "Configure the event", desc: "Go to Registration → Event Registration and create the main event with dates, venue and disciplines.", icon: "📅", href: "/registro/eventos" },
    { step: "2", title: "Register participants", desc: "In Registration → Participant Registration add athletes manually or import from Excel.", icon: "👤", href: "/registro/participantes" },
    { step: "3", title: "Register drivers", desc: "In Operations → Transport enter drivers with their vehicle and tendered amount.", icon: "🚌", href: "/masters/drivers" },
    { step: "4", title: "Assign hotels", desc: "In Operations → Hospitality → Hotel Assignments distribute athletes to available rooms.", icon: "🏨", href: "/operations/hotel-assignments" },
    { step: "5", title: "Monitor the dashboard", desc: "The Commercial and Operational Dashboards show the real-time status of the entire operation.", icon: "📊", href: "/dashboard/comercial" },
    { step: "6", title: "Manage access", desc: "In Administration → User Management create accounts for your team with the appropriate roles.", icon: "🛡️", href: "/admin/usuarios" },
  ],
  pt: [
    { step: "1", title: "Configure o evento", desc: "Vá para Registro → Registro de Evento e crie o evento principal com datas, sede e disciplinas.", icon: "📅", href: "/registro/eventos" },
    { step: "2", title: "Inscreva participantes", desc: "Em Registro → Inscrição de Participantes adicione atletas manualmente ou importe do Excel.", icon: "👤", href: "/registro/participantes" },
    { step: "3", title: "Registre motoristas", desc: "Em Operação → Transporte insira motoristas com seu veículo e valor licitado.", icon: "🚌", href: "/masters/drivers" },
    { step: "4", title: "Atribua hotéis", desc: "Em Operação → Hotelaria → Atribuições de Hotel distribua atletas nos quartos disponíveis.", icon: "🏨", href: "/operations/hotel-assignments" },
    { step: "5", title: "Monitore o painel", desc: "O Painel Comercial e Operacional mostram o status em tempo real de toda a operação.", icon: "📊", href: "/dashboard/comercial" },
    { step: "6", title: "Gerencie acessos", desc: "Em Administração → Gestão de Usuários crie contas para sua equipe com as funções adequadas.", icon: "🛡️", href: "/admin/usuarios" },
  ],
};

// ── Tips ────────────────────────────────────────────────────────────────────
const TIPS_DATA: Record<Locale, TipItem[]> = {
  es: [
    { icon: "🌙", tip: "Cambia el tema desde el botón en la barra superior (claro, oscuro, obsidian, atlas)." },
    { icon: "🌐", tip: "La interfaz está disponible en Español, English y Português. Cambia el idioma al final del menú lateral." },
    { icon: "📱", tip: "En móvil, el menú lateral se abre con el botón ☰ en la esquina superior izquierda." },
    { icon: "🔄", tip: "Los datos del Dashboard Comercial se actualizan cada vez que modificas el monto licitado de un conductor." },
    { icon: "📥", tip: "Para importar participantes masivamente usa el botón 'Importar' en la sección de Inscripción. Descarga la plantilla primero." },
    { icon: "🔑", tip: "Cada usuario puede tener acceso solo a los módulos que necesita. Configura esto en Administración → Gestión de Usuarios." },
  ],
  en: [
    { icon: "🌙", tip: "Change the theme from the button in the top bar (light, dark, obsidian, atlas)." },
    { icon: "🌐", tip: "The interface is available in Spanish, English and Portuguese. Change the language at the bottom of the sidebar." },
    { icon: "📱", tip: "On mobile, the sidebar opens with the ☰ button in the top left corner." },
    { icon: "🔄", tip: "The Commercial Dashboard data updates every time you modify the tendered amount of a driver." },
    { icon: "📥", tip: "To bulk import participants use the 'Import' button in the Registration section. Download the template first." },
    { icon: "🔑", tip: "Each user can have access only to the modules they need. Configure this in Administration → User Management." },
  ],
  pt: [
    { icon: "🌙", tip: "Mude o tema pelo botão na barra superior (claro, escuro, obsidian, atlas)." },
    { icon: "🌐", tip: "A interface está disponível em Espanhol, Inglês e Português. Mude o idioma no final do menu lateral." },
    { icon: "📱", tip: "No celular, o menu lateral abre com o botão ☰ no canto superior esquerdo." },
    { icon: "🔄", tip: "Os dados do Painel Comercial são atualizados sempre que você modifica o valor licitado de um motorista." },
    { icon: "📥", tip: "Para importar participantes em massa use o botão 'Importar' na seção de Inscrição. Baixe o modelo primeiro." },
    { icon: "🔑", tip: "Cada usuário pode ter acesso apenas aos módulos que precisa. Configure isso em Administração → Gestão de Usuários." },
  ],
};

// ── Palette ──────────────────────────────────────────────────────────────────
const acc = "#21D0B3";
const cBg = "#ffffff";
const cBorder = "#e2e8f0";
const tPrim = "#0f172a";
const tMuted = "#64748b";
const tFaint = "#94a3b8";

// ── Inline SVG helpers ────────────────────────────────────────────────────────
function SvgIcon({ d, size = 16, color = "currentColor", extra }: { d: string; size?: number; color?: string; extra?: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />{extra}
    </svg>
  );
}

// Chevron (shared accordion arrow)
function Chevron({ open, color = tFaint }: { open: boolean; color?: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: "transform 180ms ease", transform: open ? "rotate(180deg)" : "none" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Step icons (1-6)
const STEP_ICONS: Record<string, React.ReactNode> = {
  "1": <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  "2": <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  "3": <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  "4": <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>,
  "5": <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  "6": <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

// Tip icons (index 0-5)
const TIP_ICONS: React.ReactNode[] = [
  <svg key="0" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  <svg key="1" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  <svg key="2" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  <svg key="3" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  <svg key="4" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  <svg key="5" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
];

// Module badge → SVG icon
function ModBadgeIcon({ badge, color = tFaint, size = 20 }: { badge?: string; color?: string; size?: number }) {
  const sw = { strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (badge === "Comercial" || badge === "Commercial" || badge === "Comércio" || badge === "Operacional" || badge === "Operational")
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...sw}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
  if (badge === "Registro" || badge === "Registration")
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...sw}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
  if (badge === "Operación" || badge === "Operations" || badge === "Operação")
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...sw}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
  if (badge === "Acreditación" || badge === "Accreditation" || badge === "Acreditação")
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...sw}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>;
  if (badge === "Planificación" || badge === "Planning" || badge === "Planejamento")
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...sw}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  // Admin
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} {...sw}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function AyudaPage() {
  const { locale, t } = useI18n();

  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<"modulos" | "faq" | "inicio">("inicio");

  const loc = locale as Locale;
  const MODULES = MODULES_DATA[loc];
  const FAQ = FAQ_DATA[loc];
  const STEPS = STEPS_DATA[loc];
  const TIPS = TIPS_DATA[loc];

  const filteredModules = MODULES.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.desc.toLowerCase().includes(search.toLowerCase()) ||
      m.items.some((i) => i.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredFaq = FAQ.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  function TabBtn({ id, label, icon }: { id: typeof activeSection; label: string; icon: React.ReactNode }) {
    const isActive = activeSection === id;
    return (
      <button
        type="button"
        onClick={() => setActiveSection(id)}
        style={{
          padding: "8px 16px",
          borderRadius: "8px",
          fontSize: 13,
          fontWeight: isActive ? 600 : 500,
          cursor: "pointer",
          border: `1px solid ${isActive ? acc : cBorder}`,
          background: isActive ? `${acc}15` : "transparent",
          color: isActive ? acc : tMuted,
          transition: "all 150ms ease",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header card */}
      <section style={{ background: cBg, border: `1px solid ${cBorder}`, borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: tFaint }}>Seven Arena</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(33,208,179,0.08)", border: "1px solid rgba(33,208,179,0.25)", borderRadius: "99px", padding: "2px 10px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: acc, display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: acc }}>AYUDA</span>
          </span>
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 800, color: tPrim, margin: "0 0 4px" }}>{t("Centro de Ayuda")}</h1>
        <p style={{ fontSize: "13px", color: tMuted, margin: "0 0 20px" }}>{t("Guía de uso y preguntas frecuentes de Seven Arena")}</p>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: search ? 0 : 16 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: tFaint, pointerEvents: "none", display: "flex" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            type="text"
            placeholder={t("Buscar en la ayuda...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 10, border: `1px solid ${cBorder}`, background: "#f8fafc", color: tPrim, fontSize: 13.5, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Tabs + manual button */}
        {!search && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TabBtn id="inicio" label={t("Inicio rápido")}
                icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
              />
              <TabBtn id="modulos" label={t("Módulos")}
                icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>}
              />
              <TabBtn id="faq" label={t("Preguntas frecuentes")}
                icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
              />
            </div>
            <Link
              href="/ayuda/manual"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: acc, color: "#fff", textDecoration: "none", flexShrink: 0, boxShadow: "0 4px 14px rgba(33,208,179,0.3)" }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              {t("Manual de usuario (PDF)")}
            </Link>
          </div>
        )}
      </section>

      {/* ── Quick Start ─────────────────────────────────────────────────────── */}
      {!search && activeSection === "inicio" && (
        <section style={{ background: cBg, border: `1px solid ${cBorder}`, borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: tPrim, margin: 0 }}>{t("Inicio rápido")}</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 32 }}>
            {STEPS.map((card) => (
              <Link key={card.step} href={card.href} style={{ textDecoration: "none" }}>
                <div style={{ background: "#f8fafc", border: `1px solid ${cBorder}`, borderRadius: 14, padding: "18px", display: "flex", gap: 14, alignItems: "flex-start", transition: "border-color 150ms, box-shadow 150ms" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${acc}60`; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(33,208,179,0.08)`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = cBorder; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${acc}15`, border: `1px solid ${acc}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {STEP_ICONS[card.step]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: acc, background: `${acc}15`, padding: "2px 7px", borderRadius: 8, letterSpacing: "0.05em" }}>
                        {t("PASO")} {card.step}
                      </span>
                    </div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 4px", color: tPrim }}>{card.title}</p>
                    <p style={{ fontSize: 12, color: tMuted, margin: 0, lineHeight: 1.5 }}>{card.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: tPrim, margin: 0 }}>{t("Consejos útiles")}</h2>
          </div>
          <div style={{ border: `1px solid ${cBorder}`, borderRadius: 12, overflow: "hidden" }}>
            {TIPS.map((tip, i, arr) => (
              <div key={i} style={{ padding: "13px 18px", display: "flex", gap: 12, alignItems: "flex-start", borderBottom: i < arr.length - 1 ? `1px solid ${cBorder}` : "none", background: i % 2 === 0 ? cBg : "#f8fafc" }}>
                <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}>{TIP_ICONS[i % TIP_ICONS.length]}</span>
                <p style={{ fontSize: 13, color: tPrim, margin: 0, lineHeight: 1.55 }}>{tip.tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Módulos ─────────────────────────────────────────────────────────── */}
      {!search && activeSection === "modulos" && (
        <section style={{ background: cBg, border: `1px solid ${cBorder}`, borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: tPrim, margin: 0 }}>{t("Módulos de la plataforma")}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {MODULES.map((mod) => (
              <ModuleCardItem key={mod.title} mod={mod} />
            ))}
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      {!search && activeSection === "faq" && (
        <section style={{ background: cBg, border: `1px solid ${cBorder}`, borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={acc} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: tPrim, margin: 0 }}>{t("Preguntas frecuentes")}</h2>
          </div>
          <FaqSection faq={FAQ} open={openFaq} setOpen={setOpenFaq} />
        </section>
      )}

      {/* ── Search results ──────────────────────────────────────────────────── */}
      {search && (
        <section style={{ background: cBg, border: `1px solid ${cBorder}`, borderRadius: "20px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
          {filteredModules.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: tFaint, margin: "0 0 12px" }}>{t("Módulos")} ({filteredModules.length})</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {filteredModules.map((mod) => (
                  <ModuleCardItem key={mod.title} mod={mod} highlight={search} />
                ))}
              </div>
            </div>
          )}
          {filteredFaq.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: tFaint, margin: "0 0 12px" }}>{t("Preguntas frecuentes")} ({filteredFaq.length})</p>
              <FaqSection faq={filteredFaq} open={openFaq} setOpen={setOpenFaq} />
            </div>
          )}
          {filteredModules.length === 0 && filteredFaq.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: tMuted }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={tFaint} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <p style={{ fontSize: 15, margin: 0, fontWeight: 600, color: tPrim }}>{t("Sin resultados para")} &ldquo;{search}&rdquo;</p>
              <p style={{ fontSize: 13, margin: "6px 0 0" }}>{t("Intenta con otras palabras clave.")}</p>
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <div style={{ paddingTop: 8, textAlign: "center", color: tFaint, fontSize: 12 }}>
        <p style={{ margin: "0 0 2px" }}>{t("Seven Arena · Plataforma de Gestión de Eventos Deportivos")}</p>
        <p style={{ margin: 0 }}>{t("¿Necesitas más ayuda? Contacta al equipo de soporte técnico.")}</p>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ModuleCardItem({ mod, highlight }: { mod: ModuleCard; highlight?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: cBg, border: `1px solid ${cBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 12, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${mod.badgeColor ?? "#64748b"}15`, border: `1px solid ${mod.badgeColor ?? "#64748b"}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ModBadgeIcon badge={mod.badge} color={mod.badgeColor ?? "#64748b"} size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: tPrim }}>
              {highlight ? <Highlight text={mod.title} term={highlight} /> : mod.title}
            </span>
            {mod.badge && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: mod.badgeColor ?? "#64748b", padding: "2px 7px", borderRadius: 8, letterSpacing: "0.04em", flexShrink: 0 }}>
                {mod.badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: tMuted, margin: 0, lineHeight: 1.5 }}>
            {highlight ? <Highlight text={mod.desc} term={highlight} /> : mod.desc}
          </p>
        </div>
        <Chevron open={open} />
      </button>

      <div style={{ overflow: "hidden", maxHeight: open ? "600px" : "0px", opacity: open ? 1 : 0, transition: "max-height 260ms ease, opacity 180ms ease" }}>
        <ul style={{ margin: 0, padding: "0 18px 16px 68px", listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {mod.items.map((item, i) => (
            <li key={i} style={{ fontSize: 12, color: tMuted, lineHeight: 1.55, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, marginTop: 3, width: 4, height: 4, borderRadius: "50%", background: tFaint, display: "inline-block" }} />
              <span>{highlight ? <Highlight text={item} term={highlight} /> : item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FaqSection({ faq, open, setOpen }: { faq: FaqItem[]; open: number | null; setOpen: (i: number | null) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {faq.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} style={{ background: isOpen ? "#f8fafc" : cBg, border: `1px solid ${isOpen ? acc + "40" : cBorder}`, borderRadius: 10, overflow: "hidden", transition: "border-color 180ms ease, background 150ms ease" }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 600, color: tPrim, flex: 1, lineHeight: 1.4 }}>{item.q}</span>
              <Chevron open={isOpen} color={isOpen ? acc : tFaint} />
            </button>
            <div style={{ overflow: "hidden", maxHeight: isOpen ? "300px" : "0px", opacity: isOpen ? 1 : 0, transition: "max-height 240ms ease, opacity 160ms ease" }}>
              <p style={{ fontSize: 13, color: tMuted, margin: 0, padding: "0 18px 16px", lineHeight: 1.65 }}>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const idx = lower.indexOf(lowerTerm);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#facc1560", color: "inherit", borderRadius: 2, padding: "0 2px" }}>
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}
