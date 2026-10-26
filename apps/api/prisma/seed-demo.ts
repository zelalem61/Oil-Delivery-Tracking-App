/**
 * Demo data for client presentations: a month of operations on the Djibouti–Ethiopia corridor.
 *
 *   pnpm db:seed:demo                 # local database from .env
 *   pnpm db:seed:demo -- --reset      # remove previous demo data first
 *   DATABASE_URL=<remote> pnpm --filter @fueltrack/api prisma:seed:demo -- --reset --yes
 *
 * Everything it creates is identifiable (users @demo.fueltrack.et, the station codes below), so
 * --reset never touches real records. Run `pnpm db:seed` first so an admin account exists.
 */
import { DeliveryStatus, FuelProduct, IncidentSeverity, IncidentType, Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { addDays, businessDay, dateValue, fuelLabels } from '../src/stations/fuel';

const prisma = new PrismaClient();
const DOMAIN = 'demo.fueltrack.et';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo1234!';
const DAYS = 30;
const args = process.argv.slice(2);

// Deterministic randomness so every run produces the same story.
let seed = 20261026;
function rand() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + (b - a) * rand();
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)]!;
const round10 = (n: number) => Math.round(n / 10) * 10;
const HOUR = 3_600_000;
/** An instant on a business day (East Africa Time, UTC+3) at a fractional local hour. */
const at = (day: string, hour: number) => new Date(dateValue(day).getTime() + (hour - 3) * HOUR);

// ---------------------------------------------------------------- geography
type Point = [number, number];
const corridorToAddis: Point[] = [
  [11.5886, 43.145], // Djibouti port
  [11.33, 42.8], // Grand Bara
  [11.47, 42.1], // Yoboki
  [11.717, 41.841], // Galafi border
  [11.73, 40.98], // Logiya
  [11.42, 40.76], // Mille
  [10.17, 40.65], // Gewane
  [8.98, 40.17], // Awash
  [8.9, 39.92], // Metehara
  [8.54, 39.27], // Adama
  [8.995, 38.787], // Addis Ababa
];
const routes: Record<string, Point[]> = {
  addis: corridorToAddis,
  adama: corridorToAddis.slice(0, 10),
  hawassa: [...corridorToAddis.slice(0, 10), [7.93, 38.72], [7.2, 38.6], [7.05, 38.48]],
  mekelle: [...corridorToAddis.slice(0, 5), [11.79, 41.01], [13.36, 39.76], [13.4967, 39.4753]],
  direDawa: [
    [11.5886, 43.145],
    [11.155, 42.712], // Ali Sabieh
    [11.05, 42.64], // Dewele border
    [10.42, 42.23], // Adigala
    [9.6, 41.86], // Dire Dawa
  ],
  awash: corridorToAddis.slice(0, 8),
};
const km = ([a1, o1]: Point, [a2, o2]: Point) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((a2 - a1) * r) / 2) ** 2 +
    Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};
const routeKm = (route: Point[]) => route.slice(1).reduce((sum, p, i) => sum + km(route[i]!, p), 0);
/** Position a fraction (0–1) of the way along a route, with the heading at that point. */
function along(route: Point[], fraction: number): { point: Point; heading: number } {
  let remaining = routeKm(route) * Math.min(Math.max(fraction, 0), 1);
  for (let i = 1; i < route.length; i++) {
    const [a, b] = [route[i - 1]!, route[i]!];
    const leg = km(a, b);
    const heading = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (remaining <= leg || i === route.length - 1) {
      const t = leg ? Math.min(remaining / leg, 1) : 0;
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        heading: (heading + 360) % 360,
      };
    }
    remaining -= leg;
  }
  return { point: route[route.length - 1]!, heading: 0 };
}

// ---------------------------------------------------------------- cast
const drivers = [
  ['Tesfaye', 'Alemu', 'ET 3-A48213'],
  ['Getachew', 'Mengistu', 'ET 3-A51907'],
  ['Solomon', 'Haile', 'ET 3-B10422'],
  ['Yonas', 'Tadesse', 'ET 3-A77310'],
  ['Biruk', 'Wondimu', 'ET 3-B23658'],
  ['Henok', 'Girma', 'ET 3-A60041'],
  ['Mulugeta', 'Bekele', 'ET 3-B38815'],
  ['Dereje', 'Assefa', 'ET 3-A29574'],
  ['Ermias', 'Tsegaye', 'ET 3-B41206'],
  ['Kalkidan', 'Abera', 'ET 3-A85532'],
  ['Fikru', 'Demissie', 'ET 3-B56780'],
  ['Samuel', 'Worku', 'ET 3-A13369'],
].map(([firstName, lastName, truckPlate], i) => ({
  firstName: firstName!,
  lastName: lastName!,
  truckPlate: truckPlate!,
  email: `${firstName!.toLowerCase()}.${lastName!.toLowerCase()}@${DOMAIN}`,
  phone: `+2519${String(11_204_310 + i * 731_157).slice(0, 8)}`,
  licenseNumber: `DL-AA-${String(204_118 + i * 3_911)}`,
}));

