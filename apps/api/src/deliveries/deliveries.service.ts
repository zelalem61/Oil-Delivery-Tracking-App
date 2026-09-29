import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateDeliveryDto, CreateDeliveryLocationDto } from './deliveries.dto';
const driverTransition: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  CREATED: 'DISPATCHED',
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED',
  ARRIVED: 'UNLOADING',
  UNLOADING: 'AWAITING_DELIVERY_APPROVAL',
};
@Injectable()
export class DeliveriesService {
  constructor(private readonly prisma: PrismaService) {}
  async create(driverUserId: string, input: CreateDeliveryDto) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Only registered drivers can create deliveries');
    const active = await this.prisma.delivery.findFirst({
      where: { driverUserId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    });
    if (active) throw new BadRequestException('Driver already has an active delivery');
    const year = new Date().getUTCFullYear();
    const count = await this.prisma.delivery.count({
      where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
    });
    const delivery = await this.prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({
        data: {
          deliveryNumber: `DEL-${year}-${String(count + 1).padStart(6, '0')}`,
          driverUserId,
          origin: input.origin.trim(),
          destination: input.destination.trim(),
          fuelProduct: input.fuelProduct.trim(),
          quantityLiters: input.quantityLiters,
          truckPlate: driver.truckPlate,
        },
      });
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: created.id,
          newStatus: 'CREATED',
          changedById: driverUserId,
          reason: 'Created by driver',
        },
      });
      return created;
    });
    return { success: true, data: this.map(delivery) };
  }
  async list(user: { sub: string; role: string }) {
    const rows = await this.prisma.delivery.findMany({
      where: user.role === 'ADMIN' ? {} : { driverUserId: user.sub },
      include: {
        driver: { select: { firstName: true, lastName: true, email: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        locations: { orderBy: { recordedAt: 'desc' }, take: 1 },
        _count: {
          select: { incidents: { where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: rows.map((row) => this.map(row)) };
  }
  async addLocation(id: string, userId: string, input: CreateDeliveryLocationDto) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      select: { driverUserId: true, status: true },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverUserId !== userId)
      throw new ForbiddenException('This delivery is not assigned to this driver');
    if (['DELIVERED', 'CANCELLED'].includes(delivery.status))
      throw new BadRequestException('Location tracking has ended for this delivery');
    const row = await this.prisma.deliveryLocation.create({
      data: {
        deliveryId: id,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        speed: input.speed,
        heading: input.heading,
        recordedAt: new Date(input.recordedAt),
      },
    });
    return { success: true, data: this.mapLocation(row) };
  }
  async updateByDriver(id: string, userId: string, target: DeliveryStatus) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.driverUserId !== userId)
      throw new ForbiddenException('This delivery is not assigned to this driver');
    if (target === 'DELIVERED')
      throw new ForbiddenException('Only an admin can mark a delivery delivered');
    if (driverTransition[delivery.status] !== target)
      throw new BadRequestException(`Delivery cannot move from ${delivery.status} to ${target}`);
    return this.transition(id, delivery.status, target, userId, 'Updated by driver');
  }
  async approveDelivered(id: string, adminId: string) {
    const delivery = await this.prisma.delivery.findUnique({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== 'AWAITING_DELIVERY_APPROVAL')
      throw new BadRequestException('Delivery must await admin approval');
    return this.transition(
      id,
      delivery.status,
      'DELIVERED',
      adminId,
      'Approved delivered by admin',
    );
  }
  private async transition(
    id: string,
    previous: DeliveryStatus,
    target: DeliveryStatus,
    userId: string,
    reason: string,
  ) {
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id }, data: { status: target } });
      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: id,
          previousStatus: previous,
          newStatus: target,
          changedById: userId,
          reason,
        },
      });
      return updated;
    });
    return { success: true, data: this.map(row) };
  }
  private map(row: {
    quantityLiters: unknown;
    locations?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  }) {
    const { locations, _count, ...delivery } = row;
    return {
      ...delivery,
      openIncidents: (_count as { incidents?: number } | undefined)?.incidents ?? 0,
      quantityLiters: Number(row.quantityLiters),
      latestLocation: locations?.[0] ? this.mapLocation(locations[0]) : null,
    };
  }
  private mapLocation(row: Record<string, unknown>) {
    return { ...row, latitude: Number(row.latitude), longitude: Number(row.longitude) };
  }
}
