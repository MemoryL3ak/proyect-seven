import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { PLATFORM_KNOWLEDGE } from './sofia-knowledge';
import { SOFIA_TOOLS } from './sofia-tools';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  ILike,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Delegation } from '../delegations/entities/delegation.entity';
import { Athlete } from '../athletes/entities/athlete.entity';
import { Trip } from '../trips/entities/trip.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Transport } from '../transports/entities/transport.entity';
import { Accommodation } from '../accommodations/entities/accommodation.entity';
import { Flight } from '../flights/entities/flight.entity';
import { Provider } from '../providers/entities/provider.entity';
import { Subject } from 'rxjs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SofiaAnswer = {
  answer: string;
  responseId?: string | null;
};

export interface SofiaStreamChunk {
  type: 'delta' | 'done' | 'error' | 'tool_call';
  content: string;
  responseId?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

@Injectable()
export class SofiaService {
  private readonly logger = new Logger(SofiaService.name);

  /** Max tool-call round-trips to prevent infinite loops */
  private readonly MAX_TOOL_ROUNDS = 8;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Delegation)
    private readonly delegationsRepo: Repository<Delegation>,
    @InjectRepository(Athlete)
    private readonly athletesRepo: Repository<Athlete>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(Driver)
    private readonly driversRepo: Repository<Driver>,
    @InjectRepository(Transport)
    private readonly transportsRepo: Repository<Transport>,
    @InjectRepository(Accommodation)
    private readonly accommodationsRepo: Repository<Accommodation>,
    @InjectRepository(Flight)
    private readonly flightsRepo: Repository<Flight>,
    @InjectRepository(Provider)
    private readonly providersRepo: Repository<Provider>,
  ) {}

  /* ================================================================ */
  /*  System prompt                                                    */
  /* ================================================================ */

  private buildSystemPrompt(): string {
    return [
      'Eres SofIA, el asistente inteligente de la plataforma Seven Arena.',
      'Responde siempre en español, de forma clara y concisa.',
      '',
      '## Tus capacidades',
      'Tienes acceso a herramientas (tools) que te permiten consultar datos reales de la base de datos del evento.',
      'Cuando el usuario pregunte sobre datos operacionales (participantes, viajes, conductores, vehículos, hoteles, vuelos, proveedores, posiciones GPS, etc.), usa las herramientas apropiadas para obtener SOLO los datos necesarios.',
      'Puedes llamar múltiples herramientas en una sola respuesta si necesitas cruzar información.',
      '',
      '## Estrategia de consulta',
      '- Para preguntas generales ("¿cuántos atletas hay?"), usa primero get_summary para obtener conteos.',
      '- Para preguntas específicas ("¿qué viajes tiene el conductor Juan?"), usa la herramienta específica con filtros.',
      '- Para preguntas que cruzan datos ("¿qué atletas no tienen hotel?"), usa las herramientas con los filtros booleanos disponibles.',
      '- Para preguntas sobre la plataforma ("¿cómo creo un conductor?"), responde usando el manual sin llamar herramientas.',
      '',
      '## Formato de respuesta',
      '- Sé conciso pero informativo.',
      '- Usa listas cuando presentes múltiples registros.',
      '- Para tablas de datos usa formato legible, no JSON crudo.',
      '- Si los datos no son suficientes para responder, indícalo y sugiere qué información falta.',
      '',
      '## Manual de la plataforma',
      'Usa el siguiente manual para responder preguntas sobre cómo usar la plataforma:',
      '',
      PLATFORM_KNOWLEDGE,
    ].join('\n');
  }

  /* ================================================================ */
  /*  Tool executors                                                   */
  /* ================================================================ */

  private clampLimit(raw?: number): number {
    const n = raw && Number.isFinite(raw) ? raw : 50;
    return Math.min(Math.max(n, 1), 200);
  }

  /** Dispatch a function-call by name and return its result as a string. */
  private async executeTool(
    name: string,
    args: Record<string, any>,
  ): Promise<string> {
    try {
      const result = await this.executeToolInner(name, args);
      let json = JSON.stringify(result);
      // Truncate large tool outputs to avoid OpenAI token limits
      if (json.length > 30000) {
        const arr = Array.isArray(result) ? result : null;
        if (arr) {
          json = JSON.stringify({ results: arr.slice(0, 20), totalCount: arr.length, note: 'Resultados truncados. Usa filtros para refinar la consulta.' });
        } else {
          json = json.slice(0, 30000) + '..."(truncated)"}';
        }
      }
      return json;
    } catch (err) {
      this.logger.error(`Tool ${name} failed: ${err}`);
      return JSON.stringify({ error: `Error ejecutando ${name}: ${err}` });
    }
  }

  private async executeToolInner(
    name: string,
    args: Record<string, any>,
  ): Promise<unknown> {
    const limit = this.clampLimit(args.limit);

    switch (name) {
      /* ----- get_summary ----- */
      case 'get_summary': {
        const [events, delegations, athletes, trips, drivers, vehicles, accommodations, flights, providers] =
          await Promise.all([
            this.eventsRepo.count(),
            this.delegationsRepo.count(),
            this.athletesRepo.count(),
            this.tripsRepo.count(),
            this.driversRepo.count(),
            this.transportsRepo.count(),
            this.accommodationsRepo.count(),
            this.flightsRepo.count(),
            this.providersRepo.count(),
          ]);
        return {
          timestamp: new Date().toISOString(),
          counts: { events, delegations, athletes, trips, drivers, vehicles, accommodations, flights, providers },
        };
      }

      /* ----- query_events ----- */
      case 'query_events': {
        const where: Record<string, any> = {};
        if (args.status) where.status = args.status;
        if (args.name) where.name = ILike(`%${args.name}%`);
        return this.eventsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'name', 'country', 'city', 'startDate', 'endDate', 'status'],
        });
      }

      /* ----- query_delegations ----- */
      case 'query_delegations': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.countryCode) where.countryCode = args.countryCode;
        return this.delegationsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
        });
      }

      /* ----- query_athletes ----- */
      case 'query_athletes': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.delegationId) where.delegationId = args.delegationId;
        if (args.fullName) where.fullName = ILike(`%${args.fullName}%`);
        if (args.countryCode) where.countryCode = args.countryCode;
        if (args.status) where.status = args.status;
        if (args.userType) where.userType = args.userType;
        if (args.hasHotel === true)
          where.hotelAccommodationId = Not(IsNull());
        if (args.hasHotel === false)
          where.hotelAccommodationId = IsNull();
        if (args.hasTrip === true)
          where.transportTripId = Not(IsNull());
        if (args.hasTrip === false)
          where.transportTripId = IsNull();
        return this.athletesRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: [
            'id', 'eventId', 'delegationId', 'fullName', 'countryCode',
            'userType', 'status', 'hotelAccommodationId', 'roomType',
            'transportTripId', 'arrivalTime', 'isDelegationLead',
            'accreditationStatus',
          ],
        });
      }

      /* ----- query_trips ----- */
      case 'query_trips': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.driverId) where.driverId = args.driverId;
        if (args.vehicleId) where.vehicleId = args.vehicleId;
        if (args.status) where.status = args.status;
        if (args.tripType) where.tripType = args.tripType;
        if (args.clientType) where.clientType = args.clientType;
        if (args.fromDate)
          where.scheduledAt = MoreThanOrEqual(new Date(args.fromDate));
        if (args.toDate)
          where.scheduledAt = LessThanOrEqual(new Date(args.toDate));
        return this.tripsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: [
            'id', 'eventId', 'driverId', 'vehicleId', 'vehiclePlate',
            'origin', 'destination', 'tripType', 'clientType', 'tripCost',
            'passengerCount', 'status', 'scheduledAt', 'startedAt', 'completedAt',
          ],
        });
      }

      /* ----- query_drivers ----- */
      case 'query_drivers': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.fullName) where.fullName = ILike(`%${args.fullName}%`);
        if (args.status) where.status = args.status;
        if (args.hasVehicle === true) where.vehicleId = Not(IsNull());
        if (args.hasVehicle === false) where.vehicleId = IsNull();
        return this.driversRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: [
            'id', 'eventId', 'fullName', 'rut', 'email', 'phone',
            'vehicleId', 'budgetAmount', 'status',
          ],
        });
      }

      /* ----- query_vehicles ----- */
      case 'query_vehicles': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.plate) where.plate = ILike(`%${args.plate}%`);
        if (args.type) where.type = args.type;
        if (args.status) where.status = args.status;
        if (args.minCapacity)
          where.capacity = MoreThanOrEqual(args.minCapacity);
        return this.transportsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'eventId', 'plate', 'type', 'brand', 'model', 'capacity', 'status'],
        });
      }

      /* ----- query_accommodations ----- */
      case 'query_accommodations': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.name) where.name = ILike(`%${args.name}%`);
        return this.accommodationsRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: [
            'id', 'eventId', 'name', 'accommodationType', 'address',
            'totalCapacity', 'roomInventory', 'bedInventory',
          ],
        });
      }

      /* ----- query_flights ----- */
      case 'query_flights': {
        const where: Record<string, any> = {};
        if (args.eventId) where.eventId = args.eventId;
        if (args.flightNumber) where.flightNumber = ILike(`%${args.flightNumber}%`);
        if (args.airline) where.airline = ILike(`%${args.airline}%`);
        if (args.fromDate)
          where.arrivalTime = MoreThanOrEqual(new Date(args.fromDate));
        if (args.toDate)
          where.arrivalTime = LessThanOrEqual(new Date(args.toDate));
        return this.flightsRepo.find({
          where,
          take: limit,
          order: { arrivalTime: 'DESC' },
          select: ['id', 'eventId', 'flightNumber', 'airline', 'origin', 'arrivalTime', 'terminal'],
        });
      }

      /* ----- query_providers ----- */
      case 'query_providers': {
        const where: Record<string, any> = {};
        if (args.name) where.name = ILike(`%${args.name}%`);
        if (args.type) where.type = args.type;
        if (args.rut) where.rut = args.rut;
        return this.providersRepo.find({
          where,
          take: limit,
          order: { createdAt: 'DESC' },
          select: ['id', 'name', 'type', 'subtype', 'email', 'rut'],
        });
      }

      /* ----- query_vehicle_positions ----- */
      case 'query_vehicle_positions': {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        if (args.eventId) {
          conditions.push(`event_id = $${paramIdx++}`);
          params.push(args.eventId);
        }
        if (args.vehicleId) {
          conditions.push(`vehicle_id = $${paramIdx++}`);
          params.push(args.vehicleId);
        }
        if (args.driverId) {
          conditions.push(`driver_id = $${paramIdx++}`);
          params.push(args.driverId);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        return this.dataSource.query(
          `
          SELECT DISTINCT ON (driver_id)
            vehicle_id,
            driver_id,
            event_id,
            timestamp,
            speed,
            heading
          FROM telemetry.vehicle_positions
          ${whereClause}
          ORDER BY driver_id, timestamp DESC
          LIMIT $${paramIdx}
          `,
          [...params, limit],
        );
      }

      /* ----- count_athletes_by_country ----- */
      case 'count_athletes_by_country': {
        const qb = this.athletesRepo
          .createQueryBuilder('a')
          .select('a.country_code', 'countryCode')
          .addSelect('COUNT(*)::int', 'total')
          .groupBy('a.country_code')
          .orderBy('total', 'DESC');
        if (args.eventId) qb.where('a.event_id = :eventId', { eventId: args.eventId });
        return qb.getRawMany();
      }

      /* ----- count_trips_by_status ----- */
      case 'count_trips_by_status': {
        const qb = this.tripsRepo
          .createQueryBuilder('t')
          .select('t.status', 'status')
          .addSelect('COUNT(*)::int', 'total')
          .groupBy('t.status')
          .orderBy('total', 'DESC');
        if (args.eventId) qb.where('t.event_id = :eventId', { eventId: args.eventId });
        return qb.getRawMany();
      }

      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }

  /* ================================================================ */
  /*  OpenAI Responses API helpers                                     */
  /* ================================================================ */

  private getApiKey(): string {
    const key = this.configService.get<string>('OPENAI_API_KEY');
    if (!key) throw new Error('OPENAI_API_KEY no está configurada.');
    return key;
  }

  private getModel(): string {
    return this.configService.get<string>('SOFIA_MODEL') || 'gpt-4o-mini';
  }

  /** Send a request to OpenAI Responses API (non-streaming). */
  private async callOpenAI(payload: Record<string, unknown>): Promise<Record<string, any>> {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
    }

    return res.json() as Promise<Record<string, any>>;
  }

  /** Extract text from a Responses API output. */
  private extractText(data: Record<string, any>): string {
    if (data.output_text) return data.output_text;
    if (Array.isArray(data.output)) {
      return data.output
        .flatMap((item: any) => item.content || [])
        .filter((c: any) => c.type === 'output_text')
        .map((c: any) => c.text)
        .join('');
    }
    return '';
  }

  /** Extract function calls from a Responses API output. */
  private extractFunctionCalls(
    data: Record<string, any>,
  ): Array<{ callId: string; name: string; arguments: string }> {
    if (!Array.isArray(data.output)) return [];
    return data.output
      .filter((item: any) => item.type === 'function_call')
      .map((item: any) => ({
        callId: item.call_id,
        name: item.name,
        arguments: item.arguments,
      }));
  }

  /* ================================================================ */
  /*  Public: non-streaming ask (backward-compatible)                  */
  /* ================================================================ */

  async ask(question: string, previousResponseId?: string): Promise<SofiaAnswer> {
    const model = this.getModel();
    const instructions = this.buildSystemPrompt();

    let payload: Record<string, unknown> = {
      model,
      instructions,
      tools: SOFIA_TOOLS,
      input: [{ role: 'user', content: question }],
    };

    if (previousResponseId) {
      payload.previous_response_id = previousResponseId;
    }

    let responseId: string | null = null;

    for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
      const data = await this.callOpenAI(payload);
      responseId = data.id ?? null;

      const functionCalls = this.extractFunctionCalls(data);

      // No tool calls → we have the final text answer
      if (functionCalls.length === 0) {
        const text = this.extractText(data);

        this.logger.log(
          `SOFIA answered (${round} tool rounds) | Q: "${question.slice(0, 80)}"`,
        );

        return {
          answer: text || 'No tengo una respuesta con los datos disponibles.',
          responseId,
        };
      }

      // Execute all tool calls in parallel
      this.logger.log(
        `SOFIA tool round ${round + 1}: ${functionCalls.map((fc) => fc.name).join(', ')}`,
      );

      const toolResults = await Promise.all(
        functionCalls.map(async (fc) => {
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(fc.arguments);
          } catch { /* empty args */ }
          const output = await this.executeTool(fc.name, args);
          return {
            type: 'function_call_output' as const,
            call_id: fc.callId,
            output,
          };
        }),
      );

      // Continue the conversation with tool results
      payload = {
        model,
        instructions,
        tools: SOFIA_TOOLS,
        previous_response_id: responseId,
        input: toolResults,
      };
    }

    return {
      answer: 'Se alcanzó el límite de consultas internas. Por favor reformula tu pregunta de forma más específica.',
      responseId,
    };
  }

  /* ================================================================ */
  /*  Public: streaming ask (SSE)                                      */
  /* ================================================================ */

  askStream(
    question: string,
    previousResponseId?: string,
  ): Subject<SofiaStreamChunk> {
    const subject = new Subject<SofiaStreamChunk>();

    this.runStreamLoop(subject, question, previousResponseId).catch((err) => {
      this.logger.error(`Stream error: ${err}`);
      subject.next({ type: 'error', content: String(err) });
      subject.complete();
    });

    return subject;
  }

  private async runStreamLoop(
    subject: Subject<SofiaStreamChunk>,
    question: string,
    previousResponseId?: string,
  ): Promise<void> {
    const model = this.getModel();
    const instructions = this.buildSystemPrompt();

    let payload: Record<string, unknown> = {
      model,
      instructions,
      tools: SOFIA_TOOLS,
      input: [{ role: 'user', content: question }],
      stream: true,
    };

    if (previousResponseId) {
      payload.previous_response_id = previousResponseId;
    }

    let responseId: string | null = null;

    for (let round = 0; round < this.MAX_TOOL_ROUNDS; round++) {
      const { text, functionCalls, id } = await this.consumeStream(
        payload,
        subject,
        round > 0, // suppress text deltas during tool rounds (show only final)
      );

      responseId = id;

      if (functionCalls.length === 0) {
        // Final answer already streamed to client
        if (!text) {
          subject.next({
            type: 'delta',
            content: 'No tengo una respuesta con los datos disponibles.',
          });
        }
        subject.next({ type: 'done', content: '', responseId });
        subject.complete();

        this.logger.log(
          `SOFIA stream done (${round} tool rounds) | Q: "${question.slice(0, 80)}"`,
        );
        return;
      }

      // Execute tool calls
      subject.next({
        type: 'tool_call',
        content: functionCalls.map((fc) => fc.name).join(', '),
      });

      const toolResults = await Promise.all(
        functionCalls.map(async (fc) => {
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(fc.arguments);
          } catch { /* empty */ }
          const output = await this.executeTool(fc.name, args);
          return {
            type: 'function_call_output' as const,
            call_id: fc.callId,
            output,
          };
        }),
      );

      payload = {
        model,
        instructions,
        tools: SOFIA_TOOLS,
        previous_response_id: responseId,
        input: toolResults,
        stream: true,
      };
    }

    subject.next({
      type: 'delta',
      content:
        'Se alcanzó el límite de consultas internas. Reformula tu pregunta de forma más específica.',
    });
    subject.next({ type: 'done', content: '', responseId });
    subject.complete();
  }

  /** Consume an OpenAI streaming response, emitting text deltas and collecting function calls. */
  private async consumeStream(
    payload: Record<string, unknown>,
    subject: Subject<SofiaStreamChunk>,
    suppressDeltas: boolean,
  ): Promise<{
    text: string;
    functionCalls: Array<{ callId: string; name: string; arguments: string }>;
    id: string | null;
  }> {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${errorText}`);
    }

    if (!res.body) throw new Error('No response body for streaming');

    // Convert Web ReadableStream to Node.js Readable for reliable consumption
    const nodeStream = Readable.fromWeb(res.body as any);

    let buffer = '';
    let fullText = '';
    let responseId: string | null = null;
    const functionCalls: Array<{ callId: string; name: string; arguments: string }> = [];
    const fcArgBuffers = new Map<string, { name: string; args: string; callId?: string }>();

    for await (const chunk of nodeStream) {
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        let event: any;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        // Capture response ID
        if (event.response?.id) responseId = event.response.id;
        if (event.id && !responseId) responseId = event.id;

        const eventType: string = event.type || '';

        // Text deltas
        if (eventType === 'response.output_text.delta') {
          const delta: string = event.delta || '';
          fullText += delta;
          if (!suppressDeltas) {
            subject.next({ type: 'delta', content: delta });
          }
        }

        // Function call argument delta
        if (eventType === 'response.function_call_arguments.delta') {
          const itemId = event.item_id || '';
          if (!fcArgBuffers.has(itemId)) {
            fcArgBuffers.set(itemId, { name: event.name || '', args: '', callId: event.call_id || '' });
          }
          fcArgBuffers.get(itemId)!.args += event.delta || '';
          if (event.call_id && !fcArgBuffers.get(itemId)!.callId) {
            fcArgBuffers.get(itemId)!.callId = event.call_id;
          }
        }

        // Response output item added (function_call type carries the name and call_id)
        if (eventType === 'response.output_item.added') {
          const item = event.item;
          if (item?.type === 'function_call') {
            fcArgBuffers.set(item.id || '', {
              name: item.name || '',
              args: '',
              callId: item.call_id || item.id || '',
            });
          }
        }

        // Function call done
        if (eventType === 'response.function_call_arguments.done') {
          const itemId = event.item_id || '';
          const buf = fcArgBuffers.get(itemId);
          if (buf) {
            functionCalls.push({
              callId: event.call_id || (buf as any).callId || itemId,
              name: buf.name || event.name || '',
              arguments: event.arguments || buf.args,
            });
          }
        }

        // Response completed
        if (eventType === 'response.completed' && event.response?.id) {
          responseId = event.response.id;
        }
      }
    }

    return { text: fullText, functionCalls, id: responseId };
  }
}
