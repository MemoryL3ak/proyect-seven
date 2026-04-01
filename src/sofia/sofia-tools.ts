/**
 * Function-calling tool definitions for SOFIA.
 * Each tool maps to a specific data-domain query that the LLM can invoke
 * instead of receiving the entire database dump.
 */

export interface SofiaTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const SOFIA_TOOLS: SofiaTool[] = [
  {
    type: 'function',
    name: 'get_summary',
    description:
      'Obtiene un resumen general con conteos de todas las entidades del sistema (eventos, atletas, viajes, conductores, vehículos, hoteles, vuelos, proveedores, posiciones GPS). Úsala como primer paso para entender el estado general.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_events',
    description:
      'Consulta los eventos registrados. Puede filtrar por estado o nombre.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filtrar por estado (ej: DRAFT, ACTIVE, FINISHED)',
        },
        name: {
          type: 'string',
          description: 'Buscar por nombre (parcial, case-insensitive)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_delegations',
    description:
      'Consulta las delegaciones (países/equipos) registradas en un evento.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        countryCode: {
          type: 'string',
          description: 'Filtrar por código de país (ej: CHL, ARG, BRA)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_athletes',
    description:
      'Consulta participantes/atletas. Puede buscar por nombre, país, delegación, estado, tipo de usuario o alojamiento.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        delegationId: {
          type: 'string',
          description: 'Filtrar por ID de delegación',
        },
        fullName: {
          type: 'string',
          description: 'Buscar por nombre (parcial, case-insensitive)',
        },
        countryCode: {
          type: 'string',
          description: 'Filtrar por código de país',
        },
        status: {
          type: 'string',
          description:
            'Filtrar por estado (ej: REGISTERED, ACCREDITED, CHECKED_IN)',
        },
        userType: {
          type: 'string',
          description: 'Filtrar por tipo de usuario (ej: ATHLETE, COACH, OFFICIAL)',
        },
        hasHotel: {
          type: 'boolean',
          description: 'true = solo con hotel asignado, false = sin hotel',
        },
        hasTrip: {
          type: 'boolean',
          description:
            'true = solo con viaje asignado, false = sin viaje asignado',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_trips',
    description:
      'Consulta viajes/traslados. Puede filtrar por estado, conductor, tipo de viaje, fecha, etc.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        driverId: {
          type: 'string',
          description: 'Filtrar por ID de conductor',
        },
        vehicleId: {
          type: 'string',
          description: 'Filtrar por ID de vehículo',
        },
        status: {
          type: 'string',
          description:
            'Filtrar por estado (ej: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, PICKED_UP)',
        },
        tripType: {
          type: 'string',
          description: 'Filtrar por tipo de viaje',
        },
        clientType: {
          type: 'string',
          description: 'Filtrar por tipo de cliente',
        },
        fromDate: {
          type: 'string',
          description:
            'Viajes programados desde esta fecha (ISO 8601, ej: 2026-04-01)',
        },
        toDate: {
          type: 'string',
          description: 'Viajes programados hasta esta fecha (ISO 8601)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_drivers',
    description:
      'Consulta los conductores registrados. Puede filtrar por nombre, estado, vehículo asignado.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        fullName: {
          type: 'string',
          description: 'Buscar por nombre (parcial, case-insensitive)',
        },
        status: {
          type: 'string',
          description: 'Filtrar por estado (ej: ACTIVE, INACTIVE)',
        },
        hasVehicle: {
          type: 'boolean',
          description: 'true = con vehículo, false = sin vehículo',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_vehicles',
    description:
      'Consulta los vehículos registrados. Puede filtrar por placa, tipo, estado, capacidad.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        plate: {
          type: 'string',
          description: 'Buscar por placa (parcial, case-insensitive)',
        },
        type: {
          type: 'string',
          description: 'Filtrar por tipo de vehículo',
        },
        status: {
          type: 'string',
          description: 'Filtrar por estado (ej: AVAILABLE, IN_USE, MAINTENANCE)',
        },
        minCapacity: {
          type: 'number',
          description: 'Capacidad mínima requerida',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_accommodations',
    description:
      'Consulta hoteles y alojamientos registrados, incluyendo inventario de habitaciones y camas.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        name: {
          type: 'string',
          description: 'Buscar por nombre (parcial, case-insensitive)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_flights',
    description:
      'Consulta vuelos registrados. Puede filtrar por número de vuelo, aerolínea, fecha.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        flightNumber: {
          type: 'string',
          description: 'Buscar por número de vuelo (parcial)',
        },
        airline: {
          type: 'string',
          description: 'Filtrar por aerolínea',
        },
        fromDate: {
          type: 'string',
          description: 'Vuelos desde esta fecha (ISO 8601)',
        },
        toDate: {
          type: 'string',
          description: 'Vuelos hasta esta fecha (ISO 8601)',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_providers',
    description: 'Consulta proveedores registrados. Puede filtrar por nombre, tipo o RUT.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Buscar por nombre (parcial, case-insensitive)',
        },
        type: {
          type: 'string',
          description: 'Filtrar por tipo de proveedor',
        },
        rut: {
          type: 'string',
          description: 'Buscar por RUT',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'query_vehicle_positions',
    description:
      'Obtiene las últimas posiciones GPS conocidas de los vehículos en tiempo real. Útil para tracking y monitoreo.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
        vehicleId: {
          type: 'string',
          description: 'Filtrar por ID de vehículo específico',
        },
        driverId: {
          type: 'string',
          description: 'Filtrar por ID de conductor',
        },
        limit: {
          type: 'number',
          description: 'Máximo de resultados (default 50)',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'count_athletes_by_country',
    description:
      'Obtiene el conteo de atletas agrupados por país/código de delegación. Útil para reportes y estadísticas.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'count_trips_by_status',
    description:
      'Obtiene el conteo de viajes agrupados por estado. Útil para dashboards y reportes operacionales.',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'Filtrar por ID de evento',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];
