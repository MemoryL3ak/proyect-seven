import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CreateMealTimeBlockDto,
  UpdateMealTimeBlockDto,
} from './dto/meal-time-block.dto';

type MealTimeBlockRow = {
  id: string;
  event_id: string;
  meal_type: string;
  /** "YYYY-MM-DD" o null (bloque general), gracias al to_char. */
  date: string | null;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

/**
 * La fecha va convertida a texto en la consulta: leída como Date, el driver
 * la mueve por zona horaria y un bloque del 24 aparecía como del 23. Es el
 * mismo cuidado que ya tiene food-menus.
 */
const COLUMNAS = `id, event_id, meal_type, to_char(date, 'YYYY-MM-DD') as date,
   to_char(starts_at, 'HH24:MI') as starts_at, to_char(ends_at, 'HH24:MI') as ends_at, note`;

@Injectable()
export class MealTimeBlocksService {
  constructor(private readonly dataSource: DataSource) {}

  private toEntity(row: MealTimeBlockRow) {
    return {
      id: row.id,
      eventId: row.event_id,
      mealType: row.meal_type,
      date: row.date,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      note: row.note,
    };
  }

  /**
   * Los bloques de un evento: el general de cada comida y las extensiones por
   * fecha. Salen juntos y no resueltos por día a propósito —son catorce filas
   * para todo el evento— y el portal elige cuál manda para el día que mira,
   * sin volver a preguntar cada vez que se cambia de fecha.
   */
  async findAll(eventId?: string) {
    try {
      const rows = (await this.dataSource.query(
        `select ${COLUMNAS}
           from logistics.meal_time_blocks
          where ($1::uuid is null or event_id = $1)
          order by date nulls first, starts_at`,
        [eventId ?? null],
      )) as MealTimeBlockRow[];
      return rows.map((row) => this.toEntity(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching meal time blocks',
      );
    }
  }

  async create(dto: CreateMealTimeBlockDto) {
    try {
      const rows = (await this.dataSource.query(
        `insert into logistics.meal_time_blocks (event_id, meal_type, date, starts_at, ends_at, note)
         values ($1, $2, $3, $4, $5, $6)
         returning ${COLUMNAS}`,
        [
          dto.eventId,
          String(dto.mealType).toUpperCase(),
          dto.date ?? null,
          dto.startsAt,
          dto.endsAt,
          dto.note ?? null,
        ],
      )) as MealTimeBlockRow[];
      return this.toEntity(rows[0]);
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating meal time block',
      );
    }
  }

  async update(id: string, dto: UpdateMealTimeBlockDto) {
    const set: string[] = [];
    const params: unknown[] = [id];
    const agregar = (columna: string, valor: unknown) => {
      params.push(valor);
      set.push(`${columna} = $${params.length}`);
    };
    if (dto.mealType !== undefined) agregar('meal_type', String(dto.mealType).toUpperCase());
    // La fecha admite null a propósito: es cómo un bloque de un día pasa a
    // ser el general de esa comida.
    if (dto.date !== undefined) agregar('date', dto.date ?? null);
    if (dto.startsAt !== undefined) agregar('starts_at', dto.startsAt);
    if (dto.endsAt !== undefined) agregar('ends_at', dto.endsAt);
    if (dto.note !== undefined) agregar('note', dto.note ?? null);
    if (set.length === 0) {
      const actuales = await this.dataSource.query(
        `select ${COLUMNAS} from logistics.meal_time_blocks where id = $1`,
        [id],
      );
      if (!actuales[0]) throw new NotFoundException(`Meal time block ${id} not found`);
      return this.toEntity(actuales[0] as MealTimeBlockRow);
    }

    try {
      const rows = (await this.dataSource.query(
        `update logistics.meal_time_blocks
            set ${set.join(', ')}, updated_at = now()
          where id = $1
          returning ${COLUMNAS}`,
        params,
      )) as MealTimeBlockRow[];
      if (!rows[0]) throw new NotFoundException(`Meal time block ${id} not found`);
      return this.toEntity(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating meal time block',
      );
    }
  }

  async remove(id: string) {
    const rows = (await this.dataSource.query(
      `delete from logistics.meal_time_blocks where id = $1 returning ${COLUMNAS}`,
      [id],
    )) as MealTimeBlockRow[];
    if (!rows[0]) throw new NotFoundException(`Meal time block ${id} not found`);
    return this.toEntity(rows[0]);
  }
}
