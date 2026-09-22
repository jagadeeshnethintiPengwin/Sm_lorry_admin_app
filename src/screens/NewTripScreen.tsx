import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  CustomerPicker,
  DateField,
  Footer,
  Input,
  PlaceInput,
  Screen,
  Select,
  customerCompany,
  customerMobile,
  customerPerson,
  customerVerified,
  prettyMobile,
} from '@components/index';
import { useApi } from '@hooks/useApi';
import { ApiError } from '@services/api.client';
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
  const route = useRoute<RouteProp<RootStackParamList, 'NewTrip'>>();
  // A driver (or vehicle) to dispatch, passed from their profile's "Assign New
  // Trip". Pre-selected once its roster has loaded, so the office only fills in
  // the load and the other half of the pair.
  const presetDriverId = route.params?.driverId;
  const presetVehicleId = route.params?.vehicleId;

  const vehiclesApi = useApi(() => vehicleService.available(), []);
  const driversApi = useApi(() => driverService.available(), []);
  const typesApi = useApi(() => vehicleService.types(), []);

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
  /*
   * Which field of the new-customer form is being typed into, so only that one
   * offers "already on file?" matches. Both fields search the same roster, and
   * two lists open at once under one card reads as a mess.
   */
  const [dupField, setDupField] = useState<'company' | 'contactName' | null>(
    null,
  );

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

  /*
   * Pre-select the driver/vehicle handed in, once their roster has arrived and
   * only if they are actually free to take a trip — a preset that is not in the
   * available list is dropped rather than shown as a blank selection. Runs once.
   */
  const presetSeeded = useRef(false);
  useEffect(() => {
    if (presetSeeded.current) {
      return;
    }
    const driverReady = !presetDriverId || driverOptions.length > 0;
    const vehicleReady = !presetVehicleId || vehicleOptions.length > 0;
    if (!driverReady || !vehicleReady) {
      return;
    }
    presetSeeded.current = true;
    if (presetDriverId && driverOptions.some(o => o.value === presetDriverId)) {
      setDriverId(presetDriverId);
    }
    if (
      presetVehicleId &&
      vehicleOptions.some(o => o.value === presetVehicleId)
    ) {
      setVehicleId(presetVehicleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, vehicles]);

  const willAssign = Boolean(vehicleId && driverId);

  /**
   * A customer chosen from any of the suggestion lists on this card.
   *
   * The booking rides on their existing account — that is the whole point of
   * finding them rather than typing them in again — so the record is selected
   * and the card collapses to name it. Whatever was half-typed into the
   * new-customer form is left exactly as it was: filling it from the account
   * just chosen would leave a form that creates a duplicate of that very
   * account if anyone reopened it.
   */
  const chooseCustomer = useCallback((customer: AdminCustomer) => {
    setSelected(customer);
    setCustMode('existing');
    setCustQuery('');
    setDupField(null);
  }, []);

  /*
   * "Other" — open the new-customer form carrying whatever was typed into the
   * search box, so nobody types the same name twice. Digits are a phone number
   * and anything else is the company/name, which is how the office searches.
   */
  const startNewCustomer = useCallback((typed: string) => {
    const text = typed.trim();
    const digits = text.replace(/\D/g, '');
    const isNumber = digits.length >= 6 && /^[\d\s+()-]+$/.test(text);
    setNc(prev => ({
      ...prev,
      ...(isNumber
        ? { mobile: digits.slice(-10) }
        : text
          ? { company: text }
          : {}),
    }));
    setCustMode('new');
    setDupField(null);
  }, []);

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
        try {
          const created = await customerService.create({
            company: nc.company.trim(),
            contactName: nc.contactName.trim(),
            mobile: nc.mobile.trim(),
            ...(nc.email.trim() ? { email: nc.email.trim() } : {}),
            ...(nc.state.trim() ? { state: nc.state.trim() } : {}),
          });
          customerId = created.id;
        } catch (e) {
          /*
           * One number is one account, so the API refuses a second — which is
           * exactly the case the suggestions under the name fields exist to
           * catch, reached here because the office typed the details straight
           * out. Hand them back to the search with that number already in the
           * box rather than making them find it themselves.
           */
          setBusy(false);
          const message =
            e instanceof Error ? e.message : 'Please try again.';
          const clash = e instanceof ApiError && e.status === 409;
          Alert.alert(
            clash ? 'Customer already on file' : 'Could not add the customer',
            message,
            clash
              ? [
                  {
                    text: 'Find them',
                    onPress: () => {
                      setCustMode('existing');
                      setSelected(null);
                      setCustQuery(nc.mobile.trim() || nc.company.trim());
                      setDupField(null);
                    },
                  },
                  { text: 'Back', style: 'cancel' },
                ]
              : undefined,
          );
          return;
        }
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
              <>
                {/*
                  * Named exactly as the row that was tapped named it — company
                  * first, the person and their number underneath — so picking
                  * one and seeing it confirmed is plainly the same account.
                  */}
                <View style={styles.selectedRow}>
                  <View style={styles.selAvatar}>
                    <Text style={styles.selInitials}>
                      {(customerCompany(selected) || customerPerson(selected))
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(word => word[0] ?? '')
                        .join('')
                        .toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.flexMin}>
                    <Text style={styles.selName} numberOfLines={2}>
                      {customerCompany(selected) ||
                        customerPerson(selected) ||
                        'Customer'}
                    </Text>
                    <Text style={styles.selMeta} numberOfLines={2}>
                      {[
                        customerCompany(selected) && customerPerson(selected)
                          ? customerPerson(selected)
                          : '',
                        prettyMobile(customerMobile(selected)),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
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
                {/*
                  * A trip cannot be raised against an account the office has
                  * not checked — `approve` refuses it — so say so here rather
                  * than after the whole form has been filled in.
                  */}
                {customerVerified(selected) ? null : (
                  <Text style={styles.warn}>
                    This account is not verified yet — verify it on the customer
                    record before a vehicle and driver can be assigned.
                  </Text>
                )}
              </>
            ) : (
              <CustomerPicker
                value={custQuery}
                onChangeText={setCustQuery}
                onSelect={chooseCustomer}
                onAddNew={startNewCustomer}
                placeholder="Search by name, company or phone…"
                autoCapitalize="words"
              />
            )
          ) : (
            <>
              <View style={styles.newHead}>
                <Text style={styles.newTitle}>New customer</Text>
                <Pressable
                  onPress={() => {
                    setCustMode('existing');
                    setDupField(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Search existing customers"
                >
                  <Text style={styles.link}>← Search existing</Text>
                </Pressable>
              </View>
              {/*
                * Both name fields still search the roster while they are typed
                * in: the office reaches for "Other" the moment a name is not
                * recognised, and an account entered twice splits a customer's
                * history across two records — and is refused outright by the
                * API when the mobile number collides. Picking a match here
                * drops straight back to that customer.
                */}
              <CustomerPicker
                label="Company / Name"
                required
                value={nc.company}
                onChangeText={v => {
                  setNc({ ...nc, company: v });
                  setDupField('company');
                }}
                onSelect={chooseCustomer}
                enabled={dupField === 'company'}
                quiet
                listTitle="ALREADY ON FILE?"
                placeholder="e.g. Sri Sai Traders"
                marginBottom={10}
              />
              <CustomerPicker
                label="Contact Person"
                required
                value={nc.contactName}
                onChangeText={v => {
                  setNc({ ...nc, contactName: v });
                  setDupField('contactName');
                }}
                onSelect={chooseCustomer}
                enabled={dupField === 'contactName'}
                quiet
                listTitle="ALREADY ON FILE?"
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
  selAvatar: {
    width: s(32),
    height: s(32),
    borderRadius: radius.full,
    backgroundColor: palette.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selInitials: font(10, '800', { color: palette.navy }),
  selName: font(12, '800', { color: palette.navy }),
  selMeta: { ...font(9, '400', { color: palette.slate500 }), marginTop: s(1) },
  warn: {
    ...font(9, '600', { color: palette.red, lineHeight: 1.4 }),
    marginTop: s(8),
  },

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
