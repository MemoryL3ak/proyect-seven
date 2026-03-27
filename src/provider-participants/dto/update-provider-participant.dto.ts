import { PartialType } from '@nestjs/mapped-types';
import { CreateProviderParticipantDto } from './create-provider-participant.dto';

export class UpdateProviderParticipantDto extends PartialType(
  CreateProviderParticipantDto,
) {}
