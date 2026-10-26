/**
 * End-to-end integration suite. Runs against a live API over HTTP:
 *   API_URL=http://localhost:4000/api pnpm --filter @fueltrack/api test:e2e
 * Every run creates its own drivers, staff and station (suffixed with a run id), so it
 * can be repeated against the same database.
 */
const API = (process.env.API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@fueltrack.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'FuelTrack123!';
const run = Date.now().toString(36).toUpperCase();
const password = 'Driver123!';

type Json = Record<string, any>;
type Res = { status: number; body: Json };

async function call(method: string, path: string, token?: string, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let parsed: Json = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

const get = (path: string, token?: string) => call('GET', path, token);
const post = (path: string, token?: string, body?: unknown) => call('POST', path, token, body);
const patch = (path: string, token?: string, body?: unknown) => call('PATCH', path, token, body);
const put = (path: string, token?: string, body?: unknown) => call('PUT', path, token, body);

async function login(email: string, pass: string) {
  const res = await post('/auth/login', undefined, { email, password: pass });
  expect(res.status).toBe(201);
  return res.body.data as { accessToken: string; refreshToken: string; user: Json };
}

/** YYYY-MM-DD in East Africa Time, matching the API's business day. */
function eatDay(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const s: {
  admin?: string;
  adminRefresh?: string;
  driverA?: string;
  driverAId?: string;
  driverB?: string;
  stationId?: string;
  otherStationId?: string;
  deliveryId?: string;
  incidentId?: string;
  maintenanceId?: string;
  attachmentId?: string;
  manager?: string;
  ops?: string;
} = {};

jest.setTimeout(30_000);

describe('Health & auth', () => {
  it('health check responds', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('rejects a wrong password', async () => {
    const res = await post('/auth/login', undefined, { email: ADMIN_EMAIL, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects malformed login input', async () => {
    const res = await post('/auth/login', undefined, { email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
  });

  it('admin logs in', async () => {
    const data = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(data.user.role).toBe('ADMIN');
    s.admin = data.accessToken;
    s.adminRefresh = data.refreshToken;
  });

  it('refresh issues new tokens', async () => {
    const res = await post('/auth/refresh', undefined, { refreshToken: s.adminRefresh });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    s.admin = res.body.data.accessToken;
    s.adminRefresh = res.body.data.refreshToken;
  });

  it('protected routes require a token', async () => {
    expect((await get('/deliveries')).status).toBe(401);
    expect((await get('/drivers')).status).toBe(401);
    expect((await get('/deliveries', 'garbage.token.value')).status).toBe(401);
  });
});

describe('Drivers (admin)', () => {
  const driver = (key: string) => ({
    firstName: `Test${key}`,
    lastName: `Driver ${run}`,
    email: `it.${key.toLowerCase()}.${run.toLowerCase()}@fueltrack.local`,
    password,
    phone: '+251911000000',
    licenseNumber: `LIC-${key}-${run}`,
    truckPlate: `IT-${key}-${run}`,
  });

  it('creates two drivers', async () => {
    for (const key of ['A', 'B']) {
      const res = await post('/drivers', s.admin, driver(key));
      expect(res.status).toBe(201);
      expect(res.body.data.truckPlate).toBe(`IT-${key}-${run}`);
    }
  });

  it('rejects a duplicate email', async () => {
    const res = await post('/drivers', s.admin, { ...driver('A'), licenseNumber: `LIC-X-${run}` });
    expect(res.status).toBe(409);
  });

  it('rejects a duplicate license number', async () => {
    const res = await post('/drivers', s.admin, {
      ...driver('A'),
      email: `it.dup.${run.toLowerCase()}@fueltrack.local`,
    });
    expect(res.status).toBe(409);
  });

  it('lists drivers and searches the directory', async () => {
    const list = await get('/drivers', s.admin);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    const dir = await get(`/drivers/directory?search=IT-A-${run}`, s.admin);
    expect(dir.status).toBe(200);
    expect(dir.body.data.total).toBe(1);
    expect(dir.body.data.items[0].licenseNumber).toBe(`LIC-A-${run}`);
  });

  it('drivers log in and cannot reach admin routes', async () => {
    const a = await login(driver('A').email, password);
    const b = await login(driver('B').email, password);
    expect(a.user.role).toBe('DRIVER');
    expect(a.user.truckPlate).toBe(`IT-A-${run}`);
    s.driverA = a.accessToken;
    s.driverAId = a.user.id;
    s.driverB = b.accessToken;
    expect((await get('/drivers', s.driverA)).status).toBe(403);
    expect((await post('/drivers', s.driverA, driver('C'))).status).toBe(403);
    expect((await get('/staff', s.driverA)).status).toBe(403);
    expect((await get('/stations', s.driverA)).status).toBe(403);
  });
});

describe('Stations & staff', () => {
  it('admin creates stations with fuels', async () => {
    const res = await post('/stations', s.admin, {
      code: `IT-${run}`.slice(0, 20),
      name: `Integration Station ${run}`,
      location: 'Test City',
      fuels: [
        { product: 'DIESEL', openingStockLiters: 50_000, openingDate: eatDay(-3), capacityLiters: 80_000 },
        { product: 'BENZINE', openingStockLiters: 20_000, openingDate: eatDay(-3) },
      ],
    });
    expect(res.status).toBe(201);
    s.stationId = res.body.data.id;
    expect(res.body.data.fuels).toHaveLength(2);
    expect(res.body.data.stockLiters).toBe(70_000);

    const other = await post('/stations', s.admin, {
      code: `IO-${run}`.slice(0, 20),
      name: `Other Station ${run}`,
      fuels: [{ product: 'JET_A1', openingStockLiters: 1_000 }],
    });
    expect(other.status).toBe(201);
    s.otherStationId = other.body.data.id;
  });

  it('rejects duplicate codes, duplicate fuels and future opening dates', async () => {
    const dup = await post('/stations', s.admin, {
      code: `IT-${run}`.slice(0, 20),
      name: `Dup ${run}`,
      fuels: [{ product: 'DIESEL', openingStockLiters: 1 }],
    });
    expect(dup.status).toBe(409);
    const twice = await post('/stations', s.admin, {
      code: `IX-${run}`.slice(0, 20),
      name: `Twice ${run}`,
      fuels: [
        { product: 'DIESEL', openingStockLiters: 1 },
        { product: 'DIESEL', openingStockLiters: 2 },
      ],
    });
    expect(twice.status).toBe(400);
    const future = await post('/stations', s.admin, {
      code: `IY-${run}`.slice(0, 20),
      name: `Future ${run}`,
      fuels: [{ product: 'DIESEL', openingStockLiters: 1, openingDate: eatDay(5) }],
    });
    expect(future.status).toBe(400);
  });

  it('updates a station and adds a fuel', async () => {
    const res = await patch(`/stations/${s.otherStationId}`, s.admin, { location: 'Djibouti Port' });
    expect(res.status).toBe(200);
    expect(res.body.data.location).toBe('Djibouti Port');
    const fuel = await put(`/stations/${s.otherStationId}/fuels`, s.admin, {
      product: 'FUEL_OIL',
      openingStockLiters: 5_000,
    });
    expect(fuel.status).toBe(200);
    expect(fuel.body.data.fuels.map((f: Json) => f.product).sort()).toEqual(['FUEL_OIL', 'JET_A1']);
  });

  it('station options are visible to drivers', async () => {
    const res = await get('/stations/options', s.driverA);
    expect(res.status).toBe(200);
    const mine = res.body.data.find((row: Json) => row.id === s.stationId);
    expect(mine.products.map((p: Json) => p.label).sort()).toEqual(['Benzine', 'Diesel']);
  });

  it('creates a station manager and an operations manager', async () => {
    const missingStation = await post('/staff', s.admin, {
      role: 'STATION_MANAGER',
      firstName: 'No',
      lastName: 'Station',
      email: `it.nostation.${run.toLowerCase()}@fueltrack.local`,
      password,
    });
    expect(missingStation.status).toBe(400);

    const manager = await post('/staff', s.admin, {
      role: 'STATION_MANAGER',
      firstName: 'Station',
      lastName: `Manager ${run}`,
      email: `it.manager.${run.toLowerCase()}@fueltrack.local`,
      password,
      stationId: s.stationId,
    });
    expect(manager.status).toBe(201);
    expect(manager.body.data.station.id).toBe(s.stationId);

    const ops = await post('/staff', s.admin, {
      role: 'OPERATIONS_MANAGER',
      firstName: 'Ops',
      lastName: `Manager ${run}`,
      email: `it.ops.${run.toLowerCase()}@fueltrack.local`,
      password,
    });
    expect(ops.status).toBe(201);

    const list = await get('/staff', s.admin);
    expect(list.status).toBe(200);
    expect(list.body.data.some((u: Json) => u.email === `it.ops.${run.toLowerCase()}@fueltrack.local`)).toBe(true);

    s.manager = (await login(`it.manager.${run.toLowerCase()}@fueltrack.local`, password)).accessToken;
    s.ops = (await login(`it.ops.${run.toLowerCase()}@fueltrack.local`, password)).accessToken;
  });

  it('station manager sees only their station', async () => {
    const list = await get('/stations', s.manager);
    expect(list.status).toBe(200);
    expect(list.body.data.map((row: Json) => row.id)).toEqual([s.stationId]);
    expect((await get(`/stations/${s.otherStationId}`, s.manager)).status).toBe(403);
    expect((await post('/stations', s.manager, {})).status).toBe(403);
  });

  it('operations manager sees every station but cannot edit', async () => {
    const list = await get('/stations', s.ops);
    expect(list.status).toBe(200);
    const ids = list.body.data.map((row: Json) => row.id);
    expect(ids).toEqual(expect.arrayContaining([s.stationId, s.otherStationId]));
    expect((await patch(`/stations/${s.stationId}`, s.ops, { name: 'Nope' })).status).toBe(403);
    expect(
      (await put(`/stations/${s.stationId}/reports/${eatDay()}`, s.ops, {
        lines: [{ product: 'DIESEL', litersSold: 1 }],
      })).status,
    ).toBe(403);
  });
});

describe('Delivery lifecycle', () => {
  it('rejects a fuel the station does not take', async () => {
    const res = await post('/deliveries', s.driverA, {
      origin: 'Djibouti Port',
      destination: 'ignored',
      fuelProduct: 'Jet A-1',
      quantityLiters: 10_000,
      stationId: s.stationId,
    });
    expect(res.status).toBe(400);
  });

  it('driver creates a delivery to a station', async () => {
    const res = await post('/deliveries', s.driverA, {
      origin: 'Djibouti Port',
      destination: 'ignored',
      fuelProduct: 'Diesel',
      quantityLiters: 10_000,
      stationId: s.stationId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('CREATED');
    expect(res.body.data.destination).toBe(`Integration Station ${run}`);
    expect(res.body.data.truckPlate).toBe(`IT-A-${run}`);
    expect(res.body.data.deliveryNumber).toMatch(/^DEL-\d{4}-\d{6}$/);
    s.deliveryId = res.body.data.id;
  });

  it('blocks a second active delivery and admin-created deliveries', async () => {
    const body = { origin: 'A', destination: 'B', fuelProduct: 'Diesel', quantityLiters: 1 };
    expect((await post('/deliveries', s.driverA, body)).status).toBe(400);
    expect((await post('/deliveries', s.admin, body)).status).toBe(403);
  });

  it('station shows the delivery as incoming', async () => {
    const res = await get(`/stations/${s.stationId}`, s.admin);
    const diesel = res.body.data.fuels.find((f: Json) => f.product === 'DIESEL');
    expect(diesel.incomingLiters).toBe(10_000);
  });

  it('enforces the strict status order', async () => {
    const skip = await patch(`/deliveries/${s.deliveryId}/status`, s.driverA, { status: 'IN_TRANSIT' });
    expect(skip.status).toBe(400);
    const delivered = await patch(`/deliveries/${s.deliveryId}/status`, s.driverA, { status: 'DELIVERED' });
    expect(delivered.status).toBe(400);
    const otherDriver = await patch(`/deliveries/${s.deliveryId}/status`, s.driverB, { status: 'DISPATCHED' });
    expect(otherDriver.status).toBe(403);
    const early = await post(`/deliveries/${s.deliveryId}/approve-delivered`, s.admin);
    expect(early.status).toBe(400);
  });

  it('driver advances to awaiting approval, recording GPS on the way', async () => {
    for (const status of ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING', 'AWAITING_DELIVERY_APPROVAL']) {
      const res = await patch(`/deliveries/${s.deliveryId}/status`, s.driverA, { status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
      if (status === 'IN_TRANSIT') {
        const loc = await post(`/deliveries/${s.deliveryId}/locations`, s.driverA, {
          latitude: 11.5721,
          longitude: 43.1456,
          accuracy: 8,
          speed: 15.2,
          heading: 270,
          recordedAt: new Date().toISOString(),
        });
        expect(loc.status).toBe(201);
        expect(loc.body.data.latitude).toBeCloseTo(11.5721);
      }
    }
  });

  it('rejects invalid GPS and GPS from another driver', async () => {
    const bad = await post(`/deliveries/${s.deliveryId}/locations`, s.driverA, {
      latitude: 200,
      longitude: 0,
      recordedAt: new Date().toISOString(),
    });
    expect(bad.status).toBe(400);
    const other = await post(`/deliveries/${s.deliveryId}/locations`, s.driverB, {
      latitude: 9,
      longitude: 38,
      recordedAt: new Date().toISOString(),
    });
    expect(other.status).toBe(403);
  });

  it('drivers see only their own deliveries; admin sees all', async () => {
    const mine = await get('/deliveries', s.driverA);
    expect(mine.body.data.map((d: Json) => d.id)).toContain(s.deliveryId);
    const theirs = await get('/deliveries', s.driverB);
    expect(theirs.body.data.map((d: Json) => d.id)).not.toContain(s.deliveryId);
    const all = await get('/deliveries', s.admin);
    const row = all.body.data.find((d: Json) => d.id === s.deliveryId);
    expect(row.latestLocation.longitude).toBeCloseTo(43.1456);
    expect(row.statusHistory.map((h: Json) => h.newStatus)).toEqual([
      'CREATED',
      'DISPATCHED',
      'IN_TRANSIT',
      'ARRIVED',
      'UNLOADING',
      'AWAITING_DELIVERY_APPROVAL',
    ]);
  });
});

describe('Incidents', () => {
  const clientId = `it-incident-${run}`;

  it('driver reports an incident (idempotent by clientId)', async () => {
    const body = {
      type: 'TIRE_PROBLEM',
      severity: 'MEDIUM',
      description: 'Rear left tire punctured near Dikhil checkpoint.',
      clientId,
      latitude: 11.1,
      longitude: 42.37,
    };
    const first = await post(`/deliveries/${s.deliveryId}/incidents`, s.driverA, body);
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe('OPEN');
    const retry = await post(`/deliveries/${s.deliveryId}/incidents`, s.driverA, body);
    expect(retry.body.data.id).toBe(first.body.data.id);
    s.incidentId = first.body.data.id;
  });

  it('rejects short descriptions and other drivers', async () => {
    const short = await post(`/deliveries/${s.deliveryId}/incidents`, s.driverA, {
      type: 'OTHER',
      severity: 'LOW',
      description: 'short',
    });
    expect(short.status).toBe(400);
    const other = await post(`/deliveries/${s.deliveryId}/incidents`, s.driverB, {
      type: 'OTHER',
      severity: 'LOW',
      description: 'Not my delivery at all.',
    });
    expect(other.status).toBe(403);
  });

  it('delivery shows an open incident count', async () => {
    const all = await get('/deliveries', s.admin);
    expect(all.body.data.find((d: Json) => d.id === s.deliveryId).openIncidents).toBe(1);
  });

  it('admin acknowledges then resolves; drivers cannot', async () => {
    expect((await patch(`/incidents/${s.incidentId}`, s.driverA, { status: 'RESOLVED' })).status).toBe(403);
    const ack = await patch(`/incidents/${s.incidentId}`, s.admin, { status: 'ACKNOWLEDGED' });
    expect(ack.status).toBe(200);
    expect(ack.body.data.status).toBe('ACKNOWLEDGED');
    const again = await patch(`/incidents/${s.incidentId}`, s.admin, { status: 'ACKNOWLEDGED' });
    expect(again.status).toBe(400);
    const resolved = await patch(`/incidents/${s.incidentId}`, s.admin, {
      status: 'RESOLVED',
      note: 'Tire replaced at Dikhil.',
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.resolutionNote).toBe('Tire replaced at Dikhil.');
    expect((await patch(`/incidents/${s.incidentId}`, s.admin, { status: 'RESOLVED' })).status).toBe(400);
  });

  it('lists incidents by status and scope', async () => {
    const active = await get('/incidents', s.admin);
    expect(active.body.data.map((i: Json) => i.id)).not.toContain(s.incidentId);
    const resolved = await get('/incidents?status=RESOLVED', s.admin);
    expect(resolved.body.data.map((i: Json) => i.id)).toContain(s.incidentId);
    const mine = await get('/incidents?status=ALL', s.driverA);
    expect(mine.body.data.map((i: Json) => i.id)).toContain(s.incidentId);
    const theirs = await get('/incidents?status=ALL', s.driverB);
    expect(theirs.body.data.map((i: Json) => i.id)).not.toContain(s.incidentId);
    expect((await get('/incidents?status=BOGUS', s.admin)).status).toBe(400);
  });
});

describe('Garage records (maintenance)', () => {
  it('driver adds a record with an attachment', async () => {
    const form = new FormData();
    form.append('garageName', 'Dikhil Tyre Service');
    form.append('garageLocation', 'Dikhil, Djibouti');
    form.append('startDate', eatDay(-1));
    form.append('endDate', eatDay());
    form.append('workDone', 'Replaced rear left tire and balanced wheels.');
    form.append('costEtb', '8500.50');
    form.append('files', new Blob([PNG], { type: 'image/png' }), 'receipt.png');
    const res = await post('/maintenance', s.driverA, form);
    expect(res.status).toBe(201);
    expect(res.body.data.costEtb).toBe(8500.5);
    expect(res.body.data.daysInGarage).toBe(2);
    expect(res.body.data.delivery.id).toBe(s.deliveryId); // auto-linked to the active trip
    expect(res.body.data.attachments).toHaveLength(1);
    s.maintenanceId = res.body.data.id;
    s.attachmentId = res.body.data.attachments[0].id;
  });

  it('rejects bad dates and disallowed file types', async () => {
    const backwards = new FormData();
    backwards.append('garageName', 'Garage');
    backwards.append('startDate', eatDay());
    backwards.append('endDate', eatDay(-2));
    backwards.append('workDone', 'Something');
    backwards.append('costEtb', '10');
    expect((await post('/maintenance', s.driverA, backwards)).status).toBe(400);

    const exe = new FormData();
    exe.append('garageName', 'Garage');
    exe.append('startDate', eatDay());
    exe.append('endDate', eatDay());
    exe.append('workDone', 'Something');
    exe.append('costEtb', '10');
    exe.append('files', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'virus.exe');
    expect((await post('/maintenance', s.driverA, exe)).status).toBe(400);
  });

  it('attachment downloads for the owner and admin only', async () => {
    const res = await fetch(`${API}/maintenance/attachments/${s.attachmentId}`, {
      headers: { Authorization: `Bearer ${s.admin}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    expect((await get(`/maintenance/attachments/${s.attachmentId}`, s.driverB)).status).toBe(403);
    expect((await get(`/maintenance/${s.maintenanceId}`, s.driverB)).status).toBe(403);
    expect((await get(`/maintenance/${s.maintenanceId}`, s.driverA)).status).toBe(200);
  });

  it('admin filters and summarises records', async () => {
    const res = await get(`/maintenance?search=${encodeURIComponent(`IT-A-${run}`)}&status=PENDING`, s.admin);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.summary.totalCostEtb).toBe(8500.5);
    const driverView = await get('/maintenance', s.driverB);
    expect(driverView.body.data.items.map((r: Json) => r.id)).not.toContain(s.maintenanceId);
  });

  it('admin review requires a note to reject; drivers cannot review', async () => {
    expect((await patch(`/maintenance/${s.maintenanceId}/review`, s.driverA, { status: 'APPROVED' })).status).toBe(403);
    expect((await patch(`/maintenance/${s.maintenanceId}/review`, s.admin, { status: 'REJECTED' })).status).toBe(400);
    const ok = await patch(`/maintenance/${s.maintenanceId}/review`, s.admin, {
      status: 'APPROVED',
      note: 'Receipt matches.',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('APPROVED');
    expect(ok.body.data.reviewedBy).toBeTruthy();
  });
});

describe('Approval, stock and daily sales', () => {
  it('admin approves the delivery and station stock grows', async () => {
    const res = await post(`/deliveries/${s.deliveryId}/approve-delivered`, s.admin);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DELIVERED');
    expect(res.body.data.deliveredAt).toBeTruthy();
    const station = await get(`/stations/${s.stationId}`, s.admin);
    const diesel = station.body.data.fuels.find((f: Json) => f.product === 'DIESEL');
    expect(diesel.stockLiters).toBe(60_000);
    expect(diesel.receivedLiters).toBe(10_000);
    expect(diesel.incomingLiters).toBe(0);
  });

  it('tracking ends after delivery and the driver can start a new trip', async () => {
    const loc = await post(`/deliveries/${s.deliveryId}/locations`, s.driverA, {
      latitude: 9,
      longitude: 38,
      recordedAt: new Date().toISOString(),
    });
    expect(loc.status).toBe(400);
    const next = await post('/deliveries', s.driverA, {
      origin: 'Djibouti Port',
      destination: 'Adama Depot',
      fuelProduct: 'Benzine',
      quantityLiters: 5_000,
    });
    expect(next.status).toBe(201);
  });

  it('station manager submits and corrects today\'s report', async () => {
    const first = await put(`/stations/${s.stationId}/reports/${eatDay()}`, s.manager, {
      lines: [{ product: 'DIESEL', litersSold: 1_500 }],
    });
    expect(first.status).toBe(200);
    const corrected = await put(`/stations/${s.stationId}/reports/${eatDay()}`, s.manager, {
      lines: [
        { product: 'DIESEL', litersSold: 2_000, measuredStockLiters: 57_900 },
        { product: 'BENZINE', litersSold: 800 },
      ],
      note: 'Pump 2 recalibrated',
    });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.id).toBe(first.body.data.id);
  });

  it('rejects invalid reports', async () => {
    const url = (date: string) => `/stations/${s.stationId}/reports/${date}`;
    const line = { lines: [{ product: 'DIESEL', litersSold: 1 }] };
    expect((await put(url(eatDay(2)), s.manager, line)).status).toBe(400); // future
    expect((await put(url(eatDay(-10)), s.manager, line)).status).toBe(403); // too old for manager
    expect((await put(url('2026-13-45'), s.manager, line)).status).toBe(400);
    expect((await put(url(eatDay()), s.manager, { lines: [{ product: 'JET_A1', litersSold: 1 }] })).status).toBe(400);
    expect(
      (await put(url(eatDay()), s.manager, {
        lines: [
          { product: 'DIESEL', litersSold: 1 },
          { product: 'DIESEL', litersSold: 2 },
        ],
      })).status,
    ).toBe(400);
    expect((await put(`/stations/${s.otherStationId}/reports/${eatDay()}`, s.manager, line)).status).toBe(403);
  });

  it('admin can backfill reports, but not before the stock opening date', async () => {
    const res = await put(`/stations/${s.stationId}/reports/${eatDay(-5)}`, s.admin, {
      lines: [{ product: 'DIESEL', litersSold: 1 }],
    });
    expect(res.status).toBe(400);
    const ok = await put(`/stations/${s.stationId}/reports/${eatDay(-2)}`, s.admin, {
      lines: [{ product: 'DIESEL', litersSold: 1_000 }],
    });
    expect(ok.status).toBe(200);
  });

  it('station totals reflect sales and deliveries', async () => {
    const res = await get(`/stations/${s.stationId}`, s.manager);
    const data = res.body.data;
    const diesel = data.fuels.find((f: Json) => f.product === 'DIESEL');
    expect(diesel.stockLiters).toBe(50_000 + 10_000 - 2_000 - 1_000);
    expect(diesel.soldTodayLiters).toBe(2_000);
    expect(data.soldTodayLiters).toBe(2_800);
    expect(data.todayReport).toBeTruthy();
    expect(data.lastReportDate).toBe(eatDay());
  });

  it('history ledger computes closing stock and variance', async () => {
    const res = await get(`/stations/${s.stationId}/history?from=${eatDay(-3)}&to=${eatDay()}`, s.ops);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.expectedDays).toBe(4);
    expect(data.reportedDays).toBe(2);
    const today = data.rows[0];
    expect(today.date).toBe(eatDay());
    const diesel = today.fuels.find((f: Json) => f.product === 'DIESEL');
    expect(diesel.closingStockLiters).toBe(57_000);
    expect(diesel.measuredStockLiters).toBe(57_900);
    expect(diesel.varianceLiters).toBe(900);
    expect(diesel.receivedLiters).toBe(10_000);
    const dieselTotals = data.totals.find((t: Json) => t.product === 'DIESEL');
    expect(dieselTotals.soldLiters).toBe(3_000);
    expect(dieselTotals.receivedLiters).toBe(10_000);
    expect((await get(`/stations/${s.stationId}/history?from=${eatDay()}&to=${eatDay(-3)}`, s.ops)).status).toBe(400);
  });

  it('deactivated stations disappear from driver options', async () => {
    const off = await patch(`/stations/${s.otherStationId}`, s.admin, { isActive: false });
    expect(off.status).toBe(200);
    const options = await get('/stations/options', s.driverB);
    expect(options.body.data.map((row: Json) => row.id)).not.toContain(s.otherStationId);
  });
});

describe('Logout', () => {
  it('logout revokes the refresh token', async () => {
    expect((await post('/auth/logout', s.admin)).status).toBe(201);
    const res = await post('/auth/refresh', undefined, { refreshToken: s.adminRefresh });
    expect(res.status).toBe(401);
  });
});
