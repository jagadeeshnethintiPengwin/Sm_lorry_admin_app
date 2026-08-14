import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { uploadService } from '@services/upload.service';
import { useDocumentPicker, useImagePicker } from '@hooks/useImagePicker';
import type { PickedImage } from '@hooks/useImagePicker';
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

/**
 * Which of the truck's papers each tile fills in.
 *
 * Creating a vehicle seeds one `VehicleDocument` per kind with nothing
 * attached; these are the kinds, so an uploaded file can be filed against the
 * right row once the vehicle exists.
 */
const SLOT_KIND: Record<string, string> = {
  rc: 'RC',
  insurance: 'INS',
  fitness: 'FIT',
  puc: 'PUC',
};

/** `904 KB`, `1.2 MB` — the caption under a filled tile. */
const readableSize = (bytes: number): string => {
  if (!bytes) {
    return '';
  }
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * A file that is on the server, plus the local copy used to preview it.
 *
 * Two URLs, and the distinction matters. `url` is where the file now lives and
 * is what gets filed against the vehicle. `preview` is the picker's own
 * `file://` path on this handset, and it is what the tile renders — because
 * `GET /uploads/*` sits behind the bearer guard, and an `<Image>` issues a
 * plain GET with no Authorization header. Pointing the thumbnail at `url`
 * gives a 401 and an empty square over a file that uploaded perfectly.
 */
type StoredFile = {
  name: string;
  size: number;
  url: string;
  preview: string;
  type: string;
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

  /**
   * The types the business actually offers, read from the API.
   *
   * This list used to be written into the screen — `Mini Truck`,
   * `14 Ft Truck`, `22 Ft Trailer` — and not one of those strings appears in
   * the `VehicleType` catalogue everything else runs on (`Tata Ace`,
   * `Tata 407`, `14 Feet Truck`, `Trailer`). A customer books a `Tata Ace`;
   * the office registered the lorry as a `14 Ft Truck`; nothing ever matched.
   * Reading the catalogue is what keeps the two ends speaking the same words.
   */
  const [typeOptions, setTypeOptions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [typesFailed, setTypesFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    vehicleService
      .types()
      .then(rows => {
        if (cancelled) {
          return;
        }
        setTypeOptions(
          rows.map(row => ({
            label: row.capacityLabel
              ? `${row.name} (${row.capacityLabel})`
              : row.name,
            // The stored value is the name, which is what a booking carries.
            value: row.name,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTypesFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const [uploads, setUploads] = useState<Record<string, StoredFile | null>>({
    rc: null,
    insurance: null,
    fitness: null,
    puc: null,
  });
  const [target, setTarget] = useState<string | null>(null);
  /* Which tile is mid-upload, so it can say so instead of looking idle. */
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { fromCamera, fromGallery } = useImagePicker();
  const { pickDocument } = useDocumentPicker();

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
        /*
         * The two identifiers the form has always asked for.
         *
         * Both fields were on the screen and neither was ever sent — there
         * were no columns behind them either — so an operator typed a chassis
         * number and it vanished on submit. Sent only when filled: they are
         * optional, and an empty string would fail the DTO's length rule and
         * reject an otherwise valid truck.
         */
        ...(chassis.trim() ? { chassisNumber: chassis.trim() } : {}),
        ...(engine.trim() ? { engineNumber: engine.trim() } : {}),
        ...(assignNow && driverId ? { driverId } : {}),
      });

      /*
       * The scans, filed against the truck that now exists.
       *
       * Creating a vehicle seeds one document row per kind with nothing
       * attached, and the response carries them — so each uploaded file can be
       * matched to its row by kind and patched in. Without this the uploads
       * were real but homeless: the bytes reached the server and no document
       * ever pointed at them.
       *
       * Deliberately not fatal. The vehicle is already in the fleet by this
       * point, and the Upload Document screen it hands off to can file
       * anything that did not stick — failing the whole thing here would leave
       * a truck registered and the operator believing it was not.
       */
      const rows = Array.isArray(created.documents)
        ? (created.documents as Array<{ id: string; kind: string }>)
        : [];
      await Promise.all(
        Object.entries(uploads).map(([slot, file]) => {
          if (!file) {
            return Promise.resolve();
          }
          const row = rows.find(d => d.kind === SLOT_KIND[slot]);
          return row
            ? vehicleService
                .saveDocument(row.id, { fileUrl: file.url })
                .catch(() => undefined)
            : Promise.resolve();
        }),
      );

      /*
       * The id travels with the label.
       *
       * Upload Document took only `ownerLabel` — a registration string — so
       * the screen it handed off to knew which truck it was *called* and not
       * which row to file anything against. Anything attached there had
       * nowhere to go.
       */
      navigation.replace('UploadDocument', {
        ownerId: created.id,
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
    chassis,
    engine,
    registration,
    type,
    uploads,
    year,
  ]);

  /**
   * Attaches a real file to the slot that opened the sheet.
   *
   * What this replaced: the three sheet buttons called `applyUpload('photo.jpg')`,
   * `applyUpload('scan.jpg')` and `applyUpload('document.pdf')` — literal
   * strings. No picker ever opened, nothing was chosen, and nothing was sent.
   * Tapping "Camera" turned the tile gold and captioned it `photo.jpg`, so a
   * truck could be added to the fleet appearing to have its RC and insurance
   * on file when no image existed anywhere.
   *
   * Now the picker actually runs, the bytes actually go to the server, and the
   * tile is filled *only* by a URL the server gave back. A cancelled picker
   * leaves the slot untouched; a failed upload says why and leaves it empty,
   * which is the honest state.
   */
  const attach = useCallback(
    async (pick: () => Promise<PickedImage[]>) => {
      const slot = target;
      // Closed first: the picker takes over the screen, and leaving the sheet
      // underneath means it is still there when the camera returns.
      setTarget(null);
      if (!slot) {
        return;
      }

      const [file] = await pick();
      if (!file) {
        // Dismissing the picker is an ordinary outcome, not a failure.
        return;
      }

      setUploadError(null);
      setUploading(slot);
      try {
        const stored = await uploadService.upload(file);
        setUploads(current => ({
          ...current,
          [slot]: {
            // The picker's name, not the server's: `filename` comes back as a
            // 32-character hex key, which tells an operator nothing.
            name: file.fileName,
            size: stored.size ?? file.fileSize,
            url: stored.url,
            preview: file.uri,
            type: stored.mimetype ?? file.type,
          },
        }));
      } catch (error) {
        /*
         * Said out loud, and the slot left empty.
         *
         * File storage is not configured on every deployment yet, and that
         * answers 503 with a sentence explaining itself. Showing it beats a
         * tile that silently stays blank after the operator watched a spinner.
         */
        setUploadError(
          error instanceof Error
            ? error.message
            : 'That file could not be uploaded',
        );
      } finally {
        setUploading(null);
      }
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
            options={typeOptions}
            value={type}
            onChange={setType}
            placeholder={
              typesFailed
                ? 'Vehicle types could not be loaded'
                : typeOptions.length
                  ? 'Select vehicle type'
                  : 'Loading vehicle types…'
            }
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
            const busy = uploading === slot.key;
            return (
              <Pressable
                key={slot.key}
                onPress={() => setTarget(slot.key)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                accessibilityLabel={
                  uploaded
                    ? `${slot.label} uploaded. Tap to replace.`
                    : busy
                      ? `Uploading ${slot.label}`
                      : `Upload ${slot.label}`
                }
                style={({ pressed }) => [
                  styles.slot,
                  uploaded ? styles.slotDone : styles.slotEmpty,
                  pressed && styles.pressed,
                ]}
              >
                {uploaded && uploaded.type?.startsWith('image/') ? (
                  /*
                   * The picture, with a tick over its corner.
                   *
                   * Drawn from the local file rather than fetched back, so it
                   * appears the instant it is chosen and cannot fail; the tick
                   * is what says the bytes reached the server, and it is only
                   * drawn once they have.
                   */
                  <View style={styles.slotThumbWrap}>
                    <Image
                      source={{ uri: uploaded.preview }}
                      style={styles.slotThumb}
                    />
                    <View style={styles.slotThumbTick}>
                      <Icon name="check" size={9} color={palette.white} />
                    </View>
                  </View>
                ) : (
                  <IconWell
                    icon={uploaded ? 'file-check' : slot.icon}
                    size={26}
                    iconSize={14}
                    backgroundColor={uploaded ? palette.white : slot.bg}
                    color={uploaded ? palette.gold : slot.color}
                    borderRadius={radius.md}
                  />
                )}
                <Text style={uploaded ? styles.slotLabelDone : styles.slotLabel}>
                  {slot.label}
                </Text>
                <Text
                  style={uploaded ? styles.slotFile : styles.slotHint}
                  numberOfLines={1}
                >
                  {busy
                    ? 'Uploading…'
                    : uploaded
                      ? /*
                         * Said outright.
                         *
                         * The caption was the stored filename, which answers
                         * "what is it called" — a question nobody asked — and
                         * left "did it actually go?" to be inferred from a
                         * colour change. An operator who is not sure re-taps
                         * and uploads it twice.
                         */
                        ['Uploaded', readableSize(uploaded.size)]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Tap to upload'}
                </Text>

                <View style={styles.slotBadge}>
                  {busy ? (
                    <ActivityIndicator size="small" color={palette.gold} />
                  ) : (
                    <Icon
                      name={uploaded ? 'check' : 'upload-cloud'}
                      size={12}
                      color={uploaded ? palette.gold : palette.slate400}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {uploadError ? (
          <Text style={styles.uploadError}>{uploadError}</Text>
        ) : null}

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
        onCamera={() => attach(fromCamera)}
        onGallery={() => attach(fromGallery)}
        onDocument={() => attach(pickDocument)}
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
  slotThumbWrap: { width: s(26), height: s(26) },
  slotThumb: {
    width: s(26),
    height: s(26),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gold,
  },
  /* Sits on the corner of the picture: the picture says "chosen", this says
     "and it is on the server". */
  slotThumbTick: {
    position: 'absolute',
    right: s(-3),
    bottom: s(-3),
    width: s(13),
    height: s(13),
    borderRadius: radius.full,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(1.5),
    borderColor: palette.white,
  },
  uploadError: {
    ...font(9, '600', { color: palette.red }),
    marginTop: s(6),
  },
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
