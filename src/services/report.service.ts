import { apiClient } from './api.client';

/**
 * `GET /reports/dashboard` — the counts the dashboard is built from.
 *
 * The screen carried these as literals: 42 vehicles, 38 drivers, 124
 * customers, 1,284 delivered, "+3 this month", "98% on-time". They were the
 * design mock's numbers, so every owner opening the app saw the same fleet,
 * whatever they actually owned — and the figures never moved.
 */
export type DashboardSummary = {
  totalVehicles: number;
  totalDrivers: number;
  totalCustomers: number;
  activeTrips: number;
  completedTrips: number;
  pendingBookings: number;
  fleet: { inTrip: number; available: number; maintenance: number };
  drivers: { online: number; onTrip: number; offline: number };
};

/** One bar of the THIS WEEK chart. */
export type TripsPerDay = {
  date: string;
  completed: number;
  active: number;
};

export type TopCustomer = {
  id: string;
  company: string;
  trips: number;
};

/** The financial-year dashboard — the same figures the web admin summarises. */
export type FinancialYear = {
  fy: { startYear: number; label: string; from: string; to: string };
  availableFYs: Array<{ startYear: number; label: string }>;
  kpis: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    marginPct: number;
    tripsCompleted: number;
    tripsCancelled: number;
    totalTrips: number;
    bookings: number;
    activeCustomers: number;
    avgFare: number;
    totalDistanceKm: number;
  };
};

/** A report table row — shape varies by kind, read by path where drawn. */
export type ReportRow = Record<string, unknown>;

export const reportService = {
  async dashboard(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<DashboardSummary>('/reports/dashboard');
    return data;
  },

  async tripsPerDay(): Promise<TripsPerDay[]> {
    const { data } = await apiClient.get<TripsPerDay[]>('/reports/trips-per-day');
    return Array.isArray(data) ? data : [];
  },

  async topCustomers(): Promise<TopCustomer[]> {
    const { data } = await apiClient.get<TopCustomer[]>('/reports/top-customers');
    return Array.isArray(data) ? data : [];
  },

  /** The financial-year dashboard; `fy` is a start year, else the current one. */
  async financialYear(fy?: number): Promise<FinancialYear> {
    const { data } = await apiClient.get<FinancialYear>(
      `/reports/financial-year${fy ? `?fy=${fy}` : ''}`,
    );
    return data;
  },

  /** Rows for one report — trips, invoice, vehicles, drivers, customers. */
  async table(kind: string): Promise<ReportRow[]> {
    const { data } = await apiClient.get<unknown>(`/reports/table/${kind}`);
    if (Array.isArray(data)) {
      return data as ReportRow[];
    }
    const items = (data as { items?: unknown })?.items;
    return Array.isArray(items) ? (items as ReportRow[]) : [];
  },
};
