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
  Footer,
  Icon,
  IconWell,
  RadialGlow,
  Screen,
  Select,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import {
  bookingService,
  documentService,
  driverService,
  vehicleService,
  type AdminDocument,
} from '@services/fleet.service';
import { openExternalUrl } from '@utils/openExternalUrl';
import { useApi } from '@hooks/useApi';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import type { IconName } from '@components/common/Icon';

/** A pending decision or outcome, shown by the dialog at the foot of the screen. */
type Dialog = {
  tone: ConfirmTone;
  icon: IconName;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

/**
 * Screen 17 — Review Booking.
 *
 *   navy hero (#ST-2026-8842, blinking PENDING chip, route, meta strip) ·
 *   CUSTOMER card with call · LOCATIONS (loading / unloading) · PACKAGE 2×2 ·
 *   attached documents pair · ASSIGN VEHICLE and ASSIGN DRIVER selects, each
 *   with the confirmed best-match card · Reject / Approve & Dispatch footer
 */
/*
 * The assign lists were three hardcoded lorries and three hardcoded people,
 * whose values (`AP39TR4522`, `manoj`) were registration plates and first
 * names — not ids. Approving could never have worked against the API, which
 * takes a `vehicleId` and a `driverId`.
 */

/**
 * How each kind of paperwork is labelled and coloured.
 *
 * Keyed by the API's `kind`, so a document is drawn as what it actually is.
 * The screen used to hardcode exactly two cards — an e-way bill and an
 * invoice — regardless of what had been filed, which meant a booking carrying
 * a lorry receipt showed neither it nor the truth about the other two.
 */
const DOC_STYLE: Record<
  string,
  { label: string; icon: IconName; bg: string; color: string }
> = {
  EWAY: { label: 'E-way Bill', icon: 'scroll-text', bg: palette.navyTint, color: palette.navy },
  INVOICE: { label: 'Invoice', icon: 'receipt', bg: palette.goldTint, color: palette.gold },
  WAYBILL: { label: 'Waybill', icon: 'file-text', bg: palette.navyTint, color: palette.navy },
  LR: { label: 'Lorry Receipt', icon: 'file-check', bg: palette.goldTint, color: palette.gold },
  POD: { label: 'Proof of Delivery', icon: 'package-check', bg: palette.redTint, color: palette.red },
  OTHER: { label: 'Document', icon: 'file-text', bg: palette.navyTint, color: palette.navy },
};

/** `12326` -> `12 KB`. Bytes are what the API stores; nobody reads bytes. */
function formatSize(bytes: number): string {
  if (!bytes) {
    return '—';
  }
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PACKAGE = [
  { label: 'MATERIAL', value: 'Steel Pipes' },
  { label: 'WEIGHT', value: '12.5 Ton' },
  { label: 'UNITS', value: '25 Bundles' },
  { label: 'PACKAGE', value: 'Bundles' },
];

export const BookingReviewScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingReview'>>();
  const { bookingId } = route.params;

  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [busy, setBusy] = useState(false);

  /*
   * The dialog is state rather than an imperative call.
   *
   * `Alert.alert` fires and forgets, which is why it cannot be styled and why
   * a screen using it has no say in what the dialog looks like while a request
   * is in flight. Holding the decision here lets the same surface show the
   * question, then the spinner, then the result.
   */
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  /*
   * Only what can actually take the job.
   *
   * `/vehicles/available` and `/drivers/available` exclude anything in
   * maintenance or off duty, and — since the double-booking fix — anything
   * already carrying a load. Those are the same refusals `approve` makes, so
   * every option shown here can actually be chosen.
   */
  const fleet = useApi(() => vehicleService.available(), []);
  const roster = useApi(() => driverService.available(), []);

  /*
   * The booking being reviewed.
   *
   * The screen took a `bookingId` and never fetched it — the documents pair
   * below was a hardcoded "E-way Bill · 234 KB" and "Invoice · 1.1 MB", shown
   * on every booking whether or not either had ever been attached.
   */
  const booking = useApi(() => bookingService.get(bookingId), [bookingId]);

  /**
   * The paperwork actually filed against this shipment.
   *
   * Ordered so the two the office looks for — the e-way bill and the invoice —
   * come first, then everything else in the order it was filed.
   */
  const documents = useMemo(() => {
    const rows = (booking.data?.documents ?? []) as AdminDocument[];
    const rank = (kind: string) =>
      kind === 'EWAY' ? 0 : kind === 'INVOICE' ? 1 : 2;
    return [...rows].sort((a, b) => rank(String(a.kind)) - rank(String(b.kind)));
  }, [booking.data]);

  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  /**
   * Opens one, through a signed link.
   *
   * The eye beside each document was an `Icon`, not a control — it could not
   * be pressed at all, so an approver could see that an e-way bill existed and
   * had no way to read it before deciding.
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

  const vehicleOptions = useMemo(
    () =>
      (fleet.data ?? []).map(row => ({
        value: String(row.id),
        label: [row.registration, row.type && `(${row.type})`, row.status === 'IN_TRIP' ? '— In Trip' : '— Available']
          .filter(Boolean)
          .join(' '),
      })),
    [fleet.data],
  );

  const driverOptions = useMemo(
    () =>
      (roster.data ?? []).map(row => {
        const user = (row.user ?? {}) as { name?: string };
        return {
          value: String(row.id),
          label: [user.name ?? 'Driver', row.status === 'ON_TRIP' ? '— On Trip' : '— Online']
            .filter(Boolean)
            .join(' '),
        };
      }),
    [roster.data],
  );

  /*
   * What is actually selected above, for the confirmation card below it.
   *
   * That card showed `AP 39 TR 4522 · 17 Ft · 9 Ton · Available now` with a
   * gold tick, and `Manoj K · Online · 42 trips · AP 05 CH 9912` beneath the
   * driver picker — fixed text with a checkmark on it, sitting directly under
   * a real dropdown. A dispatcher reading top to bottom would take it as the
   * assignment being confirmed, approve, and send a different lorry than the
   * one on screen. It now echoes the selection, and shows nothing until one
   * has been made.
   */
  const chosenVehicle = useMemo(
    () => (fleet.data ?? []).find(row => String(row.id) === vehicle) ?? null,
    [fleet.data, vehicle],
  );
  const chosenDriver = useMemo(
    () => (roster.data ?? []).find(row => String(row.id) === driver) ?? null,
    [roster.data, driver],
  );

  const chosenDriverName =
    (chosenDriver?.user as { name?: string } | undefined)?.name ?? 'Driver';
  const chosenDriverInitials =
    chosenDriverName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('') || '—';

  /**
   * Rings the customer on this booking.
   *
   * It dialled `+91 98765 43210` — a seed number, the same one on four other
   * screens — so pressing Call on any booking rang one fixed person who was
   * usually not the customer. On a screen whose job is to approve or reject a
   * shipment, that is a call to the wrong company about somebody else's load.
   *
   * Does nothing when there is no number rather than dialling a placeholder:
   * an operator who hears the wrong person answer has already done the damage.
   */
  /* Read from the booking this screen is reviewing. */
  const customer = (booking.data as Record<string, any> | null)?.customer;
  const customerName: string =
    customer?.company || customer?.user?.name || 'Customer';
  const contactName: string = customer?.company ? customer?.user?.name : '';
  const customerMobile: string = customer?.user?.mobile ?? '';
  const customerInitials = customerName
    .split(/\s+/)
    .slice(0, 2)
    .map((word: string) => word[0] ?? '')
    .join('')
    .toUpperCase();

  const call = useCallback(() => {
    if (!customerMobile) {
      return;
    }
    Linking.openURL(`tel:${customerMobile}`).catch(() => undefined);
  }, [customerMobile]);

  /**
   * Reports the outcome, then returns to the list *on the bucket it moved to*.
   *
   * `goBack` alone landed the operator on Pending, where the booking they had
   * just approved is correctly absent — so a successful approval looked like
   * nothing had happened. Naming the tab puts the result on screen.
   */
  const finish = useCallback(
    (title: string, message: string, tab: 'approved' | 'rejected') => {
      setDialog({
        tone: 'success',
        icon: 'check-circle-2',
        title,
        message,
        confirmLabel: 'Done',
        onConfirm: () => {
          setDialog(null);
          navigation.navigate('Tabs', { screen: 'Bookings', params: { tab } });
        },
      });
    },
    [navigation],
  );

  const approve = useCallback(
    async (assignOffDuty = false) => {
      if (!vehicle || !driver) {
        setDialog({
          tone: 'gold',
          icon: 'user-cog',
          title: 'Assign first',
          message: 'Choose both a vehicle and a driver before approving.',
          confirmLabel: 'Got it',
          onConfirm: closeDialog,
        });
        return;
      }
      setBusy(true);
      try {
        await bookingService.approve(bookingId, {
          vehicleId: vehicle,
          driverId: driver,
          ...(assignOffDuty ? { assignOffDuty: true } : {}),
        });
        finish(
          'Approved & dispatched',
          'The trip has been created and the driver notified.',
          'approved',
        );
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : 'Could not approve';

        /*
         * A driver who went off duty between loading this screen and approving
         * it is a refusal the office is allowed to overrule — but only by
         * saying so, which is exactly what `assignOffDuty` means. Offering the
         * override here beats a dead end that sends them back to reassign.
         */
        /*
         * Taken by someone else while this screen was open.
         *
         * The lists are a snapshot: another dispatcher can assign the same
         * lorry between this screen loading and Approve being pressed, and the
         * server refuses it. Reloading both here means the operator's next
         * choice is made from what is free *now* rather than from the stale
         * list that just failed them.
         */
        if (/already on trip/i.test(detail)) {
          fleet.refetch();
          roster.refetch();
          setDialog({
            tone: 'gold',
            icon: 'truck',
            title: 'Already assigned',
            message: `${detail}.\n\nThe lists have been refreshed — pick another and try again.`,
            confirmLabel: 'Choose another',
            onConfirm: closeDialog,
          });
          return;
        }

        if (/off duty|off-duty/i.test(detail) && !assignOffDuty) {
          setDialog({
            tone: 'gold',
            icon: 'user-check',
            title: 'Driver is off duty',
            message: `${detail}\n\nAssign them anyway?`,
            confirmLabel: 'Assign anyway',
            cancelLabel: 'Cancel',
            onConfirm: () => {
              setDialog(null);
              approve(true);
            },
          });
          return;
        }
        setDialog({
          tone: 'danger',
          icon: 'alert-circle',
          title: 'Could not approve',
          message: detail,
          confirmLabel: 'Close',
          onConfirm: closeDialog,
        });
      } finally {
        setBusy(false);
      }
    },
    [bookingId, closeDialog, driver, finish, fleet, roster, vehicle],
  );

  const reject = useCallback(() => {
    setDialog({
      tone: 'danger',
      icon: 'alert-triangle',
      title: 'Reject this booking?',
      message: 'The customer is told it was declined. This cannot be undone.',
      confirmLabel: 'Reject booking',
      cancelLabel: 'Keep it',
      onConfirm: async () => {
        setBusy(true);
        try {
          await bookingService.reject(bookingId, 'Rejected by the office');
          finish(
            'Booking rejected',
            'The customer has been notified.',
            'rejected',
          );
        } catch (error) {
          setDialog({
            tone: 'danger',
            icon: 'alert-circle',
            title: 'Could not reject',
            message:
              error instanceof Error ? error.message : 'Please try again',
            confirmLabel: 'Close',
            onConfirm: closeDialog,
          });
        } finally {
          setBusy(false);
        }
      },
    });
  }, [bookingId, closeDialog, finish]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Review Booking"
        subtitle="#ST-2026-8842"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
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
              <Text style={styles.heroRef}>#ST-2026-8842</Text>
              <View style={styles.heroChip}>
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipText}>PENDING</Text>
              </View>
            </View>

            <View style={styles.heroRoute}>
              <Text style={styles.heroCity}>Kompally</Text>
              <Icon name="arrow-right" size={14} color={palette.gold} />
              <Text style={styles.heroCity}>Vijayawada</Text>
            </View>

            <View style={styles.heroMeta}>
              <Text style={styles.heroMetaText}>278 km</Text>
              <Text style={styles.heroMetaDivider}>|</Text>
              <Text style={styles.heroMetaText}>14 Ft Truck</Text>
              <Text style={styles.heroMetaDivider}>|</Text>
              <Text style={styles.heroMetaText}>Today 4 PM</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Customer */}
        <Text style={styles.section}>CUSTOMER</Text>
        <Card padding={11} style={styles.customerCard}>
          {/*
            The customer on this booking, not a fixed one.
            
            This card read `SS · Sri Sai Traders · Rajesh Kumar · 28 trips ·
            98% on-time` on every booking in the system — a company, a contact
            and two statistics, none of them belonging to the shipment being
            reviewed. The booking has carried all of it since the screen was
            written; it simply was not read.
          */}
          <View style={styles.customerTile}>
            <Text style={styles.customerInitials}>{customerInitials}</Text>
          </View>
          <View style={styles.customerBody}>
            <Text style={styles.customerName} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={styles.customerMeta} numberOfLines={1}>
              {[contactName, customerMobile].filter(Boolean).join(' · ') ||
                'No contact on file'}
            </Text>
          </View>
          <Pressable
            onPress={call}
            disabled={!customerMobile}
            accessibilityRole="button"
            accessibilityState={{ disabled: !customerMobile }}
            accessibilityLabel={
              customerMobile ? `Call ${customerName}` : 'No number on file'
            }
            style={({ pressed }) => [
              styles.callBtn,
              !customerMobile && styles.callBtnOff,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="phone"
              size={14}
              color={customerMobile ? palette.navy : palette.slate400}
            />
          </Pressable>
        </Card>

        {/* Locations */}
        <Text style={[styles.section, styles.sectionGap]}>LOCATIONS</Text>
        <Card padding={11}>
          <View style={styles.locRow}>
            <IconWell
              icon="warehouse"
              size={26}
              iconSize={14}
              backgroundColor={palette.navyTint}
              color={palette.navy}
              borderRadius={radius.md}
            />
            <View style={styles.locBody}>
              <Text style={styles.locLabel}>LOADING AREA</Text>
              <Text style={styles.locName}>Kompally Industrial Estate</Text>
              <Text style={styles.locAddress}>Plot 42, Hyderabad - 500014</Text>
            </View>
          </View>

          <View style={[styles.locRow, styles.locRowGap]}>
            <IconWell
              icon="flag"
              size={26}
              iconSize={14}
              backgroundColor={palette.redTint}
              color={palette.red}
              borderRadius={radius.md}
            />
            <View style={styles.locBody}>
              <Text style={styles.locLabel}>UNLOADING AREA</Text>
              <Text style={styles.locName}>Sri Krishna Warehouse</Text>
              <Text style={styles.locAddress}>MG Road, Vijayawada - 520001</Text>
            </View>
          </View>
        </Card>

        {/* Package */}
        <Text style={[styles.section, styles.sectionGap]}>PACKAGE</Text>
        <Card padding={12}>
          <View style={styles.pkgGrid}>
            {PACKAGE.map(item => (
              <View key={item.label} style={styles.pkgCell}>
                <Text style={styles.pkgLabel}>{item.label}</Text>
                <Text style={styles.pkgValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Documents */}
        {documents.length ? (
          <View style={styles.docGrid}>
            {documents.map(doc => {
              const kind = String(doc.kind ?? 'OTHER');
              const style = DOC_STYLE[kind] ?? DOC_STYLE.OTHER;
              const id = String(doc.id);
              return (
                <Pressable
                  key={id}
                  style={({ pressed }) => [
                    styles.docCard,
                    pressed ? styles.docCardPressed : null,
                  ]}
                  onPress={() => viewDocument(id)}
                  disabled={openingDoc !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${style.label}`}
                  accessibilityState={{ busy: openingDoc === id }}
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
                    {/* The real size, not a fixed "234 KB" on every booking. */}
                    <Text style={styles.docSize} numberOfLines={1}>
                      {formatSize(Number(doc.sizeBytes ?? 0))}
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
          /*
           * Said plainly rather than drawn as two documents that do not exist.
           * An approver needs to know the e-way bill is missing — that is a
           * reason to hold the booking, not a blank to skip past.
           */
          <View style={styles.docEmpty}>
            <Icon name="file-text" size={14} color={palette.slate400} />
            <Text style={styles.docEmptyText}>
              No documents attached to this booking yet.
            </Text>
          </View>
        )}

        {/* Assign vehicle */}
        <Text style={styles.section}>ASSIGN VEHICLE</Text>
        <Card padding={11}>
          <Select
            label="Vehicle"
            options={vehicleOptions}
            value={vehicle}
            onChange={setVehicle}
            placeholder={
              fleet.loading
                ? 'Loading vehicles…'
                : vehicleOptions.length
                  ? 'Select a vehicle'
                  : 'No vehicle is free right now'
            }
            marginBottom={10}
          />

          {chosenVehicle ? (
            <View style={styles.matchGold}>
              <IconWell
                icon="truck"
                size={38}
                iconSize={20}
                backgroundColor={palette.white}
                color={palette.gold}
                borderRadius={radius.lg}
              />
              <View style={styles.matchBody}>
                <Text style={styles.matchTitle}>
                  {String(chosenVehicle.registration ?? '—')}
                </Text>
                <Text style={styles.matchMetaGold}>
                  {[
                    chosenVehicle.type,
                    chosenVehicle.capacity,
                    chosenVehicle.status === 'IN_TRIP'
                      ? 'In trip'
                      : 'Available now',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Icon name="check" size={16} color={palette.gold} />
            </View>
          ) : null}
        </Card>

        {/* Assign driver */}
        <Text style={[styles.section, styles.sectionGap]}>ASSIGN DRIVER</Text>
        <Card padding={11} marginBottom={0}>
          <Select
            label="Driver"
            options={driverOptions}
            value={driver}
            onChange={setDriver}
            placeholder={
              roster.loading
                ? 'Loading drivers…'
                : driverOptions.length
                  ? 'Select a driver'
                  : 'No driver is on duty right now'
            }
            marginBottom={10}
          />

          {chosenDriver ? (
            <View style={styles.matchNavy}>
              <View>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverInitials}>
                    {chosenDriverInitials}
                  </Text>
                </View>
                <View style={styles.presence} />
              </View>

              <View style={styles.matchBody}>
                <Text style={styles.matchTitle}>{chosenDriverName}</Text>
                <View style={styles.driverMetaRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.matchMeta}>
                    {[
                      String(chosenDriver.status ?? '').replace(/_/g, ' '),
                      Number(chosenDriver.totalTrips ?? 0) > 0
                        ? `${chosenDriver.totalTrips} trips`
                        : null,
                      (chosenDriver.vehicle as { registration?: string } | null)
                        ?.registration,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>

              <Icon name="check" size={16} color={palette.gold} />
            </View>
          ) : null}
        </Card>
      </Content>

      <Footer row>
        <Button
          label="Reject"
          variant="outline"
          icon="x"
          iconSize={12}
          flex={1}
          padding={10}
          fontSize={11}
          gap={4}
          color={palette.red}
          borderColor={palette.redSoft}
          disabled={busy}
          onPress={reject}
        />
        <Button
          label={busy ? 'Working…' : 'Approve & Dispatch'}
          variant="gold"
          icon="check-circle-2"
          flex={1.8}
          padding={10}
          fontSize={10.5}
          gap={4}
          loading={busy}
          // Nothing to approve with until both are chosen; the API requires
          // a vehicleId and a driverId and refuses the request without them.
          disabled={busy || !vehicle || !driver}
          onPress={() => approve()}
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
        busy={busy}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={closeDialog}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
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
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginTop: s(4),
  },
  heroMetaText: { ...font(10, '700', { color: palette.white }), opacity: 0.85 },
  heroMetaDivider: {
    ...font(10, '700', { color: palette.white }),
    opacity: 0.4,
  },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  customerCard: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  customerTile: {
    width: s(36),
    height: s(36),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitials: font(12, '800', { color: palette.navy }),
  customerBody: { flex: 1 },
  customerName: font(11, '800', { color: palette.navy }),
  customerMeta: font(9, '400', { color: palette.slate500 }),
  callBtnOff: { opacity: 0.45 },
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: s(9) },
  locRowGap: { marginTop: s(10) },
  locBody: { flex: 1 },
  locLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  locName: {
    ...font(11, '800', { color: palette.navy }),
    marginTop: s(1),
  },
  locAddress: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },

  pkgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s(10) },
  pkgCell: { width: '46%' },
  pkgLabel: font(8, '800', { color: palette.slate500 }),
  pkgValue: {
    ...font(11, '800', { color: palette.navy }),
    marginTop: s(2),
  },

  /* Wraps: a booking can carry more than the two the mock drew. */
  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
    marginTop: s(12),
    marginBottom: s(12),
  },
  docCardPressed: { opacity: 0.75 },
  docEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(12),
    marginBottom: s(12),
    padding: s(11),
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  docEmptyText: {
    ...font(9, '600', { color: palette.slate500 }),
    flex: 1,
  },
  docCard: {
    /* `minWidth` so two fit a row and a third wraps rather than crushing. */
    flexGrow: 1,
    minWidth: '46%',
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

  matchGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.goldSoft,
    borderRadius: radius.lg,
    padding: s(10),
  },
  matchNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.navyTint,
    borderRadius: radius.lg,
    padding: s(10),
  },
  matchBody: { flex: 1 },
  matchTitle: font(11, '800', { color: palette.navy }),
  matchMeta: font(9, '400', { color: palette.slate500 }),
  matchMetaGold: font(9, '700', { color: palette.goldText }),

  driverAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: radius.full,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverInitials: font(12, '800', { color: palette.white }),
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
  driverMetaRow: { flexDirection: 'row', alignItems: 'center', gap: s(3) },
  onlineDot: {
    width: s(5),
    height: s(5),
    borderRadius: radius.full,
    backgroundColor: palette.green,
  },

  pressed: { opacity: 0.8 },
});
