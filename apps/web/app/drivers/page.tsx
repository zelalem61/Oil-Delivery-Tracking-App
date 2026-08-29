'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Driver = {
  id: string;
  licenseNumber: string;
  truckPlate: string;
  phone: string;
  user: { firstName: string; lastName: string; email: string; isActive: boolean };
};

type Directory = {
  items: Driver[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function DriversPage() {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDrivers = useCallback(async () => {
    const token = sessionStorage.getItem('fueltrack_access_token');
    if (!token) {
      location.assign('/');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page) });
      if (submittedSearch.trim()) query.set('search', submittedSearch.trim());
      const response = await fetch(`${api}/drivers/directory?${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => null)) as {
        data?: Directory;
        message?: string;
      } | null;
      if (!response.ok || !body?.data) {
        throw new Error(body?.message ?? 'Unable to load drivers');
      }
      setDirectory(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load drivers');
    } finally {
      setLoading(false);
    }
  }, [page, submittedSearch]);

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

  function searchDrivers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSubmittedSearch(search);
  }

  return (
    <main className="admin-shell directory-page">
      <header className="admin-header">
        <div>
          <p className="eyebrow">FUELTRACK ADMIN</p>
          <h1>Driver directory</h1>
          <p>Find driver accounts, contact details, licences, and assigned trucks.</p>
        </div>
        <div className="header-actions">
          <Link className="secondary" href="/dashboard">
            ← Dashboard
          </Link>
          <button
            className="secondary"
            onClick={() => {
              sessionStorage.clear();
              location.assign('/');
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="panel directory-panel">
        <div className="section-heading directory-heading">
          <div>
            <p className="eyebrow">FLEET DIRECTORY</p>
            <h2>All drivers</h2>
          </div>
          <span>{directory ? `${directory.total} total drivers` : 'Loading drivers…'}</span>
        </div>
        <form className="directory-search" onSubmit={searchDrivers}>
          <label>
            Search drivers
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone, truck, or licence"
            />
          </label>
          <button type="submit">Search</button>
          {submittedSearch && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setSearch('');
                setSubmittedSearch('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>

        {error ? (
          <p className="banner error" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="directory-loading">Loading drivers…</p>
        ) : !directory?.items.length ? (
          <div className="empty">
            <strong>{submittedSearch ? 'No matching drivers' : 'No drivers created'}</strong>
            <p>
              {submittedSearch
                ? 'Try a different name or clear the search.'
                : 'Create the first driver from the dashboard.'}
            </p>
          </div>
        ) : (
          <>
            <div className="driver-table-wrap">
              <table className="driver-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Contact</th>
                    <th>Truck</th>
                    <th>Licence</th>
                    <th>Account</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.items.map((driver) => (
                    <tr key={driver.id}>
                      <td>
                        <strong>
                          {driver.user.firstName} {driver.user.lastName}
                        </strong>
                        <small>{driver.user.email}</small>
                      </td>
                      <td>{driver.phone}</td>
                      <td className="truck-plate">{driver.truckPlate}</td>
                      <td>{driver.licenseNumber}</td>
                      <td>
                        <span
                          className={`account-state ${driver.user.isActive ? 'active' : 'inactive'}`}
                        >
                          {driver.user.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="directory-pagination" aria-label="Driver directory pages">
              <span>
                Showing {(directory.page - 1) * directory.pageSize + 1}–
                {Math.min(directory.page * directory.pageSize, directory.total)} of{' '}
                {directory.total}
              </span>
              <div>
                <button
                  className="secondary"
                  disabled={directory.page === 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {directory.page} of {directory.totalPages}
                </span>
                <button
                  className="secondary"
                  disabled={directory.page === directory.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}
