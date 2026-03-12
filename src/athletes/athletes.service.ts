import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SupabaseClient } from '@supabase/supabase-js';
import * as https from 'https';
import { Repository } from 'typeorm';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { Athlete } from './entities/athlete.entity';

type AthleteRow = {
  id: string;
  event_id: string;
  delegation_id: string | null;
  discipline_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  passport_number: string | null;
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
    @InjectRepository(Athlete)
    private readonly athleteRepository: Repository<Athlete>,
  ) {}

  private toRow(dto: CreateAthleteDto | UpdateAthleteDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) row.event_id = dto.eventId;
    if (dto.delegationId !== undefined) row.delegation_id = dto.delegationId ?? null;
    if (dto.disciplineId !== undefined) row.discipline_id = dto.disciplineId ?? null;
    if (dto.fullName !== undefined) row.full_name = dto.fullName;
    if (dto.email !== undefined) row.email = dto.email ?? null;
    if (dto.phone !== undefined) row.phone = dto.phone ?? null;
    if (dto.countryCode !== undefined) row.country_code = dto.countryCode ?? null;
    if (dto.passportNumber !== undefined) row.passport_number = dto.passportNumber ?? null;
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
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      countryCode: row.country_code,
      passportNumber: row.passport_number,
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
    const bedType = dto.bedType !== undefined ? dto.bedType : athlete.bedType;

    const { data: existingAssignment } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .select('id, bed_id')
      .eq('participant_id', athlete.id)
      .maybeSingle();

    if (dto.hotelAccommodationId === null) {
      if (existingAssignment?.bed_id) {
        await this.supabase
          .schema('logistics')
          .from('hotel_beds')
          .update({ status: 'AVAILABLE' })
          .eq('id', existingAssignment.bed_id);
      }
      const { error } = await this.supabase
        .schema('logistics')
        .from('hotel_assignments')
        .delete()
        .eq('participant_id', athlete.id);

      if (error) {
        throw new InternalServerErrorException(
          error.message || 'Error clearing hotel assignment',
        );
      }
      return;
    }

    if (!hotelAccommodationId) return;

    let roomId: string | null = null;
    if (roomNumber) {
      const { data: room, error: roomError } = await this.supabase
        .schema('logistics')
        .from('hotel_rooms')
        .select('id')
        .eq('hotel_id', hotelAccommodationId)
        .eq('room_number', roomNumber)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (roomError) {
        throw new InternalServerErrorException(
          roomError.message || 'Error fetching hotel room',
        );
      }
      roomId = room?.id ?? null;
    }

    let bedId: string | null = null;
    if (bedType && roomId) {
      const { data: assignedBeds, error: assignedBedsError } =
        await this.supabase
          .schema('logistics')
          .from('hotel_assignments')
          .select('bed_id')
          .eq('room_id', roomId)
          .not('bed_id', 'is', null);

      if (assignedBedsError) {
        throw new InternalServerErrorException(
          assignedBedsError.message || 'Error fetching assigned beds',
        );
      }

      const occupied = new Set(
        (assignedBeds ?? [])
          .map((row) => row.bed_id as string | null)
          .filter((id): id is string => typeof id === 'string'),
      );

      const { data: beds, error: bedsError } = await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .select('id, status')
        .eq('room_id', roomId)
        .eq('bed_type', bedType)
        .order('created_at', { ascending: true });

      if (bedsError) {
        throw new InternalServerErrorException(
          bedsError.message || 'Error fetching hotel beds',
        );
      }

      const availableBed = (beds ?? []).find((bed) => !occupied.has(bed.id));
      bedId = availableBed?.id ?? null;

      if (!bedId) {
        throw new BadRequestException(
          'No hay camas disponibles para esa habitación',
        );
      }
    }

    if (existingAssignment?.bed_id && existingAssignment.bed_id !== bedId) {
      await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ status: 'AVAILABLE' })
        .eq('id', existingAssignment.bed_id);
    }

    const { error } = await this.supabase
      .schema('logistics')
      .from('hotel_assignments')
      .upsert(
        {
          participant_id: athlete.id,
          hotel_id: hotelAccommodationId,
          room_id: roomId,
          bed_id: bedId,
          status: 'ASSIGNED',
        },
        { onConflict: 'participant_id' },
      );

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error saving hotel assignment',
      );
    }

    if (bedId) {
      const { error: bedStatusError } = await this.supabase
        .schema('logistics')
        .from('hotel_beds')
        .update({ status: 'OCCUPIED' })
        .eq('id', bedId);

      if (bedStatusError) {
        throw new InternalServerErrorException(
          bedStatusError.message || 'Error updating bed status',
        );
      }
    }
  }

  async create(createAthleteDto: CreateAthleteDto) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .insert(this.toRow(createAthleteDto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating athlete',
      );
    }

    const athlete = this.toEntity(data as AthleteRow);
    await this.syncHotelAssignment(athlete, createAthleteDto);
    return athlete;
  }

  async findAll() {
    try {
      const athletes = await this.athleteRepository.find({
        order: { fullName: 'ASC' },
      });
      return athletes.map((athlete) => this.withDerivedFields(athlete));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching athletes',
      );
    }
  }

  async findOne(id: string) {
    let data: Athlete | null;
    try {
      data = await this.athleteRepository.findOne({ where: { id } });
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
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .update(this.toRow(updateAthleteDto))
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error updating athlete',
      );
    }

    if (!data) {
      throw new NotFoundException(`Athlete with id ${id} not found`);
    }

    const athlete = this.toEntity(data as AthleteRow);
    const shouldSyncHotel =
      updateAthleteDto.hotelAccommodationId !== undefined ||
      updateAthleteDto.roomNumber !== undefined ||
      updateAthleteDto.bedType !== undefined;
    if (shouldSyncHotel) {
      await this.syncHotelAssignment(athlete, updateAthleteDto);
    }
    return athlete;
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('athletes')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting athlete',
      );
    }

    if (!data) {
      throw new NotFoundException(`Athlete with id ${id} not found`);
    }

    return this.toEntity(data as AthleteRow);
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

    if (!data || !data.is_delegation_lead) {
      throw new BadRequestException(
        'El correo no corresponde a un encargado de delegación',
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;

    if (!apiKey || !from) {
      throw new InternalServerErrorException('Email provider not configured');
    }

    const fullName = data.full_name ?? 'Encargado';
    const accessCode = data.id.slice(-6);
    const subject = 'Tu código de acceso';
    const text = `Hola ${fullName},\n\nTu código de acceso para ingresar al portal es:\n${accessCode}\n\nGuárdalo en un lugar seguro.\n`;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tu codigo de acceso</title>
  </head>
  <body style="margin:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 12px 30px rgba(15,23,42,0.08);overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#94a3b8;">Seven</div>
                <h1 style="margin:8px 0 0 0;font-size:22px;font-weight:600;color:#0f172a;">Tu codigo de acceso</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 24px 32px;">
                <p style="margin:0;font-size:14px;color:#475569;">Hola ${fullName},</p>
                <p style="margin:14px 0 0 0;font-size:14px;color:#475569;">
                  Tu código de acceso para ingresar al portal es:
                </p>
                <div style="margin:16px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;font-size:16px;letter-spacing:0.02em;color:#0f172a;">
                  ${accessCode}
                </div>
                <p style="margin:0;font-size:13px;color:#64748b;">
                  Guardalo en un lugar seguro.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <div style="height:1px;background:#e2e8f0;"></div>
                <p style="margin:14px 0 0 0;font-size:11px;color:#94a3b8;">
                  Si no solicitaste este codigo, ignora este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const payload = JSON.stringify({
      from,
      to: [normalizedEmail],
      subject,
      text,
      html,
    });

    const { status, body } = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const request = https.request(
          {
            method: 'POST',
            hostname: 'api.resend.com',
            path: '/emails',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (response) => {
            let responseBody = '';
            response.on('data', (chunk) => {
              responseBody += chunk;
            });
            response.on('end', () => {
              resolve({ status: response.statusCode ?? 0, body: responseBody });
            });
          },
        );

        request.on('error', (err) => reject(err));
        request.write(payload);
        request.end();
      },
    );

    if (status < 200 || status >= 300) {
      throw new InternalServerErrorException(
        `No se pudo enviar el correo: ${body}`,
      );
    }

    return { message: 'Código enviado al correo' };
  }
}
