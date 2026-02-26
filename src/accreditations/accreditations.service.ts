import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateAccreditationDto } from './dto/create-accreditation.dto';
import { IssueCredentialDto } from './dto/issue-credential.dto';
import { QueryAccreditationsDto } from './dto/query-accreditations.dto';
import { RejectAccreditationDto } from './dto/reject-accreditation.dto';
import { ReviewAccreditationDto } from './dto/review-accreditation.dto';
import { UpdateAccreditationDto } from './dto/update-accreditation.dto';
import { Accreditation } from './entities/accreditation.entity';

type AccreditationRow = {
  id: string;
  event_id: string;
  athlete_id: string | null;
  driver_id: string | null;
  subject_type: 'PARTICIPANT' | 'DRIVER';
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CREDENTIAL_ISSUED';
  validation_notes: string | null;
  validated_by: string | null;
  validated_at: string | null;
  credential_code: string | null;
  credential_issued_at: string | null;
  credential_issued_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AccreditationsService {
  constructor(
    @Inject('SUPABASE_CLIENT') private readonly supabase: SupabaseClient,
  ) {}

  private validateSubjectReferences(
    subjectType: 'PARTICIPANT' | 'DRIVER',
    athleteId?: string | null,
    driverId?: string | null,
  ) {
    const hasAthlete = Boolean(athleteId);
    const hasDriver = Boolean(driverId);

    if (subjectType === 'PARTICIPANT' && (!hasAthlete || hasDriver)) {
      throw new BadRequestException(
        'For PARTICIPANT, athleteId is required and driverId must be empty',
      );
    }

    if (subjectType === 'DRIVER' && (!hasDriver || hasAthlete)) {
      throw new BadRequestException(
        'For DRIVER, driverId is required and athleteId must be empty',
      );
    }
  }

  private toRow(dto: CreateAccreditationDto | UpdateAccreditationDto) {
    const row: Record<string, unknown> = {};

    if (dto.eventId !== undefined) row.event_id = dto.eventId;
    if (dto.athleteId !== undefined) row.athlete_id = dto.athleteId ?? null;
    if (dto.driverId !== undefined) row.driver_id = dto.driverId ?? null;
    if (dto.subjectType !== undefined) row.subject_type = dto.subjectType;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.validationNotes !== undefined) {
      row.validation_notes = dto.validationNotes ?? null;
    }
    if (dto.validatedBy !== undefined) row.validated_by = dto.validatedBy ?? null;
    if (dto.validatedAt !== undefined) row.validated_at = dto.validatedAt ?? null;
    if (dto.credentialCode !== undefined) {
      row.credential_code = dto.credentialCode ?? null;
    }
    if (dto.credentialIssuedAt !== undefined) {
      row.credential_issued_at = dto.credentialIssuedAt ?? null;
    }
    if (dto.credentialIssuedBy !== undefined) {
      row.credential_issued_by = dto.credentialIssuedBy ?? null;
    }
    if (dto.metadata !== undefined) row.metadata = dto.metadata ?? {};

    return row;
  }

  private toEntity(row: AccreditationRow): Accreditation {
    return {
      id: row.id,
      eventId: row.event_id,
      athleteId: row.athlete_id,
      driverId: row.driver_id,
      subjectType: row.subject_type,
      status: row.status,
      validationNotes: row.validation_notes,
      validatedBy: row.validated_by,
      validatedAt: row.validated_at ? new Date(row.validated_at) : null,
      credentialCode: row.credential_code,
      credentialIssuedAt: row.credential_issued_at
        ? new Date(row.credential_issued_at)
        : null,
      credentialIssuedBy: row.credential_issued_by,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async syncSubjectSnapshot(accreditation: Accreditation) {
    const payload = {
      accreditation_status: accreditation.status,
      accreditation_validated_at: accreditation.validatedAt?.toISOString() ?? null,
      accreditation_validated_by: accreditation.validatedBy ?? null,
      accreditation_notes: accreditation.validationNotes ?? null,
      credential_code: accreditation.credentialCode ?? null,
      credential_issued_at: accreditation.credentialIssuedAt?.toISOString() ?? null,
      credential_issued_by: accreditation.credentialIssuedBy ?? null,
    };

    if (accreditation.subjectType === 'PARTICIPANT' && accreditation.athleteId) {
      const { error } = await this.supabase
        .schema('core')
        .from('athletes')
        .update(payload)
        .eq('id', accreditation.athleteId);

      if (error) {
        throw new InternalServerErrorException(
          error.message || 'Error syncing athlete accreditation',
        );
      }
      return;
    }

    if (accreditation.subjectType === 'DRIVER' && accreditation.driverId) {
      const { error } = await this.supabase
        .schema('transport')
        .from('drivers')
        .update(payload)
        .eq('id', accreditation.driverId);

      if (error) {
        throw new InternalServerErrorException(
          error.message || 'Error syncing driver accreditation',
        );
      }
    }
  }

  private async updateAndSync(
    id: string,
    payload: Record<string, unknown>,
    errorMessage: string,
  ) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('accreditations')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message || errorMessage);
    }
    if (!data) {
      throw new NotFoundException(`Accreditation with id ${id} not found`);
    }

    const entity = this.toEntity(data as AccreditationRow);
    await this.syncSubjectSnapshot(entity);
    return entity;
  }

  async create(dto: CreateAccreditationDto) {
    this.validateSubjectReferences(dto.subjectType, dto.athleteId, dto.driverId);

    const { data, error } = await this.supabase
      .schema('core')
      .from('accreditations')
      .insert(this.toRow(dto))
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Error creating accreditation',
      );
    }

    const entity = this.toEntity(data as AccreditationRow);
    await this.syncSubjectSnapshot(entity);
    return entity;
  }

  async findAll(filters: QueryAccreditationsDto) {
    let query = this.supabase.schema('core').from('accreditations').select('*');

    if (filters.eventId) query = query.eq('event_id', filters.eventId);
    if (filters.subjectType) query = query.eq('subject_type', filters.subjectType);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.athleteId) query = query.eq('athlete_id', filters.athleteId);
    if (filters.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters.credentialCode) {
      query = query.eq('credential_code', filters.credentialCode);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching accreditations',
      );
    }

    return (data ?? []).map((row) => this.toEntity(row as AccreditationRow));
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('accreditations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error fetching accreditation',
      );
    }

    if (!data) {
      throw new NotFoundException(`Accreditation with id ${id} not found`);
    }

    return this.toEntity(data as AccreditationRow);
  }

  async update(id: string, dto: UpdateAccreditationDto) {
    const current = await this.findOne(id);
    const mergedSubjectType = dto.subjectType ?? current.subjectType;
    const mergedAthleteId =
      dto.athleteId !== undefined ? dto.athleteId : current.athleteId;
    const mergedDriverId =
      dto.driverId !== undefined ? dto.driverId : current.driverId;

    this.validateSubjectReferences(
      mergedSubjectType,
      mergedAthleteId,
      mergedDriverId,
    );

    return this.updateAndSync(id, this.toRow(dto), 'Error updating accreditation');
  }

  async remove(id: string) {
    const { data, error } = await this.supabase
      .schema('core')
      .from('accreditations')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error deleting accreditation',
      );
    }
    if (!data) {
      throw new NotFoundException(`Accreditation with id ${id} not found`);
    }

    const deleted = this.toEntity(data as AccreditationRow);
    const resetPayload = {
      accreditation_status: 'PENDING',
      accreditation_validated_at: null,
      accreditation_validated_by: null,
      accreditation_notes: null,
      credential_code: null,
      credential_issued_at: null,
      credential_issued_by: null,
    };

    if (deleted.subjectType === 'PARTICIPANT' && deleted.athleteId) {
      await this.supabase
        .schema('core')
        .from('athletes')
        .update(resetPayload)
        .eq('id', deleted.athleteId);
    } else if (deleted.subjectType === 'DRIVER' && deleted.driverId) {
      await this.supabase
        .schema('transport')
        .from('drivers')
        .update(resetPayload)
        .eq('id', deleted.driverId);
    }

    return deleted;
  }

  async setInReview(id: string, dto: ReviewAccreditationDto) {
    const payload = {
      status: 'IN_REVIEW',
      validation_notes: dto.validationNotes ?? null,
      validated_by: dto.validatedBy ?? null,
      validated_at: dto.validatedAt ?? new Date().toISOString(),
    };
    return this.updateAndSync(id, payload, 'Error setting accreditation in review');
  }

  async approve(id: string, dto: ReviewAccreditationDto) {
    const payload = {
      status: 'APPROVED',
      validation_notes: dto.validationNotes ?? null,
      validated_by: dto.validatedBy ?? null,
      validated_at: dto.validatedAt ?? new Date().toISOString(),
    };
    return this.updateAndSync(id, payload, 'Error approving accreditation');
  }

  async reject(id: string, dto: RejectAccreditationDto) {
    const payload = {
      status: 'REJECTED',
      validation_notes: dto.validationNotes,
      validated_by: dto.validatedBy ?? null,
      validated_at: dto.validatedAt ?? new Date().toISOString(),
      credential_code: null,
      credential_issued_at: null,
      credential_issued_by: null,
    };
    return this.updateAndSync(id, payload, 'Error rejecting accreditation');
  }

  async issueCredential(id: string, dto: IssueCredentialDto) {
    const current = await this.findOne(id);
    if (current.status !== 'APPROVED' && current.status !== 'CREDENTIAL_ISSUED') {
      throw new BadRequestException(
        'Credential can only be issued when accreditation is APPROVED',
      );
    }

    const payload = {
      status: 'CREDENTIAL_ISSUED',
      credential_code: dto.credentialCode,
      credential_issued_by: dto.credentialIssuedBy ?? null,
      credential_issued_at: dto.credentialIssuedAt ?? new Date().toISOString(),
    };
    return this.updateAndSync(id, payload, 'Error issuing credential');
  }
}
