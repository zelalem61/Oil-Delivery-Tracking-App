'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { request } from '../lib/api';

export function CreateDriverModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose(): void;
  onCreated(name: string): void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await request('/drivers', { method: 'POST', body: JSON.stringify(data) });
      form.reset();
      onCreated(`${data.firstName} ${data.lastName}`);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create driver');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-driver-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="create-driver-title">New driver</h2>
            <p>The driver signs in to the mobile app with this email and password.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label>
            First name
            <input ref={first} name="firstName" required />
          </label>
          <label>
            Last name
            <input name="lastName" required />
          </label>
          <label className="span-2">
            Email
            <input name="email" type="email" required placeholder="driver@company.com" />
          </label>
          <label>
            Temporary password
            <input name="password" type="password" minLength={8} required />
            <small>At least 8 characters</small>
          </label>
          <label>
            Phone
            <input name="phone" required placeholder="+251 9…" />
          </label>
          <label>
            Licence number
            <input name="licenseNumber" required />
          </label>
          <label>
            Truck plate
            <input name="truckPlate" required placeholder="DJ-1234" />
          </label>
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
              {saving ? 'Creating…' : 'Create driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
