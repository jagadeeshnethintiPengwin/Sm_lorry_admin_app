import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_ORIGIN as CONFIGURED_ORIGIN } from '@env';
import { session } from './storage';
import { apiLog } from './api.log';

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

/**
 * The deployed API, used by every build that is not a debug build.
 *
 * Hardcoded rather than read from `.env`: a release must not depend on a file
 * that is git-ignored and absent on a build machine, and an app that silently
 * shipped pointing at a developer's laptop is worse than one that fails to
 * build. Change it here and in the sibling apps together — see the deployment
 * note in the repo README.
 */
const PRODUCTION_API = 'https://api.simhadritransport.com';

/**
 * The server root, kept separate so the role prefix is written once.
 *
 * Exported because the realtime socket connects to the origin, not to
 * `/admin/v1` — the gateway lives at `/realtime` alongside the REST surfaces.
 */
export const API_ORIGIN = __DEV__ ? LOCAL_API : PRODUCTION_API;

export const API_BASE_URL = `${API_ORIGIN}/admin/v1`;

const DEFAULT_TIMEOUT = 20_000;

/** An in-flight request, stamped so its duration can be reported. */
type TimedRequest = InternalAxiosRequestConfig & { startedAt?: number };

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

/**
 * The token now lives in MMKV, which reads synchronously — see `storage.ts`.
 *
 * The in-memory copy this used to keep is gone with it. It existed to avoid an
 * `AsyncStorage` round trip on every request, and a cache that shadows the
 * real store is a thing that can disagree with it: a logout elsewhere in the
 * app cleared storage while the stale copy kept authorising calls.
 *
 * Both are kept `async` so every existing caller still compiles; there is
 * simply nothing to wait for any more.
 */
export const setAuthToken = async (
  token: string | null,
  refreshToken?: string | null,
): Promise<void> => {
  session.save(token, refreshToken);
};

export const getAuthToken = async (): Promise<string | null> =>
  session.getToken();

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

    // Stamped here so the response side can report how long the call took.
    (config as TimedRequest).startedAt = Date.now();
    apiLog.request(config.method ?? 'get', config.url ?? '', config.data);
    return config;
  },
);

/**
 * Trades the refresh token for a new access token.
 *
 * The access token lasts fifteen minutes and nothing renewed it, so every
 * session died at the quarter-hour and dropped the operator back at the login
 * form mid-task — with a refresh token sitting unused in storage and a
 * `/auth/refresh` endpoint that has always worked.
 *
 * Uses a bare axios call rather than `apiClient`, so a failure here cannot
 * re-enter the interceptor below and recurse.
 */
async function renewSession(): Promise<string | null> {
  const refreshToken = session.getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  try {
    const { data } = await axios.post<{
      token: string;
      refreshToken?: string;
    }>(`${API_BASE_URL}/auth/refresh`, { refreshToken }, {
      timeout: DEFAULT_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    });
    session.save(data.token, data.refreshToken ?? refreshToken);
    return data.token;
  } catch {
    // The refresh token is spent or revoked; the session is genuinely over.
    session.clear();
    return null;
  }
}

/**
 * One renewal at a time.
 *
 * A screen typically fires several requests at once, so an expired token
 * produces a burst of 401s. Without this each one would start its own refresh,
 * and every refresh after the first would present a token the previous one had
 * already rotated away — turning a recoverable expiry into a forced logout.
 */
let renewal: Promise<string | null> | null = null;

function renewOnce(): Promise<string | null> {
  renewal ??= renewSession().finally(() => {
    renewal = null;
  });
  return renewal;
}

/**
 * A rejected request in one sentence.
 *
 * Nest sends a single string for most failures but an *array* of them when a
 * DTO fails validation — one per broken rule. Assigning that array to
 * `Error.message` stringified it as `Enter the model,Year must be 1980 or
 * later`, with no space after the comma and no way for a screen to tell it was
 * ever a list. Joining deliberately keeps it readable, and `payload` still
 * carries the original array for callers that want to attach each message to
 * its own field.
 */
const messageFrom = (
  data: { message?: string | string[] } | undefined,
  fallback: string,
): string => {
  const message = data?.message;
  if (Array.isArray(message)) {
    return message.join('\n') || fallback;
  }
  return message ?? fallback;
};

/** Normalises every failure into `ApiError` so callers handle one shape. */
apiClient.interceptors.response.use(
  response => {
    const started = (response.config as TimedRequest).startedAt;
    apiLog.response(
      response.config.method ?? 'get',
      response.config.url ?? '',
      response.status,
      started ? Date.now() - started : 0,
      response.data,
    );
    return response;
  },
  async (error: AxiosError) => {
    /*
     * An expired token is renewed and the request replayed, once.
     *
     * `retried` marks the replay so a token that is refused a second time
     * falls through as a real 401 instead of looping. The refresh call itself
     * never reaches here — it goes out on a bare axios instance.
     */
    const request = error.config as
      | (InternalAxiosRequestConfig & { retried?: boolean; startedAt?: number })
      | undefined;

    apiLog.failure(
      request?.method ?? 'get',
      request?.url ?? '',
      error.response?.status ?? 0,
      request?.startedAt ? Date.now() - request.startedAt : 0,
      (error.response?.data as { message?: string } | undefined)?.message ??
        error.message,
    );

    if (
      error.response?.status === 401 &&
      request &&
      !request.retried &&
      session.getRefreshToken()
    ) {
      request.retried = true;
      const token = await renewOnce();
      if (token) {
        request.headers.Authorization = `Bearer ${token}`;
        return apiClient(request);
      }
    }

    if (error.response) {
      const data = error.response.data as
        | { message?: string | string[] }
        | undefined;
      return Promise.reject(
        new ApiError(
          messageFrom(data, error.response.statusText),
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

/*
 * `USE_MOCK_DATA` and `mockDelay` lived here.
 *
 * They belonged to the reference design, which shipped without a backend and
 * served fixtures so every screen rendered the content from the HTML mock. The
 * flag had already been switched off, which left the branches behind them dead
 * — but present, and dead code that pretends to be a working fallback is worse
 * than none: it reads as an offline mode nobody maintains, and it is where a
 * screen quietly goes when its request fails.
 *
 * Every screen now reads from the API and says so when it cannot.
 */
