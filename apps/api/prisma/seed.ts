import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() { const role = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN', permissions: ['*'] } }); await prisma.user.upsert({ where: { email: 'admin@fueltrack.local' }, update: {}, create: { firstName: 'System', lastName: 'Administrator', email: 'admin@fueltrack.local', passwordHash: await argon2.hash('FuelTrack123!'), roleId: role.id } }); }
main().finally(() => prisma.$disconnect());
