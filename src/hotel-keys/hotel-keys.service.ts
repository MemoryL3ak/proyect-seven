import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateHotelKeyDto } from './dto/create-hotel-key.dto';
import { IssueHotelKeyDto } from './dto/issue-hotel-key.dto';
import { ReturnHotelKeyDto } from './dto/return-hotel-key.dto';
import { UpdateHotelKeyDto } from './dto/update-hotel-key.dto';
import { UpdateHotelKeyStatusDto } from './dto/update-hotel-key-status.dto';
import { HotelKeyMovement } from './entities/hotel-key-movement.entity';
import { HotelKey } from './entities/hotel-key.entity';

type HotelKeyRow = {
  id: string;
  hotel_id: string;
  room_id: string;
  bed_id: string | null;
  key_number: string;
  copy_number: number;
  label: string | null;
  status: string;
  holder_name: string | null;
  holder_type: string | null;
  holder_participant_id: string | null;
  issued_at: string | null;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type HotelKeyMovementRow = {
  id: string;
  key_id: string;
  action: string;
  holder_name: string | null;
  holder_type: string | null;
  holder_participant_id: string | null;
  actor_name: string | null;
  notes: string | null;
  happened_at: string;
  created_at: string;
};

@Injectable()
export class HotelKeysService {
  constructor(private readonly dataSource: DataSource) {}

  private toKeyRow(dto: CreateHotelKeyDto | UpdateHotelKeyDto) {
    const row: Record<string, unknown> = {};
    if (dto.hotelId !== undefined) row.hotel_id = dto.hotelId;
    if (dto.roomId !== undefined) row.room_id = dto.roomId;
    if (dto.bedId !== undefined) row.bed_id = dto.bedId ?? null;
    if (dto.keyNumber !== undefined) row.key_number = dto.keyNumber;
    if (dto.copyNumber !== undefined) row.copy_number = dto.copyNumber;
    if (dto.label !== undefined) row.label = dto.label ?? null;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.notes !== undefined) row.notes = dto.notes ?? null;
    return row;
  }

  private toKeyEntity(row: HotelKeyRow): HotelKey {
    return {
      id: row.id,
      hotelId: row.hotel_id,
      roomId: row.room_id,
      bedId: row.bed_id,
      keyNumber: row.key_number,
      copyNumber: row.copy_number,
      label: row.label,
      status: row.status,
      holderName: row.holder_name,
      holderType: row.holder_type,
      holderParticipantId: row.holder_participant_id,
      issuedAt: row.issued_at ? new Date(row.issued_at) : null,
      returnedAt: row.returned_at ? new Date(row.returned_at) : null,
      notes: row.notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private toMovementEntity(row: HotelKeyMovementRow): HotelKeyMovement {
    return {
      id: row.id,
      keyId: row.key_id,
      action: row.action,
      holderName: row.holder_name,
      holderType: row.holder_type,
      holderParticipantId: row.holder_participant_id,
      actorName: row.actor_name,
      notes: row.notes,
      happenedAt: new Date(row.happened_at),
      createdAt: new Date(row.created_at),
    };
  }

  private async findKeyRowOrFail(id: string) {
    try {
      const rows = (await this.dataSource.query(
        `
          select *
          from logistics.hotel_keys
          where id = $1
          limit 1
        `,
        [id],
      )) as HotelKeyRow[];
      const data = rows[0];
      if (!data) {
        throw new NotFoundException(`Hotel key with id ${id} not found`);
      }
      return data;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel key',
      );
    }
  }

  private buildUpdateSql(
    row: Record<string, unknown>,
    id: string,
  ): { sql: string; params: unknown[] } {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      throw new NotFoundException(`Hotel key with id ${id} not found`);
    }
    const sets = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
    const params = entries.map(([, value]) => value);
    return {
      sql: `
        update logistics.hotel_keys
        set ${sets}, updated_at = now()
        where id = $${entries.length + 1}
        returning *
      `,
      params: [...params, id],
    };
  }

  private async createMovement(params: {
    keyId: string;
    action: string;
    holderName?: string | null;
    holderType?: string | null;
    holderParticipantId?: string | null;
    actorName?: string | null;
    notes?: string | null;
    happenedAt?: string | null;
  }) {
    try {
      await this.dataSource.query(
        `
          insert into logistics.hotel_key_movements (
            key_id,
            action,
            holder_name,
            holder_type,
            holder_participant_id,
            actor_name,
            notes,
            happened_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          params.keyId,
          params.action,
          params.holderName ?? null,
          params.holderType ?? null,
          params.holderParticipantId ?? null,
          params.actorName ?? null,
          params.notes ?? null,
          params.happenedAt ?? new Date().toISOString(),
        ],
      );
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error creating hotel key movement',
      );
    }
  }

  async create(dto: CreateHotelKeyDto) {
    const payload = this.toKeyRow(dto);
    if (payload.copy_number === undefined) payload.copy_number = 1;
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    let data: HotelKeyRow | null = null;
    try {
      const rows = (await this.dataSource.query(
        `
          insert into logistics.hotel_keys (${columns.join(', ')})
          values (${placeholders})
          returning *
        `,
        values,
      )) as HotelKeyRow[];
      data = rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error creating hotel key',
      );
    }
    if (!data) throw new InternalServerErrorException('Error creating hotel key');

    await this.createMovement({
      keyId: data.id,
      action: 'CREATED',
      notes: dto.notes ?? 'Alta de llave',
    });

    return this.toKeyEntity(data);
  }

  async findAll() {
    try {
      const rows = (await this.dataSource.query(`
        select *
        from logistics.hotel_keys
        order by created_at desc
      `)) as HotelKeyRow[];
      return rows.map((row) => this.toKeyEntity(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error fetching hotel keys',
      );
    }
  }

  async findOne(id: string) {
    const row = await this.findKeyRowOrFail(id);
    return this.toKeyEntity(row);
  }

  async findMovements(keyId?: string) {
    try {
      const params: unknown[] = [];
      let query = `
        select *
        from logistics.hotel_key_movements
      `;
      if (keyId) {
        params.push(keyId);
        query += ` where key_id = $1`;
      }
      query += ` order by happened_at desc, created_at desc`;

      const rows = (await this.dataSource.query(
        query,
        params,
      )) as HotelKeyMovementRow[];
      return rows.map((row) => this.toMovementEntity(row));
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error fetching hotel key movements',
      );
    }
  }

  async update(id: string, dto: UpdateHotelKeyDto) {
    await this.findKeyRowOrFail(id);
    const row = this.toKeyRow(dto);
    const { sql, params } = this.buildUpdateSql(row, id);
    let data: HotelKeyRow | null = null;
    try {
      const rows = (await this.dataSource.query(sql, params)) as HotelKeyRow[];
      data = rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error updating hotel key',
      );
    }
    if (!data) throw new NotFoundException(`Hotel key with id ${id} not found`);

    await this.createMovement({
      keyId: id,
      action: 'UPDATED',
      notes: 'Actualización de llave',
    });

    return this.toKeyEntity(data);
  }

  async issue(id: string, dto: IssueHotelKeyDto) {
    const existing = await this.findKeyRowOrFail(id);

    if (existing.status === 'ASSIGNED') {
      throw new BadRequestException('La llave ya está entregada');
    }

    const issuedAt = dto.issuedAt ?? new Date().toISOString();
    let data: HotelKeyRow | null = null;
    try {
      const rows = (await this.dataSource.query(
        `
          update logistics.hotel_keys
          set
            status = 'ASSIGNED',
            holder_name = $1,
            holder_type = $2,
            holder_participant_id = $3,
            issued_at = $4,
            returned_at = null,
            updated_at = now()
          where id = $5
          returning *
        `,
        [
          dto.holderName,
          dto.holderType ?? null,
          dto.holderParticipantId ?? null,
          issuedAt,
          id,
        ],
      )) as HotelKeyRow[];
      data = rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error issuing hotel key',
      );
    }
    if (!data) throw new NotFoundException(`Hotel key with id ${id} not found`);

    await this.createMovement({
      keyId: id,
      action: 'ISSUED',
      holderName: dto.holderName,
      holderType: dto.holderType ?? null,
      holderParticipantId: dto.holderParticipantId ?? null,
      actorName: dto.actorName ?? null,
      notes: dto.notes ?? null,
      happenedAt: issuedAt,
    });

    return this.toKeyEntity(data);
  }

  async returnKey(id: string, dto: ReturnHotelKeyDto) {
    const existing = await this.findKeyRowOrFail(id);

    if (existing.status !== 'ASSIGNED') {
      throw new BadRequestException('Solo se puede devolver una llave entregada');
    }

    const returnedAt = dto.returnedAt ?? new Date().toISOString();
    let data: HotelKeyRow | null = null;
    try {
      const rows = (await this.dataSource.query(
        `
          update logistics.hotel_keys
          set
            status = 'AVAILABLE',
            holder_name = null,
            holder_type = null,
            holder_participant_id = null,
            returned_at = $1,
            updated_at = now()
          where id = $2
          returning *
        `,
        [returnedAt, id],
      )) as HotelKeyRow[];
      data = rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error returning hotel key',
      );
    }
    if (!data) throw new NotFoundException(`Hotel key with id ${id} not found`);

    await this.createMovement({
      keyId: id,
      action: 'RETURNED',
      actorName: dto.actorName ?? null,
      notes: dto.notes ?? null,
      happenedAt: returnedAt,
    });

    return this.toKeyEntity(data);
  }

  async updateStatus(id: string, dto: UpdateHotelKeyStatusDto) {
    const existing = await this.findKeyRowOrFail(id);
    const nextStatus = dto.status.trim().toUpperCase();

    if (!nextStatus) {
      throw new BadRequestException('Debe indicar un estado válido');
    }

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
    };

    if (nextStatus !== 'ASSIGNED') {
      updatePayload.holder_name = null;
      updatePayload.holder_type = null;
      updatePayload.holder_participant_id = null;
    }

    if (nextStatus === 'AVAILABLE') {
      updatePayload.returned_at = new Date().toISOString();
    } else if (existing.status !== 'ASSIGNED') {
      updatePayload.returned_at = null;
    }

    const { sql, params } = this.buildUpdateSql(updatePayload, id);
    let data: HotelKeyRow | null = null;
    try {
      const rows = (await this.dataSource.query(sql, params)) as HotelKeyRow[];
      data = rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Error updating hotel key status',
      );
    }
    if (!data) throw new NotFoundException(`Hotel key with id ${id} not found`);

    await this.createMovement({
      keyId: id,
      action: 'STATUS_CHANGED',
      actorName: dto.actorName ?? null,
      notes: dto.notes
        ? `Estado ${existing.status} -> ${nextStatus}. ${dto.notes}`
        : `Estado ${existing.status} -> ${nextStatus}`,
    });

    return this.toKeyEntity(data);
  }

  async remove(id: string) {
    let data: HotelKeyRow | null = null;
    try {
      const rows = (await this.dataSource.query(
        `
          delete from logistics.hotel_keys
          where id = $1
          returning *
        `,
        [id],
      )) as HotelKeyRow[];
      data = rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Error deleting hotel key',
      );
    }
    if (!data) throw new NotFoundException(`Hotel key with id ${id} not found`);
    return this.toKeyEntity(data);
  }
}
