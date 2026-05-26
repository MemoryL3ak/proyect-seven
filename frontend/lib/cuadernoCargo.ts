/**
 * Cuaderno de Cargo — Bvan Traveling (Santiago 2023).
 * Contenido estructurado del documento de referencia operativa de transporte,
 * usado en el Centro de Ayuda con filtros por categoría y búsqueda.
 *
 * El contenido se mantiene en español: corresponde a un pliego oficial chileno
 * con nombres propios, direcciones y teléfonos que no se traducen. Solo las
 * etiquetas de categoría y los textos de la interfaz son multilingües.
 */

export type CuadernoLocale = "es" | "en" | "pt";

export type CuadernoCategoryKey =
  | "general"
  | "buses"
  | "areas"
  | "glosario"
  | "roles"
  | "regiones"
  | "recintos"
  | "hoteles"
  | "coordinadores";

export type CuadernoCategory = {
  key: CuadernoCategoryKey;
  label: Record<CuadernoLocale, string>;
  color: string;
};

export type CuadernoEntry = {
  category: CuadernoCategoryKey;
  term: string;
  detail: string;
  tags?: string[];
};

export const CUADERNO_INFO = {
  title: "Cuaderno de Cargo — Bvan Traveling",
  source: "docs/Cuaderno de cargo Bvan.pdf",
  desc: {
    es: "Pliego de bases de la operación de transporte de pasajeros de los Juegos Panamericanos y Parapanamericanos Santiago 2023. Glosario, roles, recintos, hoteles y coordinadores.",
    en: "Operations brief for the passenger transport of the Santiago 2023 Pan American and Parapan American Games. Glossary, roles, venues, hotels and coordinators.",
    pt: "Pliego de bases da operação de transporte de passageiros dos Jogos Pan-Americanos e Parapan-Americanos Santiago 2023. Glossário, funções, locais, hotéis e coordenadores.",
  },
};

export const CUADERNO_CATEGORIES: CuadernoCategory[] = [
  { key: "general", label: { es: "Resumen", en: "Overview", pt: "Resumo" }, color: "#64748b" },
  { key: "buses", label: { es: "Tipos de bus", en: "Bus types", pt: "Tipos de ônibus" }, color: "#f59e0b" },
  { key: "areas", label: { es: "Áreas funcionales", en: "Functional areas", pt: "Áreas funcionais" }, color: "#6366f1" },
  { key: "glosario", label: { es: "Glosario", en: "Glossary", pt: "Glossário" }, color: "#0ea5e9" },
  { key: "roles", label: { es: "Roles", en: "Roles", pt: "Funções" }, color: "#8b5cf6" },
  { key: "regiones", label: { es: "Regiones y sedes", en: "Regions & venues", pt: "Regiões e sedes" }, color: "#10b981" },
  { key: "recintos", label: { es: "Recintos deportivos", en: "Sports venues", pt: "Locais esportivos" }, color: "#ef4444" },
  { key: "hoteles", label: { es: "Hoteles", en: "Hotels", pt: "Hotéis" }, color: "#ec4899" },
  { key: "coordinadores", label: { es: "Coordinadores", en: "Coordinators", pt: "Coordenadores" }, color: "#14b8a6" },
];

