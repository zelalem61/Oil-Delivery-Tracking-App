CREATE TYPE "DeliveryStatus" AS ENUM ('CREATED', 'DISPATCHED', 'IN_TRANSIT', 'BORDER_CHECK', 'CLEARED_BORDER', 'ARRIVED', 'UNLOADING', 'AWAITING_DELIVERY_APPROVAL', 'DELIVERED', 'CANCELLED');

CREATE TABLE "Driver" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "driverCode" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Delivery" (
  "id" UUID NOT NULL,
  "deliveryNumber" TEXT NOT NULL,
  "driverUserId" UUID NOT NULL,
  "origin" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "fuelProduct" TEXT NOT NULL,
  "quantityLiters" DECIMAL(12,2) NOT NULL,
  "truckPlate" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'CREATED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryStatusHistory" (
  "id" UUID NOT NULL,
  "deliveryId" UUID NOT NULL,
  "previousStatus" "DeliveryStatus",
  "newStatus" "DeliveryStatus" NOT NULL,
  "changedById" UUID NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Driver_userId_key" ON "Driver"("userId");
CREATE UNIQUE INDEX "Driver_driverCode_key" ON "Driver"("driverCode");
CREATE UNIQUE INDEX "Driver_licenseNumber_key" ON "Driver"("licenseNumber");
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");
CREATE INDEX "Delivery_driverUserId_idx" ON "Delivery"("driverUserId");
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");
CREATE INDEX "DeliveryStatusHistory_deliveryId_createdAt_idx" ON "DeliveryStatusHistory"("deliveryId", "createdAt");
CREATE INDEX "DeliveryStatusHistory_changedById_idx" ON "DeliveryStatusHistory"("changedById");
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryStatusHistory" ADD CONSTRAINT "DeliveryStatusHistory_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryStatusHistory" ADD CONSTRAINT "DeliveryStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
