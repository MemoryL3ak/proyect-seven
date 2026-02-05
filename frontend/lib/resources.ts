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
      "participantEmail",
      "participantDisciplineId",
      "participantIsDelegationLead",
      "participantCountryCode"
    ],
    tableHiddenKeys: [
      "participantRut",
      "participantPassportNumber",
      "participantBirthDate",
      "participantLuggageType",
      "participantFlightNumber",
      "participantAirline",
      "participantOrigin",
      "participantDepartureGate",
      "participantArrivalBaggage",
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
          { label: "Hombres", value: "M" },
          { label: "Mujeres", value: "F" }
        ]
      },
      { key: "participantFullName", label: "Nombre completo", type: "text", transient: true },
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
      { key: "participantBirthDate", label: "Fecha nacimiento", type: "date", transient: true },
      {
        key: "participantLuggageType",
        label: "Tipo de equipaje",
        type: "select",
        options: [
          { label: "Bolso", value: "BAG" },
          { label: "Maleta 8", value: "SUITCASE_8" },
          { label: "Maleta 15", value: "SUITCASE_15" },
          { label: "Maleta 23", value: "SUITCASE_23" },
          { label: "Sobreequipaje", value: "EXTRA_BAGGAGE" }
        ],
        transient: true
      },
      {
        key: "participantLuggageNotes",
        label: "Observaciones de equipaje",
        type: "text",
        transient: true
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
        label: "Puerta de retiro",
        type: "text",
        transient: true
      },
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
    tableOrder: ["fullName", "rut", "eventId", "email", "phone"],
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
      "departureGate",
      "arrivalBaggage",
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
      { key: "disciplineId", label: "Disciplina", type: "select", optionsSource: "disciplines" },
      {
        key: "isDelegationLead",
        label: "Encargado de delegación",
        type: "select",
        options: [
          { label: "Sí", value: "true" },
          { label: "No", value: "false" }
        ]
      },
      { key: "fullName", label: "Nombre completo", type: "text", required: true },
      { key: "userType", label: "Tipo de usuario", type: "text", formHidden: true },
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
      {
        key: "luggageType",
        label: "Tipo de equipaje",
        type: "select",
        options: [
          { label: "Bolso", value: "BAG" },
          { label: "Maleta 8", value: "SUITCASE_8" },
          { label: "Maleta 15", value: "SUITCASE_15" },
          { label: "Maleta 23", value: "SUITCASE_23" },
          { label: "Sobreequipaje", value: "EXTRA_BAGGAGE" }
        ]
      },
      {
        key: "luggageNotes",
        label: "Observaciones de equipaje",
        type: "text"
      },
      { key: "departureTime", label: "Fecha y hora de salida", type: "datetime" },
      { key: "flightNumber", label: "Número de vuelo", type: "text", transient: true },
      { key: "airline", label: "Aerolínea", type: "text", transient: true },
      { key: "origin", label: "Origen", type: "text", transient: true },
      { key: "departureGate", label: "Puerta de embarque", type: "text" },
      { key: "arrivalTime", label: "Arribo", type: "datetime" },
      { key: "arrivalBaggage", label: "Puerta de retiro", type: "text" },
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
      { key: "bedsCapacity", label: "Capacidad de camas", type: "number" },
      {
        key: "baseBedType",
        label: "Tipo de cama base",
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
    description: "Asignación de habitaciones y camas.",
    endpoint: "/hotel-assignments",
    fields: [
      { key: "participantId", label: "Participante", type: "select", required: true, optionsSource: "athletes" },
      { key: "hotelId", label: "Hotel", type: "select", required: true, optionsSource: "accommodations" },
      { key: "roomId", label: "Habitación", type: "select", optionsSource: "hotelRooms" },
      { key: "bedId", label: "Cama", type: "select", optionsSource: "hotelBeds" },
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
    name: "Hotelería",
    description: "Inventario de hoteles y capacidad.",
    endpoint: "/accommodations",
    tableOrder: [
      "eventId",
      "name",
      "address",
      "roomSingle",
      "roomDouble",
      "roomTriple",
      "roomSuite"
    ],
    tableHiddenKeys: [
      "id",
      "bedSingle",
      "bedDouble",
      "bedQueen",
      "bedKing",
      "totalCapacity"
    ],
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
    tableOrder: [
      "eventId",
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
      "athleteIds"
    ],
    fields: [
      { key: "eventId", label: "Evento", type: "select", required: true, optionsSource: "events" },
      { key: "driverId", label: "Conductor", type: "select", required: true, optionsSource: "driverUsers" },
      { key: "vehicleId", label: "Vehículo", type: "select", required: true, optionsSource: "vehicles", readOnly: true },
      {
        key: "tripType",
        label: "Tipo de viaje",
        type: "select",
        options: [
          { label: "Transfer In Out", value: "TRANSFER_IN_OUT" },
          { label: "Disposición 12 horas", value: "DISPOSICION_12H" },
          { label: "Viaje Ida-Vuelta", value: "IDA_VUELTA" }
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
  }
};
