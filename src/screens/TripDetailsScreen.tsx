import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BlinkDot,
  Button,
  Card,
  ConfirmDialog,
  Content,
  DriverGeoMap,
  Footer,
  HaltUpdates,
  Icon,
  IconWell,
  Input,
  ListState,
  RadialGlow,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import type { RootStackParamList } from '@navigation/types';
import {
  documentService,
  tripService,
  type AdminDocument,
  type Halt,
  type TripDocumentRequest,
  type TripFinance,
} from '@services/fleet.service';
import {
  exportTripExcel,
  exportTripInvoice,
  exportTripPdf,
  exportTripPod,
} from '@services/tripReport.service';
import { directionsService, type RoadRoute } from '@services/directions.service';
import { openExternalUrl } from '@utils/openExternalUrl';
import { useApi } from '@hooks/useApi';

/**
 * Screen 19 — Trip Details.
 *
 *   navy hero (#TR-2026-8836, IN TRANSIT chip, route, 21% rail + ETA) ·
 *   DRIVER & VEHICLE card with a dashed divider and GPS freshness ·
 *   CUSTOMER card · DOCUMENTS · 5 as a 2-up grid ·
 *   Timeline / Track Live footer
 */
/** A pending decision or outcome shown by the dialog at the foot of the screen. */
type Dialog = {
  tone: ConfirmTone;
  icon: IconName;
  title: string;
  message: string;
  confirmLabel: string;
  /** Only a decision offers a way out; a result or failure just closes. */
  cancelLabel?: string;
  onConfirm: () => void;
};

/**
 * How each kind of paperwork is labelled and coloured — keyed by the API's
 * `kind`, so a document is drawn as what it actually is.
 *
 * The grid used to be five fixed tiles ("E-way Bill · 234 KB", "Invoice · 1.1
 * MB", a Waybill, an LR and a POD) shown on every trip regardless of what had
 * been filed, and only the POD tile did anything — it opened a separate viewer
 * screen. Now each tile is a real document that opens the actual file.
 */
const DOC_STYLE: Record<
  string,
  { label: string; icon: IconName; bg: string; color: string }
> = {
  EWAY: { label: 'E-way Bill', icon: 'scroll-text', bg: palette.navyTint, color: palette.navy },
  INVOICE: { label: 'Invoice', icon: 'receipt', bg: palette.goldTint, color: palette.gold },
  WAYBILL: { label: 'Waybill', icon: 'file-text', bg: palette.navyTint, color: palette.navy },
  LR: { label: 'Lorry Receipt', icon: 'file-check', bg: palette.goldTint, color: palette.gold },
  CHALLAN: { label: 'Challan', icon: 'file-text', bg: palette.navyTint, color: palette.navy },
  POD: { label: 'Proof of Delivery', icon: 'package-check', bg: palette.redTint, color: palette.red },
  OTHER: { label: 'Document', icon: 'file-text', bg: palette.navyTint, color: palette.navy },
};

/**
 * How a document request's state reads — asked and waiting, answered with a
 * file, or withdrawn by the office before anyone answered it.
 */
const REQUEST_STATUS: Record<
  TripDocumentRequest['status'],
  { label: string; icon: IconName; bg: string; color: string }
> = {
  PENDING: { label: 'Pending', icon: 'clock', bg: palette.goldSoft, color: palette.goldText },
  FULFILLED: { label: 'Received', icon: 'file-check', bg: palette.greenTint, color: palette.green },
  CANCELLED: { label: 'Withdrawn', icon: 'x', bg: palette.gray200, color: palette.slate500 },
};

/** `2026-09-26T05:12:00Z` -> `26 Sep, 10:42 am`, or blank when unreadable. */
function formatWhen(iso: string | null | undefined): string {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime())
    ? at.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
}

