import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFoodLocationDto } from './dto/create-food-location.dto';
import { UpdateFoodLocationDto } from './dto/update-food-location.dto';
import { FoodLocation } from './entities/food-location.entity';

type FoodLocationRow = {
  id: string;
  accommodation_id: string | null;
  name: string;
  description: string | null;
  capacity: number | null;
  client_types: string[];
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
      description: row.description ?? undefined,
      capacity: row.capacity ?? undefined,
      clientTypes: row.client_types ?? [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateFoodLocationDto) {
    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.food_locations (accommodation_id, name, description, capacity, client_types)
        values ($1, $2, $3, $4, $5)
        returning *
        `,
        [
          dto.accommodationId ?? null,
          dto.name,
          dto.description ?? null,
          dto.capacity ?? null,
          dto.clientTypes ?? [],
        ],
      )) as FoodLocationRow[];
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating food location',
      );
    }
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(`
        select * from logistics.food_locations order by created_at desc
      `)) as FoodLocationRow[];
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
    if (dto.description !== undefined) map.description = dto.description;
    if (dto.capacity !== undefined) map.capacity = dto.capacity;
    if (dto.clientTypes !== undefined) map.client_types = dto.clientTypes;

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
