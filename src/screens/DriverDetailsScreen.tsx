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

import { driverService, tripService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

import {
  AppHeader,
  Button,
  Card,
  ConfirmDialog,
  Content,
  DriverGeoMap,
  Icon,
  IconWell,
  ImageViewerModal,
  RadialGlow,
  Screen,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import { openExternalUrl } from '@utils/openExternalUrl';
import { isImageDoc } from '@utils/mediaUrl';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 11 — Driver Profile.
 *
 *   navy hero (gold-ringed 60px avatar, VERIFIED · ONLINE chip, call button) ·
 *   stats card overlapping by -24px (TRIPS / EXPERIENCE / ON TIME) ·
 *   CURRENT TRIP navy card · ASSIGNED VEHICLE row · PERSONAL DETAILS
 *   (DL / Aadhar / PAN, each VERIFIED) · outline Edit Driver Profile
 */
type KycRow = {
  id: string;
  title: string;
  meta: string;
  icon: IconName;
  bg: string;
  color: string;
  reviewStatus: 'APPROVED' | 'PENDING' | 'REJECTED' | string;
  /** Whether the scan is an image (opens in-app) rather than a PDF (opens out). */
  isImage: boolean;
};

/** A pending decision or outcome shown by the dialog at the foot of the screen. */
type Dialog = {
  tone: ConfirmTone;
  icon: IconName;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};



export const DriverDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DriverDetails'>>();
  const { driverId } = route.params;

  /*
   * The screen never read its own route parameter.
   *
   * Everything below was a literal — a fixed phone number, `vehicleId: 'v1'`,
   * `tripId: 'TR-2026-8836'` — so whichever driver you opened, the call button
   * rang one number and the vehicle card opened an id that does not exist,
   * which is a Vehicle Details screen that 404s and never loads.
   */
  const { data, refetch } = useApi(() => driverService.get(driverId), [driverId]);

  const vehicle = (data?.vehicle ?? null) as {
    id?: string;
    registration?: string;
  } | null;
  const mobile = (data?.user as { mobile?: string } | undefined)?.mobile;
  const name = (data?.user as { name?: string } | undefined)?.name ?? '—';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '')
      .join('') || '—';

  /*
   * The papers this driver actually has on file.
   *
   * `KYC` was three literals — `DLAP 04...123456 · Till 2029`, Aadhaar ending
   * 4521, PAN `ABCDE1234F` — shown identically for every driver in the roster,
   * including one who had uploaded nothing. The API returns the real rows,
   * each with the health the backend computed from its expiry.
   */
  /** The licence, which hangs off the driver rather than the document rows. */
  const licence = data?.licenceNumber
    ? [
        String(data.licenceNumber),
        data.licenceValid
          ? `Till ${new Date(String(data.licenceValid)).getFullYear()}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  const kyc = useMemo<KycRow[]>(() => {
    const look: Record<string, { title: string; icon: IconName; bg: string; color: string }> = {
      DL: { title: 'Driving License', icon: 'id-card', bg: palette.goldTint, color: palette.gold },
      LICENCE: { title: 'Driving License', icon: 'id-card', bg: palette.goldTint, color: palette.gold },
      AADHAAR: { title: 'Aadhaar', icon: 'fingerprint', bg: palette.navyTint, color: palette.navy },
      AADHAAR_BACK: { title: 'Aadhaar (back)', icon: 'fingerprint', bg: palette.navyTint, color: palette.navy },
      PAN: { title: 'PAN Card', icon: 'credit-card', bg: palette.redTint, color: palette.red },
    };
    const rows = (data?.documents ?? []) as Array<Record<string, any>>;
    return rows.map(row => {
      const kind = String(row.kind ?? '');
      const style = look[kind] ?? {
        title: kind.replace(/_/g, ' '),
        icon: 'file-text' as IconName,
        bg: palette.navyTint,
        color: palette.navy,
      };
      const till = row.expiresAt
        ? `Till ${new Date(row.expiresAt).getFullYear()}`
        : null;
      /*
       * The licence number lives on the driver, not on the document row.
       * `Document.number` is null for scans filed by the Add Driver screen,
       * so the DL row would read a bare "On file" while the number the office
       * typed in sat one field away.
       */
      const isLicence = kind === 'DL' || kind === 'LICENCE';
      return {
        id: String(row.id),
        title: style.title,
        meta:
          (isLicence ? licence : null) ??
          ([row.number, till].filter(Boolean).join(' · ') || 'On file'),
        icon: style.icon,
        bg: style.bg,
        color: style.color,
        reviewStatus: String(row.reviewStatus ?? 'PENDING'),
        // An image is read in-app; a PDF still opens outside.
        isImage: isImageDoc(row.fileUrl),
      };
    });
  }, [data?.documents, licence]);

  /*
   * The onboarding gate. A driver cannot be assigned a trip until every paper is
   * approved — the backend refuses it — so the office clears them here, the same
   * review the web panel does. A driver with no documents on file is left
   * assignable (the roster predates the rule), which is why an empty list is not
   * treated as "pending".
   */
  const pendingCount = useMemo(
    () => kyc.filter(row => row.reviewStatus !== 'APPROVED').length,
    [kyc],
  );

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const closeDialog = useCallback(() => setDialog(null), []);

  /** The scan currently open in the in-app image viewer, if any. */
  const [viewer, setViewer] = useState<{ uri: string; title: string } | null>(
    null,
  );
  const closeViewer = useCallback(() => setViewer(null), []);

  /**
   * Opens the scan the driver filed, through a signed link. The office reviews
   * a document by looking at it, so an image opens in-app in the viewer below;
   * a PDF, which has no in-app renderer, opens in the device's own viewer.
   */
  const viewDoc = useCallback(
    async (documentId: string, title: string, isImage: boolean) => {
      setOpeningDoc(documentId);
      try {
        // A driver's papers are in the `DriverDocument` table, reachable only by
        // the driver-scoped route — the shipment `documents/:id/download` cannot
        // find them, which is why these scans would not open.
        const url = await driverService.documentUrl(driverId, documentId);
        if (isImage) {
          setViewer({ uri: url, title });
        } else {
          await openExternalUrl(url);
        }
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
    },
    [driverId],
  );

  const reviewDoc = useCallback(
    async (documentId: string, status: 'APPROVED' | 'REJECTED') => {
      setReviewingId(documentId);
      try {
        await driverService.reviewDocument(driverId, documentId, status);
        await refetch();
      } finally {
        setReviewingId(null);
      }
    },
    [driverId, refetch],
  );

  const approveAll = useCallback(async () => {
    setApprovingAll(true);
    try {
      await driverService.approveAllDocuments(driverId);
      await refetch();
    } finally {
      setApprovingAll(false);
    }
  }, [driverId, refetch]);

  /** How long they have been with the firm, from `joinedAt`. */
  const tenure = (() => {
    if (!data?.joinedAt) {
      return '—';
    }
    const months = Math.max(
      0,
      Math.round(
        (Date.now() - new Date(String(data.joinedAt)).getTime()) /
          (1000 * 60 * 60 * 24 * 30.44),
      ),
    );
    return months >= 12 ? `${Math.floor(months / 12)}y` : `${months}m`;
  })();



  /* The trip this driver is on, if any — matched on the live board. */
  const live = useApi(() => tripService.live(), []);
  const trip = useMemo(
    () => (live.data ?? []).find(t => t.registration === vehicle?.registration) ?? null,
    [live.data, vehicle?.registration],
  );

  /*
   * The driver on the map, and their lorry beside them.
   *
   * The phone streams the driver's own fix; the lorry carries no tracker of its
   * own, so while a trip is running it is exactly where the driver is (the same
   * cab). So the vehicle falls back to the driver's fix on a trip, and off a
   * trip it reads "not reported" rather than a guessed pin — the same rule the
   * web panel follows.
   */
  const status = String(data?.status ?? '');
  const onTrip = status === 'ON_TRIP';
  const driverLat = (data as Record<string, any> | undefined)?.lastLat as
    | number
    | null
    | undefined;
  const driverLng = (data as Record<string, any> | undefined)?.lastLng as
    | number
    | null
    | undefined;
  const geoDriver =
    driverLat != null && driverLng != null
      ? { position: { latitude: driverLat, longitude: driverLng }, name, onTrip }
      : null;

  const vehLat =
    ((vehicle as Record<string, any> | null)?.lastLat as number | null | undefined) ??
    (onTrip ? driverLat : null);
  const vehLng =
    ((vehicle as Record<string, any> | null)?.lastLng as number | null | undefined) ??
    (onTrip ? driverLng : null);
  const geoVehicle =
    vehicle?.registration && vehLat != null && vehLng != null
      ? {
          position: { latitude: vehLat, longitude: vehLng },
          reg: vehicle.registration,
        }
      : null;

  const call = useCallback(() => {
    if (mobile) {
      Linking.openURL(`tel:${mobile}`).catch(() => undefined);
    }
  }, [mobile]);

  const openTrip = useCallback(() => {
    if (trip) {
      navigation.navigate('TripDetails', { tripId: trip.tripId });
    }
  }, [navigation, trip]);

  const openVehicle = useCallback(() => {
    /* No truck assigned means nothing to open — better inert than a 404. */
    if (vehicle?.id) {
      navigation.navigate('VehicleDetails', { vehicleId: vehicle.id });
    }
  }, [navigation, vehicle]);

  /**
   * Editing reuses the Add Driver form.
   *
   * The id is what tells that screen to open in edit mode — it fetches this
   * driver, prefills every field, and saves as an update. Navigating with no
   * params, as this used to, opened a blank form that would have *created* a
   * second driver instead of editing this one.
   */
  const editDriver = useCallback(
    () => navigation.navigate('AddDriver', { driverId }),
    [navigation, driverId],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader title="Driver Profile" showBack onBackPress={navigation.goBack} />

      <Content padding={0}>
        {/* Driver hero */}
        <LinearGradient
          colors={[palette.navy, palette.navyMid, palette.navyDark]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={140}
            color={palette.gold}
            opacity={0.28}
            top={-40}
            right={-40}
          />

          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={gradients.gold as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.presence} />
            </View>

            <View style={styles.heroBody}>
              <Text style={styles.heroName}>{name}</Text>
              <Text style={styles.heroPhone}>{mobile ?? 'No number on file'}</Text>
              {/*
                The driver's real state. This chip said VERIFIED · ONLINE for
                everyone, including drivers who were off duty or suspended.
              */}
              <View style={styles.verifiedChip}>
                <Icon name="badge-check" size={10} color={palette.navy} />
                <Text style={styles.verifiedText}>
                  {String(data?.status ?? '—').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={call}
              accessibilityRole="button"
              accessibilityLabel={`Call ${name}`}
              disabled={!mobile}
              style={({ pressed }) => [
                styles.callBtn,
                pressed && styles.pressed,
                !mobile && styles.callDisabled,
              ]}
            >
              <Icon name="phone" size={16} color={palette.navy} />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Stats card overlap */}
        <View style={styles.statsWrap}>
          <View style={styles.statsCard}>
            <View style={[styles.stat, styles.statDivider]}>
              <View style={styles.statValueRow}>
                <Icon name="truck" size={12} color={palette.gold} />
                {/*
                  Real counters. These read 240 trips, 4 years and 98% on time
                  for every driver — including one hired last week with none.
                */}
                <Text style={styles.statValue}>
                  {Number(data?.totalTrips ?? 0)}
                </Text>
              </View>
              <Text style={styles.statLabel}>TRIPS</Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <View style={styles.statValueRow}>
                <Icon name="calendar-days" size={12} color={palette.gold} />
                <Text style={styles.statValue}>{tenure}</Text>
              </View>
              <Text style={styles.statLabel}>WITH SMT</Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.statValueRow}>
                <Icon name="check-circle-2" size={12} color={palette.gold} />
                {/*
                  Rating, not an on-time percentage — nothing in the system
                  measures punctuality per driver, so 98% was an invention.
                */}
                <Text style={styles.statValue}>
                  {Number(data?.rating ?? 0) > 0
                    ? Number(data?.rating).toFixed(1)
                    : '—'}
                </Text>
              </View>
              <Text style={styles.statLabel}>RATING</Text>
            </View>
          </View>
        </View>

        {/* Current trip */}
        <View style={styles.block}>
          <Text style={styles.section}>CURRENT TRIP</Text>
          <Pressable
            onPress={openTrip}
            accessibilityRole="button"
            accessibilityLabel={trip ? `Open current trip ${trip.reference}` : 'No trip running'}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <LinearGradient
              colors={gradients.navyHero as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tripCard}
            >
              {/*
                The trip this driver is actually on, matched off the live
                board — or a plain line saying there isn't one. The card used
                to show `#TR-2026-8836 · 128/620 KM · Vizag → Hyderabad` for
                every driver on the roster, idle ones included.
              */}
              {trip ? (
                <>
                  <View style={styles.tripHead}>
                    <Text style={styles.tripRef}>{trip.reference}</Text>
                    <Text style={styles.tripKm}>
                      {Math.round(Number(trip.coveredKm ?? 0))}/
                      {Math.round(Number(trip.distanceKm ?? 0))} KM
                    </Text>
                  </View>
                  {/*
                    The live board sends the leg as one `A → B` string rather
                    than two fields, so it is split on the arrow it already
                    contains instead of asking the API to change shape.
                  */}
                  <View style={styles.tripRoute}>
                    <Text style={styles.tripCity} numberOfLines={1}>
                      {trip.route?.split('→')[0]?.trim() || '—'}
                    </Text>
                    <Icon name="arrow-right" size={14} color={palette.gold} />
                    <Text
                      style={[styles.tripCity, styles.tripCityDrop]}
                      numberOfLines={1}
                    >
                      {trip.route?.split('→')[1]?.trim() || '—'}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noTrip}>
                  {live.loading ? 'Checking…' : 'Not on a trip right now'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Assigned vehicle */}
        <View style={styles.block}>
          <Text style={styles.section}>ASSIGNED VEHICLE</Text>
          <Card
            padding={11}
            marginBottom={0}
            onPress={openVehicle}
            accessibilityLabel={
              vehicle?.registration
                ? `Open vehicle ${vehicle.registration}`
                : 'No vehicle assigned'
            }
            style={styles.vehicleRow}
          >
            <IconWell
              icon="truck"
              size={38}
              iconSize={20}
              backgroundColor={palette.goldTint}
              color={palette.gold}
              borderRadius={radius.lg}
            />
            <View style={styles.vehicleBody}>
              <Text style={styles.vehicleReg}>
                {vehicle?.registration ?? 'No vehicle assigned'}
              </Text>
              <Text style={styles.vehicleModel}>
                {[
                  (vehicle as Record<string, any> | null)?.type,
                  (vehicle as Record<string, any> | null)?.model,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={palette.slate400} />
          </Card>
        </View>

        {/* Geo location — the driver and their lorry on one map. Both show while
            a trip is running (the lorry rides with the driver); off a trip it
            reads "not reported" rather than guessing. */}
        <View style={styles.block}>
          <Text style={styles.section}>GEO LOCATION</Text>
          <DriverGeoMap
            driver={geoDriver}
            vehicle={geoVehicle}
            height={s(200)}
            onPress={() =>
              navigation.navigate('GeoMap', {
                title: name && name !== '—' ? `${name} · location` : 'Location',
                driver: geoDriver,
                vehicle: geoVehicle,
              })
            }
          />
        </View>

        {/* Documents — the onboarding approval gate */}
        <View style={styles.block}>
          <View style={styles.sectionRow}>
            <Text style={[styles.section, styles.sectionNoMargin]}>DOCUMENTS</Text>
            {pendingCount > 0 ? (
              <Pressable
                style={styles.approveAllBtn}
                disabled={approvingAll}
                onPress={approveAll}
              >
                <Icon name="check-circle-2" size={12} color={palette.navy} />
                <Text style={styles.approveAllText}>
                  {approvingAll ? 'Approving…' : `Approve all (${pendingCount})`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {pendingCount > 0 ? (
            <View style={styles.gateNote}>
              <Icon name="alert-triangle" size={13} color="#8a5a00" />
              <Text style={styles.gateNoteText}>
                {pendingCount} document{pendingCount > 1 ? 's' : ''} awaiting your
                review. A trip can&apos;t be assigned to this driver until every
                paper is approved.
              </Text>
            </View>
          ) : null}

          <View style={styles.kycCard}>
            {!kyc.length ? (
              <View style={styles.kycRow}>
                <Text style={styles.noKyc}>
                  No documents have been filed for this driver.
                </Text>
              </View>
            ) : null}
            {kyc.map((row, index) => {
              const approved = row.reviewStatus === 'APPROVED';
              const rejected = row.reviewStatus === 'REJECTED';
              const busy = reviewingId === row.id;
              return (
                <View
                  key={row.id}
                  style={index < kyc.length - 1 ? styles.kycDivider : undefined}
                >
                  <Pressable
                    onPress={() => viewDoc(row.id, row.title, row.isImage)}
                    disabled={openingDoc !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${row.title}`}
                    accessibilityState={{ busy: openingDoc === row.id }}
                    style={({ pressed }) => [
                      styles.kycRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <IconWell
                      icon={row.icon}
                      size={26}
                      iconSize={14}
                      backgroundColor={row.bg}
                      color={row.color}
                      borderRadius={radius.md}
                    />
                    <View style={styles.kycBody}>
                      <Text style={styles.kycTitle}>{row.title}</Text>
                      <Text style={styles.kycMeta}>{row.meta}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        approved
                          ? styles.statusApproved
                          : rejected
                            ? styles.statusRejected
                            : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          approved
                            ? styles.statusApprovedText
                            : rejected
                              ? styles.statusRejectedText
                              : styles.statusPendingText,
                        ]}
                      >
                        {approved ? 'APPROVED' : rejected ? 'REJECTED' : 'PENDING'}
                      </Text>
                    </View>
                    {openingDoc === row.id ? (
                      <ActivityIndicator size="small" color={palette.navy} />
                    ) : (
                      <Icon name="eye" size={14} color={palette.slate400} />
                    )}
                  </Pressable>

                  {!approved ? (
                    <View style={styles.reviewRow}>
                      <Pressable
                        style={[styles.reviewBtn, styles.reviewApprove]}
                        disabled={busy}
                        onPress={() => reviewDoc(row.id, 'APPROVED')}
                      >
                        <Icon name="check-circle-2" size={12} color={palette.navy} />
                        <Text style={styles.reviewApproveText}>
                          {busy ? 'Saving…' : 'Approve'}
                        </Text>
                      </Pressable>
                      {!rejected ? (
                        <Pressable
                          style={[styles.reviewBtn, styles.reviewReject]}
                          disabled={busy}
                          onPress={() => reviewDoc(row.id, 'REJECTED')}
                        >
                          <Icon name="x" size={12} color={palette.red} />
                          <Text style={styles.reviewRejectText}>Reject</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.footerBlock}>
          <Button
            label="Edit Driver Profile"
            variant="outline"
            icon="edit-3"
            onPress={editDriver}
          />
        </View>
      </Content>

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

      {/* An image scan, read inside the app. */}
      <ImageViewerModal
        visible={viewer !== null}
        uri={viewer?.uri}
        title={viewer?.title}
        onClose={closeViewer}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingTop: s(18),
    paddingHorizontal: s(14),
    paddingBottom: s(40),
    overflow: 'hidden',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  avatarWrap: { width: s(66), height: s(66), alignItems: 'center', justifyContent: 'center' },
  avatarRing: { ...StyleSheet.absoluteFill, borderRadius: radius.full },
  avatar: {
    width: s(60),
    height: s(60),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: font(22, '800', { color: palette.navy }),
  presence: {
    position: 'absolute',
    bottom: s(-2),
    right: s(-2),
    width: s(14),
    height: s(14),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.navy,
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroName: font(15, '800', { color: palette.white, lineHeight: 1.15 }),
  heroPhone: {
    ...font(10, '400', { color: palette.white }),
    opacity: 0.75,
    marginTop: s(1),
  },
  verifiedChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(5),
    paddingVertical: s(2),
    paddingHorizontal: s(8),
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
  },
  verifiedText: font(8, '800', { color: palette.navy, letterSpacing: 0.5 }),
  callBtn: {
    width: s(36),
    height: s(36),
    backgroundColor: palette.gold,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsWrap: { paddingHorizontal: s(12), marginTop: s(-24) },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    paddingVertical: s(12),
    paddingHorizontal: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadows.elevatedCard,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.divider,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  statValue: font(16, '800', { color: palette.navy, lineHeight: 1 }),
  statLabel: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    marginTop: s(5),
  },

  block: { paddingTop: s(14), paddingHorizontal: s(12) },
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  tripCard: { borderRadius: radius.card, padding: s(11) },
  tripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(6),
  },
  tripRef: font(9, '800', { color: palette.gold, letterSpacing: 0.5 }),
  tripKm: font(9, '800', { color: palette.gold }),
  tripRoute: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  // Each end takes half the row and truncates, so a long pickup address no
  // longer swallows the line and pushes the arrow and drop out of alignment.
  tripCity: { ...font(11, '800', { color: palette.white }), flex: 1, minWidth: 0 },
  tripCityDrop: { textAlign: 'right' },

  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  vehicleBody: { flex: 1 },
  callDisabled: { opacity: 0.4 },
  noTrip: font(11, '700', { color: 'rgba(255,255,255,0.7)' }),
  noKyc: font(11, '600', { color: palette.slate500 }),
  vehicleReg: font(11, '800', { color: palette.navy, letterSpacing: 0.5 }),
  vehicleModel: font(9, '400', { color: palette.slate500 }),

  kycCard: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  kycRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(11),
    paddingVertical: s(11),
    paddingHorizontal: s(12),
  },
  kycDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  kycBody: { flex: 1 },
  kycTitle: font(11, '800', { color: palette.navy }),
  kycMeta: font(9, '400', { color: palette.slate500 }),
  pillGold: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillGoldText: font(8, '800', { color: palette.goldText }),

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(8),
  },
  sectionNoMargin: { marginBottom: 0 },
  approveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(4),
    paddingHorizontal: s(9),
    borderRadius: radius.pill,
    backgroundColor: palette.goldSoft,
  },
  approveAllText: font(9, '800', { color: palette.navy, letterSpacing: 0.3 }),
  gateNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(7),
    padding: s(10),
    marginBottom: s(8),
    borderRadius: radius.md,
    backgroundColor: '#fff7e0',
  },
  gateNoteText: {
    ...font(10, '600', { color: '#8a5a00', lineHeight: 1.4 }),
    flex: 1,
  },
  statusPill: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    borderRadius: radius.sm,
  },
  statusPillText: font(8, '800', { letterSpacing: 0.4 }),
  statusApproved: { backgroundColor: '#e8f7ee' },
  statusApprovedText: { color: '#16a34a' },
  statusPending: { backgroundColor: '#fff7e0' },
  statusPendingText: { color: '#8a5a00' },
  statusRejected: { backgroundColor: '#fff1f2' },
  statusRejectedText: { color: palette.red },
  reviewRow: {
    flexDirection: 'row',
    gap: s(8),
    paddingHorizontal: s(12),
    paddingBottom: s(11),
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(6),
    paddingHorizontal: s(12),
    borderRadius: radius.md,
  },
  reviewApprove: { backgroundColor: palette.goldSoft },
  reviewApproveText: font(10, '800', { color: palette.navy }),
  reviewReject: { backgroundColor: '#fff1f2' },
  reviewRejectText: font(10, '800', { color: palette.red }),

  footerBlock: {
    paddingTop: s(14),
    paddingHorizontal: s(12),
    paddingBottom: s(20),
  },

  pressed: { opacity: 0.8 },
});
