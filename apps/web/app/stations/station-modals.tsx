'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { request } from '../lib/api';
import { fuelOptions, type FuelProduct, type Station, type StationFuel } from '../lib/stations';

function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose(): void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const today = () => new Date().toLocaleDateString('en-CA');
const optionalNumber = (value: string) => (value.trim() ? Number(value) : undefined);

type FuelDraft = { enabled: boolean; opening: string; capacity: string };

export function CreateStationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose(): void;
  onCreated(station: Station): void;
}) {
  const blank = () =>
    Object.fromEntries(
      fuelOptions.map(({ product }) => [
        product,
        { enabled: ['BENZINE', 'DIESEL'].includes(product), opening: '', capacity: '' },
      ]),
    ) as Record<FuelProduct, FuelDraft>;
  const [fuels, setFuels] = useState(blank);
  const [openingDate, setOpeningDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setFuels(blank());
    setOpeningDate(today());
    first.current?.focus();
  }, [open]);

  const setFuel = (product: FuelProduct, patch: Partial<FuelDraft>) =>
    setFuels((current) => ({ ...current, [product]: { ...current[product], ...patch } }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const selected = fuelOptions.filter(({ product }) => fuels[product].enabled);
    if (!selected.length) {
      setError('Pick at least one fuel this station sells.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const station = await request<Station>('/stations', {
        method: 'POST',
        body: JSON.stringify({
          code: data.code,
          name: data.name,
          location: data.location || undefined,
          fuels: selected.map(({ product }) => ({
            product,
            openingStockLiters: Number(fuels[product].opening || 0),
            capacityLiters: optionalNumber(fuels[product].capacity),
            openingDate,
          })),
        }),
      });
      onCreated(station);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the station');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="New station"
      subtitle="Add the fuels it sells and how many liters each tank held before that day’s sales."
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit}>
        <label>
          Station name
          <input ref={first} name="name" required minLength={2} placeholder="Addis Ababa – Bole" />
        </label>
        <label>
          Code
          <input name="code" required pattern="[A-Za-z0-9\-]{2,20}" placeholder="ADD-01" />
          <small>Short unique ID, e.g. ADD-01</small>
        </label>
        <label>
          Town / location
          <input name="location" placeholder="Bole Road, Addis Ababa" />
        </label>
        <label>
          Stock counted on
          <input
            type="date"
            value={openingDate}
            max={today()}
            onChange={(event) => setOpeningDate(event.target.value)}
            required
          />
          <small>Sales are tracked from this day on</small>
        </label>
        <div className="span-2 fuel-setup">
          <div className="fuel-setup-head">
            <span>Fuel</span>
            <span>Liters before sales that day</span>
            <span>Tank capacity (optional)</span>
          </div>
          {fuelOptions.map(({ product, label }) => (
            <div className={`fuel-setup-row ${fuels[product].enabled ? '' : 'off'}`} key={product}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={fuels[product].enabled}
                  onChange={(event) => setFuel(product, { enabled: event.target.checked })}
                />
                {label}
              </label>
              <input
                type="number"
                min={0}
                step="any"
                aria-label={`${label} liters in tank`}
                disabled={!fuels[product].enabled}
                required={fuels[product].enabled}
                value={fuels[product].opening}
                onChange={(event) => setFuel(product, { opening: event.target.value })}
                placeholder="0"
              />
              <input
                type="number"
                min={1}
                step="any"
                aria-label={`${label} tank capacity`}
                disabled={!fuels[product].enabled}
                value={fuels[product].capacity}
                onChange={(event) => setFuel(product, { capacity: event.target.value })}
                placeholder="e.g. 45000"
              />
            </div>
          ))}
        </div>
        {error && (
          <p className="alert alert-error span-2" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions span-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create station'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateStaffModal({
  open,
  stations,
  defaultStationId,
  onClose,
  onCreated,
}: {
  open: boolean;
  stations: Pick<Station, 'id' | 'name' | 'code'>[];
  defaultStationId?: string;
  onClose(): void;
  onCreated(name: string): void;
}) {
  const [role, setRole] = useState<'STATION_MANAGER' | 'OPERATIONS_MANAGER'>('STATION_MANAGER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setRole('STATION_MANAGER');
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await request('/staff', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          role,
          phone: data.phone || undefined,
          stationId: role === 'STATION_MANAGER' ? data.stationId : undefined,
        }),
      });
      form.reset();
      onCreated(`${data.firstName} ${data.lastName}`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create the account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="New staff account"
      subtitle="They sign in to this web portal with the email and password you set."
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={submit}>
        <div className="span-2 segmented" role="group" aria-label="Role">
          <button
            type="button"
            className={role === 'STATION_MANAGER' ? 'active' : ''}
            onClick={() => setRole('STATION_MANAGER')}
          >
            Station manager
          </button>
          <button
            type="button"
            className={role === 'OPERATIONS_MANAGER' ? 'active' : ''}
            onClick={() => setRole('OPERATIONS_MANAGER')}
          >
            Operations manager
          </button>
        </div>
        <p className="span-2 muted small">
          {role === 'STATION_MANAGER'
            ? 'Sees one station and submits its daily sales.'
            : 'Sees sales, stock and history for every station (read-only).'}
        </p>
        <label>
          First name
          <input name="firstName" required />
        </label>
        <label>
          Last name
          <input name="lastName" required />
        </label>
        <label className="span-2">
          Email
          <input name="email" type="email" required placeholder="name@company.com" />
        </label>
        <label>
          Temporary password
          <input name="password" type="password" minLength={8} required />
          <small>At least 8 characters</small>
        </label>
        <label>
          Phone (optional)
          <input name="phone" placeholder="+251 9…" />
        </label>
        {role === 'STATION_MANAGER' ? (
          <label className="span-2">
            Station
            <select name="stationId" required defaultValue={defaultStationId ?? ''}>
              <option value="" disabled>
                Pick a station
              </option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name} ({station.code})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error && (
          <p className="alert alert-error span-2" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions span-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Add a fuel to a station, or reset a fuel's stock after a physical tank count. */
export function FuelModal({
  open,
  stationId,
  fuel,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  stationId: string;
  fuel: StationFuel | null;
  existing: FuelProduct[];
  onClose(): void;
  onSaved(message: string): void;
}) {
  const choices = fuel
    ? fuelOptions.filter((option) => option.product === fuel.product)
    : fuelOptions.filter((option) => !existing.includes(option.product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setError('');
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setSaving(true);
    setError('');
    try {
      await request(`/stations/${stationId}/fuels`, {
        method: 'PUT',
        body: JSON.stringify({
          product: data.product,
          openingStockLiters: Number(data.opening),
          openingDate: data.openingDate,
          capacityLiters: optionalNumber(data.capacity ?? ''),
        }),
      });
      onSaved(
        fuel
          ? `${fuel.label} stock reset to ${Number(data.opening).toLocaleString()} L`
          : 'Fuel added',
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={fuel ? `Recount ${fuel.label}` : 'Add a fuel'}
      subtitle={
        fuel
          ? 'Enter the liters measured before that day’s sales. Stock is calculated from this count onward.'
          : 'Start tracking another fuel at this station.'
      }
      onClose={onClose}
    >
      {!choices.length ? (
        <p className="muted">This station already sells every fuel type.</p>
      ) : (
        <form className="form-grid" onSubmit={submit}>
          <label>
            Fuel
            <select name="product" defaultValue={choices[0]!.product} disabled={Boolean(fuel)}>
              {choices.map((option) => (
                <option key={option.product} value={option.product}>
                  {option.label}
                </option>
              ))}
            </select>
            {fuel ? <input type="hidden" name="product" value={fuel.product} /> : null}
          </label>
          <label>
            Counted on
            <input type="date" name="openingDate" defaultValue={today()} max={today()} required />
          </label>
          <label>
            Liters in tank
            <input
              name="opening"
              type="number"
              min={0}
              step="any"
              required
              defaultValue={fuel ? Math.max(0, Math.round(fuel.stockLiters)) : ''}
            />
          </label>
          <label>
            Tank capacity (optional)
            <input
              name="capacity"
              type="number"
              min={1}
              step="any"
              defaultValue={fuel?.capacityLiters ?? ''}
            />
          </label>
          {fuel ? (
            <p className="span-2 muted small">
              Sales reported before the count date are kept in the history but no longer change the
              stock.
            </p>
          ) : null}
          {error && (
            <p className="alert alert-error span-2" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions span-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : fuel ? 'Save count' : 'Add fuel'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
