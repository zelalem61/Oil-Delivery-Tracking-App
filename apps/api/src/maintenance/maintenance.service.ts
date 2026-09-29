import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MaintenanceStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { extname, join, resolve } from 'path';
import { PrismaService } from '../prisma.service';
import { CreateMaintenanceDto, ListMaintenanceQuery, ReviewMaintenanceDto } from './maintenance.dto';

/** Minimal shape of a file received by multer's memory storage. */
export type UploadedFileLike = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const MAX_FILES = 6;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const include = {
  driver: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
  delivery: { select: { id: true, deliveryNumber: true, origin: true, destination: true } },
  attachments: {
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MaintenanceRecordInclude;

type RecordRow = Prisma.MaintenanceRecordGetPayload<{ include: typeof include }>;

const startOfDay = (value: string) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
const endOfDay = (value: string) => {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

@Injectable()
export class MaintenanceService {
  private readonly uploadRoot = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'));

  constructor(private readonly prisma: PrismaService) {}

  async create(driverUserId: string, input: CreateMaintenanceDto, files: UploadedFileLike[] = []) {
    const driver = await this.prisma.driver.findUnique({ where: { userId: driverUserId } });
    if (!driver) throw new ForbiddenException('Only registered drivers can add garage records');

    const startDate = startOfDay(input.startDate);
    const endDate = startOfDay(input.endDate);
    if (endDate < startDate)
      throw new BadRequestException('The end date cannot be before the start date');
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (startDate > tomorrow) throw new BadRequestException('The start date cannot be in the future');
    if (files.length > MAX_FILES)
      throw new BadRequestException(`You can attach at most ${MAX_FILES} files`);

    let deliveryId = input.deliveryId;
    if (deliveryId) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: deliveryId },
        select: { driverUserId: true },
      });
      if (!delivery || delivery.driverUserId !== driverUserId)
        throw new BadRequestException('Linked delivery was not found for this driver');
    } else {
      // Link to the trip the driver was on, if any.
      const active = await this.prisma.delivery.findFirst({
        where: { driverUserId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        select: { id: true },
      });
      deliveryId = active?.id;
    }

    const record = await this.prisma.maintenanceRecord.create({
      data: {
        driverUserId,
        truckPlate: driver.truckPlate,
        deliveryId,
        garageName: input.garageName.trim(),
        garageLocation: input.garageLocation?.trim() || null,
        startDate,
        endDate,
        workDone: input.workDone.trim(),
        costEtb: input.costEtb,
      },
    });

    const written: string[] = [];
    try {
      const attachments = [];
      for (const file of files) {
        const extension = extname(file.originalname).slice(0, 10).toLowerCase();
        const storageKey = join('maintenance', record.id, `${randomUUID()}${extension}`);
        const target = join(this.uploadRoot, storageKey);
        await fs.mkdir(join(this.uploadRoot, 'maintenance', record.id), { recursive: true });
        await fs.writeFile(target, file.buffer);
        written.push(target);
        attachments.push({
          recordId: record.id,
          fileName: file.originalname.slice(0, 200),
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
        });
      }
      if (attachments.length)
        await this.prisma.maintenanceAttachment.createMany({ data: attachments });
    } catch (error) {
      await Promise.all(written.map((path) => fs.rm(path, { force: true })));
      await this.prisma.maintenanceRecord.delete({ where: { id: record.id } });
      throw error;
    }

    return { success: true, data: await this.get(record.id, { sub: driverUserId, role: 'DRIVER' }) };
  }

  async list(user: { sub: string; role: string }, query: ListMaintenanceQuery) {
    const where: Prisma.MaintenanceRecordWhereInput = {};
    if (user.role !== 'ADMIN') where.driverUserId = user.sub;
    else if (query.driverUserId) where.driverUserId = query.driverUserId;
    if (query.status && query.status !== 'ALL') where.status = query.status as MaintenanceStatus;
    if (query.from || query.to) {
      where.startDate = {
        ...(query.from ? { gte: startOfDay(query.from) } : {}),
        ...(query.to ? { lte: endOfDay(query.to) } : {}),
      };
    }
    if (query.minCost !== undefined || query.maxCost !== undefined) {
      where.costEtb = {
        ...(query.minCost !== undefined ? { gte: query.minCost } : {}),
        ...(query.maxCost !== undefined ? { lte: query.maxCost } : {}),
      };
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { garageName: { contains: search, mode: 'insensitive' } },
        { garageLocation: { contains: search, mode: 'insensitive' } },
        { workDone: { contains: search, mode: 'insensitive' } },
        { truckPlate: { contains: search, mode: 'insensitive' } },
        { driver: { firstName: { contains: search, mode: 'insensitive' } } },
        { driver: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const orderBy: Prisma.MaintenanceRecordOrderByWithRelationInput[] =
      query.sort === 'cost_desc'
        ? [{ costEtb: 'desc' }, { startDate: 'desc' }]
        : query.sort === 'cost_asc'
          ? [{ costEtb: 'asc' }, { startDate: 'desc' }]
          : query.sort === 'date_asc'
            ? [{ startDate: 'asc' }, { createdAt: 'asc' }]
            : [{ startDate: 'desc' }, { createdAt: 'desc' }];
    const pageSize = query.pageSize ?? 25;
    const page = query.page ?? 1;

    const [rows, total, aggregate, byStatus] = await this.prisma.$transaction([
      this.prisma.maintenanceRecord.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.maintenanceRecord.count({ where }),
      this.prisma.maintenanceRecord.aggregate({
        where,
        _sum: { costEtb: true },
        _avg: { costEtb: true },
        _max: { costEtb: true },
      }),
      this.prisma.maintenanceRecord.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: { _all: true },
        _sum: { costEtb: true },
      }),
    ]);

    const statusSummary = Object.fromEntries(
      byStatus.map((group) => [
        group.status,
        {
          count: typeof group._count === 'object' ? (group._count._all ?? 0) : 0,
          costEtb: Number(group._sum?.costEtb ?? 0),
        },
      ]),
    );

    return {
      success: true,
      data: {
        items: rows.map((row) => this.map(row)),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        summary: {
          count: total,
          totalCostEtb: Number(aggregate._sum.costEtb ?? 0),
          averageCostEtb: Number(aggregate._avg.costEtb ?? 0),
          maxCostEtb: Number(aggregate._max.costEtb ?? 0),
          byStatus: statusSummary,
        },
      },
    };
  }

  async get(id: string, user: { sub: string; role: string }) {
    const row = await this.prisma.maintenanceRecord.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundException('Garage record not found');
    if (user.role !== 'ADMIN' && row.driverUserId !== user.sub)
      throw new ForbiddenException('You cannot view this record');
    return this.map(row);
  }

  async review(id: string, adminId: string, input: ReviewMaintenanceDto) {
    const row = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Garage record not found');
    if (input.status === 'REJECTED' && !input.note?.trim())
      throw new BadRequestException('Add a note explaining why the record is rejected');
    await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        status: input.status,
        reviewNote: input.note?.trim() || null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    return { success: true, data: await this.get(id, { sub: adminId, role: 'ADMIN' }) };
  }

  async attachment(attachmentId: string, user: { sub: string; role: string }) {
    const attachment = await this.prisma.maintenanceAttachment.findUnique({
      where: { id: attachmentId },
      include: { record: { select: { driverUserId: true } } },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (user.role !== 'ADMIN' && attachment.record.driverUserId !== user.sub)
      throw new ForbiddenException('You cannot open this attachment');
    const path = resolve(this.uploadRoot, attachment.storageKey);
    if (!path.startsWith(this.uploadRoot)) throw new ForbiddenException('Invalid attachment path');
    try {
      await fs.access(path);
    } catch {
      throw new NotFoundException('The attachment file is missing on the server');
    }
    return {
      stream: createReadStream(path),
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  private map(row: RecordRow) {
    const days =
      Math.round((row.endDate.getTime() - row.startDate.getTime()) / 86_400_000) + 1;
    return { ...row, costEtb: Number(row.costEtb), daysInGarage: days };
  }
}
