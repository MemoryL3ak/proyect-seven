import { PartialType } from '@nestjs/mapped-types';
import { CreateAccreditationDto } from './create-accreditation.dto';

export class UpdateAccreditationDto extends PartialType(CreateAccreditationDto) {}
