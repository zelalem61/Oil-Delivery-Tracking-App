import { isLow, liters, type StationFuel } from '../lib/stations';

/** Remaining stock for one fuel, with a tank gauge when the capacity is known. */
export function FuelBar({ fuel, compact = false }: { fuel: StationFuel; compact?: boolean }) {
  const low = isLow(fuel);
  const width = fuel.fillPercent ?? null;
  return (
    <div className={`fuel ${low ? 'fuel-low' : ''} ${compact ? 'fuel-compact' : ''}`}>
      <div className="fuel-top">
        <span className={`fuel-name f-${fuel.product.toLowerCase()}`}>{fuel.label}</span>
        <strong>{liters(fuel.stockLiters)}</strong>
      </div>
      <div className="bar" aria-hidden="true">
        <span className="fill" style={{ width: `${Math.min(100, Math.max(0, width ?? 0))}%` }} />
      </div>
      <small>
        {fuel.capacityLiters
          ? `${fuel.fillPercent}% of ${liters(fuel.capacityLiters)}`
          : 'Capacity not set'}
        {' · '}
        {fuel.daysOfCover === null ? 'no recent sales' : `≈ ${fuel.daysOfCover} days left`}
        {fuel.incomingLiters ? ` · ${liters(fuel.incomingLiters)} on the way` : ''}
      </small>
    </div>
  );
}
