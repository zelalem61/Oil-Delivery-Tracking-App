import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { CreateDriverDto } from './drivers.dto';
@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}
  async create(input: CreateDriverDto) {
    const email = input.email.trim().toLowerCase();
    const licenseNumber = input.licenseNumber.trim().toUpperCase();
    const [emailOwner, licenseOwner] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.driver.findUnique({ where: { licenseNumber }, select: { id: true } }),
    ]);
    if (emailOwner) throw new ConflictException('A user with this email already exists');
    if (licenseOwner)
      throw new ConflictException(`License number ${licenseNumber} is already in use`);
    try {
      const driver = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.upsert({
          where: { name: 'DRIVER' },
          update: {},
          create: { name: 'DRIVER', permissions: ['delivery:create', 'delivery:update-own'] },
        });
        const user = await tx.user.create({
          data: {
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            email,
            phone: input.phone,
            passwordHash: await argon2.hash(input.password),
            roleId: role.id,
          },
        });
        return tx.driver.create({
          data: {
            userId: user.id,
            driverCode: `SYS-${randomUUID()}`,
            licenseNumber,
            truckPlate: input.truckPlate.trim().toUpperCase(),
            phone: input.phone,
          },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
            },
          },
        });
      });
      return { success: true, data: driver };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const field = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : 'account field';
        throw new ConflictException(`A driver with this ${field} already exists`);
      }
      throw error;
    }
  }
  async list() {
    const rows = await this.prisma.driver.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: rows };
  }
  async directory(search?: string, page?: string) {
    const pageSize = 20;
    const parsedPage = Number.parseInt(page ?? '1', 10);
    const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const query = search?.trim();
    const where: Prisma.DriverWhereInput | undefined = query
      ? {
          OR: [
            { user: { firstName: { contains: query, mode: 'insensitive' } } },
            { user: { lastName: { contains: query, mode: 'insensitive' } } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
            { phone: { contains: query, mode: 'insensitive' } },
            { truckPlate: { contains: query, mode: 'insensitive' } },
            { licenseNumber: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
          },
        },
        orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.driver.count({ where }),
    ]);
    return {
      success: true,
      data: {
        items,
        total,
        page: currentPage,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
