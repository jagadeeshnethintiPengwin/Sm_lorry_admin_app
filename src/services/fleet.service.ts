import { apiClient } from './api.client';

/**
 * The list surfaces: bookings, drivers, vehicles, customers, trips, documents.
 *
 * Every one of these screens drew a literal array defined at the top of its own
 * file, so the admin panel showed the same five drivers and the same handful of
 * bookings on every device and never changed. The API has served all of it for
 * a while — nothing was calling it.
 *
 * The API pages some of these (`{ items, total }`) and returns a bare array for
 * others; `listOf` accepts either so a screen does not have to know which.
 */
type Paged<T> = { items: T[]; total?: number; meta?: PageMeta };

/**
 * What the API sends alongside a page of rows.
 *
 * `counts` is deliberately fleet-wide rather than page-wide: the tab badges on
 * the list screens say how many vehicles are in trip *altogether*, which is not
 * a number you can get by counting the rows you were sent.
 */
export type PageMeta = {
  total?: number;
  page?: number;
  limit?: number;
  counts?: Record<string, number>;
};

async function listOf<T>(path: string, params?: Record<string, unknown>): Promise<T[]> {
  const { data } = await apiClient.get<Paged<T> | T[]>(path, { params });
  if (Array.isArray(data)) {
    return data;
  }
  return Array.isArray(data?.items) ? data.items : [];
}

/**
 * The same read, keeping the envelope.
 *
 * `listOf` throws the meta away, which is right for a picker that only wants
 * rows. A list screen showing "10 total · 6 in trip" needs the counts, and
 * counting the rows it happens to have been sent would report the page size.
 */
async function pageOf<T>(
  path: string,
  params?: Record<string, unknown>,
): Promise<{ items: T[]; meta: PageMeta }> {
  const { data } = await apiClient.get<Paged<T> | T[]>(path, { params });
  if (Array.isArray(data)) {
    return { items: data, meta: { total: data.length } };
  }
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    meta: data?.meta ?? { total: data?.total },
  };
}

async function oneOf<T>(path: string): Promise<T> {
  const { data } = await apiClient.get<T>(path);
  return data;
}

// ------------------------------------------------------------------ types
// Deliberately loose: these mirror what the API sends rather than inventing a
// second model. Screens read the fields they need and the smoke test proves
// those fields are there.

export type AdminBooking = Record<string, unknown> & {
  id: string;
  reference?: string;
  status?: string;
  pickupPlace?: string;
  dropPlace?: string;
  vehicleType?: string;
  distanceKm?: number | null;
  pickupAt?: string;
  createdAt?: string;
  /** Joined by the API so the list can name the company without a second call. */
  customer?: { company?: string; contactName?: string } | null;
};

export type AdminDriver = Record<string, unknown> & {
  id: string;
  status?: string;
};

export type AdminVehicle = Record<string, unknown> & {
  id: string;
  registrationNumber?: string;
  status?: string;
};

export type AdminCustomer = Record<string, unknown> & {
  id: string;
  company?: string;
};

export type AdminTrip = Record<string, unknown> & {
  id: string;
  reference?: string;
  status?: string;
};

export type AdminDocument = Record<string, unknown> & {
  id: string;
  name?: string;
  kind?: string;
};

// --------------------------------------------------------------- services

