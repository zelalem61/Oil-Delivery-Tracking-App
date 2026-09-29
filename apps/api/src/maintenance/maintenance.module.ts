import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, PrismaService, RolesGuard],
})
export class MaintenanceModule {}
