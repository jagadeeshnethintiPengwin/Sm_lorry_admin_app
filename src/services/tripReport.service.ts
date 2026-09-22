import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import * as XLSX from 'xlsx';

import { apiClient } from './api.client';
import { documentService, tripService } from './fleet.service';
import type { AdminDocument, Halt, TripFinance } from './fleet.service';
import type { LatLng } from '@components/common/TripMap';

/**
 * The trip's endpoints and halts, passed alongside the trip so the report can
 * draw the route map and list where the lorry stopped — the two things the web
 * admin's PDF carries that the trip record alone does not.
 */
export type ReportExtras = {
  halts?: Halt[];
  pickup?: LatLng | null;
  drop?: LatLng | null;
};

/** `1h 05m` / `45 min` — a halt's duration, read for the report. */
function haltDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) {
    return `${m} min`;
  }
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Trip report exports — the mobile twin of the web admin's
 * `lib/report-export.ts` and `TripProfile.tsx` (buildTripSections /
 * tripReportImages).
 *
 * The office wanted the same "download the trip report" the web panel has: a
 * labelled `.xlsx` a clerk can file or total, and a `.pdf` that carries the
 * delivery photographs and the document scans inside it — the one format that
 * keeps the facts and the pictures together in something you can email or
 * print. This builds both on the handset and hands them to the OS share sheet.
 *
 * The libraries are native (`react-native-share`, `react-native-html-to-pdf`)
 * plus a pure-JS workbook writer (`xlsx`); all three are only touched when a
 * button is pressed, so a screen that never exports pays nothing for them.
 */

/** A titled block of label/value rows — the report, structured. */
export type ReportSection = { title: string; rows: Array<[string, string]> };

/** A picture to embed in the PDF — a delivery photo or a document scan. */
export type ReportImage = { caption: string; url: string };

/**
 * A trip as the detail screen reads it — deliberately loose, mirroring the API
 * rather than inventing a second model. `tripService.get` hands back a
 * `Record<string, unknown>`, and this reads the fields it needs off it.
 */
type TripLike = Record<string, any>;

/** A delivery photo, once resolved to a caption and a displayable URL. */
type PodPhoto = { id: string; caption: string; url: string };

/** A filed paper — a scan, an invoice, an e-way bill — with its image flag. */
type TripDoc = {
  id: string;
  name: string;
  kind: string;
  url: string | null;
  isImage: boolean;
};

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * How the document kinds fold, matching the web: a goods receipt (the
 * consignment note under its several names), an invoice, and everything else a
 * loose paper. A photographed invoice is still an invoice — it belongs under
 * Invoice, not in the delivery gallery.
 */
const GOODS_RECEIPT_KINDS = new Set([
  'LR',
  'WAYBILL',
  'CHALLAN',
  'EWAY',
  'GR',
  'GOODS_RECEIPT',
]);
const isGoodsReceiptKind = (kind: string): boolean =>
  GOODS_RECEIPT_KINDS.has(kind);
const isInvoiceKind = (kind: string): boolean =>
  kind === 'INVOICE' || kind === 'BILL';

/** Is this file an image (so it can be drawn in the PDF rather than listed)? */
function isImageFile(name: string, fileUrl: string | null): boolean {
  const ext = (
    name.match(/\.([a-z0-9]+)$/i)?.[1] ??
    fileUrl?.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] ??
    ''
  ).toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp'].includes(ext);
}

