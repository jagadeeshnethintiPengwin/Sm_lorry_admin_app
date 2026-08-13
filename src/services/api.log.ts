/**
 * A one-line trace of every API call, in development only.
 *
 * Debugging "why is this screen empty" meant guessing whether the request was
 * sent, what it answered, and how long it took. The Network tab is not
 * available in a release-mode reload and Flipper is another thing to install,
 * so the log is where the answer should be.
 *
 * Two rules make this safe to leave in:
 *
 *   - it is fenced behind `__DEV__`, so nothing reaches a production build;
 *   - it never prints a credential. Bearer tokens, PINs, OTP codes, passwords
 *     and refresh tokens are replaced before anything is written, because a
 *     log is copied into bug reports and pasted into chats.
 */

/** Field names whose value must never appear in a log. */
const SECRET = /^(pin|currentPin|code|password|token|accessToken|refreshToken|otp)$/i;

/** `+919876500001` → `+9198765***01`, enough to identify without exposing. */
const maskMobile = (value: string): string =>
  value.length > 6
    ? `${value.slice(0, value.length - 4)}**${value.slice(-2)}`
    : value;

/**
 * A body with its secrets removed.
 *
 * Recurses, because the interesting payloads are nested — a booking carries a
 * customer, a sign-in carries a verification. Arrays are walked for the same
 * reason. Anything that is not a plain object is returned as-is.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => redact(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET.test(key)) {
      out[key] = '***';
    } else if (key === 'mobile' && typeof item === 'string') {
      out[key] = maskMobile(item);
    } else {
      out[key] = redact(item, depth + 1);
    }
  }
  return out;
}

/** How many rows a list answered with, so an empty screen is explicable. */
function describe(data: unknown): string {
  if (Array.isArray(data)) {
    return ` ${data.length} items`;
  }
  if (data && typeof data === 'object') {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) {
      const total = (data as { meta?: { total?: number } }).meta?.total;
      return ` ${items.length} items${total !== undefined ? ` of ${total}` : ''}`;
    }
  }
  return '';
}

const short = (body: unknown): string => {
  if (body === undefined || body === null) {
    return '';
  }
  try {
    const text = JSON.stringify(redact(body));
    return text.length > 200 ? ` ${text.slice(0, 200)}…` : ` ${text}`;
  } catch {
    return '';
  }
};

export const apiLog = {
  request(method: string, url: string, body?: unknown): void {
    if (!__DEV__) {
      return;
    }
    console.log(`→ ${method.toUpperCase()} ${url}${short(body)}`);
  },

  response(method: string, url: string, status: number, ms: number, data?: unknown): void {
    if (!__DEV__) {
      return;
    }
    console.log(
      `← ${status} ${method.toUpperCase()} ${url} ${Math.round(ms)}ms${describe(data)}`,
    );
  },

  failure(method: string, url: string, status: number, ms: number, message: string): void {
    if (!__DEV__) {
      return;
    }
    // `warn` rather than `error`: a 401 on a stored token is an ordinary part
    // of startup, and a red box for it trains people to ignore red boxes.
    console.warn(
      `✗ ${status || 'ERR'} ${method.toUpperCase()} ${url} ${Math.round(ms)}ms — ${message}`,
    );
  },
};
