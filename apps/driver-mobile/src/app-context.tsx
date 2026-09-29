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
export type EnqueueResult =
  | { status: 'sent' }
  | { status: 'queued'; reason: 'offline' | 'server'; message?: string };
type AppContextValue = {
  user: DriverUser | null;
  delivery: Delivery | null;
  /** Most recent delivery the admin approved (for the "Last delivery" card). */
  lastCompleted: Delivery | null;
  /** Set when an approval is detected during this session; cleared by dismissApproval. */
  justApproved: Delivery | null;
  dismissApproval(): void;
  /** Authenticated API call (JSON or FormData body); resolves with the response `data`. */
  request<T = unknown>(path: string, options?: RequestInit): Promise<T>;
  queue: OfflineEvent[];
  online: boolean;
  loadingDelivery: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
  refreshDelivery(): Promise<void>;
  createDelivery(input: CreateDeliveryInput): Promise<void>;
  advanceTrip(): Promise<void>;
  enqueue(type: OfflineEvent['type'], payload: Record<string, unknown>): Promise<EnqueueResult>;
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
  const [lastCompleted, setLastCompleted] = useState<Delivery | null>(null);
  const [justApproved, setJustApproved] = useState<Delivery | null>(null);
  const deliveryRef = useRef<Delivery | null>(null);
  useEffect(() => {
    deliveryRef.current = delivery;
  }, [delivery]);
  const [queue, setQueue] = useState<OfflineEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const flushing = useRef(false);
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRetryTick((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
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
    const pending = queue.filter((event) => event.type === 'LOCATION' || event.type === 'INCIDENT');
    if (!pending.length) return;
    flushing.current = true;
    void (async () => {
      const sent: string[] = [];
      try {
        for (const event of pending) {
          try {
            await uploadEvent(event.type, event.payload);
            sent.push(event.id);
          } catch {
            // Keep it queued and try the next one; it is retried on the next flush.
          }
        }
      } finally {
        if (sent.length) setQueue((current) => current.filter((event) => !sent.includes(event.id)));
        flushing.current = false;
      }
    })();
  }, [online, token, queue, retryTick]);
  // While the driver waits for admin approval, check the server every 15 seconds.
  useEffect(() => {
    if (delivery?.status !== 'AWAITING_DELIVERY_APPROVAL' || !online || !token) return;
    const timer = setInterval(() => {
      void loadDelivery().catch(() => undefined);
    }, 15_000);
    return () => clearInterval(timer);
  }, [delivery?.status, online, token]);

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
          // Let fetch set the multipart boundary itself for file uploads.
          ...(options?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
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
      const current =
        rows.find((row) => row.status !== 'DELIVERED' && row.status !== 'CANCELLED') ?? null;
      const previous = deliveryRef.current;
      if (previous && previous.id !== current?.id) {
        const updated = rows.find((row) => row.id === previous.id);
        if (updated?.status === 'DELIVERED') setJustApproved(updated);
      }
      setLastCompleted(rows.find((row) => row.status === 'DELIVERED') ?? null);
      deliveryRef.current = current;
      setDelivery(current);
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
  async function uploadIncident(payload: Record<string, unknown>) {
    const deliveryId = String(payload.deliveryId ?? '');
    if (!deliveryId) throw new Error('Delivery is required for an incident report');
    const { deliveryId: _deliveryId, ...incident } = payload;
    await api(`/deliveries/${deliveryId}/incidents`, {
      method: 'POST',
      body: JSON.stringify(incident),
    });
  }
  async function uploadEvent(type: OfflineEvent['type'], payload: Record<string, unknown>) {
    if (type === 'LOCATION') return uploadLocation(payload);
    if (type === 'INCIDENT') return uploadIncident(payload);
  }
  async function enqueue(
    type: OfflineEvent['type'],
    input: Record<string, unknown>,
  ): Promise<EnqueueResult> {
    // Incidents carry a stable client id so a retry after a lost connection is not duplicated.
    const payload =
      type === 'INCIDENT'
        ? {
            clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            reportedAt: new Date().toISOString(),
            ...input,
          }
        : input;
    let result: EnqueueResult = { status: 'queued', reason: 'offline' };
    if ((type === 'LOCATION' || type === 'INCIDENT') && online && token) {
      try {
        await uploadEvent(type, payload);
        return { status: 'sent' };
      } catch (error) {
        // fetch throws TypeError when the server cannot be reached; anything else is a server reply.
        result =
          error instanceof TypeError
            ? { status: 'queued', reason: 'offline' }
            : {
                status: 'queued',
                reason: 'server',
                message: error instanceof Error ? error.message : undefined,
              };
      }
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
    return result;
  }
  function logout() {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setDelivery(null);
    setLastCompleted(null);
    setJustApproved(null);
    void AsyncStorage.removeItem(SESSION_KEY);
  }
  const value = useMemo(
    () => ({
      user,
      delivery,
      lastCompleted,
      justApproved,
      dismissApproval: () => setJustApproved(null),
      request: <T,>(path: string, options?: RequestInit) => api(path, options) as Promise<T>,
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
    [user, delivery, lastCompleted, justApproved, queue, online, loadingDelivery, token],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
