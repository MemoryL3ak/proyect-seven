import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { Venue } from './entities/venue.entity';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue)
    private readonly venuesRepository: Repository<Venue>,
  ) {}

  async create(createVenueDto: CreateVenueDto) {
    const venue = this.venuesRepository.create({
      eventId: createVenueDto.eventId,
      name: createVenueDto.name,
      address: createVenueDto.address ?? null,
      region: createVenueDto.region ?? null,
      commune: createVenueDto.commune ?? null,
    });
    return this.venuesRepository.save(venue);
  }

  async findAll() {
    return this.venuesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const venue = await this.venuesRepository.findOne({ where: { id } });
    if (!venue) throw new NotFoundException(`Venue with id ${id} not found`);
    return venue;
  }

  async update(id: string, updateVenueDto: UpdateVenueDto) {
    const venue = await this.findOne(id);
    Object.assign(venue, {
      ...(updateVenueDto.eventId !== undefined ? { eventId: updateVenueDto.eventId } : {}),
      ...(updateVenueDto.name !== undefined ? { name: updateVenueDto.name } : {}),
      ...(updateVenueDto.address !== undefined ? { address: updateVenueDto.address ?? null } : {}),
      ...(updateVenueDto.region !== undefined ? { region: updateVenueDto.region ?? null } : {}),
      ...(updateVenueDto.commune !== undefined ? { commune: updateVenueDto.commune ?? null } : {}),
    });
    return this.venuesRepository.save(venue);
  }

  async remove(id: string) {
    const venue = await this.findOne(id);
    await this.venuesRepository.remove(venue);
    return venue;
  }
}
