import type { IconName } from '@components/index';
import type { ReportRow } from '@services/report.service';

/**
 * The report catalogue, mirroring the web admin's `/reports/*` screens.
 *
 * Each report is drawn as a card list rather than a wide table: a heading, a
 * route or context line, a secondary detail, and the money the row turns on
 * (revenue or expenses). Rows come from `GET /reports/table/:kind` — the same
 * endpoint the web reports read — so the two surfaces can never disagree.
 */

/** Reads a nested value by dotted path without a dependency. */
const at = (record: ReportRow, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc as Record<string, unknown> | undefined)?.[key],
      record,
    );

const text = (v: unknown): string =>
  v == null || v === '' ? '—' : String(v);

/** `₹1,23,456` from a numeric-ish value, else `—`. */
export const rupee = (v: unknown): string => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n)
    ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
        Math.round(n),
      )}`
    : '—';
};

export type ReportDef = {
  kind: string;
  title: string;
  blurb: string;
  icon: IconName;
  /** The row's headline. */
  primary: (r: ReportRow) => string;
  /** The quieter line under it. */
  secondary: (r: ReportRow) => string;
  /** A short trailing tag (driver, vehicle, location). */
  meta: (r: ReportRow) => string;
  /** The money the report turns on, right-aligned; null hides the chip. */
  value: ((r: ReportRow) => string) | null;
  /** What a search box matches against. */
  search: (r: ReportRow) => string;
};

export const REPORT_DEFS: ReportDef[] = [
  {
    kind: 'trips',
    title: 'Trip Report',
    blurb: 'Every completed trip — route, driver, revenue and date',
    icon: 'package-search',
    primary: r => `#${text(at(r, 'reference'))}`,
    secondary: r =>
      `${text(at(r, 'booking.pickupPlace'))} → ${text(at(r, 'booking.dropPlace'))}`,
    meta: r => text(at(r, 'driver.user.name')),
    value: r => rupee(at(r, 'booking.fareEstimate')),
    search: r =>
      [
        at(r, 'reference'),
        at(r, 'booking.customer.company'),
        at(r, 'driver.user.name'),
        at(r, 'vehicle.registration'),
      ]
        .map(text)
        .join(' '),
  },
  {
    kind: 'invoice',
    title: 'Invoice Report',
    blurb: 'Billed invoices — one per delivered trip, fare and GST',
    icon: 'file-text',
    primary: r => `#${text(at(r, 'booking.reference'))}`,
    secondary: r => text(at(r, 'booking.customer.company')),
    meta: r => `Trip #${text(at(r, 'reference'))}`,
    value: r => rupee(at(r, 'booking.fareEstimate')),
    search: r =>
      [at(r, 'booking.reference'), at(r, 'booking.customer.company'), at(r, 'reference')]
        .map(text)
        .join(' '),
  },
  {
    kind: 'vehicles',
    title: 'Vehicle Report',
    blurb: 'Fleet performance — trips run, revenue and costs',
    icon: 'package-check',
    primary: r => text(at(r, 'registration')),
    secondary: r =>
      `${text(at(r, 'tripCount'))} trips · ${text(at(r, 'type'))}`,
    meta: r => text(at(r, 'driver.user.name')),
    value: r => rupee(at(r, 'revenue')),
    search: r =>
      [at(r, 'registration'), at(r, 'type'), at(r, 'driver.user.name')]
        .map(text)
        .join(' '),
  },
  {
    kind: 'drivers',
    title: 'Driver Report',
    blurb: 'Roster & performance — trips run and expenses',
    icon: 'user-cog',
    primary: r => text(at(r, 'user.name')),
    secondary: r =>
      `${text(at(r, 'totalTrips'))} trips · ${text(at(r, 'status'))}`,
    meta: r => text(at(r, 'vehicle.registration')),
    value: r => rupee(at(r, 'expenses')),
    search: r =>
      [at(r, 'user.name'), at(r, 'user.mobile'), at(r, 'vehicle.registration')]
        .map(text)
        .join(' '),
  },
  {
    kind: 'customers',
    title: 'Customer Report',
    blurb: 'Accounts — bookings placed and revenue billed',
    icon: 'building-2',
    primary: r => text(at(r, 'company')),
    secondary: r => `${text(at(r, '_count.bookings'))} bookings`,
    meta: r => `${text(at(r, 'city'))}, ${text(at(r, 'state'))}`,
    value: r => rupee(at(r, 'revenue')),
    search: r =>
      [at(r, 'company'), at(r, 'contactName'), at(r, 'city'), at(r, 'state')]
        .map(text)
        .join(' '),
  },
];

export const reportDefByKind = (kind: string): ReportDef | undefined =>
  REPORT_DEFS.find(d => d.kind === kind);
