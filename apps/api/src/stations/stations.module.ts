import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';
import { StaffController } from './staff.controller';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  controllers: [StationsController, StaffController],
  providers: [StationsService, PrismaService, RolesGuard],
})
export class StationsModule {}
