import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type IncidentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateIncidentDto, UpdateIncidentDto } from './incidents.dto';

const include = {
  delivery: {
    select: {
      id: true,
      deliveryNumber: true,
      origin: true,
      destination: true,
      truckPlate: true,
      status: true,
    },
  },
  reportedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.IncidentInclude;

type IncidentRow = Prisma.IncidentGetPayload<{ include: typeof include }>;

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(deliveryId: string, driverUserId: string, input: CreateIncidentDto) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { driverUserId: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverUserId !== driverUserId)
      throw new ForbiddenException('This delivery is not assigned to this driver');

    // Offline queues may resend the same report; return the existing one instead of duplicating.
    if (input.clientId) {
      const existing = await this.prisma.incident.findUnique({
        where: { clientId: input.clientId },
        include,
      });
      if (existing) {
        if (existing.deliveryId !== deliveryId)
          throw new BadRequestException('Incident id already used for another delivery');
        return { success: true, data: this.map(existing) };
      }
    }

    const reportedAt = input.reportedAt ? new Date(input.reportedAt) : new Date();
    const row = await this.prisma.incident.create({
      data: {
        clientId: input.clientId,
        deliveryId,
        reportedById: driverUserId,
        type: input.type,
        severity: input.severity,
        description: input.description.trim(),
        latitude: input.latitude,
        longitude: input.longitude,
        reportedAt: reportedAt > new Date() ? new Date() : reportedAt,
      },
      include,
    });
    return { success: true, data: this.map(row) };
  }

  async list(user: { sub: string; role: string }, status = 'ACTIVE') {
    const where: Prisma.IncidentWhereInput = {};
    if (status === 'ACTIVE') where.status = { in: ['OPEN', 'ACKNOWLEDGED'] };
    else if (status !== 'ALL') where.status = status as IncidentStatus;
    if (user.role !== 'ADMIN') where.reportedById = user.sub;
    const rows = await this.prisma.incident.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
    return { success: true, data: rows.map((row) => this.map(row)) };
  }

  async update(id: string, adminId: string, input: UpdateIncidentDto) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');
    if (incident.status === 'RESOLVED')
      throw new BadRequestException('Incident is already resolved');
    if (input.status === 'ACKNOWLEDGED' && incident.status !== 'OPEN')
      throw new BadRequestException('Only open incidents can be acknowledged');
    const now = new Date();
    const row = await this.prisma.incident.update({
      where: { id },
      data:
        input.status === 'ACKNOWLEDGED'
          ? { status: 'ACKNOWLEDGED', acknowledgedAt: now }
          : {
              status: 'RESOLVED',
              acknowledgedAt: incident.acknowledgedAt ?? now,
              resolvedAt: now,
              resolvedById: adminId,
              resolutionNote: input.note?.trim() || null,
            },
      include,
    });
    return { success: true, data: this.map(row) };
  }

  private map(row: IncidentRow) {
    return {
      ...row,
      latitude: row.latitude == null ? null : Number(row.latitude),
      longitude: row.longitude == null ? null : Number(row.longitude),
    };
  }
}
