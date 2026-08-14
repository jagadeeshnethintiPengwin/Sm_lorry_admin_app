import type { RootStackParamList } from '@navigation/types';

/**
 * Where a notification leads, worked out from the path the server sent.
 *
 * The office writes these as web paths — `/trips/SMT42` — because the same row
 * is read by the admin panel in a browser. The app cannot follow a URL, so the
 * path is translated into a screen and its parameters here.
 *
 * Kept out of the screen because this is the part that can be wrong in ways a
 * render cannot show: a path shape nobody anticipated should quietly not
 * navigate, never crash the list it was drawn in.
 */

/**
 * Deliberately narrow rather than every route in the stack.
 *
 * A union spanning the whole param list cannot be handed to `navigate` — the
 * screen name and its parameters lose their correlation and the call stops
 * typechecking, which is usually resolved with a cast. Naming only the
 * destinations this actually produces keeps the guarantee instead: adding a
 * case means widening this, and the compiler then checks the parameters.
 */
export type NotificationTarget =
  | { screen: 'TripDetails'; params: RootStackParamList['TripDetails'] }
  | { screen: 'BookingReview'; params: RootStackParamList['BookingReview'] }
  | { screen: 'VehicleDetails'; params: RootStackParamList['VehicleDetails'] }
  | { screen: 'PodViewer'; params: RootStackParamList['PodViewer'] };

/**
 * `/trips/SMT42` → the trip screen for `SMT42`.
 *
 * The segment is usually a *reference*, not an id — that is what the office
 * puts in the link, and what someone would read out over the phone. Both the
 * trip and the booking lookups accept either, so it is passed straight through
 * rather than resolved first: a second round trip before navigating would
 * leave the notification looking dead for as long as it took.
 *
 * `/vehicles/…` is the exception and carries a real id, which is equally fine
 * because that screen takes an id.
 */
export function notificationTarget(
  link: string | undefined,
): NotificationTarget | null {
  if (!link) {
    return null;
  }

  // Tolerates a full URL as well as a path, and a trailing slash from either.
  const path = link.replace(/^https?:\/\/[^/]+/i, '').replace(/\/+$/, '');
  const [, section, ...rest] = path.split('/');
  const identifier = rest.join('/');

  if (!identifier) {
    return null;
  }

  switch (section) {
    case 'trips':
      return { screen: 'TripDetails', params: { tripId: identifier } };

    case 'bookings':
      return { screen: 'BookingReview', params: { bookingId: identifier } };

    case 'vehicles':
      return { screen: 'VehicleDetails', params: { vehicleId: identifier } };

    /* A proof-of-delivery link names the trip it belongs to. */
    case 'pod':
      return { screen: 'PodViewer', params: { tripId: identifier } };

    /*
     * Anything else is addressed to a driver or a customer, or is a shape this
     * app has no screen for. Leaving the row as text beats guessing.
     */
    default:
      return null;
  }
}
