import { API_ORIGIN, apiClient } from './api.client';

/**
 * Address lookups, the same the web panel uses.
 *
 * The office typed pickup and drop points by hand, so the same yard arrived
 * spelled three ways and a booking carried a place name with no address and no
 * coordinates for the live map. This is the type-ahead behind those fields:
 * Google's matches, proxied through the API so the mapping key stays
 * server-side, then the address and latitude/longitude behind a chosen one.
 *
 * These live at the server root (`/places/*`), not under `/admin/v1`, so the
 * full origin is named rather than leaning on `apiClient`'s base path — the
 * bearer token is still attached by its request interceptor.
 *
 * Everything is best-effort: an unconfigured map or an offline moment returns
 * nothing, and the field stays a plain box the operator types into.
 */
export type PlaceSuggestion = {
  id: string;
  /** The whole match on one line. */
  label: string;
  /** The name to show boldest — "Kompally", or "Kompally Bus Stop". */
  primary: string;
  /** The area beneath it — "Hyderabad, Telangana, India". */
  secondary?: string;
};

export type PlaceDetail = {
  /** The full formatted address. */
  address: string;
  /** The locality on its own — "Kompally" — for the short place name. */
  place: string;
  summary?: string;
  latitude: number;
  longitude: number;
};

export const placesService = {
  /** Suggestions for what has been typed. `session` groups a run of keystrokes. */
  search: async (q: string, session: string): Promise<PlaceSuggestion[]> => {
    const query = q.trim();
    if (query.length < 2) {
      return [];
    }
    try {
      const { data } = await apiClient.get<{ results?: PlaceSuggestion[] }>(
        `${API_ORIGIN}/places/search`,
        { params: { q: query, session } },
      );
      return data.results ?? [];
    } catch {
      return [];
    }
  },

  /** The address + coordinates behind a suggestion. `session` matches its search. */
  details: async (id: string, session: string): Promise<PlaceDetail | null> => {
    try {
      const { data } = await apiClient.get<{ place?: PlaceDetail | null }>(
        `${API_ORIGIN}/places/details`,
        { params: { id, session } },
      );
      return data.place ?? null;
    } catch {
      return null;
    }
  },
};
