import type { Metadata } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'FuelTrack', description: 'Fuel transportation operations platform' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
