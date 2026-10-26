'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { request, timeAgo, tokenRole } from '../../lib/api';
import {
  addDays,
  dayLabel,
  liters,
  MANAGER_EDIT_DAYS,
  signedLiters,
  type History,
  type Station,
  type StationFuel,
} from '../../lib/stations';
import { FuelBar } from '../fuel-bar';
import { CreateStaffModal, FuelModal } from '../station-modals';

type Range = { from: string; to: string };
type Draft = Record<string, { sold: string; measured: string }>;

export default function StationPage() {
  const { id } = useParams<{ id: string }>();
  const [role, setRole] = useState('');
  const [station, setStation] = useState<Station | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [fuelModal, setFuelModal] = useState<{ fuel: StationFuel | null } | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  const loadStation = useCallback(async () => {
    try {
      const row = await request<Station>(`/stations/${id}`);
      setStation(row);
      setRange((current) => current ?? { from: addDays(row.today, -13), to: row.today });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the station');
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    if (!range) return;
    try {
      setHistory(
        await request<History>(`/stations/${id}/history?from=${range.from}&to=${range.to}`),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the sales history');
    }
  }, [id, range]);

  useEffect(() => {
    setRole(tokenRole());
    void loadStation();
  }, [loadStation]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const canSubmit = role === 'ADMIN' || role === 'STATION_MANAGER';
  const isAdmin = role === 'ADMIN';
  const refresh = () => {
    void loadStation();
    void loadHistory();
  };

  function exportCsv() {
    if (!history || !station) return;
    const fuels = station.fuels;
    const header = [
      'Date',
      ...fuels.flatMap((fuel) => [
        `${fuel.label} sold (L)`,
        `${fuel.label} received (L)`,
        `${fuel.label} closing stock (L)`,
        `${fuel.label} tank reading (L)`,
        `${fuel.label} difference (L)`,
      ]),
      'Total sold (L)',
      'Submitted by',
      'Note',
    ];
    const escape = (value: string | number | null) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [...history.rows].reverse().map((row) =>
      [
        row.date,
        ...fuels.flatMap((fuel) => {
          const cell = row.fuels.find((item) => item.product === fuel.product);
          return [
            cell?.soldLiters ?? '',
            cell?.receivedLiters ?? '',
            cell?.closingStockLiters ?? '',
            cell?.measuredStockLiters ?? '',
            cell?.varianceLiters ?? '',
          ];
        }),
        row.report ? row.totalSoldLiters : '',
        row.report
          ? `${row.report.submittedBy.firstName} ${row.report.submittedBy.lastName}`
          : 'Not submitted',
        row.report?.note ?? '',
      ]
        .map(escape)
        .join(','),
    );
    const blob = new Blob([[header.map(escape).join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${station.code}-sales-${history.from}-to-${history.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error && !station)
    return (
      <AdminShell title="Station">
        <div className="alert alert-error" role="alert">
          <span>{error}</span>
          <Link className="btn btn-ghost btn-sm" href="/stations">
            Back to stations
          </Link>
        </div>
      </AdminShell>
    );

  return (
    <AdminShell
      title={station?.name ?? 'Station'}
      subtitle={
        station
          ? `${station.code}${station.location ? ` · ${station.location}` : ''}${station.isActive ? '' : ' · Inactive'}`
          : 'Loading…'
      }
      actions={
        <>
          {role !== 'STATION_MANAGER' ? (
            <Link className="btn btn-ghost" href="/stations">
              ← All stations
            </Link>
          ) : null}
          {isAdmin && station ? (
            <button className="btn btn-ghost" onClick={() => setFuelModal({ fuel: null })}>
              + Add fuel
            </button>
          ) : null}
        </>
      }
    >
      <section className="st-fuel-cards">
        {station
          ? station.fuels.map((fuel) => (
              <div className="panel st-fuel-card" key={fuel.id}>
                <FuelBar fuel={fuel} />
                <dl className="st-fuel-stats">
                  <div>
                    <dt>Sold today</dt>
                    <dd>{liters(fuel.soldTodayLiters)}</dd>
                  </div>
                  <div>
                    <dt>Avg per day</dt>
                    <dd>{liters(fuel.averageDailySoldLiters)}</dd>
                  </div>
                  <div>
                    <dt>Received</dt>
                    <dd>{liters(fuel.receivedLiters)}</dd>
                  </div>
                </dl>
                <div className="st-fuel-foot">
                  <small className="muted">
                    Counted {liters(fuel.openingStockLiters)} on {fuel.openingDate}
                  </small>
                  {isAdmin ? (
                    <button className="link-btn" onClick={() => setFuelModal({ fuel })}>
                      Recount
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          : Array.from({ length: 3 }, (_, index) => (
              <div className="panel st-fuel-card skeleton-card" key={index} />
            ))}
      </section>

      {station && canSubmit && station.fuels.length ? (
        <ReportForm
          station={station}
          role={role}
          date={editingDate ?? station.today}
          onDateChange={setEditingDate}
          onSaved={(message) => {
            setToast(message);
            refresh();
          }}
        />
      ) : null}

      <section className="panel st-section">
        <div className="panel-head wrap">
          <div>
            <h2>Sales history</h2>
            <p className="muted small">
              {history
                ? `${history.reportedDays} of ${history.expectedDays} days reported · closing stock is calculated`
                : 'Loading…'}
            </p>
          </div>
          <div className="mt-range">
            <label>
              From
              <input
                type="date"
                value={range?.from ?? ''}
                max={range?.to}
                onChange={(event) =>
                  event.target.value &&
                  setRange((current) => current && { ...current, from: event.target.value })
                }
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={range?.to ?? ''}
                min={range?.from}
                max={station?.today}
                onChange={(event) =>
                  event.target.value &&
                  setRange((current) => current && { ...current, to: event.target.value })
                }
              />
            </label>
            <div className="mt-presets">
              {station
                ? (
                    [
                      ['7 days', 6],
                      ['30 days', 29],
                      ['90 days', 89],
                    ] as const
                  ).map(([label, days]) => (
                    <button
                      key={label}
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        setRange({ from: addDays(station.today, -days), to: station.today })
                      }
                    >
                      {label}
                    </button>
                  ))
                : null}
              <button
                className="btn btn-ghost btn-xs"
                onClick={exportCsv}
                disabled={!history?.rows.length}
              >
                ⬇ CSV
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="alert alert-error">{error}</p> : null}

        {history?.totals.length ? (
          <div className="st-totals">
            {history.totals.map((total) => (
              <div key={total.product}>
                <span className={`fuel-name f-${total.product.toLowerCase()}`}>{total.label}</span>
                <strong>{liters(total.soldLiters)}</strong>
                <small>
                  sold · avg {liters(total.averageDailySoldLiters)}/day
                  {total.receivedLiters ? ` · received ${liters(total.receivedLiters)}` : ''}
                </small>
              </div>
            ))}
          </div>
        ) : null}

        {history && station ? (
          history.rows.length ? (
            <LedgerTable
              station={station}
              history={history}
              canEdit={(date) =>
                canSubmit && (isAdmin || date >= addDays(station.today, -MANAGER_EDIT_DAYS))
              }
              onEdit={(date) => {
                setEditingDate(date);
                document.getElementById('daily-report')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ) : (
            <div className="empty">
              <div className="empty-icon">📒</div>
              <strong>No days in this range</strong>
              <p>Stock tracking starts on the date each fuel was first counted.</p>
            </div>
          )
        ) : null}
      </section>

      {station && role !== 'STATION_MANAGER' ? (
        <section className="panel st-section">
          <div className="panel-head">
            <div>
              <h2>Station managers</h2>
              <p className="muted small">They submit this station’s daily sales.</p>
            </div>
            {isAdmin ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setStaffOpen(true)}>
                + Add manager
              </button>
            ) : null}
          </div>
          {station.managers.length ? (
            <ul className="st-managers">
              {station.managers.map((manager) => (
                <li key={manager.id}>
                  <span className="avatar">{manager.firstName[0]}</span>
                  <span>
                    <strong>
                      {manager.firstName} {manager.lastName}
                    </strong>
                    <small>
                      {manager.email}
                      {manager.phone ? ` · ${manager.phone}` : ''}
                    </small>
                  </span>
                  {manager.phone ? (
                    <a className="btn btn-ghost btn-xs" href={`tel:${manager.phone}`}>
                      Call
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No manager assigned yet.</p>
          )}
        </section>
      ) : null}

      {station ? (
        <>
          <FuelModal
            open={Boolean(fuelModal)}
            stationId={station.id}
            fuel={fuelModal?.fuel ?? null}
            existing={station.fuels.map((fuel) => fuel.product)}
            onClose={() => setFuelModal(null)}
            onSaved={(message) => {
              setToast(message);
              refresh();
            }}
          />
          <CreateStaffModal
            open={staffOpen}
            stations={[station]}
            defaultStationId={station.id}
            onClose={() => setStaffOpen(false)}
            onCreated={(name) => {
              setToast(`${name} can now sign in as a station manager`);
              void loadStation();
            }}
          />
        </>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </AdminShell>
  );
}

function ReportForm({
  station,
  role,
  date,
  onDateChange,
  onSaved,
}: {
  station: Station;
  role: string;
  date: string;
  onDateChange(date: string): void;
  onSaved(message: string): void;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<History['rows'][number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const minDate = role === 'ADMIN' ? undefined : addDays(station.today, -MANAGER_EDIT_DAYS);
  const fuels = useMemo(
    () => station.fuels.filter((fuel) => fuel.openingDate <= date),
    [station.fuels, date],
  );

  // Prefill with what was already reported for the chosen date.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void request<History>(`/stations/${station.id}/history?from=${date}&to=${date}`)
      .then((result) => {
        if (cancelled) return;
        const row = result.rows[0] ?? null;
        setExisting(row?.report ? row : null);
        setNote(row?.report?.note ?? '');
        setDraft(
          Object.fromEntries(
            station.fuels.map((fuel) => {
              const cell = row?.report
                ? row.fuels.find((item) => item.product === fuel.product)
                : null;
              return [
                fuel.product,
                {
                  sold: cell?.soldLiters == null ? '' : String(cell.soldLiters),
                  measured:
                    cell?.measuredStockLiters == null ? '' : String(cell.measuredStockLiters),
                },
              ];
            }),
          ),
        );
      })
      .catch(
        (cause) =>
          !cancelled && setError(cause instanceof Error ? cause.message : 'Unable to load'),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [station.id, station.fuels, date]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const lines = fuels.map((fuel) => {
      const value = draft[fuel.product] ?? { sold: '', measured: '' };
      return {
        product: fuel.product,
        litersSold: Number(value.sold || 0),
        measuredStockLiters: value.measured.trim() ? Number(value.measured) : undefined,
      };
    });
    if (!lines.length) {
      setError('No fuel was being tracked on this date.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await request(`/stations/${station.id}/reports/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ lines, note: note.trim() || undefined }),
      });
      onSaved(`${existing ? 'Updated' : 'Submitted'} sales for ${dayLabel(date)}`);
      onDateChange(station.today);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the report');
    } finally {
      setSaving(false);
    }
  }

  const total = fuels.reduce((sum, fuel) => sum + Number(draft[fuel.product]?.sold || 0), 0);

  return (
    <section className="panel st-section" id="daily-report">
      <form onSubmit={submit}>
        <div className="panel-head wrap">
          <div>
            <h2>{date === station.today ? 'Today’s sales' : `Sales for ${dayLabel(date)}`}</h2>
            <p className="muted small">
              {existing
                ? `Submitted by ${existing.report!.submittedBy.firstName} ${existing.report!.submittedBy.lastName} · ${timeAgo(existing.report!.updatedAt)}. Saving replaces it.`
                : 'Enter the liters sold at the pumps for each fuel.'}
            </p>
          </div>
          <label className="st-date">
            Report date
            <input
              type="date"
              value={date}
              min={minDate}
              max={station.today}
              onChange={(event) => event.target.value && onDateChange(event.target.value)}
            />
          </label>
        </div>

        <div className={`st-report ${loading ? 'dim' : ''}`}>
          <div className="st-report-head">
            <span>Fuel</span>
            <span>Liters sold</span>
            <span>Tank reading at close (optional)</span>
          </div>
          {fuels.map((fuel) => (
            <div className="st-report-row" key={fuel.product}>
              <span className={`fuel-name f-${fuel.product.toLowerCase()}`}>{fuel.label}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                required
                aria-label={`${fuel.label} liters sold`}
                placeholder="0"
                value={draft[fuel.product]?.sold ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [fuel.product]: {
                      measured: '',
                      ...current[fuel.product],
                      sold: event.target.value,
                    },
                  }))
                }
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                aria-label={`${fuel.label} tank reading`}
                placeholder={
                  date === station.today
                    ? `Calculated ≈ ${Math.round(fuel.stockLiters).toLocaleString()}`
                    : 'Dip reading'
                }
                value={draft[fuel.product]?.measured ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [fuel.product]: {
                      sold: '',
                      ...current[fuel.product],
                      measured: event.target.value,
                    },
                  }))
                }
              />
            </div>
          ))}
          {!fuels.length ? (
            <p className="muted small">No fuel was being tracked on this date.</p>
          ) : null}
        </div>

        <label className="resolve-note st-note">
          Note (optional)
          <textarea
            rows={2}
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Pump 2 down for two hours"
          />
        </label>
        {error ? <p className="alert alert-error">{error}</p> : null}
        <div className="st-report-actions">
          <span className="muted">
            Total <strong>{liters(total)}</strong>
          </span>
          {date !== station.today ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onDateChange(station.today)}
            >
              Back to today
            </button>
          ) : null}
          <button className="btn btn-primary" disabled={saving || loading || !fuels.length}>
            {saving ? 'Saving…' : existing ? 'Update report' : 'Submit report'}
          </button>
        </div>
      </form>
    </section>
  );
}

function LedgerTable({
  station,
  history,
  canEdit,
  onEdit,
}: {
  station: Station;
  history: History;
  canEdit(date: string): boolean;
  onEdit(date: string): void;
}) {
  const fuels = station.fuels;
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th rowSpan={2}>Date</th>
            {fuels.map((fuel) => (
              <th
                key={fuel.product}
                colSpan={2}
                className={`group f-${fuel.product.toLowerCase()}`}
              >
                {fuel.label}
              </th>
            ))}
            <th rowSpan={2} className="right">
              Total sold
            </th>
            <th rowSpan={2}>Report</th>
          </tr>
          <tr>
            {fuels.map((fuel) => (
              <FuelSubHeads key={fuel.product} />
            ))}
          </tr>
        </thead>
        <tbody>
          {history.rows.map((row) => (
            <tr key={row.date} className={row.report ? '' : 'missing'}>
              <td>
                <strong>{dayLabel(row.date)}</strong>
                {row.deliveries.length ? (
                  <small className="ledger-delivery" title={row.deliveries.join(', ')}>
                    🚚 {row.deliveries.length} deliver{row.deliveries.length === 1 ? 'y' : 'ies'}
                  </small>
                ) : null}
              </td>
              {fuels.map((fuel) => {
                const cell = row.fuels.find((item) => item.product === fuel.product);
                if (!cell || cell.closingStockLiters === null)
                  return (
                    <td key={fuel.product} colSpan={2} className="muted center">
                      —
                    </td>
                  );
                return <FuelCells key={fuel.product} cell={cell} />;
              })}
              <td className="right">
                {row.report ? (
                  <strong>{liters(row.totalSoldLiters)}</strong>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>
                {row.report ? (
                  <span className="ledger-by" title={row.report.note ?? ''}>
                    {row.report.submittedBy.firstName}
                    {row.report.note ? ' 💬' : ''}
                  </span>
                ) : (
                  <span className="badge s-pending">Not submitted</span>
                )}
                {canEdit(row.date) ? (
                  <button className="link-btn ledger-edit" onClick={() => onEdit(row.date)}>
                    {row.report ? 'Edit' : 'Add'}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FuelSubHeads() {
  return (
    <>
      <th className="right sub">Sold</th>
      <th className="right sub">Stock</th>
    </>
  );
}

function FuelCells({ cell }: { cell: History['rows'][number]['fuels'][number] }) {
  const variance = cell.varianceLiters;
  return (
    <>
      <td className="right">
        {cell.soldLiters === null ? <span className="muted">—</span> : liters(cell.soldLiters)}
        {cell.receivedLiters ? (
          <small className="ledger-in">+{liters(cell.receivedLiters)} in</small>
        ) : null}
      </td>
      <td className={`right ${cell.closingStockLiters! < 0 ? 'neg' : ''}`}>
        {liters(cell.closingStockLiters!)}
        {variance !== null ? (
          <small
            className={`ledger-var ${Math.abs(variance) > Math.max(50, cell.closingStockLiters! * 0.005) ? 'off' : ''}`}
            title={`Tank reading ${liters(cell.measuredStockLiters!)}`}
          >
            tank {signedLiters(variance)}
          </small>
        ) : null}
      </td>
    </>
  );
}
