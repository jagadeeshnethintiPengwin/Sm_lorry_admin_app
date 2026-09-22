import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs — `.tabs` in the mock (Home / Vehicles / Drivers / Bookings / Menu). */
export type TabParamList = {
  Home: undefined;
  Vehicles: undefined;
  Drivers: undefined;
  /**
   * `tab` opens the list on a particular bucket.
   *
   * Approving a booking moves it out of Pending, and the operator was returned
   * to Pending — where it is now correctly absent — with nothing to show that
   * the approval had worked. The decision screen names the bucket its outcome
   * landed in, so the result is on screen when they arrive.
   */
  Bookings:
    | { tab?: 'pending' | 'approved' | 'completed' | 'cancelled' | 'rejected' }
    | undefined;
  Menu: undefined;
};

/** Section 01 — Authentication. */
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  /**
   * `verificationId` travels with the number.
   *
   * The OTP screen used to post the literal `'mock-verification'`, because the
   * id the API returns from `otp/send` had nowhere to live — so verification
   * was checked against a challenge that does not exist.
   *
   * `devCode` is only ever present outside production, where the API returns
   * the code in the response so the panel can be driven without an SMS gateway.
   */
  OtpVerification: {
    mobile: string;
    verificationId: string;
    devCode?: string;
    /**
     * Where a verified code leads.
     *
     * The same screen serves signing in and proving a number before a PIN is
     * replaced, and only the caller knows which — so `intent` says whether a
     * correct code should sign in or hand on to Reset PIN.
     */
    intent?: 'sign-in' | 'reset-pin';
  };

  /** Forgot PIN, step one: the number a reset code is sent to. */
  ForgotPin: undefined;

  /**
   * Setting the new PIN.
   *
   * Reached two ways, and it has to know which: with a `verificationId` after
   * Forgot PIN proved the number by OTP, or without one when the operator
   * chose Reset PIN and will prove themselves with the current PIN instead.
   */
  ResetPin: {
    mobile: string;
    verificationId?: string;
    code?: string;
  };
};

/** Root stack — everything reachable once signed in. */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Tabs: NavigatorScreenParams<TabParamList>;

  // Fleet
  VehicleDetails: { vehicleId: string };
  /**
   * `vehicleId` turns the Add form into an Edit form.
   *
   * The same screen registers a new truck and edits an existing one — opened
   * with an id it prefills from that vehicle and saves as an update, opened
   * without one it stays the blank create form.
   */
  AddVehicle: { vehicleId?: string } | undefined;
  /**
   * `kind` files the scan against the right paper.
   *
   * Opened from a vehicle's document list, the screen was hardcoded to RC, so
   * choosing Insurance or Fitness still overwrote the RC row. The caller now
   * names which of `RC | INS | FIT | PUC` it is filing, with `kindLabel` the
   * human name for the header and hero. Both are optional — reached from Add
   * Vehicle with neither, it falls back to RC.
   */
  UploadDocument: {
    ownerId?: string;
    ownerLabel?: string;
    kind?: string;
    kindLabel?: string;
  };

  // People
  DriverDetails: { driverId: string };
  /**
   * `driverId` turns the Add form into an Edit form.
   *
   * The same screen registers a new driver and edits an existing one — opened
   * with an id it prefills from that driver and saves as an update, opened
   * without one it stays the blank create form.
   */
  AddDriver: { driverId?: string } | undefined;
  Customers: undefined;
  CustomerDetails: { customerId: string };
  AddCustomer: { customerId?: string } | undefined;

  // Bookings & trips
  BookingReview: { bookingId: string };
  /**
   * The customer app's "Request a Vehicle" queue, and one request in full.
   *
   * The web panel has answered these since the queue existed; this app could
   * not see them, so an operator away from a desk had no idea a customer was
   * waiting on a lorry that is not in the catalogue.
   */
  /** The catalogue customers pick a lorry from — the panel's Vehicle Types. */
  VehicleTypes: undefined;
  VehicleRequests: undefined;
  VehicleRequestDetails: { requestId: string };
  Trips: undefined;
  NewTrip: { driverId?: string; vehicleId?: string } | undefined;
  TripDetails: { tripId: string };
  ReassignTrip: { tripId: string };
  UpdateTripStatus: { tripId: string };
  TripFinance: { tripId: string; reference: string };
  TripTimeline: { tripId: string };
  LiveTripTrack: { tripId: string };
  LiveFleetMap: undefined;
  /** Full-screen driver + lorry map, opened from a detail screen's map card. */
  GeoMap: {
    title?: string;
    driver?: {
      position: { latitude: number; longitude: number };
      name: string;
      onTrip?: boolean;
    } | null;
    vehicle?: {
      position: { latitude: number; longitude: number };
      reg: string;
    } | null;
  };
  PodViewer: { tripId: string };

  // Reports
  Reports: undefined;
  ReportView: { kind: string; title: string };

  // Account
  Documents: undefined;
  Notifications: undefined;
  /** The office writing a notification of its own — owner and managers only. */
  SendNotification: undefined;
  BusinessDetails: undefined;
  LogoutConfirm: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
