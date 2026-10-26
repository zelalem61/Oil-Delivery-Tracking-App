export type FuelProduct = 'BENZINE' | 'DIESEL' | 'JET_A1' | 'FUEL_OIL';

export const fuelOptions: { product: FuelProduct; label: string }[] = [
  { product: 'BENZINE', label: 'Benzine' },
  { product: 'DIESEL', label: 'Diesel' },
  { product: 'JET_A1', label: 'Jet A-1' },
  { product: 'FUEL_OIL', label: 'Fuel oil' },
];

export type StationFuel = {
  id: string;
  product: FuelProduct;
  label: string;
  openingStockLiters: number;
  openingDate: string;
  capacityLiters: number | null;
  stockLiters: number;
  receivedLiters: number;
  incomingLiters: number;
  soldTodayLiters: number;
  averageDailySoldLiters: number;
  daysOfCover: number | null;
  fillPercent: number | null;
};

export type StationManager = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
};

export type Station = {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  fuels: StationFuel[];
  managers: StationManager[];
  today: string;
  todayReport: {
    id: string;
    updatedAt: string;
    submittedBy: { firstName: string; lastName: string };
  } | null;
  lastReportDate: string | null;
  stockLiters: number;
  soldTodayLiters: number;
};

export type LedgerFuel = {
  product: FuelProduct;
  label: string;
  soldLiters: number | null;
  receivedLiters: number;
  closingStockLiters: number | null;
  measuredStockLiters: number | null;
  varianceLiters: number | null;
};

export type History = {
  from: string;
  to: string;
  reportedDays: number;
  expectedDays: number;
  totals: {
    product: FuelProduct;
    label: string;
    soldLiters: number;
    receivedLiters: number;
    averageDailySoldLiters: number;
  }[];
  rows: {
    date: string;
    report: {
      id: string;
      note: string | null;
      updatedAt: string;
      submittedBy: { firstName: string; lastName: string };
    } | null;
    deliveries: string[];
    fuels: LedgerFuel[];
    totalSoldLiters: number;
  }[];
};

export type Staff = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  role: 'STATION_MANAGER' | 'OPERATIONS_MANAGER';
  station: { id: string; code: string; name: string } | null;
};

/** Station managers may submit or correct reports this many days back (matches the API). */
export const MANAGER_EDIT_DAYS = 7;

export const liters = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} L`;

export const signedLiters = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${liters(Math.abs(value))}`;

/** Fuel is low when under 3 days of average sales or 15% of tank capacity. */
export const isLow = (fuel: StationFuel) =>
  fuel.stockLiters <= 0 ||
  (fuel.daysOfCover !== null && fuel.daysOfCover < 3) ||
  (fuel.fillPercent !== null && fuel.fillPercent < 15);

export const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
