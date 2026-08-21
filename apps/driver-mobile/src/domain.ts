export type TripStatus =
  | 'CREATED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'UNLOADING'
  | 'AWAITING_DELIVERY_APPROVAL'
  | 'DELIVERED';

export type DriverUser = { firstName: string; lastName: string; role: string; email: string; truckPlate?: string };
export type Delivery = {
  id: string;
  deliveryNumber: string;
  origin: string;
  destination: string;
  fuelProduct: string;
  quantityLiters: number;
  truckPlate: string;
  status: TripStatus;
};
export type OfflineEvent = {
  id: string;
  type: 'STATUS' | 'LOCATION' | 'INCIDENT';
  createdAt: string;
  payload: Record<string, unknown>;
};

export const nextStatus: Partial<Record<TripStatus, TripStatus>> = {
  CREATED: 'DISPATCHED',
  DISPATCHED: 'IN_TRANSIT',
  IN_TRANSIT: 'ARRIVED',
  ARRIVED: 'UNLOADING',
  UNLOADING: 'AWAITING_DELIVERY_APPROVAL',
};

export const actionLabel: Partial<Record<TripStatus, string>> = {
  CREATED: 'Start delivery',
  DISPATCHED: 'Begin transit',
  IN_TRANSIT: 'Arrived at station',
  ARRIVED: 'Start unloading',
  UNLOADING: 'Request delivery approval',
};
