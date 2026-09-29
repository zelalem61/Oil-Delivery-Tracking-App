'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getToken, signOut, tokenEmail } from '../lib/api';

const nav = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
    ),
  },
  {
    href: '/maintenance',
    label: 'Maintenance',
    icon: (
      <path d="M22.7 19.3 13.6 10.2c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3l4.3 4.3-3 3-4.4-4.3C.4 7.4.9 10.4 2.9 12.4c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1 .1-1.4Z" />
    ),
  },
  {
    href: '/drivers',
    label: 'Drivers',
    icon: (
      <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 1c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4Zm-8 0c-.3 0-.7 0-1.1.1A4.6 4.6 0 0 1 9 17v3H2v-3c0-2.2 4.4-4 6-4Z" />
    ),
  },
];

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!getToken()) {
      location.assign('/');
      return;
    }
    setEmail(tokenEmail());
  }, []);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand-mark">
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
        </Link>
        <nav className="side-nav" aria-label="Main">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname?.startsWith(item.href) ? 'active' : ''}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {item.icon}
              </svg>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="side-footer">
          <div className="side-user">
            <span className="side-avatar">{(email[0] ?? 'A').toUpperCase()}</span>
            <span>
              <strong>Administrator</strong>
              <small title={email}>{email || 'Signed in'}</small>
            </span>
          </div>
          <button type="button" className="side-signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="page-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}
