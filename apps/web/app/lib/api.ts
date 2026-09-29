export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'fueltrack_access_token';

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function signOut() {
  sessionStorage.clear();
  location.assign('/');
}

/** Reads the email claim from the JWT payload (display only, not verified). */
export function tokenEmail() {
  const token = getToken();
  if (!token) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.email ?? '');
  } catch {
    return '';
  }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    location.assign('/');
    throw new Error('Signed out');
  }
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    message?: string | string[];
  } | null;
  if (response.status === 401) {
    signOut();
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Request failed (${response.status})`);
  }
  return body?.data as T;
}

/** Downloads a protected file (e.g. a garage receipt) as a Blob using the admin's token. */
export async function requestBlob(path: string): Promise<Blob> {
  const token = getToken();
  if (!token) {
    location.assign('/');
    throw new Error('Signed out');
  }
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    signOut();
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Download failed (${response.status})`);
  }
  return response.blob();
}

export const closedStatuses = ['DELIVERED', 'CANCELLED'];

export const statusLabel = (status: string) =>
  status
    .toLowerCase()
    .split('_')
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');

export function timeAgo(value?: string | null) {
  if (!value) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export type Driver = {
  id: string;
  licenseNumber: string;
  truckPlate: string;
  phone: string;
  createdAt?: string;
  user: { id?: string; firstName: string; lastName: string; email: string; isActive: boolean };
};

export type Delivery = {
  id: string;
  deliveryNumber: string;
  origin: string;
  destination: string;
  fuelProduct: string;
  quantityLiters: number;
  truckPlate: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  driver?: { firstName: string; lastName: string; email: string };
  latestLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    recordedAt: string;
  } | null;
};
