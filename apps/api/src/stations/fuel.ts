import { FuelProduct } from '@prisma/client';

/** Display names; the driver app sends these as `fuelProduct` on a delivery. */
export const fuelLabels: Record<FuelProduct, string> = {
  BENZINE: 'Benzine',
  DIESEL: 'Diesel',
  JET_A1: 'Jet A-1',
  FUEL_OIL: 'Fuel oil',
};
export const fuelProducts = Object.keys(fuelLabels) as FuelProduct[];

export function productFromLabel(label: string): FuelProduct | undefined {
  const value = label.trim().toLowerCase();
  return fuelProducts.find(
    (product) => fuelLabels[product].toLowerCase() === value || product.toLowerCase() === value,
  );
}

/** Stations in Ethiopia and Djibouti both run on East Africa Time (UTC+3). */
export const businessTimeZone = process.env.BUSINESS_TIME_ZONE ?? 'Africa/Addis_Ababa';

/** YYYY-MM-DD of an instant in the business time zone. */
export function businessDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Converts a Prisma @db.Date value (midnight UTC) to YYYY-MM-DD. */
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const dateValue = (key: string) => new Date(`${key}T00:00:00.000Z`);
export function addDays(key: string, days: number) {
  const date = dateValue(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}
