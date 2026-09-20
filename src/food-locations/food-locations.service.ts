import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { delegationHotelsSql } from '../shared/delegation-hotels';
import { CreateFoodLocationDto } from './dto/create-food-location.dto';
import { UpdateFoodLocationDto } from './dto/update-food-location.dto';
import { FoodLocation } from './entities/food-location.entity';

type FoodLocationRow = {
  id: string;
  accommodation_id: string | null;
  name: string;
  address: string | null;
  description: string | null;
  capacity: number | null;
  client_types: string[];
  delegation_ids: string[] | null;
  discipline_ids: string[] | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class FoodLocationsService {
  constructor(private readonly dataSource: DataSource) {}

  private toEntity(row: FoodLocationRow): FoodLocation {
    return {
      id: row.id,
      accommodationId: row.accommodation_id ?? undefined,
      name: row.name,
      address: row.address ?? undefined,
      description: row.description ?? undefined,
      capacity: row.capacity ?? undefined,
      clientTypes: row.client_types ?? [],
      delegationIds: row.delegation_ids ?? [],
      disciplineIds: row.discipline_ids ?? [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateFoodLocationDto) {
    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.food_locations
          (accommodation_id, name, address, description, capacity, client_types, delegation_ids, discipline_ids)
        values ($1, $2, $3, $4, $5, $6, $7::uuid[], $8::uuid[])
        returning *
        `,
        [
          dto.accommodationId ?? null,
          dto.name,
          dto.address ?? null,
          dto.description ?? null,
          dto.capacity ?? null,
          dto.clientTypes ?? [],
          dto.delegationIds ?? [],
          dto.disciplineIds ?? [],
        ],
      )) as FoodLocationRow[];
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating food location',
      );
    }
  }

  /**
   * @param delegationId Jefe de Misión: sólo los lugares de los hoteles de su
   * delegación (vínculo explícito o donde se alojan sus participantes) y los
   * puntos generales sin hotel.
   */
  async findAll(delegationId?: string | null) {
    try {
      const rows = await this.dataSource.query<FoodLocationRow[]>(
        `select * from logistics.food_locations
         where ($1::uuid is null
                or accommodation_id is null
                or accommodation_id in ${delegationHotelsSql('$1')})
         order by created_at desc`,
        [delegationId ?? null],
      );
      return rows.map((r) => this.toEntity(r));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching food locations',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.food_locations where id = $1 limit 1`,
        [id],
      )) as FoodLocationRow[];
      if (!rows[0]) throw new NotFoundException(`Food location ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching food location',
      );
    }
  }

  async update(id: string, dto: UpdateFoodLocationDto) {
    const map: Record<string, unknown> = {};
    if (dto.accommodationId !== undefined) map.accommodation_id = dto.accommodationId;
    if (dto.name !== undefined) map.name = dto.name;
    if (dto.address !== undefined) map.address = dto.address;
    if (dto.description !== undefined) map.description = dto.description;
    if (dto.capacity !== undefined) map.capacity = dto.capacity;
    if (dto.clientTypes !== undefined) map.client_types = dto.clientTypes;
    if (dto.delegationIds !== undefined) map.delegation_ids = dto.delegationIds;
    if (dto.disciplineIds !== undefined) map.discipline_ids = dto.disciplineIds;

    const keys = Object.keys(map);
    if (keys.length === 0) return this.findOne(id);

    const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map((k) => map[k]);

    try {
      const rows = (await this.dataSource.query(
        `update logistics.food_locations set ${setSql}, updated_at = now() where id = $1 returning *`,
        [id, ...values],
      )) as FoodLocationRow[];
      if (!rows[0]) throw new NotFoundException(`Food location ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating food location',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `delete from logistics.food_locations where id = $1 returning *`,
        [id],
      )) as FoodLocationRow[];
      if (!rows[0]) throw new NotFoundException(`Food location ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting food location',
      );
    }
  }
}
