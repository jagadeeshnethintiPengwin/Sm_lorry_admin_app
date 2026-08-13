import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  Content,
  Footer,
  Icon,
  IconWell,
  ListState,
  RadialGlow,
  RouteView,
  Screen,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { tripService, vehicleService } from '@services/fleet.service';
import type { AdminVehicle } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';
import { openExternalUrl } from '@utils/openExternalUrl';

/**
 * Screen 7 — Vehicle Details.
 *
 *   navy hero (52px truck tile, REG NUMBER, IN TRIP / INSURED / FIT OK chips) ·
 *   ASSIGNED DRIVER card with gold presence dot and call button ·
 *   CURRENT TRIP card (route rail + 21% progress) · SPECIFICATIONS 2×3 grid ·
 *   DOCUMENTS list — icon colour is the health (green valid, gold
 *   expiring, red expired) with a key beneath, an edit button per row and an
 *   eye that opens the stored scan · gold Edit Details footer
 */
/**
 * The spec grid, from the record rather than from the mock.
 *
 * Every value here was a literal — "14 Ft Truck", "7 Ton", "Tata Motors" —
 * so every lorry in the fleet opened onto the same six specifications no
 * matter which row was tapped.
 */
function specsOf(vehicle: AdminVehicle | null): Array<{ label: string; value: string }> {
  if (!vehicle) {
    return [];
  }
  return [
    { label: 'TYPE', value: String(vehicle.type ?? '—') },
    { label: 'CAPACITY', value: String(vehicle.capacity ?? '—') },
    { label: 'MAKE', value: String(vehicle.make ?? '—') },
    { label: 'MODEL', value: String(vehicle.model ?? '—') },
    { label: 'YEAR', value: vehicle.year ? String(vehicle.year) : '—' },
    {
      label: 'STATUS',
      // The mock said "FUEL · Diesel", which the fleet does not record. Status
      // is what the record actually carries and what an operator needs here.
      value: String(vehicle.status ?? '—').replace('_', ' '),
    },
  ];
}


type DocRow = {
  id: string;
  name: string;
  meta: string;
  metaTone: 'muted' | 'danger';
  icon: IconName;
  bg: string;
  color: string;
  /** Whether a scan is stored, as opposed to only an expiry being recorded. */
  hasFile: boolean;
};

/**
 * How a document's health reads on the card.
 *
 * The health used to be spelled out in a pill beside each row — VALID,
 * EXPIRING, EXPIRED — which spent the widest part of the row repeating what a
 * colour says at a glance, and left no room for an action. It is carried by
 * the icon's colour now, with a key under the list, and the freed space holds
 * the edit button.
 *
 * `EXPIRING` is kept as its own tone rather than folded into one of the other
 * two: a paper that is still valid but runs out this month is exactly the one
 * an office wants to see before it becomes a lorry standing at a checkpoint.
 */
const DOC_SKIN: Record<
  string,
  {
    tone: string;
    tint: string;
    metaTone: 'muted' | 'danger';
  }
> = {
  VALID: {
    tone: palette.green,
    tint: 'rgba(22,163,74,0.12)',
    metaTone: 'muted',
  },
  EXPIRING: { tone: palette.gold, tint: palette.goldTint, metaTone: 'muted' },
  EXPIRED: { tone: palette.red, tint: palette.redTint, metaTone: 'danger' },
};

/** The papers a truck carries, named as the upload tiles name them. */
const DOC_LABEL: Record<string, { name: string; icon: IconName }> = {
  RC: { name: 'RC Book', icon: 'file-text' },
  INS: { name: 'Insurance', icon: 'shield-check' },
  FIT: { name: 'Fitness Certificate', icon: 'badge-check' },
  PUC: { name: 'PUC Certificate', icon: 'leaf' },
};

function docsOf(vehicle: AdminVehicle | null): DocRow[] {
  const documents = Array.isArray(vehicle?.documents)
    ? (vehicle.documents as Array<{
        id?: string;
        kind?: string;
        health?: string;
        expiresAt?: string | null;
        /* Null until the office files the scan itself. */
        fileUrl?: string | null;
      }>)
    : [];

  return documents.map(doc => {
    const kind = String(doc.kind ?? '').toUpperCase();
    const health = String(doc.health ?? '').toUpperCase();
    const skin = DOC_SKIN[health] ?? DOC_SKIN.EXPIRING;
    const named = DOC_LABEL[kind] ?? { name: kind || 'Document', icon: 'file-text' as IconName };

    const expires = doc.expiresAt ? new Date(doc.expiresAt) : null;
    const readable =
      expires && !Number.isNaN(expires.getTime())
        ? expires.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : null;

    return {
      id: String(doc.id ?? kind),
      name: named.name,
      // A paper with no expiry on file says so, rather than showing a blank.
      meta: readable ? `Valid till ${readable}` : 'Not uploaded yet',
      metaTone: skin.metaTone,
      icon: named.icon,
      // The colour *is* the health now — see the key under the list.
      bg: skin.tint,
      color: skin.tone,
      hasFile: Boolean(doc.fileUrl),
    };
  });
}

