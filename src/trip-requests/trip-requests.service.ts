import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TripRequest } from './entities/trip-request.entity';
import {
  APP_CLIENT_TYPES,
  CreateTripRequestDto,
} from './dto/create-trip-request.dto';
import { AssignTripRequestDto } from './dto/assign-trip-request.dto';

@Injectable()
export class TripRequestsService {
  constructor(
    @InjectRepository(TripRequest)
    private readonly repo: Repository<TripRequest>,
  ) {}

  private assertAppClientType(clientType: string | null | undefined) {
    if (!clientType || !APP_CLIENT_TYPES.includes(clientType as never)) {
      throw new BadRequestException(
        'Este submódulo sólo gestiona solicitudes de tipo T1 o VIP',
      );
    }
  }

  /** Crea una solicitud de viaje (T1/VIP) generada desde la app. */
  async create(dto: CreateTripRequestDto) {
    this.assertAppClientType(dto.clientType);

    const request = this.repo.create({
      eventId: dto.eventId,
      clientType: dto.clientType,
      status: 'REQUESTED',
      requestedAt: new Date(),
      requesterAthleteId: dto.requesterAthleteId ?? null,
      origin: dto.origin ?? null,
      destination: dto.destination ?? null,
      destinationVenueId: dto.destinationVenueId ?? null,
      destinationHotelId: dto.destinationHotelId ?? null,
      requestedVehicleType: dto.requestedVehicleType ?? null,
      passengerCount: dto.passengerCount ?? null,
      notes: dto.notes ?? null,
      passengerLat: dto.passengerLat ?? null,
      passengerLng: dto.passengerLng ?? null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
    });

    return this.repo.save(request);
  }

  /**
   * Lista las solicitudes T1/VIP, con filtros opcionales por evento, estado
   * y tipo de cliente.
   */
  async findAll(params: {
    eventId?: string;
    status?: string;
    clientType?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.eventId) where.eventId = params.eventId;
    if (params.status) where.status = params.status;
    if (params.clientType) {
      this.assertAppClientType(params.clientType);
      where.clientType = params.clientType;
    }

    return this.repo.find({
      where,
      order: { requestedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Obtiene una solicitud T1/VIP por id. */
  async findOne(id: string) {
    const request = await this.repo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Solicitud ${id} no encontrada`);
    }
    return request;
  }

  /**
   * Asigna conductor/vehículo a la solicitud y la pasa a SCHEDULED.
   */
  async assign(id: string, dto: AssignTripRequestDto) {
    const request = await this.findOne(id);

    if (!dto.driverId && !dto.vehicleId) {
      throw new BadRequestException(
        'Debe indicar al menos un conductor o un vehículo',
      );
    }

    if (dto.driverId !== undefined) request.driverId = dto.driverId ?? null;
    if (dto.vehicleId !== undefined) request.vehicleId = dto.vehicleId ?? null;
    if (dto.vehiclePlate !== undefined) {
      request.vehiclePlate = dto.vehiclePlate ?? null;
    }
    request.status = 'SCHEDULED';

    return this.repo.save(request);
  }

  /** Cancela una solicitud T1/VIP. */
  async cancel(id: string) {
    const request = await this.findOne(id);
    request.status = 'CANCELLED';
    return this.repo.save(request);
  }
}
