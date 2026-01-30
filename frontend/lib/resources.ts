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
    | "disciplines"
    | "delegations"
    | "accommodations"
    | "vehicles"
    | "drivers"
    | "driverUsers"
    | "athletes";
  transient?: boolean;
  formHidden?: boolean;
  readOnly?: boolean;
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
      { key: "startDate", label: "Fecha inicio", type: "date" },
      { key: "endDate", label: "Fecha término", type: "date" },
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
    fields: [{ key: "name", label: "Disciplina", type: "text", required: true }]
  },
  delegations: {
    name: "Delegaciones",
    description: "Delegaciones participantes, país y metadatos.",
    endpoint: "/delegations",
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
        key: "disciplineIds",
        label: "Disciplinas",
        type: "multiselect",
        optionsSource: "disciplines"
      }
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
          { label: "Auto", value: "SEDAN" },
          { label: "Van", value: "VAN" },
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
    tableOrder: ["fullName", "rut", "eventId", "email", "phone"],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      { key: "rut", label: "RUT", type: "text", required: true },
      { key: "email", label: "Correo electrónico", type: "text", required: true },
      { key: "licenseNumber", label: "Licencia", type: "text" },
      { key: "phone", label: "Teléfono", type: "text" },
      { key: "vehiclePlate", label: "Patente", type: "text", required: true },
      {
        key: "vehicleType",
        label: "Tipo de vehículo",
        type: "select",
        required: true,
        options: [
          { label: "Auto", value: "SEDAN" },
          { label: "Van", value: "VAN" },
          { label: "Bus", value: "BUS" }
        ]
      },
      { key: "vehicleBrand", label: "Marca", type: "text" },
      { key: "vehicleModel", label: "Modelo", type: "text" },
      { key: "vehicleCapacity", label: "Capacidad", type: "number" },
      {
        key: "vehicleStatus",
        label: "Estado vehículo",
        type: "select",
        options: [
          { label: "Disponible", value: "AVAILABLE" },
          { label: "En servicio", value: "IN_SERVICE" },
          { label: "Mantenimiento", value: "MAINTENANCE" }
        ]
      },
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
  athletes: {
    name: "Participantes",
    description: "Registro de participantes, arribos y asignaciones.",
    endpoint: "/athletes",
    tableHiddenKeys: [
      "id",
      "userType",
      "isDelegationLead",
      "passportNumber",
      "dateOfBirth",
      "dietaryNeeds",
      "luggageType",
      "flightNumber",
      "airline",
      "origin",
      "arrivalTime",
      "hotelAccommodationId",
      "roomNumber",
      "roomType",
      "bedType",
      "transportVehicleId",
      "status"
    ],
    tableOrder: [
      "fullName",
      "email",
      "eventId",
      "delegationId",
      "countryCode"
    ],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "delegationId", label: "Delegación", type: "select", optionsSource: "delegations" },
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      { key: "userType", label: "Tipo de usuario", type: "text", formHidden: true },
      {
        key: "isDelegationLead",
        label: "Encargado de delegación",
        type: "select",
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ],
        formHidden: true
      },
      { key: "email", label: "Correo electrónico", type: "text" },
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
      { key: "dateOfBirth", label: "Fecha nacimiento", type: "date" },
      { key: "dietaryNeeds", label: "Dieta", type: "text", formHidden: true },
      { key: "luggageType", label: "Tipo de equipaje", type: "text" },
      { key: "flightNumber", label: "Número de vuelo", type: "text", transient: true },
      { key: "airline", label: "Aerolínea", type: "text", transient: true },
      { key: "origin", label: "Origen", type: "text", transient: true },
      { key: "arrivalTime", label: "Arribo", type: "datetime" },
      { key: "hotelAccommodationId", label: "Hotel", type: "select", optionsSource: "accommodations" },
      { key: "roomNumber", label: "Habitación", type: "text" },
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
      { key: "transportVehicleId", label: "Vehículo", type: "select", optionsSource: "vehicles", formHidden: true },
      { key: "status", label: "Estado", type: "select", formHidden: true }
    ]
  },
  accommodations: {
    name: "Hotelería",
    description: "Inventario de hoteles y capacidad.",
    endpoint: "/accommodations",
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "name", label: "Hotel", type: "text", required: true },
      { key: "address", label: "Dirección", type: "text" },
      { key: "roomSingle", label: "Habitaciones Single", type: "number", transient: true },
      { key: "roomDouble", label: "Habitaciones Double", type: "number", transient: true },
      { key: "roomTriple", label: "Habitaciones Triple", type: "number", transient: true },
      { key: "roomSuite", label: "Habitaciones Suite", type: "number", transient: true },
      { key: "bedSingle", label: "Camas Single", type: "number", transient: true },
      { key: "bedDouble", label: "Camas Double", type: "number", transient: true },
      { key: "bedQueen", label: "Camas Queen", type: "number", transient: true },
      { key: "bedKing", label: "Camas King", type: "number", transient: true },
      { key: "totalCapacity", label: "Capacidad total", type: "number", readOnly: true }
    ]
  },
  trips: {
    name: "Viajes",
    description: "Operaciones de recogida y traslado.",
    endpoint: "/trips",
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "driverId", label: "Conductor", type: "select", required: true, optionsSource: "driverUsers" },
      { key: "vehicleId", label: "Vehículo", type: "select", required: true, optionsSource: "vehicles", readOnly: true },
      {
        key: "tripType",
        label: "Tipo de viaje",
        type: "select",
        options: [
          { label: "Servicio", value: "SERVICE" },
          { label: "Viaje", value: "TRIP" }
        ]
      },
      { key: "clientType", label: "Tipo de cliente", type: "text" },
      { key: "origin", label: "Origen", type: "text" },
      { key: "destination", label: "Destino", type: "text" },
      {
        key: "status",
        label: "Estado",
        type: "select",
        formHidden: true,
        options: [
          { label: "Programado", value: "SCHEDULED" },
          { label: "Recogido", value: "PICKED_UP" },
          { label: "Dejado en hotel", value: "DROPPED_OFF" },
          { label: "Completado", value: "COMPLETED" }
        ]
      },
      { key: "scheduledAt", label: "Fecha programación", type: "datetime" },
      { key: "startedAt", label: "Inicio", type: "datetime", formHidden: true },
      { key: "completedAt", label: "Cierre", type: "datetime", formHidden: true },
      { key: "delegationId", label: "Delegación", type: "select", optionsSource: "delegations", transient: true },
      { key: "athleteIds", label: "Participantes", type: "multiselect", optionsSource: "athletes" }
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
  }
};
