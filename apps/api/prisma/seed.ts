import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@fueltrack.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'FuelTrack123!';
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must contain at least 8 characters');
  const role = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: { permissions: ['*'] },
    create: { name: 'ADMIN', permissions: ['*'] },
  });
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { email: 'admin@fueltrack.local' }], roleId: role.id },
    orderBy: { createdAt: 'asc' },
  });
  const data = {
    firstName: 'System',
    lastName: 'Administrator',
    email,
    passwordHash: await argon2.hash(password),
    roleId: role.id,
    isActive: true,
  };
  if (existing) await prisma.user.update({ where: { id: existing.id }, data });
  else await prisma.user.create({ data });
}
main().finally(() => prisma.$disconnect());
