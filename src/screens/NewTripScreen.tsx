import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  DateField,
  Footer,
  Input,
  PlaceInput,
  Screen,
  Select,
} from '@components/index';
import { useApi } from '@hooks/useApi';
import {
  bookingService,
  customerService,
  driverService,
  vehicleService,
  type AdminCustomer,
} from '@services/fleet.service';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NewTrip'>;

/** Unify "14 Feet Truck" (a booking's type) with "14 Ft Truck" (the fleet's). */
const norm = (v: string): string =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(feet|foot)\b/g, 'ft')
    .trim()
    .replace(/\s+/g, ' ');

const str = (v: unknown): string => (v == null ? '' : String(v));
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/**
 * NEW TRIP — the office raising a trip directly (a walk-in or a phone booking).
 *
 * A trip cannot exist without a booking, so this does the two-step flow in one
 * screen: it creates the booking, then — when a vehicle and driver are chosen —
 * approves it, which raises the trip and puts the lorry on the road. Leaving
 * vehicle/driver blank saves a pending booking to assign later. A customer not
 * yet on file is added inline through "Other".
 */
export const NewTripScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();

  const customersApi = useApi(() => customerService.list({ limit: 200 }), []);
  const vehiclesApi = useApi(() => vehicleService.available(), []);
  const driversApi = useApi(() => driverService.available(), []);
  const typesApi = useApi(() => vehicleService.types(), []);

  const customers = customersApi.data ?? [];
  const vehicles = vehiclesApi.data ?? [];
  const drivers = driversApi.data ?? [];
  // Stable reference so the type-options memo below is not invalidated every
  // render by a fresh `?? []` fallback.
  const types = useMemo(() => typesApi.data ?? [], [typesApi.data]);

  const [pickupPlace, setPickupPlace] = useState('');
  const [dropPlace, setDropPlace] = useState('');
  /* The address + coordinates behind a chosen suggestion, when one was picked. */
  const [pickupGeo, setPickupGeo] = useState<{
    address: string;
    lat?: number;
    lng?: number;
  }>({ address: '' });
  const [dropGeo, setDropGeo] = useState<{
    address: string;
    lat?: number;
    lng?: number;
  }>({ address: '' });
  const [vehicleType, setVehicleType] = useState('');
  const [material, setMaterial] = useState('General cargo');
  const [weight, setWeight] = useState('5');
  const [pickupAt, setPickupAt] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [showAllTypes, setShowAllTypes] = useState(false);

  const [custMode, setCustMode] = useState<'existing' | 'new'>('existing');
  const [custQuery, setCustQuery] = useState('');
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [nc, setNc] = useState({
    company: '',
    contactName: '',
    mobile: '',
    email: '',
    state: '',
  });

  const [busy, setBusy] = useState(false);

  const effectiveType = vehicleType || str(rec(types[0]).name);

  const typeOptions = useMemo(() => {
    const names = types.map(t => str(rec(t).name)).filter(Boolean);
    const opts = names.map(n => ({ label: n, value: n }));
    if (effectiveType && !names.includes(effectiveType)) {
      opts.unshift({ label: effectiveType, value: effectiveType });
    }
    return opts;
  }, [types, effectiveType]);

  const requestedType = effectiveType.trim();
  const filtering = Boolean(requestedType) && !showAllTypes;
  const eligibleVehicles = filtering
    ? vehicles.filter(v => norm(str(rec(v).type)) === norm(requestedType))
    : vehicles;

  const vehicleOptions = eligibleVehicles.map(v => ({
    label: `${str(rec(v).registrationNumber || rec(v).registration)} (${str(
      rec(v).type,
    )})`,
    value: str(rec(v).id),
  }));
  const driverOptions = drivers.map(d => ({
    label: str(rec(rec(d).user).name || rec(d).name),
    value: str(rec(d).id),
  }));

  const willAssign = Boolean(vehicleId && driverId);

  const query = custQuery.trim().toLowerCase();
  const matches = (
    query
      ? customers.filter(c =>
          `${str(rec(c).company)} ${str(rec(c).contactName)} ${str(
            rec(rec(c).user).mobile,
          )}`
            .toLowerCase()
            .includes(query),
        )
      : customers
  ).slice(0, 6);

  const submit = useCallback(async () => {
    if (custMode === 'existing' && !selected) {
      Alert.alert(
        'Customer required',
        'Search and pick a customer, or add a new one with “Other”.',
      );
      return;
    }
    if (
      custMode === 'new' &&
      (!nc.company.trim() || !nc.contactName.trim() || !nc.mobile.trim())
    ) {
      Alert.alert(
        'New customer',
        'Company / name, a contact person and a mobile number are required.',
      );
      return;
    }
    if (!pickupPlace.trim() || !dropPlace.trim() || !pickupAt) {
      Alert.alert(
        'Missing details',
        'Pickup point, drop point and pickup date are required.',
      );
      return;
    }
    if (!effectiveType) {
      Alert.alert('Vehicle type', 'Pick a vehicle type.');
      return;
    }
    if (!(Number(weight) > 0)) {
      Alert.alert('Weight', 'Enter the load weight in tonnes.');
      return;
    }
    setBusy(true);
    try {
      let customerId = selected?.id ?? '';
      if (custMode === 'new') {
        const created = await customerService.create({
          company: nc.company.trim(),
          contactName: nc.contactName.trim(),
          mobile: nc.mobile.trim(),
          ...(nc.email.trim() ? { email: nc.email.trim() } : {}),
          ...(nc.state.trim() ? { state: nc.state.trim() } : {}),
        });
        customerId = created.id;
      }

      const booking = await bookingService.create({
        customerId,
        pickupPlace: pickupPlace.trim(),
        dropPlace: dropPlace.trim(),
        vehicleType: effectiveType,
        material: material.trim() || 'General cargo',
        weightTons: Number(weight),
        pickupAt,
        // The address + coordinates ride along only when a suggestion was
        // chosen; a hand-typed place carries none of them.
        ...(pickupGeo.address ? { pickupAddress: pickupGeo.address } : {}),
        ...(pickupGeo.lat != null && pickupGeo.lng != null
          ? { pickupLat: pickupGeo.lat, pickupLng: pickupGeo.lng }
          : {}),
        ...(dropGeo.address ? { dropAddress: dropGeo.address } : {}),
        ...(dropGeo.lat != null && dropGeo.lng != null
          ? { dropLat: dropGeo.lat, dropLng: dropGeo.lng }
          : {}),
      });
      const bookingId = str(booking.id);

      // No lorry/driver chosen — leave it pending and open the review screen.
      if (!willAssign) {
        navigation.replace('BookingReview', { bookingId });
        return;
      }

      try {
        const approved = (await bookingService.approve(bookingId, {
          vehicleId,
          driverId,
        })) as { trip?: { id?: string } };
        const tripId = str(approved.trip?.id);
        if (tripId) {
          navigation.replace('TripDetails', { tripId });
        } else {
          navigation.replace('Trips');
        }
      } catch (e) {
        // The booking is saved; only the assignment failed. Keep the work and
        // offer to finish it on the review screen.
        setBusy(false);
        Alert.alert(
          'Booking created',
          `Booking #${str(booking.reference)} was saved, but assigning the vehicle and driver failed: ${
            e instanceof Error ? e.message : 'please try again'
          }.`,
          [
            {
              text: 'Assign now',
              onPress: () =>
                navigation.replace('BookingReview', { bookingId }),
            },
            { text: 'Later', style: 'cancel' },
          ],
        );
      }
    } catch (e) {
      setBusy(false);
      Alert.alert(
        'Could not create the trip',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  }, [
    custMode,
    selected,
    nc,
    pickupPlace,
    dropPlace,
    pickupGeo,
    dropGeo,
    pickupAt,
    effectiveType,
    weight,
    material,
    willAssign,
    vehicleId,
    driverId,
    navigation,
  ]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="New Trip"
        subtitle="Raise a trip from the office"
        showBack
        backIcon="x"
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* CUSTOMER */}
        <Text style={styles.section}>
          CUSTOMER <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          {custMode === 'existing' ? (
            selected ? (
              <View style={styles.selectedRow}>
                <View style={styles.flexMin}>
                  <Text style={styles.selName} numberOfLines={1}>
                    {str(rec(selected).company) || 'Customer'}
                  </Text>
                  <Text style={styles.selMeta} numberOfLines={1}>
                    {str(rec(selected).contactName)}
                    {str(rec(rec(selected).user).mobile)
                      ? ` · ${str(rec(rec(selected).user).mobile)}`
                      : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelected(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Change customer"
                >
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Input
                  value={custQuery}
                  onChangeText={setCustQuery}
                  placeholder="Search by name, company or phone…"
                  autoCapitalize="none"
                  marginBottom={8}
                />
                <View style={styles.matchList}>
                  {matches.map(c => (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelected(c)}
                      style={styles.matchRow}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${str(rec(c).company)}`}
                    >
                      <Text style={styles.matchName} numberOfLines={1}>
                        {str(rec(c).company) || 'Customer'}
                      </Text>
                      <Text style={styles.matchMeta} numberOfLines={1}>
                        {str(rec(c).contactName)}
                        {str(rec(rec(c).user).mobile)
                          ? ` · ${str(rec(rec(c).user).mobile)}`
                          : ''}
                      </Text>
                    </Pressable>
                  ))}
                  {matches.length === 0 ? (
                    <Text style={styles.matchEmpty}>
                      {customersApi.loading
                        ? 'Loading customers…'
                        : query
                          ? `No customer matches “${custQuery}”.`
                          : 'No customers yet.'}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => setCustMode('new')}
                    style={styles.otherRow}
                    accessibilityRole="button"
                    accessibilityLabel="Add a new customer"
                  >
                    <Text style={styles.otherText}>
                      + Other — add a new customer
                    </Text>
                  </Pressable>
                </View>
              </>
            )
          ) : (
            <>
              <View style={styles.newHead}>
                <Text style={styles.newTitle}>New customer</Text>
                <Pressable
                  onPress={() => setCustMode('existing')}
                  accessibilityRole="button"
                  accessibilityLabel="Search existing customers"
                >
                  <Text style={styles.link}>← Search existing</Text>
                </Pressable>
              </View>
              <Input
                label="Company / Name"
                required
                value={nc.company}
                onChangeText={v => setNc({ ...nc, company: v })}
                placeholder="e.g. Sri Sai Traders"
                marginBottom={10}
              />
              <Input
                label="Contact Person"
                required
                value={nc.contactName}
                onChangeText={v => setNc({ ...nc, contactName: v })}
                placeholder="Contact person name"
                marginBottom={10}
              />
              <Input
                label="Mobile"
                required
                value={nc.mobile}
                onChangeText={v => setNc({ ...nc, mobile: v })}
                placeholder="10-digit mobile"
                keyboardType="phone-pad"
                maxLength={10}
                marginBottom={10}
              />
              <View style={styles.row}>
                <View style={styles.col}>
                  <Input
                    label="Email"
                    labelNote="(optional)"
                    value={nc.email}
                    onChangeText={v => setNc({ ...nc, email: v })}
                    placeholder="name@company.in"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    marginBottom={0}
                  />
                </View>
                <View style={styles.col}>
                  <Input
                    label="State"
                    labelNote="(optional)"
                    value={nc.state}
                    onChangeText={v => setNc({ ...nc, state: v })}
                    placeholder="e.g. Telangana"
                    marginBottom={0}
                  />
                </View>
              </View>
            </>
          )}
        </Card>

        {/* ROUTE */}
        <Text style={[styles.section, styles.sectionGap]}>
          ROUTE <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <PlaceInput
            label="Pickup Point"
            required
            value={pickupPlace}
            onChangeText={place => {
              setPickupPlace(place);
              // Typing again breaks the tie to the chosen place.
              setPickupGeo({ address: '' });
            }}
            onSelect={detail =>
              setPickupGeo({
                address: detail.address,
                lat: detail.latitude,
                lng: detail.longitude,
              })
            }
            placeholder="Start typing — e.g. Kondapur"
            marginBottom={10}
          />
          {pickupGeo.address ? (
            <Text style={styles.geoHint} numberOfLines={1}>
              {pickupGeo.address}
            </Text>
          ) : null}
          <PlaceInput
            label="Drop Point"
            required
            value={dropPlace}
            onChangeText={place => {
              setDropPlace(place);
              setDropGeo({ address: '' });
            }}
            onSelect={detail =>
              setDropGeo({
                address: detail.address,
                lat: detail.latitude,
                lng: detail.longitude,
              })
            }
            placeholder="Start typing — e.g. Gachibowli"
            marginBottom={0}
          />
          {dropGeo.address ? (
            <Text style={styles.geoHint} numberOfLines={1}>
              {dropGeo.address}
            </Text>
          ) : null}
        </Card>

        {/* LOAD */}
        <Text style={[styles.section, styles.sectionGap]}>
          LOAD DETAILS <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Select
            label="Vehicle Type"
            options={typeOptions}
            value={effectiveType}
            onChange={v => {
              setVehicleType(v);
              setVehicleId('');
            }}
            placeholder="Select a vehicle type"
            marginBottom={10}
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <Input
                label="Weight (tonnes)"
                required
                value={weight}
                onChangeText={setWeight}
                placeholder="5"
                keyboardType="decimal-pad"
                marginBottom={0}
              />
            </View>
            <View style={styles.col}>
              <Input
                label="Material"
                value={material}
                onChangeText={setMaterial}
                placeholder="General cargo"
                marginBottom={0}
              />
            </View>
          </View>
        </Card>

        {/* SCHEDULE */}
        <Text style={[styles.section, styles.sectionGap]}>
          SCHEDULE <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <DateField
            label="Pickup Date"
            value={pickupAt}
            onChange={setPickupAt}
            placeholder="Select a date"
            minimumDate={new Date()}
          />
        </Card>

        {/* ASSIGN */}
        <Text style={[styles.section, styles.sectionGap]}>
          ASSIGN VEHICLE &amp; DRIVER
        </Text>
        <Card padding={12}>
          <Select
            label="Vehicle"
            options={vehicleOptions}
            value={vehicleId}
            onChange={setVehicleId}
            placeholder={
              eligibleVehicles.length === 0
                ? filtering
                  ? `No ${requestedType} free`
                  : 'No vehicle free'
                : 'Assign later'
            }
            marginBottom={filtering && vehicles.length > eligibleVehicles.length ? 6 : 10}
          />
          {vehicles.length > eligibleVehicles.length && requestedType ? (
            <Pressable
              onPress={() => setShowAllTypes(v => !v)}
              accessibilityRole="button"
              style={styles.showAll}
            >
              <Text style={styles.link}>
                {filtering ? 'Show all vehicle types' : `Only ${requestedType}`}
              </Text>
            </Pressable>
          ) : null}
          <Select
            label="Driver"
            options={driverOptions}
            value={driverId}
            onChange={setDriverId}
            placeholder={drivers.length === 0 ? 'No driver free' : 'Assign later'}
            marginBottom={0}
          />
          <Text style={styles.hint}>
            {willAssign
              ? 'Creating raises the trip now — the vehicle and driver go on the road and the distance is calculated from the route.'
              : 'Leave vehicle & driver blank to save a pending booking and assign it later.'}
          </Text>
        </Card>
      </Content>

      <Footer>
        <Button
          label={busy ? 'Creating…' : willAssign ? 'Create Trip' : 'Save as booking'}
          variant="gold"
          icon="check-circle-2"
          padding={12}
          fontSize={13}
          loading={busy}
          disabled={busy}
          onPress={submit}
        />
      </Footer>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },
  star: font(9, '800', { color: palette.red }),
  geoHint: {
    ...font(9, '500', { color: palette.slate500 }),
    marginTop: s(4),
    marginBottom: s(10),
  },

  row: { flexDirection: 'row', gap: s(8) },
  col: { flex: 1, minWidth: 0 },

  link: font(10, '800', { color: palette.red }),

  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  selName: font(12, '800', { color: palette.navy }),
  selMeta: { ...font(9, '400', { color: palette.slate500 }), marginTop: s(1) },

  matchList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gray200,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  matchRow: {
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gray200,
  },
  matchName: font(11, '800', { color: palette.navy }),
  matchMeta: { ...font(9, '400', { color: palette.slate500 }), marginTop: s(1) },
  matchEmpty: {
    ...font(10, '400', { color: palette.slate400 }),
    paddingVertical: s(10),
    paddingHorizontal: s(11),
  },
  otherRow: {
    paddingVertical: s(10),
    paddingHorizontal: s(11),
    backgroundColor: palette.surfaceAlt,
  },
  otherText: font(10, '800', { color: palette.red }),

  newHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(10),
  },
  newTitle: font(11, '800', { color: palette.navy }),

  showAll: { alignSelf: 'flex-start', marginBottom: s(10) },
  hint: {
    ...font(9, '400', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(10),
  },
});
