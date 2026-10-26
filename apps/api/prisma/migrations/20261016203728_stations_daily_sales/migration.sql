-- CreateEnum
CREATE TYPE "FuelProduct" AS ENUM ('BENZINE', 'DIESEL', 'KEROSENE', 'JET_A1', 'FUEL_OIL');

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "stationFuelId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stationId" UUID;

-- CreateTable
CREATE TABLE "Station" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationFuel" (
    "id" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "product" "FuelProduct" NOT NULL,
    "capacityLiters" DECIMAL(14,2),
    "openingStockLiters" DECIMAL(14,2) NOT NULL,
    "openingDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StationFuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySalesReport" (
    "id" UUID NOT NULL,
    "stationId" UUID NOT NULL,
    "reportDate" DATE NOT NULL,
    "submittedById" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySalesReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySalesLine" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "product" "FuelProduct" NOT NULL,
    "litersSold" DECIMAL(14,2) NOT NULL,
    "measuredStockLiters" DECIMAL(14,2),

    CONSTRAINT "DailySalesLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Station_code_key" ON "Station"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Station_name_key" ON "Station"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StationFuel_stationId_product_key" ON "StationFuel"("stationId", "product");

-- CreateIndex
CREATE INDEX "DailySalesReport_reportDate_idx" ON "DailySalesReport"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesReport_stationId_reportDate_key" ON "DailySalesReport"("stationId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesLine_reportId_product_key" ON "DailySalesLine"("reportId", "product");

-- CreateIndex
CREATE INDEX "Delivery_stationFuelId_status_idx" ON "Delivery"("stationFuelId", "status");

-- CreateIndex
CREATE INDEX "User_stationId_idx" ON "User"("stationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_stationFuelId_fkey" FOREIGN KEY ("stationFuelId") REFERENCES "StationFuel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationFuel" ADD CONSTRAINT "StationFuel_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySalesReport" ADD CONSTRAINT "DailySalesReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySalesLine" ADD CONSTRAINT "DailySalesLine_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailySalesReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
