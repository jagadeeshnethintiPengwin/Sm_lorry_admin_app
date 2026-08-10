import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Footer,
  Icon,
  IconWell,
  ImageSourceSheet,
  Input,
  Screen,
  Select,
  Toggle,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import type { IconName } from '@components/common/Icon';
import { driverService, vehicleService } from '@services/fleet.service';
import type { AdminDriver } from '@services/fleet.service';
import {
  isClean,
  packRegistration,
  validateCapacity,
  validateRegistration,
  validateRequired,
  validateYear,
  type Errors,
} from '@utils/validation';

/**
 * Screen 8 — Add New Vehicle.
 *
 *   BASIC INFO card (registration, type, capacity + year, make, model) ·
 *   IDENTIFIERS card (chassis, engine) · UPLOAD DOCUMENTS 2×2 tiles where an
 *   uploaded slot turns gold with a check · Assign Driver Now switch row ·
 *   gold Add to Fleet footer
 */
/**
 * The values are the words the API stores, not slugs.
 *
 * `Vehicle.type` and `Vehicle.make` are free text that every fleet screen
 * renders directly, and the roster filters on `type` by exact match. Sending
 * `14ft` and `tata` — which is what these options used to carry — would have
 * written those into the fleet, so the vehicles list showed "14ft" and the
 * type filter matched nothing an operator could pick.
 */
const VEHICLE_TYPES = [
  { label: 'Mini Truck (up to 1 Ton)', value: 'Mini Truck' },
  { label: '14 Ft Truck (up to 7 Ton)', value: '14 Ft Truck' },
  { label: '17 Ft Truck (up to 9 Ton)', value: '17 Ft Truck' },
  { label: '19 Ft Truck (up to 12 Ton)', value: '19 Ft Truck' },
  { label: '22 Ft Trailer', value: '22 Ft Trailer' },
  { label: '32 Ft Trailer', value: '32 Ft Trailer' },
  { label: 'Container', value: 'Container' },
];

const MAKES = [
  { label: 'Tata Motors', value: 'Tata Motors' },
  { label: 'Ashok Leyland', value: 'Ashok Leyland' },
  { label: 'Eicher', value: 'Eicher' },
  { label: 'Bharat Benz', value: 'Bharat Benz' },
  { label: 'Mahindra', value: 'Mahindra' },
  { label: 'Volvo', value: 'Volvo' },
];

/** The fields the form validates, which is what `errors` is keyed by. */
type VehicleForm = {
  registration: string;
  type: string;
  capacity: string;
  year: string;
  make: string;
  model: string;
  driverId: string;
};

type DocSlot = {
  key: string;
  label: string;
  icon: IconName;
  bg: string;
  color: string;
};

const DOC_SLOTS: DocSlot[] = [
  {
    key: 'rc',
    label: 'RC Book',
    icon: 'file-text',
    bg: palette.navyTint,
    color: palette.navy,
  },
  {
    key: 'insurance',
    label: 'Insurance',
    icon: 'shield-check',
    bg: palette.goldTint,
    color: palette.gold,
  },
  {
    key: 'fitness',
    label: 'Fitness',
    icon: 'badge-check',
    bg: palette.redTint,
    color: palette.red,
  },
  {
    key: 'puc',
    label: 'PUC',
    icon: 'leaf',
    bg: palette.navyTint,
    color: palette.navy,
  },
];

