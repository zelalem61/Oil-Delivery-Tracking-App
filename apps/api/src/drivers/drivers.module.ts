import { Module } from '@nestjs/common'; import { PrismaService } from '../prisma.service'; import { RolesGuard } from '../auth/roles.guard'; import { DriversController } from './drivers.controller'; import { DriversService } from './drivers.service';
@Module({controllers:[DriversController],providers:[DriversService,PrismaService,RolesGuard]}) export class DriversModule {}
