import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';
import { notificationTarget } from '@utils/notificationTarget';

/**
 * A handle on the navigator for things that happen outside the tree.
 *
 * A notification tap is the case that needs it. When one arrives for a closed
 * app the tap *is* the launch, so there is no screen holding a `navigation`
 * prop to route from — the link has to be followed from the entry point, and
 * `useNavigation` cannot help there.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Follows a notification's link, if it leads anywhere this app can show.
 *
 * Everything is checked rather than assumed: the navigator may not be mounted
 * yet on a cold start, and a link shape nobody anticipated should quietly do
 * nothing rather than crash an app the operator just opened.
 */
export function openNotificationLink(link: string | null | undefined): boolean {
  const target = notificationTarget(link ?? undefined);
  if (!target || !navigationRef.isReady()) {
    return false;
  }

  /*
   * Switched rather than spread, and not for style.
   *
   * `navigate(target.screen, target.params)` does not compile once more than
   * one destination is possible: spreading a union of pairs loses which
   * parameters belong to which screen, so the compiler sees "any of these
   * names with any of these params" and rejects it. The usual escape is a cast
   * — which is precisely the check worth keeping, since a wrong pairing here
   * is a crash on a screen reached only by tapping a notification, the path
   * least likely to be exercised in testing.
   *
   * Each branch narrows to one screen and its own parameters, so the pairing
   * stays checked. A new destination means a new case, and the compiler asks
   * for it.
   */
  switch (target.screen) {
    case 'TripDetails':
      navigationRef.navigate('TripDetails', target.params);
      return true;
    case 'BookingReview':
      navigationRef.navigate('BookingReview', target.params);
      return true;
    case 'VehicleDetails':
      navigationRef.navigate('VehicleDetails', target.params);
      return true;
    case 'PodViewer':
      navigationRef.navigate('PodViewer', target.params);
      return true;
    default:
      return false;
  }
}
