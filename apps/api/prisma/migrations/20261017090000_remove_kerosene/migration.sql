-- Kerosene is no longer sold. Remove its stock records and report lines before dropping the value.
-- Deliveries linked to a kerosene tank keep their history; their stationFuelId is set to NULL by the FK.
BEGIN;
DELETE FROM "DailySalesLine" WHERE "product" = 'KEROSENE';
DELETE FROM "StationFuel" WHERE "product" = 'KEROSENE';

-- AlterEnum
CREATE TYPE "FuelProduct_new" AS ENUM ('BENZINE', 'DIESEL', 'JET_A1', 'FUEL_OIL');
ALTER TABLE "StationFuel" ALTER COLUMN "product" TYPE "FuelProduct_new" USING ("product"::text::"FuelProduct_new");
ALTER TABLE "DailySalesLine" ALTER COLUMN "product" TYPE "FuelProduct_new" USING ("product"::text::"FuelProduct_new");
ALTER TYPE "FuelProduct" RENAME TO "FuelProduct_old";
ALTER TYPE "FuelProduct_new" RENAME TO "FuelProduct";
DROP TYPE "FuelProduct_old";
COMMIT;
