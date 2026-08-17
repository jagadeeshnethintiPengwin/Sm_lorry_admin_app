#!/usr/bin/env node
/**
 * Smoke test for the admin app against a running API.
 *
 * Unlike the customer and driver ones, this checks more than the app currently
 * calls — deliberately. The admin app has 27 screens and 3 of them touch the
 * API (Login, OTP, Logout); the other 24 draw static data. The backend already
 * serves 55 admin endpoints for them.
 *
 * So this runs in two parts:
 *
 *   WIRED    — what the app calls today. These must pass.
 *   AVAILABLE— what the backend offers the unwired screens. Reported as a
 *              readiness list, so wiring a screen is a matter of connecting it
 *              rather than first finding out whether the endpoint works.
 *
 *   npm run smoke
 *   npm run smoke -- --api http://192.168.1.9:4000
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function configuredOrigin() {
  const file = join(APP_ROOT, '.env');
  if (!existsSync(file)) {
    return null;
  }
  return readFileSync(file, 'utf8').match(/^API_ORIGIN=(.*)$/m)?.[1]?.trim() ?? null;
}

const args = process.argv.slice(2);
const origin =
  args[args.indexOf('--api') + 1]?.startsWith('http')
    ? args[args.indexOf('--api') + 1]
    : (configuredOrigin() ?? 'http://localhost:4000');

const BASE = `${origin}/admin/v1`;

/** A seeded owner. */
const OWNER_MOBILE = process.env.SMOKE_MOBILE ?? '+919876500001';

let token = null;
const wired = [];
const available = [];

async function callAt(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { status: response.status, ok: response.ok, body: payload };
}

const call = (method, path, body) => callAt(`${BASE}${path}`, method, body);

function describe(response) {
  if (response.ok) return null;
  const message = response.body?.message;
  return `HTTP ${response.status}${
    typeof message === 'string'
      ? ` — ${message}`
      : Array.isArray(message)
        ? ` — ${message.join('; ')}`
        : ''
  }`;
}

/**
 * Asks for a code, waiting out the per-number resend cooldown.
 *
 * The API refuses a second code for the same number inside
 * `OTP_RESEND_SECONDS` — a real control, since `otp/send` is unauthenticated and
 * a caller who can mint challenges freely has both an SMS bill and unlimited
 * guesses at six digits. This script asks three times in a row (send, resend,
 * then a clean send to verify with), so without waiting the second and third
 * both came back 429 and the suite reported broken authentication.
 *
 * Waiting rather than turning the limit off outside production: a control that
 * is disabled wherever it is inconvenient is one nobody notices has broken. The
 * refusal names the seconds remaining, so there is nothing to guess.
 */
async function callOtp(path, body) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const sent = await call('POST', path, body);
    if (sent.status !== 429) {
      return sent;
    }
    const seconds = Number(
      /(\d+)\s*second/.exec(String(sent.body?.message ?? ''))?.[1] ?? 25,
    );
    console.log(`  ...  waiting ${seconds}s for ${JSON.stringify(body.mobile)}'s resend cooldown`);
    await new Promise(resolve => setTimeout(resolve, (seconds + 1) * 1000));
  }
  return call('POST', path, body);
}

async function probe(bucket, { screen, call: request, expects }) {
  const response = await request();
  let complaint = describe(response);
  if (!complaint && expects) {
    try {
      complaint = expects(response.body) ?? null;
    } catch (error) {
      complaint = `threw while reading the response: ${error.message}`;
    }
  }
  bucket.push({ screen, ok: !complaint, complaint });
  console.log(`  ${complaint ? 'FAIL' : 'ok  '}  ${screen}${complaint ? `\n          ${complaint}` : ''}`);
  return response.body;
}

const kind = value =>
  value === null
    ? 'null'
    : Array.isArray(value)
      ? `an array of ${value.length}`
      : typeof value === 'object'
        ? `an object with keys [${Object.keys(value).join(', ')}]`
        : typeof value;

const isList = body =>
  Array.isArray(body) || Array.isArray(body?.items)
    ? null
    : `expected a list, got ${kind(body)}`;

const missing = (value, fields) => {
  if (value === null || typeof value !== 'object') {
    return `expected an object, got ${kind(value)}`;
  }
  const absent = fields.filter(f => value[f] === undefined);
  return absent.length
    ? `no ${absent.join(', ')} — the response has [${Object.keys(value).join(', ')}]`
    : null;
};

// ------------------------------------------------------------------- run

console.log(`Admin app smoke test\n  API: ${BASE}\n  as:  ${OWNER_MOBILE}\n`);
console.log('WIRED — what the app calls today');

const sent = await probe(wired, {
  screen: 'POST /auth/otp/send → verificationId',
  call: () => callOtp('/auth/otp/send', { mobile: OWNER_MOBILE }),
  expects: body => missing(body, ['verificationId', 'resendIn']),
});

