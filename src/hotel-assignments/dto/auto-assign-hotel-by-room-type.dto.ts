import {
  IsBoolean,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AutoAssignHotelByRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  hotelId: string;

  @IsString()
  @IsNotEmpty()
  roomType: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  assignmentsCount?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantIds?: string[];

  @IsBoolean()
  @IsOptional()
  keepCountryTogether?: boolean;

  @IsBoolean()
  @IsOptional()
  keepDisciplineTogether?: boolean;

  @IsBoolean()
  @IsOptional()
  avoidMixedGender?: boolean;

  @IsBoolean()
  @IsOptional()
  avoidMinorAdultMix?: boolean;
}
