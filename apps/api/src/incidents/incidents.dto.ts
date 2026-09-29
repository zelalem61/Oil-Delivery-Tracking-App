import { ApiProperty } from '@nestjs/swagger';
import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty({ enum: IncidentType }) @IsEnum(IncidentType) type!: IncidentType;
  @ApiProperty({ enum: IncidentSeverity }) @IsEnum(IncidentSeverity) severity!: IncidentSeverity;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(2000) description!: string;
  @ApiProperty({ required: false, description: 'Device-generated id so offline retries are not duplicated' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsISO8601() reportedAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export const adminIncidentStatuses = ['ACKNOWLEDGED', 'RESOLVED'] as const;

export class UpdateIncidentDto {
  @ApiProperty({ enum: adminIncidentStatuses })
  @IsIn(adminIncidentStatuses)
  status!: (typeof adminIncidentStatuses)[number];
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ListIncidentsQuery {
  @ApiProperty({ required: false, enum: ['ACTIVE', ...Object.values(IncidentStatus)] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ALL', ...Object.values(IncidentStatus)])
  status?: string;
}
