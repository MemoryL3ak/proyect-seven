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
    return [
      'Eres SofIA, un asistente de operaciones logísticas.',
      'Responde en español, de forma clara y concisa.',
      'Usa exclusivamente los datos provistos en el contexto.',
      'Si la pregunta no puede resolverse con los datos, indícalo y sugiere qué dato falta.',
    ].join(' ');
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
