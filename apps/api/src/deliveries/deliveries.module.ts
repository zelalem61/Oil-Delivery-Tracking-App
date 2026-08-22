import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RolesGuard } from '../auth/roles.guard';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
@Module({
  controllers: [DeliveriesController],
  providers: [DeliveriesService, PrismaService, RolesGuard],
})
export class DeliveriesModule {}
