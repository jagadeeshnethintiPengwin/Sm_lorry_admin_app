import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
  Icon,
  IconWell,
  ListState,
  RadialGlow,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import type { RootStackParamList } from '@navigation/types';
import {
  documentService,
  tripService,
  type AdminDocument,
  type TripFinance,
} from '@services/fleet.service';
import { exportTripExcel, exportTripPdf } from '@services/tripReport.service';
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

/** `12326` -> `12 KB`. Bytes are what the API stores; nobody reads bytes. */
function formatSize(bytes: number): string {
  if (!bytes) {
    return '';
  }
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
  const customer = booking?.customer;
  const customerName: string =
    customer?.company || customer?.user?.name || 'Customer';
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

  const [openingDoc, setOpeningDoc] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  /**
   * Builds the trip report and hands it to the OS share sheet — an `.xlsx` the
   * office can file, or a `.pdf` that embeds the delivery photos and scans. The
   * heavy work runs in the service; here we only disable the buttons while it
   * runs and surface a failure through the same dialog the rest of the screen
   * uses. A dismissed share sheet is not a failure and is swallowed downstream.
   */
  const runExport = useCallback(
    async (kind: 'excel' | 'pdf') => {
      if (!trip) {
        return;
      }
      setExporting(kind);
      try {
        const build = kind === 'excel' ? exportTripExcel : exportTripPdf;
        await build(trip, finance.data ?? null, documents);
      } catch (failure) {
        setDialog({
          tone: 'danger',
          icon: 'alert-circle',
          title: 'Could not create the report',
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
    [trip, finance.data, documents],
  );

  /**
   * Opens one submitted document — the file itself, through a signed link, in
   * the device's own viewer. Deliberately not a jump to another screen: the
   * office wants to see the scan the driver or customer actually filed.
   */
  const viewDocument = useCallback(async (id: string) => {
    setOpeningDoc(id);
    try {
      await openExternalUrl(await documentService.downloadUrl(id));
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

  // Only a running trip can be handed over or moved on; a delivered or
  // cancelled one is settled, so these actions are offered only while there is
  // something to change.
  const canReassign =
    trip?.status === 'SCHEDULED' || trip?.status === 'IN_TRANSIT';

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
            ? trip.status.replace('_', ' ').toLowerCase()
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
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipText}>
                  {(trip?.status ?? '').replace('_', ' ') || '—'}
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

        {/* Geo location — the lorry and its driver on one map while the trip is
            live; "not reported" otherwise. Both share the live fix (the driver
            rides in the cab) and the map spreads them side by side. */}
        <Text style={[styles.section, styles.sectionGap]}>GEO LOCATION</Text>
        <DriverGeoMap
          driver={geoDriver}
          vehicle={geoVehicle}
          height={s(200)}
          onPress={() =>
            navigation.navigate('GeoMap', {
              title: trip?.reference ? `Trip #${trip.reference}` : 'Location',
              driver: geoDriver,
              vehicle: geoVehicle,
            })
          }
        />

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

        {/* Trip report — the same download the web admin offers: an Excel
            workbook the office can file, or a PDF with the delivery photos and
            document scans embedded. Both are handed to the OS share sheet. */}
        <Text style={[styles.section, styles.sectionGap]}>DOWNLOAD REPORT</Text>
        <View style={styles.reportRow}>
          <Button
            label="Excel"
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
            label="PDF"
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
        onConfirm={() => dialog?.onConfirm()}
        onCancel={closeDialog}
      />
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
  docEmptyText: {
    ...font(9, '600', { color: palette.slate500 }),
    flex: 1,
  },

  pressed: { opacity: 0.8 },
});
