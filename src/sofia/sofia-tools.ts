/**
 * Function-calling tool definitions for SOFIA.
 *
 * Three families of tools:
 *  1. Lectura (query_* / count_* / get_summary) — consultan datos.
 *  2. Acción (create_* / assign_* / update_* / cancel_* / send_*) — escriben en
 *     la base de datos. Toda acción queda registrada en public.sofia_action_log.
 *  3. Analítica y tiempo real (forecast_* / analytics_* / open_live_* /
 *     get_active_alerts) — devuelven datos que el frontend renderiza como
 *     gráficos, mapas o paneles en vivo.
 */

export interface SofiaTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });
const bool = (description: string) => ({ type: 'boolean', description });
const limit = num('Máximo de resultados (default 50)');

export const SOFIA_TOOLS: SofiaTool[] = [
  /* ================================================================== */
  /*  LECTURA                                                            */
  /* ================================================================== */
  {
    type: 'function',
    name: 'get_summary',
    description:
      'Obtiene un resumen general con conteos de todas las entidades del sistema (eventos, atletas, viajes, conductores, vehículos, hoteles, vuelos, proveedores). Úsala como primer paso para entender el estado general.',
    parameters: obj({}),
  },
  {
    type: 'function',
    name: 'query_events',
    description: 'Consulta los eventos registrados. Puede filtrar por estado o nombre.',
    parameters: obj({
      status: str('Filtrar por estado (ej: DRAFT, ACTIVE, FINISHED)'),
      name: str('Buscar por nombre (parcial, case-insensitive)'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_delegations',
    description: 'Consulta las delegaciones (países/equipos) registradas en un evento.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      countryCode: str('Filtrar por código de país (ej: CHL, ARG, BRA)'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_athletes',
    description:
      'Consulta participantes/atletas. Puede buscar por nombre, país, delegación, estado, tipo de usuario o alojamiento.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      delegationId: str('Filtrar por ID de delegación'),
      fullName: str('Buscar por nombre (parcial, case-insensitive)'),
      countryCode: str('Filtrar por código de país'),
      status: str('Filtrar por estado (ej: REGISTERED, ACCREDITED, CHECKED_IN)'),
      userType: str('Filtrar por tipo de usuario (ej: ATHLETE, COACH, OFFICIAL)'),
      hasHotel: bool('true = solo con hotel asignado, false = sin hotel'),
      hasTrip: bool('true = solo con viaje asignado, false = sin viaje asignado'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_trips',
    description:
      'Consulta viajes/traslados. Puede filtrar por estado, conductor, tipo de viaje, fecha, etc.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      driverId: str('Filtrar por ID de conductor'),
      vehicleId: str('Filtrar por ID de vehículo'),
      status: str('Estado (REQUESTED, SCHEDULED, EN_ROUTE, PICKED_UP, DROPPED_OFF, COMPLETED)'),
      tripType: str('Filtrar por tipo de viaje'),
      clientType: str('Filtrar por tipo de cliente'),
      fromDate: str('Viajes programados desde esta fecha (ISO 8601)'),
      toDate: str('Viajes programados hasta esta fecha (ISO 8601)'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_drivers',
    description:
      'Consulta los conductores registrados. Puede filtrar por nombre, estado, vehículo asignado.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      fullName: str('Buscar por nombre (parcial, case-insensitive)'),
      status: str('Filtrar por estado (ej: ACTIVE, INACTIVE)'),
      hasVehicle: bool('true = con vehículo, false = sin vehículo'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_vehicles',
    description:
      'Consulta los vehículos registrados. Puede filtrar por placa, tipo, estado, capacidad.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      plate: str('Buscar por placa (parcial, case-insensitive)'),
      type: str('Filtrar por tipo de vehículo'),
      status: str('Filtrar por estado (ej: AVAILABLE, IN_USE, MAINTENANCE)'),
      minCapacity: num('Capacidad mínima requerida'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_accommodations',
    description:
      'Consulta hoteles y alojamientos registrados, incluyendo inventario de habitaciones y camas.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      name: str('Buscar por nombre (parcial, case-insensitive)'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_flights',
    description:
      'Consulta vuelos registrados. Puede filtrar por número de vuelo, aerolínea, fecha.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      flightNumber: str('Buscar por número de vuelo (parcial)'),
      airline: str('Filtrar por aerolínea'),
      fromDate: str('Vuelos desde esta fecha (ISO 8601)'),
      toDate: str('Vuelos hasta esta fecha (ISO 8601)'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_providers',
    description: 'Consulta proveedores registrados. Puede filtrar por nombre, tipo o RUT.',
    parameters: obj({
      name: str('Buscar por nombre (parcial, case-insensitive)'),
      type: str('Filtrar por tipo de proveedor'),
      rut: str('Buscar por RUT'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'query_vehicle_positions',
    description:
      'Obtiene las últimas posiciones GPS conocidas de los vehículos. Útil para tracking puntual; para seguimiento continuo usa open_live_map.',
    parameters: obj({
      eventId: str('Filtrar por ID de evento'),
      vehicleId: str('Filtrar por ID de vehículo específico'),
      driverId: str('Filtrar por ID de conductor'),
      limit,
    }),
  },
  {
    type: 'function',
    name: 'count_athletes_by_country',
    description:
      'Obtiene el conteo de atletas agrupados por país/código de delegación. Útil para reportes y estadísticas.',
    parameters: obj({ eventId: str('Filtrar por ID de evento') }),
  },
  {
    type: 'function',
    name: 'count_trips_by_status',
    description:
      'Obtiene el conteo de viajes agrupados por estado. Útil para dashboards y reportes operacionales.',
    parameters: obj({ eventId: str('Filtrar por ID de evento') }),
  },

  /* ================================================================== */
  /*  ACCIONES OPERATIVAS (escritura)                                    */
  /* ================================================================== */
  {
    type: 'function',
    name: 'create_trip',
    description:
      'Crea un nuevo viaje/traslado. Si no se indica eventId se usa el evento activo. Si se indica driverId el viaje queda agendado (SCHEDULED). Devuelve el viaje creado y una tarjeta de acción.',
    parameters: obj(
      {
        origin: str('Origen del viaje (ej: "Hotel Plaza")'),
        destination: str('Destino del viaje (ej: "Estadio Nacional")'),
        scheduledAt: str('Fecha y hora programada (ISO 8601, ej: 2026-05-20T18:00:00)'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        driverId: str('ID del conductor a asignar (opcional)'),
        passengerCount: num('Cantidad de pasajeros (opcional)'),
        tripType: str('Tipo de viaje (opcional, ej: TRANSFER, SHUTTLE)'),
        clientType: str('Tipo de cliente (opcional)'),
        notes: str('Notas u observaciones (opcional)'),
      },
      ['origin', 'destination', 'scheduledAt'],
    ),
  },
  {
    type: 'function',
    name: 'assign_driver_to_trip',
    description:
      'Asigna un conductor a un viaje existente. Si el viaje estaba REQUESTED pasa a SCHEDULED.',
    parameters: obj(
      {
        tripId: str('ID del viaje'),
        driverId: str('ID del conductor a asignar'),
      },
      ['tripId', 'driverId'],
    ),
  },
  {
    type: 'function',
    name: 'update_trip_status',
    description:
      'Cambia el estado de un viaje (REQUESTED, SCHEDULED, EN_ROUTE, PICKED_UP, DROPPED_OFF, COMPLETED).',
    parameters: obj(
      {
        tripId: str('ID del viaje'),
        status: str('Nuevo estado'),
      },
      ['tripId', 'status'],
    ),
  },
  {
    type: 'function',
    name: 'cancel_trip',
    description: 'Cancela un viaje (lo marca como CANCELLED). Acción reversible.',
    parameters: obj(
      {
        tripId: str('ID del viaje a cancelar'),
        reason: str('Motivo de la cancelación (opcional)'),
      },
      ['tripId'],
    ),
  },
  {
    type: 'function',
    name: 'auto_assign_drivers',
    description:
      'Asigna automáticamente conductores disponibles a los viajes sin conductor de un evento. Reparte de forma equitativa. Devuelve el detalle de asignaciones.',
    parameters: obj({
      eventId: str('ID de evento (opcional, default: evento activo)'),
      maxAssignments: num('Máximo de viajes a asignar en esta corrida (default 20)'),
    }),
  },
  {
    type: 'function',
    name: 'create_hotel_assignment',
    description:
      'Asigna un participante a un hotel (y opcionalmente una habitación). Verifica capacidad de la habitación.',
    parameters: obj(
      {
        participantId: str('ID del participante/atleta'),
        hotelId: str('ID del hotel/alojamiento'),
        roomId: str('ID de la habitación (opcional)'),
        checkinAt: str('Fecha/hora de check-in (ISO 8601, opcional)'),
        checkoutAt: str('Fecha/hora de check-out (ISO 8601, opcional)'),
      },
      ['participantId', 'hotelId'],
    ),
  },
  {
    type: 'function',
    name: 'release_hotel_assignment',
    description: 'Libera una asignación de hotel (la marca como CANCELLED). Acción reversible.',
    parameters: obj(
      { assignmentId: str('ID de la asignación de hotel') },
      ['assignmentId'],
    ),
  },
  {
    type: 'function',
    name: 'create_premiacion',
    description: 'Crea una ceremonia de premiación.',
    parameters: obj(
      {
        title: str('Título de la premiación'),
        scheduledAt: str('Fecha y hora programada (ISO 8601)'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        discipline: str('Disciplina deportiva (opcional)'),
        venueName: str('Nombre del recinto (opcional)'),
        notes: str('Notas (opcional)'),
      },
      ['title', 'scheduledAt'],
    ),
  },
  {
    type: 'function',
    name: 'update_premiacion_status',
    description:
      'Cambia el estado de una premiación (PROGRAMADA, EN_CURSO, COMPLETADA, CANCELADA).',
    parameters: obj(
      {
        premiacionId: str('ID de la premiación'),
        status: str('Nuevo estado'),
      },
      ['premiacionId', 'status'],
    ),
  },
  {
    type: 'function',
    name: 'create_coupon',
    description:
      'Crea un cupón promocional. Si no se indica código se genera uno automático. Devuelve el cupón creado.',
    parameters: obj(
      {
        title: str('Título del cupón'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        code: str('Código del cupón (opcional, autogenerado si se omite)'),
        description: str('Descripción (opcional)'),
        category: str('Categoría (opcional, ej: FOOD, RETAIL, OTHER)'),
        discountType: str('Tipo de descuento: PERCENTAGE o FIXED (default PERCENTAGE)'),
        discountValue: num('Valor del descuento (opcional)'),
        validUntil: str('Fecha de expiración (ISO 8601, opcional)'),
        maxRedemptions: num('Máximo de canjes totales (opcional)'),
        partnerName: str('Nombre del partner/comercio (opcional)'),
      },
      ['title'],
    ),
  },
  {
    type: 'function',
    name: 'claim_coupon',
    description:
      'Reclama un cupón para un usuario, generando un código único y un token QR canjeable.',
    parameters: obj(
      {
        couponId: str('ID del cupón'),
        userId: str('ID del usuario que reclama'),
        userName: str('Nombre del usuario (opcional)'),
        userType: str('Tipo de usuario (opcional)'),
      },
      ['couponId', 'userId'],
    ),
  },
  {
    type: 'function',
    name: 'send_notification',
    description:
      'Envía una notificación a un conductor, a un usuario/atleta o a toda una audiencia. Útil para avisar cambios, alertas o instrucciones.',
    parameters: obj(
      {
        audience: str('Audiencia: "driver", "user" o "all"'),
        title: str('Título de la notificación'),
        body: str('Cuerpo del mensaje'),
        targetId: str('ID del conductor o usuario destinatario (omitir para broadcast)'),
        priority: str('Prioridad: "normal" o "high" (default normal)'),
      },
      ['audience', 'title', 'body'],
    ),
  },
  {
    type: 'function',
    name: 'create_workforce_person',
    description: 'Registra una persona del equipo de trabajo (staff o voluntario).',
    parameters: obj(
      {
        fullName: str('Nombre completo'),
        personType: str('Tipo: STAFF o VOLUNTEER (default STAFF)'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        role: str('Rol/cargo (opcional)'),
        rut: str('RUT (opcional)'),
        phone: str('Teléfono (opcional)'),
        dailyRate: num('Tarifa diaria en CLP (opcional)'),
        daysCount: num('Cantidad de días (opcional)'),
      },
      ['fullName'],
    ),
  },
  {
    type: 'function',
    name: 'create_event',
    description: 'Crea un nuevo evento deportivo (el contenedor de toda la operación).',
    parameters: obj(
      {
        name: str('Nombre del evento'),
        country: str('País sede (opcional)'),
        city: str('Ciudad sede (opcional)'),
        startDate: str('Fecha de inicio (ISO 8601, opcional)'),
        endDate: str('Fecha de término (ISO 8601, opcional)'),
      },
      ['name'],
    ),
  },
  {
    type: 'function',
    name: 'update_event_status',
    description: 'Cambia el estado de un evento (DRAFT, ACTIVE, FINISHED).',
    parameters: obj(
      { eventId: str('ID del evento'), status: str('Nuevo estado') },
      ['eventId', 'status'],
    ),
  },
  {
    type: 'function',
    name: 'create_delegation',
    description: 'Crea una delegación (país/equipo) dentro de un evento.',
    parameters: obj(
      {
        countryCode: str('Código de país de 3 letras (ej: CHL, ARG, BRA)'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
      },
      ['countryCode'],
    ),
  },
  {
    type: 'function',
    name: 'create_athlete',
    description:
      'Registra un participante (atleta, técnico u oficial) en el evento.',
    parameters: obj(
      {
        fullName: str('Nombre completo'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        delegationId: str('ID de la delegación (opcional)'),
        disciplineId: str('ID de la disciplina (opcional)'),
        countryCode: str('Código de país de 3 letras (opcional)'),
        userType: str('Tipo: ATHLETE, COACH, OFFICIAL (opcional)'),
        email: str('Email (opcional)'),
        phone: str('Teléfono (opcional)'),
      },
      ['fullName'],
    ),
  },
  {
    type: 'function',
    name: 'update_athlete_status',
    description:
      'Cambia el estado de un participante (REGISTERED, ACCREDITED, CHECKED_IN, etc.).',
    parameters: obj(
      { athleteId: str('ID del participante'), status: str('Nuevo estado') },
      ['athleteId', 'status'],
    ),
  },
  {
    type: 'function',
    name: 'create_discipline',
    description: 'Crea una disciplina/prueba deportiva del evento.',
    parameters: obj(
      {
        name: str('Nombre de la disciplina'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        category: str('Categoría (opcional)'),
        gender: str('Género (opcional)'),
        scheduledAt: str('Fecha y hora programada (ISO 8601, opcional)'),
        venueName: str('Recinto (opcional)'),
      },
      ['name'],
    ),
  },
  {
    type: 'function',
    name: 'create_provider',
    description: 'Registra un proveedor externo del evento.',
    parameters: obj(
      {
        name: str('Nombre del proveedor'),
        type: str('Tipo (ej: Transporte, Hotelería, Alimentación)'),
        subtype: str('Subtipo (opcional)'),
        email: str('Email (opcional)'),
        phone: str('Teléfono (opcional)'),
        rut: str('RUT (opcional)'),
        address: str('Dirección (opcional)'),
        city: str('Ciudad (opcional)'),
        contactName: str('Nombre de contacto (opcional)'),
      },
      ['name'],
    ),
  },
  {
    type: 'function',
    name: 'create_venue',
    description: 'Crea un recinto/sede del evento.',
    parameters: obj(
      {
        name: str('Nombre del recinto'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        address: str('Dirección (opcional)'),
        region: str('Región (opcional)'),
        commune: str('Comuna (opcional)'),
      },
      ['name'],
    ),
  },
  {
    type: 'function',
    name: 'create_driver',
    description: 'Registra un conductor de transporte.',
    parameters: obj(
      {
        fullName: str('Nombre completo'),
        rut: str('RUT del conductor'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        phone: str('Teléfono (opcional)'),
        email: str('Email (opcional)'),
        licenseNumber: str('Número de licencia (opcional)'),
        budgetAmount: num('Monto licitado/presupuesto en CLP (opcional)'),
      },
      ['fullName', 'rut'],
    ),
  },
  {
    type: 'function',
    name: 'create_vehicle',
    description: 'Registra un vehículo de la flota.',
    parameters: obj(
      {
        plate: str('Placa patente'),
        type: str('Tipo de vehículo (ej: Sedán, Van, Bus)'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        brand: str('Marca (opcional)'),
        model: str('Modelo (opcional)'),
        capacity: num('Capacidad de pasajeros (opcional)'),
      },
      ['plate', 'type'],
    ),
  },
  {
    type: 'function',
    name: 'create_flight',
    description: 'Registra un vuelo de llegada de participantes.',
    parameters: obj(
      {
        flightNumber: str('Número de vuelo'),
        airline: str('Aerolínea'),
        arrivalTime: str('Hora de llegada (ISO 8601)'),
        origin: str('Ciudad/aeropuerto de origen'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        terminal: str('Terminal (opcional)'),
      },
      ['flightNumber', 'airline', 'arrivalTime', 'origin'],
    ),
  },
  {
    type: 'function',
    name: 'create_accommodation',
    description: 'Crea un hotel o alojamiento (Villa Panamericana).',
    parameters: obj(
      {
        name: str('Nombre del hotel/alojamiento'),
        eventId: str('ID de evento (opcional, default: evento activo)'),
        accommodationType: str('Tipo: HOTEL o VILLA (default HOTEL)'),
        address: str('Dirección (opcional)'),
        totalCapacity: num('Capacidad total (opcional)'),
      },
      ['name'],
    ),
  },
  {
    type: 'function',
    name: 'create_hotel_room',
    description: 'Crea una habitación dentro de un hotel.',
    parameters: obj(
      {
        hotelId: str('ID del hotel/alojamiento'),
        roomNumber: str('Número de habitación'),
        roomType: str('Tipo: SIMPLE, DOBLE, TRIPLE, SUITE'),
        bedsCapacity: num('Cantidad de camas (default 1)'),
      },
      ['hotelId', 'roomNumber', 'roomType'],
    ),
  },
  {
    type: 'function',
    name: 'create_food_location',
    description: 'Crea un comedor o punto de servicio de alimentación.',
    parameters: obj(
      {
        name: str('Nombre del comedor/punto de servicio'),
        accommodationId: str('ID del hotel asociado (opcional)'),
        description: str('Descripción (opcional)'),
        capacity: num('Capacidad (opcional)'),
      },
      ['name'],
    ),
  },
  {
    type: 'function',
    name: 'create_food_menu',
    description: 'Crea un menú de alimentación para una fecha y servicio.',
    parameters: obj(
      {
        date: str('Fecha del menú (YYYY-MM-DD)'),
        mealType: str('Servicio: DESAYUNO, ALMUERZO o CENA'),
        title: str('Título/nombre del menú'),
        description: str('Descripción del menú (opcional)'),
        dietaryType: str('Tipo dietético: ESTANDAR, VEGETARIANO, VEGANO, etc. (opcional)'),
        accommodationId: str('ID del hotel asociado (opcional)'),
      },
      ['date', 'mealType', 'title'],
    ),
  },
  {
    type: 'function',
    name: 'update_accreditation_status',
    description:
      'Cambia el estado de una acreditación (PENDING, IN_REVIEW, APPROVED, REJECTED, CREDENTIAL_ISSUED).',
    parameters: obj(
      {
        accreditationId: str('ID de la acreditación'),
        status: str('Nuevo estado'),
      },
      ['accreditationId', 'status'],
    ),
  },
  {
    type: 'function',
    name: 'undo_last_action',
    description:
      'Deshace la última acción reversible ejecutada por SofIA (o una específica si se indica logId).',
    parameters: obj({ logId: str('ID de la acción en el log (opcional)') }),
  },

  /* ================================================================== */
  /*  PREDICCIONES Y ANALÍTICA (renderizan gráficos)                     */
  /* ================================================================== */
  {
    type: 'function',
    name: 'forecast_trip_demand',
    description:
      'Predice la demanda de viajes para los próximos días combinando media móvil exponencial y estacionalidad por día de semana. El frontend renderiza un gráfico de línea con histórico + pronóstico. Describe las tendencias y picos detectados.',
    parameters: obj({
      eventId: str('ID de evento (opcional, default: evento activo)'),
      daysAhead: num('Días a pronosticar (default 7, máximo 21)'),
    }),
  },
  {
    type: 'function',
    name: 'forecast_hotel_occupancy',
    description:
      'Predice la ocupación hotelera (check-ins, check-outs y huéspedes activos) para los próximos días. El frontend renderiza un gráfico de área. Describe la carga esperada y los días pico.',
    parameters: obj({
      hotelId: str('ID de hotel específico (opcional, default: todos)'),
      daysAhead: num('Días a pronosticar (default 7, máximo 21)'),
    }),
  },
  {
    type: 'function',
    name: 'coupon_partners_performance',
    description:
      'Analiza el desempeño de cupones y partners: canjes por partner, tasa de conversión, partners más activos. El frontend renderiza un gráfico de barras y KPIs. Describe los hallazgos.',
    parameters: obj({ eventId: str('ID de evento (opcional)') }),
  },
  {
    type: 'function',
    name: 'workforce_kpis',
    description:
      'Calcula los KPIs del módulo de fuerza de trabajo: personal, costo laboral, inventario, entregas validadas/pendientes. El frontend renderiza tarjetas KPI y un gráfico. Describe el estado.',
    parameters: obj({ eventId: str('ID de evento (opcional)') }),
  },
  {
    type: 'function',
    name: 'analytics_trips_timeline',
    description:
      'Devuelve la línea de tiempo histórica de viajes por día con desglose por estado. El frontend renderiza un gráfico de barras apiladas.',
    parameters: obj({
      eventId: str('ID de evento (opcional)'),
      days: num('Cantidad de días hacia atrás (default 14)'),
    }),
  },
  {
    type: 'function',
    name: 'analytics_participants',
    description:
      'Analiza y grafica los participantes/atletas agrupados por un criterio. El frontend renderiza un gráfico de barras y tarjetas KPI. ÚSALA siempre que pidan gráficos, estadísticas o conteos de participantes, atletas o acreditados (ej: "gráfico de cuántos acreditados tenemos"). Describe los hallazgos sin repetir los números crudos.',
    parameters: obj({
      groupBy: str(
        'Criterio de agrupación: "accreditation" (estado de acreditación), "status" (estado general), "userType" (tipo de usuario) o "country" (país). Default: accreditation.',
      ),
      eventId: str('ID de evento (opcional, default: evento activo)'),
    }),
  },

  /* ================================================================== */
  /*  TIEMPO REAL                                                        */
  /* ================================================================== */
  {
    type: 'function',
    name: 'open_live_map',
    description:
      'Abre un mapa en vivo con la posición GPS de los conductores activos, que se actualiza solo cada pocos segundos. Úsalo cuando el usuario quiera ver vehículos/conductores en tiempo real.',
    parameters: obj({ eventId: str('ID de evento (opcional, default: evento activo)') }),
  },
  {
    type: 'function',
    name: 'open_live_trips',
    description:
      'Abre un panel en vivo con los viajes en curso y su estado, que se actualiza solo. Úsalo cuando el usuario quiera monitorear la operación de transporte en tiempo real.',
    parameters: obj({ eventId: str('ID de evento (opcional, default: evento activo)') }),
  },
  {
    type: 'function',
    name: 'open_alerts_feed',
    description:
      'Abre un panel de alertas operativas en vivo (viajes atrasados, GPS sin señal, hoteles al límite). Úsalo cuando el usuario quiera vigilar problemas en tiempo real.',
    parameters: obj({ eventId: str('ID de evento (opcional, default: evento activo)') }),
  },
  {
    type: 'function',
    name: 'get_active_alerts',
    description:
      'Obtiene una foto puntual de las alertas operativas actuales (viajes atrasados, conductores sin GPS reciente, hoteles cerca de capacidad).',
    parameters: obj({ eventId: str('ID de evento (opcional, default: evento activo)') }),
  },
  {
    type: 'function',
    name: 'get_driver_presence',
    description:
      'Obtiene qué conductores tienen la aplicación abierta en este momento (presencia), aunque no estén en un viaje. Incluye conteo de conectados, última conexión de cada uno y si reportan GPS. Úsala para preguntas como "¿qué choferes están conectados?".',
    parameters: obj({ eventId: str('ID de evento (opcional, default: evento activo)') }),
  },
  {
    type: 'function',
    name: 'open_driver_monitor',
    description:
      'Abre un panel en vivo de monitoreo de conductores: quiénes tienen la app abierta, su estado de conexión y actividad, actualizado solo. Úsalo cuando quieran vigilar la presencia de conductores en tiempo real.',
    parameters: obj({ eventId: str('ID de evento (opcional, default: evento activo)') }),
  },
];
