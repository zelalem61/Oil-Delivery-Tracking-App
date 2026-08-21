ALTER TABLE "Driver" ADD COLUMN "truckPlate" TEXT NOT NULL DEFAULT 'UNASSIGNED';

UPDATE "Driver" AS driver
SET "truckPlate" = 'DJ-DEMO-001'
FROM "User" AS app_user
WHERE driver."userId" = app_user."id"
  AND app_user."email" = 'driver.demo@fueltrack.local';

ALTER TABLE "Driver" ALTER COLUMN "truckPlate" DROP DEFAULT;
