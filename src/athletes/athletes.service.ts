import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { accessCodeEmailHtml } from '../shared/email-templates';
import { MAX_CORREOS_POR_LOTE, sendResendBatch, sendResendEmail } from '../shared/resend';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { StaffScopeService } from '../auth/staff-scope.service';
import { MobileAuthService } from '../mobile-auth/mobile-auth.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { Athlete } from './entities/athlete.entity';

export type RequestHeaders = Record<string, string | string[] | undefined>;

/** Tope por petición: el que admite un lote de Resend, que va en una sola. */
const MAX_CODIGOS_POR_TANDA = MAX_CORREOS_POR_LOTE;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Esta ficha cuenta como validada? Mismo criterio que el panel
 * (`isAthletePersonalDataValidated` en frontend/lib/athletes.ts): el estado o
 * la marca en metadata, y nunca una cuenta dada de baja, que conserva
 * `personalDataValidated` de antes de la baja.
 */
function estaValidado(fila: {
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const estado = String(fila.status ?? '');
  if (estado.toUpperCase() === 'DELETED') return false;
  return (
    estado === 'PERSONAL_DATA_VALIDATED' ||
    fila.metadata?.personalDataValidated === true
  );
}

/**
 * El correo del código de acceso, uno solo para los tres caminos: el que pide
 * el participante desde la pantalla de ingreso, el que manda el panel y el
 * que sale solo al validar la ficha. El código son los últimos seis
 * caracteres del id.
 */
function correoDeCodigo(fullName: string, athleteId: string) {
  const accessCode = athleteId.slice(-6);
  return {
    subject: 'Tu código de acceso',
    text: `Hola ${fullName},\n\nTu código de acceso para ingresar al portal es:\n${accessCode}\n\nGuárdalo en un lugar seguro.\n`,
    html: accessCodeEmailHtml(fullName, accessCode),
  };
}

type AthleteRow = {
  id: string;
  event_id: string;
  delegation_id: string | null;
  discipline_id: string | null;
  discipline_ids: string[] | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  passport_number: string | null;
  rut: string | null;
  date_of_birth: string | null;
  dietary_needs: string | null;
  luggage_type: string | null;
  luggage_notes: string | null;
  bolso_count: number | null;
  bag_8_count: number | null;
  suitcase_10_count: number | null;
  suitcase_15_count: number | null;
  suitcase_23_count: number | null;
  oversize_text: string | null;
  luggage_volume: string | null;
  user_type: string | null;
  visa_required: boolean | null;
  trip_type: string | null;
  arrival_flight_id: string | null;
  flight_number: string | null;
  airline: string | null;
  origin: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  departure_gate: string | null;
  arrival_baggage: string | null;
  hotel_accommodation_id: string | null;
  room_number: string | null;
  room_type: string | null;
  bed_type: string | null;
  wheelchair_user: boolean | null;
  wheelchair_standard_count: number | null;
  wheelchair_sport_count: number | null;
  sports_equipment: string | null;
  requires_assistance: boolean | null;
  observations: string | null;
  region: string | null;
  transport_type: string | null;
  bus_plate: string | null;
  bus_driver_name: string | null;
  bus_company: string | null;
  is_delegation_lead: boolean | null;
  transport_trip_id: string | null;
  transport_vehicle_id: string | null;
  airport_checkin_at: string | null;
  hotel_checkin_at: string | null;
  hotel_checkout_at: string | null;
  accreditation_status: string;
  accreditation_validated_at: string | null;
  accreditation_validated_by: string | null;
  accreditation_notes: string | null;
  credential_code: string | null;
  credential_issued_at: string | null;
  credential_issued_by: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AthletesService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    @InjectRepository(Athlete)
    private readonly athleteRepository: Repository<Athlete>,
    private readonly dataSource: DataSource,
    private readonly mobileAuth: MobileAuthService,
    private readonly scope: StaffScopeService,
  ) {}

  private getAdminClient() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey);
  }

  private toRow(dto: CreateAthleteDto | UpdateAthleteDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) row.event_id = dto.eventId;
    if (dto.delegationId !== undefined) row.delegation_id = dto.delegationId ?? null;
    if (dto.disciplineId !== undefined) row.discipline_id = dto.disciplineId ?? null;
    if (dto.disciplineIds !== undefined) row.discipline_ids = dto.disciplineIds ?? [];
    if (dto.fullName !== undefined) row.full_name = dto.fullName;
    if (dto.email !== undefined) row.email = dto.email ?? null;
    if (dto.phone !== undefined) row.phone = dto.phone ?? null;
    if (dto.countryCode !== undefined) row.country_code = dto.countryCode ?? null;
    if (dto.passportNumber !== undefined) row.passport_number = dto.passportNumber ?? null;
    if (dto.rut !== undefined) row.rut = dto.rut?.trim() || null;
    if (dto.dateOfBirth !== undefined) row.date_of_birth = dto.dateOfBirth ?? null;
    if (dto.dietaryNeeds !== undefined) row.dietary_needs = dto.dietaryNeeds ?? null;
    if (dto.luggageType !== undefined) row.luggage_type = dto.luggageType ?? null;
    if (dto.luggageNotes !== undefined) row.luggage_notes = dto.luggageNotes ?? null;
    if (dto.bolsoCount !== undefined) row.bolso_count = dto.bolsoCount ?? 0;
    if (dto.bag8Count !== undefined) row.bag_8_count = dto.bag8Count ?? 0;
    if (dto.suitcase10Count !== undefined) row.suitcase_10_count = dto.suitcase10Count ?? 0;
    if (dto.suitcase15Count !== undefined) row.suitcase_15_count = dto.suitcase15Count ?? 0;
    if (dto.suitcase23Count !== undefined) row.suitcase_23_count = dto.suitcase23Count ?? 0;
    if (dto.oversizeText !== undefined) row.oversize_text = dto.oversizeText ?? null;
    if (dto.luggageVolume !== undefined) row.luggage_volume = dto.luggageVolume ?? null;
    if (dto.userType !== undefined) row.user_type = dto.userType ?? null;
    if (dto.visaRequired !== undefined) row.visa_required = dto.visaRequired ?? null;
    if (dto.tripType !== undefined) row.trip_type = dto.tripType ?? null;
    if (dto.arrivalFlightId !== undefined) row.arrival_flight_id = dto.arrivalFlightId ?? null;
    if (dto.flightNumber !== undefined) row.flight_number = dto.flightNumber ?? null;
    if (dto.airline !== undefined) row.airline = dto.airline ?? null;
    if (dto.origin !== undefined) row.origin = dto.origin ?? null;
    if (dto.arrivalTime !== undefined) row.arrival_time = dto.arrivalTime ?? null;
    if (dto.departureTime !== undefined) row.departure_time = dto.departureTime ?? null;
    if (dto.departureGate !== undefined) row.departure_gate = dto.departureGate ?? null;
    if (dto.arrivalBaggage !== undefined) row.arrival_baggage = dto.arrivalBaggage ?? null;
    if (dto.hotelAccommodationId !== undefined) row.hotel_accommodation_id = dto.hotelAccommodationId ?? null;
    if (dto.roomNumber !== undefined) row.room_number = dto.roomNumber ?? null;
    if (dto.roomType !== undefined) row.room_type = dto.roomType ?? null;
    if (dto.bedType !== undefined) row.bed_type = dto.bedType ?? null;
    if (dto.wheelchairUser !== undefined) row.wheelchair_user = dto.wheelchairUser ?? false;
    if (dto.wheelchairStandardCount !== undefined) row.wheelchair_standard_count = dto.wheelchairStandardCount ?? 0;
    if (dto.wheelchairSportCount !== undefined) row.wheelchair_sport_count = dto.wheelchairSportCount ?? 0;
    if (dto.sportsEquipment !== undefined) row.sports_equipment = dto.sportsEquipment ?? null;
    if (dto.requiresAssistance !== undefined) row.requires_assistance = dto.requiresAssistance ?? false;
    if (dto.observations !== undefined) row.observations = dto.observations ?? null;
    if (dto.region !== undefined) row.region = dto.region ?? null;
    if (dto.transportType !== undefined) row.transport_type = dto.transportType ?? null;
    if (dto.busPlate !== undefined) row.bus_plate = dto.busPlate ?? null;
    if (dto.busDriverName !== undefined) row.bus_driver_name = dto.busDriverName ?? null;
    if (dto.busCompany !== undefined) row.bus_company = dto.busCompany ?? null;
    if (dto.isDelegationLead !== undefined) row.is_delegation_lead = dto.isDelegationLead ?? false;
    if (dto.transportTripId !== undefined) row.transport_trip_id = dto.transportTripId ?? null;
    if (dto.transportVehicleId !== undefined) row.transport_vehicle_id = dto.transportVehicleId ?? null;
    if (dto.airportCheckinAt !== undefined) row.airport_checkin_at = dto.airportCheckinAt ?? null;
    if (dto.hotelCheckinAt !== undefined) row.hotel_checkin_at = dto.hotelCheckinAt ?? null;
    if (dto.hotelCheckoutAt !== undefined) row.hotel_checkout_at = dto.hotelCheckoutAt ?? null;
    if (dto.accreditationStatus !== undefined) row.accreditation_status = dto.accreditationStatus;
    if (dto.accreditationValidatedAt !== undefined) row.accreditation_validated_at = dto.accreditationValidatedAt ?? null;
    if (dto.accreditationValidatedBy !== undefined) row.accreditation_validated_by = dto.accreditationValidatedBy ?? null;
    if (dto.accreditationNotes !== undefined) row.accreditation_notes = dto.accreditationNotes ?? null;
    if (dto.credentialCode !== undefined) row.credential_code = dto.credentialCode ?? null;
    if (dto.credentialIssuedAt !== undefined) row.credential_issued_at = dto.credentialIssuedAt ?? null;
    if (dto.credentialIssuedBy !== undefined) row.credential_issued_by = dto.credentialIssuedBy ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.metadata !== undefined) row.metadata = dto.metadata ?? {};

    return row;
  }

  private withDerivedFields(athlete: Athlete): Athlete {
    return {
      ...athlete,
      luggageNotes: athlete.luggageNotes ?? athlete.oversizeText ?? null,
    };
  }

  private toEntity(row: AthleteRow): Athlete {
    return {
      id: row.id,
      eventId: row.event_id,
      delegationId: row.delegation_id,
      disciplineId: row.discipline_id,
      disciplineIds: row.discipline_ids ?? [],
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      countryCode: row.country_code,
      passportNumber: row.passport_number,
      rut: row.rut ?? null,
      dateOfBirth: row.date_of_birth ? new Date(row.date_of_birth) : null,
      dietaryNeeds: row.dietary_needs,
      luggageType: row.luggage_type,
      luggageNotes: row.luggage_notes,
      bolsoCount: row.bolso_count ?? 0,
      bag8Count: row.bag_8_count ?? 0,
      suitcase10Count: row.suitcase_10_count ?? 0,
      suitcase15Count: row.suitcase_15_count ?? 0,
      suitcase23Count: row.suitcase_23_count ?? 0,
      oversizeText: row.oversize_text,
      luggageVolume: row.luggage_volume,
      userType: row.user_type,
      visaRequired: row.visa_required,
      tripType: row.trip_type,
      arrivalFlightId: row.arrival_flight_id,
      flightNumber: row.flight_number,
      airline: row.airline,
      origin: row.origin,
      arrivalTime: row.arrival_time ? new Date(row.arrival_time) : null,
      departureTime: row.departure_time ? new Date(row.departure_time) : null,
      departureGate: row.departure_gate,
      arrivalBaggage: row.arrival_baggage,
      hotelAccommodationId: row.hotel_accommodation_id,
      roomNumber: row.room_number,
      roomType: row.room_type,
      bedType: row.bed_type,
      wheelchairUser: row.wheelchair_user ?? false,
      wheelchairStandardCount: row.wheelchair_standard_count ?? 0,
      wheelchairSportCount: row.wheelchair_sport_count ?? 0,
      sportsEquipment: row.sports_equipment,
      requiresAssistance: row.requires_assistance ?? false,
      observations: row.observations,
      region: row.region,
      transportType: row.transport_type,
      busPlate: row.bus_plate,
      busDriverName: row.bus_driver_name,
      busCompany: row.bus_company,
      isDelegationLead: row.is_delegation_lead ?? false,
      transportTripId: row.transport_trip_id,
      transportVehicleId: row.transport_vehicle_id,
      airportCheckinAt: row.airport_checkin_at ? new Date(row.airport_checkin_at) : null,
      hotelCheckinAt: row.hotel_checkin_at ? new Date(row.hotel_checkin_at) : null,
      hotelCheckoutAt: row.hotel_checkout_at ? new Date(row.hotel_checkout_at) : null,
      accreditationStatus: row.accreditation_status,
      accreditationValidatedAt: row.accreditation_validated_at ? new Date(row.accreditation_validated_at) : null,
      accreditationValidatedBy: row.accreditation_validated_by,
      accreditationNotes: row.accreditation_notes,
      credentialCode: row.credential_code,
      credentialIssuedAt: row.credential_issued_at ? new Date(row.credential_issued_at) : null,
      credentialIssuedBy: row.credential_issued_by,
      status: row.status,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

    private async syncHotelAssignment(
    athlete: Athlete,
    dto: CreateAthleteDto | UpdateAthleteDto,
  ) {
    const hotelAccommodationId =
      dto.hotelAccommodationId !== undefined
        ? dto.hotelAccommodationId
        : athlete.hotelAccommodationId;
    const roomNumber =
      dto.roomNumber !== undefined ? dto.roomNumber : athlete.roomNumber;

    if (dto.hotelAccommodationId === null) {
      await this.dataSource.query(
        `
        delete from logistics.hotel_assignments
        where participant_id = $1
      `,
        [athlete.id],
      );
      return;
    }

    if (!hotelAccommodationId) return;

    let roomId: string | null = null;
    if (roomNumber) {
      const rooms = (await this.dataSource.query(
        `
        select id
        from logistics.hotel_rooms
        where hotel_id = $1
          and room_number = $2
        order by created_at asc
        limit 1
      `,
        [hotelAccommodationId, roomNumber],
      )) as Array<{ id: string }>;
      roomId = rooms[0]?.id ?? null;
    }

    await this.dataSource.query(
      `
      insert into logistics.hotel_assignments (
        participant_id,
        hotel_id,
        room_id,
        status
      ) values ($1, $2, $3, 'ASSIGNED')
      on conflict (participant_id)
      do update
      set
        hotel_id = excluded.hotel_id,
        room_id = excluded.room_id,
        status = excluded.status,
        updated_at = now()
    `,
      [athlete.id, hotelAccommodationId, roomId],
    );
  }
    async create(createAthleteDto: CreateAthleteDto) {
    const row = this.toRow(createAthleteDto);
    const keys = Object.keys(row);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const values = keys.map((key) => row[key]);

    const rows = (await this.dataSource.query(
      `
      insert into core.athletes (${columns})
      values (${placeholders})
      returning *
    `,
      values,
    )) as AthleteRow[];

    if (!rows[0]) {
      throw new InternalServerErrorException('Error creating athlete');
    }

    const athlete = this.toEntity(rows[0]);
    await this.syncHotelAssignment(athlete, createAthleteDto);
    return athlete;
  }
  async findAll(filters?: { delegationId?: string; eventId?: string }) {
    try {
      const where: Record<string, string> = {};
      if (filters?.delegationId) where.delegationId = filters.delegationId;
      if (filters?.eventId) where.eventId = filters.eventId;
      const athletes = await this.athleteRepository.find({
        where: Object.keys(where).length > 0 ? where : undefined,
        order: { fullName: 'ASC' },
      });
      return athletes.map((athlete) => this.withDerivedFields(athlete));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching athletes',
      );
    }
  }

  /**
   * La ficha incluye el nombre del evento y de la delegación resueltos en la
   * misma consulta: el portal los mostraba pidiendo /events/:id y
   * /delegations/:id completos, dos peticiones que encadenan media docena de
   * consultas cada una sólo para leer un nombre.
   */
  async findOne(id: string) {
    let data: (Athlete & { eventName?: string | null; delegationName?: string | null; delegationCountryCode?: string | null }) | null;
    try {
      const rows = await this.dataSource.query<
        Array<{ a: Athlete; event_name: string | null; delegation_name: string | null; delegation_country: string | null }>
      >(
        `select to_jsonb(a) as a,
                e.name as event_name,
                d.metadata->>'name' as delegation_name,
                d.country_code as delegation_country
           from core.athletes a
           left join core.events e on e.id = a.event_id
           left join core.delegations d on d.id = a.delegation_id
          where a.id = $1`,
        [id],
      );
      const row = rows[0];
      data = row
        ? {
            ...this.toEntity(row.a as unknown as AthleteRow),
            eventName: row.event_name,
            delegationName: row.delegation_name,
            delegationCountryCode: row.delegation_country,
          }
        : null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching athlete',
      );
    }

    if (!data) {
      throw new NotFoundException(`Athlete with id ${id} not found`);
    }

    return this.withDerivedFields(data);
  }

    async update(id: string, updateAthleteDto: UpdateAthleteDto) {
    const row = this.toRow(updateAthleteDto);
    const keys = Object.keys(row);
    if (keys.length === 0) return this.findOne(id);

    // Cómo estaba antes, para saber si esta edición *valida* la ficha y no
    // sólo la vuelve a guardar ya validada. Se lee únicamente cuando la
    // edición toca lo que define la validación: el resto de los guardados no
    // paga una consulta de más.
    const tocaValidacion =
      updateAthleteDto.status !== undefined || updateAthleteDto.metadata !== undefined;
    const previas = tocaValidacion
      ? ((await this.dataSource.query(
          `select status, metadata from core.athletes where id = $1`,
          [id],
        )) as Array<{ status: string | null; metadata: Record<string, unknown> | null }>)
      : [];
    const validadoAntes = previas[0] ? estaValidado(previas[0]) : false;

    const setSql = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = keys.map((key) => row[key]);

    const rows = (await this.dataSource.query(
      `
      update core.athletes
      set ${setSql}, updated_at = now()
      where id = $1
      returning *
    `,
      [id, ...values],
    )) as AthleteRow[];

    if (!rows[0]) {
      throw new NotFoundException(`Athlete with id ${id} not found`);
    }

    const athlete = this.toEntity(rows[0]);
    if (
      updateAthleteDto.isDelegationLead !== undefined ||
      updateAthleteDto.delegationId !== undefined ||
      updateAthleteDto.status !== undefined
    ) {
      this.scope.invalidate(id);
    }
    const shouldSyncHotel =
      updateAthleteDto.hotelAccommodationId !== undefined ||
      updateAthleteDto.roomNumber !== undefined ||
      updateAthleteDto.roomType !== undefined;
    if (shouldSyncHotel) {
      await this.syncHotelAssignment(athlete, updateAthleteDto);
    }

    // Validar es el momento en que el participante pasa a poder entrar al
    // portal, así que es cuando corresponde mandarle su código. Va acá y no
    // en el panel para que valga por cualquier camino que valide la ficha.
    //
    // Sólo en el cruce de no-validado a validado: si no, cada guardado
    // posterior de una ficha ya validada volvería a mandar el correo.
    if (tocaValidacion && !validadoAntes && estaValidado(rows[0])) {
      await this.enviarCodigoAlValidar(athlete);
    }
    return athlete;
  }

  /**
   * Manda el código de acceso al validar. Nunca hace fallar la validación: si
   * el correo no sale, la ficha igual queda validada y el resultado viaja en
   * `accessCodeSent` / `accessCodeNote` para que el panel lo diga. Al revés
   * —cortar por un correo— dejaría al participante sin validar por algo que
   * no tiene que ver con sus datos.
   */
  private async enviarCodigoAlValidar(athlete: Athlete) {
    const email = String(athlete.email ?? '').trim().toLowerCase();
    if (!email) {
      athlete.accessCodeSent = false;
      athlete.accessCodeNote = 'Sin correo registrado';
      return;
    }
    try {
      await sendResendEmail({
        to: email,
        ...correoDeCodigo(athlete.fullName ?? 'Participante', athlete.id),
      });
      athlete.accessCodeSent = true;
    } catch (error) {
      athlete.accessCodeSent = false;
      athlete.accessCodeNote =
        error instanceof Error ? error.message : 'No se pudo enviar el correo';
    }
  }
  /**
   * Reactiva una cuenta dada de baja desde el portal (status DELETED):
   * restaura el estado previo guardado en metadata.statusBeforeDeletion y
   * limpia las marcas de la baja.
   */
  async reactivate(id: string) {
    const { data: current, error: readError } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, status, metadata')
      .eq('id', id)
      .maybeSingle();
    if (readError) {
      throw new InternalServerErrorException(
        readError.message || 'Error fetching athlete',
      );
    }
    if (!current || current.status !== 'DELETED') {
      throw new NotFoundException(
        `Athlete with id ${id} not found or not deleted`,
      );
    }

    const metadata = {
      ...((current.metadata as Record<string, unknown>) ?? {}),
    };
    // Purga definitiva ya ejecutada (30 días tras la baja): los datos
    // personales no existen más, así que no hay cuenta que restaurar.
    if (metadata.purgedAt) {
      throw new BadRequestException(
        'Los datos de esta cuenta fueron eliminados definitivamente; ya no es posible reactivarla.',
      );
    }
    const previous = metadata.statusBeforeDeletion;
    const restoredStatus =
      typeof previous === 'string' && previous ? previous : 'REGISTERED';
    delete metadata.deletedAt;
    delete metadata.deletedBy;
    delete metadata.statusBeforeDeletion;

    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .update({ status: restoredStatus, metadata })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error reactivating athlete',
      );
    }
    if (!data) {
      throw new NotFoundException(`Athlete with id ${id} not found`);
    }

    return this.toEntity(data as AthleteRow);
  }

    async remove(id: string) {
    const rows = (await this.dataSource.query(
      `
      delete from core.athletes
      where id = $1
      returning *
    `,
      [id],
    )) as AthleteRow[];

    if (!rows[0]) {
      throw new NotFoundException(`Athlete with id ${id} not found`);
    }

    return this.toEntity(rows[0]);
  }
  async requestAccess(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .select('id, full_name, email, is_delegation_lead')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching athlete',
      );
    }

    if (!data) {
      throw new BadRequestException(
        'El correo no corresponde a un participante registrado',
      );
    }

    try {
      await sendResendEmail({
        to: normalizedEmail,
        ...correoDeCodigo(data.full_name ?? 'Encargado', data.id),
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo enviar el correo',
      );
    }

    return { message: 'Código enviado al correo' };
  }

  /**
   * Envío del código de acceso desde el panel, a uno o a muchos.
   *
   * El participante entra al portal con los últimos seis caracteres de su id,
   * y hasta ahora la única forma de que lo recibiera era que él mismo lo
   * pidiera desde la pantalla de ingreso: quien inscribía tenía que dictarlo
   * por teléfono o copiarlo a mano en un correo.
   *
   * Devuelve el detalle de lo que no salió en vez de cortar en el primer
   * error: en una tanda de doscientos, que a tres les falte el correo no es
   * motivo para no mandarle a los otros ciento noventa y siete.
   */
  async sendAccessCodes(ids: string[]) {
    const unicos = [
      ...new Set((ids ?? []).map((id) => String(id ?? '').trim()).filter(Boolean)),
    ];
    if (unicos.length === 0) {
      throw new BadRequestException('No hay participantes seleccionados');
    }
    if (unicos.length > MAX_CODIGOS_POR_TANDA) {
      throw new BadRequestException(
        `Son demasiados de una vez: hasta ${MAX_CODIGOS_POR_TANDA} por envío`,
      );
    }

    const fallidos: Array<{ id: string; fullName: string; motivo: string }> = [];

    // Un id que no es uuid haría fallar la consulta entera; se aparta antes.
    const uuids = unicos.filter((id) => UUID_RE.test(id));
    unicos
      .filter((id) => !UUID_RE.test(id))
      .forEach((id) => fallidos.push({ id, fullName: '—', motivo: 'Id inválido' }));

    const filas = uuids.length
      ? ((await this.dataSource.query(
          `select id, full_name, email, status
             from core.athletes
            where id = any($1::uuid[])`,
          [uuids],
        )) as Array<{
          id: string;
          full_name: string | null;
          email: string | null;
          status: string | null;
        }>)
      : [];

    const porId = new Map(filas.map((fila) => [fila.id, fila]));
    const destinatarios: Array<{ id: string; fullName: string; email: string }> = [];

    for (const id of uuids) {
      const fila = porId.get(id);
      if (!fila) {
        fallidos.push({ id, fullName: '—', motivo: 'No existe' });
        continue;
      }
      const fullName = fila.full_name ?? 'Participante';
      if (String(fila.status ?? '').toUpperCase() === 'DELETED') {
        fallidos.push({ id, fullName, motivo: 'Cuenta dada de baja' });
        continue;
      }
      const email = String(fila.email ?? '').trim().toLowerCase();
      if (!email) {
        fallidos.push({ id, fullName, motivo: 'Sin correo registrado' });
        continue;
      }
      destinatarios.push({ id, fullName, email });
    }

    // En un solo lote: Resend limita las peticiones por segundo, no los
    // correos, así que cien de a uno se comen el límite y cien juntos no.
    let enviados = 0;
    if (destinatarios.length > 0) {
      const mensajes = destinatarios.map((destinatario) => ({
        to: destinatario.email,
        ...correoDeCodigo(destinatario.fullName, destinatario.id),
      }));
      try {
        const aceptados = await sendResendBatch(mensajes);
        enviados = Math.min(aceptados, destinatarios.length);
        // Si volvieron menos ids que mensajes no se sabe cuáles quedaron
        // afuera —la respuesta es posicional— así que se dice cuántos.
        if (enviados < destinatarios.length) {
          fallidos.push({
            id: '',
            fullName: `${destinatarios.length - enviados} participante(s)`,
            motivo: 'El proveedor no confirmó el envío',
          });
        }
      } catch (errorLote) {
        // El lote entero se cayó. Se reintenta de a uno para saber a quién le
        // llegó y a quién no, en vez de dar cien por perdidos.
        const motivoLote =
          errorLote instanceof Error ? errorLote.message : 'Error de envío';
        for (const destinatario of destinatarios) {
          try {
            await sendResendEmail({
              to: destinatario.email,
              ...correoDeCodigo(destinatario.fullName, destinatario.id),
            });
            enviados += 1;
          } catch {
            fallidos.push({
              id: destinatario.id,
              fullName: destinatario.fullName,
              motivo: motivoLote,
            });
          }
        }
      }
    }

    return { enviados, fallidos, total: unicos.length };
  }

  async uploadHealthDocument(id: string, dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new BadRequestException('Invalid document payload');

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const path = `${id}/${Date.now()}.${extension}`;

    const admin = this.getAdminClient();
    if (!admin) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to upload health documents',
      );
    }

    const { error } = await admin.storage
      .from('athlete-health-docs')
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(error.message || 'Error uploading health document');
    }

    // SA-BACKEND-01 · Req 1: el bucket es privado. Se persiste la RUTA del
    // archivo, no una URL pública — el documento se sirve con URLs firmadas
    // de vigencia limitada vía GET /athletes/:id/health-document-url.
    const athlete = await this.findOne(id);
    const existingMetadata = (athlete.metadata as Record<string, unknown>) ?? {};
    const existingHealthRecord = (existingMetadata.healthRecord as Record<string, unknown>) ?? {};
    const updatedMetadata = {
      ...existingMetadata,
      healthRecord: {
        ...existingHealthRecord,
        medicalDocumentPath: path,
        medicalDocumentUrl: null,
        medicalDocumentUploadedAt: new Date().toISOString(),
      },
    };

    return this.update(id, { metadata: updatedMetadata });
  }

  /**
   * URL firmada de vigencia limitada para el documento médico (bucket
   * privado). Sólo el propio atleta (sesión de portal) o el personal del
   * panel pueden solicitarla.
   */
  async getHealthDocumentUrl(id: string, headers: RequestHeaders) {
    await this.assertHealthDocumentAccess(headers, id);

    const athlete = await this.findOne(id);
    const meta = (athlete.metadata as Record<string, unknown>) ?? {};
    const healthRecord = (meta.healthRecord as Record<string, unknown>) ?? {};

    let path =
      typeof healthRecord.medicalDocumentPath === 'string' &&
      healthRecord.medicalDocumentPath
        ? healthRecord.medicalDocumentPath
        : null;
    // Registros antiguos: guardaban la URL pública — se recupera la ruta.
    if (!path && typeof healthRecord.medicalDocumentUrl === 'string') {
      const marker = '/object/public/athlete-health-docs/';
      const index = healthRecord.medicalDocumentUrl.indexOf(marker);
      if (index >= 0) {
        path = decodeURIComponent(
          healthRecord.medicalDocumentUrl.slice(index + marker.length),
        );
      }
    }
    if (!path) {
      throw new NotFoundException('El participante no tiene documento médico');
    }

    const admin = this.getAdminClient();
    if (!admin) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to sign health document URLs',
      );
    }
    const { data, error } = await admin.storage
      .from('athlete-health-docs')
      .createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(
        error?.message || 'No se pudo generar la URL del documento',
      );
    }
    return { url: data.signedUrl, expiresIn: 600 };
  }

  /**
   * Staff del panel (sesión Supabase que no sea una cuenta de conductor) o el
   * propio atleta con su sesión de portal activa. Cualquier otro caso: 403.
   */
  private async assertHealthDocumentAccess(
    headers: RequestHeaders,
    athleteId: string,
  ): Promise<void> {
    const headerValue = (name: string): string => {
      const raw = headers[name];
      return String(Array.isArray(raw) ? raw[0] : (raw ?? '')).trim();
    };

    const authHeader = headerValue('authorization');
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const { data, error } = await this.supabase.auth.getUser(token);
          if (!error && data?.user) {
            // Las cuentas Supabase vinculadas a conductores no son staff.
            const rows = (await this.dataSource.query(
              `select 1 from transport.drivers where user_id = $1 limit 1`,
              [data.user.id],
            )) as unknown[];
            if (rows.length === 0) return;
          }
        } catch {
          // token ilegible: se sigue con la vía de portal
        }
      }
    }

    const kind = headerValue('x-portal-kind');
    const userId = headerValue('x-portal-user');
    const sessionId = headerValue('x-portal-session');
    if (
      kind === 'athlete' &&
      userId === athleteId &&
      (await this.mobileAuth.validateSessionStrict(kind, userId, sessionId))
    ) {
      return;
    }

    throw new ForbiddenException(
      'El documento médico sólo es visible para su titular o el personal autorizado',
    );
  }

  async uploadPhoto(id: string, dataUrl: string) {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new BadRequestException('Invalid photo payload');

    const contentType = match[1];
    const base64 = match[2];
    const buffer = Buffer.from(base64, 'base64');
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const path = `photos/${id}/${Date.now()}.${extension}`;

    const admin = this.getAdminClient();
    if (!admin) {
      throw new InternalServerErrorException(
        'SUPABASE_SERVICE_ROLE_KEY is required to upload athlete photos',
      );
    }

    const { error } = await admin.storage
      .from('athlete-photos')
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      throw new InternalServerErrorException(error.message || 'Error uploading athlete photo');
    }

    const { data } = admin.storage.from('athlete-photos').getPublicUrl(path);
    const publicUrl = data?.publicUrl ?? null;
    if (!publicUrl) {
      throw new InternalServerErrorException('Error resolving athlete photo URL');
    }

    const athlete = await this.findOne(id);
    const existingMetadata = (athlete.metadata as Record<string, unknown>) ?? {};

    return this.update(id, {
      metadata: { ...existingMetadata, photoUrl: publicUrl },
    });
  }
}

