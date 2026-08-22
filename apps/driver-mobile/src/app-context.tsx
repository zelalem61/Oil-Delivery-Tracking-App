import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiBaseUrl } from './mobile-api';
import { nextStatus, type Delivery, type DriverUser, type OfflineEvent } from './domain';

type CreateDeliveryInput = {
  origin: string;
  destination: string;
  fuelProduct: string;
  quantityLiters: number;
};
type AppContextValue = {
  user: DriverUser | null;
  delivery: Delivery | null;
  queue: OfflineEvent[];
  online: boolean;
  loadingDelivery: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  refreshDelivery(): Promise<void>;
  createDelivery(input: CreateDeliveryInput): Promise<void>;
  advanceTrip(): Promise<void>;
  enqueue(type: OfflineEvent['type'], payload: Record<string, unknown>): Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);
const STATE_KEY = 'fueltrack.driver.connected.state';
const SESSION_KEY = 'fueltrack.driver.session';
type AuthData = { accessToken: string; refreshToken: string; user: DriverUser };
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DriverUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [queue, setQueue] = useState<OfflineEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const flushing = useRef(false);
  useEffect(() => {
    void AsyncStorage.getItem(STATE_KEY).then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as { queue?: OfflineEvent[] };
      if (saved.queue) setQueue(saved.queue);
    });
    void AsyncStorage.getItem(SESSION_KEY).then(async (raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as AuthData;
      setToken(saved.accessToken);
      setRefreshToken(saved.refreshToken);
      setUser(saved.user);
      try {
        await loadDelivery(saved.accessToken, saved.refreshToken);
      } catch {
        await AsyncStorage.removeItem(SESSION_KEY);
        setToken(null);
        setRefreshToken(null);
        setUser(null);
      }
    });
    return NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected)));
  }, []);
  useEffect(() => {
    void AsyncStorage.setItem(STATE_KEY, JSON.stringify({ queue }));
  }, [queue]);
  useEffect(() => {
    if (!online || !token || flushing.current) return;
    const pending = queue.filter((event) => event.type === 'LOCATION');
    if (!pending.length) return;
    flushing.current = true;
    void (async () => {
      const sent: string[] = [];
      try {
        for (const event of pending) {
          try {
            await uploadLocation(event.payload);
            sent.push(event.id);
          } catch {
            break;
          }
        }
      } finally {
        if (sent.length) setQueue((current) => current.filter((event) => !sent.includes(event.id)));
        flushing.current = false;
      }
    })();
  }, [online, token, queue]);
  async function renew(sessionRefreshToken: string) {
    const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionRefreshToken }),
    });
    const result = (await response.json().catch(() => null)) as {
      data?: AuthData;
      message?: string;
    } | null;
    if (!response.ok || !result?.data)
      throw new Error(result?.message ?? 'Your session expired. Please sign in again.');
    setToken(result.data.accessToken);
    setRefreshToken(result.data.refreshToken);
    setUser(result.data.user);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(result.data));
    return result.data.accessToken;
  }
  async function api(
    path: string,
    options?: RequestInit,
    accessToken = token,
    sessionRefreshToken = refreshToken,
  ) {
    const send = (bearer: string) =>
      fetch(`${apiBaseUrl()}${path}`, {
        ...options,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${bearer}`,
          ...options?.headers,
        },
      });
    if (!accessToken) throw new Error('Your session expired. Please sign in again.');
    let response = await send(accessToken);
    if (response.status === 401 && sessionRefreshToken) {
      response = await send(await renew(sessionRefreshToken));
    }
    const body = (await response.json().catch(() => null)) as {
      data?: unknown;
      message?: string | string[];
    } | null;
    if (!response.ok) {
      const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
      throw new Error(message ?? `Request failed (${response.status})`);
    }
    return body?.data;
  }
  async function login(email: string, password: string) {
    const response = await fetch(`${apiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const result = (await response.json().catch(() => null)) as {
      data?: AuthData;
      message?: string;
    } | null;
    if (!response.ok || !result?.data) throw new Error(result?.message ?? 'Login failed');
    if (result.data.user.role !== 'DRIVER')
      throw new Error('Use a driver account created by an administrator.');
    const session = {
      ...result.data,
      user: { ...result.data.user, email: email.trim().toLowerCase() },
    };
    setToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    setUser(session.user);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    await loadDelivery(session.accessToken, session.refreshToken);
  }
  async function loadDelivery(accessToken = token, sessionRefreshToken = refreshToken) {
    if (!accessToken) return;
    setLoadingDelivery(true);
    try {
      const rows = (await api(
        '/deliveries',
        undefined,
        accessToken,
        sessionRefreshToken,
      )) as Delivery[];
      setDelivery(rows.find((row) => row.status !== 'DELIVERED') ?? null);
    } finally {
      setLoadingDelivery(false);
    }
  }
  async function refreshDelivery() {
    await loadDelivery();
  }
  async function createDelivery(input: CreateDeliveryInput) {
    const row = (await api('/deliveries', {
      method: 'POST',
      body: JSON.stringify(input),
    })) as Delivery;
    setDelivery(row);
  }
  async function advanceTrip() {
    if (!delivery) return;
    const target = nextStatus[delivery.status];
    if (!target) return;
    const row = (await api(`/deliveries/${delivery.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: target }),
    })) as Delivery;
    setDelivery(row);
  }
  async function uploadLocation(payload: Record<string, unknown>) {
    const deliveryId = String(payload.deliveryId ?? '');
    if (!deliveryId) throw new Error('Delivery is required for location tracking');
    const { deliveryId: _deliveryId, timestamp, ...coordinates } = payload;
    await api(`/deliveries/${deliveryId}/locations`, {
      method: 'POST',
      body: JSON.stringify({
        ...coordinates,
        recordedAt: String(timestamp ?? new Date().toISOString()),
      }),
    });
  }
  async function enqueue(type: OfflineEvent['type'], payload: Record<string, unknown>) {
    if (type === 'LOCATION' && online && token) {
      try {
        await uploadLocation(payload);
        return;
      } catch {}
    }
    setQueue((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        createdAt: new Date().toISOString(),
        payload,
      },
    ]);
  }
  function logout() {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setDelivery(null);
    void AsyncStorage.removeItem(SESSION_KEY);
  }
  const value = useMemo(
    () => ({
      user,
      delivery,
      queue,
      online,
      loadingDelivery,
      login,
      logout,
      refreshDelivery,
      createDelivery,
      advanceTrip,
      enqueue,
    }),
    [user, delivery, queue, online, loadingDelivery, token],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
