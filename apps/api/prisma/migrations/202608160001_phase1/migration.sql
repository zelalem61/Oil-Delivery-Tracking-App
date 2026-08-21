CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE "Role" ("id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(), "name" TEXT NOT NULL UNIQUE, "permissions" JSONB NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE "User" ("id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(), "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE, "phone" TEXT, "passwordHash" TEXT NOT NULL, "roleId" UUID NOT NULL REFERENCES "Role"("id"), "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "lastLoginAt" TIMESTAMPTZ, "refreshTokenHash" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
