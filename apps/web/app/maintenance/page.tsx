'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminShell } from '../components/admin-shell';
import { request, requestBlob, statusLabel, timeAgo, type Driver } from '../lib/api';

type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number };
type MaintenanceRecord = {
  id: string;
  truckPlate: string;
  garageName: string;
  garageLocation: string | null;
  startDate: string;
  endDate: string;
  daysInGarage: number;
  workDone: string;
  costEtb: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  driver: { id: string; firstName: string; lastName: string; email: string; phone: string | null };
  reviewedBy: { firstName: string; lastName: string } | null;
  delivery: { id: string; deliveryNumber: string; origin: string; destination: string } | null;
  attachments: Attachment[];
};
type ListResponse = {
  items: MaintenanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: {
    count: number;
    totalCostEtb: number;
    averageCostEtb: number;
    maxCostEtb: number;
    byStatus: Partial<Record<'PENDING' | 'APPROVED' | 'REJECTED', { count: number; costEtb: number }>>;
  };
};

type Filters = {
  search: string;
  driverUserId: string;
  status: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
  from: string;
  to: string;
  minCost: string;
  maxCost: string;
  sort: 'date_desc' | 'date_asc' | 'cost_desc' | 'cost_asc';
};

const emptyFilters: Filters = {
  search: '',
  driverUserId: '',
  status: 'ALL',
  from: '',
  to: '',
  minCost: '',
  maxCost: '',
  sort: 'date_desc',
};

const etb = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;
const day = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
const iso = (date: Date) => date.toISOString().slice(0, 10);
const fileSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

function buildQuery(filters: Filters, page: number, pageSize = 25) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: filters.sort });
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.driverUserId) params.set('driverUserId', filters.driverUserId);
  if (filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.minCost) params.set('minCost', filters.minCost);
  if (filters.maxCost) params.set('maxCost', filters.maxCost);
  return params.toString();
}