type FuelSpec = { product: FuelProduct; capacity: number; daily: number };
type StationSpec = {
  code: string;
  name: string;
  location: string;
  route: keyof typeof routes;
  manager: [string, string];
  fuels: FuelSpec[];
  /** Runs low near the end of the month so the dashboard has a stock alert. */
  lowStock?: boolean;
  skippedDays?: number[];
  notReportedToday?: boolean;
};
const stations: StationSpec[] = [
  {
    code: 'BOL-01',
    name: 'Bole Road Station',
    location: 'Bole Road, Addis Ababa',
    route: 'addis',
    manager: ['Meron', 'Tadesse'],
    fuels: [
      { product: 'BENZINE', capacity: 45_000, daily: 3_200 },
      { product: 'DIESEL', capacity: 60_000, daily: 4_100 },
    ],
  },
  {
    code: 'AIR-01',
    name: 'Bole Airport Fuel Depot',
    location: 'Bole International Airport, Addis Ababa',
    route: 'addis',
    manager: ['Abel', 'Fikadu'],
    fuels: [
      { product: 'JET_A1', capacity: 150_000, daily: 9_000 },
      { product: 'DIESEL', capacity: 25_000, daily: 900 },
    ],
  },
  {
    code: 'ADM-01',
    name: 'Adama Central',
    location: 'Main Road, Adama',
    route: 'adama',
    manager: ['Hiwot', 'Mekonnen'],
    fuels: [
      { product: 'BENZINE', capacity: 30_000, daily: 2_100 },
      { product: 'DIESEL', capacity: 50_000, daily: 3_300 },
    ],
  },
  {
    code: 'DDK-01',
    name: 'Dire Dawa Kezira',
    location: 'Kezira, Dire Dawa',
    route: 'direDawa',
    manager: ['Yared', 'Ali'],
    fuels: [
      { product: 'BENZINE', capacity: 30_000, daily: 1_700 },
      { product: 'DIESEL', capacity: 40_000, daily: 2_600 },
      { product: 'FUEL_OIL', capacity: 25_000, daily: 1_100 },
    ],
    notReportedToday: true,
  },
  {
    code: 'HWS-01',
    name: 'Hawassa Lakeside',
    location: 'Lakeside Road, Hawassa',
    route: 'hawassa',
    manager: ['Tigist', 'Lemma'],
    fuels: [
      { product: 'BENZINE', capacity: 25_000, daily: 1_500 },
      { product: 'DIESEL', capacity: 35_000, daily: 2_000 },
    ],
    skippedDays: [12, 23],
    notReportedToday: true,
  },
  {
    code: 'MEK-01',
    name: 'Mekelle North',
    location: 'Kedamay Weyane, Mekelle',
    route: 'mekelle',
    manager: ['Haftom', 'Gebremedhin'],
    fuels: [
      { product: 'BENZINE', capacity: 25_000, daily: 1_400 },
      { product: 'DIESEL', capacity: 35_000, daily: 2_300 },
    ],
    lowStock: true,
  },
];
const stationCodes = stations.map((station) => station.code);
const transitHours: Record<string, [number, number]> = {
  addis: [46, 66],
  adama: [40, 56],
  hawassa: [60, 76],
  mekelle: [44, 60],
  direDawa: [26, 36],
  awash: [30, 40],
};
const reportNotes = [
  'Pump 3 under maintenance for two hours',
  'Power cut 14:00–15:30, sales on generator',
  'Busy market day',
  'Tank dip done with the supervisor',
  'Public holiday traffic',
];

// ---------------------------------------------------------------- helpers
function guardTarget() {
  const url = process.env.DATABASE_URL ?? '';
  const host = url.match(/@([^:/?]+)/)?.[1] ?? 'unknown';
  const local = ['localhost', '127.0.0.1', 'postgres'].includes(host);
  console.log(`Target database host: ${host}`);
  if (!local && !args.includes('--yes'))
    throw new Error('Refusing to write to a remote database without --yes');
}

