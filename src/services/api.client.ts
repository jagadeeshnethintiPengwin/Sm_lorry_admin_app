import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  API_ORIGIN as CONFIGURED_ORIGIN,
  USE_LOCAL_API as CONFIGURED_USE_LOCAL,
} from '@env';
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
 * `API_ORIGIN` as a usable origin, or a failure that says what is wrong.
 *
 * Two typos in this value used to surface identically, as "could not reach the
 * server" at the first request — which reads as the API being down when in fact
 * the address never could have resolved:
 *
 *   192.168.1.5.4000   a dot where the port's colon belongs
 *   http://host:4000/  a trailing slash, giving `…:4000//admin/v1`
 *
 * The slash is repaired silently because there is one obvious intent. A host
 * that cannot be what it appears to be is not repaired, because guessing which
 * dot was meant to be a colon is how you point a build somewhere unintended;
 * it throws instead, on a debug build, where the person who can fix the `.env`
 * is the person looking at the screen.
 */
function toOrigin(configured: string | undefined): string {
  const fallback = 'http://localhost:4000';
  const written = configured?.trim();
  if (!written) {
    return fallback;
  }

  const origin = written.replace(/\/+$/, '');
  if (!/^https?:\/\//.test(origin)) {
    if (__DEV__) {
      throw new Error(
        `API_ORIGIN is "${written}", which has no http:// or https:// — add one in ` +
          'SmLorryAdmin/.env, or run: npm run point-apps',
      );
    }
    return fallback;
  }

  /*
   * Only numeric hosts are checked, and only against the one thing they can be.
   * A name is left alone: this cannot know which hostnames exist, and DNS will
   * say so in a way that is already clear.
   */
  const host = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const numeric = /^[\d.]+$/.test(host);
  const octets = host.split('.');
  const isIpv4 =
    octets.length === 4 &&
    octets.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);

  if (numeric && !isIpv4 && __DEV__) {
    throw new Error(
      `API_ORIGIN is "${written}", and "${host}" cannot be an address — a port ` +
        'is separated by a colon, not a dot (192.168.1.5:4000). Fix it in ' +
        'SmLorryAdmin/.env, or run: npm run point-apps',
    );
  }

  return origin;
}

/**
 * Whether this build has been deliberately pointed at a local API.
 *
 * `API_ORIGIN` used to be enough on its own, and that is what made the address
 * hard to trust. It is inlined by Babel at transform time, and Metro computes
 * the cache key that covers `.env` when it *starts* — so editing `.env` under a
 * bundler that is already running changes nothing, and the app keeps talking to
 * an address that is no longer written down anywhere. The same file left over
 * from last week's network had the same effect, silently.
 *
 * Requiring a second, explicit flag makes going local something a developer says
 * rather than something a stale file decides. `npm run point-apps` writes both,
 * so the workflow is unchanged.
 */
const WANTS_LOCAL_API = CONFIGURED_USE_LOCAL?.trim() === 'true';

/**
 * The deployed API — the default for every build, debug ones included.
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
 *
 * The deployment is what you get unless you ask for something else, and asking
 * takes both `USE_LOCAL_API=true` and an `API_ORIGIN`. It used to be the other
 * way round — a debug build took whatever `.env` said — which meant the normal
 * case depended on a git-ignored file being right, and the failure was an app
 * pointed at an address that had not existed since the laptop last changed
 * Wi-Fi. A release build ignores both, as it always has.
 */
export const API_ORIGIN =
  __DEV__ && WANTS_LOCAL_API ? toOrigin(CONFIGURED_ORIGIN) : PRODUCTION_API;

export const API_BASE_URL = `${API_ORIGIN}/admin/v1`;

/*
 * Said once, at startup, because "which API am I actually talking to" was a
 * question the app never answered and every other answer here depends on.
 */
if (__DEV__) {
  console.log(
    `[api] ${API_BASE_URL}${WANTS_LOCAL_API ? ' (local, from .env)' : ' (deployed)'}`,
  );
}

/**
 * Whether the API is a machine on this network rather than a deployed one.
 *
 * Only used to decide what to suggest when nothing answers. "Check the phone is
 * on the same network" is the right advice for a laptop on Wi-Fi and actively
 * misleading for `https://api.simhadritransport.com`, where the LAN has nothing
 * to do with it — that reading sends somebody to their router while the real
 * cause is the handset's own connection.
 */
const IS_LOCAL_API =
  /^https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
    API_ORIGIN,
  );

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
    /*
     * Nothing answered. "Network error" is true and useless — the usual cause in
     * development is the app pointing where the API is not, and the address is
     * the one thing worth saying. What to check depends on where it points, so
     * the two cases are said separately rather than one message hedging across
     * both. Named only on a debug build; a signed-in operator has no use for it.
     */
    return Promise.reject(
      new ApiError(
        __DEV__
          ? IS_LOCAL_API
            ? `Could not reach the API at ${API_BASE_URL}.\n\n` +
              'It is a local address, so check that the API is running, that it ' +
              "is this machine's current LAN address (npm run where — it changes " +
              'with the network), and that the phone is on the same Wi-Fi.\n\n' +
              'To use the deployed API instead:\n' +
              '  npm run point-apps https://api.simhadritransport.com'
            : `Could not reach the API at ${API_BASE_URL}.\n\n` +
              'It is a deployed address, so the LAN is not involved — check the ' +
              "handset's own internet connection and that the host is up."
          : 'No connection. Check your network and try again.',
        0,
      ),
    );
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
