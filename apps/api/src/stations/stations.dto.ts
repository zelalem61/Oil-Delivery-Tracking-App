import { ApiProperty } from '@nestjs/swagger';
import { FuelProduct } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MAX_LITERS = 100_000_000;

export class StationFuelDto {
  @ApiProperty({ enum: FuelProduct }) @IsEnum(FuelProduct) product!: FuelProduct;
  @ApiProperty({ description: 'Liters in the tank on the opening date' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_LITERS)
  openingStockLiters!: number;
  @ApiProperty({ required: false, example: '2026-10-01', description: 'Defaults to today' })
  @IsOptional()
  @IsISO8601()
  openingDate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(MAX_LITERS)
  capacityLiters?: number;
}

export class CreateStationDto {
  @ApiProperty({ example: 'ADD-01' })
  @IsString()
  @Matches(/^[A-Za-z0-9-]{2,20}$/, { message: 'code must be 2-20 letters, digits or dashes' })
  code!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(160) location?: string;
  @ApiProperty({ type: [StationFuelDto] })
  @ValidateNested({ each: true })
  @Type(() => StationFuelDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  fuels!: StationFuelDto[];
}

export class UpdateStationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(160) location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SalesLineDto {
  @ApiProperty({ enum: FuelProduct }) @IsEnum(FuelProduct) product!: FuelProduct;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(MAX_LITERS) litersSold!: number;
  @ApiProperty({ required: false, description: 'Tank reading at close of day' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_LITERS)
  measuredStockLiters?: number;
}

export class SubmitSalesReportDto {
  @ApiProperty({ type: [SalesLineDto] })
  @ValidateNested({ each: true })
  @Type(() => SalesLineDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  lines!: SalesLineDto[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class HistoryQuery {
  @ApiProperty({ required: false, example: '2026-10-01' }) @IsOptional() @IsISO8601() from?: string;
  @ApiProperty({ required: false, example: '2026-10-31' }) @IsOptional() @IsISO8601() to?: string;
}

export const staffRoles = ['STATION_MANAGER', 'OPERATIONS_MANAGER'] as const;

export class CreateStaffDto {
  @ApiProperty({ enum: staffRoles }) @IsIn(staffRoles) role!: (typeof staffRoles)[number];
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiProperty({ required: false, description: 'Required for station managers' })
  @IsOptional()
  @IsUUID()
  stationId?: string;
}