export const bookingService = {
  list: (params?: Record<string, unknown>) =>
    listOf<AdminBooking>('/bookings', params),
  get: (id: string) => oneOf<AdminBooking>(`/bookings/${id}`),
  approve: async (id: string, body?: Record<string, unknown>) => {
    const { data } = await apiClient.post(`/bookings/${id}/approve`, body ?? {});
    return data;
  },
  reject: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/bookings/${id}/reject`, { reason });
    return data;
  },
};

/**
 * What Add New Driver sends.
 *
 * `licenceValid` is an ISO `YYYY-MM-DD` date, which is what `DateField`
 * produces and what the API parses into a Date.
 */
export type NewDriver = {
  name: string;
  mobile: string;
  email?: string;
  licenceNumber: string;
  licenceValid: string;
  /** The photograph taken on the Add Driver screen, once uploaded. */
  photoUrl?: string;
  address?: string;
};

/** What Add New Vehicle sends. */
export type NewVehicle = {
  registration: string;
  type: string;
  capacity: string;
  make: string;
  model: string;
  year: number;
  driverId?: string;
};

export const driverService = {
  page: (params?: Record<string, unknown>) => pageOf<AdminDriver>('/drivers', params),
  list: (params?: Record<string, unknown>) => listOf<AdminDriver>('/drivers', params),
  available: () => listOf<AdminDriver>('/drivers/available'),
  get: (id: string) => oneOf<AdminDriver>(`/drivers/${id}`),
  create: async (body: NewDriver): Promise<AdminDriver> => {
    const { data } = await apiClient.post<AdminDriver>('/drivers', body);
    return data;
  },
  update: async (
    id: string,
    body: Partial<NewDriver> & { status?: string },
  ): Promise<AdminDriver> => {
    const { data } = await apiClient.patch<AdminDriver>(`/drivers/${id}`, body);
    return data;
  },
  /**
   * Files a licence or KYC scan against a driver.
   *
   * Upserts by kind, so re-photographing an expired licence replaces the scan
   * rather than leaving two rows for the same paper.
   */
  saveDocument: async (
    driverId: string,
    body: { kind: string; number?: string; expiresAt?: string; fileUrl?: string },
  ): Promise<void> => {
    await apiClient.post(`/drivers/${driverId}/documents`, body);
  },

  remove: (id: string) => apiClient.delete(`/drivers/${id}`),
};

export const vehicleService = {
  page: (params?: Record<string, unknown>) => pageOf<AdminVehicle>('/vehicles', params),
  list: (params?: Record<string, unknown>) => listOf<AdminVehicle>('/vehicles', params),
  available: () => listOf<AdminVehicle>('/vehicles/available'),

  /**
   * The vehicle types the business actually offers.
   *
   * The Add Vehicle form carried its own hardcoded list — `Mini Truck`,
   * `14 Ft Truck`, `22 Ft Trailer` — and not one entry matched the `VehicleType`
   * catalogue the rest of the system runs on (`Tata Ace`, `Tata 407`,
   * `14 Feet Truck`, `Trailer`). A customer books `Tata Ace`; the office
   * registered lorries as `14 Ft Truck`; the two strings never met. Every
   * truck added through that screen was invisible to type filtering and to
   * anything matching a booking against the fleet.
   */
  types: () =>
    listOf<{ id: string; name: string; capacityLabel?: string }>(
      '/vehicles/types',
    ),
  get: (id: string) => oneOf<AdminVehicle>(`/vehicles/${id}`),
  create: async (body: NewVehicle): Promise<AdminVehicle> => {
    const { data } = await apiClient.post<AdminVehicle>('/vehicles', body);
    return data;
  },
  update: async (
    id: string,
    body: Partial<NewVehicle> & { status?: string; driverId?: string | null },
  ): Promise<AdminVehicle> => {
    const { data } = await apiClient.patch<AdminVehicle>(
      `/vehicles/${id}`,
      body,
    );
    return data;
  },
  /**
   * A signed link to one of this truck's papers (RC, insurance, fitness, PUC).
   *
   * Separate from `documentService.downloadUrl`: those are the shipment scans
   * in the `Document` table, while a vehicle's papers hang off the vehicle and
   * are served by the fleet routes.
   */
  documentUrl: async (id: string): Promise<string> => {
    const { data } = await apiClient.get<{ url: string; name: string }>(
      `/vehicles/documents/${id}/download`,
    );
    return data.url;
  },

  /**
   * Files a scan against one of a truck's papers.
   *
   * `PATCH` rather than `POST`, because the rows already exist: creating a
   * vehicle seeds one document per kind (RC, INS, FIT, PUC) with nothing
   * attached, and this fills one in. The id is the *document's*, which is why
   * the created vehicle has to be read for its documents before this can be
   * called.
   */
  saveDocument: async (
    documentId: string,
    body: { fileUrl?: string; number?: string; expiresAt?: string },
  ): Promise<void> => {
    await apiClient.patch(`/vehicles/documents/${documentId}`, body);
  },

  remove: (id: string) => apiClient.delete(`/vehicles/${id}`),
};

export const customerService = {
  page: (params?: Record<string, unknown>) => pageOf<AdminCustomer>('/customers', params),
  list: (params?: Record<string, unknown>) => listOf<AdminCustomer>('/customers', params),
  get: (id: string) => oneOf<AdminCustomer>(`/customers/${id}`),
};

export const tripService = {
  page: (params?: Record<string, unknown>) => pageOf<AdminTrip>('/trips', params),
  list: (params?: Record<string, unknown>) => listOf<AdminTrip>('/trips', params),
  live: () => listOf<LiveTrip>('/trips/live'),
  get: (id: string) => oneOf<AdminTrip>(`/trips/${id}`),
  /*
   * The live position, distance and timeline for one trip.
   *
   * `listOf`, which this used, hands back `[]` for any object that has no
   * `items` — and this endpoint answers a single record shaped
   * `{ reference, status, distanceKm, coveredKm, progress, location, events }`.
   * So the call resolved to an empty array every time, with no error to
   * notice: a screen asking where the lorry is was told nothing, silently.
   */
  tracking: (id: string) => oneOf<TripTracking>(`/trips/${id}/tracking`),
};

/** What `/trips/:id/tracking` answers — the live board for one trip. */
export interface TripTracking {
  reference: string;
  status: string;
  distanceKm: number;
  coveredKm: number;
  /** Whole percent, already rounded by the API. */
  progress: number;
  /** `null` until the lorry reports — an unstarted trip has no position. */
  location: {
    lat: number;
    lng: number;
    recordedAt: string;
    speedKph?: number | null;
  } | null;
  events: Array<{
    id: string;
    stage: string;
    label: string;
    createdAt: string;
  }>;
}

/**
 * What `/trips/live` answers — a projection, not a whole trip.
 *
 * Typed separately from `AdminTrip` because it is a different shape: the
 * office's live map needs the plate, the driver and the last fix, and none of
 * the booking detail a trip carries. Typing it as `AdminTrip` meant every
 * field arrived as `unknown` and the screen could not read one without a cast.
 */
export type LiveTrip = {
  tripId: string;
  /** The truck, so Vehicle Details can find its running trip. */
  vehicleId?: string;
  reference?: string;
  status?: string;
  registration?: string;
  driver?: string;
  route?: string;
  distanceKm?: number;
  coveredKm?: number;
  /** Null until the driver's app has reported at least once. */
  location?: { lat: number; lng: number } | null;
  lastPingAt?: string | null;
  /**
   * What the tracker on the lorry reports, and the phone cannot.
   *
   * `source` says which of the two the position came from; the rest are only
   * present when it came from the vehicle's own unit. A heading is what lets
   * the map point the truck the way it is actually facing rather than drawing
   * every lorry identically.
   */
  source?: 'tracker' | 'app' | 'last-known';
  speedKmph?: number | null;
  heading?: number | null;
  ignition?: boolean | null;
  gpsAccurate?: boolean | null;
};

export const documentService = {
  list: (params?: Record<string, unknown>) =>
    listOf<AdminDocument>('/documents', params),
  get: (id: string) => oneOf<AdminDocument>(`/documents/${id}`),

  /**
   * A link the phone can open for one stored document.
   *
   * `GET /documents/:id/download` answers with a *signed* link rather than the
   * stored path: `/uploads/:name` is guarded, and the system viewer this is
   * handed to sends no bearer token. The signature authorises that one file
   * for an hour, which is what makes opening it possible at all.
   */
  downloadUrl: async (id: string): Promise<string> => {
    const { data } = await apiClient.get<{ url: string; name: string }>(
      `/documents/${id}/download`,
    );
    return data.url;
  },

  /**
   * The proof-of-delivery photographs the driver took, ready to display.
   *
   * Two calls per photo is deliberate: the list carries `fileUrl`, but that is
   * the guarded `/uploads/:name` path and `<Image>` sends no Authorization
   * header — pointing a thumbnail at it returns 401 and renders as a grey box.
   * Each one is exchanged for a signed link that authorises just that file.
   */
  podPhotos: async (
    tripId: string,
  ): Promise<Array<{ id: string; name: string; url: string }>> => {
    const rows = await listOf<AdminDocument>('/documents', {
      tripId,
      kind: 'POD',
    });
    const signed = await Promise.all(
      rows.map(async row => {
        try {
          return {
            id: row.id,
            name: String(row.name ?? 'Photo'),
            url: await documentService.downloadUrl(row.id),
          };
        } catch {
          // One unreadable file must not blank the whole proof.
          return null;
        }
      }),
    );
    return signed.filter((row): row is { id: string; name: string; url: string } => row !== null);
  },
};

export const notificationService = {
  list: () => listOf<Record<string, unknown>>('/notifications'),
  unreadCount: async (): Promise<number> => {
    const { data } = await apiClient.get<{ count: number }>(
      '/notifications/unread-count',
    );
    return data?.count ?? 0;
  },
  markRead: (id: string) => apiClient.post(`/notifications/${id}/read`, {}),
  markAllRead: () => apiClient.post('/notifications/read-all', {}),
};
