import Share from 'react-native-share';
import { generatePDF } from 'react-native-html-to-pdf';
import * as XLSX from 'xlsx';

import type { AdminDocument, TripFinance } from './fleet.service';

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
): ReportSection[] {
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
  (finance?.payments.items ?? []).forEach(p =>
    financeRows.push(
      row(
        `Payment · ${dateOf(p.paidAt)} · ${p.mode}`,
        `${rupees(Number(p.amount))}${p.reference ? ` (${p.reference})` : ''}`,
      ),
    ),
  );
  financeRows.push(row('Trip expenses', rupees(finance?.expenses ?? 0)));
  (finance?.costs.items ?? []).forEach(e =>
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
    await Share.open({ failOnCancel: false, ...options });
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
): Promise<void> {
  const { photos, otherDocs } = splitTripDocs(docs);
  const sections = buildTripSections(trip, finance, photos, otherDocs);
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
    filename: `SMT-Trip-${safeRef(trip)}.xlsx`,
    type: XLSX_MIME,
  });
}

/** One `<td>`-safe string. */
const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The report laid out as an HTML document — a title, each section as a simple
 * two-column table, then the delivery photos and image scans each under a
 * caption. `react-native-html-to-pdf` renders this to a PDF on the device; the
 * images are pulled from their public CDN URLs at render time.
 */
function buildReportHtml(
  title: string,
  sections: ReportSection[],
  images: ReportImage[],
): string {
  const sectionsHtml = sections
    .map(
      section => `
      <h2>${esc(section.title)}</h2>
      <table>
        ${section.rows
          .map(
            ([label, value]) =>
              `<tr><td class="label">${esc(label)}</td><td>${esc(
                value,
              )}</td></tr>`,
          )
          .join('')}
      </table>`,
    )
    .join('');

  const imagesHtml = images.length
    ? `<h2>Photos &amp; Scans</h2>${images
        .map(
          image => `
          <div class="photo">
            <div class="caption">${esc(image.caption)}</div>
            <img src="${esc(image.url)}" />
          </div>`,
        )
        .join('')}`
    : '';

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
          color: #0d2647;
          padding: 24px;
          font-size: 12px;
        }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
        h2 {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #dc2626;
          margin: 18px 0 6px;
        }
        table { width: 100%; border-collapse: collapse; }
        td {
          border-bottom: 1px solid #e5e7eb;
          padding: 5px 6px;
          vertical-align: top;
        }
        td.label { width: 32%; color: #64748b; font-weight: 600; }
        .photo { margin: 12px 0; page-break-inside: avoid; }
        .caption { font-weight: 700; margin-bottom: 4px; }
        img { max-width: 100%; border-radius: 6px; }
      </style>
    </head>
    <body>
      <h1>${esc(title)}</h1>
      <div class="meta">Generated ${esc(new Date().toLocaleString('en-IN'))}</div>
      ${sectionsHtml}
      ${imagesHtml}
    </body>
  </html>`;
}

/**
 * The report as a PDF, with the trip's delivery photographs and document scans
 * embedded — the format an office prints or forwards as the record of a run.
 *
 * Built on the device and shared straight away; the file lives in the app's own
 * cache, which is why no storage permission is asked for.
 */
export async function exportTripPdf(
  trip: TripLike,
  finance: TripFinance | null,
  docs: AdminDocument[],
): Promise<void> {
  const { photos, otherDocs } = splitTripDocs(docs);
  const sections = buildTripSections(trip, finance, photos, otherDocs);
  const images = tripReportImages(photos, otherDocs);
  const title = `Trip #${trip.reference ?? trip.id ?? ''}`;
  const html = buildReportHtml(title, sections, images);

  const result = await generatePDF({
    html,
    fileName: `SMT-Trip-${safeRef(trip)}`,
    base64: false,
  });

  if (!result.filePath) {
    throw new Error('The report PDF could not be created.');
  }

  await shareFile({
    url: `file://${result.filePath}`,
    type: 'application/pdf',
  });
}
