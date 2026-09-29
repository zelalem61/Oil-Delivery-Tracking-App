import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Multipart form fields sent with the files (all arrive as strings). */
export class CreateMaintenanceDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) garageName!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(160) garageLocation?: string;
  @ApiProperty({ example: '2026-09-28' }) @IsISO8601() startDate!: string;
  @ApiProperty({ example: '2026-09-30' }) @IsISO8601() endDate!: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(4000) workDone!: string;
  @ApiProperty({ description: 'Total cost in Ethiopian Birr' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000_000)
  costEtb!: number;
  @ApiProperty({ required: false, description: 'Link to the delivery the truck was on' })
  @IsOptional()
  @IsUUID()
  deliveryId?: string;
}

export const reviewStatuses = ['APPROVED', 'REJECTED'] as const;

export class ReviewMaintenanceDto {
  @ApiProperty({ enum: reviewStatuses }) @IsIn(reviewStatuses) status!: (typeof reviewStatuses)[number];
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ListMaintenanceQuery {
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(120) search?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() driverUserId?: string;
  @ApiProperty({ required: false, enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['ALL', 'PENDING', 'APPROVED', 'REJECTED'])
  status?: string;
  @ApiProperty({ required: false, example: '2026-09-01' }) @IsOptional() @IsISO8601() from?: string;
  @ApiProperty({ required: false, example: '2026-09-30' }) @IsOptional() @IsISO8601() to?: string;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minCost?: number;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxCost?: number;
  @ApiProperty({ required: false, enum: ['date_desc', 'date_asc', 'cost_desc', 'cost_asc'] })
  @IsOptional()
  @IsIn(['date_desc', 'date_asc', 'cost_desc', 'cost_asc'])
  sort?: string;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(200) pageSize?: number;
}
