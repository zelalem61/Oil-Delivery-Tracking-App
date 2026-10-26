import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma.service';
import { CreateStaffDto, staffRoles } from './stations.dto';

const permissions: Record<(typeof staffRoles)[number], string[]> = {
  STATION_MANAGER: ['station:read-own', 'sales:submit-own'],
  OPERATIONS_MANAGER: ['station:read', 'sales:read'],
};

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { name: true } },
  station: { select: { id: true, code: true, name: true } },
} as const;

/** Admin-managed accounts for station managers and operations managers. */
@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const rows = await this.prisma.user.findMany({
      where: { role: { name: { in: [...staffRoles] } } },
      select: staffSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return { success: true, data: rows.map(({ role, ...user }) => ({ ...user, role: role.name })) };
  }

  @Post()
  async create(@Body() input: CreateStaffDto) {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } }))
      throw new ConflictException('A user with this email already exists');
    let stationId: string | null = null;
    if (input.role === 'STATION_MANAGER') {
      if (!input.stationId) throw new BadRequestException('Pick the station this manager runs');
      const station = await this.prisma.station.findUnique({
        where: { id: input.stationId },
        select: { id: true },
      });
      if (!station) throw new BadRequestException('Station not found');
      stationId = station.id;
    }
    const role = await this.prisma.role.upsert({
      where: { name: input.role },
      update: {},
      create: { name: input.role, permissions: permissions[input.role] },
    });
    const { role: savedRole, ...user } = await this.prisma.user.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone?.trim() || null,
        passwordHash: await argon2.hash(input.password),
        roleId: role.id,
        stationId,
      },
      select: staffSelect,
    });
    return { success: true, data: { ...user, role: savedRole.name } };
  }
}
