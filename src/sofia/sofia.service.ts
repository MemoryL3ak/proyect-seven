import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Delegation } from '../delegations/entities/delegation.entity';
import { Athlete } from '../athletes/entities/athlete.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Transport } from '../transports/entities/transport.entity';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Provider } from '../providers/entities/provider.entity';

type SofiaAnswer = {
  answer: string;
  responseId?: string | null;
};

@Injectable()
export class SofiaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Delegation)
    private readonly delegationsRepository: Repository<Delegation>,
    @InjectRepository(Athlete)
    private readonly athletesRepository: Repository<Athlete>,
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    @InjectRepository(Driver)
    private readonly driversRepository: Repository<Driver>,
    @InjectRepository(Transport)
    private readonly transportsRepository: Repository<Transport>,
    @InjectRepository(Accommodation)
    private readonly accommodationsRepository: Repository<Accommodation>,
    @InjectRepository(Flight)
    private readonly flightsRepository: Repository<Flight>,
    @InjectRepository(Provider)
    private readonly providersRepository: Repository<Provider>,
  ) {}

  private getMaxRows() {
    const raw = this.configService.get<string>('SOFIA_MAX_ROWS');
    const parsed = raw ? Number(raw) : 150;
    if (!Number.isFinite(parsed) || parsed <= 0) return 150;
    return Math.min(parsed, 500);
  }

  private async buildSnapshot() {
    const take = this.getMaxRows();
    const [
      events,
      delegations,
      athletes,
      trips,
      drivers,
      vehicles,
      accommodations,
      flights,
      providers,
    ] = await Promise.all([
      this.eventsRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'name', 'startDate', 'endDate', 'status'],
      }),
      this.delegationsRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'eventId', 'countryCode'],
      }),
      this.athletesRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: [
          'id',
          'eventId',
          'delegationId',
          'fullName',
          'countryCode',
          'arrivalTime',
          'hotelAccommodationId',
          'roomType',
          'bedType',
          'isDelegationLead',
          'transportTripId',
          'status',
        ],
      }),
      this.tripsRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: [
          'id',
          'eventId',
          'driverId',
          'vehicleId',
          'origin',
          'destination',
          'tripType',
          'clientType',
          'tripCost',
          'status',
          'scheduledAt',
          'startedAt',
          'completedAt',
        ],
      }),
      this.driversRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'eventId', 'fullName', 'rut', 'email', 'vehicleId', 'status'],
      }),
      this.transportsRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'eventId', 'plate', 'type', 'brand', 'model', 'capacity', 'status'],
      }),
      this.accommodationsRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'eventId', 'name', 'address', 'totalCapacity', 'roomInventory', 'bedInventory'],
      }),
      this.flightsRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'eventId', 'flightNumber', 'airline', 'origin', 'arrivalTime', 'terminal'],
      }),
      this.providersRepository.find({
        take,
        order: { createdAt: 'DESC' },
        select: ['id', 'name', 'email', 'rut'],
      }),
    ]);

    const tripParticipantCounts = athletes.reduce<Record<string, number>>((acc, athlete) => {
      if (athlete.transportTripId) {
        acc[athlete.transportTripId] = (acc[athlete.transportTripId] || 0) + 1;
      }
      return acc;
    }, {});

    const latestVehiclePositions = await this.dataSource.query(
      `
        select distinct on (vehicle_id)
          vehicle_id,
          event_id,
          timestamp,
          speed,
          heading
        from telemetry.vehicle_positions
        order by vehicle_id, timestamp desc
        limit $1
      `,
      [take],
    );

    return {
      generatedAt: new Date().toISOString(),
      counts: {
        events: events.length,
        delegations: delegations.length,
        athletes: athletes.length,
        trips: trips.length,
        drivers: drivers.length,
        vehicles: vehicles.length,
        accommodations: accommodations.length,
        flights: flights.length,
        providers: providers.length,
        vehiclePositions: latestVehiclePositions?.length ?? 0,
      },
      events,
      delegations,
      athletes,
      trips,
      tripParticipantCounts,
      drivers,
      vehicles,
      accommodations,
      flights,
      providers,
      vehiclePositions: latestVehiclePositions,
    };
  }

  private buildSystemPrompt() {
    const platformGuide = `
=== MANUAL DE LA PLATAFORMA SEVEN ===

MÓDULOS DISPONIBLES:
1. Dashboard Comercial: Vista ejecutiva del presupuesto y adjudicación por área operativa. Muestra monto adjudicado real de Transporte (suma de presupuestos de conductores). Compara adjudicado vs. consumido vs. forecast por área. Las tarjetas marcadas como "Ficticio" son datos de ejemplo; se reemplazan a medida que se ingresen datos reales.
2. Dashboard Operacional: Indicadores de operación en tiempo real: viajes, hotelería, alimentación y salud. Resumen de viajes activos, pendientes y completados. Estado de asignaciones de hotel y llaves. Alertas de salud y antidopaje.
3. Registro de Eventos: Creación y configuración del evento deportivo principal. Define nombre, fechas, sede y disciplinas del evento. El evento es el contenedor de todos los participantes, conductores y operaciones. Solo debe existir un evento activo a la vez.
4. Inscripción de Participantes: Gestión de atletas, delegaciones y acreditaciones. Importación masiva de participantes mediante archivo Excel. Asignación de delegación, disciplina y categoría. Registro de datos médicos y documentos de salud. Generación de credenciales QR.
5. Proveedores: Catálogo de proveedores externos clasificados por tipo y subtipo. Tipos: Transporte, Logística, Hotelería, Alimentación, Staff, Infraestructura, Control Técnico, Salud, Broadcast y Medios, Merchandising, Tecnología, Recursos Humanos, Aseo y Mantención, Acreditación, Seguridad, Voluntarios, Productora. Cada proveedor puede tener subtipo. Se pueden registrar participantes asociados al proveedor. Los proveedores de transporte requieren documentos del conductor y del vehículo por cada participante.
6. Transporte: Gestión de conductores, vehículos y viajes. Registro de conductores con licencia, vehículo y monto licitado/presupuesto. El campo "Monto licitado" alimenta el Dashboard Comercial con datos reales. Asignación de viajes: origen → destino, hora, pasajeros. Tracking en tiempo real en el mapa de posiciones. Portal del conductor: vista simplificada con sus viajes del día.
7. Hotelería: Asignación de habitaciones, llaves y extras de hotel. Configuración de hoteles, habitaciones y camas. Asignación de atletas a habitaciones (individual o automática por tipo). Entrega y devolución de llaves con firma digital. Reserva de salones para reuniones. Reserva de servicios extra (lavandería, gym, etc.).
8. Alimentación: Control de menús, comedores y servicios de alimentación. Define tipos de alimentación (Desayuno, Almuerzo, Cena). Configura lugares de comida (comedores, restaurantes). Registra menús por fecha y servicio. Asocia atletas o grupos a cada servicio.
9. Salud: Registro de atenciones médicas y control antidopaje. Registro de atenciones médicas por participante. Control de documentos de salud requeridos. Módulo AND: seguimiento del listado de sustancias prohibidas. Cumplimiento AND: control de entrega de formularios.
10. Acreditación: Control de acceso y credenciales para el evento. Generación de credenciales QR individuales. Escáner QR para validación de acceso en puertas. Tipos de acceso: Campo (C), Tribune (TR), Hotel (H), Reuniones (R), Áreas Restringidas (A), Dirección (RD). Gestión del estado de acreditación por participante.
11. Calendario Operacional: Vista de disciplinas, competencias y actividades por día. Navega por día para ver las competencias programadas. Cada disciplina muestra su venue, hora y estado. Vinculado a los datos del Registro de Eventos.
12. Administración de Usuarios: Gestión de accesos y roles de los operadores de la plataforma. Creación de usuarios con email o nombre de usuario. Roles disponibles: Administrador, Supervisor, Operador, Coordinador, Visualizador. Asignación de módulos específicos por usuario. Activación, desactivación y reseteo de contraseña.

PASOS PARA EMPEZAR:
1. Configurar el evento en Registro → Registro Evento.
2. Inscribir participantes en Registro → Inscripción Participantes (manual o importación Excel).
3. Registrar conductores en Operación → Transporte con vehículo y monto licitado.
4. Asignar hoteles en Operación → Hotelería → Asignaciones Hotel.
5. Monitorear el Dashboard Comercial y Operacional.
6. Gestionar accesos en Administración → Gestión de Usuarios.

PREGUNTAS FRECUENTES:
- ¿Cómo creo un nuevo conductor? Ve a Operación → Transporte → Conductores. Haz clic en "Nuevo" e ingresa el nombre, RUT, vehículo y monto licitado.
- ¿Cómo importo participantes de forma masiva? En Registro → Inscripción Participantes, usa el botón "Importar". Descarga la plantilla Excel, completa los datos y sube el archivo.
- ¿Por qué algunas tarjetas del Dashboard muestran "Ficticio"? Son datos de ejemplo. Se reemplazan automáticamente cuando se ingresan datos reales.
- ¿Cómo asigno una habitación a un atleta? En Operación → Hotelería → Asignaciones Hotel, busca al atleta y selecciona la habitación disponible. También hay asignación automática por tipo de habitación.
- ¿Cómo funciona el escáner QR? En Operación → Transporte → Escáner QR. Valida la credencial del participante y muestra sus permisos en tiempo real.
- ¿Puedo acceder desde el celular? Sí, la plataforma es completamente responsiva. El menú lateral se convierte en un cajón deslizable en pantallas pequeñas.
- ¿Cómo cambio el idioma? En la parte inferior del menú lateral está el selector de idioma (Español, English, Português).
- ¿Cuáles son los temas visuales? Light (claro), Dark (oscuro con dorado), Obsidian (oscuro con cyan futurista) y Atlas (azul marino corporativo). Se configuran desde el botón de tema en la barra superior.
- ¿Cómo creo un proveedor con subtipo? En Registro → Proveedores, selecciona el tipo y el subtipo se habilita automáticamente.
- ¿Cómo reseteo la contraseña de un usuario? En Administración → Gestión de Usuarios, abre el usuario y usa "Resetear contraseña".

=== FIN DEL MANUAL ===`;

    return [
      'Eres SofIA, un asistente de operaciones logísticas de la plataforma SEVEN.',
      'Responde en español, de forma clara y concisa.',
      'Tienes acceso a un manual completo de la plataforma (incluido arriba) Y a datos reales de la base de datos (incluidos en el contexto de cada pregunta).',
      'Para preguntas sobre cómo usar la plataforma o sus módulos, usa el manual.',
      'Para preguntas sobre datos reales (participantes, viajes, hoteles, etc.), usa el contexto de la base de datos.',
      'Si la pregunta no puede resolverse con los datos disponibles, indícalo y sugiere qué dato falta.',
      platformGuide,
    ].join('\n');
  }

  async ask(question: string, previousResponseId?: string): Promise<SofiaAnswer> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada.');
    }

    const model = this.configService.get<string>('SOFIA_MODEL') || 'gpt-4o-mini';
    const context = await this.buildSnapshot();

    const payload: Record<string, unknown> = {
      model,
      instructions: this.buildSystemPrompt(),
      input: [
        {
          role: 'user',
          content: `Contexto (JSON):\n${JSON.stringify(context)}\n\nPregunta:\n${question}`,
        },
      ],
    };

    if (previousResponseId) {
      payload.previous_response_id = previousResponseId;
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al consultar SofIA.');
    }

    const data = (await response.json()) as Record<string, any>;
    const outputText =
      data.output_text ||
      (Array.isArray(data.output)
        ? data.output
            .flatMap((item: any) => item.content || [])
            .filter((content: any) => content.type === 'output_text')
            .map((content: any) => content.text)
            .join('')
        : '');

    return {
      answer: outputText || 'No tengo una respuesta con los datos disponibles.',
      responseId: data.id ?? null,
    };
  }
}
