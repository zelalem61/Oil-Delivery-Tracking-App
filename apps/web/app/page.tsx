'use client';
import { useState, type FormEvent } from 'react';
import { apiUrl, setToken } from './lib/api';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
      });
      if (!response.ok) throw new Error('Check your email and password.');
      const result = (await response.json()) as { data: { accessToken: string } };
      setToken(result.data.accessToken);
      window.location.assign('/dashboard');
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? 'Cannot reach the FuelTrack API. Is it running?'
          : cause instanceof Error
            ? cause.message
            : 'Login failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <section className="login-hero">
        <div className="brand-mark light">
          <span className="brand-logo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </span>
          <span>
            <strong>FuelTrack</strong>
            <small>Operations</small>
          </span>
        </div>
        <div className="hero-copy">
          <span className="pill">Djibouti → Ethiopia corridor</span>
          <h1>
            Every litre,
            <br />
            every kilometre,
            <br />
            <span>in view.</span>
          </h1>
          <p>Live truck locations, trip status and delivery approvals in one place.</p>
        </div>
        <ul className="hero-points">
          <li>
            <strong>Live GPS</strong>
            <span>Updates every 10 s</span>
          </li>
          <li>
            <strong>Strict workflow</strong>
            <span>Dispatch to approval</span>
          </li>
          <li>
            <strong>Full audit</strong>
            <span>Every status change logged</span>
          </li>
        </ul>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>Welcome back</h2>
          <p className="muted">Sign in to the operations portal.</p>
          <form onSubmit={submit}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="admin@fueltrack.local"
              />
            </label>
            <label>
              Password
              <span className="input-affix">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="affix-btn"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>
            {error && (
              <p role="alert" className="alert alert-error">
                {error}
              </p>
            )}
            <button className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <small className="muted">Authorized personnel only.</small>
        </div>
      </section>
    </main>
  );
}
