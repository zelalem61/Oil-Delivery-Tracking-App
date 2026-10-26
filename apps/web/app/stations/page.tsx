'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '../components/admin-shell';
import { request, roleLabels, timeAgo, tokenRole } from '../lib/api';
import { isLow, liters, type Staff, type Station } from '../lib/stations';
import { FuelBar } from './fuel-bar';
import { CreateStaffModal, CreateStationModal } from './station-modals';

export default function StationsPage() {
  const [role, setRole] = useState('');
  const [stations, setStations] = useState<Station[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'station' | 'staff' | null>(null);
  const [toast, setToast] = useState('');
  const isAdmin = role === 'ADMIN';

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await request<Station[]>('/stations');
      // A station manager only has one station: go straight to it.
      if (tokenRole() === 'STATION_MANAGER' && rows.length === 1) {
        location.replace(`/stations/${rows[0]!.id}`);
        return;
      }
      setStations(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load stations');
    }
  }, []);

  const loadStaff = useCallback(async () => {
    if (tokenRole() !== 'ADMIN') return;
    setStaff(await request<Staff[]>('/staff').catch(() => []));
  }, []);

  useEffect(() => {
    setRole(tokenRole());
    void load();
    void loadStaff();
  }, [load, loadStaff]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !stations) return stations ?? [];
    return stations.filter((station) =>
      [station.name, station.code, station.location ?? ''].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [stations, search]);

  const active = stations?.filter((station) => station.isActive) ?? [];
  const reported = active.filter((station) => station.todayReport).length;
  const soldToday = active.reduce((sum, station) => sum + station.soldTodayLiters, 0);
  const lowFuels = active.flatMap((station) =>
    station.fuels.filter(isLow).map((fuel) => `${station.name} · ${fuel.label}`),
  );

  return (
    <AdminShell
      title="Stations"
      subtitle="Daily fuel sales and remaining stock at every station."
      actions={
        isAdmin ? (
          <>
            <button className="btn btn-ghost" onClick={() => setModal('staff')}>
              + Staff account
            </button>
            <button className="btn btn-primary" onClick={() => setModal('station')}>
              + New station
            </button>
          </>
        ) : null
      }
    >
      <section className="kpis kpis-4">
        <div className="kpi">
          <span>Active stations</span>
          <strong>{stations ? active.length : '–'}</strong>
          <small>{stations ? `${stations.length - active.length} inactive` : ''}</small>
        </div>
        <div className="kpi kpi-blue">
          <span>Sold today</span>
          <strong>
            {stations ? soldToday.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '–'}
            <span className="kpi-unit">L</span>
          </strong>
          <small>All fuels, all stations</small>
        </div>
        <div className={`kpi ${stations && reported < active.length ? 'kpi-amber' : ''}`}>
          <span>Reports in today</span>
          <strong>
            {stations ? reported : '–'}
            <span className="kpi-unit">/ {active.length}</span>
          </strong>
          <small>
            {stations && reported < active.length
              ? `${active.length - reported} station${active.length - reported === 1 ? '' : 's'} not reported`
              : 'Every station has reported'}
          </small>
        </div>
        <div className={`kpi ${lowFuels.length ? 'kpi-red' : ''}`}>
          <span>Low stock</span>
          <strong>{stations ? lowFuels.length : '–'}</strong>
          <small title={lowFuels.join('\n')}>
            {lowFuels.length
              ? lowFuels.slice(0, 2).join(', ') + (lowFuels.length > 2 ? '…' : '')
              : 'Under 3 days of sales'}
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head wrap">
          <div>
            <h2>All stations</h2>
            <p className="muted small">
              Stock = opening stock + approved deliveries − liters sold.
            </p>
          </div>
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, code or town"
              aria-label="Search stations"
            />
          </div>
        </div>

        {error ? (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : null}

        {!stations && !error ? (
          <div className="st-grid">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="st-card skeleton-card" key={index} />
            ))}
          </div>
        ) : stations && !visible.length ? (
          <div className="empty">
            <div className="empty-icon">⛽</div>
            <strong>{stations.length ? 'No stations match your search' : 'No stations yet'}</strong>
            <p>
              {stations.length
                ? 'Try another name or code.'
                : isAdmin
                  ? 'Add a station with its fuels and opening stock to start tracking sales.'
                  : 'An administrator has not added any stations yet.'}
            </p>
            {isAdmin && !stations.length ? (
              <button className="btn btn-primary" onClick={() => setModal('station')}>
                + New station
              </button>
            ) : null}
          </div>
        ) : (
          <div className="st-grid">
            {visible.map((station) => (
              <Link key={station.id} href={`/stations/${station.id}`} className="st-card">
                <div className="st-card-head">
                  <div>
                    <strong>{station.name}</strong>
                    <small>
                      <span className="mono">{station.code}</span>
                      {station.location ? ` · ${station.location}` : ''}
                    </small>
                  </div>
                  {!station.isActive ? (
                    <span className="badge">Inactive</span>
                  ) : station.todayReport ? (
                    <span className="badge s-approved">Reported</span>
                  ) : (
                    <span className="badge s-pending">No report today</span>
                  )}
                </div>
                <div className="st-fuels">
                  {station.fuels.map((fuel) => (
                    <FuelBar key={fuel.id} fuel={fuel} compact />
                  ))}
                </div>
                <div className="st-card-foot">
                  <span>
                    Sold today <strong>{liters(station.soldTodayLiters)}</strong>
                  </span>
                  <span className="muted">
                    {station.todayReport
                      ? `by ${station.todayReport.submittedBy.firstName} · ${timeAgo(station.todayReport.updatedAt)}`
                      : station.lastReportDate
                        ? `Last report ${station.lastReportDate}`
                        : 'No reports yet'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isAdmin ? (
        <section className="panel st-section">
          <div className="panel-head">
            <div>
              <h2>Staff accounts</h2>
              <p className="muted small">
                Station managers submit daily sales for their station. Operations managers monitor
                every station.
              </p>
            </div>
            <span className="count">{staff.length}</span>
          </div>
          {staff.length ? (
            <div className="table">
              <div className="trow staff-row thead">
                <span>Name</span>
                <span>Role</span>
                <span>Station</span>
                <span>Last sign-in</span>
              </div>
              {staff.map((person) => (
                <div className="trow staff-row" key={person.id}>
                  <span>
                    <strong>
                      {person.firstName} {person.lastName}
                    </strong>
                    <small>{person.email}</small>
                  </span>
                  <span>{roleLabels[person.role]}</span>
                  <span>
                    {person.station ? (
                      person.station.name
                    ) : (
                      <span className="muted">All stations</span>
                    )}
                  </span>
                  <span className="muted">
                    {person.lastLoginAt ? timeAgo(person.lastLoginAt) : 'Never'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No staff accounts yet. Use “+ Staff account” to add one.</p>
          )}
        </section>
      ) : null}

      <CreateStationModal
        open={modal === 'station'}
        onClose={() => setModal(null)}
        onCreated={(station) => {
          setToast(`${station.name} added`);
          void load();
        }}
      />
      <CreateStaffModal
        open={modal === 'staff'}
        stations={stations ?? []}
        onClose={() => setModal(null)}
        onCreated={(name) => {
          setToast(`Account created for ${name}`);
          void loadStaff();
        }}
      />

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </AdminShell>
  );
}
