'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { DriverMap } from './driver-map';
type Driver = {
  id: string;
  licenseNumber: string;
  truckPlate: string;
  phone: string;
  user: { firstName: string; lastName: string; email: string; isActive: boolean };
};
type Delivery = {
  id: string;
  deliveryNumber: string;
  origin: string;
  destination: string;
  fuelProduct: string;
  quantityLiters: number;
  truckPlate: string;
  status: string;
  driver?: { firstName: string; lastName: string; email: string };
  latestLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    speed?: number | null;
    recordedAt: string;
  } | null;
};
const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const deliveryStatuses = [
  'CREATED',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED',
  'UNLOADING',
  'AWAITING_DELIVERY_APPROVAL',
  'DELIVERED',
  'CANCELLED',
];
export default function Dashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [driverNameFilter, setDriverNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showDrivers, setShowDrivers] = useState(false);
  const token = () => sessionStorage.getItem('fueltrack_access_token');
  const request = useCallback(async (path: string, options?: RequestInit) => {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token()}`,
        ...options?.headers,
      },
    });
    const body = (await response.json().catch(() => null)) as {
      data?: unknown;
      message?: string;
    } | null;
    if (!response.ok) throw new Error(body?.message ?? `Request failed (${response.status})`);
    return body?.data;
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [driverRows, deliveryRows] = await Promise.all([
        request('/drivers'),
        request('/deliveries'),
      ]);
      setDrivers(driverRows as Driver[]);
      setDeliveries(deliveryRows as Delivery[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [request]);
  useEffect(() => {
    if (!token()) {
      location.assign('/');
      return;
    }
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      void request('/deliveries')
        .then((rows) => setDeliveries(rows as Delivery[]))
        .catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [request]);
  async function createDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingDriver) return;
    setCreatingDriver(true);
    setError('');
    setNotice('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await request('/drivers', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
      formElement.reset();
      setNotice('Driver account created. Share the credentials securely.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create driver');
    } finally {
      setCreatingDriver(false);
    }
  }
  async function approve(id: string) {
    const delivery = deliveries.find((row) => row.id === id);
    const reference = delivery?.deliveryNumber ?? 'this delivery';
    if (
      !window.confirm(
        `Confirm marking ${reference} as DELIVERED? This is the final admin approval.`,
      )
    )
      return;
    setError('');
    try {
      await request(`/deliveries/${id}/approve-delivered`, { method: 'POST' });
      setNotice('Delivery marked DELIVERED by admin.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to approve delivery');
    }
  }
  const normalizedNameFilter = driverNameFilter.trim().toLocaleLowerCase();
  const filteredDeliveries = deliveries.filter((delivery) => {
    const driverName =
      `${delivery.driver?.firstName ?? ''} ${delivery.driver?.lastName ?? ''}`.toLocaleLowerCase();
    return (
      (!normalizedNameFilter || driverName.includes(normalizedNameFilter)) &&
      (statusFilter === 'ALL' || delivery.status === statusFilter)
    );
  });
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">FUELTRACK ADMIN</p>
          <h1>Driver operations</h1>
          <p>Create driver accounts and give final delivery approval.</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            sessionStorage.clear();
            location.assign('/');
          }}
        >
          Sign out
        </button>
      </header>
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="banner success">{notice}</p>}
      <DriverMap
        deliveries={deliveries.filter(
          (delivery) => !['DELIVERED', 'CANCELLED'].includes(delivery.status),
        )}
        selectedDeliveryId={selectedDeliveryId}
      />
      <section className="admin-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACCESS CONTROL</p>
              <h2>Create driver account</h2>
            </div>
            <div className="heading-actions">
              <span>{drivers.length} drivers</span>
              <button className="secondary" type="button" onClick={() => setShowDrivers(true)}>
                View drivers
              </button>
            </div>
          </div>
          <form className="admin-form" onSubmit={createDriver}>
            <label>
              First name
              <input name="firstName" required />
            </label>
            <label>
              Last name
              <input name="lastName" required />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Temporary password
              <input name="password" type="password" minLength={8} required />
            </label>
            <label>
              Phone
              <input name="phone" required />
            </label>
            <label>
              License number
              <input name="licenseNumber" required />
            </label>
            <label>
              Assigned truck plate
              <input name="truckPlate" placeholder="DJ-1234" required />
            </label>
            <button disabled={creatingDriver}>
              {creatingDriver ? 'Creating driver…' : 'Create driver'}
            </button>
          </form>
        </article>
        <article className="panel deliveries-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AUTHORIZATION QUEUE</p>
              <h2>Driver deliveries</h2>
            </div>
            <button className="secondary" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
          <div className="delivery-filters">
            <label>
              Driver name
              <input
                value={driverNameFilter}
                onChange={(event) => setDriverNameFilter(event.target.value)}
                placeholder="Search driver name"
              />
            </label>
            <label>
              Delivery status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                {deliveryStatuses.map((status) => (
                  <option value={status} key={status}>
                    {status.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p>Loading deliveries…</p>
          ) : deliveries.length === 0 ? (
            <div className="empty">
              <strong>No deliveries yet</strong>
              <p>A driver creates the first delivery from the mobile app.</p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="empty filtered-empty">
              <strong>No matching deliveries</strong>
              <p>Change the driver name or status filter.</p>
            </div>
          ) : (
            <div className="delivery-list">
              {filteredDeliveries.map((delivery) => (
                <div
                  className={`delivery-row ${selectedDeliveryId === delivery.id ? 'selected-delivery' : ''} ${delivery.status === 'IN_TRANSIT' ? 'map-selectable' : ''}`}
                  key={delivery.id}
                  role={delivery.status === 'IN_TRANSIT' ? 'button' : undefined}
                  tabIndex={delivery.status === 'IN_TRANSIT' ? 0 : undefined}
                  onClick={() => {
                    if (delivery.status !== 'IN_TRANSIT') return;
                    setSelectedDeliveryId(delivery.id);
                    document
                      .getElementById('driver-map-panel')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  onKeyDown={(event) => {
                    if (
                      delivery.status === 'IN_TRANSIT' &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      setSelectedDeliveryId(delivery.id);
                      document
                        .getElementById('driver-map-panel')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  <div className="delivery-main">
                    <div>
                      <strong className="delivery-driver">
                        {delivery.driver
                          ? `${delivery.driver.firstName} ${delivery.driver.lastName}`
                          : 'Unassigned driver'}
                      </strong>
                      <span className={`status ${delivery.status.toLowerCase()}`}>
                        {delivery.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <p>
                      {delivery.origin} → {delivery.destination}
                    </p>
                    <small>
                      {delivery.deliveryNumber} · {delivery.truckPlate} · {delivery.fuelProduct} ·{' '}
                      {Number(delivery.quantityLiters).toLocaleString()} L
                    </small>
                  </div>
                  {delivery.status === 'AWAITING_DELIVERY_APPROVAL' ? (
                    <button onClick={() => void approve(delivery.id)}>Approve delivered</button>
                  ) : delivery.status === 'DELIVERED' ? (
                    <span className="approved">✓ Admin approved</span>
                  ) : delivery.status === 'IN_TRANSIT' ? (
                    <span className="map-link">
                      {delivery.latestLocation ? 'View on map →' : 'Waiting for GPS'}
                    </span>
                  ) : (
                    <span className="waiting">Driver in progress</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
      {showDrivers && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowDrivers(false)}
        >
          <section
            className="driver-directory"
            role="dialog"
            aria-modal="true"
            aria-labelledby="driver-directory-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">DRIVER DIRECTORY</p>
                <h2 id="driver-directory-title">Created drivers</h2>
              </div>
              <button className="secondary" type="button" onClick={() => setShowDrivers(false)}>
                Close
              </button>
            </div>
            {drivers.length === 0 ? (
              <div className="empty">
                <strong>No drivers created</strong>
                <p>Create the first driver from the admin form.</p>
              </div>
            ) : (
              <div className="driver-directory-list">
                {drivers.map((driver) => (
                  <article className="driver-directory-row" key={driver.id}>
                    <div className="driver-directory-name">
                      <strong>
                        {driver.user.firstName} {driver.user.lastName}
                      </strong>
                      <span
                        className={`account-state ${driver.user.isActive ? 'active' : 'inactive'}`}
                      >
                        {driver.user.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                      <small>{driver.user.email}</small>
                    </div>
                    <dl>
                      <div>
                        <dt>Phone</dt>
                        <dd>{driver.phone}</dd>
                      </div>
                      <div>
                        <dt>License</dt>
                        <dd>{driver.licenseNumber}</dd>
                      </div>
                      <div>
                        <dt>Truck</dt>
                        <dd>{driver.truckPlate}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
