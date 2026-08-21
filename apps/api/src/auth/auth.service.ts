import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service';
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async login(email: string, password: string) { const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true, driver: true } }); if (!user?.isActive || !(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException('Invalid email or password'); return this.issue(user.id, user.email, user.role.name, user.firstName, user.lastName, user.driver?.truckPlate); }
  async refresh(token: string) { try { const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { secret: this.secret('JWT_REFRESH_SECRET') }); const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true, driver: true } }); if (!user?.isActive || !user.refreshTokenHash || !(await argon2.verify(user.refreshTokenHash, token))) throw new Error(); return this.issue(user.id, user.email, user.role.name, user.firstName, user.lastName, user.driver?.truckPlate); } catch { throw new UnauthorizedException('Invalid refresh token'); } }
  async logout(userId: string) { await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } }); }
  private async issue(id: string, email: string, role: string, firstName: string, lastName: string, truckPlate?: string) { const claims = { sub: id, email, role }; const accessToken = await this.jwt.signAsync(claims, { secret: this.secret('JWT_SECRET'), expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 28_800) }); const refreshToken = await this.jwt.signAsync(claims, { secret: this.secret('JWT_REFRESH_SECRET'), expiresIn: '7d' }); await this.prisma.user.update({ where: { id }, data: { refreshTokenHash: await argon2.hash(refreshToken), lastLoginAt: new Date() } }); return { success: true, data: { accessToken, refreshToken, user: { id, email, role, firstName, lastName, truckPlate } } }; }
  private secret(name: string) { const value = process.env[name]; if (!value || value.length < 32) throw new Error(`${name} must contain at least 32 characters`); return value; }
}