export const AddVehicleScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [registration, setRegistration] = useState('');
  const [type, setType] = useState('');
  const [capacity, setCapacity] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('Tata Motors');
  const [model, setModel] = useState('');
  const [chassis, setChassis] = useState('');
  const [engine, setEngine] = useState('');
  const [assignNow, setAssignNow] = useState(false);
  const [driverId, setDriverId] = useState('');

  const [errors, setErrors] = useState<Errors<VehicleForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Drivers with no truck of their own, for the assign row.
   *
   * `Vehicle_driverId_key` is unique, so a driver already behind a wheel would
   * be refused by the API — offering them here would be offering a choice that
   * cannot be made.
   */
  const [freeDrivers, setFreeDrivers] = useState<AdminDriver[]>([]);

  useEffect(() => {
    if (!assignNow || freeDrivers.length > 0) {
      return;
    }
    let cancelled = false;
    driverService
      .available()
      .then(rows => {
        if (!cancelled) {
          setFreeDrivers(rows.filter(row => !row.vehicle));
        }
      })
      // A roster that will not load must not block registering the truck; the
      // driver can be assigned from vehicle details afterwards.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [assignNow, freeDrivers.length]);

  const driverOptions = freeDrivers.map(row => ({
    label:
      ((row.user as { name?: string } | undefined)?.name ?? 'Driver') +
      ((row.user as { mobile?: string } | undefined)?.mobile
        ? ` · ${(row.user as { mobile?: string }).mobile}`
        : ''),
    value: row.id,
  }));

  /**
   * Nothing is on file for a truck that does not exist yet.
   *
   * Insurance used to start as `insurance.pdf`, carried over from the HTML
   * mock, where it was there to show what a filled tile looks like. On a real
   * Add Vehicle form it meant every new lorry claimed to have insurance on
   * file before anyone had uploaded anything — the one document you would
   * least want to be wrong about.
   */
  const [uploads, setUploads] = useState<Record<string, string | null>>({
    rc: null,
    insurance: null,
    fitness: null,
    puc: null,
  });
  const [target, setTarget] = useState<string | null>(null);

  const closeSheet = useCallback(() => setTarget(null), []);

  /**
   * Registers the truck, then hands off to Upload Document.
   *
   * The screen used to do only the second half: it navigated to the upload
   * step and threw the whole form away, so "Add to Fleet" added nothing and
   * the vehicle never existed. Everything typed here is now written first, and
   * the handoff only happens once the API has confirmed it — the RC,
   * insurance, fitness and PUC still have to be filed against a real vehicle.
   */
  const addToFleet = useCallback(async () => {
    const found: Errors<VehicleForm> = {
      registration: validateRegistration(registration),
      type: validateRequired('vehicle type')(type),
      capacity: validateCapacity(capacity),
      year: validateYear(year),
      make: validateRequired('manufacturer')(make),
      model: validateRequired('model')(model),
      driverId:
        assignNow && !driverId ? 'Choose a driver, or turn this off' : undefined,
    };

    setErrors(found);
    setSubmitError(null);
    if (!isClean(found)) {
      return;
    }

    setSaving(true);
    try {
      const created = await vehicleService.create({
        registration: packRegistration(registration),
        type,
        // Stored as the words the fleet screens render, from the number typed.
        capacity: `${capacity.trim()} Ton`,
        make,
        model: model.trim(),
        year: Number(year),
        ...(assignNow && driverId ? { driverId } : {}),
      });

      navigation.replace('UploadDocument', {
        ownerLabel: (created.registration as string) ?? packRegistration(registration),
      });
    } catch (error) {
      // A duplicate plate or an already-assigned driver arrives here as the
      // sentence the API wrote for it, which is what the operator needs.
      setSubmitError(
        error instanceof Error ? error.message : 'Could not add the vehicle',
      );
    } finally {
      setSaving(false);
    }
  }, [
    assignNow,
    capacity,
    driverId,
    make,
    model,
    navigation,
    registration,
    type,
    year,
  ]);

  const applyUpload = useCallback(
    (name: string) => {
      setUploads(current =>
        target ? { ...current, [target]: name } : current,
      );
      setTarget(null);
    },
    [target],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Add New Vehicle"
        subtitle="Register truck to fleet"
        showBack
        backIcon="x"
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* BASIC INFO */}
        <Text style={styles.section}>
          BASIC INFO <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Registration Number"
            required
            value={registration}
            onChangeText={setRegistration}
            placeholder="e.g. AP 31 XX 1234"
            autoCapitalize="characters"
            marginBottom={10}
            inputStyle={styles.regInput}
            error={errors.registration}
          />

          <Select
            label="Vehicle Type"
            required
            options={VEHICLE_TYPES}
            value={type}
            onChange={setType}
            placeholder="Select vehicle type"
            marginBottom={10}
            error={errors.type}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Input
                label="Capacity (Ton)"
                required
                value={capacity}
                onChangeText={setCapacity}
                placeholder="7"
                keyboardType="decimal-pad"
                marginBottom={10}
                error={errors.capacity}
              />
            </View>
            <View style={styles.col}>
              <Input
                label="Year"
                required
                value={year}
                onChangeText={setYear}
                placeholder="2022"
                keyboardType="number-pad"
                maxLength={4}
                marginBottom={10}
                error={errors.year}
              />
            </View>
          </View>

          <Select
            label="Make / Manufacturer"
            required
            options={MAKES}
            value={make}
            onChange={setMake}
            marginBottom={10}
            error={errors.make}
          />

          <Input
            label="Model"
            required
            value={model}
            onChangeText={setModel}
            placeholder="e.g. LPT 1109"
            marginBottom={0}
            error={errors.model}
          />
        </Card>

        {/* IDENTIFIERS */}
        <Text style={[styles.section, styles.sectionGap]}>IDENTIFIERS</Text>
        <Card padding={12}>
          <Input
            label="Chassis Number"
            required
            value={chassis}
            onChangeText={setChassis}
            placeholder="17-character VIN"
            autoCapitalize="characters"
            maxLength={17}
            marginBottom={10}
            inputStyle={styles.idInput}
          />
          <Input
            label="Engine Number"
            value={engine}
            onChangeText={setEngine}
            placeholder="Engine serial"
            autoCapitalize="characters"
            marginBottom={0}
            inputStyle={styles.idInput}
          />
        </Card>

        {/* UPLOAD DOCUMENTS */}
        <Text style={[styles.section, styles.sectionGap]}>
          UPLOAD DOCUMENTS <Text style={styles.star}>*</Text>
        </Text>
        <View style={styles.slotGrid}>
          {DOC_SLOTS.map(slot => {
            const uploaded = uploads[slot.key];
            return (
              <Pressable
                key={slot.key}
                onPress={() => setTarget(slot.key)}
                accessibilityRole="button"
                accessibilityLabel={
                  uploaded
                    ? `${slot.label}, ${uploaded} uploaded`
                    : `Upload ${slot.label}`
                }
                style={({ pressed }) => [
                  styles.slot,
                  uploaded ? styles.slotDone : styles.slotEmpty,
                  pressed && styles.pressed,
                ]}
              >
                <IconWell
                  icon={slot.icon}
                  size={26}
                  iconSize={14}
                  backgroundColor={uploaded ? palette.white : slot.bg}
                  color={uploaded ? palette.gold : slot.color}
                  borderRadius={radius.md}
                />
                <Text style={uploaded ? styles.slotLabelDone : styles.slotLabel}>
                  {slot.label}
                </Text>
                <Text style={uploaded ? styles.slotFile : styles.slotHint}>
                  {uploaded ?? 'Tap to upload'}
                </Text>

                <View style={styles.slotBadge}>
                  <Icon
                    name={uploaded ? 'check' : 'upload-cloud'}
                    size={12}
                    color={uploaded ? palette.gold : palette.slate400}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Assign driver toggle */}
        <Card padding={11} marginBottom={0} style={styles.assignRow}>
          <IconWell
            icon="user-cog"
            size={38}
            iconSize={20}
            backgroundColor={palette.goldTint}
            color={palette.gold}
            borderRadius={radius.lg}
          />
          <View style={styles.assignBody}>
            <Text style={styles.assignTitle}>Assign Driver Now</Text>
            <Text style={styles.assignMeta}>
              You can assign later from vehicle details
            </Text>
          </View>
          <Toggle
            value={assignNow}
            onValueChange={setAssignNow}
            accessibilityLabel="Assign driver now"
          />
        </Card>

        {assignNow ? (
          <Card padding={12} marginBottom={0} style={styles.assignPicker}>
            <Select
              label="Driver"
              required
              options={driverOptions}
              value={driverId}
              onChange={setDriverId}
              placeholder={
                driverOptions.length > 0
                  ? 'Select a driver'
                  : 'No unassigned drivers available'
              }
              marginBottom={0}
              error={errors.driverId}
            />
          </Card>
        ) : null}

        {submitError ? (
          <Card padding={11} marginBottom={0} style={styles.errorCard}>
            <Icon name="alert-circle" size={14} color={palette.red} />
            <Text style={styles.errorText}>{submitError}</Text>
          </Card>
        ) : null}
      </Content>

      <Footer>
        <Button
          label={saving ? 'Adding…' : 'Add to Fleet'}
          variant="gold"
          icon="check-circle-2"
          padding={12}
          fontSize={13}
          loading={saving}
          onPress={addToFleet}
        />
      </Footer>

      <ImageSourceSheet
        visible={target !== null}
        onClose={closeSheet}
        onCamera={() => applyUpload('photo.jpg')}
        onGallery={() => applyUpload('scan.jpg')}
        onDocument={() => applyUpload('document.pdf')}
        title="Upload Document"
        subtitle="JPG · PNG · PDF · Max 10 MB"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },
  star: font(9, '800', { color: palette.red }),

  row: { flexDirection: 'row', gap: s(8) },
  col: { flex: 1, minWidth: 0 },
  regInput: { letterSpacing: s(1), ...font(12, '800', { color: palette.navy }) },
  idInput: { letterSpacing: s(0.5) },

  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(6),
    marginBottom: s(10),
  },
  slot: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: s(12),
    paddingHorizontal: s(8),
    borderRadius: radius.lg,
    borderWidth: s(1.5),
    gap: s(4),
  },
  slotEmpty: { backgroundColor: palette.white, borderColor: palette.gray200 },
  slotDone: { backgroundColor: palette.goldTint, borderColor: palette.gold },
  slotLabel: font(10, '800', { color: palette.navy }),
  slotLabelDone: font(10, '800', { color: palette.goldText }),
  slotHint: font(8, '800', { color: palette.gold }),
  slotFile: font(8, '800', { color: palette.goldText }),
  slotBadge: { position: 'absolute', top: s(8), right: s(8) },

  assignRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  assignPicker: { marginTop: s(8) },
  errorCard: {
    marginTop: s(10),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    backgroundColor: palette.redTint,
  },
  errorText: {
    flex: 1,
    ...font(10, '700', { color: palette.red }),
  },
  assignBody: { flex: 1 },
  assignTitle: font(11, '800', { color: palette.navy }),
  assignMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },

  pressed: { opacity: 0.8 },
});
