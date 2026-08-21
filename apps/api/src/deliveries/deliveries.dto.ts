import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
export class CreateDeliveryDto { @ApiProperty() @IsString() @IsNotEmpty() origin!:string; @ApiProperty() @IsString() @IsNotEmpty() destination!:string; @ApiProperty() @IsString() @IsNotEmpty() fuelProduct!:string; @ApiProperty() @IsNumber() @IsPositive() quantityLiters!:number; }
export const driverStatuses=['DISPATCHED','IN_TRANSIT','ARRIVED','UNLOADING','AWAITING_DELIVERY_APPROVAL'] as const;
export class UpdateDeliveryStatusDto { @ApiProperty({enum:driverStatuses}) @IsIn(driverStatuses) status!:(typeof driverStatuses)[number]; }
export class CreateDeliveryLocationDto {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90) latitude!:number;
  @ApiProperty() @IsNumber() @Min(-180) @Max(180) longitude!:number;
  @ApiProperty({required:false}) @IsOptional() @IsNumber() accuracy?:number;
  @ApiProperty({required:false}) @IsOptional() @IsNumber() speed?:number;
  @ApiProperty({required:false}) @IsOptional() @IsNumber() heading?:number;
  @ApiProperty() @IsISO8601() recordedAt!:string;
}
