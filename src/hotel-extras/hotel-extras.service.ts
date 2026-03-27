import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateHotelExtraDto } from './dto/create-hotel-extra.dto';
import { UpdateHotelExtraDto } from './dto/update-hotel-extra.dto';
import { HotelExtra } from './entities/hotel-extra.entity';

type HotelExtraRow = {
  id: string;
  hotel_id: string;
  name: string;
  price: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class HotelExtrasService {
  constructor(private readonly dataSource: DataSource) {}

  private toEntity(row: HotelExtraRow): HotelExtra {
    return {
      id: row.id,
      hotelId: row.hotel_id,
      name: row.name,
      price: parseFloat(row.price ?? '0'),
      quantity: row.quantity,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async create(dto: CreateHotelExtraDto) {
    try {
      const rows = (await this.dataSource.query(
        `
        insert into logistics.hotel_extras (hotel_id, name, price, quantity)
        values ($1, $2, $3, $4)
        returning *
        `,
        [dto.hotelId, dto.name, dto.price ?? 0, dto.quantity ?? 0],
      )) as HotelExtraRow[];
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating hotel extra',
      );
    }
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(`
        select * from logistics.hotel_extras order by created_at desc
      `)) as HotelExtraRow[];
      return rows.map((r) => this.toEntity(r));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel extras',
      );
    }
  }

  async findOne(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `select * from logistics.hotel_extras where id = $1 limit 1`,
        [id],
      )) as HotelExtraRow[];
      if (!rows[0]) throw new NotFoundException(`Hotel extra ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel extra',
      );
    }
  }

  async update(id: string, dto: UpdateHotelExtraDto) {
    const map: Record<string, unknown> = {};
    if (dto.hotelId !== undefined) map.hotel_id = dto.hotelId;
    if (dto.name !== undefined) map.name = dto.name;
    if (dto.price !== undefined) map.price = dto.price;
    if (dto.quantity !== undefined) map.quantity = dto.quantity;
    const keys = Object.keys(map);
    if (keys.length === 0) return this.findOne(id);

    const setSql = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map((k) => map[k]);

    try {
      const rows = (await this.dataSource.query(
        `update logistics.hotel_extras set ${setSql}, updated_at = now() where id = $1 returning *`,
        [id, ...values],
      )) as HotelExtraRow[];
      if (!rows[0]) throw new NotFoundException(`Hotel extra ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating hotel extra',
      );
    }
  }

  async remove(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `delete from logistics.hotel_extras where id = $1 returning *`,
        [id],
      )) as HotelExtraRow[];
      if (!rows[0]) throw new NotFoundException(`Hotel extra ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting hotel extra',
      );
    }
  }
}
