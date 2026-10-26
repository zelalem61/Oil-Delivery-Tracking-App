import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FuelProduct, type StationFuel } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { addDays, businessDay, businessTimeZone, dateKey, dateValue, fuelLabels } from './fuel';
import {
  CreateStationDto,
  HistoryQuery,
  StationFuelDto,
  SubmitSalesReportDto,
  UpdateStationDto,
} from './stations.dto';

export type RequestUser = { sub: string; role: string };

/** Roles that monitor every station. */
const allStationRoles = ['ADMIN', 'OPERATIONS_MANAGER'];
/** Station managers may submit or correct reports this many days back; admins any date. */
export const MANAGER_EDIT_DAYS = 7;
const MAX_HISTORY_DAYS = 366;

const managerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const num = (value: Prisma.Decimal | number | null | undefined) =>
  value == null ? 0 : Number(value);
const round = (value: number) => Math.round(value * 100) / 100;
const daysBetween = (from: string, to: string) =>
  Math.round((dateValue(to).getTime() - dateValue(from).getTime()) / 86_400_000);

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** null = every station; otherwise the one station this user may see. */
  async scope(user: RequestUser): Promise<string | null> {
    if (allStationRoles.includes(user.role)) return null;
    if (user.role === 'STATION_MANAGER') {
      const row = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { stationId: true },
      });
      if (!row?.stationId) throw new ForbiddenException('Your account is not linked to a station');
      return row.stationId;
    }
    throw new ForbiddenException('You do not have access to stations');
  }

  private async assertAccess(user: RequestUser, stationId: string) {
    const scope = await this.scope(user);
    if (scope && scope !== stationId)
      throw new ForbiddenException('You can only access your own station');
  }

  async list(user: RequestUser) {
    const scope = await this.scope(user);
    const stations = await this.prisma.station.findMany({
      where: scope ? { id: scope } : {},
      include: {
        fuels: { orderBy: { product: 'asc' } },
        managers: { select: managerSelect, orderBy: { firstName: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return { success: true, data: await this.withStats(stations) };
  }

  async get(user: RequestUser, id: string) {
    await this.assertAccess(user, id);
    const station = await this.prisma.station.findUnique({
      where: { id },
      include: {
        fuels: { orderBy: { product: 'asc' } },
        managers: { select: managerSelect, orderBy: { firstName: 'asc' } },
      },
    });
    if (!station) throw new NotFoundException('Station not found');
    const [view] = await this.withStats([station]);
    return { success: true, data: view };
  }

  /** Active stations and the fuels they take, for the driver's "create trip" screen. */
  async options() {
    const stations = await this.prisma.station.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        location: true,
        fuels: { select: { product: true }, orderBy: { product: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return {
      success: true,
      data: stations.map(({ fuels, ...station }) => ({
        ...station,
        products: fuels.map(({ product }) => ({ product, label: fuelLabels[product] })),
      })),
    };
  }

  async create(input: CreateStationDto) {
    const products = input.fuels.map((fuel) => fuel.product);
    if (new Set(products).size !== products.length)
      throw new BadRequestException('Each fuel can only be added once');
    const today = businessDay();
    try {
      const station = await this.prisma.station.create({
        data: {
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          location: input.location?.trim() || null,
          fuels: { create: input.fuels.map((fuel) => this.fuelData(fuel, today)) },
        },
      });
      return this.get({ sub: '', role: 'ADMIN' }, station.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('A station with this code or name already exists');
      throw error;
    }
  }

  async update(id: string, input: UpdateStationDto) {
    await this.findStation(id);
    try {
      await this.prisma.station.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          location: input.location === undefined ? undefined : input.location.trim() || null,
          isActive: input.isActive,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('A station with this name already exists');
      throw error;
    }
    return this.get({ sub: '', role: 'ADMIN' }, id);
  }

  /** Adds a fuel, or records a new opening stock (a physical recount) for an existing one. */
  async upsertFuel(id: string, input: StationFuelDto) {
    await this.findStation(id);
    const data = this.fuelData(input, businessDay());
    await this.prisma.stationFuel.upsert({
      where: { stationId_product: { stationId: id, product: input.product } },
      create: { stationId: id, ...data },
      update: data,
    });
    return this.get({ sub: '', role: 'ADMIN' }, id);
  }

  async submitReport(
    user: RequestUser,
    stationId: string,
    date: string,
    input: SubmitSalesReportDto,
  ) {
    await this.assertAccess(user, stationId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(dateValue(date).getTime()))
      throw new BadRequestException('Use a YYYY-MM-DD report date');
    const today = businessDay();
    if (date > today) throw new BadRequestException('You cannot report sales for a future date');
    if (user.role !== 'ADMIN' && date < addDays(today, -MANAGER_EDIT_DAYS))
      throw new ForbiddenException(
        `Reports older than ${MANAGER_EDIT_DAYS} days can only be corrected by an administrator`,
      );

    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
      include: { fuels: true },
    });
    if (!station) throw new NotFoundException('Station not found');
    if (!station.isActive && user.role !== 'ADMIN')
      throw new BadRequestException('This station is inactive');

    const seen = new Set<FuelProduct>();
    for (const line of input.lines) {
      if (seen.has(line.product))
        throw new BadRequestException(`${fuelLabels[line.product]} is listed more than once`);
      seen.add(line.product);
      const fuel = station.fuels.find((row) => row.product === line.product);
      if (!fuel)
        throw new BadRequestException(`${station.name} does not sell ${fuelLabels[line.product]}`);
      if (date < dateKey(fuel.openingDate))
        throw new BadRequestException(
          `${fuelLabels[line.product]} stock starts on ${dateKey(fuel.openingDate)}; pick a later date`,
        );
    }

    const reportDate = dateValue(date);
    const report = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.dailySalesReport.upsert({
        where: { stationId_reportDate: { stationId, reportDate } },
        create: {
          stationId,
          reportDate,
          submittedById: user.sub,
          note: input.note?.trim() || null,
        },
        update: { submittedById: user.sub, note: input.note?.trim() || null },
      });
      await tx.dailySalesLine.deleteMany({ where: { reportId: saved.id } });
      await tx.dailySalesLine.createMany({
        data: input.lines.map((line) => ({
          reportId: saved.id,
          product: line.product,
          litersSold: line.litersSold,
          measuredStockLiters: line.measuredStockLiters ?? null,
        })),
      });
      return saved;
    });
    return { success: true, data: { id: report.id, stationId, date } };
  }

  /**
   * Day-by-day ledger for one station: liters sold, received from approved deliveries,
   * calculated closing stock, the manager's tank reading and the difference between them.
   */
  async history(user: RequestUser, stationId: string, query: HistoryQuery) {
    await this.assertAccess(user, stationId);
    const station = await this.prisma.station.findUnique({
      where: { id: stationId },
      include: { fuels: { orderBy: { product: 'asc' } } },
    });
    if (!station) throw new NotFoundException('Station not found');

    const today = businessDay();
    const to = query.to ? query.to.slice(0, 10) : today;
    const from = query.from ? query.from.slice(0, 10) : addDays(to, -29);
    if (from > to) throw new BadRequestException('"from" must be on or before "to"');
    if (daysBetween(from, to) >= MAX_HISTORY_DAYS)
      throw new BadRequestException(`Pick a range of at most ${MAX_HISTORY_DAYS} days`);

    const fuels = station.fuels;
    const empty = {
      station: { id: station.id, name: station.name },
      from,
      to,
      rows: [],
      totals: [],
    };
    if (!fuels.length)
      return { success: true, data: { ...empty, reportedDays: 0, expectedDays: 0 } };

    const start = fuels.map((fuel) => dateKey(fuel.openingDate)).sort()[0]!;
    const [reports, deliveries] = await Promise.all([
      this.prisma.dailySalesReport.findMany({
        where: { stationId, reportDate: { gte: dateValue(start), lte: dateValue(to) } },
        include: {
          lines: true,
          submittedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.delivery.findMany({
        where: {
          stationFuelId: { in: fuels.map((fuel) => fuel.id) },
          status: 'DELIVERED',
          deliveredAt: { not: null },
        },
        select: {
          id: true,
          deliveryNumber: true,
          quantityLiters: true,
          deliveredAt: true,
          stationFuelId: true,
        },
      }),
    ]);

    const reportByDay = new Map(reports.map((report) => [dateKey(report.reportDate), report]));
    const receivedByDay = new Map<string, Map<string, { liters: number; numbers: string[] }>>();
    for (const delivery of deliveries) {
      const day = businessDay(delivery.deliveredAt!);
      const perFuel = receivedByDay.get(day) ?? new Map();
      const entry = perFuel.get(delivery.stationFuelId!) ?? { liters: 0, numbers: [] };
      entry.liters += num(delivery.quantityLiters);
      entry.numbers.push(delivery.deliveryNumber);
      perFuel.set(delivery.stationFuelId!, entry);
      receivedByDay.set(day, perFuel);
    }

    const balance = new Map(fuels.map((fuel) => [fuel.id, num(fuel.openingStockLiters)]));
    const totals = new Map(fuels.map((fuel) => [fuel.id, { sold: 0, received: 0 }]));
    const rows = [];
    let reportedDays = 0;
    const last = to < today ? to : today;
    for (let day = start; day <= last; day = addDays(day, 1)) {
      const report = reportByDay.get(day);
      const received = receivedByDay.get(day);
      const inRange = day >= from;
      const fuelRows = fuels.map((fuel) => {
        const opening = dateKey(fuel.openingDate);
        const line = report?.lines.find((row) => row.product === fuel.product);
        const receivedLiters = received?.get(fuel.id)?.liters ?? 0;
        if (day < opening)
          return {
            product: fuel.product,
            label: fuelLabels[fuel.product],
            soldLiters: null,
            receivedLiters: 0,
            closingStockLiters: null,
            measuredStockLiters: null,
            varianceLiters: null,
          };
        const sold = num(line?.litersSold);
        const closing = balance.get(fuel.id)! + receivedLiters - sold;
        balance.set(fuel.id, closing);
        if (inRange) {
          const total = totals.get(fuel.id)!;
          total.sold += sold;
          total.received += receivedLiters;
        }
        const measured = line?.measuredStockLiters == null ? null : num(line.measuredStockLiters);
        return {
          product: fuel.product,
          label: fuelLabels[fuel.product],
          soldLiters: line ? round(sold) : null,
          receivedLiters: round(receivedLiters),
          closingStockLiters: round(closing),
          measuredStockLiters: measured,
          varianceLiters: measured == null ? null : round(measured - closing),
        };
      });
      if (!inRange) continue;
      if (report) reportedDays += 1;
      rows.push({
        date: day,
        report: report
          ? {
              id: report.id,
              note: report.note,
              submittedBy: report.submittedBy,
              updatedAt: report.updatedAt,
            }
          : null,
        deliveries: [...(received?.values() ?? [])].flatMap((entry) => entry.numbers),
        fuels: fuelRows,
        totalSoldLiters: round(fuelRows.reduce((sum, row) => sum + (row.soldLiters ?? 0), 0)),
      });
    }

    const expectedDays = rows.length;
    return {
      success: true,
      data: {
        ...empty,
        rows: rows.reverse(),
        reportedDays,
        expectedDays,
        totals: fuels.map((fuel) => {
          const total = totals.get(fuel.id)!;
          return {
            product: fuel.product,
            label: fuelLabels[fuel.product],
            soldLiters: round(total.sold),
            receivedLiters: round(total.received),
            averageDailySoldLiters: reportedDays ? round(total.sold / reportedDays) : 0,
          };
        }),
      },
    };
  }

  private async findStation(id: string) {
    const station = await this.prisma.station.findUnique({ where: { id }, select: { id: true } });
    if (!station) throw new NotFoundException('Station not found');
    return station;
  }

  private fuelData(fuel: StationFuelDto, today: string) {
    const openingDate = fuel.openingDate ? fuel.openingDate.slice(0, 10) : today;
    if (openingDate > today)
      throw new BadRequestException('The opening date cannot be in the future');
    return {
      product: fuel.product,
      openingStockLiters: fuel.openingStockLiters,
      openingDate: dateValue(openingDate),
      capacityLiters: fuel.capacityLiters ?? null,
    };
  }

  /** Adds current stock, today's sales and report status to each station. */
  private async withStats(
    stations: Array<
      Prisma.StationGetPayload<{
        include: { fuels: true; managers: { select: typeof managerSelect } };
      }>
    >,
  ) {
    const fuels = stations.flatMap((station) => station.fuels);
    const fuelIds = fuels.map((fuel) => fuel.id);
    const stationIds = stations.map((station) => station.id);
    const today = businessDay();
    const weekStart = addDays(today, -6);
    if (!stations.length) return [];

    const [sold, deliveries, todayReports, lastReports] = await Promise.all([
      fuelIds.length
        ? this.prisma.$queryRaw<
            Array<{
              fuelId: string;
              total: Prisma.Decimal;
              today: Prisma.Decimal;
              week: Prisma.Decimal;
            }>
          >`
            SELECT f.id AS "fuelId",
              COALESCE(SUM(l."litersSold") FILTER (WHERE r."reportDate" >= f."openingDate"), 0) AS "total",
              COALESCE(SUM(l."litersSold") FILTER (WHERE r."reportDate" = ${today}::date), 0) AS "today",
              COALESCE(SUM(l."litersSold") FILTER (
                WHERE r."reportDate" >= ${weekStart}::date AND r."reportDate" >= f."openingDate"
              ), 0) AS "week"
            FROM "StationFuel" f
            JOIN "DailySalesReport" r ON r."stationId" = f."stationId"
            JOIN "DailySalesLine" l ON l."reportId" = r.id AND l.product = f.product
            WHERE f.id = ANY(${fuelIds}::uuid[])
            GROUP BY f.id`
        : [],
      fuelIds.length
        ? this.prisma.$queryRaw<
            Array<{ fuelId: string; received: Prisma.Decimal; incoming: Prisma.Decimal }>
          >`
            SELECT d."stationFuelId" AS "fuelId",
              COALESCE(SUM(d."quantityLiters") FILTER (
                WHERE d.status = 'DELIVERED'
                  AND (d."deliveredAt" AT TIME ZONE 'UTC' AT TIME ZONE ${businessTimeZone})::date >= f."openingDate"
              ), 0) AS "received",
              COALESCE(SUM(d."quantityLiters") FILTER (
                WHERE d.status NOT IN ('DELIVERED', 'CANCELLED')
              ), 0) AS "incoming"
            FROM "Delivery" d
            JOIN "StationFuel" f ON f.id = d."stationFuelId"
            WHERE d."stationFuelId" = ANY(${fuelIds}::uuid[])
            GROUP BY d."stationFuelId"`
        : [],
      this.prisma.dailySalesReport.findMany({
        where: { stationId: { in: stationIds }, reportDate: dateValue(today) },
        select: {
          id: true,
          stationId: true,
          updatedAt: true,
          submittedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.dailySalesReport.groupBy({
        by: ['stationId'],
        where: { stationId: { in: stationIds } },
        _max: { reportDate: true },
      }),
    ]);

    const soldBy = new Map(sold.map((row) => [row.fuelId, row]));
    const deliveryBy = new Map(deliveries.map((row) => [row.fuelId, row]));
    const fuelView = (fuel: StationFuel) => {
      const opening = dateKey(fuel.openingDate);
      const s = soldBy.get(fuel.id);
      const d = deliveryBy.get(fuel.id);
      const stock = num(fuel.openingStockLiters) + num(d?.received) - num(s?.total);
      // Average over the last 7 days, or fewer if the stock count started more recently.
      const days = Math.max(1, Math.min(7, daysBetween(opening, today) + 1));
      const average = num(s?.week) / days;
      const capacity = fuel.capacityLiters == null ? null : num(fuel.capacityLiters);
      return {
        id: fuel.id,
        product: fuel.product,
        label: fuelLabels[fuel.product],
        openingStockLiters: num(fuel.openingStockLiters),
        openingDate: opening,
        capacityLiters: capacity,
        stockLiters: round(stock),
        receivedLiters: round(num(d?.received)),
        incomingLiters: round(num(d?.incoming)),
        soldTodayLiters: round(num(s?.today)),
        averageDailySoldLiters: round(average),
        daysOfCover: average > 0 ? Math.round((Math.max(stock, 0) / average) * 10) / 10 : null,
        fillPercent: capacity ? Math.round((Math.max(stock, 0) / capacity) * 100) : null,
      };
    };

    return stations.map(({ fuels: stationFuels, ...station }) => {
      const views = stationFuels.map(fuelView);
      const todayReport = todayReports.find((row) => row.stationId === station.id) ?? null;
      const lastReport = lastReports.find((row) => row.stationId === station.id)?._max.reportDate;
      return {
        ...station,
        fuels: views,
        today,
        todayReport: todayReport && {
          id: todayReport.id,
          updatedAt: todayReport.updatedAt,
          submittedBy: todayReport.submittedBy,
        },
        lastReportDate: lastReport ? dateKey(lastReport) : null,
        stockLiters: round(views.reduce((sum, fuel) => sum + fuel.stockLiters, 0)),
        soldTodayLiters: round(views.reduce((sum, fuel) => sum + fuel.soldTodayLiters, 0)),
      };
    });
  }
}
