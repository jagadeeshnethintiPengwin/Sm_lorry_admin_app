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
  Bookings: { tab?: 'pending' | 'approved' | 'rejected' } | undefined;
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