export const CUADERNO_ENTRIES: CuadernoEntry[] = [
  // ── Resumen ───────────────────────────────────────────────────────────────
  {
    category: "general",
    term: "Cuaderno de Cargo — Servicios de Transporte de Pasajeros",
    detail:
      "Pliego de bases de la operación de transporte de pasajeros para los Juegos Panamericanos y Parapanamericanos Santiago 2023. Empresa operadora: Bvan Traveling (2023). Define glosario, roles, recintos, hoteles y rutas de la operación de transporte.",
    tags: ["panamericanos", "parapanamericanos", "santiago 2023", "pliego", "bases", "bvan"],
  },
  {
    category: "general",
    term: "Vigencia del documento",
    detail:
      "El documento corresponde al evento Santiago 2023 (ya realizado). Las fechas indicadas son de octubre y noviembre de 2023. Se utiliza como material de referencia operativa e histórica sobre transporte, recintos, hoteles y coordinadores.",
    tags: ["fechas", "octubre", "noviembre", "2023", "histórico"],
  },

  // ── Tipos de bus ──────────────────────────────────────────────────────────
  { category: "buses", term: "M1", detail: "Bus de 10 a 19 asientos.", tags: ["capacidad", "asientos", "minibus"] },
  { category: "buses", term: "M2", detail: "Bus de 20 a 30 asientos.", tags: ["capacidad", "asientos"] },
  { category: "buses", term: "M3", detail: "Bus de 31 a 40 asientos.", tags: ["capacidad", "asientos"] },
  { category: "buses", term: "M4", detail: "Bus de capacidad superior a 40 asientos.", tags: ["capacidad", "asientos"] },
  {
    category: "buses",
    term: "M5",
    detail: "Vehículo de accesibilidad universal (adaptado para personas con movilidad reducida).",
    tags: ["accesibilidad", "universal", "movilidad reducida", "parapanamericano"],
  },

  // ── Áreas funcionales ─────────────────────────────────────────────────────
  { category: "areas", term: "ACR", detail: "Acreditación (Accreditation).", tags: ["acreditación"] },
  { category: "areas", term: "BRS", detail: "Servicios de transmisión (Broadcast Services).", tags: ["broadcast", "transmisión", "medios"] },
  { category: "areas", term: "CER", detail: "Ceremonias (Ceremonies).", tags: ["ceremonias"] },
  { category: "areas", term: "LOG", detail: "Logística (Logistics).", tags: ["logística"] },
  { category: "areas", term: "SEC", detail: "Seguridad (Security).", tags: ["seguridad"] },
  { category: "areas", term: "SEQ", detail: "Equipamiento deportivo (Sport Equipment).", tags: ["equipamiento", "deportivo"] },
  { category: "areas", term: "TRA", detail: "Transporte (Transport).", tags: ["transporte"] },

  // ── Glosario ──────────────────────────────────────────────────────────────
  {
    category: "glosario",
    term: "Antigüedad",
    detail:
      "Resultado de restar al año actual el año de fabricación del vehículo, según el Registro Nacional de Vehículos Motorizados (Registro Civil).",
    tags: ["vehículo", "año", "fabricación", "registro civil"],
  },
  {
    category: "glosario",
    term: "Clúster",
    detail: "Agrupación de recintos ubicados en sectores o comunas aledañas.",
    tags: ["recintos", "comunas", "agrupación"],
  },
  {
    category: "glosario",
    term: "Villa Panamericana",
    detail:
      "Lugar de hospedaje de atletas, oficiales y personal de los equipos. Ubicada en Pedro Aguirre Cerda con Departamental, comuna de Cerrillos, Región Metropolitana.",
    tags: ["hospedaje", "atletas", "cerrillos", "villa"],
  },
  {
    category: "glosario",
    term: "Villas Satélites",
    detail: "Hospedajes ubicados fuera de la Región Metropolitana.",
    tags: ["hospedaje", "regiones"],
  },
  {
    category: "glosario",
    term: "Recintos de Competencia",
    detail: "Recinto deportivo donde se desarrollan las competencias del evento.",
    tags: ["recintos", "competencia"],
  },
  {
    category: "glosario",
    term: "Recintos de Entrenamiento",
    detail: "Recinto deportivo donde se desarrollan los entrenamientos del evento.",
    tags: ["recintos", "entrenamiento"],
  },
  {
    category: "glosario",
    term: "VAPP",
    detail:
      "Acreditación de los vehículos usados durante los Juegos. Su porte es obligatorio para ingresar a los recintos deportivos.",
    tags: ["acreditación", "vehículo", "credencial"],
  },
  {
    category: "glosario",
    term: "PIAC",
    detail: "Acreditación y tarjeta de identidad para personas. Debe portarse siempre.",
    tags: ["acreditación", "credencial", "identidad", "persona"],
  },
  {
    category: "glosario",
    term: "Gráfica",
    detail: "Imagen corporativa de los Juegos instalada en los vehículos.",
    tags: ["imagen", "corporativa", "vehículo", "branding"],
  },
  {
    category: "glosario",
    term: "MPC",
    detail: "Centro de Medios y Televisión (Main Press Center).",
    tags: ["medios", "prensa", "televisión", "press center"],
  },
  {
    category: "glosario",
    term: "Plan de Operación Preliminar",
    detail:
      "Archivos Excel adjuntos al proceso que el oferente toma como base para confeccionar el plan de operación solicitado.",
    tags: ["excel", "plan", "operación", "oferente"],
  },

  // ── Roles ─────────────────────────────────────────────────────────────────
  {
    category: "roles",
    term: "Coordinador Regional",
    detail:
      "Vela por la correcta ejecución del evento en su región. Mantiene comunicación fluida con los encargados de sede y supervisa su permanencia y funciones. Hace contacto permanente y seguimiento de las rutas de cada chofer. Visita los recintos deportivos y hoteles de cada comuna. Conoce las rutas diarias, la cantidad de delegaciones por recinto y de deportistas por delegación. Vela por el cumplimiento de contratos, horarios y rutas. Al término de cada jornada reporta al Encargado General de Regiones.",
    tags: ["coordinador", "regional", "supervisión", "rutas", "reporte"],
  },
  {
    category: "roles",
    term: "Coordinador de Sede",
    detail:
      "Mantiene comunicación fluida con el Coordinador Regional. Garantiza que la planificación de traslados diarios se cumpla en los horarios definidos. Mantiene contacto con los choferes de sus sedes y conoce el programa de competencia diario. Resguarda el uso de los estacionamientos disponibles. Permanece en el recinto durante toda la competencia y chequea la salida y llegada de las delegaciones a sus hoteles. Supervisa diariamente las credenciales de choferes y vehículos. Lleva registro diario de las vueltas y traslados de los choferes.",
    tags: ["coordinador", "sede", "traslados", "choferes", "credenciales", "estacionamientos"],
  },

  // ── Regiones y sedes ──────────────────────────────────────────────────────
  {
    category: "regiones",
    term: "V Región",
    detail:
      "Coordinador Regional: Rodrigo Bartolucci (+56 9 92273790). Apoyo de Coordinación: Tamara Morales (+56 9 30296234). Sedes: Valparaíso, Viña del Mar, Quillota, Algarrobo y El Quisco. Disciplinas: Fútbol, Balonmano, Vela, Triatlón y Ecuestre.",
    tags: ["valparaíso", "viña del mar", "quillota", "algarrobo", "el quisco", "fútbol", "balonmano", "vela", "triatlón", "ecuestre", "bartolucci"],
  },
  {
    category: "regiones",
    term: "VI Región",
    detail:
      "Coordinadora Regional: Eliara Klein (+56 9 82771134). Disciplina: Surf. Recinto: Playa Punta de Lobos, Pichilemu.",
    tags: ["surf", "pichilemu", "punta de lobos", "klein"],
  },
  {
    category: "regiones",
    term: "VIII Región",
    detail:
      "Coordinador Regional: José Hermosilla (+56 9 75465078). Apoyo de Coordinación: David Flores (+56 9 79318289). Disciplinas: Canotaje Velocidad y Remo. Recinto: Laguna Grande, San Pedro de la Paz (Bío-Bío).",
    tags: ["canotaje", "remo", "san pedro de la paz", "bío-bío", "concepción", "hermosilla"],
  },
  {
    category: "regiones",
    term: "Región Metropolitana",
    detail:
      "Coordinadora Regional: Daniela Molina. Concentra la mayor parte de las disciplinas: Aguas Abiertas, Atletismo, Clavados, Natación Artística, Polo Acuático, Bádminton, Gimnasia Artística, Esquí Acuático, Básquetbol, Básquetbol 3x3, Ciclismo, Esgrima, Boxeo, Bowling, Breaking, Natación, Patinaje, Hockey, Gimnasia Rítmica, Taekwondo, Tenis de Mesa, Pelota Vasca, Gimnasia Trampolín, Pentatlón, Judo, Skateboarding, Karate, Tenis, Levantamiento de Pesas, Lucha, Vóleibol, Racquetball, Squash, Rugby, Vóleibol Playa, Tiro con Arco, Escalada, Sóftbol, Béisbol y Golf.",
    tags: ["santiago", "rm", "metropolitana", "molina"],
  },

  // ── Recintos deportivos ───────────────────────────────────────────────────
  {
    category: "recintos",
    term: "Estadio Elías Figueroa",
    detail: "Fútbol (Competencia). Francisco Hontaneda #1310, Playa Ancha, Valparaíso. Responsable: Rodrigo Bartolucci.",
    tags: ["fútbol", "valparaíso", "playa ancha", "v región"],
  },
  {
    category: "recintos",
    term: "Estadio Sausalito",
    detail: "Fútbol (Competencia). Circunvalación Laguna Sausalito s/n, Viña del Mar. Responsable: Rodrigo Bartolucci.",
    tags: ["fútbol", "viña del mar", "v región"],
  },
  {
    category: "recintos",
    term: "Polideportivo de Viña del Mar",
    detail: "Balonmano (Competencia y Entrenamiento). Padre Hurtado #300, Viña del Mar. Responsable: Tamara Morales.",
    tags: ["balonmano", "viña del mar", "v región"],
  },
  {
    category: "recintos",
    term: "Polideportivo Nicolás Massú",
    detail: "Balonmano. Asunción #701, Villa Alemana. Responsable: Tamara Morales.",
    tags: ["balonmano", "villa alemana", "v región"],
  },
  {
    category: "recintos",
    term: "Playa El Sol",
    detail: "Triatlón (Competencia). Avenida San Martín s/n, Viña del Mar. Responsable: Rodrigo Bartolucci.",
    tags: ["triatlón", "viña del mar", "v región"],
  },
  {
    category: "recintos",
    term: "Escuela de Caballería",
    detail: "Ecuestre (Competencia y Entrenamiento). Larraguibel s/n, San Isidro. Responsable: Ricardo Guerra.",
    tags: ["ecuestre", "san isidro", "v región"],
  },
  {
    category: "recintos",
    term: "Cofradía Náutica",
    detail: "Vela (Competencia). José Toribio Merino #3877, Algarrobo. Responsable: Diego Farías.",
    tags: ["vela", "algarrobo", "v región"],
  },
  {
    category: "recintos",
    term: "Playa Punta de Lobos",
    detail: "Surf. Pichilemu, VI Región. Responsable: Eliara Klein.",
    tags: ["surf", "pichilemu", "vi región"],
  },
  {
    category: "recintos",
    term: "Laguna Grande",
    detail: "Canotaje Velocidad y Remo. San Pedro de la Paz, Bío-Bío. Responsable: José Hermosilla.",
    tags: ["canotaje", "remo", "san pedro de la paz", "viii región"],
  },
  {
    category: "recintos",
    term: "Estadio Nacional",
    detail:
      "Recinto principal de la Región Metropolitana. Alberga Clavados, Natación Artística, Polo Acuático, Atletismo, Básquetbol, Esgrima, Natación, Patinaje Velocidad, Hockey, Gimnasia Rítmica, Taekwondo, Gimnasia Artística y Trampolín, Judo, Skateboarding, Karate, Tenis, Racquetball y Squash. Coordinadora del Estadio: Luna Hernández (+56 9 21763083). Apoyo: Felipe Sánchez.",
    tags: ["santiago", "rm", "estadio nacional", "hernández"],
  },
  {
    category: "recintos",
    term: "Centro de Entrenamiento Olímpico (CEO)",
    detail: "Bádminton, Boxeo, Tenis de Mesa y Lucha (Masculina y Femenina). Región Metropolitana.",
    tags: ["bádminton", "boxeo", "tenis de mesa", "lucha", "rm"],
  },
  {
    category: "recintos",
    term: "Estadio Español",
    detail: "Básquetbol 3x3 y Pelota Vasca. Región Metropolitana.",
    tags: ["básquetbol 3x3", "pelota vasca", "rm"],
  },
  {
    category: "recintos",
    term: "Parque Peñalolén",
    detail:
      "Ciclismo Racing, Ciclismo Pista, Patinaje Artístico, Vóleibol Playa y Tiro con Arco. Comuna de Peñalolén, Región Metropolitana.",
    tags: ["ciclismo", "patinaje", "vóleibol playa", "tiro con arco", "peñalolén", "rm"],
  },
  {
    category: "recintos",
    term: "Parque O'Higgins",
    detail: "Atletismo Maratón y Marcha, Vóleibol Masculino y Femenino. Región Metropolitana.",
    tags: ["atletismo", "maratón", "marcha", "vóleibol", "rm"],
  },
  {
    category: "recintos",
    term: "Parque Bicentenario Cerrillos",
    detail: "Escalada, Sóftbol y Béisbol. Comuna de Cerrillos, Región Metropolitana.",
    tags: ["escalada", "sóftbol", "béisbol", "cerrillos", "rm"],
  },
  {
    category: "recintos",
    term: "Centro de Bowling (La Florida)",
    detail: "Bowling. Comuna de La Florida. Entrenamiento 29-31 oct; Competencia 1-4 nov.",
    tags: ["bowling", "la florida", "rm"],
  },
  {
    category: "recintos",
    term: "Prince of Wales Country Club",
    detail: "Golf. Región Metropolitana. Entrenamiento 30 oct-1 nov; Competencia 2-5 nov.",
    tags: ["golf", "rm"],
  },
  {
    category: "recintos",
    term: "Polígono de Tiro Pudahuel",
    detail: "Tiro. Comuna de Pudahuel. Entrenamiento 17-25 oct; Competencia 21-27 oct.",
    tags: ["tiro", "pudahuel", "rm"],
  },
  {
    category: "recintos",
    term: "Laguna Los Morros",
    detail: "Aguas Abiertas y Esquí Acuático. Región Metropolitana.",
    tags: ["aguas abiertas", "esquí acuático", "rm"],
  },
  {
    category: "recintos",
    term: "Estadio La Pintana",
    detail: "Rugby. Comuna de La Pintana. Competencia 3-4 nov.",
    tags: ["rugby", "la pintana", "rm"],
  },
  {
    category: "recintos",
    term: "San Carlos de Apoquindo",
    detail: "Ciclismo Mountain Bike. Región Metropolitana.",
    tags: ["ciclismo", "mountain bike", "rm"],
  },
  {
    category: "recintos",
    term: "Escuela Militar",
    detail: "Pentatlón. Región Metropolitana.",
    tags: ["pentatlón", "rm"],
  },
  {
    category: "recintos",
    term: "Explanada Deportes Urbanos / Gimnasio Chimkowe",
    detail: "Ciclismo Freestyle. Región Metropolitana. Competencia 5 nov.",
    tags: ["ciclismo freestyle", "chimkowe", "rm"],
  },
  {
    category: "recintos",
    term: "Calle Isla de Maipo",
    detail: "Ciclismo Ruta. Región Metropolitana. Entrenamiento 21 y 28 oct; Competencia 22 y 29 oct.",
    tags: ["ciclismo ruta", "isla de maipo", "rm"],
  },

  // ── Hoteles ───────────────────────────────────────────────────────────────
  {
    category: "hoteles",
    term: "Hoteles oficiales — Oficiales técnicos",
    detail: "Almacruz, Mercure y San Francisco (Santiago); Novotel Providencia; Novotel Vitacura; Icon (Las Condes).",
    tags: ["oficiales técnicos", "almacruz", "mercure", "san francisco", "novotel", "icon"],
  },
  {
    category: "hoteles",
    term: "Hoteles oficiales — Medios",
    detail: "Hotel Nodo, Capital Hotel Bellet, Hotel Diego de Almagro, Hotel Torremayor y Panamericana Hotel (todos en Providencia).",
    tags: ["medios", "prensa", "nodo", "bellet", "diego de almagro", "torremayor", "panamericana"],
  },
  {
    category: "hoteles",
    term: "Hotel oficial — Familia",
    detail: "Hotel Sheraton.",
    tags: ["familia", "sheraton"],
  },
  {
    category: "hoteles",
    term: "Hotelería V Región",
    detail:
      "Best Western Marina Del Rey (Viña del Mar), Hippocampus (Concón), Novotel y Pullman (Viña del Mar), Mantagua (Ruta Concón-Quintero), Hotel Gala (Viña del Mar), Hotel Piemonte, Hostería El Copihue y Cabañas Parador de Darwin (Olmué), Hotel Huallilemu (El Quisco) y ASMAR (Algarrobo).",
    tags: ["v región", "viña del mar", "concón", "olmué", "marina del rey", "hippocampus", "pullman"],
  },
  {
    category: "hoteles",
    term: "Hotelería VI Región",
    detail:
      "Buda Lodge (Pichilemu) — Oficiales técnicos. Tinajas del Mar, Lomas de Pinares y Ranchos de Pinares (Cahuil, Pichilemu) — Atletas y oficiales de equipo.",
    tags: ["vi región", "pichilemu", "buda lodge", "cahuil"],
  },
  {
    category: "hoteles",
    term: "Hotelería VIII Región",
    detail:
      "MDS Hotel Concepción (ex Sonesta), Hotel Araucano y Hotel Mercure, todos en Concepción — Oficiales técnicos, atletas y oficiales de equipo.",
    tags: ["viii región", "concepción", "mds", "araucano", "mercure"],
  },
  {
    category: "hoteles",
    term: "Hoteles Región Metropolitana",
    detail:
      "Almacruz, San Francisco, Mercure, Panamericana, Capital Bellet, Intercontinental, Nodo Las Condes, Torremayor Lyon, Pullman El Bosque, Novotel Providencia, Novotel Las Condes, Icon, Mandarin Oriental, Marriott, Sheraton y Four Points by Sheraton.",
    tags: ["rm", "santiago", "intercontinental", "mandarin oriental", "marriott", "four points"],
  },

  // ── Coordinadores ─────────────────────────────────────────────────────────
  {
    category: "coordinadores",
    term: "Luna Hernández",
    detail: "Coordinadora del Estadio Nacional. Teléfono: +56 9 21763083.",
    tags: ["estadio nacional", "rm"],
  },
  {
    category: "coordinadores",
    term: "Felipe Sánchez",
    detail: "Apoyo de Coordinación del Estadio Nacional.",
    tags: ["estadio nacional", "rm", "apoyo"],
  },
  {
    category: "coordinadores",
    term: "José Bustamante",
    detail: "Coordina Clavados y Natación Artística en el Estadio Nacional. Teléfono: +56 9 84618868.",
    tags: ["clavados", "natación artística", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Patricio Curipán",
    detail: "Coordina Polo Acuático en el Estadio Nacional. Teléfono: +56 9 72271785.",
    tags: ["polo acuático", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "David Valdés",
    detail: "Coordina Atletismo de Estadio en el Estadio Nacional. Teléfono: +56 9 65683449.",
    tags: ["atletismo", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Javier Cortés",
    detail: "Coordina Básquetbol Masculino en el Estadio Nacional. Teléfono: +56 9 93639261.",
    tags: ["básquetbol", "masculino", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Mario Lagos",
    detail: "Coordina Básquetbol Femenino en el Estadio Nacional. Teléfono: +56 9 89800841.",
    tags: ["básquetbol", "femenino", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Luis Cancino",
    detail: "Coordina Esgrima en el Estadio Nacional. Teléfono: +56 9 84342019.",
    tags: ["esgrima", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Antonio Ortiz",
    detail: "Coordina Natación en el Estadio Nacional. Teléfono: +56 9 86023306.",
    tags: ["natación", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Marco Henríquez",
    detail: "Coordina Patinaje Velocidad (Estadio Nacional) y Ciclismo Ruta (Calle Isla de Maipo). Teléfono: +56 9 51532124.",
    tags: ["patinaje velocidad", "ciclismo ruta", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Francisco Celis",
    detail: "Coordina Hockey Femenino y Masculino en el Estadio Nacional. Teléfono: +56 9 88421172.",
    tags: ["hockey", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Camila Gutiérrez",
    detail: "Coordina Gimnasia Rítmica (Estadio Nacional) y Ciclismo Pista (Parque Peñalolén). Teléfono: +56 9 57228559.",
    tags: ["gimnasia rítmica", "ciclismo pista", "estadio nacional", "peñalolén"],
  },
  {
    category: "coordinadores",
    term: "Félix Henríquez",
    detail: "Coordina Taekwondo (Poomsae y Kyorugi) en el Estadio Nacional y Lucha en el CEO. Teléfono: +56 9 94195640.",
    tags: ["taekwondo", "lucha", "estadio nacional", "ceo"],
  },
  {
    category: "coordinadores",
    term: "Daniel Santander",
    detail: "Coordina Gimnasia Artística Masculina en el Estadio Nacional. Teléfono: +56 9 96409163.",
    tags: ["gimnasia artística", "masculina", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Matías Luna",
    detail: "Coordina Gimnasia de Trampolín en el Estadio Nacional. Teléfono: +56 9 52060204.",
    tags: ["gimnasia trampolín", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Víctor Muñoz",
    detail: "Coordina Judo y Skateboarding (Estadio Nacional) y Ciclismo Freestyle (Chimkowe). Teléfono: +56 9 61937525.",
    tags: ["judo", "skateboarding", "ciclismo freestyle", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Mario Calderón",
    detail: "Coordina Karate (Kata y Kumite) en el Estadio Nacional. Teléfono: +56 9 66377616.",
    tags: ["karate", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Cristian Silva",
    detail: "Coordina Tenis en el Estadio Nacional. Teléfono: +56 9 93568920.",
    tags: ["tenis", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Cristian Olivares",
    detail: "Coordina Racquetball y Squash en el Estadio Nacional. Teléfono: +56 9 54992798.",
    tags: ["racquetball", "squash", "estadio nacional"],
  },
  {
    category: "coordinadores",
    term: "Isabel Olguín",
    detail: "Coordina Bowling (Centro de Bowling, La Florida) y Boxeo (CEO). Teléfono: +56 9 93431751.",
    tags: ["bowling", "boxeo", "la florida", "ceo"],
  },
  {
    category: "coordinadores",
    term: "Marcos Flores",
    detail: "Coordina Bádminton (CEO) y Pelota Vasca (Estadio Español). Teléfono: +56 9 77932118.",
    tags: ["bádminton", "pelota vasca", "ceo", "estadio español"],
  },
  {
    category: "coordinadores",
    term: "Pablo Vial",
    detail: "Coordina Tenis de Mesa (CEO) y Ciclismo Mountain Bike (San Carlos de Apoquindo). Teléfono: +56 9 81981290.",
    tags: ["tenis de mesa", "ciclismo mountain bike", "ceo"],
  },
  {
    category: "coordinadores",
    term: "Scarlett Osorio",
    detail: "Coordina Pentatlón (Escuela Militar) y Tiro con Arco (Parque Peñalolén). Teléfono: +56 9 47702897.",
    tags: ["pentatlón", "tiro con arco", "escuela militar", "peñalolén"],
  },
  {
    category: "coordinadores",
    term: "Marcela Valenzuela",
    detail: "Coordina Básquetbol 3x3 en el Estadio Español. Teléfono: +56 9 63484984.",
    tags: ["básquetbol 3x3", "estadio español"],
  },
  {
    category: "coordinadores",
    term: "Tomás Hormazábal",
    detail: "Coordina Rugby (Estadio La Pintana) y Vóleibol Playa (Parque Peñalolén). Teléfono: +56 9 45896360.",
    tags: ["rugby", "vóleibol playa", "la pintana", "peñalolén"],
  },
  {
    category: "coordinadores",
    term: "Laura Paulo",
    detail: "Coordina Aguas Abiertas y Esquí Acuático en Laguna Los Morros. Teléfono: +56 9 34966706.",
    tags: ["aguas abiertas", "esquí acuático", "los morros"],
  },
  {
    category: "coordinadores",
    term: "Bernardita Matías",
    detail: "Coordina Escalada en el Parque Bicentenario Cerrillos. Teléfono: +56 9 58184993.",
    tags: ["escalada", "cerrillos"],
  },
  {
    category: "coordinadores",
    term: "José Calfuqueo",
    detail: "Coordina Sóftbol en el Parque Bicentenario Cerrillos. Teléfono: +56 9 65728271.",
    tags: ["sóftbol", "cerrillos"],
  },
  {
    category: "coordinadores",
    term: "Minerva Navarrete",
    detail: "Coordina Béisbol en el Parque Bicentenario Cerrillos. Teléfono: +56 9 88100000.",
    tags: ["béisbol", "cerrillos"],
  },
  {
    category: "coordinadores",
    term: "Ruth Suazo",
    detail: "Coordina Atletismo Maratón y Marcha en el Parque O'Higgins. Teléfono: +56 9 91899095.",
    tags: ["atletismo", "maratón", "marcha", "o'higgins"],
  },
  {
    category: "coordinadores",
    term: "Sebastián Vásquez",
    detail: "Coordina Vóleibol Masculino y Femenino en el Parque O'Higgins. Teléfono: +56 9 93311460.",
    tags: ["vóleibol", "o'higgins"],
  },
  {
    category: "coordinadores",
    term: "Paola Ahumada",
    detail: "Coordina Ciclismo Racing y Patinaje Artístico en el Parque Peñalolén. Teléfono: +56 9 93311667.",
    tags: ["ciclismo racing", "patinaje artístico", "peñalolén"],
  },
  {
    category: "coordinadores",
    term: "Daniela Dorner",
    detail: "Coordina Golf en el Prince of Wales Country Club. Teléfono: +56 9 56839092.",
    tags: ["golf", "prince of wales"],
  },
  {
    category: "coordinadores",
    term: "Francisca Madrid",
    detail: "Coordina Tiro en el Polígono de Tiro Pudahuel.",
    tags: ["tiro", "pudahuel"],
  },
  {
    category: "coordinadores",
    term: "Rodrigo Bartolucci",
    detail: "Coordinador Regional de la V Región. Teléfono: +56 9 92273790.",
    tags: ["v región", "regional", "valparaíso"],
  },
  {
    category: "coordinadores",
    term: "Tamara Morales",
    detail: "Apoyo de Coordinación de la V Región. Teléfono: +56 9 30296234.",
    tags: ["v región", "apoyo"],
  },
  {
    category: "coordinadores",
    term: "Eliara Klein",
    detail: "Coordinadora Regional de la VI Región (Surf, Pichilemu). Teléfono: +56 9 82771134.",
    tags: ["vi región", "regional", "surf", "pichilemu"],
  },
  {
    category: "coordinadores",
    term: "José Hermosilla",
    detail: "Coordinador Regional de la VIII Región (Canotaje y Remo). Teléfono: +56 9 75465078.",
    tags: ["viii región", "regional", "canotaje", "remo"],
  },
  {
    category: "coordinadores",
    term: "David Flores",
    detail: "Apoyo de Coordinación de la VIII Región. Teléfono: +56 9 79318289.",
    tags: ["viii región", "apoyo"],
  },
  {
    category: "coordinadores",
    term: "Daniela Molina",
    detail: "Coordinadora Regional de la Región Metropolitana.",
    tags: ["rm", "regional", "santiago"],
  },
  {
    category: "coordinadores",
    term: "Ricardo Guerra",
    detail: "Responsable del recinto Ecuestre (Escuela de Caballería, San Isidro).",
    tags: ["ecuestre", "v región", "san isidro"],
  },
  {
    category: "coordinadores",
    term: "Diego Farías",
    detail: "Responsable del recinto de Vela (Cofradía Náutica, Algarrobo).",
    tags: ["vela", "v región", "algarrobo"],
  },
];