async function removeDemoData() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  const deliveries = await prisma.delivery.findMany({
    where: { driverUserId: { in: userIds } },
    select: { id: true },
  });
  const deliveryIds = deliveries.map((delivery) => delivery.id);
  await prisma.$transaction([
    prisma.incident.deleteMany({ where: { deliveryId: { in: deliveryIds } } }),
    prisma.deliveryStatusHistory.deleteMany({ where: { deliveryId: { in: deliveryIds } } }),
    prisma.maintenanceRecord.deleteMany({ where: { driverUserId: { in: userIds } } }),
    prisma.delivery.deleteMany({ where: { id: { in: deliveryIds } } }),
    prisma.dailySalesReport.deleteMany({ where: { submittedById: { in: userIds } } }),
    prisma.station.deleteMany({ where: { code: { in: stationCodes } } }),
    prisma.driver.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
  console.log(`Removed previous demo data (${userIds.length} users, ${deliveryIds.length} deliveries)`);
}

// ---------------------------------------------------------------- main
async function main() {
  guardTarget();
  const admin = await prisma.user.findFirst({
    where: { role: { name: 'ADMIN' }, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('No admin account found. Run `pnpm db:seed` first.');

  const existing = await prisma.user.count({ where: { email: { endsWith: `@${DOMAIN}` } } });
  if (existing && !args.includes('--reset'))
    throw new Error('Demo data already exists. Re-run with --reset to replace it.');
  if (existing) await removeDemoData();
  const clash = await prisma.station.findFirst({
    where: { OR: [{ code: { in: stationCodes } }, { name: { in: stations.map((s) => s.name) } }] },
  });
  if (clash) throw new Error(`Station ${clash.code} / ${clash.name} already exists and is not demo data`);

  const now = new Date();
  const today = businessDay(now);
  const opening = addDays(today, -DAYS);
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const roles = Object.fromEntries(
    await Promise.all(
      (
        [
          ['DRIVER', ['delivery:create', 'delivery:update-own']],
          ['STATION_MANAGER', ['station:read-own', 'sales:submit-own']],
          ['OPERATIONS_MANAGER', ['station:read', 'sales:read']],
        ] as const
      ).map(async ([name, permissions]) => [
        name,
        (await prisma.role.upsert({ where: { name }, update: {}, create: { name, permissions: [...permissions] } })).id,
      ]),
    ),
  ) as Record<'DRIVER' | 'STATION_MANAGER' | 'OPERATIONS_MANAGER', string>;
  const recentLogin = () => new Date(now.getTime() - between(0.2, 70) * HOUR);

  // ---- stations and fuels
  const stationRows = stations.map((spec) => ({
    spec,
    id: randomUUID(),
    managerId: randomUUID(),
    fuels: spec.fuels.map((fuel) => ({
      ...fuel,
      id: randomUUID(),
      opening: round10(fuel.capacity * between(0.6, 0.75)),
      stock: 0,
    })),
  }));
  await prisma.station.createMany({
    data: stationRows.map(({ id, spec }) => ({
      id,
      code: spec.code,
      name: spec.name,
      location: spec.location,
      createdAt: at(opening, 8),
    })),
  });
  await prisma.stationFuel.createMany({
    data: stationRows.flatMap(({ id, fuels }) =>
      fuels.map((fuel) => ({
        id: fuel.id,
        stationId: id,
        product: fuel.product,
        capacityLiters: fuel.capacity,
        openingStockLiters: fuel.opening,
        openingDate: dateValue(opening),
      })),
    ),
  });

  // ---- staff
  await prisma.user.createMany({
    data: [
      ...stationRows.map(({ id, managerId, spec }) => ({
        id: managerId,
        firstName: spec.manager[0],
        lastName: spec.manager[1],
        email: `${spec.manager[0].toLowerCase()}.${spec.manager[1].toLowerCase()}@${DOMAIN}`,
        phone: `+2519${String(30_100_000 + stationCodes.indexOf(spec.code) * 1_234_567).slice(0, 8)}`,
        passwordHash,
        roleId: roles.STATION_MANAGER,
        stationId: id,
        lastLoginAt: recentLogin(),
      })),
      {
        firstName: 'Selamawit',
        lastName: 'Getachew',
        email: `ops@${DOMAIN}`,
        phone: '+251911458820',
        passwordHash,
        roleId: roles.OPERATIONS_MANAGER,
        lastLoginAt: recentLogin(),
      },
    ],
  });

  // ---- drivers
  const driverRows = drivers.map((driver) => ({ ...driver, id: randomUUID(), availableAt: 0 }));
  await prisma.user.createMany({
    data: driverRows.map((driver) => ({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone,
      passwordHash,
      roleId: roles.DRIVER,
      lastLoginAt: recentLogin(),
      createdAt: at(addDays(opening, -20), 9),
    })),
  });
  await prisma.driver.createMany({
    data: driverRows.map((driver) => ({
      userId: driver.id,
      driverCode: `DEMO-${driver.licenseNumber}`,
      licenseNumber: driver.licenseNumber,
      truckPlate: driver.truckPlate,
      phone: driver.phone,
      createdAt: at(addDays(opening, -20), 9),
    })),
  });

  // ---- simulate a month of sales and replenishment
  type Trip = {
    id: string;
    station?: (typeof stationRows)[number];
    fuel?: (typeof stationRows)[number]['fuels'][number];
    destination: string;
    product: string;
    route: Point[];
    quantity: number;
    createdAt: Date;
    deliveredAt: Date | null;
    status: DeliveryStatus;
    driver?: (typeof driverRows)[number];
  };
  const trips: Trip[] = [];
  const reports: Prisma.DailySalesReportCreateManyInput[] = [];
  const lines: Prisma.DailySalesLineCreateManyInput[] = [];

  for (const row of stationRows) for (const fuel of row.fuels) fuel.stock = fuel.opening;
  for (let d = 0; d <= DAYS; d++) {
    const day = addDays(opening, d);
    const isToday = d === DAYS;
    const weekday = dateValue(day).getUTCDay();
    for (const row of stationRows) {
      const { spec } = row;
      const reported = !spec.skippedDays?.includes(d) && !(isToday && spec.notReportedToday);
      const reportId = randomUUID();
      let hasLine = false;
      for (const fuel of row.fuels) {
        // Replenish: a truck arrives when the tank runs low.
        const threshold = spec.lowStock ? 0.6 : 0.32;
        const canDeliver = d > 0 && !isToday && (!spec.lowStock || d < 22);
        if (canDeliver && fuel.stock < fuel.capacity * threshold) {
          const room = Math.floor((fuel.capacity * 0.97 - fuel.stock) / 1000) * 1000;
          const quantity = Math.min(pick([20_000, 25_000, 30_000, 36_000, 40_000]), room);
          if (quantity >= 12_000) {
            const deliveredAt = at(day, between(7.5, 11.5));
            const [lo, hi] = transitHours[spec.route]!;
            trips.push({
              id: randomUUID(),
              station: row,
              fuel,
              destination: spec.name,
              product: fuelLabels[fuel.product],
              route: routes[spec.route]!,
              quantity,
              createdAt: new Date(deliveredAt.getTime() - between(lo, hi) * HOUR),
              deliveredAt,
              status: 'DELIVERED',
            });
            fuel.stock += quantity;
          }
        }
        if (!reported) continue;
        const factor = (weekday === 0 ? 0.75 : weekday === 6 ? 0.9 : 1) * between(0.82, 1.18);
        let sold = fuel.daily * factor * (isToday ? 0.6 : 1);
        if (spec.lowStock && d >= 25) {
          // Demand surge in Mekelle drains the tank toward ~1.5 days of cover by today.
          const target = fuel.daily * 1.5;
          const weights = DAYS - d + 0.6;
          sold = Math.max(sold, ((fuel.stock - target) * (isToday ? 0.6 : 1)) / weights);
        }
        sold = Math.min(round10(sold), fuel.stock);
        fuel.stock -= sold;
        const measured =
          d % 7 === 0 || isToday ? round10(fuel.stock * (1 + between(-0.004, 0.002))) : null;
        lines.push({ reportId, product: fuel.product, litersSold: sold, measuredStockLiters: measured });
        hasLine = true;
      }
      if (reported && hasLine) {
        const submitted = isToday ? new Date(now.getTime() - between(0.5, 3) * HOUR) : at(day, between(19, 21.5));
        reports.push({
          id: reportId,
          stationId: row.id,
          reportDate: dateValue(day),
          submittedById: row.managerId,
          note: rand() < 0.12 ? pick(reportNotes) : null,
          createdAt: submitted,
          updatedAt: submitted,
        });
      }
    }
  }

  // Industrial customers and one cancelled order.
  const industrial: Array<[string, string, keyof typeof routes, number, number]> = [
    ['Mugher Cement Factory', 'Fuel oil', 'addis', 30_000, 18],
    ['Ethiopian Electric Power – Awash', 'Diesel', 'awash', 25_000, 9],
    ['Mugher Cement Factory', 'Fuel oil', 'addis', 30_000, 4],
  ];
  for (const [destination, product, route, quantity, daysAgo] of industrial) {
    const deliveredAt = at(addDays(today, -daysAgo), between(9, 14));
    const [lo, hi] = transitHours[route]!;
    trips.push({
      id: randomUUID(),
      destination,
      product,
      route: routes[route]!,
      quantity,
      createdAt: new Date(deliveredAt.getTime() - between(lo, hi) * HOUR),
      deliveredAt,
      status: 'DELIVERED',
    });
  }
  const cancelledAt = at(addDays(today, -11), 10);
  trips.push({
    id: randomUUID(),
    destination: 'Adama Central',
    product: 'Benzine',
    route: routes.adama!,
    quantity: 20_000,
    createdAt: new Date(cancelledAt.getTime() - 3 * HOUR),
    deliveredAt: null,
    status: 'CANCELLED',
  });

  // Trips on the road right now (one per driver), for the live map and approval queue.
  const byCode = (code: string) => stationRows.find((row) => row.spec.code === code)!;
  const fuelOf = (code: string, product: FuelProduct) => byCode(code).fuels.find((f) => f.product === product)!;
  const active: Array<[string, FuelProduct, DeliveryStatus, number, number]> = [
    // station, fuel, status, liters, hours since created
    ['BOL-01', 'BENZINE', 'DISPATCHED', 30_000, 3],
    ['ADM-01', 'DIESEL', 'IN_TRANSIT', 25_000, 14],
    ['MEK-01', 'DIESEL', 'IN_TRANSIT', 30_000, 30],
    ['HWS-01', 'BENZINE', 'IN_TRANSIT', 20_000, 46],
    ['AIR-01', 'JET_A1', 'ARRIVED', 40_000, 56],
    ['BOL-01', 'DIESEL', 'UNLOADING', 25_000, 54],
    ['MEK-01', 'BENZINE', 'AWAITING_DELIVERY_APPROVAL', 18_000, 52],
    ['DDK-01', 'FUEL_OIL', 'AWAITING_DELIVERY_APPROVAL', 15_000, 31],
  ];
  const activeTrips: Trip[] = active.map(([code, product, status, liters, hoursAgo]) => {
    const fuel = fuelOf(code, product);
    const arrived = ['ARRIVED', 'UNLOADING', 'AWAITING_DELIVERY_APPROVAL'].includes(status);
    // Never let an approval overfill the tank.
    const room = Math.floor((fuel.capacity - fuel.stock) / 1000) * 1000;
    return {
      id: randomUUID(),
      station: byCode(code),
      fuel,
      destination: byCode(code).spec.name,
      product: fuelLabels[product],
      route: routes[byCode(code).spec.route]!,
      quantity: arrived ? Math.max(Math.min(liters, room), 5_000) : liters,
      createdAt: new Date(now.getTime() - hoursAgo * HOUR),
      deliveredAt: null,
      status,
    };
  });

  // Assign drivers: no driver is on two trips at once.
  trips.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const trip of trips) {
    const free = driverRows
      .filter((driver) => driver.availableAt <= trip.createdAt.getTime())
      .sort((a, b) => a.availableAt - b.availableAt);
    const driver = free.length ? pick(free.slice(0, 4)) : driverRows.sort((a, b) => a.availableAt - b.availableAt)[0]!;
    trip.driver = driver;
    driver.availableAt = (trip.deliveredAt ?? trip.createdAt).getTime() + between(10, 30) * HOUR;
  }
  const busy = new Set<string>();
  for (const trip of activeTrips) {
    const driver = driverRows
      .filter((d) => !busy.has(d.id) && d.availableAt <= trip.createdAt.getTime())
      .sort((a, b) => a.availableAt - b.availableAt)[0]
      ?? driverRows.find((d) => !busy.has(d.id))!;
    busy.add(driver.id);
    trip.driver = driver;
  }
  const allTrips = [...trips, ...activeTrips].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Delivery numbers continue this year's sequence, as the API does.
  const year = now.getUTCFullYear();
  const already = await prisma.delivery.count({ where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } } });
  const taken = new Set(
    (await prisma.delivery.findMany({ where: { deliveryNumber: { startsWith: `DEL-${year}-` } }, select: { deliveryNumber: true } })).map(
      (row) => row.deliveryNumber,
    ),
  );
  let sequence = already;
  const nextNumber = () => {
    let number;
    do number = `DEL-${year}-${String(++sequence).padStart(6, '0')}`;
    while (taken.has(number));
    return number;
  };

  const origins = ['Djibouti Port – Horizon Terminal', 'Djibouti Port – Doraleh Terminal'];
  const history: Prisma.DeliveryStatusHistoryCreateManyInput[] = [];
  const locations: Prisma.DeliveryLocationCreateManyInput[] = [];
  const order: DeliveryStatus[] = ['CREATED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING', 'AWAITING_DELIVERY_APPROVAL'];

  for (const trip of allTrips) {
    const driverId = trip.driver!.id;
    const t0 = trip.createdAt.getTime();
    const end = trip.deliveredAt?.getTime() ?? now.getTime();
    const times: Partial<Record<DeliveryStatus, number>> = {
      CREATED: t0,
      DISPATCHED: t0 + between(0.5, 2) * HOUR,
      IN_TRANSIT: t0 + between(2.2, 3.5) * HOUR,
    };
    if (trip.deliveredAt) {
      times.ARRIVED = end - between(2.5, 3.5) * HOUR;
      times.UNLOADING = end - between(1.6, 2.2) * HOUR;
      times.AWAITING_DELIVERY_APPROVAL = end - between(0.4, 1.2) * HOUR;
      times.DELIVERED = end;
    } else if (trip.status !== 'CANCELLED') {
      const reached = order.indexOf(trip.status);
      const span = now.getTime() - t0;
      if (reached >= 3) times.ARRIVED = t0 + span * 0.8;
      if (reached >= 4) times.UNLOADING = t0 + span * 0.88;
      if (reached >= 5) times.AWAITING_DELIVERY_APPROVAL = now.getTime() - between(0.3, 1.5) * HOUR;
      if (trip.status === 'DISPATCHED') delete times.IN_TRANSIT;
    }
    let previous: DeliveryStatus | null = null;
    for (const status of [...order, 'DELIVERED' as DeliveryStatus]) {
      const time = times[status];
      if (time === undefined) continue;
      history.push({
        deliveryId: trip.id,
        previousStatus: previous,
        newStatus: status,
        changedById: status === 'DELIVERED' ? admin.id : driverId,
        reason: status === 'CREATED' ? 'Created by driver' : status === 'DELIVERED' ? 'Approved delivered by admin' : 'Updated by driver',
        createdAt: new Date(time),
      });
      previous = status;
    }
    if (trip.status === 'CANCELLED')
      history.push({
        deliveryId: trip.id,
        previousStatus: 'CREATED',
        newStatus: 'CANCELLED',
        changedById: admin.id,
        reason: 'Cancelled by admin – station postponed the order',
        createdAt: cancelledAt,
      });

    // GPS trail for trips that are still open.
    if (!trip.deliveredAt && trip.status !== 'CANCELLED') {
      const progress: Record<string, number> = { DISPATCHED: 0, IN_TRANSIT: 0, ARRIVED: 1, UNLOADING: 1, AWAITING_DELIVERY_APPROVAL: 1 };
      const start = times.IN_TRANSIT ?? times.DISPATCHED!;
      const fraction =
        trip.status === 'IN_TRANSIT'
          ? Math.min(0.92, ((now.getTime() - start) / HOUR) / ((transitHours[trip.station!.spec.route]![0] + transitHours[trip.station!.spec.route]![1]) / 2))
          : progress[trip.status]!;
      const finish = trip.status === 'IN_TRANSIT' ? now.getTime() - 4 * 60_000 : (times.ARRIVED ?? now.getTime());
      const steps = Math.max(2, Math.round((routeKm(trip.route) * fraction) / 15));
      for (let i = 0; i <= steps; i++) {
        const f = (fraction * i) / steps;
        const { point, heading } = along(trip.route, f);
        locations.push({
          deliveryId: trip.id,
          latitude: Number(point[0].toFixed(6)),
          longitude: Number(point[1].toFixed(6)),
          accuracy: Math.round(between(4, 15)),
          speed: fraction === 0 || i === steps ? 0 : Number(between(11, 19).toFixed(1)),
          heading: Math.round(heading),
          recordedAt: new Date(start + ((finish - start) * i) / steps),
        });
      }
    }
  }

  await prisma.delivery.createMany({
    data: allTrips.map((trip) => ({
      id: trip.id,
      deliveryNumber: nextNumber(),
      driverUserId: trip.driver!.id,
      origin: pick(origins),
      destination: trip.destination,
      fuelProduct: trip.product,
      quantityLiters: trip.quantity,
      truckPlate: trip.driver!.truckPlate,
      status: trip.status,
      stationFuelId: trip.fuel?.id ?? null,
      deliveredAt: trip.deliveredAt,
      createdAt: trip.createdAt,
      updatedAt: trip.deliveredAt ?? trip.createdAt,
    })),
  });
  await prisma.deliveryStatusHistory.createMany({ data: history });
  await prisma.deliveryLocation.createMany({ data: locations });
  await prisma.dailySalesReport.createMany({ data: reports });
  await prisma.dailySalesLine.createMany({ data: lines });

  // ---- incidents
  const delivered = trips.filter((trip) => trip.deliveredAt && trip.station);
  const pastIncidents: Array<[IncidentType, IncidentSeverity, string, string, number]> = [
    ['CUSTOMS_DELAY', 'MEDIUM', 'Truck queue at Galafi border; customs system offline for about four hours.', 'Cleared after system came back online.', 0.3],
    ['TIRE_PROBLEM', 'MEDIUM', 'Front right tire blew out 20 km after Mille. Fitted the spare, need a replacement.', 'Replacement tire fitted in Mille.', 0.5],
    ['BREAKDOWN', 'HIGH', 'Alternator failed near Awash. Truck stopped on the shoulder with hazard lights on.', 'Mechanic from Awash replaced the alternator; trip resumed next morning.', 0.72],
    ['ROUTE_BLOCKED', 'HIGH', 'Road blocked by a local protest near Adigala. Waiting with other trucks.', 'Road reopened by local police after six hours.', 0.6],
    ['FUEL_LEAK', 'LOW', 'Small seep from the rear compartment valve. Tightened it, monitoring at every stop.', 'Valve gasket replaced at destination; no product lost.', 0.45],
    ['SECURITY_ISSUE', 'MEDIUM', 'Group tried to stop the truck at night near Gewane. Did not stop, continued to the checkpoint.', 'Reported to federal police; convoy advised for night driving.', 0.62],
    ['ACCIDENT', 'LOW', 'Minor scrape with a minibus while parking in Adama. No injuries, photos taken.', 'Insurance details exchanged; no further action.', 0.9],
    ['OTHER', 'LOW', 'Driver felt unwell from the heat at Logiya. Took a three-hour rest before continuing.', 'Driver fine; rest stops added to the Afar leg.', 0.4],
  ];
  const incidentRows: Prisma.IncidentCreateManyInput[] = pastIncidents.map(([type, severity, description, note, f], i) => {
    const trip = delivered[Math.floor(((i + 0.5) / pastIncidents.length) * delivered.length)]!;
    const { point } = along(trip.route, f);
    const reportedAt = new Date(trip.createdAt.getTime() + (trip.deliveredAt!.getTime() - trip.createdAt.getTime()) * f);
    return {
      clientId: `demo-${randomUUID()}`,
      deliveryId: trip.id,
      reportedById: trip.driver!.id,
      type,
      severity,
      description,
      status: 'RESOLVED',
      latitude: Number(point[0].toFixed(6)),
      longitude: Number(point[1].toFixed(6)),
      reportedAt,
      acknowledgedAt: new Date(reportedAt.getTime() + between(0.1, 0.6) * HOUR),
      resolvedAt: new Date(reportedAt.getTime() + between(3, 12) * HOUR),
      resolvedById: admin.id,
      resolutionNote: note,
      createdAt: reportedAt,
    };
  });
  const openOn = (code: string, product: FuelProduct) =>
    activeTrips.find((trip) => trip.station!.spec.code === code && trip.fuel!.product === product)!;
  const lastPoint = (trip: Trip) => {
    const trail = locations.filter((l) => l.deliveryId === trip.id);
    return trail[trail.length - 1]!;
  };
  const customs = openOn('ADM-01', 'DIESEL');
  const tire = openOn('HWS-01', 'BENZINE');
  incidentRows.push(
    {
      clientId: `demo-${randomUUID()}`,
      deliveryId: customs.id,
      reportedById: customs.driver!.id,
      type: 'CUSTOMS_DELAY',
      severity: 'HIGH',
      description: 'Long queue at Galafi border crossing, documents re-checked. Expect 5–6 hours wait.',
      status: 'OPEN',
      latitude: lastPoint(customs).latitude,
      longitude: lastPoint(customs).longitude,
      reportedAt: new Date(now.getTime() - 1.5 * HOUR),
      createdAt: new Date(now.getTime() - 1.5 * HOUR),
    },
    {
      clientId: `demo-${randomUUID()}`,
      deliveryId: tire.id,
      reportedById: tire.driver!.id,
      type: 'TIRE_PROBLEM',
      severity: 'MEDIUM',
      description: 'Rear tire pressure dropping, stopping at the next tire shop in Ziway.',
      status: 'ACKNOWLEDGED',
      latitude: lastPoint(tire).latitude,
      longitude: lastPoint(tire).longitude,
      reportedAt: new Date(now.getTime() - 5 * HOUR),
      acknowledgedAt: new Date(now.getTime() - 4.6 * HOUR),
      createdAt: new Date(now.getTime() - 5 * HOUR),
    },
  );
  await prisma.incident.createMany({ data: incidentRows });

  // ---- garage records
  const garages: Array<[string, string]> = [
    ['Kality Truck Service', 'Kality, Addis Ababa'],
    ['Moenco Service Center', 'Mexico Square, Addis Ababa'],
    ['Adama Heavy Vehicle Garage', 'Adama'],
    ['Dire Dawa Auto Repair', 'Dire Dawa'],
    ['Semera Truck Workshop', 'Semera, Afar'],
    ['Galafi Roadside Tyre', 'Galafi'],
  ];
  const jobs: Array<[string, number, number]> = [
    ['Full service: engine oil, oil and fuel filters, air filter.', 9_500, 14_000],
    ['Replaced two rear drive tires.', 38_000, 52_000],
    ['Brake pads and drums replaced on trailer axle.', 21_000, 28_000],
    ['Alternator rebuilt and battery replaced.', 17_500, 24_000],
    ['Clutch plate and pressure plate replaced.', 64_000, 85_000],
    ['Fifth-wheel greased, kingpin inspected, lights repaired.', 3_500, 6_500],
    ['Radiator flushed, new water pump.', 15_000, 22_000],
    ['Tank compartment valve gaskets replaced, pressure test passed.', 7_800, 11_000],
    ['Gearbox overhaul after grinding in 4th gear.', 140_000, 185_000],
    ['Annual inspection and road-worthiness certificate.', 4_200, 5_800],
  ];
  const maintenance: Prisma.MaintenanceRecordCreateManyInput[] = [];
  for (let i = 0; i < 16; i++) {
    const driver = driverRows[(i * 5) % driverRows.length]!;
    const [work, lo, hi] = jobs[i % jobs.length]!;
    const [garageName, garageLocation] = garages[(i * 7) % garages.length]!;
    const startDay = addDays(today, -Math.round(2 + (i * 73) / 16));
    const length = work.startsWith('Gearbox') || work.startsWith('Clutch') ? 3 : rand() < 0.6 ? 0 : 1;
    const status = i < 4 ? 'PENDING' : i === 6 || i === 11 ? 'REJECTED' : 'APPROVED';
    const reviewed = status !== 'PENDING';
    maintenance.push({
      driverUserId: driver.id,
      truckPlate: driver.truckPlate,
      garageName,
      garageLocation,
      startDate: dateValue(startDay),
      endDate: dateValue(addDays(startDay, length)),
      workDone: work,
      costEtb: Math.round(between(lo, hi) / 50) * 50,
      status,
      reviewNote:
        status === 'REJECTED'
          ? pick(['Receipt is not legible; please upload a clear photo.', 'Cost is far above the agreed garage rate; call fleet office.'])
          : reviewed && rand() < 0.4
            ? 'Receipt checked.'
            : null,
      reviewedById: reviewed ? admin.id : null,
      reviewedAt: reviewed ? at(addDays(startDay, length + 1), 11) : null,
      createdAt: at(addDays(startDay, length), 17),
    });
  }
  await prisma.maintenanceRecord.createMany({ data: maintenance });

  // ---- summary
  console.log(`\nDemo data ready (${opening} → ${today})`);
  console.log(`  ${stationRows.length} stations, ${reports.length} daily reports`);
  console.log(`  ${driverRows.length} drivers, ${allTrips.length} deliveries (${activeTrips.length} on the road), ${locations.length} GPS points`);
  console.log(`  ${incidentRows.length} incidents, ${maintenance.length} garage records`);
  console.log(`\nAll demo accounts use the password from DEMO_PASSWORD (default shown in seed-demo.ts).`);
  console.log(`  Operations manager: ops@${DOMAIN}`);
  for (const { spec } of stationRows)
    console.log(`  Station manager (${spec.code}): ${spec.manager[0].toLowerCase()}.${spec.manager[1].toLowerCase()}@${DOMAIN}`);
  for (const driver of driverRows.slice(0, 3)) console.log(`  Driver: ${driver.email}`);
  console.log(`  ...and ${driverRows.length - 3} more drivers @${DOMAIN}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