/** `₹1,23,456` — the same rupee formatting the app uses on its money screens. */
const rupees = (n: number): string =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    Math.round(Number.isFinite(n) ? n : 0),
  )}`;

/** `03 Sep 2026`. */
const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/** `03 Sep 2026, 2:45 PM` — a date with its time, for the timeline and schedule. */
const timeOf = (iso: string): string => {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) {
    return '—';
  }
  return `${when.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${when.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
};

/**
 * Splits the merged document rows the way the web does: delivery snaps into a
 * photo gallery, everything else into papers grouped by kind.
 *
 * The web signs each image before it can show it; here the rows already carry a
 * public CDN `fileUrl` (`https://cdn.simhadritransport.com/...`), so a photo is
 * used directly. A row with no `fileUrl` is dropped rather than shown broken.
 */
export function splitTripDocs(docs: AdminDocument[]): {
  photos: PodPhoto[];
  otherDocs: TripDoc[];
} {
  const rows = (docs ?? []).map(d => {
    const fileUrl = (d.fileUrl as string | null | undefined) ?? null;
    const name = String(d.name ?? 'Document');
    const kind = String(d.kind ?? 'OTHER');
    return {
      id: String(d.id),
      name,
      kind,
      fileUrl,
      isImage: Boolean(fileUrl) && isImageFile(name, fileUrl),
    };
  });

  // A delivery snap is an image that is not itself a goods receipt or invoice —
  // the driver's photo of the load at the drop.
  const isDeliveryPhoto = (r: (typeof rows)[number]): boolean =>
    Boolean(r.fileUrl) &&
    r.isImage &&
    !isGoodsReceiptKind(r.kind) &&
    !isInvoiceKind(r.kind);

  const photos: PodPhoto[] = rows
    .filter(isDeliveryPhoto)
    .map((r, i) => ({
      id: r.id,
      caption: r.name || `PHOTO ${i + 1}`,
      url: r.fileUrl as string,
    }));

  const otherDocs: TripDoc[] = rows
    .filter(r => !isDeliveryPhoto(r))
    .map(r => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      url: r.fileUrl,
      isImage: r.isImage,
    }));

  return { photos, otherDocs };
}

/**
 * The trip as structured sections — the single source of truth for what the
 * Excel and PDF exports say. Mirrors the web's `buildTripSections`: same order,
 * same facts, every value a label/value pair so a spreadsheet gets real cells
 * and a PDF gets a laid-out block. Reads only fields the mobile trip actually
 * carries and omits a row gracefully when a field is absent.
 */