const signedIn = await probe(wired, {
  screen: 'POST /auth/otp/verify → token + refreshToken',
  call: () =>
    call('POST', '/auth/otp/verify', {
      mobile: OWNER_MOBILE,
      code: sent?.devCode,
      verificationId: sent?.verificationId,
    }),
  expects: body => missing(body, ['token', 'refreshToken']),
});
token = signedIn?.token ?? null;

if (!token) {
  console.log('\nCannot continue without a session.');
  process.exit(1);
}

await probe(wired, {
  screen: 'GET /owner/profile → the account screen',
  call: () => call('GET', '/owner/profile'),
});

await probe(wired, {
  screen: 'GET /reports/dashboard → the Dashboard counts',
  call: () => call('GET', '/reports/dashboard'),
  expects: body =>
    missing(body, [
      'totalVehicles',
      'totalDrivers',
      'totalCustomers',
      'activeTrips',
      'completedTrips',
      'pendingBookings',
      'fleet',
      'drivers',
    ]),
});

await probe(wired, {
  screen: 'GET /reports/trips-per-day → the THIS WEEK bars',
  call: () => call('GET', '/reports/trips-per-day'),
  expects: body =>
    Array.isArray(body)
      ? (body.length ? missing(body[0], ['date', 'completed', 'active']) : null)
      : `expected an array, got ${kind(body)}`,
});

await probe(wired, {
  screen: 'GET /bookings → the Bookings list, with the fields it draws',
  call: () => call('GET', '/bookings?limit=100'),
  expects: body => {
    const items = Array.isArray(body) ? body : body?.items;
    if (!Array.isArray(items)) {
      return `expected a list, got ${kind(body)}`;
    }
    if (!items.length) {
      return null;
    }
    const gap = missing(items[0], [
      'id',
      'reference',
      'status',
      'pickupPlace',
      'dropPlace',
      'vehicleType',
      'pickupAt',
    ]);
    if (gap) return gap;

    /*
     * Every status the list is asked to place must have a tab.
     *
     * `COMPLETED` did not, and the screen's fallback put those bookings in
     * Pending — five delivered jobs sitting in the owner's approval queue. A
     * new status added to the API would do the same silently, so it is checked
     * here rather than discovered on screen.
     */
    const known = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
    const strays = [...new Set(items.map(b => b.status))].filter(
      status => !known.includes(status),
    );
    return strays.length
      ? `the list has statuses the tabs do not map: ${strays.join(', ')}`
      : null;
  },
});

// ------------------------------------------------------- readiness sweep

console.log('\nAVAILABLE — served by the API, not yet wired to a screen');

const sweep = [
  ['Dashboard', 'GET', '/reports/dashboard', null],
  ['Reports · trips per day', 'GET', '/reports/trips-per-day', null],
  ['Reports · top customers', 'GET', '/reports/top-customers', null],
  ['Bookings list', 'GET', '/bookings?limit=5', isList],
  ['Drivers list', 'GET', '/drivers?limit=5', isList],
  ['Drivers · available', 'GET', '/drivers/available', isList],
  ['Vehicles list', 'GET', '/vehicles?limit=5', isList],
  ['Vehicles · available', 'GET', '/vehicles/available', isList],
  ['Customers list', 'GET', '/customers?limit=5', isList],
  ['Trips list', 'GET', '/trips?limit=5', isList],
  ['Trips · live map', 'GET', '/trips/live', isList],
  ['Documents list', 'GET', '/documents?limit=5', isList],
  ['Notifications', 'GET', '/notifications', isList],
  ['Notifications · unread count', 'GET', '/notifications/unread-count', b => missing(b, ['count'])],
];

for (const [screen, method, path, expects] of sweep) {
  await probe(available, {
    screen: `${method} ${path} → ${screen}`,
    call: () => call(method, path),
    expects: expects ?? undefined,
  });
}

await probe(wired, {
  screen: 'POST /auth/logout',
  call: () => call('POST', '/auth/logout', {}),
});

// ------------------------------------------------------------------ tally

const wiredBad = wired.filter(r => !r.ok);
const availableBad = available.filter(r => !r.ok);

console.log(`\n${'—'.repeat(64)}`);
console.log(`  wired      ${wired.length - wiredBad.length}/${wired.length} passing`);
console.log(`  available  ${available.length - availableBad.length}/${available.length} ready for the screens that need them`);

if (availableBad.length) {
  console.log('\n  not ready:');
  availableBad.forEach(r => console.log(`    · ${r.screen} — ${r.complaint}`));
}

// Only the wired half can fail the run: the rest is a readiness report.
process.exit(wiredBad.length ? 1 : 0);
