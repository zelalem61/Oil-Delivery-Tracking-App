'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '../components/admin-shell';
import { CreateDriverModal } from '../components/create-driver-modal';
import {
  closedStatuses,
  request,
  statusLabel,
  timeAgo,
  type Delivery,
  type Driver,
} from '../lib/api';

type Directory = {
  items: Driver[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Filter = 'ALL' | 'ON_TRIP' | 'AVAILABLE' | 'INACTIVE';

const initials = (driver: Driver) =>
  `${driver.user.firstName[0] ?? ''}${driver.user.lastName[0] ?? ''}`.toUpperCase();

export default function DriversPage() {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Driver | null>(null);
  const [copied, setCopied] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState('');
  const searchInput = useRef<HTMLInputElement>(null);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query) params.set('search', query);
      setDirectory(await request<Directory>(`/drivers/directory?${params}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load drivers');
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  const loadDeliveries = useCallback(async () => {
    try {
      setDeliveries(await request<Delivery[]>('/deliveries'));
    } catch {
      // Trip data is supplementary; the directory still works without it.
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    void loadDeliveries();
    const interval = window.setInterval(() => void loadDeliveries(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadDeliveries]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      if (next === query) return;
      setQuery(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const byEmail = useMemo(() => {
    const map = new Map<string, Delivery[]>();
    for (const delivery of deliveries) {
      const email = delivery.driver?.email?.toLowerCase();
      if (email) map.set(email, [...(map.get(email) ?? []), delivery]);
    }
    return map;
  }, [deliveries]);

  const activeTrip = useCallback(
    (driver: Driver) =>
      byEmail
        .get(driver.user.email.toLowerCase())
        ?.find((delivery) => !closedStatuses.includes(delivery.status)) ?? null,
    [byEmail],
  );

  const open = deliveries.filter((delivery) => !closedStatuses.includes(delivery.status));
  const stats = {
    total: directory?.total ?? 0,
    onTrip: new Set(open.map((delivery) => delivery.driver?.email)).size,
    awaiting: open.filter((delivery) => delivery.status === 'AWAITING_DELIVERY_APPROVAL').length,
    delivered: deliveries.filter((delivery) => delivery.status === 'DELIVERED').length,
  };

  const rows = (directory?.items ?? []).filter((driver) => {
    const trip = activeTrip(driver);
    if (filter === 'ON_TRIP') return Boolean(trip);
    if (filter === 'AVAILABLE') return !trip && driver.user.isActive;
    if (filter === 'INACTIVE') return !driver.user.isActive;
    return true;
  });

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      // Clipboard can be unavailable on insecure origins.
    }
  }

  const history = selected ? (byEmail.get(selected.user.email.toLowerCase()) ?? []) : [];
  const selectedTrip = selected ? activeTrip(selected) : null;
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <AdminShell
      title="Drivers"
      subtitle="Everyone on the fleet, what they drive, and where each trip stands."
      actions={
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          + New driver
        </button>
      }
    >
      <section className="kpis kpis-4">
        <div className="kpi">
          <span>Total drivers</span>
          <strong>{directory ? stats.total : '–'}</strong>
          <small>Registered accounts</small>
        </div>
        <div className="kpi kpi-blue">
          <span>On a trip now</span>
          <strong>{stats.onTrip}</strong>
          <small>With an active delivery</small>
        </div>
        <div className="kpi kpi-amber">
          <span>Awaiting approval</span>
          <strong>{stats.awaiting}</strong>
          <small>
            <Link href="/dashboard">Review on dashboard →</Link>
          </small>
        </div>
        <div className="kpi">
          <span>Deliveries completed</span>
          <strong>{stats.delivered}</strong>
          <small>All time</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head wrap">
          <div className="search search-lg">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, plate or licence"
              aria-label="Search drivers"
            />
            {search ? (
              <button className="icon-btn sm" aria-label="Clear search" onClick={() => setSearch('')}>
                ×
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </div>
          <div className="segmented" role="group" aria-label="Filter drivers">
            {(
              [
                ['ALL', 'All'],
                ['ON_TRIP', 'On trip'],
                ['AVAILABLE', 'Available'],
                ['INACTIVE', 'Inactive'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                className={filter === value ? 'active' : ''}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => void loadDirectory()}>
              Retry
            </button>
          </div>
        ) : loading && !directory ? (
          <div className="table">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="trow drivers-row skeleton" key={index}>
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : !rows.length ? (
          <div className="empty">
            <div className="empty-icon">👤</div>
            <strong>{query || filter !== 'ALL' ? 'No matching drivers' : 'No drivers yet'}</strong>
            <p>
              {query || filter !== 'ALL'
                ? 'Try a different search or filter.'
                : 'Add your first driver to get the fleet moving.'}
            </p>
            {!query && filter === 'ALL' && (
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                + New driver
              </button>
            )}
          </div>
        ) : (
          <div className={`table ${loading ? 'dim' : ''}`}>
            <div className="trow drivers-row thead">
              <span>Driver</span>
              <span>Contact</span>
              <span>Vehicle</span>
              <span>Current trip</span>
            </div>
            {rows.map((driver) => {
              const trip = activeTrip(driver);
              return (
                <button
                  key={driver.id}
                  className={`trow drivers-row clickable ${selected?.id === driver.id ? 'selected' : ''}`}
                  onClick={() => setSelected(driver)}
                >
                  <span className="person">
                    <span className={`avatar ${driver.user.isActive ? '' : 'avatar-muted'}`}>
                      {initials(driver)}
                    </span>
                    <span>
                      <strong>
                        {driver.user.firstName} {driver.user.lastName}
                      </strong>
                      <small>
                        <span className={`dot ${driver.user.isActive ? 'dot-on' : 'dot-off'}`} />
                        {driver.user.isActive ? 'Active' : 'Inactive'}
                      </small>
                    </span>
                  </span>
                  <span>
                    <strong className="normal">{driver.phone}</strong>
                    <small>{driver.user.email}</small>
                  </span>
                  <span>
                    <span className="plate">{driver.truckPlate}</span>
                    <small>Lic. {driver.licenseNumber}</small>
                  </span>
                  <span>
                    {trip ? (
                      <>
                        <span className={`badge s-${trip.status.toLowerCase()}`}>
                          {statusLabel(trip.status)}
                        </span>
                        <small>
                          {trip.destination}
                          {trip.latestLocation
                            ? ` · GPS ${timeAgo(trip.latestLocation.recordedAt)}`
                            : ''}
                        </small>
                      </>
                    ) : driver.user.isActive ? (
                      <span className="badge badge-neutral">Available</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {directory && directory.totalPages > 1 && (
          <nav className="pagination" aria-label="Pages">
            <span className="muted small">
              {(directory.page - 1) * directory.pageSize + 1}–
              {Math.min(directory.page * directory.pageSize, directory.total)} of {directory.total}
            </span>
            <div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={directory.page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Prev
              </button>
              <span className="small">
                {directory.page} / {directory.totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={directory.page === directory.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </div>
          </nav>
        )}
      </section>

      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.user.firstName} ${selected.user.lastName}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <span className={`avatar avatar-lg ${selected.user.isActive ? '' : 'avatar-muted'}`}>
                {initials(selected)}
              </span>
              <div>
                <h2>
                  {selected.user.firstName} {selected.user.lastName}
                </h2>
                <span className={`badge ${selected.user.isActive ? 's-delivered' : 'badge-danger'}`}>
                  {selected.user.isActive ? 'Active account' : 'Inactive account'}
                </span>
              </div>
              <button className="icon-btn" aria-label="Close" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>

            <dl className="details">
              {(
                [
                  ['Phone', selected.phone, `tel:${selected.phone}`],
                  ['Email', selected.user.email, `mailto:${selected.user.email}`],
                  ['Truck plate', selected.truckPlate, null],
                  ['Licence', selected.licenseNumber, null],
                ] as const
              ).map(([term, value, href]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>
                    {href ? <a href={href}>{value}</a> : <span>{value}</span>}
                    <button className="btn btn-ghost btn-xs" onClick={() => void copy(value)}>
                      {copied === value ? 'Copied ✓' : 'Copy'}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>

            <h3 className="drawer-title">Current trip</h3>
            {selectedTrip ? (
              <div className="trip-card">
                <div>
                  <strong className="mono">{selectedTrip.deliveryNumber}</strong>
                  <span className={`badge s-${selectedTrip.status.toLowerCase()}`}>
                    {statusLabel(selectedTrip.status)}
                  </span>
                </div>
                <p>
                  {selectedTrip.origin} → {selectedTrip.destination}
                </p>
                <small>
                  {Number(selectedTrip.quantityLiters).toLocaleString()} L {selectedTrip.fuelProduct}
                  {selectedTrip.latestLocation &&
                    ` · Last GPS ${timeAgo(selectedTrip.latestLocation.recordedAt)}`}
                </small>
                <Link className="btn btn-light btn-sm" href="/dashboard">
                  Open live map →
                </Link>
              </div>
            ) : (
              <p className="muted small">No active trip — this driver is free for a new delivery.</p>
            )}

            <h3 className="drawer-title">Recent deliveries</h3>
            {history.length ? (
              <ul className="history">
                {history.slice(0, 8).map((delivery) => (
                  <li key={delivery.id}>
                    <div>
                      <strong className="mono">{delivery.deliveryNumber}</strong>
                      <small>
                        {delivery.origin} → {delivery.destination}
                      </small>
                    </div>
                    <div className="right">
                      <span className={`badge s-${delivery.status.toLowerCase()}`}>
                        {statusLabel(delivery.status)}
                      </span>
                      <small>{timeAgo(delivery.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No deliveries recorded yet.</p>
            )}
          </aside>
        </div>
      )}

      <CreateDriverModal
        open={modalOpen}
        onClose={closeModal}
        onCreated={(name) => {
          setToast(`Driver ${name} created — share the credentials securely`);
          void loadDirectory();
        }}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </AdminShell>
  );
}
