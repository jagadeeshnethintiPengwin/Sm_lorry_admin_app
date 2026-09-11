import { API_ORIGIN, apiClient } from './api.client';
import type { LatLng } from '@components/common/TripMap';

/**
 * The road between two points, for the map screens.
 *
 * The trip map drew a straight line from pickup to drop — right about the two
 * ends and wrong about everything between, since a lorry follows the highway.
 * `GET /directions` returns the real geometry as an encoded polyline, and the
 * server holds the Google key so it never reaches a handset.
 *
 * The endpoint sits at the server root (`/directions`), not under `/admin/v1`,
 * because all four apps draw the same route; `apiClient`'s interceptor still
 * attaches the bearer token.
 */
export type RoadRoute = {
  /** Every point along the road, ready for `<Polyline>`. */
  path: LatLng[];
  distanceKm: number;
  durationMinutes: number;
  /** `Hyderabad - Guntur Rd` — the highway the route mostly follows. */
  summary: string;
};

type RouteResponse = {
  route: {
    polyline: string;
    distanceKm: number;
    durationMinutes: number;
    summary: string;
  } | null;
  configured: boolean;
};

/** `17.4401,78.3489` — what the directions API takes for a precise point. */
const asParam = (point: LatLng): string =>
  `${point.latitude},${point.longitude}`;

/**
 * Decodes Google's encoded polyline into `{ latitude, longitude }` points.
 *
 * This is the standard precision-5 algorithm (the same one `@mapbox/polyline`
 * implements), inlined so the admin app draws the real road without pulling in
 * a dependency for a twenty-line decode. Each coordinate is stored as a delta
 * from the last, in chunks of five bits with the low bit marking the sign.
 */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63 - 1;
      result += byte << shift;
      shift += 5;
    } while (byte >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63 - 1;
      result += byte << shift;
      shift += 5;
    } while (byte >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat * 1e-5, longitude: lng * 1e-5 });
  }

  return points;
}

export const directionsService = {
  /**
   * Returns null when there is no route, or routing is not configured.
   *
   * Null rather than a thrown error on purpose: the map falls back to the
   * straight line, which is a worse picture but still a true one — both ends
   * are where they say they are. A trip screen that failed because a routing
   * quota ran out would be the wrong trade.
   *
   * Coordinates are sent rather than place names, because the names have been
   * resolved once already and re-geocoding can land somewhere else.
   */
  async road(pickup: LatLng, drop: LatLng): Promise<RoadRoute | null> {
    try {
      const { data } = await apiClient.get<RouteResponse>(
        `${API_ORIGIN}/directions`,
        { params: { origin: asParam(pickup), destination: asParam(drop) } },
      );

      if (!data.route?.polyline) {
        return null;
      }

      return {
        path: decodePolyline(data.route.polyline),
        distanceKm: data.route.distanceKm,
        durationMinutes: data.route.durationMinutes,
        summary: data.route.summary,
      };
    } catch {
      return null;
    }
  },
};
