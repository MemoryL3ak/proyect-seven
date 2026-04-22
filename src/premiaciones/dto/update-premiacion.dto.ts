import { PartialType } from '@nestjs/mapped-types';
import { CreatePremiacionDto } from './create-premiacion.dto';

export class UpdatePremiacionDto extends PartialType(CreatePremiacionDto) {}
