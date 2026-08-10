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
};
