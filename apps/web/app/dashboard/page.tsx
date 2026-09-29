'use client';

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
import { DriverMap } from './driver-map';

type Incident = {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  description: string;
  latitude: number | null;
  longitude: number | null;
  reportedAt: string;
  createdAt: string;
  delivery: { id: string; deliveryNumber: string; destination: string; truckPlate: string; status: string };
  reportedBy: { firstName: string; lastName: string; phone?: string | null };
};

const incidentTypes: Record<string, { label: string; icon: string }> = {
  BREAKDOWN: { label: 'Breakdown', icon: '🔧' },
  ACCIDENT: { label: 'Accident', icon: '💥' },
  TIRE_PROBLEM: { label: 'Tyre problem', icon: '🛞' },
  FUEL_LEAK: { label: 'Fuel leak', icon: '🛢️' },
  CUSTOMS_DELAY: { label: 'Customs delay', icon: '🛃' },
  SECURITY_ISSUE: { label: 'Security issue', icon: '🛡️' },
  MEDICAL_EMERGENCY: { label: 'Medical emergency', icon: '🩺' },
  ROUTE_BLOCKED: { label: 'Road blocked', icon: '🚧' },
  OTHER: { label: 'Other', icon: '📝' },
};
const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

const pipeline = [
  'CREATED',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED',
  'UNLOADING',
  'AWAITING_DELIVERY_APPROVAL',
];
const allStatuses = [...pipeline, 'DELIVERED', 'CANCELLED'];

