import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs — `.tabs` in the mock (Home / Vehicles / Drivers / Bookings / Menu). */
export type TabParamList = {
  Home: undefined;
  Vehicles: undefined;
  Drivers: undefined;
  Bookings: undefined;
  Menu: undefined;
};

/** Section 01 — Authentication. */
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  OtpVerification: { mobile: string };
};

/** Root stack — everything reachable once signed in. */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Tabs: NavigatorScreenParams<TabParamList>;

  // Fleet
  VehicleDetails: { vehicleId: string };
  AddVehicle: undefined;
  UploadDocument: { ownerId?: string; ownerLabel?: string };

  // People
  DriverDetails: { driverId: string };
  AddDriver: undefined;
  Customers: undefined;
  CustomerDetails: { customerId: string };
  AddCustomer: undefined;

  // Bookings & trips
  BookingReview: { bookingId: string };
  Trips: undefined;
  TripDetails: { tripId: string };
  TripTimeline: { tripId: string };
  LiveTripTrack: { tripId: string };
  LiveFleetMap: undefined;
  PodViewer: { tripId: string };

  // Account
  Documents: undefined;
  Notifications: undefined;
  BusinessDetails: undefined;
  LogoutConfirm: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