export const VehicleDetailsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'VehicleDetails'>>();
  const { vehicleId } = route.params;

  const { data, loading, error, refetch } = useApi(
    () => vehicleService.get(vehicleId),
    [vehicleId],
  );

  /*
   * The trip this lorry is on, if any.
   *
   * `GET /vehicles/:id` returns the truck and its papers but not its trip, so
   * the running trips are read separately and matched on `vehicleId`. The card
   * used to be a fixed `#TR-2026-8836` bound to no vehicle at all.
   */
  const live = useApi(() => tripService.live(), []);
  const trip = useMemo(
    () => (live.data ?? []).find(t => t.vehicleId === vehicleId) ?? null,
    [live.data, vehicleId],
  );

  const specs = useMemo(() => specsOf(data), [data]);
  const docs = useMemo(() => docsOf(data), [data]);

  const driver = (data?.driver ?? null) as {
    user?: { name?: string; mobile?: string };
  } | null;
  const registration = String(data?.registration ?? '');

  const callDriver = useCallback(() => {
    const mobile = driver?.user?.mobile;
    if (!mobile) {
      return;
    }
    Linking.openURL(`tel:${mobile}`).catch(() => undefined);
  }, [driver]);

  const openTrip = useCallback(() => {
    if (trip) {
      navigation.navigate('TripDetails', { tripId: String(trip.tripId) });
    }
  }, [navigation, trip]);

  /** Editing reuses the Add Vehicle form — same fields, prefilled upstream. */
  const editVehicle = useCallback(
    () => navigation.navigate('AddVehicle'),
    [navigation],
  );

  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  /** Adding a new scan is still a separate action from reading one. */
  const uploadDocument = useCallback(
    () =>
      navigation.navigate('UploadDocument', {
        ownerId: vehicleId,
        ownerLabel: registration,
      }),
    [navigation, registration, vehicleId],
  );

  /**
   * Opens one of the truck's papers.
   *
   * The eye navigated to the *upload* screen, so the one thing an operator
   * could not do from a list of paperwork was read it. It fetches a signed
   * link now — `/uploads/*` is guarded and the system viewer sends no bearer
   * token — and hands that to the OS.
   */
  const viewDocument = useCallback(
    async (id: string, name: string, hasFile: boolean) => {
      /*
       * Nothing filed yet is an answer, not a dead button.
       *
       * The office reaches for the eye to check a paper before letting a lorry
       * out. "There is no scan on file" is precisely what they need to hear,
       * and the useful next step is offered in the same breath.
       */
      if (!hasFile) {
        Alert.alert(
          name,
          'No scan has been filed against this document yet.',
          [
            { text: 'Close', style: 'cancel' },
            { text: 'Upload one', onPress: uploadDocument },
          ],
        );
        return;
      }

      setOpeningDoc(id);
      try {
        await openExternalUrl(await vehicleService.documentUrl(id));
      } catch (failure) {
        Alert.alert(
          'Could not open it',
          failure instanceof Error
            ? failure.message
            : 'That document is not available.',
        );
      } finally {
        setOpeningDoc(null);
      }
    },
    [uploadDocument],
  );


  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Vehicle Details"
        subtitle={registration}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        <ListState
          loading={loading}
          error={error}
          empty={!data}
          what="this vehicle"
          onRetry={refetch}
        />

        {data ? (
          <>

        {/* Hero */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={130}
            color={palette.gold}
            opacity={0.32}
            top={-30}
            right={-30}
          />

          <View style={styles.heroBody}>
            <View style={styles.heroRow}>
              <View style={styles.heroTile}>
                <Icon name="truck" size={22} color={palette.gold} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroKicker}>REG NUMBER</Text>
                <Text style={styles.heroReg}>AP 31 XX 1234</Text>
                <Text style={styles.heroModel}>Tata LPT 1109 · 14 Ft Truck</Text>
              </View>
            </View>

            <View style={styles.heroChips}>
              <View style={styles.heroChipGold}>
                <BlinkDot color={palette.gold} size={5} />
                <Text style={styles.heroChipGoldText}>IN TRIP</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>INSURED</Text>
              </View>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>FIT OK</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Assigned driver */}
        <Text style={styles.section}>ASSIGNED DRIVER</Text>
        <Card padding={11} style={styles.driverCard}>
          <View>
            <LinearGradient
              colors={gradients.navyHero as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.driverAvatar}
            >
              <Text style={styles.driverInitials}>RK</Text>
            </LinearGradient>
            <View style={styles.presence} />
          </View>

          <View style={styles.driverBody}>
            <Text style={styles.driverName}>Ramesh Kumar</Text>
            <View style={styles.driverMeta}>
              <Icon name="check-circle-2" size={12} color={palette.gold} />
              <Text style={styles.driverTrips}>240 trips</Text>
              <Text style={styles.driverStats}>· 98% on-time · 4y</Text>
            </View>
          </View>

          <Pressable
            onPress={callDriver}
            accessibilityRole="button"
            accessibilityLabel="Call Ramesh Kumar"
            style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
          >
            <Icon name="phone" size={14} color={palette.navy} />
          </Pressable>
        </Card>

        {/* Current trip — only when this lorry is actually on one. */}
        {trip ? (
          <>
            <Text style={[styles.section, styles.sectionGap]}>CURRENT TRIP</Text>
            <Card
              padding={11}
              onPress={openTrip}
              accessibilityLabel="Open current trip"
            >
              <View style={styles.tripHead}>
                <Text style={styles.tripRef}>#{String(trip.reference ?? '')}</Text>
                <View style={styles.pillNavy}>
                  <BlinkDot color={palette.gold} size={4} />
                  <Text style={styles.pillNavyText}>
                    {String(trip.status ?? '').replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/*
                The live board sends the leg already joined as `route`
                ("Vizag → Hyderabad"); it has no `booking` object, so reading
                `trip.booking.pickupPlace` rendered an em dash at both ends on
                every vehicle. Split back into the two the row draws.
              */}
              <RouteView
                pickup={(trip.route ?? '').split('→')[0]?.trim() || '—'}
                drop={(trip.route ?? '').split('→')[1]?.trim() || '—'}
                pickupLabel="Pickup"
                dropLabel="Drop"
                style={styles.route}
              />

              {Number(trip.distanceKm ?? 0) > 0 ? (
                <>
                  <View style={styles.progressHead}>
                    <Text style={styles.progressText}>
                      {Number(trip.coveredKm ?? 0)} / {Number(trip.distanceKm)} KM
                    </Text>
                    <Text style={styles.progressPct}>
                      {Math.min(
                        100,
                        Math.round(
                          (Number(trip.coveredKm ?? 0) /
                            Number(trip.distanceKm)) *
                            100,
                        ),
                      )}
                      %
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <LinearGradient
                      colors={[palette.gold, palette.red]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.fill,
                        {
                          width: `${Math.min(
                            100,
                            Math.round(
                              (Number(trip.coveredKm ?? 0) /
                                Number(trip.distanceKm)) *
                                100,
                            ),
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {/* Specs */}
        <Text style={[styles.section, styles.sectionGap]}>SPECIFICATIONS</Text>
        <Card padding={12}>
          <View style={styles.specGrid}>
            {specs.map((spec: { label: string; value: string }) => (
              <View key={spec.label} style={styles.specCell}>
                <Text style={styles.specLabel}>{spec.label}</Text>
                <Text style={styles.specValue}>{spec.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Documents */}
        <Text style={[styles.section, styles.sectionGap]}>DOCUMENTS</Text>
        <Card padding={0} clip marginBottom={0}>
          {docs.map((doc: DocRow, index: number) => (
            <View
              key={doc.id}
              style={[styles.docRow, index < docs.length - 1 && styles.docDivider]}
            >
              <IconWell
                icon={doc.icon}
                size={26}
                iconSize={14}
                backgroundColor={doc.bg}
                color={doc.color}
                borderRadius={radius.md}
              />
              <View style={styles.docBody}>
                <Text style={styles.docName}>{doc.name}</Text>
                <Text
                  style={
                    doc.metaTone === 'danger' ? styles.docMetaRed : styles.docMeta
                  }
                >
                  {doc.meta}
                </Text>
              </View>

              {/*
                Edit, where the status pill used to be.

                The pill only ever restated the icon's colour. This is the
                action that was missing: replacing a paper that has expired, or
                filing one for the first time, without leaving the vehicle.
              */}
              <Pressable
                onPress={uploadDocument}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${doc.name}`}
                style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
              >
                <Icon name="edit-3" size={14} color={palette.navy} />
              </Pressable>

              {/*
                Always the eye — this is the button for reading the document,
                and it stays the same control whether or not one has been
                filed yet. Adding a scan is the edit button beside it.

                It is never inert: with nothing stored, pressing says so and
                offers to file one, rather than opening a request that can only
                404 or — worse — doing nothing at all.
              */}
              <Pressable
                onPress={() => viewDocument(doc.id, doc.name, doc.hasFile)}
                disabled={openingDoc !== null}
                accessibilityRole="button"
                accessibilityLabel={`View ${doc.name}`}
                accessibilityState={{ busy: openingDoc === doc.id }}
                style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
              >
                {openingDoc === doc.id ? (
                  <ActivityIndicator size="small" color={palette.navy} />
                ) : (
                  <Icon
                    name="eye"
                    size={14}
                    color={doc.hasFile ? palette.navy : palette.slate400}
                  />
                )}
              </Pressable>
            </View>
          ))}
        </Card>

        {/*
          The key to the icon colours.
          
          Sits under the list rather than beside each row, which is the whole
          point of moving the status onto the icon: said once, not repeated on
          every line. `EXPIRING` is included because it is a real state in the
          data and the one worth acting on before it becomes the red one.
        */}
        <View style={styles.legend}>
          {[
            { tone: palette.green, label: 'Valid' },
            { tone: palette.gold, label: 'Expiring soon' },
            { tone: palette.red, label: 'Expired' },
          ].map(entry => (
            <View key={entry.label} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: entry.tone }]}
              />
              <Text style={styles.legendText}>{entry.label}</Text>
            </View>
          ))}
        </View>
          </>
        ) : null}
      </Content>

      <Footer>
        <Button
          label="Edit Details"
          variant="gold"
          icon="edit-3"
          padding={12}
          fontSize={12}
          onPress={editVehicle}
        />
      </Footer>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xxl,
    padding: s(14),
    marginBottom: s(12),
    overflow: 'hidden',
  },
  heroBody: { position: 'relative' },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    marginBottom: s(12),
  },
  heroTile: {
    width: s(52),
    height: s(52),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroKicker: font(8, '800', { color: palette.gold, letterSpacing: 1.5 }),
  heroReg: font(17, '800', { color: palette.white, letterSpacing: 1 }),
  heroModel: {
    ...font(9, '700', { color: palette.white }),
    opacity: 0.85,
    marginTop: s(1),
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: s(5) },
  heroChipGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: radius.lg,
  },
  heroChipGoldText: font(8, '800', { color: palette.gold, letterSpacing: 0.5 }),
  heroChip: {
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: alpha.white10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.white15,
    borderRadius: radius.lg,
  },
  heroChipText: font(8, '800', { color: palette.white }),

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  driverCard: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  driverAvatar: {
    width: s(38),
    height: s(38),
    borderRadius: radius.full,
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
  driverBody: { flex: 1 },
  driverName: font(11, '800', { color: palette.navy }),
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(1),
  },
  driverTrips: font(9, '800', { color: palette.navy }),
  driverStats: font(9, '400', { color: palette.slate500 }),
  callBtn: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tripHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(6),
  },
  tripRef: font(10, '800', { color: palette.red }),
  pillNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.navyTint,
    borderRadius: radius.sm,
  },
  pillNavyText: font(8, '800', { color: palette.navy }),
  route: { marginBottom: s(6) },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: s(3),
  },
  progressText: font(8, '700', { color: palette.slate500 }),
  progressPct: font(8, '700', { color: palette.gold }),
  track: {
    height: s(4),
    backgroundColor: palette.border,
    borderRadius: radius.xxs,
    overflow: 'hidden',
  },
  fill: { height: '100%', width: '21%', borderRadius: radius.xxs },

  specGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: s(12), columnGap: s(10) },
  specCell: { width: '47%' },
  specLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  specValue: {
    ...font(11, '800', { color: palette.navy }),
    marginTop: s(2),
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(11),
    paddingHorizontal: s(12),
  },
  docDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  docBody: { flex: 1 },
  docName: font(11, '800', { color: palette.navy }),
  docMeta: font(9, '400', { color: palette.slate500 }),
  docMetaRed: font(9, '800', { color: palette.red }),
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: s(14),
    marginTop: s(9),
    marginBottom: s(2),
    paddingHorizontal: s(2),
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: s(5) },
  legendDot: { width: s(7), height: s(7), borderRadius: radius.full },
  legendText: font(9, '600', { color: palette.slate500 }),
  eye: {
    width: s(28),
    height: s(28),
    backgroundColor: palette.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: { opacity: 0.75 },
});
