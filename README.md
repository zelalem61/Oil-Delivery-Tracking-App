# FuelTrack

FuelTrack is a local-first fuel transportation and delivery platform for the Djibouti–Ethiopia corridor. This repository currently contains the Phase 1 foundation only.

## Included

- Next.js operations portal with login and loading/error states
- NestJS REST API, Swagger, validation, security headers, JWT access/refresh flow, and RBAC guard
- PostgreSQL/PostGIS schema and migration for users and roles
- Expo driver login application
- Driver MVP with home, demo assignment, trip state machine, foreground GPS capture, incident reports, profile, connectivity status, and persistent offline event queue
- Shared TypeScript types and validation
- Docker Compose for free local PostGIS and Redis

## Run locally

Requirements: Node.js 22+, pnpm 10+, and Docker Desktop.

1. Copy `.env.example` to `.env` and replace both JWT secrets.
2. Run `pnpm install`.
3. Run `docker compose up -d postgres redis`.
4. Run `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed`.
5. Run `pnpm dev`.

Web: http://localhost:3000  
API: http://localhost:4000/api  
Swagger: http://localhost:4000/api/docs

Seed login: `admin@fueltrack.local` / `FuelTrack123!` (development only; change it immediately outside local development).

### Driver mobile MVP

Run `pnpm --filter @fueltrack/driver-mobile exec expo start --clear` and scan the QR code with Expo Go. Authentication and delivery status updates use the live API. GPS and incident events remain locally queued until the tracking and incident APIs are implemented. Foreground location works in Expo Go; production background tracking requires a development build.

### Connected admin and driver workflow

1. An admin signs into the web dashboard and creates a driver account.
2. The driver signs into the mobile app with those credentials.
3. The driver creates a delivery, which is automatically assigned to that driver.
4. The driver advances the strict lifecycle from `CREATED` through `AWAITING_DELIVERY_APPROVAL`.
5. The driver cannot select `DELIVERED`.
6. The admin reviews the delivery in the dashboard and authorizes the final `DELIVERED` status.
7. Every transition is recorded in `DeliveryStatusHistory` with the user who made it.

Development driver created by the integration smoke test: `driver.demo@fueltrack.local` / `Driver123!`.

## Cost policy

Phase 1 has no paid service dependency. PostgreSQL/PostGIS, Redis, the API, web app, and mobile app run locally. Production hosting and third-party map/storage providers are deferred and will be selected only after reviewing their current free-tier limits.