export default function Dashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirming, setConfirming] = useState<Delivery | null>(null);
  const [approving, setApproving] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resolving, setResolving] = useState<Incident | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [incidentBusy, setIncidentBusy] = useState<string | null>(null);
  const knownIncidents = useRef<Set<string> | null>(null);

  const loadIncidents = useCallback(async () => {
    const result = await request<Incident[]>('/incidents');
    const rows = Array.isArray(result) ? result : [];
    const known = knownIncidents.current;
    if (known) {
      const fresh = rows.filter((row) => !known.has(row.id));
      if (fresh.length) {
        const first = fresh[0]!;
        setToast(
          `⚠ New incident: ${incidentTypes[first.type]?.label ?? first.type} — ${first.delivery.deliveryNumber}`,
        );
      }
    }
    knownIncidents.current = new Set(rows.map((row) => row.id));
    setIncidents(rows);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      const [driverRows, deliveryRows] = await Promise.all([
        request<Driver[]>('/drivers'),
        request<Delivery[]>('/deliveries'),
      ]);
      setDrivers(driverRows);
      setDeliveries(deliveryRows);
      await loadIncidents().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadIncidents]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void request<Delivery[]>('/deliveries')
        .then(setDeliveries)
        .catch(() => undefined);
      void loadIncidents().catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [refresh, loadIncidents]);

  async function updateIncident(incident: Incident, status: 'ACKNOWLEDGED' | 'RESOLVED', note?: string) {
    setIncidentBusy(incident.id);
    try {
      await request(`/incidents/${incident.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: note?.trim() || undefined }),
      });
      setToast(
        status === 'RESOLVED'
          ? `Incident on ${incident.delivery.deliveryNumber} resolved`
          : `Incident on ${incident.delivery.deliveryNumber} acknowledged`,
      );
      setResolving(null);
      setResolutionNote('');
      await loadIncidents();
      void request<Delivery[]>('/deliveries').then(setDeliveries).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update incident');
    } finally {
      setIncidentBusy(null);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const active = useMemo(
    () => deliveries.filter((delivery) => !closedStatuses.includes(delivery.status)),
    [deliveries],
  );
  const sortedIncidents = [...incidents].sort(
    (a, b) =>
      (a.status === 'OPEN' ? 0 : 1) - (b.status === 'OPEN' ? 0 : 1) ||
      severityRank[a.severity] - severityRank[b.severity] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const openIncidentCount = incidents.filter((incident) => incident.status === 'OPEN').length;
  const awaiting = active.filter((delivery) => delivery.status === 'AWAITING_DELIVERY_APPROVAL');
  const inTransit = active.filter((delivery) => delivery.status === 'IN_TRANSIT');
  const delivered = deliveries.filter((delivery) => delivery.status === 'DELIVERED');
  const litresMoving = active.reduce((sum, delivery) => sum + Number(delivery.quantityLiters), 0);
  const reporting = active.filter((delivery) => delivery.latestLocation).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return deliveries.filter((delivery) => {
      const haystack = [
        delivery.driver?.firstName,
        delivery.driver?.lastName,
        delivery.deliveryNumber,
        delivery.truckPlate,
        delivery.destination,
        delivery.origin,
      ]
        .join(' ')
        .toLowerCase();
      const statusOk =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE'
          ? !closedStatuses.includes(delivery.status)
          : delivery.status === statusFilter);
      return statusOk && (!query || haystack.includes(query));
    });
  }, [deliveries, search, statusFilter]);

  function focusOnMap(delivery: Delivery) {
    if (closedStatuses.includes(delivery.status)) return;
    setSelectedId(delivery.id);
    document
      .getElementById('driver-map-panel')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function approve() {
    if (!confirming) return;
    setApproving(true);
    try {
      await request(`/deliveries/${confirming.id}/approve-delivered`, { method: 'POST' });
      setToast(`${confirming.deliveryNumber} marked as delivered`);
      setConfirming(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to approve delivery');
      setConfirming(null);
    } finally {
      setApproving(false);
    }
  }

  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <AdminShell
      title="Operations overview"
      subtitle="Live fleet status across the Djibouti – Ethiopia corridor."
      actions={
        <>
          <button className="btn btn-ghost" onClick={() => void refresh()} disabled={refreshing}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className={refreshing ? 'spin' : ''}>
              <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
            </svg>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
            + New driver
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <section className="kpis">
        <Kpi label="Active trips" value={active.length} hint={`${reporting} sending GPS`} />
        <Kpi label="In transit" value={inTransit.length} tone="blue" hint="On the road now" />
        <Kpi
          label="Awaiting approval"
          value={awaiting.length}
          tone="amber"
          hint={awaiting.length ? 'Needs your review' : 'All clear'}
        />
        <Kpi
          label="Fuel on the move"
          value={`${litresMoving.toLocaleString()} L`}
          hint={`${delivered.length} delivered to date`}
        />
        <Kpi
          label="Open incidents"
          value={incidents.length}
          tone={incidents.length ? 'red' : undefined}
          hint={
            incidents.length
              ? `${openIncidentCount} new · ${incidents.length - openIncidentCount} in progress`
              : `No active issues · ${drivers.length} drivers`
          }
        />
      </section>

      <section className="overview-grid">
        <div className="map-wrap">
          <DriverMap deliveries={active} selectedDeliveryId={selectedId} />
        </div>
        <div className="side-stack">
          <article className={`panel incidents-panel ${incidents.length ? 'has-incidents' : ''}`}>
            <div className="panel-head">
              <h2>Incidents</h2>
              <span className={`count ${incidents.length ? 'count-red' : ''}`}>{incidents.length}</span>
            </div>
            {sortedIncidents.length ? (
              <ul className="incident-list">
                {sortedIncidents.map((incident) => {
                  const kind = incidentTypes[incident.type] ?? { label: incident.type, icon: '⚠' };
                  return (
                    <li key={incident.id} className={`incident sev-${incident.severity.toLowerCase()}`}>
                      <div className="incident-top">
                        <span className="incident-kind">
                          <span className="incident-icon">{kind.icon}</span>
                          <strong>{kind.label}</strong>
                        </span>
                        <span className={`sev sev-${incident.severity.toLowerCase()}`}>
                          {statusLabel(incident.severity)}
                        </span>
                      </div>
                      <p className="incident-desc">{incident.description}</p>
                      <small className="incident-meta">
                        <button
                          className="link-btn"
                          onClick={() => {
                            const delivery = deliveries.find((row) => row.id === incident.delivery.id);
                            if (delivery) focusOnMap(delivery);
                          }}
                        >
                          {incident.delivery.deliveryNumber}
                        </button>{' '}
                        · {incident.reportedBy.firstName} {incident.reportedBy.lastName} ·{' '}
                        {timeAgo(incident.reportedAt)}
                        {incident.status === 'ACKNOWLEDGED' ? ' · Acknowledged' : ''}
                      </small>
                      <div className="incident-actions">
                        {incident.reportedBy.phone ? (
                          <a className="btn btn-ghost btn-xs" href={`tel:${incident.reportedBy.phone}`}>
                            Call driver
                          </a>
                        ) : null}
                        {incident.status === 'OPEN' ? (
                          <button
                            className="btn btn-ghost btn-xs"
                            disabled={incidentBusy === incident.id}
                            onClick={() => void updateIncident(incident, 'ACKNOWLEDGED')}
                          >
                            Acknowledge
                          </button>
                        ) : null}
                        <button
                          className="btn btn-primary btn-xs"
                          disabled={incidentBusy === incident.id}
                          onClick={() => {
                            setResolutionNote('');
                            setResolving(incident);
                          }}
                        >
                          Resolve
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small">No active incidents. Driver reports appear here instantly.</p>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Needs approval</h2>
              <span className={`count ${awaiting.length ? 'count-amber' : ''}`}>
                {awaiting.length}
              </span>
            </div>
            {awaiting.length ? (
              <ul className="approval-list">
                {awaiting.map((delivery) => (
                  <li key={delivery.id}>
                    <div>
                      <strong>{delivery.deliveryNumber}</strong>
                      <small>
                        {delivery.driver?.firstName} {delivery.driver?.lastName} ·{' '}
                        {delivery.destination}
                      </small>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setConfirming(delivery)}>
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">No deliveries are waiting. Drivers request approval after unloading.</p>
            )}
          </article>

          <article className="panel">
            <div className="panel-head">
              <h2>Trip pipeline</h2>
              <span className="muted small">{active.length} active</span>
            </div>
            <ul className="pipeline">
              {pipeline.map((status) => {
                const count = active.filter((delivery) => delivery.status === status).length;
                const width = active.length ? (count / active.length) * 100 : 0;
                return (
                  <li key={status}>
                    <span>{status === 'AWAITING_DELIVERY_APPROVAL' ? 'Awaiting approval' : statusLabel(status)}</span>
                    <span className="bar">
                      <span className={`fill s-${status.toLowerCase()}`} style={{ width: `${width}%` }} />
                    </span>
                    <strong>{count}</strong>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head wrap">
          <div>
            <h2>Deliveries</h2>
            <p className="muted small">Click an active trip to locate it on the map.</p>
          </div>
          <div className="filters">
            <div className="search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Driver, trip no., plate, place"
                aria-label="Search deliveries"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Status filter"
            >
              <option value="ACTIVE">Active trips</option>
              <option value="ALL">All statuses</option>
              {allStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="table">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="trow skeleton" key={index}>
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="empty">
            <div className="empty-icon">⛽</div>
            <strong>{deliveries.length ? 'No matching deliveries' : 'No deliveries yet'}</strong>
            <p>
              {deliveries.length
                ? 'Try another search or status.'
                : 'A driver creates the first trip from the mobile app.'}
            </p>
          </div>
        ) : (
          <div className="table">
            <div className="trow thead">
              <span>Trip</span>
              <span>Driver</span>
              <span>Route</span>
              <span>Status</span>
              <span className="right">Load</span>
            </div>
            {filtered.map((delivery) => {
              const clickable = !closedStatuses.includes(delivery.status);
              return (
                <div
                  key={delivery.id}
                  className={`trow ${clickable ? 'clickable' : ''} ${selectedId === delivery.id ? 'selected' : ''}`}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => focusOnMap(delivery)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      focusOnMap(delivery);
                    }
                  }}
                >
                  <span>
                    <strong className="mono">{delivery.deliveryNumber}</strong>
                    <small>{timeAgo(delivery.updatedAt ?? delivery.createdAt)}</small>
                  </span>
                  <span>
                    <strong>
                      {delivery.driver
                        ? `${delivery.driver.firstName} ${delivery.driver.lastName}`
                        : 'Unassigned'}
                    </strong>
                    <small>
                      <span className="plate">{delivery.truckPlate}</span>
                    </small>
                  </span>
                  <span>
                    <span className="route">
                      {delivery.origin} <em>→</em> {delivery.destination}
                    </span>
                    <small>
                      {delivery.latestLocation
                        ? `GPS ${timeAgo(delivery.latestLocation.recordedAt)}`
                        : clickable
                          ? 'Waiting for GPS'
                          : ''}
                    </small>
                  </span>
                  <span>
                    <span className={`badge s-${delivery.status.toLowerCase()}`}>
                      {statusLabel(delivery.status)}
                    </span>
                    {(delivery as Delivery & { openIncidents?: number }).openIncidents ? (
                      <small className="incident-chip">
                        ⚠ {(delivery as Delivery & { openIncidents?: number }).openIncidents} incident
                        {(delivery as Delivery & { openIncidents?: number }).openIncidents === 1 ? '' : 's'}
                      </small>
                    ) : null}
                  </span>
                  <span className="right">
                    {delivery.status === 'AWAITING_DELIVERY_APPROVAL' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirming(delivery);
                        }}
                      >
                        Approve
                      </button>
                    ) : (
                      <>
                        <strong>{Number(delivery.quantityLiters).toLocaleString()} L</strong>
                        <small>{delivery.fuelProduct}</small>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {confirming && (
        <div className="modal-backdrop" onMouseDown={() => !approving && setConfirming(null)}>
          <div
            className="modal modal-sm"
            role="alertdialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Approve delivery?</h2>
            <p className="muted">
              Mark <strong>{confirming.deliveryNumber}</strong> —{' '}
              {Number(confirming.quantityLiters).toLocaleString()} L of {confirming.fuelProduct} to{' '}
              {confirming.destination} — as <strong>Delivered</strong>. This is the final step and
              ends GPS tracking for the trip.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirming(null)} disabled={approving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void approve()} disabled={approving}>
                {approving ? 'Approving…' : 'Approve delivered'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolving && (
        <div className="modal-backdrop" onMouseDown={() => !incidentBusy && setResolving(null)}>
          <div
            className="modal modal-sm"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Resolve incident</h2>
            <p className="muted">
              {incidentTypes[resolving.type]?.icon} {incidentTypes[resolving.type]?.label ?? resolving.type} on{' '}
              <strong>{resolving.delivery.deliveryNumber}</strong> reported by{' '}
              {resolving.reportedBy.firstName} {resolving.reportedBy.lastName}.
            </p>
            <label className="resolve-note">
              Resolution note (optional)
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                placeholder="e.g. Replacement tyre fitted, truck continuing"
              />
            </label>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setResolving(null)}
                disabled={incidentBusy === resolving.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void updateIncident(resolving, 'RESOLVED', resolutionNote)}
                disabled={incidentBusy === resolving.id}
              >
                {incidentBusy === resolving.id ? 'Resolving…' : 'Mark resolved'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateDriverModal
        open={modalOpen}
        onClose={closeModal}
        onCreated={(name) => {
          setToast(`Driver ${name} created — share the credentials securely`);
          void refresh();
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

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'blue' | 'amber' | 'red';
}) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