/** `12326` -> `12 KB`. Bytes are what the API stores; nobody reads bytes. */
function formatSize(bytes: number): string {
  if (!bytes) {
    return '';
  }
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * One line of the completion checklist — a numbered disc that turns into a
 * green tick once that party has signed off, what they did, and whatever the
 * office can do about it underneath.
 */
const CompletionStep: React.FC<{
  n: number;
  done: boolean;
  title: string;
  detail?: string;
  note?: string | null;
  /** Hairline above — every step after the first. */
  divided?: boolean;
  children?: React.ReactNode;
}> = ({ n, done, title, detail, note, divided, children }) => (
  <View style={[stepStyles.row, divided && stepStyles.divided]}>
    <View style={[stepStyles.disc, done && stepStyles.discDone]}>
      {done ? (
        <Icon name="check" size={12} color={palette.white} strokeWidth={3} />
      ) : (
        <Text style={stepStyles.discText}>{n}</Text>
      )}
    </View>
    <View style={stepStyles.body}>
      <Text style={[stepStyles.title, done && stepStyles.titleDone]}>
        {title}
      </Text>
      {detail ? <Text style={stepStyles.detail}>{detail}</Text> : null}
      {note ? <Text style={stepStyles.note}>{note}</Text> : null}
      {children}
    </View>
  </View>
);

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  divided: {
    marginTop: s(10),
    paddingTop: s(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  disc: {
    width: s(22),
    height: s(22),
    borderRadius: radius.full,
    backgroundColor: palette.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discDone: { backgroundColor: palette.green },
  discText: font(10, '800', { color: palette.slate500 }),
  body: { flex: 1, minWidth: 0, marginLeft: s(10) },
  title: font(11, '800', { color: palette.navy }),
  titleDone: { color: palette.green },
  detail: {
    ...font(9, '500', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(2),
  },
  note: {
    ...font(9, '600', { color: palette.slate700, lineHeight: 1.4 }),
    marginTop: s(3),
  },
});

export const TripDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'TripDetails'>>();
  const { tripId } = route.params;

  /*
   * The trip this screen was opened for.
   *
   * It loaded nothing at all. Every value below — the reference, the status,
   * both cities, the progress rail, the driver, the lorry and the customer —
   * was written into the markup, so opening any trip in the fleet showed
   * `#TR-2026-8836 · Ramesh Kumar · AP 31 XX 1234 · Sri Sai Traders`. An
   * operator checking on a consignment was reading somebody else's, every
   * time, and the screen gave no sign of it.
   *
   * One request carries all of it: the trip, its booking, the vehicle, the
   * driver and the customer.
   */
  const { data, loading, error, refetch } = useApi(
    () => tripService.get(tripId),
    [tripId],
  );

  const trip = (data ?? null) as Record<string, any> | null;
  const booking = trip?.booking;
  const driverName: string = trip?.driver?.user?.name ?? '—';
  const driverMobile: string = trip?.driver?.user?.mobile ?? '';
  const registration: string = trip?.vehicle?.registration ?? '—';
  const vehicleType: string = trip?.vehicle?.type ?? '';

  /*
   * The lorry and its driver on one map.
   *
   * The live fix comes from the fleet board; while the trip runs both sit at
   * that one point (the driver rides in the cab), spread side by side. A trip
   * that is not live carries no fix, so the map reads "not reported" instead of
   * guessing a spot.
   */
  const live = useApi(() => tripService.live(), []);
  const liveLoc = useMemo(() => {
    const row = (live.data ?? []).find(t => t.tripId === tripId);
    return row?.location ?? null;
  }, [live.data, tripId]);
  const geoVehicle =
    liveLoc && registration && registration !== '—'
      ? {
          position: { latitude: liveLoc.lat, longitude: liveLoc.lng },
          reg: registration,
        }
      : null;
  const geoDriver =
    liveLoc && driverName && driverName !== '—'
      ? {
          position: { latitude: liveLoc.lat, longitude: liveLoc.lng },
          name: driverName,
          onTrip: true,
        }
      : null;

  /*
   * The whole journey on the map, not just the live fix.
   *
   * Pickup and drop are nullable — a booking typed in over the phone has no
   * autocomplete behind it and so no coordinate — so the trip map is drawn only
   * when both ends are known; otherwise the driver/vehicle map stands in. When
   * they are known the map draws the pickup→drop line, a pin at each end, a
   * pause pin at every halt, and the lorry (with its driver) where it last
   * reported.
   */
  // Memoised on the raw coordinates so the object identity is stable across
  // renders — the map props and the export callback both depend on it.
  const pickupCoord = useMemo(
    () =>
      booking?.pickupLat != null && booking?.pickupLng != null
        ? {
            latitude: Number(booking.pickupLat),
            longitude: Number(booking.pickupLng),
          }
        : null,
    [booking?.pickupLat, booking?.pickupLng],
  );
  const dropCoord = useMemo(
    () =>
      booking?.dropLat != null && booking?.dropLng != null
        ? {
            latitude: Number(booking.dropLat),
            longitude: Number(booking.dropLng),
          }
        : null,
    [booking?.dropLat, booking?.dropLng],
  );
  /*
   * The real road between pickup and drop, so the line follows the carriageway
   * rather than cutting across country as a straight pickup→drop segment.
   *
   * Fetched once per leg — the route between two fixed addresses does not change
   * while the lorry drives it — by keying the effect on the two endpoints as
   * strings, not on the object identities that change every render. On failure
   * or an unconfigured key `road()` answers null and the map falls back to the
   * straight line, which is a worse picture but still a true one.
   */
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const pickupKey = pickupCoord
    ? `${pickupCoord.latitude},${pickupCoord.longitude}`
    : '';
  const dropKey = dropCoord
    ? `${dropCoord.latitude},${dropCoord.longitude}`
    : '';

  useEffect(() => {
    if (!pickupKey || !dropKey) {
      setRoad(null);
      return;
    }
    let alive = true;
    const [plat, plng] = pickupKey.split(',').map(Number);
    const [dlat, dlng] = dropKey.split(',').map(Number);
    directionsService
      .road(
        { latitude: plat, longitude: plng },
        { latitude: dlat, longitude: dlng },
      )
      .then(found => {
        if (alive) {
          setRoad(found);
        }
      })
      .catch(() => {
        // `road()` already answers null on failure; the map draws straight.
      });
    return () => {
      alive = false;
    };
  }, [pickupKey, dropKey]);
  const customer = booking?.customer;
  const customerName: string =
    customer?.company || customer?.user?.name || 'Customer';
  // The name as the customer is known, without the placeholder — for sentences.
  const knownCustomer: string | undefined =
    customer?.company || customer?.user?.name || undefined;
  const customerContact: string = customer?.user?.name ?? '';
  const customerMobile: string = customer?.user?.mobile ?? '';

  // The route, with the full street address the driver actually needs on the
  // road — the booking carries a short place ("Kondapur") and a fuller address.
  const pickupPlace: string = String(booking?.pickupPlace ?? '—');
  const dropPlace: string = String(booking?.dropPlace ?? '—');
  const pickupAddress: string = booking?.pickupAddress
    ? String(booking.pickupAddress)
    : '';
  const dropAddress: string = booking?.dropAddress
    ? String(booking.dropAddress)
    : '';

  /*
   * Every document filed against this consignment — the booking's shipment
   * scans and anything added on the trip, proof of delivery included — merged
   * and ordered so the e-way bill and invoice come first.
   */
  const documents = useMemo(() => {
    const rows = [
      ...((booking?.documents as AdminDocument[] | undefined) ?? []),
      ...((trip?.documents as AdminDocument[] | undefined) ?? []),
    ];
    const rank = (kind: string) =>
      kind === 'EWAY' ? 0 : kind === 'INVOICE' ? 1 : 2;
    return [...rows].sort(
      (a, b) => rank(String(a.kind)) - rank(String(b.kind)),
    );
  }, [booking?.documents, trip?.documents]);
  const docCount = documents.length;

  /*
   * The trip's money, read for the downloadable report.
   *
   * The card lower down opens the full Payments & Revenue screen; the report
   * needs the same figures inline. A failure here degrades to `null` — the
   * report is still produced, it simply falls back to the booking's fare
   * estimate — so a locked-down finance surface never blocks the download.
   */
  const finance = useApi<TripFinance>(() => tripService.finance(tripId), [tripId]);

  /*
   * Where the lorry stopped for too long along the way — the same halt log the
   * Live Track screen shows, so a delivered trip still carries its stops. The
   * tracking endpoint rolls consecutive still fixes into halts; absent or empty
   * means the section self-hides.
   */
  const trackingApi = useApi(() => tripService.tracking(tripId), [tripId]);
  const halts: Halt[] = useMemo(
    () =>
      Array.isArray(trackingApi.data?.halts) ? trackingApi.data.halts : [],
    [trackingApi.data],
  );

  /*
   * Papers asked for on this trip — of the customer by the office or the
   * driver, or of the office by the driver — newest first. `useApi` re-reads
   * it whenever this screen regains focus (its own `useFocusEffect`), so
   * coming back from Request Documents shows the rows just sent.
   */
  const {
    data: requestData,
    loading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useApi(() => tripService.documentRequestHistory(tripId), [tripId]);
  const docRequests: TripDocumentRequest[] = requestData ?? [];
  const [withdrawing, setWithdrawing] = useState<string | null>(null);

  const [openingDoc, setOpeningDoc] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  type ExportKind = 'excel' | 'pdf' | 'invoice' | 'pod';
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [fullMap, setFullMap] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);

  const insets = useSafeAreaInsets();

  /**
   * Builds the trip report and hands it to the OS share sheet — an `.xlsx` the
   * office can file, or a `.pdf` that embeds the delivery photos and scans. The
   * heavy work runs in the service; here we only disable the buttons while it
   * runs and surface a failure through the same dialog the rest of the screen
   * uses. A dismissed share sheet is not a failure and is swallowed downstream.
   */
  const runExport = useCallback(
    async (kind: ExportKind) => {
      if (!trip) {
        return;
      }
      setExporting(kind);
      try {
        if (kind === 'invoice') {
          await exportTripInvoice(trip);
        } else if (kind === 'pod') {
          await exportTripPod(trip);
        } else {
          const build = kind === 'excel' ? exportTripExcel : exportTripPdf;
          // Halts and the pickup/drop coordinates travel with the trip so the
          // report can draw the route map and list the stops, like the web admin.
          await build(trip, finance.data ?? null, documents, {
            halts,
            pickup: pickupCoord,
            drop: dropCoord,
          });
        }
      } catch (failure) {
        setDialog({
          tone: 'danger',
          icon: 'alert-circle',
          title: 'Could not create the document',
          message:
            failure instanceof Error
              ? failure.message
              : 'The report could not be generated.',
          confirmLabel: 'Close',
          onConfirm: () => setDialog(null),
        });
      } finally {
        setExporting(null);
      }
    },
    [trip, finance.data, documents, halts, pickupCoord, dropCoord],
  );

  /**
   * Opens one submitted document — the file itself, through a signed link, in
   * the device's own viewer. Deliberately not a jump to another screen: the
   * office wants to see the scan the driver or customer actually filed.
   */
  const viewDocument = useCallback(async (id: string, signedUrl?: string) => {
    setOpeningDoc(id);
    try {
      // A link already signed by the API is opened as given; otherwise one
      // is asked for.
      await openExternalUrl(signedUrl ?? (await documentService.downloadUrl(id)));
    } catch (failure) {
      setDialog({
        tone: 'danger',
        icon: 'alert-circle',
        title: 'Could not open it',
        message:
          failure instanceof Error
            ? failure.message
            : 'That document is not available.',
        confirmLabel: 'Close',
        onConfirm: () => setDialog(null),
      });
    } finally {
      setOpeningDoc(null);
    }
  }, []);

  const distanceKm = Number(trip?.distanceKm ?? 0);
  const coveredKm = Number(trip?.coveredKm ?? 0);
  const progress =
    distanceKm > 0 ? Math.min(100, Math.round((coveredKm / distanceKm) * 100)) : 0;

  /** `RK` from `Ramesh Kumar`, for the avatar. */
  const initialsOf = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map(word => word[0] ?? '')
      .join('')
      .toUpperCase();

  /**
   * Rings the driver on this trip.
   *
   * It dialled a fixed seed number, so "Call driver" reached one person
   * regardless of who was actually carrying the load — on a screen whose whole
   * purpose is to check on a consignment in progress.
   */
  const callDriver = useCallback(() => {
    if (!driverMobile) {
      return;
    }
    Linking.openURL(`tel:${driverMobile}`).catch(() => undefined);
  }, [driverMobile]);

  /** Rings the shipper on this trip. */
  const callCustomer = useCallback(() => {
    if (!customerMobile) {
      return;
    }
    Linking.openURL(`tel:${customerMobile}`).catch(() => undefined);
  }, [customerMobile]);

  const openReassign = useCallback(
    () => navigation.navigate('ReassignTrip', { tripId }),
    [navigation, tripId],
  );

  const openStatus = useCallback(
    () => navigation.navigate('UpdateTripStatus', { tripId }),
    [navigation, tripId],
  );

  const openRequestDocuments = useCallback(
    () =>
      navigation.navigate('RequestDocuments', {
        tripId,
        reference: trip?.reference,
        customerName: knownCustomer,
      }),
    [navigation, tripId, trip?.reference, knownCustomer],
  );

  /**
   * Opens the paper that answered a request. The stored document gets a
   * freshly signed link, as the grid above does; the history's own signed
   * link stands in when there is no id to sign.
   */
  const openRequested = useCallback(
    (request: TripDocumentRequest) => {
      if (request.documentId) {
        viewDocument(request.documentId);
      } else if (request.documentUrl) {
        viewDocument(request.id, request.documentUrl);
      }
    },
    [viewDocument],
  );

  const runWithdraw = useCallback(
    async (request: TripDocumentRequest) => {
      setDialog(null);
      setWithdrawing(request.id);
      try {
        await tripService.cancelDocumentRequest(tripId, request.id);
      } catch (failure) {
        setDialog({
          tone: 'danger',
          icon: 'alert-circle',
          title: 'Could not withdraw it',
          message:
            failure instanceof Error
              ? failure.message
              : 'The request was not withdrawn. Check your signal and try again.',
          confirmLabel: 'Close',
          onConfirm: () => setDialog(null),
        });
      } finally {
        setWithdrawing(null);
        // Either way the list is re-read — a failure usually means it was
        // answered or withdrawn elsewhere, and the row should say so.
        refetchRequests();
      }
    },
    [tripId, refetchRequests],
  );

  const confirmWithdraw = useCallback(
    (request: TripDocumentRequest) => {
      setDialog({
        tone: 'danger',
        icon: 'x',
        title: 'Withdraw this request?',
        message: `${knownCustomer ?? 'The customer'} will stop being asked for the ${request.documentType}. You can request it again later.`,
        confirmLabel: 'Withdraw',
        cancelLabel: 'Keep it',
        onConfirm: () => runWithdraw(request),
      });
    },
    [knownCustomer, runWithdraw],
  );

  /*
   * Where the trip is in the three-way close.
   *
   * The driver ending the run sets `deliveredAt` but leaves the trip
   * IN_TRANSIT, with the lorry and driver still on it, until the customer has
   * confirmed and the office has approved. So "in transit" alone no longer
   * means on the road. A trip closed under the old rule (DELIVERED, never
   * signed off) can still be approved without the customer — `legacyDelivered`
   * keeps that path open.
   */
  const deliveredAt: string | null = (trip?.deliveredAt as string | null) ?? null;
  const approvedAt: string | null =
    (trip?.completionApprovedAt as string | null) ?? null;
  const approvalNote: string | null =
    (trip?.completionNote as string | null) ?? null;
  const customerConfirmedAt: string | null =
    (trip?.customerConfirmedAt as string | null) ?? null;
  const customerConfirmNote: string | null =
    (trip?.customerConfirmNote as string | null) ?? null;
  const handedOver = trip?.status === 'IN_TRANSIT' && Boolean(deliveredAt);
  const legacyDelivered = trip?.status === 'DELIVERED' && !approvedAt;
  const awaitingCompletion = handedOver || legacyDelivered;
  const customerDone = Boolean(customerConfirmedAt);
  // The driver's half is in by definition here; the customer's is the gate.
  const readyToComplete = awaitingCompletion && (customerDone || legacyDelivered);
  const statusText: string = handedOver
    ? 'Delivered · awaiting completion'
    : String(trip?.status ?? '').replace('_', ' ');

  // Only a running trip can be handed over or moved on; a delivered or
  // cancelled one is settled, so these actions are offered only while there is
  // something to change. Once the load is handed over the server refuses
  // pickups, milestones, reassigning and cancelling, so they go too.
  const canReassign =
    (trip?.status === 'SCHEDULED' || trip?.status === 'IN_TRANSIT') &&
    !deliveredAt;

  /*
   * The completion checklist's own state — the approval in flight, the
   * record-for-the-customer form (inline rather than a sheet, so the keyboard
   * pushes the screen and not a modal), and whatever the server last refused,
   * shown on the card itself.
   */
  const [approving, setApproving] = useState(false);
  const [recordingForCustomer, setRecordingForCustomer] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [completionError, setCompletionError] = useState('');

  const runApproval = useCallback(async () => {
    setDialog(null);
    setApproving(true);
    setCompletionError('');
    try {
      await tripService.approveCompletion(tripId);
      refetch();
      setDialog({
        tone: 'success',
        icon: 'check-circle-2',
        title: 'Trip completed',
        message:
          'This run is closed — the lorry and the driver are free for the next trip. The customer and the driver have been told.',
        confirmLabel: 'Done',
        onConfirm: () => setDialog(null),
      });
    } catch (failure) {
      setCompletionError(
        failure instanceof Error
          ? failure.message
          : 'The approval did not go through. Check your signal and try again.',
      );
    } finally {
      setApproving(false);
    }
  }, [tripId, refetch]);

  /*
   * Asked before it is done. This is the office closing the run — not a
   * toggle to flick and undo, so it gets a confirmation that names what
   * approving actually sets off.
   */
  const confirmApproval = useCallback(() => {
    setDialog({
      tone: 'gold',
      icon: 'clipboard-check',
      title: 'Complete this trip?',
      message:
        'Check the delivery photos and papers on this screen first. Completing closes the run, frees the lorry and the driver, and notifies the customer and the driver.',
      confirmLabel: 'Trip Complete',
      cancelLabel: 'Not yet',
      onConfirm: runApproval,
    });
  }, [runApproval]);

  /*
   * The customer's confirmation, recorded by the office — a customer who said
   * so on a call, or has no app. The note has to say who confirmed and how:
   * it is what the timeline shows in place of their own tick.
   */
  const saveCustomerConfirmation = useCallback(async () => {
    const note = customerNote.trim();
    if (note.length < 5) {
      setCompletionError('Say who confirmed and how — at least a few words.');
      return;
    }
    setSavingCustomer(true);
    setCompletionError('');
    try {
      await tripService.confirmForCustomer(tripId, note);
      setRecordingForCustomer(false);
      setCustomerNote('');
      refetch();
    } catch (failure) {
      setCompletionError(
        failure instanceof Error
          ? failure.message
          : 'The confirmation was not recorded. Check your signal and try again.',
      );
    } finally {
      setSavingCustomer(false);
    }
  }, [customerNote, tripId, refetch]);

  const openTimeline = useCallback(
    () => navigation.navigate('TripTimeline', { tripId }),
    [navigation, tripId],
  );

  const trackLive = useCallback(
    () => navigation.navigate('LiveTripTrack', { tripId }),
    [navigation, tripId],
  );

  const openFinance = useCallback(
    () =>
      navigation.navigate('TripFinance', {
        tripId,
        reference: trip?.reference ?? tripId,
      }),
    [navigation, tripId, trip?.reference],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title={trip?.reference ? `Trip ${trip.reference}` : 'Trip'}
        subtitle={
          trip?.status
            ? statusText.toLowerCase()
            : loading
              ? 'Loading…'
              : ''
        }
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        {/*
          A screen that fetches has to say when it cannot.
          
          Loading, failure and not-found were all impossible states before,
          because nothing was ever requested — the invented trip rendered
          instantly and always.
        */}
        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && !trip}
          what="trip"
          emptyIcon="truck"
          emptyHint="This trip could not be found."
          onRetry={refetch}
        />

        {trip ? (
        <>
        {/* Hero */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={120}
            color={palette.gold}
            opacity={0.3}
            top={-25}
            right={-25}
          />

          <View style={styles.heroBody}>
            <View style={styles.heroHead}>
              <Text style={styles.heroRef}>#{trip?.reference ?? '—'}</Text>
              <View style={styles.heroChip}>
                {/* Nothing is moving once it is handed over — no live dot. */}
                {handedOver ? (
                  <Icon name="package-check" size={10} color={palette.gold} />
                ) : (
                  <BlinkDot color={palette.gold} size={5} />
                )}
                <Text style={styles.heroChipText}>
                  {statusText.toUpperCase() || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.heroRoute}>
              <Text style={styles.heroCity} numberOfLines={1}>
                {booking?.pickupPlace ?? '—'}
              </Text>
              <Icon name="arrow-right" size={14} color={palette.gold} />
              <Text style={styles.heroCity} numberOfLines={1}>
                {booking?.dropPlace ?? '—'}
              </Text>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressHead}>
                <Text style={styles.progressText}>
                  {Math.round(coveredKm)} / {Math.round(distanceKm)} KM
                </Text>
                {/*
                  No ETA. It read `21% · ETA 2:45 PM` on every trip, and there
                  is nothing behind it — the API reports distance covered, not
                  a predicted arrival, so an invented time is the one number an
                  operator would relay to a waiting customer.
                */}
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
              <View style={styles.track}>
                <LinearGradient
                  colors={[palette.gold, palette.red]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  /* The rail was a fixed width, so every trip looked 21% run. */
                  style={[styles.fill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Route — from and to with full addresses, what a driver on the road
            reads to reach the pickup and the drop. */}
        <Text style={styles.section}>ROUTE</Text>
        <Card padding={12}>
          <View style={styles.routeRow}>
            <IconWell
              icon="map-pin"
              size={32}
              iconSize={15}
              backgroundColor={palette.navyTint}
              color={palette.navy}
              borderRadius={radius.md}
            />
            <View style={styles.routeBody}>
              <Text style={styles.routeLabel}>FROM</Text>
              <Text style={styles.routePlace} numberOfLines={1}>
                {pickupPlace}
              </Text>
              {pickupAddress ? (
                <Text style={styles.routeAddr}>{pickupAddress}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <IconWell
              icon="map-pin"
              size={32}
              iconSize={15}
              backgroundColor={palette.redTint}
              color={palette.red}
              borderRadius={radius.md}
            />
            <View style={styles.routeBody}>
              <Text style={styles.routeLabel}>TO</Text>
              <Text style={styles.routePlace} numberOfLines={1}>
                {dropPlace}
              </Text>
              {dropAddress ? (
                <Text style={styles.routeAddr}>{dropAddress}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Driver + vehicle */}
        <Text style={styles.section}>DRIVER &amp; VEHICLE</Text>
        <Card padding={11}>
          <View style={styles.driverRow}>
            <View>
              <LinearGradient
                colors={gradients.navyHero as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.driverAvatar}
              >
                <Text style={styles.driverInitials}>
                  {initialsOf(driverName)}
                </Text>
              </LinearGradient>
              <View style={styles.presence} />
            </View>

            <View style={styles.driverBody}>
              <Text style={styles.driverName} numberOfLines={1}>
                {driverName}
              </Text>
              <Text style={styles.driverPhone}>
                {driverMobile || 'No number on file'}
              </Text>
            </View>

            <Pressable
              onPress={callDriver}
              accessibilityRole="button"
              accessibilityLabel={
                driverMobile ? `Call ${driverName}` : 'No number on file'
              }
              style={({ pressed }) => [styles.callGold, pressed && styles.pressed]}
            >
              <Icon name="phone" size={14} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.vehicleRow}>
            <IconWell
              icon="truck"
              size={38}
              iconSize={20}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.lg}
            />
            <View style={styles.driverBody}>
              <Text style={styles.driverName} numberOfLines={1}>
                {registration}
              </Text>
              {/*
                No speed. `62 km/h` was fixed text on a screen that fetches
                nothing, and a speed is exactly the sort of figure an operator
                repeats to a customer asking where their load is.
              */}
              <Text style={styles.driverPhone}>{vehicleType || '—'}</Text>
            </View>
            {/*
              Removed. `GPS · 12s ago` was fixed text, so a lorry that had not
              reported for an hour still claimed a fix from twelve seconds ago
              — which is the one thing on this card an operator would use to
              decide whether to worry.
            */}
          </View>

          {/* Office controls — change the status, or swap the driver/lorry. */}
          {canReassign ? (
            <>
              <Button
                label="Update trip status"
                variant="outline"
                icon="clipboard-check"
                iconSize={14}
                padding={9}
                fontSize={11}
                gap={6}
                borderColor={palette.border}
                onPress={openStatus}
                style={styles.reassignBtn}
              />
              <Button
                label="Reassign driver or vehicle"
                variant="outline"
                icon="user-cog"
                iconSize={14}
                padding={9}
                fontSize={11}
                gap={6}
                borderColor={palette.border}
                onPress={openReassign}
                style={styles.reassignBtn}
              />
            </>
          ) : null}
        </Card>

        {/* Geo location — the whole journey on one map: the pickup→drop line,
            a pin at each end, a pause pin at every halt, and the lorry with its
            driver where it last reported. When the booking has no pickup/drop
            coordinate (one typed in over the phone) the driver/vehicle map
            stands in, reading "not reported" when nothing is live. */}
        <Text style={[styles.section, styles.sectionGap]}>GEO LOCATION</Text>
        <DriverGeoMap
          driver={geoDriver}
          vehicle={geoVehicle}
          pickup={pickupCoord}
          drop={dropCoord}
          routeCoordinates={road?.path}
          halts={halts}
          height={s(200)}
          onPress={() => setFullMap(true)}
        />

        {/* Halts — where the lorry stopped along the way, with the driver's
            reason, place, time and photos. Self-hides when there are none. */}
        {halts.length > 0 ? (
          <View style={styles.sectionGap}>
            <HaltUpdates halts={halts} />
          </View>
        ) : null}

        {/* Trip completion — driver, customer, office, sitting directly after
            the tracking and halts it is a judgement on, and above the papers it
            is a judgement of. Shown once the load is handed over: a trip closes
            only when all three agree, and until then the lorry and driver stay
            on it. The button stays greyed until the first two are in — the
            server refuses it otherwise. */}
        {approvedAt || awaitingCompletion ? (
          <>
            <Text style={[styles.section, styles.sectionGap]}>
              TRIP COMPLETION
            </Text>
            <Card padding={12}>
              {approvedAt ? (
                <>
                  <View style={styles.approveHead}>
                    <IconWell
                      icon="check-circle-2"
                      size={38}
                      iconSize={20}
                      backgroundColor={palette.greenTint}
                      color={palette.green}
                      borderRadius={radius.lg}
                    />
                    <View style={styles.driverBody}>
                      <Text style={styles.driverName}>Trip completed</Text>
                      <Text style={styles.driverPhone}>
                        {approvalNote ??
                          `Approved by the office · ${formatWhen(approvedAt)}`}
                      </Text>
                    </View>
                  </View>
                  {customerConfirmedAt ? (
                    <Text style={styles.custLine}>
                      Customer confirmed ✓ · {formatWhen(customerConfirmedAt)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.checkIntro}>
                    {legacyDelivered
                      ? 'Delivered before customer confirmation was needed — your approval alone closes it.'
                      : `Completes when the driver, the customer and the office have all signed off. Until then ${registration} and ${driverName} stay on this trip.`}
                  </Text>

                  <CompletionStep
                    n={1}
                    done
                    title="Driver completed ✓"
                    detail={[
                      formatWhen(deliveredAt),
                      trip.receiverName ? `received by ${trip.receiverName}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />

                  <CompletionStep
                    n={2}
                    done={customerDone}
                    divided
                    title={
                      customerDone
                        ? 'Customer confirmed ✓'
                        : legacyDelivered
                          ? 'Customer has not confirmed'
                          : 'Waiting for the customer'
                    }
                    detail={
                      customerDone
                        ? formatWhen(customerConfirmedAt)
                        : legacyDelivered
                          ? 'Optional on this older trip.'
                          : 'They confirm in the customer app by accepting the Terms & Conditions.'
                    }
                    note={customerDone ? customerConfirmNote : null}
                  >
                    {customerDone ? null : recordingForCustomer ? (
                      <View style={styles.stepAction}>
                        <Input
                          label="Who confirmed and how"
                          required
                          placeholder="e.g. Ravi confirmed on a call at 5 PM"
                          value={customerNote}
                          onChangeText={setCustomerNote}
                          maxLength={300}
                          multiline
                          minHeight={56}
                          editable={!savingCustomer}
                        />
                        <View style={styles.formActions}>
                          <Button
                            label="Cancel"
                            variant="ghost"
                            flex={1}
                            padding={9}
                            fontSize={11}
                            disabled={savingCustomer}
                            onPress={() => {
                              setRecordingForCustomer(false);
                              setCompletionError('');
                            }}
                          />
                          <Button
                            label={savingCustomer ? 'Saving…' : 'Save'}
                            variant="gold"
                            icon="check"
                            iconSize={13}
                            flex={1.4}
                            padding={9}
                            fontSize={11}
                            gap={5}
                            loading={savingCustomer}
                            disabled={
                              savingCustomer || customerNote.trim().length < 5
                            }
                            onPress={saveCustomerConfirmation}
                          />
                        </View>
                      </View>
                    ) : (
                      <Button
                        label="Record customer's confirmation"
                        variant="outline"
                        icon="user-check"
                        iconSize={13}
                        padding={8}
                        fontSize={11}
                        gap={6}
                        borderColor={palette.border}
                        onPress={() => {
                          setCustomerNote('');
                          setCompletionError('');
                          setRecordingForCustomer(true);
                        }}
                        style={styles.stepAction}
                      />
                    )}
                  </CompletionStep>

                  <CompletionStep
                    n={3}
                    done={false}
                    divided
                    title="Office approval"
                    detail={
                      readyToComplete
                        ? 'Check the photos and papers below, then complete the trip — the lorry and the driver are freed.'
                        : 'Unlocks once the customer confirms.'
                    }
                  >
                    <Button
                      label={approving ? 'Completing…' : 'Trip Complete'}
                      variant={readyToComplete ? 'gold' : 'outline'}
                      icon={readyToComplete ? 'check-circle-2' : 'lock'}
                      iconSize={14}
                      padding={10}
                      fontSize={12}
                      gap={6}
                      borderColor={readyToComplete ? undefined : palette.border}
                      loading={approving}
                      disabled={!readyToComplete || approving}
                      onPress={confirmApproval}
                      style={styles.stepAction}
                    />
                  </CompletionStep>

                  {completionError ? (
                    <Text style={styles.completionError}>{completionError}</Text>
                  ) : null}
                </>
              )}
            </Card>
          </>
        ) : null}

        {/* Customer */}
        <Text style={[styles.section, styles.sectionGap]}>CUSTOMER</Text>
        <Card padding={11} style={styles.customerRow}>
          <View style={styles.customerTile}>
            <Text style={styles.customerInitials}>
              {initialsOf(customerName)}
            </Text>
          </View>
          <View style={styles.driverBody}>
            <Text style={styles.driverName} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={styles.driverPhone} numberOfLines={1}>
              {[customerContact, customerMobile].filter(Boolean).join(' · ') ||
                'No contact on file'}
            </Text>
          </View>
          {/*
            Rings the customer, not the driver.
            
            This button called `callDriver` — the same handler as the card
            above it — so the office rang the driver while believing they were
            ringing the shipper.
          */}
          <Pressable
            onPress={callCustomer}
            disabled={!customerMobile}
            accessibilityRole="button"
            accessibilityState={{ disabled: !customerMobile }}
            accessibilityLabel={
              customerMobile ? `Call ${customerName}` : 'No number on file'
            }
            style={({ pressed }) => [
              styles.callNavy,
              !customerMobile && styles.callOff,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="phone" size={14} color={palette.white} />
          </Pressable>
        </Card>

        {/* Documents */}
        {/*
          Counted, not claimed. The heading said `DOCUMENTS · 5` while the
          grid below drew four tiles, on every trip.
        */}
        <Text style={[styles.section, styles.sectionGap]}>
          DOCUMENTS · {docCount}
        </Text>
        {documents.length ? (
          <View style={styles.docGrid}>
            {documents.map(doc => {
              const kind = String(doc.kind ?? 'OTHER');
              const style = DOC_STYLE[kind] ?? DOC_STYLE.OTHER;
              const id = String(doc.id);
              const size = formatSize(Number(doc.sizeBytes ?? 0));
              return (
                <Pressable
                  key={id}
                  onPress={() => viewDocument(id)}
                  disabled={openingDoc !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${style.label}`}
                  accessibilityState={{ busy: openingDoc === id }}
                  style={({ pressed }) => [styles.docCard, pressed && styles.pressed]}
                >
                  <IconWell
                    icon={style.icon}
                    size={26}
                    iconSize={14}
                    backgroundColor={style.bg}
                    color={style.color}
                    borderRadius={radius.md}
                  />
                  <View style={styles.docBody}>
                    <Text style={styles.docName} numberOfLines={1}>
                      {style.label}
                    </Text>
                    <Text style={styles.docSize} numberOfLines={1}>
                      {size || 'Tap to open'}
                    </Text>
                  </View>
                  {openingDoc === id ? (
                    <ActivityIndicator size="small" color={palette.navy} />
                  ) : (
                    <Icon name="eye" size={14} color={palette.navy} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.docEmpty}>
            <Icon name="file-text" size={14} color={palette.slate400} />
            <Text style={styles.docEmptyText}>
              No documents filed against this trip yet.
            </Text>
          </View>
        )}

        {/* Document requests — every paper asked for on this trip and where
            it stands. A received one opens the file that answered it; one the
            office asked of the customer can be withdrawn while it waits. */}
        <Text style={[styles.section, styles.sectionGap]}>
          DOCUMENT REQUESTS
        </Text>
        {docRequests.length ? (
          <Card padding={12}>
            {docRequests.map((request, index) => {
              const meta =
                REQUEST_STATUS[request.status] ?? REQUEST_STATUS.PENDING;
              const received = request.status === 'FULFILLED';
              const openable =
                received && Boolean(request.documentId || request.documentUrl);
              const openKey = request.documentId ?? request.id;
              const canWithdraw =
                request.status === 'PENDING' &&
                request.requestedBy === 'office' &&
                request.requestedFrom === 'customer';
              const asked = [
                request.requestedBy === 'office'
                  ? 'Asked by you'
                  : 'Asked by driver',
                // A driver asking the office is the office's to answer.
                request.requestedFrom === 'office' ? 'for the office' : '',
                formatWhen(request.createdAt),
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={request.id}
                  onPress={openable ? () => openRequested(request) : undefined}
                  disabled={!openable || openingDoc !== null}
                  accessibilityRole={openable ? 'button' : undefined}
                  accessibilityLabel={
                    openable
                      ? `Open the ${request.documentType} received`
                      : `${request.documentType}, ${meta.label}`
                  }
                  style={({ pressed }) => [
                    styles.reqRow,
                    index > 0 ? styles.reqRowDivided : null,
                    pressed && openable ? styles.pressed : null,
                  ]}
                >
                  {openingDoc === openKey ? (
                    <View style={[styles.reqWell, { backgroundColor: meta.bg }]}>
                      <ActivityIndicator size="small" color={meta.color} />
                    </View>
                  ) : (
                    <IconWell
                      icon={meta.icon}
                      size={30}
                      iconSize={14}
                      backgroundColor={meta.bg}
                      color={meta.color}
                      borderRadius={radius.md}
                    />
                  )}
                  <View style={styles.reqBody}>
                    <View style={styles.reqHead}>
                      <Text style={styles.reqType} numberOfLines={1}>
                        {request.documentType}
                      </Text>
                      <View
                        style={[styles.reqPill, { backgroundColor: meta.bg }]}
                      >
                        <Text style={[styles.reqPillText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                        {openable ? (
                          <View style={styles.reqPillIcon}>
                            <Icon name="eye" size={11} color={meta.color} />
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.reqMeta} numberOfLines={1}>
                      {asked}
                    </Text>
                    {received ? (
                      <Text style={styles.reqMeta} numberOfLines={1}>
                        {[
                          `Received ${formatWhen(request.fulfilledAt)}`.trim(),
                          request.documentName,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                    {request.note ? (
                      <Text style={styles.reqNote}>“{request.note}”</Text>
                    ) : null}
                    {canWithdraw ? (
                      <Pressable
                        onPress={() => confirmWithdraw(request)}
                        disabled={withdrawing !== null}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Withdraw the ${request.documentType} request`}
                        accessibilityState={{ busy: withdrawing === request.id }}
                        style={({ pressed }) => [
                          styles.reqWithdraw,
                          (pressed || withdrawing === request.id) &&
                            styles.pressed,
                        ]}
                      >
                        <Icon name="x" size={11} color={palette.red} />
                        <Text style={styles.reqWithdrawText}>
                          {withdrawing === request.id
                            ? 'Withdrawing…'
                            : 'Withdraw'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ) : requestsLoading ? (
          <View style={styles.docEmpty}>
            <ActivityIndicator size="small" color={palette.navy} />
            <Text style={styles.docEmptyText}>Loading requests…</Text>
          </View>
        ) : requestsError ? (
          <Pressable
            onPress={refetchRequests}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the document requests"
            style={({ pressed }) => [styles.docEmpty, pressed && styles.pressed]}
          >
            <Icon name="alert-circle" size={14} color={palette.slate400} />
            <Text style={styles.docEmptyText}>
              Could not load the requests. Tap to try again.
            </Text>
          </Pressable>
        ) : (
          <View style={styles.docEmpty}>
            <Icon name="file-text" size={14} color={palette.slate400} />
            <Text style={styles.docEmptyText}>No documents requested yet.</Text>
          </View>
        )}
        {/* A cancelled trip has nothing left to document — the API refuses. */}
        {trip?.status !== 'CANCELLED' ? (
          <Button
            label="Request documents"
            variant="outline"
            icon="file-text"
            iconSize={14}
            padding={9}
            fontSize={11}
            gap={6}
            borderColor={palette.border}
            onPress={openRequestDocuments}
          />
        ) : null}

        {/* The four papers the web admin produces for a trip, all handed to
            the OS share sheet: the report as a filed workbook or as a PDF with
            the photos and scans embedded, the customer's tax invoice, and the
            proof of delivery with the driver's snaps at the drop. */}
        <Text style={[styles.section, styles.sectionGap]}>DOWNLOADS</Text>
        <View style={styles.reportRow}>
          <Button
            label="Report Excel"
            variant="outline"
            icon="download"
            iconSize={14}
            flex={1}
            padding={10}
            fontSize={11}
            gap={6}
            borderColor={palette.border}
            loading={exporting === 'excel'}
            disabled={exporting !== null}
            onPress={() => runExport('excel')}
          />
          <Button
            label="Report PDF"
            variant="outline"
            icon="file-text"
            iconSize={14}
            flex={1}
            padding={10}
            fontSize={11}
            gap={6}
            borderColor={palette.border}
            loading={exporting === 'pdf'}
            disabled={exporting !== null}
            onPress={() => runExport('pdf')}
          />
        </View>
        <View style={[styles.reportRow, styles.reportRowGap]}>
          <Button
            label="Invoice"
            variant="outline"
            icon="receipt"
            iconSize={14}
            flex={1}
            padding={10}
            fontSize={11}
            gap={6}
            borderColor={palette.border}
            loading={exporting === 'invoice'}
            disabled={exporting !== null}
            onPress={() => runExport('invoice')}
          />
          <Button
            label="Delivery Proof"
            variant="outline"
            icon="clipboard-check"
            iconSize={14}
            flex={1}
            padding={10}
            fontSize={11}
            gap={6}
            borderColor={palette.border}
            loading={exporting === 'pod'}
            disabled={exporting !== null}
            onPress={() => runExport('pod')}
          />
        </View>
        </>
        ) : null}

        {/* Money — revenue billed, payments received, running costs */}
        {trip ? (
          <Card
            padding={11}
            onPress={openFinance}
            accessibilityLabel="Payments and revenue"
          >
            <View style={styles.financeRow}>
              <IconWell
                icon="credit-card"
                size={34}
                iconSize={16}
                backgroundColor={palette.navyTint}
                color={palette.navy}
                borderRadius={radius.md}
              />
              <View style={styles.financeBody}>
                <Text style={styles.financeTitle}>Payments &amp; Revenue</Text>
                <Text style={styles.financeSub} numberOfLines={1}>
                  Fare, payments received and trip expenses
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={palette.slate400} />
            </View>
          </Card>
        ) : null}
      </Content>

      <Footer row>
        <Button
          label="Timeline"
          variant="outline"
          icon="clipboard-list"
          iconSize={14}
          flex={1}
          padding={10}
          fontSize={11}
          gap={5}
          borderColor={palette.border}
          onPress={openTimeline}
        />
        <Button
          label="Track Live"
          variant="gold"
          icon="map-pin"
          iconSize={14}
          flex={1.5}
          padding={10}
          fontSize={11}
          gap={5}
          onPress={trackLive}
        />
      </Footer>

      <ConfirmDialog
        visible={dialog !== null}
        tone={dialog?.tone}
        icon={dialog?.icon}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={closeDialog}
      />

      {/* Full-screen map — the same Google map, now with gestures, a
          satellite toggle and recentre, fed the same route, halts and fixes. */}
      <Modal
        visible={fullMap}
        animationType="slide"
        onRequestClose={() => setFullMap(false)}
        statusBarTranslucent
      >
        <View style={styles.fullWrap}>
          <DriverGeoMap
            interactive
            driver={geoDriver}
            vehicle={geoVehicle}
            pickup={pickupCoord}
            drop={dropCoord}
            routeCoordinates={road?.path}
            halts={halts}
            style={styles.fullMap}
          />
          <Pressable
            style={[styles.mapClose, { top: insets.top + s(12) }]}
            onPress={() => setFullMap(false)}
            accessibilityRole="button"
            accessibilityLabel="Close full-screen map"
          >
            <Icon name="x" size={20} color={palette.navy} />
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(11) },
  routeBody: { flex: 1, minWidth: 0 },
  routeLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.8 }),
  routePlace: font(13, '800', { color: palette.navy }),
  routeAddr: font(10, '500', { color: palette.slate500 }),
  routeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
    marginVertical: s(10),
    marginLeft: s(43),
  },

  financeRow: { flexDirection: 'row', alignItems: 'center', gap: s(11) },
  financeBody: { flex: 1, minWidth: 0 },
  financeTitle: font(12, '800', { color: palette.navy }),
  financeSub: font(9, '500', { color: palette.slate500 }),

  hero: {
    borderRadius: radius.xl,
    padding: s(14),
    marginBottom: s(12),
    overflow: 'hidden',
  },
  heroBody: { position: 'relative' },
  heroHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  heroRef: font(14, '800', { color: palette.white }),
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(4),
    paddingHorizontal: s(10),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: s(20),
  },
  heroChipText: font(8, '800', { color: palette.gold, letterSpacing: 1 }),
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  heroCity: font(13, '800', { color: palette.white }),
  progressBlock: { marginTop: s(10) },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(4),
  },
  progressText: { ...font(9, '800', { color: palette.white }), opacity: 0.85 },
  track: {
    height: s(5),
    backgroundColor: alpha.white15,
    borderRadius: s(3),
    overflow: 'hidden',
  },
  fill: { height: '100%', width: '21%', borderRadius: s(3) },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  fullWrap: { flex: 1, backgroundColor: palette.screenBg },
  fullMap: { borderRadius: 0 },
  mapClose: {
    position: 'absolute',
    left: s(12),
    width: s(40),
    height: s(40),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapMarker,
  },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginBottom: s(8),
  },
  driverAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(11, '800', { color: palette.white }),
  presence: {
    position: 'absolute',
    bottom: s(-1),
    right: s(-1),
    width: s(11),
    height: s(11),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.white,
  },
  driverBody: { flex: 1 },
  driverName: font(11, '800', { color: palette.navy }),
  driverPhone: font(9, '400', { color: palette.slate500 }),
  callGold: {
    width: s(30),
    height: s(30),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callOff: { opacity: 0.45 },
  callNavy: {
    width: s(30),
    height: s(30),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingTop: s(8),
    borderTopWidth: s(1),
    borderTopColor: palette.gray200,
    borderStyle: 'dashed',
  },
  reassignBtn: { marginTop: s(10) },
  /* The completion card's heading row — icon beside the state it reports. */
  approveHead: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  // The customer's confirmation under an approved trip's heading.
  custLine: {
    ...font(9, '800', { color: palette.green }),
    marginTop: s(8),
  },
  /* The completion checklist — margins, not `gap`, for the column spacing. */
  checkIntro: {
    ...font(9, '500', { color: palette.slate500, lineHeight: 1.4 }),
    marginBottom: s(10),
  },
  stepAction: { marginTop: s(8) },
  formActions: { flexDirection: 'row', gap: s(8), marginTop: s(8) },
  completionError: {
    ...font(10, '700', { color: palette.red, lineHeight: 1.4 }),
    marginTop: s(10),
  },
  gps: font(9, '800', { color: palette.gold }),

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  customerTile: {
    width: s(38),
    height: s(38),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: font(11, '800', { color: palette.navy }),

  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    marginBottom: s(12),
  },
  docCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: s(9),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  docBody: { flex: 1, minWidth: 0 },
  docName: font(9, '800', { color: palette.navy }),
  docSize: font(8, '400', { color: palette.slate500 }),
  docEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginBottom: s(12),
    padding: s(11),
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  reportRow: { flexDirection: 'row', gap: s(8), marginBottom: s(12) },
  // The second pair sits tight under the first — one block of downloads, not
  // two lists that happen to be near each other.
  reportRowGap: { marginTop: s(-4) },
  docEmptyText: {
    ...font(9, '600', { color: palette.slate500 }),
    flex: 1,
  },

  /* Document requests — one row per ask, divided by a hairline. Margins, not
     `gap`, keep the column spacing honest on the New Architecture. */
  reqRow: { flexDirection: 'row', alignItems: 'flex-start' },
  reqRowDivided: {
    marginTop: s(10),
    paddingTop: s(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  // Stands in for the icon well while the received paper is being opened.
  reqWell: {
    width: s(30),
    height: s(30),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqBody: { flex: 1, minWidth: 0, marginLeft: s(10) },
  reqHead: { flexDirection: 'row', alignItems: 'center' },
  reqType: {
    ...font(11, '800', { color: palette.navy }),
    flex: 1,
    marginRight: s(8),
  },
  reqPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    borderRadius: radius.sm,
  },
  reqPillText: {
    ...font(8, '800', { letterSpacing: 0.4 }),
    textTransform: 'uppercase',
  },
  reqPillIcon: { marginLeft: s(4) },
  reqMeta: { ...font(9, '500', { color: palette.slate500 }), marginTop: s(2) },
  reqNote: {
    ...font(9, '600', { color: palette.slate700, lineHeight: 1.4 }),
    marginTop: s(4),
  },
  reqWithdraw: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: s(7),
    paddingVertical: s(4),
    paddingHorizontal: s(9),
    borderRadius: radius.full,
    borderWidth: s(1),
    borderColor: palette.redSoft,
  },
  reqWithdrawText: {
    ...font(9, '800', { color: palette.red }),
    marginLeft: s(4),
  },

  pressed: { opacity: 0.8 },
});
