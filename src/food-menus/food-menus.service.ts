import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFoodMenuDto } from './dto/create-food-menu.dto';
import { UpdateFoodMenuDto } from './dto/update-food-menu.dto';
import { FoodMenu } from './entities/food-menu.entity';

type FoodMenuRow = {
  id: string;
  date: string;        // always "YYYY-MM-DD" thanks to to_char cast
  meal_type: string;
  title: string;
  description: string | null;
  dietary_type: string | null;
  accommodation_id: string | null;
  created_at: string;
  updated_at: string;
};

// Columns to select — date cast to text to avoid pg Date-object timezone issues
const SELECT_COLS = `id, to_char(date, 'YYYY-MM-DD') as date, meal_type, title, description, dietary_type, accommodation_id, created_at, updated_at`;

@Injectable()
export class FoodMenusService {
  constructor(private readonly dataSource: DataSource) {}

  private toEntity(row: FoodMenuRow): FoodMenu {
    return {
      id: row.id,
      date: row.date, // already "YYYY-MM-DD" from to_char
      mealType: row.meal_type,
      title: row.title,
      description: row.description ?? undefined,
      dietaryType: row.dietary_type ?? undefined,
      accommodationId: row.accommodation_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateFoodMenuDto) {
    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.food_menus (date, meal_type, title, description, dietary_type, accommodation_id)
        values ($1, $2, $3, $4, $5, $6)
        returning ${SELECT_COLS}
        `,
        [
          dto.date,
          dto.mealType,
          dto.title,
          dto.description ?? null,
          dto.dietaryType ?? null,
          dto.accommodationId ?? null,
        ],
      )) as FoodMenuRow[];
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating food menu',
      );
    }
  }

  async findAll(filters: { month?: string; accommodationId?: string }) {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filters.month) {
        params.push(filters.month);
        conditions.push(`to_char(date, 'YYYY-MM') = $${params.length}`);
      }
      if (filters.accommodationId) {
        params.push(filters.accommodationId);
        conditions.push(`accommodation_id = $${params.length}`);
      }

      const where =
        conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';

      const rows = (await this.dataSource.query(
        `select ${SELECT_COLS} from logistics.food_menus ${where} order by date asc, meal_type asc`,
        params,
      )) as FoodMenuRow[];
      return rows.map((r) => this.toEntity(r));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching food menus',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `select ${SELECT_COLS} from logistics.food_menus where id = $1 limit 1`,
        [id],
      )) as FoodMenuRow[];
      if (!rows[0]) throw new NotFoundException(`Food menu ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching food menu',
      );
    }
  }

  async update(id: string, dto: UpdateFoodMenuDto) {
    const map: Record<string, unknown> = {};
    if (dto.date !== undefined) map.date = dto.date;
    if (dto.mealType !== undefined) map.meal_type = dto.mealType;
    if (dto.title !== undefined) map.title = dto.title;
    if (dto.description !== undefined) map.description = dto.description;
    if (dto.dietaryType !== undefined) map.dietary_type = dto.dietaryType;
    if (dto.accommodationId !== undefined)
      map.accommodation_id = dto.accommodationId;

    const keys = Object.keys(map);
    if (keys.length === 0) return this.findOne(id);

    const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map((k) => map[k]);

    try {
      const rows = (await this.dataSource.query(
        `update logistics.food_menus set ${setSql}, updated_at = now() where id = $1 returning ${SELECT_COLS}`,
        [id, ...values],
      )) as FoodMenuRow[];
      if (!rows[0]) throw new NotFoundException(`Food menu ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating food menu',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `delete from logistics.food_menus where id = $1 returning ${SELECT_COLS}`,
        [id],
      )) as FoodMenuRow[];
      if (!rows[0]) throw new NotFoundException(`Food menu ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting food menu',
      );
    }
  }
}
