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
  remove: (id: string) => apiClient.delete(`/drivers/${id}`),
};

export const vehicleService = {
  page: (params?: Record<string, unknown>) => pageOf<AdminVehicle>('/vehicles', params),
  list: (params?: Record<string, unknown>) => listOf<AdminVehicle>('/vehicles', params),
  available: () => listOf<AdminVehicle>('/vehicles/available'),
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
  live: () => listOf<AdminTrip>('/trips/live'),
  get: (id: string) => oneOf<AdminTrip>(`/trips/${id}`),
  tracking: (id: string) => listOf<Record<string, unknown>>(`/trips/${id}/tracking`),
};

export const documentService = {
  list: (params?: Record<string, unknown>) =>
    listOf<AdminDocument>('/documents', params),
  get: (id: string) => oneOf<AdminDocument>(`/documents/${id}`),
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
