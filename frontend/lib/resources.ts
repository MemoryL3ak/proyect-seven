export type FieldType =
  | "text"
  | "number"
  | "datetime"
  | "date"
  | "json"
  | "select"
  | "multiselect"
  | "file";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  optionsSource?:
    | "events"
    | "delegations"
    | "providers"
    | "accommodations"
    | "venues"
    | "vehicles"
    | "drivers"
    | "driverUsers"
    | "athletes"
    | "hotelRooms"
    | "hotelBeds"
    | "disciplines"
    | "accommodationTowers"
    | "hotelExtras";
  transient?: boolean;
  formHidden?: boolean;
  readOnly?: boolean;
  /** Muestra este campo solo cuando el campo `field` tenga el valor `value` */
  showWhen?: { field: string; value: string };
};

export type ResourceConfig = {
  name: string;
  description: string;
  endpoint: string;
  fields: FieldDef[];
  tableHiddenKeys?: string[];
  tableOrder?: string[];
};

export const resources: Record<string, ResourceConfig> = {
  events: {
    name: "Eventos",
    description: "Gestiona eventos deportivos y su configuración operativa.",
    endpoint: "/events",
    tableHiddenKeys: ["disciplineIds"],
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true },
      { key: "country", label: "País", type: "text" },
      { key: "city", label: "Ciudad", type: "text" },
      { key: "startDate", label: "Fecha inicio", type: "date" },
      { key: "endDate", label: "Fecha término", type: "date" },
      {
        key: "disciplineCategory",
        label: "Categoría de disciplina",
        type: "select",
        transient: true,
        options: [
          { label: "Convencional", value: "CONVENTIONAL" },
          { label: "Paralímpica", value: "PARALYMPIC" }
        ]
      },
      {
        key: "disciplineGender",
        label: "Género de disciplina",
        type: "select",
        transient: true,
        options: [
          { label: "Masculino", value: "MALE" },
          { label: "Femenino", value: "FEMALE" }
        ]
      },
      {
        key: "disciplineIds",
        label: "Disciplinas",
        type: "multiselect",
        optionsSource: "disciplines"
      }
    ]
  },
  disciplines: {
    name: "Disciplinas",
    description: "Catálogo de disciplinas deportivas.",
    endpoint: "/disciplines",
    tableHiddenKeys: ["id"],
    fields: [
      { key: "name", label: "Disciplina", type: "text", required: true },
      { key: "eventId", label: "Evento", type: "select", optionsSource: "events" },
      {
        key: "category",
        label: "Categoría",
        type: "select",
        options: [
          { label: "Convencional", value: "CONVENTIONAL" },
          { label: "Paralímpica", value: "PARALYMPIC" }
        ]
      },
      {
        key: "gender",
        label: "Género",
        type: "select",
        options: [
          { label: "Masculino", value: "MALE" },
          { label: "Femenino", value: "FEMALE" }
        ]
      }
    ]
  },
  delegations: {
    name: "AND",
    description: "Arrival and Departure: delegación y participantes.",
    endpoint: "/delegations",
    tableOrder: [
      "eventId",
      "countryCode",
      "disciplineCategory",
      "disciplineGender",
      "participantFullName",
      "participantUserType",
      "participantPhone",
      "participantTripType",
      "participantEmail",
      "participantVisaRequired",
      "participantDisciplineId",
      "participantIsDelegationLead",
      "participantCountryCode"
    ],
    tableHiddenKeys: [
      "participantRut",
      "participantPassportNumber",
      "participantBirthDate",
      "participantFlightNumber",
      "participantAirline",
      "participantOrigin",
      "participantDepartureGate",
      "participantArrivalBaggage",
      "participantBag8Count",
      "participantSuitcase10Count",
      "participantSuitcase15Count",
      "participantSuitcase23Count",
      "participantOversizeText",
      "participantVolume",
      "participantWheelchairUser",
      "participantWheelchairStandardCount",
      "participantWheelchairSportCount",
      "participantSportsEquipment",
      "participantRequiresAssistance",
      "participantObservations",
      "participantRegion",
      "participantTransportType",
      "participantBusPlate",
      "participantBusDriverName",
      "participantBusCompany",
      "participantHotelAccommodationId",
      "participantRoomType",
      "participantBedType",
      "participantRoomNumber"
    ],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      {
        key: "countryCode",
        label: "País",
        type: "select",
        required: true,
        options: [
          { label: "Argentina", value: "ARG" },
          { label: "Bolivia", value: "BOL" },
          { label: "Brasil", value: "BRA" },
          { label: "Chile", value: "CHL" },
          { label: "Colombia", value: "COL" },
          { label: "Ecuador", value: "ECU" },
          { label: "Paraguay", value: "PRY" },
          { label: "Perú", value: "PER" },
          { label: "Uruguay", value: "URY" },
          { label: "Venezuela", value: "VEN" },
          { label: "México", value: "MEX" },
          { label: "Estados Unidos", value: "USA" },
          { label: "Canadá", value: "CAN" },
          { label: "España", value: "ESP" },
          { label: "Francia", value: "FRA" },
          { label: "Alemania", value: "DEU" },
          { label: "Italia", value: "ITA" },
          { label: "Portugal", value: "PRT" },
          { label: "Reino Unido", value: "GBR" }
        ]
      },
      {
        key: "disciplineCategory",
        label: "Categoría",
        type: "select",
        transient: true,
        options: [
          { label: "Convencional", value: "CONVENTIONAL" },
          { label: "Paralímpica", value: "PARALYMPIC" }
        ]
      },
      {
        key: "disciplineGender",
        label: "Género",
        type: "select",
        transient: true,
        options: [
          { label: "Masculino", value: "MALE" },
          { label: "Femenino", value: "FEMALE" }
        ]
      },
      { key: "participantFullName", label: "Nombre completo", type: "text", transient: true },
      { key: "participantUserType", label: "Tipo de cliente", type: "text", transient: true },
      { key: "participantPhone", label: "Teléfono", type: "text", transient: true },
      { key: "participantEmail", label: "Correo electrónico", type: "text", transient: true },
      {
        key: "participantDisciplineId",
        label: "Disciplina",
        type: "select",
        optionsSource: "disciplines",
        transient: true
      },
      {
        key: "participantIsDelegationLead",
        label: "Encargado de delegación",
        type: "select",
        transient: true,
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ]
      },
      {
        key: "participantCountryCode",
        label: "País (participante)",
        type: "select",
        transient: true,
        options: [
          { label: "Argentina", value: "ARG" },
          { label: "Bolivia", value: "BOL" },
          { label: "Brasil", value: "BRA" },
          { label: "Chile", value: "CHL" },
          { label: "Colombia", value: "COL" },
          { label: "Ecuador", value: "ECU" },
          { label: "Paraguay", value: "PRY" },
          { label: "Perú", value: "PER" },
          { label: "Uruguay", value: "URY" },
          { label: "Venezuela", value: "VEN" },
          { label: "México", value: "MEX" },
          { label: "Estados Unidos", value: "USA" },
          { label: "Canadá", value: "CAN" },
          { label: "España", value: "ESP" },
          { label: "Francia", value: "FRA" },
          { label: "Alemania", value: "DEU" },
          { label: "Italia", value: "ITA" },
          { label: "Portugal", value: "PRT" },
          { label: "Reino Unido", value: "GBR" }
        ]
      },
      { key: "participantRut", label: "RUT", type: "text", transient: true },
      { key: "participantPassportNumber", label: "Pasaporte", type: "text", transient: true },
      {
        key: "participantVisaRequired",
        label: "Visa",
        type: "select",
        transient: true,
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ]
      },
      { key: "participantBirthDate", label: "Fecha nacimiento", type: "date", transient: true },
      {
        key: "participantTripType",
        label: "Tipo de viaje",
        type: "select",
        transient: true,
        options: [
          { label: "Llegada", value: "ARRIVAL" },
          { label: "Salida", value: "DEPARTURE" }
        ]
      },
      {
        key: "participantArrivalTime",
        label: "Fecha y hora de llegada",
        type: "datetime",
        transient: true
      },
      {
        key: "participantDepartureTime",
        label: "Fecha y hora de salida",
        type: "datetime",
        transient: true
      },
      { key: "participantFlightNumber", label: "Número de vuelo", type: "text", transient: true },
      { key: "participantAirline", label: "Aerolínea", type: "text", transient: true },
      { key: "participantOrigin", label: "Origen", type: "text", transient: true },
      {
        key: "participantDepartureGate",
        label: "Puerta de embarque",
        type: "text",
        transient: true
      },
      {
        key: "participantArrivalBaggage",
        label: "Puerta de embarque",
        type: "text",
        transient: true
      },
      { key: "participantBolsoCount", label: "Bolso", type: "number", transient: true },
      { key: "participantBag8Count", label: "Maleta de 8", type: "number", transient: true },
      { key: "participantSuitcase10Count", label: "Maleta de 10", type: "number", transient: true },
      { key: "participantSuitcase15Count", label: "Maleta de 15", type: "number", transient: true },
      { key: "participantSuitcase23Count", label: "Maleta de 23", type: "number", transient: true },
      { key: "participantOversizeText", label: "Sobreequipaje", type: "text", transient: true },
      { key: "participantVolume", label: "Volumen", type: "text", transient: true },
      {
        key: "participantWheelchairUser",
        label: "Usuario en silla de ruedas",
        type: "select",
        transient: true,
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ]
      },
      {
        key: "participantWheelchairStandardCount",
        label: "Silla de ruedas convencional",
        type: "number",
        transient: true
      },
      {
        key: "participantWheelchairSportCount",
        label: "Silla de ruedas deportiva",
        type: "number",
        transient: true
      },
      { key: "participantSportsEquipment", label: "Equipamiento deportivo", type: "text", transient: true },
      {
        key: "participantRequiresAssistance",
        label: "Requiere asistencia",
        type: "select",
        transient: true,
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ]
      },
      { key: "participantObservations", label: "Observaciones", type: "text", transient: true },
      {
        key: "participantRegion",
        label: "Región",
        type: "select",
        transient: true,
        options: [
          { label: "Arica y Parinacota", value: "ARICA_Y_PARINACOTA" },
          { label: "Tarapacá", value: "TARAPACA" },
          { label: "Antofagasta", value: "ANTOFAGASTA" },
          { label: "Atacama", value: "ATACAMA" },
          { label: "Coquimbo", value: "COQUIMBO" },
          { label: "Valparaíso", value: "VALPARAISO" },
          { label: "Metropolitana de Santiago", value: "METROPOLITANA" },
          { label: "Libertador Gral. B. O'Higgins", value: "OHIGGINS" },
          { label: "Maule", value: "MAULE" },
          { label: "Ñuble", value: "NUBLE" },
          { label: "Biobío", value: "BIOBIO" },
          { label: "La Araucanía", value: "ARAUCANIA" },
          { label: "Los Ríos", value: "LOS_RIOS" },
          { label: "Los Lagos", value: "LOS_LAGOS" },
          { label: "Aysén del Gral. C. Ibáñez del Campo", value: "AYSEN" },
          { label: "Magallanes y de la Antártica Chilena", value: "MAGALLANES" }
        ]
      },
      {
        key: "participantTransportType",
        label: "Tipo de transporte",
        type: "select",
        transient: true,
        options: [
          { label: "Avión", value: "AVION" },
          { label: "Bus", value: "BUS" }
        ]
      },
      { key: "participantBusPlate", label: "Patente Bus", type: "text", transient: true },
      { key: "participantBusDriverName", label: "Nombre Chofer", type: "text", transient: true },
      { key: "participantBusCompany", label: "Empresa Bus", type: "text", transient: true },
      { key: "participantHotelAccommodationId", label: "Hotel", type: "select", optionsSource: "accommodations", transient: true },
      {
        key: "participantRoomType",
        label: "Tipo de habitación",
        type: "select",
        options: [
          { label: "Single", value: "SINGLE" },
          { label: "Double", value: "DOUBLE" },
          { label: "Triple", value: "TRIPLE" },
          { label: "Suite", value: "SUITE" }
        ],
        transient: true
      },
      {
        key: "participantBedType",
        label: "Tipo de cama",
        type: "select",
        options: [
          { label: "Single", value: "SINGLE" },
          { label: "Double", value: "DOUBLE" },
          { label: "Queen", value: "QUEEN" },
          { label: "King", value: "KING" }
        ],
        transient: true
      },
      { key: "participantRoomNumber", label: "Habitación", type: "text", transient: true }
    ]
  },
  flights: {
    name: "Vuelos",
    description: "Arribos y datos de vuelos por delegación.",
    endpoint: "/flights",
    fields: [
      { key: "eventId", label: "Event ID", type: "text", required: true },
      { key: "flightNumber", label: "Número de vuelo", type: "text", required: true },
      { key: "airline", label: "Aerolínea", type: "text", required: true },
      { key: "arrivalTime", label: "Arribo", type: "datetime" },
      { key: "origin", label: "Origen", type: "text", required: true },
      { key: "terminal", label: "Terminal", type: "text" }
    ]
  },
  transports: {
    name: "Flota",
    description: "Vehículos disponibles y su estado.",
    endpoint: "/transports",
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "plate", label: "Patente", type: "text", required: true },
      {
        key: "type",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          { label: "Sedan/Suv", value: "SEDAN" },
          { label: "Van", value: "VAN" },
          { label: "Mini Bus", value: "MINI_BUS" },
          { label: "Bus", value: "BUS" }
        ]
      },
      { key: "capacity", label: "Capacidad", type: "number" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Disponible", value: "AVAILABLE" },
          { label: "En servicio", value: "IN_SERVICE" },
          { label: "Mantenimiento", value: "MAINTENANCE" }
        ]
      }
    ]
  },
  drivers: {
    name: "Conductores",
    description: "Registro de conductores y flota asociada.",
    endpoint: "/drivers",
    tableHiddenKeys: [
      "id",
      "providerId",
      "licenseNumber",
      "vehiclePlate",
      "vehicleType",
      "vehicleBrand",
      "vehicleModel",
      "vehicleCapacity",
      "vehicleStatus",
      "photoDataUrl",
      "photoUrl",
      "status"
    ],
    tableOrder: ["fullName", "rut", "eventId", "email", "phone", "accessTypes"],
    fields: [
      { key: "providerId", label: "Proveedor", type: "select", required: true, optionsSource: "providers" },
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      { key: "rut", label: "RUT", type: "text", required: true },
      { key: "email", label: "Correo electrónico", type: "text", required: true },
      {
        key: "licenseNumber",
        label: "Licencia",
        type: "select",
        options: [
          { label: "Clase B", value: "B" },
          { label: "Clase C", value: "C" },
          { label: "Clase A1", value: "A1" },
          { label: "Clase A2", value: "A2" },
          { label: "Clase A3", value: "A3" },
          { label: "Clase A4", value: "A4" },
          { label: "Clase A5", value: "A5" }
        ]
      },
      {
        key: "accessTypes",
        label: "Accesos",
        type: "multiselect",
        options: [
          { label: "C - Cancha", value: "C" },
          { label: "TR - Transporte", value: "TR" },
          { label: "H - Hotel", value: "H" },
          { label: "R - Reuniones", value: "R" },
          { label: "A - Alimentación", value: "A" },
          { label: "RD - Recintos Deportivos", value: "RD" }
        ]
      },
      { key: "phone", label: "Teléfono", type: "text" },
      { key: "vehiclePlate", label: "Patente", type: "text", required: true },
      {
        key: "vehicleType",
        label: "Tipo de vehículo",
        type: "select",
        required: true,
        options: [
          { label: "Sedan/Suv", value: "SEDAN" },
          { label: "Van", value: "VAN" },
          { label: "Mini Bus", value: "MINI_BUS" },
          { label: "Bus", value: "BUS" }
        ]
      },
      { key: "vehicleBrand", label: "Marca", type: "text" },
      { key: "vehicleModel", label: "Modelo", type: "text" },
      { key: "vehicleCapacity", label: "Capacidad", type: "number" },
      { key: "budgetAmount", label: "Monto licitado / presupuesto (CLP)", type: "number" },
      {
        key: "photoDataUrl",
        label: "Foto del conductor",
        type: "file",
        transient: true
      },
      { key: "photoUrl", label: "Foto", type: "text", formHidden: true },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Activo", value: "ACTIVE" },
          { label: "Inactivo", value: "INACTIVE" }
        ]
      }
    ]
  },
  providers: {
    name: "Proveedores",
    description: "Proveedores registrados para operaciones.",
    endpoint: "/providers",
    fields: [
      { key: "name", label: "Nombre", type: "text", required: true },
      { key: "email", label: "Correo", type: "text" },
      { key: "rut", label: "RUT", type: "text" }
    ]
  },
  venues: {
    name: "Sedes",
    description: "Registro maestro de sedes y recintos operativos.",
    endpoint: "/venues",
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "name", label: "Sede", type: "text", required: true },
      { key: "address", label: "Dirección", type: "text", required: true },
      { key: "region", label: "Región", type: "text" },
      { key: "commune", label: "Comuna", type: "text" }
    ]
  },
  athletes: {
    name: "Inscripción de participantes",
    description: "Registro largo de participantes previo a validación AND.",
    endpoint: "/athletes",
    tableHiddenKeys: [
      "id",
      "metadata"
    ],
    tableOrder: [
      "fullName",
      "eventId",
      "delegationId",
      "disciplineId",
      "countryCode",
      "passportNumber",
      "dateOfBirth",
      "phone",
      "email",
      "userType",
      "visaRequired",
      "status"
    ],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "delegationId", label: "Delegación", type: "select", optionsSource: "delegations" },
      { key: "disciplineId", label: "Disciplina", type: "select", optionsSource: "disciplines" },
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      {
        key: "userType",
        label: "Tipo de cliente",
        type: "select",
        options: [
          { label: "VIP", value: "VIP" },
          { label: "Familia Parapan", value: "FAMILIA_PARAPAN" },
          { label: "TA (Deportista)", value: "TA" },
          { label: "TF (Oficiales Técnicos)", value: "TF" },
          { label: "TM (Prensa)", value: "TM" },
          { label: "Comité Organizador", value: "COMITE_ORGANIZADOR" },
          { label: "Proveedores", value: "PROVEEDORES" }
        ]
      },
      {
        key: "countryCode",
        label: "País",
        type: "select",
        options: [
          { label: "Argentina", value: "ARG" },
          { label: "Bolivia", value: "BOL" },
          { label: "Brasil", value: "BRA" },
          { label: "Chile", value: "CHL" },
          { label: "Colombia", value: "COL" },
          { label: "Ecuador", value: "ECU" },
          { label: "Paraguay", value: "PRY" },
          { label: "Perú", value: "PER" },
          { label: "Uruguay", value: "URY" },
          { label: "Venezuela", value: "VEN" },
          { label: "México", value: "MEX" },
          { label: "Estados Unidos", value: "USA" },
          { label: "Canadá", value: "CAN" },
          { label: "España", value: "ESP" },
          { label: "Francia", value: "FRA" },
          { label: "Alemania", value: "DEU" },
          { label: "Italia", value: "ITA" },
          { label: "Portugal", value: "PRT" },
          { label: "Reino Unido", value: "GBR" }
        ]
      },
      { key: "passportNumber", label: "Pasaporte", type: "text" },
      { key: "rut", label: "RUT", type: "text" },
      { key: "dateOfBirth", label: "Fecha nacimiento", type: "date" },
      { key: "phone", label: "Teléfono", type: "text" },
      { key: "email", label: "Correo electrónico", type: "text" },
      {
        key: "visaRequired",
        label: "Visa requerida",
        type: "select",
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ]
      },
      {
        key: "dietaryNeeds",
        label: "Tipo de alimentación",
        type: "select",
        options: [
          { label: "Estándar", value: "ESTANDAR" },
          { label: "Vegetariano", value: "VEGETARIANO" },
          { label: "Vegano", value: "VEGANO" },
          { label: "Sin gluten", value: "SIN_GLUTEN" },
          { label: "Sin lactosa", value: "SIN_LACTOSA" },
          { label: "Halal", value: "HALAL" },
          { label: "Kosher", value: "KOSHER" },
          { label: "Sin mariscos", value: "SIN_MARISCOS" },
          { label: "Diabético", value: "DIABETICO" },
          { label: "Otro", value: "OTRO" }
        ]
      },
      {
        key: "tripType",
        label: "Tipo de viaje",
        type: "select",
        options: [
          { label: "Llegada", value: "ARRIVAL" },
          { label: "Salida", value: "DEPARTURE" }
        ]
      },
      { key: "flightNumber", label: "Número de vuelo", type: "text" },
      { key: "airline", label: "Aerolínea", type: "text" },
      { key: "origin", label: "Origen", type: "text" },
      { key: "arrivalTime", label: "Fecha y hora de llegada", type: "datetime" },
      { key: "departureTime", label: "Fecha y hora de salida", type: "datetime" },
      { key: "departureGate", label: "Puerta de embarque", type: "text" },
      {
        key: "transportType",
        label: "Tipo de transporte",
        type: "select",
        options: [
          { label: "Avión", value: "AVION" },
          { label: "Bus", value: "BUS" }
        ]
      },
      { key: "busPlate", label: "Patente Bus", type: "text" },
      { key: "busDriverName", label: "Nombre Chofer", type: "text" },
      { key: "busCompany", label: "Empresa Bus", type: "text" },
      {
        key: "region",
        label: "Región",
        type: "select",
        options: [
          { label: "Arica y Parinacota", value: "ARICA_PARINACOTA" },
          { label: "Tarapacá", value: "TARAPACA" },
          { label: "Antofagasta", value: "ANTOFAGASTA" },
          { label: "Atacama", value: "ATACAMA" },
          { label: "Coquimbo", value: "COQUIMBO" },
          { label: "Valparaíso", value: "VALPARAISO" },
          { label: "Metropolitana", value: "METROPOLITANA" },
          { label: "O'Higgins", value: "OHIGGINS" },
          { label: "Maule", value: "MAULE" },
          { label: "Ñuble", value: "NUBLE" },
          { label: "Biobío", value: "BIOBIO" },
          { label: "La Araucanía", value: "ARAUCANIA" },
          { label: "Los Ríos", value: "LOS_RIOS" },
          { label: "Los Lagos", value: "LOS_LAGOS" },
          { label: "Aysén", value: "AYSEN" },
          { label: "Magallanes", value: "MAGALLANES" }
        ]
      },
      { key: "status", label: "Estado", type: "text", readOnly: true }
    ]
  },
  hotelRooms: {
    name: "Habitaciones",
    description: "Detalle de habitaciones por hotel.",
    endpoint: "/hotel-rooms",
    fields: [
      { key: "hotelId", label: "Hotel", type: "select", required: true, optionsSource: "accommodations" },
      { key: "roomNumber", label: "Habitación", type: "text", required: true },
      {
        key: "roomType",
        label: "Tipo de habitación",
        type: "select",
        options: [
          { label: "Single", value: "SINGLE" },
          { label: "Double", value: "DOUBLE" },
          { label: "Triple", value: "TRIPLE" },
          { label: "Suite", value: "SUITE" }
        ]
      },
      { key: "bedsCapacity", label: "Capacidad (plazas)", type: "number" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Disponible", value: "AVAILABLE" },
          { label: "Ocupada", value: "OCCUPIED" },
          { label: "Mantenimiento", value: "MAINTENANCE" }
        ]
      },
      { key: "notes", label: "Notas", type: "text" }
    ]
  },
  hotelBeds: {
    name: "Camas",
    description: "Detalle de camas por habitación.",
    endpoint: "/hotel-beds",
    fields: [
      { key: "roomId", label: "Habitación", type: "select", required: true, optionsSource: "hotelRooms" },
      {
        key: "bedType",
        label: "Tipo de cama",
        type: "select",
        options: [
          { label: "Single", value: "SINGLE" },
          { label: "Double", value: "DOUBLE" },
          { label: "Queen", value: "QUEEN" },
          { label: "King", value: "KING" }
        ]
      },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Disponible", value: "AVAILABLE" },
          { label: "Ocupada", value: "OCCUPIED" },
          { label: "Mantenimiento", value: "MAINTENANCE" }
        ]
      }
    ]
  },
  hotelAssignments: {
    name: "Asignaciones hotel",
    description: "Asignación de participantes a hotel y habitación.",
    endpoint: "/hotel-assignments",
    fields: [
      {
        key: "clientTypeFilter",
        label: "Filtrar por tipo de cliente",
        type: "select",
        transient: true,
        options: [
          { label: "Todos", value: "" },
          { label: "VIP", value: "VIP" },
          { label: "T1", value: "T1" },
          { label: "Familia Parapan", value: "FAMILIA_PARAPAN" },
          { label: "TA", value: "TA" },
          { label: "TF", value: "TF" },
          { label: "TM", value: "TM" },
          { label: "Comité Organizador", value: "COMITE_ORGANIZADOR" },
          { label: "Proveedores", value: "PROVEEDORES" },
        ]
      },
      { key: "participantId", label: "Participante", type: "select", required: true, optionsSource: "athletes" },
      {
        key: "accommodationTypeFilter",
        label: "Tipo de alojamiento",
        type: "select",
        transient: true,
        options: [
          { label: "Todos", value: "" },
          { label: "Hotel", value: "HOTEL" },
          { label: "Villa Panamericana", value: "VILLA" },
        ]
      },
      {
        key: "towerFilter",
        label: "Torre",
        type: "select",
        transient: true,
        optionsSource: "accommodationTowers",
        showWhen: { field: "accommodationTypeFilter", value: "VILLA" },
      },
      { key: "hotelId", label: "Hotel / Villa", type: "select", required: true, optionsSource: "accommodations" },
      { key: "roomId", label: "Habitación", type: "select", optionsSource: "hotelRooms" },
      { key: "preCheckinAt", label: "Pre check-in", type: "datetime" },
      { key: "checkinAt", label: "Check-in", type: "datetime" },
      { key: "checkoutAt", label: "Check-out", type: "datetime" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Asignado", value: "ASSIGNED" },
          { label: "Check-in", value: "CHECKED_IN" },
          { label: "Check-out", value: "CHECKED_OUT" }
        ]
      }
    ]
  },
  accommodations: {
    name: "Hoteles/Villa Panamerica",
    description: "Inventario de hoteles y villas panamericanas.",
    endpoint: "/accommodations",
    tableOrder: [
      "eventId",
      "accommodationType",
      "tower",
      "name",
      "address",
      "roomSingle",
      "roomDouble",
      "roomTriple",
      "roomSuite"
    ],
    tableHiddenKeys: [
      "id",
      "totalCapacity"
    ],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      {
        key: "accommodationType",
        label: "Tipo de alojamiento",
        type: "select",
        required: true,
        options: [
          { label: "Hotel", value: "HOTEL" },
          { label: "Villa Panamericana", value: "VILLA" },
        ]
      },
      { key: "tower", label: "Torre", type: "text", showWhen: { field: "accommodationType", value: "VILLA" } },
      { key: "name", label: "Nombre", type: "text", required: true },
      { key: "address", label: "Dirección", type: "text" },
      { key: "roomSingle", label: "Habitaciones Single", type: "number", transient: true },
      { key: "roomDouble", label: "Habitaciones Double", type: "number", transient: true },
      { key: "roomTriple", label: "Habitaciones Triple", type: "number", transient: true },
      { key: "roomSuite", label: "Habitaciones Suite", type: "number", transient: true },
      { key: "totalCapacity", label: "Capacidad total", type: "number", readOnly: true }
    ]
  },
  trips: {
    name: "Viajes",
    description: "Operaciones de recogida y traslado.",
    endpoint: "/trips",
    tableOrder: [
      "eventId",
      "requesterAthleteId",
      "destinationVenueId",
      "requestedVehicleType",
      "passengerCount",
      "driverId",
      "vehicleId",
      "tripType",
      "clientType",
      "origin",
      "destination",
      "status",
      "scheduledAt"
    ],
    tableHiddenKeys: [
      "id",
      "tripCost",
      "startedAt",
      "completedAt",
      "delegationId",
      "athleteIds",
      "requestedAt"
    ],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "requesterAthleteId", label: "Solicitante", type: "select", optionsSource: "athletes" },
      { key: "destinationVenueId", label: "Sede destino", type: "select", optionsSource: "venues" },
      {
        key: "requestedVehicleType",
        label: "Vehículo solicitado",
        type: "select",
        options: [
          { label: "Sedan / SUV", value: "SEDAN" },
          { label: "Van", value: "VAN" },
          { label: "Mini Bus", value: "MINI_BUS" },
          { label: "Bus", value: "BUS" }
        ]
      },
      { key: "passengerCount", label: "Cantidad de personas", type: "number" },
      { key: "driverId", label: "Conductor", type: "select", optionsSource: "driverUsers" },
      { key: "vehicleId", label: "Vehículo", type: "select", optionsSource: "vehicles", readOnly: true },
      {
        key: "tripType",
        label: "Tipo de viaje",
        type: "select",
        options: [
          { label: "Solicitud portal", value: "PORTAL_REQUEST" },
          { label: "Transfer In Out", value: "TRANSFER_IN_OUT" },
          { label: "Disposición 12 horas", value: "DISPOSICION_12H" },
          { label: "Viaje Ida-Vuelta", value: "IDA_VUELTA" }
        ]
      },
      {
        key: "clientType",
        label: "Tipo de cliente",
        type: "select",
        options: [
          { label: "VIP", value: "VIP" },
          { label: "Familia Parapan", value: "FAMILIA_PARAPAN" },
          { label: "TA (Deportista)", value: "TA" },
          { label: "TF (Oficiales Técnicos)", value: "TF" },
          { label: "TM (Prensa)", value: "TM" },
          { label: "Comité Organizador", value: "COMITE_ORGANIZADOR" },
          { label: "Proveedores", value: "PROVEEDORES" }
        ]
      },
      { key: "origin", label: "Origen", type: "text" },
      { key: "destination", label: "Destino", type: "text" },
      { key: "notes", label: "Observaciones", type: "text" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Solicitado", value: "REQUESTED" },
          { label: "Programado", value: "SCHEDULED" },
          { label: "En ruta", value: "EN_ROUTE" },
          { label: "Recogido", value: "PICKED_UP" },
          { label: "Dejado en hotel", value: "DROPPED_OFF" },
          { label: "Completado", value: "COMPLETED" }
        ]
      },
      { key: "requestedAt", label: "Fecha solicitud", type: "datetime", formHidden: true },
      { key: "scheduledAt", label: "Fecha programación", type: "datetime" },
      { key: "startedAt", label: "Inicio", type: "datetime", formHidden: true },
      { key: "completedAt", label: "Cierre", type: "datetime", formHidden: true },
      { key: "delegationId", label: "Delegación", type: "select", optionsSource: "delegations", transient: true },
      { key: "athleteIds", label: "Participantes", type: "multiselect", optionsSource: "athletes" },
      { key: "tripCost", label: "Costo de viaje", type: "text" }
    ]
  },
  vehiclePositions: {
    name: "Tracking",
    description: "Seguimiento en tiempo real de posiciones de vehículos.",
    endpoint: "/vehicle-positions",
    fields: [
      { key: "eventId", label: "Event ID", type: "text", required: true },
      { key: "vehicleId", label: "Vehicle ID", type: "text", required: true },
      { key: "timestamp", label: "Timestamp", type: "datetime" },
      { key: "location", label: "Location JSON", type: "json", required: true },
      { key: "speed", label: "Velocidad", type: "number" },
      { key: "heading", label: "Heading", type: "number" }
    ]
  },
  hotelExtras: {
    name: "Extras",
    description: "Catálogo de extras disponibles por hotel (mesas, sillas, proyectores, etc.).",
    endpoint: "/hotel-extras",
    tableOrder: ["hotelId", "name", "price", "quantity"],
    fields: [
      { key: "hotelId", label: "Hotel / Villa", type: "select", required: true, optionsSource: "accommodations" },
      { key: "name", label: "Nombre del extra", type: "text", required: true },
      { key: "price", label: "Precio", type: "number" },
      { key: "quantity", label: "Cantidad disponible", type: "number" }
    ]
  },
  foodLocations: {
    name: "Lugares de comida",
    description: "Recintos de alimentación y tipos de cliente asignados.",
    endpoint: "/food-locations",
    tableOrder: ["accommodationId", "name", "description", "capacity", "clientTypes"],
    fields: [
      { key: "accommodationId", label: "Hotel / Villa", type: "select", optionsSource: "accommodations" },
      { key: "name", label: "Nombre del lugar", type: "text", required: true },
      { key: "description", label: "Descripción", type: "text" },
      { key: "capacity", label: "Aforo", type: "number" },
      {
        key: "clientTypes",
        label: "Tipos de cliente",
        type: "multiselect",
        options: [
          { label: "VIP", value: "VIP" },
          { label: "T1", value: "T1" },
          { label: "Familia Parapan", value: "FAMILIA_PARAPAN" },
          { label: "TA (Deportista)", value: "TA" },
          { label: "TF (Oficiales Técnicos)", value: "TF" },
          { label: "TM (Prensa)", value: "TM" },
          { label: "Comité Organizador", value: "COMITE_ORGANIZADOR" },
          { label: "Proveedores", value: "PROVEEDORES" }
        ]
      }
    ]
  },
  hotelExtraReservations: {
    name: "Reservas de Extras",
    description: "Solicitudes de extras por participante.",
    endpoint: "/hotel-extra-reservations",
    tableOrder: ["extraId", "participantId", "startDate", "endDate", "quantity", "status", "notes"],
    fields: [
      { key: "extraId", label: "Extra", type: "select", required: true, optionsSource: "hotelExtras" },
      { key: "participantId", label: "Participante", type: "select", required: true, optionsSource: "athletes" },
      { key: "startDate", label: "Desde", type: "date" },
      { key: "endDate", label: "Hasta", type: "date" },
      { key: "quantity", label: "Cantidad", type: "number" },
      { key: "notes", label: "Notas", type: "text" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { label: "Pendiente", value: "PENDING" },
          { label: "Aprobado", value: "APPROVED" },
          { label: "Rechazado", value: "REJECTED" },
          { label: "Entregado", value: "DELIVERED" }
        ]
      }
    ]
  }
};