export default function MaintenancePage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [searchDraft, setSearchDraft] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MaintenanceRecord | null>(null);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await request<ListResponse>(`/maintenance?${buildQuery(filters, page)}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load garage records');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void request<Driver[]>('/drivers')
      .then((rows) => setDrivers(Array.isArray(rows) ? rows : []))
      .catch(() => undefined);
  }, []);

  // Debounced search.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft.trim() !== filters.search.trim()) {
        setFilters((current) => ({ ...current, search: searchDraft }));
        setPage(1);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function preset(kind: 'month' | '30d' | 'year') {
    const now = new Date();
    const from =
      kind === 'month'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        : kind === 'year'
          ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
          : new Date(Date.now() - 29 * 86_400_000);
    setFilters((current) => ({ ...current, from: iso(from), to: iso(now) }));
    setPage(1);
  }

  const activeFilterCount = useMemo(
    () =>
      [
        filters.search.trim(),
        filters.driverUserId,
        filters.status !== 'ALL',
        filters.from,
        filters.to,
        filters.minCost,
        filters.maxCost,
      ].filter(Boolean).length,
    [filters],
  );

  async function exportCsv() {
    setExporting(true);
    try {
      const all = await request<ListResponse>(`/maintenance?${buildQuery(filters, 1, 200)}`);
      const header = [
        'Start date',
        'End date',
        'Days',
        'Driver',
        'Truck',
        'Garage',
        'Location',
        'Work done',
        'Cost (ETB)',
        'Status',
        'Review note',
        'Attachments',
      ];
      const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
      const lines = all.items.map((row) =>
        [
          row.startDate.slice(0, 10),
          row.endDate.slice(0, 10),
          row.daysInGarage,
          `${row.driver.firstName} ${row.driver.lastName}`,
          row.truckPlate,
          row.garageName,
          row.garageLocation ?? '',
          row.workDone,
          row.costEtb.toFixed(2),
          row.status,
          row.reviewNote ?? '',
          row.attachments.length,
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
      link.download = `garage-records-${iso(new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      if (all.total > all.items.length)
        setToast(`Exported the first ${all.items.length} of ${all.total} records`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const summary = data?.summary;
  const pending = summary?.byStatus.PENDING;
  const approved = summary?.byStatus.APPROVED;

  return (
    <AdminShell
      title="Maintenance"
      subtitle="Garage visits reported by drivers — dates, repairs, costs and receipts."
      actions={
        <button className="btn btn-ghost" onClick={() => void exportCsv()} disabled={exporting || !data?.total}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      }
    >
      <section className="kpis">
        <div className="kpi">
          <span>Total cost</span>
          <strong>{summary ? <Money value={summary.totalCostEtb} /> : '–'}</strong>
          <small>{activeFilterCount ? 'For the current filters' : 'All records'}</small>
        </div>
        <div className="kpi kpi-blue">
          <span>Records</span>
          <strong>{summary?.count ?? '–'}</strong>
          <small>{summary ? `Avg ${etb(summary.averageCostEtb)}` : ''}</small>
        </div>
        <div className="kpi kpi-amber">
          <span>Pending review</span>
          <strong>{pending?.count ?? 0}</strong>
          <small>{etb(pending?.costEtb ?? 0)} awaiting approval</small>
        </div>
        <div className="kpi">
          <span>Approved cost</span>
          <strong>
            <Money value={approved?.costEtb ?? 0} />
          </strong>
          <small>{approved?.count ?? 0} approved records</small>
        </div>
        <div className="kpi kpi-red">
          <span>Highest single repair</span>
          <strong>{summary ? <Money value={summary.maxCostEtb} /> : '–'}</strong>
          <small>In the current view</small>
        </div>
      </section>

      <section className="panel">
        <div className="mt-filters">
          <div className="search search-lg">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search garage, repair, plate or driver"
              aria-label="Search garage records"
            />
          </div>
          <select
            value={filters.driverUserId}
            onChange={(event) => update('driverUserId', event.target.value)}
            aria-label="Driver"
          >
            <option value="">All drivers</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.user.id ?? ''}>
                {driver.user.firstName} {driver.user.lastName} · {driver.truckPlate}
              </option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Status">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
              <button
                key={status}
                className={filters.status === status ? 'active' : ''}
                aria-pressed={filters.status === status}
                onClick={() => update('status', status)}
              >
                {status === 'ALL' ? 'All' : statusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-filters mt-filters-2">
          <div className="mt-range">
            <label>
              From
              <input type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={filters.to} onChange={(event) => update('to', event.target.value)} />
            </label>
            <div className="mt-presets">
              <button className="btn btn-ghost btn-xs" onClick={() => preset('month')}>This month</button>
              <button className="btn btn-ghost btn-xs" onClick={() => preset('30d')}>Last 30 days</button>
              <button className="btn btn-ghost btn-xs" onClick={() => preset('year')}>This year</button>
            </div>
          </div>
          <div className="mt-range">
            <label>
              Min cost (ETB)
              <input
                type="number"
                min={0}
                value={filters.minCost}
                onChange={(event) => update('minCost', event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Max cost (ETB)
              <input
                type="number"
                min={0}
                value={filters.maxCost}
                onChange={(event) => update('maxCost', event.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Sort by
              <select value={filters.sort} onChange={(event) => update('sort', event.target.value as Filters['sort'])}>
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="cost_desc">Highest cost</option>
                <option value="cost_asc">Lowest cost</option>
              </select>
            </label>
          </div>
          {activeFilterCount ? (
            <button
              className="btn btn-ghost btn-sm mt-clear"
              onClick={() => {
                setFilters(emptyFilters);
                setSearchDraft('');
                setPage(1);
              }}
            >
              Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="table">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="trow mt-row skeleton" key={index}>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="empty">
            <div className="empty-icon">🔧</div>
            <strong>{activeFilterCount ? 'No records match these filters' : 'No garage records yet'}</strong>
            <p>
              {activeFilterCount
                ? 'Try widening the dates or cost range.'
                : 'Drivers add garage visits from the mobile app under Garage & repairs.'}
            </p>
          </div>
        ) : (
          <div className={`table ${loading ? 'dim' : ''}`}>
            <div className="trow mt-row thead">
              <span>Dates</span>
              <span>Driver</span>
              <span>Garage</span>
              <span>Work done</span>
              <span className="right">Cost</span>
              <span>Status</span>
            </div>
            {data.items.map((record) => (
              <button
                key={record.id}
                className={`trow mt-row clickable ${selected?.id === record.id ? 'selected' : ''}`}
                onClick={() => setSelected(record)}
              >
                <span>
                  <strong>{day(record.startDate)}</strong>
                  <small>
                    → {day(record.endDate)} · {record.daysInGarage} day{record.daysInGarage === 1 ? '' : 's'}
                  </small>
                </span>
                <span>
                  <strong>
                    {record.driver.firstName} {record.driver.lastName}
                  </strong>
                  <small>
                    <span className="plate">{record.truckPlate}</span>
                  </small>
                </span>
                <span>
                  <strong className="normal">{record.garageName}</strong>
                  <small>{record.garageLocation ?? '—'}</small>
                </span>
                <span className="mt-work">
                  {record.workDone}
                  {record.attachments.length ? (
                    <small className="mt-files">📎 {record.attachments.length}</small>
                  ) : null}
                </span>
                <span className="right">
                  <strong className="mt-cost">{etb(record.costEtb)}</strong>
                </span>
                <span>
                  <span className={`badge s-${record.status.toLowerCase()}`}>{statusLabel(record.status)}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {data && data.totalPages > 1 ? (
          <nav className="pagination" aria-label="Pages">
            <span className="muted small">
              {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of{' '}
              {data.total}
            </span>
            <div>
              <button
                className="btn btn-ghost btn-sm"
                disabled={data.page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Prev
              </button>
              <span className="small">
                {data.page} / {data.totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={data.page === data.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </div>
          </nav>
        ) : null}
      </section>

      {selected ? (
        <RecordDrawer
          record={selected}
          onClose={() => setSelected(null)}
          onReviewed={(updated, message) => {
            setSelected(updated);
            setToast(message);
            void load();
          }}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </AdminShell>
  );
}

function Money({ value }: { value: number }) {
  return (
    <>
      {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      <span className="kpi-unit">ETB</span>
    </>
  );
}

function RecordDrawer({
  record,
  onClose,
  onReviewed,
}: {
  record: MaintenanceRecord;
  onClose(): void;
  onReviewed(record: MaintenanceRecord, message: string): void;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [changing, setChanging] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    setNote('');
    setError('');
    setChanging(false);
  }, [record.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load image thumbnails with the admin's token.
  useEffect(() => {
    let cancelled = false;
    for (const attachment of record.attachments) {
      if (!attachment.mimeType.startsWith('image/') || previews[attachment.id]) continue;
      void requestBlob(`/maintenance/attachments/${attachment.id}`)
        .then((blob) => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          setPreviews((current) => ({ ...current, [attachment.id]: url }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  async function open(attachment: Attachment) {
    try {
      const blob = await requestBlob(`/maintenance/attachments/${attachment.id}`);
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      window.open(url, '_blank', 'noopener');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the file');
    }
  }

  async function review(status: 'APPROVED' | 'REJECTED') {
    if (status === 'REJECTED' && !note.trim()) {
      setError('Add a note so the driver knows why the record was rejected.');
      return;
    }
    setBusy(status);
    setError('');
    try {
      const updated = await request<MaintenanceRecord>(`/maintenance/${record.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      setChanging(false);
      onReviewed(
        updated,
        status === 'APPROVED' ? 'Garage record approved' : 'Garage record rejected',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the review');
    } finally {
      setBusy(null);
    }
  }

  const reviewing = record.status === 'PENDING' || changing;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="drawer mt-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Garage record ${record.garageName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="mt-drawer-icon">🔧</div>
          <div>
            <h2>{record.garageName}</h2>
            <span className={`badge s-${record.status.toLowerCase()}`}>{statusLabel(record.status)}</span>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mt-cost-card">
          <span>Total cost</span>
          <strong>{etb(record.costEtb)}</strong>
          <small>
            {day(record.startDate)} → {day(record.endDate)} · {record.daysInGarage} day
            {record.daysInGarage === 1 ? '' : 's'} in the garage
          </small>
        </div>

        <dl className="details">
          <div>
            <dt>Driver</dt>
            <dd>
              <span>
                {record.driver.firstName} {record.driver.lastName}
              </span>
              {record.driver.phone ? (
                <a className="btn btn-ghost btn-xs" href={`tel:${record.driver.phone}`}>
                  Call
                </a>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Truck</dt>
            <dd>
              <span className="plate">{record.truckPlate}</span>
            </dd>
          </div>
          <div>
            <dt>Garage location</dt>
            <dd>{record.garageLocation ?? '—'}</dd>
          </div>
          {record.delivery ? (
            <div>
              <dt>During trip</dt>
              <dd>
                {record.delivery.deliveryNumber} · {record.delivery.origin} → {record.delivery.destination}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Submitted</dt>
            <dd>{timeAgo(record.createdAt)}</dd>
          </div>
        </dl>

        <h3 className="drawer-title">What was fixed</h3>
        <p className="mt-work-full">{record.workDone}</p>

        <h3 className="drawer-title">Attachments ({record.attachments.length})</h3>
        {record.attachments.length ? (
          <div className="mt-attachments">
            {record.attachments.map((attachment) =>
              attachment.mimeType.startsWith('image/') ? (
                <button
                  key={attachment.id}
                  className="mt-thumb"
                  onClick={() => void open(attachment)}
                  title={attachment.fileName}
                >
                  {previews[attachment.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[attachment.id]} alt={attachment.fileName} />
                  ) : (
                    <span className="mt-thumb-loading">Loading…</span>
                  )}
                </button>
              ) : (
                <button key={attachment.id} className="mt-file" onClick={() => void open(attachment)}>
                  <span className="mt-file-icon">
                    {attachment.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}
                  </span>
                  <span className="mt-file-info">
                    <strong>{attachment.fileName}</strong>
                    <small>{fileSize(attachment.sizeBytes)} · Open</small>
                  </span>
                </button>
              ),
            )}
          </div>
        ) : (
          <p className="muted small">The driver did not attach any files.</p>
        )}

        <h3 className="drawer-title">Review</h3>
        {!reviewing ? (
          <div className={`mt-review-result ${record.status === 'REJECTED' ? 'rejected' : ''}`}>
            <strong>
              {record.status === 'APPROVED' ? '✓ Approved' : '✕ Rejected'}
              {record.reviewedBy ? ` by ${record.reviewedBy.firstName} ${record.reviewedBy.lastName}` : ''}
              {record.reviewedAt ? ` · ${timeAgo(record.reviewedAt)}` : ''}
            </strong>
            {record.reviewNote ? <p>{record.reviewNote}</p> : null}
            <button className="btn btn-ghost btn-xs" onClick={() => setChanging(true)}>
              Change decision
            </button>
          </div>
        ) : (
          <div className="mt-review">
            <label className="resolve-note">
              Note to driver {record.status === 'PENDING' ? '(required to reject)' : ''}
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Approved — reimbursed with next payment"
              />
            </label>
            {error ? <p className="alert alert-error">{error}</p> : null}
            <div className="mt-review-actions">
              {changing ? (
                <button className="btn btn-ghost" onClick={() => setChanging(false)} disabled={Boolean(busy)}>
                  Cancel
                </button>
              ) : null}
              <button className="btn btn-danger" onClick={() => void review('REJECTED')} disabled={Boolean(busy)}>
                {busy === 'REJECTED' ? 'Rejecting…' : 'Reject'}
              </button>
              <button className="btn btn-primary" onClick={() => void review('APPROVED')} disabled={Boolean(busy)}>
                {busy === 'APPROVED' ? 'Approving…' : `Approve ${etb(record.costEtb)}`}
              </button>
            </div>
          </div>
        )}
        {!reviewing && error ? <p className="alert alert-error">{error}</p> : null}
      </aside>
    </div>
  );
}
