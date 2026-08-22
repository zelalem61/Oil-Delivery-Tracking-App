import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
describe('RolesGuard', () => {
  it('permits a matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'ADMIN' } }) }),
    } as never;
    expect(guard.canActivate(context)).toBe(true);
  });
});
