import { IsIn, IsOptional, IsString, IsArray } from 'class-validator';

export class ListNotificationsDto {
  @IsString()
  @IsIn(['athlete', 'driver', 'admin', 'provider_participant'])
  userKind: string;

  @IsString()
  userId: string;
}

export class MarkReadDto {
  @IsString()
  @IsIn(['athlete', 'driver', 'admin', 'provider_participant'])
  userKind: string;

  @IsString()
  userId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];
}

export class ClearNotificationsDto {
  @IsString()
  @IsIn(['athlete', 'driver', 'admin', 'provider_participant'])
  userKind: string;

  @IsString()
  userId: string;
}
