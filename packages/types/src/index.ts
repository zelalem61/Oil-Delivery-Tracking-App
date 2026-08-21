export const roles = ['ADMIN', 'OPERATIONS_MANAGER', 'DISPATCHER', 'DRIVER', 'STATION_MANAGER'] as const;
export type RoleName = (typeof roles)[number];
export interface AuthUser { id: string; firstName: string; lastName: string; email: string; role: RoleName; }
export interface AuthTokens { accessToken: string; refreshToken: string; user: AuthUser; }
export interface ApiResponse<T> { success: true; data: T; }
export interface ApiError { success: false; error: { code: string; message: string; }; }
