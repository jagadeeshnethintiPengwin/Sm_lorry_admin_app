import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ORIGIN as CONFIGURED_ORIGIN } from '@env';

/**
 * Axios instance shared by every service. Screens never call the network
 * directly — they go through a service, which goes through this client.
 */
/**
 * The SMT backend. All four apps talk to the same NestJS service; each gets
 * its own role-scoped surface.
 *
 * In development the address comes from `.env`, because it depends on where
 * the API is running and who is looking at it:
 *
 *   - a simulator or an emulator with `adb reverse tcp:4000 tcp:4000`
 *     can use `http://localhost:4000`;
 *   - a real handset cannot — `localhost` is the phone itself — and needs the
 *     LAN address of the machine serving the API, which changes with the
 *     network it joins.
 *
 * `npm run point-apps` in the repo root writes that address into every app.
 * The fallback below only applies to a checkout with no `.env` yet.
 */
const LOCAL_API = CONFIGURED_ORIGIN ?? 'http://localhost:4000';

export const API_BASE_URL = __DEV__
  ? `${LOCAL_API}/admin/v1`
  : 'https://api.simhadritransport.com/admin/v1';

const TOKEN_KEY = '@smt_admin/access_token';
const DEFAULT_TIMEOUT = 20_000;

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

let inMemoryToken: string | null = null;

export const setAuthToken = async (token: string | null): Promise<void> => {
  inMemoryToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  inMemoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return inMemoryToken;
};

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

/** Attaches the bearer token to every non-anonymous request. */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers?.['X-Anonymous']) {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else {
      delete config.headers['X-Anonymous'];
    }
    return config;
  },
);

/** Normalises every failure into `ApiError` so callers handle one shape. */
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    if (error.response) {
      const data = error.response.data as { message?: string } | undefined;
      return Promise.reject(
        new ApiError(
          data?.message ?? error.response.statusText,
          error.response.status,
          error.response.data,
        ),
      );
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError('Request timed out', 408));
    }
    return Promise.reject(new ApiError(error.message || 'Network error', 0));
  },
);

/**
 * The reference design ships without a backend. Services fall back to the
 * fixtures in `mock.data.ts` so every screen renders exactly the content shown
 * in `admin-mobile-app.html`. Flip to `false` once the API is live.
 */
/** Flipped off now that the API is live; set true to work offline. */
export const USE_MOCK_DATA = false;

/** Simulates latency so loading states are exercised in development. */
export const mockDelay = <T>(value: T, ms = 350): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(value), ms));
