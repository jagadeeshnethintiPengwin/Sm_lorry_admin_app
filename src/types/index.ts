/** Domain model for the SMT owner/admin app. */

export type VehicleStatus = 'active' | 'on_trip' | 'maintenance' | 'idle';

export type Vehicle = {
  id: string;
  registration: string;
  model: string;
  capacity: string;
  status: VehicleStatus;
  statusLabel: string;
  driverName?: string;
  /** e.g. `Docs valid` / `RC expiring in 12 days`. */
  docNote?: string;
};

export type DriverStatus = 'on_trip' | 'available' | 'off_duty' | 'pending';

export type Driver = {
  id: string;
  name: string;
  initials: string;
  mobile: string;
  licence: string;
  status: DriverStatus;
  statusLabel: string;
  rating?: number;
  tripCount?: number;
  vehicle?: string;
};

export type CustomerAccount = {
  id: string;
  name: string;
  initials: string;
  company?: string;
  mobile: string;
  gstin?: string;
  tripCount: number;
  /** `₹4.2L` style lifetime value shown on the list row. */
  lifetimeValue?: string;
};

export type BookingStatus =
  | 'new'
  | 'under_review'
  | 'approved'
  | 'assigned'
  | 'rejected';

export type Booking = {
  id: string;
  reference: string;
  customerName: string;
  origin: string;
  destination: string;
  material: string;
  weight: string;
  vehicleType: string;
  pickupAt: string;
  status: BookingStatus;
  statusLabel: string;
};

export type TripStatus =
  | 'scheduled'
  | 'loading'
  | 'in_transit'
  | 'reached_drop'
  | 'delivered';

export type Trip = {
  id: string;
  reference: string;
  origin: string;
  destination: string;
  driverName: string;
  vehicleRegistration: string;
  status: TripStatus;
  statusLabel: string;
  /** Percent of the route covered — drives the progress rail. */
  progress: number;
  distanceCovered?: string;
  eta?: string;
};

export type TimelineState = 'done' | 'current' | 'pending';

export type TripEvent = {
  key: string;
  label: string;
  detail?: string;
  state: TimelineState;
};

export type DocumentKind =
  | 'rc'
  | 'insurance'
  | 'permit'
  | 'fitness'
  | 'puc'
  | 'licence'
  | 'waybill'
  | 'eway'
  | 'invoice'
  | 'pod';

export type FleetDocument = {
  id: string;
  name: string;
  kind: DocumentKind;
  owner: string;
  meta: string;
  /** `valid` · `expiring` · `expired` — drives the chip colour. */
  state: 'valid' | 'expiring' | 'expired';
  stateLabel: string;
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: 'booking' | 'trip' | 'document' | 'driver' | 'system';
  unread: boolean;
};

export type OwnerProfile = {
  id: string;
  name: string;
  initials: string;
  mobile: string;
  email?: string;
  businessName: string;
  gstin?: string;
  pan?: string;
  address?: string;
};