export function buildTripSections(
  trip: TripLike,
  finance: TripFinance | null,
  photos: PodPhoto[],
  otherDocs: TripDoc[],
  extras: ReportExtras = {},
): ReportSection[] {
  const halts = extras.halts ?? [];
  const b: Record<string, any> = trip.booking ?? {};
  const distance = Number(trip.distanceKm || b.distanceKm || 0);
  const covered = Number(trip.coveredKm ?? 0);
  const progress =
    distance > 0 ? Math.min(100, Math.round((covered / distance) * 100)) : 0;
  const weight = b.weightTons != null ? `${Number(b.weightTons)} t` : '—';
  const fmt = (iso: string | null | undefined) => (iso ? timeOf(iso) : '—');
  const row = (label: string, value: string): [string, string] => [
    label,
    value,
  ];

  // Money — revenue, what has been received, and every payment and expense line
  // item, exactly as the web lays them out. Falls back to the booking's fare
  // estimate when the finance read is unavailable.
  const finRevenue = finance?.revenue ?? Number(b.fareEstimate ?? 0);
  const financeRows: Array<[string, string]> = [
    row('Revenue (fare)', rupees(finRevenue)),
  ];
  if (finance && finance.gst > 0) {
    financeRows.push(row('GST', rupees(finance.gst)));
  }
  financeRows.push(row('Received', rupees(finance?.received ?? 0)));
  financeRows.push(row('Balance due', rupees(finance?.balance ?? finRevenue)));
  (finance?.payments?.items ?? []).forEach(p =>
    financeRows.push(
      row(
        `Payment · ${dateOf(p.paidAt)} · ${p.mode}`,
        `${rupees(Number(p.amount))}${p.reference ? ` (${p.reference})` : ''}`,
      ),
    ),
  );
  financeRows.push(row('Trip expenses', rupees(finance?.expenses ?? 0)));
  (finance?.costs?.items ?? []).forEach(e =>
    financeRows.push(
      row(
        `Expense · ${dateOf(e.spentAt)} · ${e.category}`,
        `${rupees(Number(e.amount))}${e.note ? ` — ${e.note}` : ''}`,
      ),
    ),
  );
  financeRows.push(
    row('Net (revenue − expenses)', rupees(finance?.net ?? finRevenue)),
  );

  const customer: Record<string, any> = b.customer ?? {};
  const customerName =
    customer.company || customer.user?.name || customer.contactName || '—';
  const customerPhone = customer.user?.mobile ?? customer.mobile ?? '';

  const vehicle: Record<string, any> = trip.vehicle ?? {};
  const driver: Record<string, any> = trip.driver ?? {};
  const events: Array<Record<string, any>> = Array.isArray(trip.events)
    ? trip.events
    : [];

  const receiverName = trip.receiverName ?? b.receiverName ?? '—';
  const receiverPhone = trip.receiverPhone ?? b.receiverPhone;

  return [
    {
      title: 'Trip',
      rows: [
        row('Trip', `#${trip.reference ?? '—'}`),
        row('Status', String(trip.status ?? '—').replace(/_/g, ' ')),
        ...(b.reference ? [row('Booking', `#${b.reference}`)] : []),
        row('Generated', new Date().toLocaleString('en-IN')),
      ],
    },
    {
      title: 'Route',
      rows: [
        row('From', String(b.pickupPlace ?? '—')),
        row('To', String(b.dropPlace ?? '—')),
        ...(b.pickupAddress
          ? [row('Pickup address', String(b.pickupAddress))]
          : []),
        ...(b.dropAddress ? [row('Drop address', String(b.dropAddress))] : []),
        row('Distance', `${Math.round(distance)} km`),
        row('Covered', `${Math.round(covered)} km (${progress}%)`),
      ],
    },
    {
      title: 'Consignment',
      rows: [
        row(
          'Customer',
          `${customerName}${
            customer.user?.name && customer.company
              ? ` (${customer.user.name})`
              : ''
          }`,
        ),
        ...(customerPhone ? [row('Customer phone', String(customerPhone))] : []),
        row('Material', `${b.material ?? '—'} · ${weight}`),
        ...(b.senderName
          ? [
              row(
                'Sender',
                `${b.senderName}${
                  b.senderPhone ? ` · ${b.senderPhone}` : ''
                }`,
              ),
            ]
          : []),
        row(
          'Received by',
          `${receiverName}${receiverPhone ? ` · ${receiverPhone}` : ''}`,
        ),
      ],
    },
    {
      title: 'Carrier',
      rows: [
        row(
          'Vehicle',
          `${vehicle.registration ?? '—'} · ${vehicle.type ?? '—'}${
            vehicle.capacity ? ` · ${vehicle.capacity}` : ''
          }`,
        ),
        ...(vehicle.make || vehicle.model
          ? [
              row(
                'Make/Model',
                [vehicle.make, vehicle.model, vehicle.year]
                  .filter(Boolean)
                  .join(' '),
              ),
            ]
          : []),
        row(
          'Driver',
          `${driver.user?.name ?? '—'}${
            driver.user?.mobile ? ` · ${driver.user.mobile}` : ''
          }`,
        ),
      ],
    },
    { title: 'Revenue & Finance', rows: financeRows },
    {
      title: 'Schedule',
      rows: [
        row('Pickup date', b.pickupAt ? dateOf(b.pickupAt) : '—'),
        row('Started', fmt(trip.startedAt)),
        row('Delivered', fmt(trip.deliveredAt)),
        ...(trip.remarks ? [row('Remarks', String(trip.remarks))] : []),
        ...(trip.cancelReason
          ? [row('Cancel reason', String(trip.cancelReason))]
          : []),
      ],
    },
    {
      title: 'Timeline',
      rows: events.length
        ? events.map(e =>
            row(
              e.occurredAt ? timeOf(String(e.occurredAt)) : '—',
              `${e.label ?? e.stage ?? '—'}${e.note ? ` — ${e.note}` : ''}`,
            ),
          )
        : [row('—', 'No events recorded.')],
    },
    {
      title: 'Location',
      rows: [
        row(
          'Pickup',
          extras.pickup
            ? `${extras.pickup.latitude.toFixed(5)}, ${extras.pickup.longitude.toFixed(5)}`
            : '—',
        ),
        row(
          'Drop',
          extras.drop
            ? `${extras.drop.latitude.toFixed(5)}, ${extras.drop.longitude.toFixed(5)}`
            : '—',
        ),
      ],
    },
    /*
     * A summary only. Each stop's own facts — when it started, when the lorry
     * moved off, where, how long, why and who recorded it — are a table in the
     * PDF and their own columns in the workbook; squeezing all six into one
     * label/value line, as this used to, left the end time and the auto/driver
     * distinction out altogether.
     */
    {
      title: `Halts (${halts.length})`,
      rows: halts.length
        ? [
            row(
              'Total time stopped',
              `${haltDuration(
                halts.reduce((sum, h) => sum + (h.minutes || 0), 0),
              )} across ${halts.length} ${halts.length === 1 ? 'stop' : 'stops'}`,
            ),
            ...halts.map((h, i) =>
              row(
                `Halt ${i + 1}${h.place ? ` · ${h.place}` : ''}`,
                [
                  h.source === 'manual' ? 'Driver logged' : 'Automatic',
                  timeOf(h.startedAt),
                  h.ongoing
                    ? `${haltDuration(h.minutes)} so far (still stopped)`
                    : `${haltDuration(h.minutes)} · moved off ${
                        h.endedAt ? timeOf(h.endedAt) : '—'
                      }`,
                  h.reason ?? null,
                  h.note ? `— ${h.note}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              ),
            ),
          ]
        : [row('—', 'No long stops recorded.')],
    },
    {
      title: `Documents (${photos.length + otherDocs.length})`,
      rows:
        photos.length || otherDocs.length
          ? [
              ...photos.map((p, i) => row(`Photo ${i + 1}`, p.caption)),
              ...otherDocs.map(d => row(d.kind, d.name)),
            ]
          : [row('—', 'None on file.')],
    },
  ];
}

/** The trip's pictures — delivery photos and image scans — for the PDF. */
export function tripReportImages(
  photos: PodPhoto[],
  otherDocs: TripDoc[],
): ReportImage[] {
  return [
    ...photos.map(p => ({ caption: p.caption, url: p.url })),
    ...otherDocs
      .filter(d => d.isImage && d.url)
      .map(d => ({ caption: `${d.kind}: ${d.name}`, url: d.url as string })),
  ];
}

/** A filename-safe reference — `#TR/2026 8836` must not become a path. */
const safeRef = (trip: TripLike): string =>
  String(trip.reference ?? trip.id ?? 'trip').replace(/[^A-Za-z0-9._-]+/g, '-');

/**
 * Hands a built file to the OS share sheet.
 *
 * `react-native-share` rejects when the user dismisses the sheet, even with
 * `failOnCancel: false` on some platforms, so a cancel is caught and treated as
 * the non-event it is — only a real failure is re-thrown for the screen to show.
 */
async function shareFile(options: {
  url: string;
  type: string;
  filename?: string;
}): Promise<void> {
  try {
    /*
     * `useInternalStorage` is what makes a generated file shareable at all.
     *
     * react-native-share writes the file behind a data URL to a temp path and
     * then hands it out through its own FileProvider. Its roots cover only the
     * app's INTERNAL cache and the public Downloads folder — not the external
     * cache it writes to by default. So the default path lands in
     * `Android/data/…/cache/Download/…`, `compatUriFromFile` finds no matching
     * root and returns null, and the share crashes on `Uri.getScheme()` of
     * null. Writing to internal storage puts the file under the `<cache-path>`
     * root the provider does declare, and the share goes through.
     */
    await Share.open({
      failOnCancel: false,
      useInternalStorage: true,
      ...options,
    });
  } catch (failure) {
    const message =
      failure instanceof Error ? failure.message : String(failure);
    if (/cancel|dismiss|user did not share/i.test(message)) {
      return;
    }
    throw failure;
  }
}

/**
 * The report as a real `.xlsx` — one sheet, each section a heading row followed
 * by its label/value pairs with a blank row between, so it reads top to bottom
 * like the report but every value sits in its own cell.
 *
 * Written to base64 (there is no filesystem write on a phone the way the web's
 * `writeFile` assumes) and handed straight to the share sheet as a data URL.
 */
export async function exportTripExcel(
  trip: TripLike,
  finance: TripFinance | null,
  docs: AdminDocument[],
  extras: ReportExtras = {},
): Promise<void> {
  const { photos, otherDocs } = splitTripDocs(docs);
  const sections = buildTripSections(trip, finance, photos, otherDocs, extras);
  const title = `SMT Simhadri Transport — Trip #${trip.reference ?? trip.id ?? ''}`;

  const aoa: string[][] = [[title], []];
  for (const section of sections) {
    aoa.push([section.title]);
    for (const [label, value] of section.rows) {
      aoa.push([label, value]);
    }
    aoa.push([]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [{ wch: 26 }, { wch: 64 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Trip Report');
  const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });

  await shareFile({
    url: `data:${XLSX_MIME};base64,${base64}`,
    // No extension: react-native-share appends one derived from the mime type,
    // so `...xlsx` here would be written out as `...xlsx.xlsx`.
    filename: `SMT-Trip-${safeRef(trip)}`,
    type: XLSX_MIME,
  });
}

/** One `<td>`-safe string, for the report table this still renders locally. */
const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Bytes to base64, without pulling in a polyfilled `Buffer`.
 *
 * Bitwise is what base64 is — the lint rule guards against accidental `&` where
 * `&&` was meant, which is not what any of this is.
 */
/* eslint-disable no-bitwise */
function base64Of(bytes: Uint8Array): string {
  const CHARS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += CHARS[a >> 2];
    out += CHARS[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? '=' : CHARS[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? '=' : CHARS[c & 63];
  }
  return out;
}

/* eslint-enable no-bitwise */

/** Which paper to ask the API for. */
export type TripDocumentKind = 'report' | 'invoice' | 'pod';

/**
 * One of the trip's papers, downloaded from the API and saved to the phone.
 *
 * This app used to build its PDFs on the handset: the HTML was assembled here
 * and converted by `react-native-html-to-pdf`, from a second, simpler
 * implementation of documents the web panel drew its own way. The same trip
 * produced two different papers depending on which one printed it. They are
 * rendered by the API now — photos read straight out of storage, the route map
 * fetched with a key that never leaves the server — so the office hands over
 * the same file whichever surface it came from.
 *
 * Through `apiClient`, so a token that expired while the screen was open is
 * refreshed and the request retried, exactly as every other call here is.
 */
export async function exportTripDocument(
  trip: TripLike,
  kind: TripDocumentKind,
): Promise<void> {
  const key = String(trip.id ?? trip.reference ?? '');
  const { data, headers } = await apiClient.get<ArrayBuffer>(
    `/trips/${encodeURIComponent(key)}/documents/${kind}.pdf`,
    { responseType: 'arraybuffer' },
  );

  const bytes = new Uint8Array(data);
  if (bytes.length === 0) {
    throw new Error('The document came back empty.');
  }

  /*
   * The name the server chose, when it stated one. It knows the convention —
   * `SMT-Invoice-SMB141` is built from the booking's reference, not the trip's
   * — and repeating that rule here is how the two drift apart.
   */
  const disposition = String(
    (headers as Record<string, unknown>)?.['content-disposition'] ?? '',
  );
  const named = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const fallback = `SMT-${kind === 'invoice' ? 'Invoice' : kind === 'pod' ? 'POD' : 'Trip'}-${safeRef(trip)}.pdf`;

  await savePdf(base64Of(bytes), named || fallback);
}

/**
 * Writes a PDF where the person can find it again, and offers to open it.
 *
 * "Download" means different things on the two platforms, and pretending
 * otherwise is how a file ends up somewhere nobody can reach.
 *
 * The bytes are written into the app's own storage first either way, because
 * that is the only place it may write without asking for anything. On
 * **Android** the file is then copied into the public **Downloads** collection
 * through the MediaStore — the scoped-storage way, which needs no permission on
 * Android 10 and later and puts the document where the Files app and every
 * browser download lives. Then it is opened, if anything on the phone reads
 * PDFs.
 *
 * On **iOS** there is no shared Downloads folder. The documents directory is
 * what the Files app lists under "On My iPhone → SMT Admin", so the file is
 * left there and previewed, from where it can be saved or sent on.
 */
async function savePdf(base64: string, filename: string): Promise<void> {
  const name = filename.replace(/[^A-Za-z0-9._-]+/g, '-');
  const { fs, android, ios, MediaCollection } = ReactNativeBlobUtil;

  // The app's own copy. On iOS this *is* the download; on Android it is the
  // source the MediaStore copies from, and it is cleaned up afterwards.
  const local = `${fs.dirs.DocumentDir}/${name}`;
  await fs.writeFile(local, base64, 'base64');

  if (Platform.OS !== 'android') {
    await ios.openDocument(local);
    return;
  }

  try {
    await MediaCollection.copyToMediaStore(
      { name, parentFolder: '', mimeType: 'application/pdf' },
      'Download',
      local,
    );
  } catch (error) {
    /*
     * The MediaStore is Android 10 and later. On anything older the copy fails
     * and the file stays in the app's own documents, which is still openable —
     * so the document is not lost, it is only somewhere less convenient.
     */
    if (__DEV__) {
      console.warn('[pdf] could not copy into Downloads', error);
    }
  }

  try {
    await android.actionViewIntent(local, 'application/pdf');
  } catch {
    // No PDF reader installed. The file is saved either way, which is what was
    // asked for; opening it was the courtesy.
  }
}

/** The trip report — details, route map, halts, photos and scans. */
export const exportTripPdf = (trip: TripLike): Promise<void> =>
  exportTripDocument(trip, 'report');

/** The customer's tax invoice. */
export const exportTripInvoice = (trip: TripLike): Promise<void> =>
  exportTripDocument(trip, 'invoice');

/** The proof of delivery, with the driver's photos at the drop. */
export const exportTripPod = (trip: TripLike): Promise<void> =>
  exportTripDocument(trip, 'pod');

// ------------------------------------------------------------ report tables
// The Reports screen's own downloads: the table the operator is looking at, and
// — on the trip and invoice reports — the full document behind a single row,
// which the web panel offers from the same table.

/** A report table flattened for export: a header row and its data rows. */
export type ReportTable = { headers: string[]; rows: string[][] };

/** Excel cannot take these in a sheet name, and caps it at 31 characters. */
const sheetNameOf = (title: string): string =>
  title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report';

/**
 * A report table as a real `.xlsx`, each column sized to its widest cell —
 * the same workbook the panel's "Export Excel" writes.
 */
export async function exportReportTableExcel(
  fileBase: string,
  title: string,
  table: ReportTable,
): Promise<void> {
  const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  sheet['!cols'] = table.headers.map((header, col) => {
    const widest = Math.max(
      header.length,
      ...table.rows.map(row => String(row[col] ?? '').length),
    );
    return { wch: Math.min(Math.max(widest + 2, 10), 60) };
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetNameOf(title));

  const base64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  await shareFile({
    url: `data:${XLSX_MIME};base64,${base64}`,
    filename: `${fileBase}.xlsx`,
    type: XLSX_MIME,
  });
}

/**
 * The same table as a PDF.
 *
 * The panel offers only the workbook, because a laptop opens one. A phone
 * mostly does not — a spreadsheet mailed to yourself is a poor way to read a
 * report on the road — so the rows are also laid out as a printed table, which
 * any handset opens and any office can file.
 */
export async function exportReportTablePdf(
  fileBase: string,
  title: string,
  table: ReportTable,
): Promise<void> {
  const head = table.headers.map(h => `<th>${esc(h)}</th>`).join('');
  const body = table.rows
    .map(
      row =>
        `<tr>${table.headers
          .map((_, col) => `<td>${esc(String(row[col] ?? '—'))}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #0d2647; padding: 18px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  .meta { color: #64748b; font-size: 10px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th {
    text-align: left; background: #0d2647; color: #fff; padding: 6px 5px;
    font-size: 8px; letter-spacing: 0.6px; text-transform: uppercase;
  }
  td { padding: 5px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f9fc; }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <div class="meta">${table.rows.length} row${
    table.rows.length === 1 ? '' : 's'
  } &middot; generated ${esc(new Date().toLocaleString('en-IN'))}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`;

  /*
   * Still rendered on the handset, unlike the trip's three documents.
   *
   * This is a plain table of whatever report is on screen — filtered rows and
   * all — which the server has no way to know about without being sent them.
   * The papers a customer is handed (report, invoice, proof of delivery) are
   * the ones that had to be identical everywhere, and those come from the API.
   */
  const result = await generatePDF({ html, fileName: fileBase, base64: true });
  if (!result.base64) {
    throw new Error('The report PDF could not be created.');
  }
  await shareFile({
    url: `data:application/pdf;base64,${result.base64}`,
    filename: fileBase,
    type: 'application/pdf',
  });
}

/**
 * One row's full document, from a report table that holds only a reference.
 *
 * The table row is a summary; the paper the office wants is the whole trip. So
 * the trip is read by its reference — `GET /trips/:key` resolves either a
 * reference or an id — along with its finance and its filed documents, exactly
 * as the trip screen would have them, and then the chosen document is built
 * from the same code that screen uses. A finance or document read that fails
 * costs a section, not the download.
 */
export async function exportTripDocumentByRef(
  reference: string,
  kind: 'excel' | 'pdf' | 'invoice' | 'pod',
): Promise<void> {
  const trip = (await tripService.get(reference)) as TripLike;
  if (!trip?.id) {
    throw new Error(`Trip ${reference} could not be found.`);
  }

  /*
   * The three PDFs are rendered by the API from the trip's key alone — no
   * finance or document reads needed here. Only the workbook is assembled on
   * the handset, and only it pays for them.
   */
  if (kind !== 'excel') {
    await exportTripDocument(trip, kind === 'pdf' ? 'report' : kind);
    return;
  }

  const [finance, docs] = await Promise.all([
    tripService.finance(String(trip.id)).catch(() => null),
    documentService.list({ tripId: String(trip.id), limit: 50 }).catch(() => []),
  ]);
  await exportTripExcel(trip, finance, docs, {});
}
