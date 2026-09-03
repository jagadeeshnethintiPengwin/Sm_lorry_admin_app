import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import {
  AppHeader,
  DateField,
  Button,
  Card,
  Content,
  Footer,
  FieldError,
  Icon,
  ImageSourceSheet,
  Input,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { driverService } from '@services/fleet.service';
import { uploadService } from '@services/upload.service';
import { useDocumentPicker, useImagePicker } from '@hooks/useImagePicker';
import type { PickedImage } from '@hooks/useImagePicker';
import {
  isClean,
  packLicence,
  packMobile,
  validateFutureDate,
  validateLicence,
  validateMobile,
  validateName,
  validatePastDate,
  type Errors,
} from '@utils/validation';

/**
 * Screen 12 — Add New Driver.
 *
 *   photo upload strip · PERSONAL INFO · DRIVING LICENSE (number, dates,
 *   Authorized For chips with HMV preselected) · KYC DOCUMENTS ·
 *   UPLOAD DOCUMENTS dashed gold tiles · gold Add Driver footer
 */
const LICENCE_CLASSES = ['HMV', 'MGV', 'LMV', 'MCWG'];

/**
 * A file that is on the server, plus the local copy used to preview it.
 *
 * `url` is where it now lives and is what gets filed against the driver.
 * `preview` is the picker's own `file://` path on this handset, and it is what
 * renders — `GET /uploads/*` sits behind the bearer guard, and an `<Image>`
 * issues a plain GET with no Authorization header, so pointing a thumbnail at
 * `url` gives a 401 and a blank square over a file that uploaded perfectly.
 */
type StoredFile = {
  name: string;
  size: number;
  url: string;
  preview: string;
  type: string;
};

/** Which paper each document tile files against. */
const SLOT_KIND: Record<string, string> = { dl: 'DL', kyc: 'AADHAAR' };

/** `904 KB`, `1.2 MB` — the caption under a filled tile. */
const readableSize = (bytes: number): string => {
  if (!bytes) {
    return '';
  }
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** The fields the form validates, which is what `errors` is keyed by. */
type DriverForm = {
  name: string;
  mobile: string;
  dob: string;
  dlNumber: string;
  issueDate: string;
  validTill: string;
};

export const AddDriverScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddDriver'>>();

  /**
   * The id of the driver being edited, or `null` for a fresh registration.
   *
   * Everything the edit form does differently — prefilling the fields, saving
   * as an update, hiding the document tiles, the header and button wording —
   * keys off this one value.
   */
  const editingId = route.params?.driverId ?? null;

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [experience, setExperience] = useState('');
  const [address, setAddress] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [validTill, setValidTill] = useState('');
  const [classes, setClasses] = useState<string[]>(['HMV']);
  const [aadhar, setAadhar] = useState('');
  const [pan, setPan] = useState('');
  const [target, setTarget] = useState<string | null>(null);

  /**
   * What has actually been attached, and to which tile.
   *
   * There was no state here at all: the photo tile and both document tiles
   * opened a sheet whose Camera, Gallery and Files buttons were each wired
   * straight to `closeSheet`. Tapping any of them dismissed the sheet and did
   * nothing else — no picker, no file, no upload, and no way for the screen to
   * have remembered one if there had been.
   */
  const [photo, setPhoto] = useState<StoredFile | null>(null);
  const [docs, setDocs] = useState<Record<string, StoredFile | null>>({
    dl: null,
    kyc: null,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { fromCamera, fromGallery } = useImagePicker();
  const { pickDocument } = useDocumentPicker();

  const [errors, setErrors] = useState<Errors<DriverForm>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The KYC numbers as they were prefilled, and the kind the licence is filed
   * under.
   *
   * Save re-files a document only when its number actually changed, so an
   * already-approved licence, Aadhaar or PAN is not needlessly dropped back to
   * PENDING for a field the operator never touched. The DL kind is remembered
   * so a re-file updates that row rather than opening a second one beside an
   * older `LICENCE`.
   */
  const seededDl = useRef<string>('');
  const seededAadhaar = useRef<string>('');
  const seededPan = useRef<string>('');
  const dlKind = useRef<string>('DL');

  /**
   * Fills the form from the driver being edited.
   *
   * Runs once, only in edit mode, and reverses the transforms the create path
   * applies on the way out: the mobile is stored in E.164 and the field holds
   * the ten national digits (`packMobile` strips the country code either way);
   * the licence and KYC numbers live in the driver's `documents` relation (the
   * licence also as a column), seeded raw so they stay editable and are
   * re-packed on save.
   *
   * `prev || next` on each field so a fetch that lands after the operator has
   * started typing never wipes what they wrote; best-effort on failure.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (!editingId || seeded.current) {
      return;
    }
    let cancelled = false;
    driverService
      .get(editingId)
      .then(d => {
        if (cancelled) {
          return;
        }
        seeded.current = true;

        const user = (d.user ?? null) as {
          name?: string;
          mobile?: string;
          photoUrl?: string;
        } | null;
        const documents = (d.documents ?? []) as Array<{
          kind?: string;
          number?: string;
        }>;
        const kindOf = (row: { kind?: string }) =>
          String(row.kind ?? '').toUpperCase();
        const dlDoc = documents.find(
          row => kindOf(row) === 'DL' || kindOf(row) === 'LICENCE',
        );
        const aadhaarDoc = documents.find(row => kindOf(row) === 'AADHAAR');
        const panDoc = documents.find(row => kindOf(row) === 'PAN');

        setName(prev => prev || String(user?.name ?? ''));
        // E.164 (`+9198…`) → the ten national digits the +91 field holds; the
        // prefix is re-added by `packMobile` on save.
        setMobile(prev => prev || packMobile(String(user?.mobile ?? '')));
        setAddress(prev => prev || String(d.address ?? ''));

        // The licence: the DL document's number, else the driver's own column.
        const licence = String(dlDoc?.number ?? d.licenceNumber ?? '');
        setDlNumber(prev => prev || licence);
        if (dlDoc?.kind) {
          dlKind.current = kindOf(dlDoc);
        }
        // `2029-03-11T00:00:00Z` → `2029-03-11`, which is what DateField shows.
        const validAt = d.licenceValid ? new Date(String(d.licenceValid)) : null;
        if (validAt && !Number.isNaN(validAt.getTime())) {
          setValidTill(prev => prev || validAt.toISOString().split('T')[0]);
        }

        setAadhar(prev => prev || String(aadhaarDoc?.number ?? ''));
        setPan(prev => prev || String(panDoc?.number ?? ''));

        /*
         * DOB, experience, issue date and licence classes are collected by this
         * form but not persisted on the driver yet, so there is nothing to read
         * back — seeded defensively in case a column is added later, leaving the
         * defaults otherwise.
         */
        const extra = d as Record<string, unknown>;
        if (typeof extra.dob === 'string') {
          setDob(prev => prev || (extra.dob as string));
        }
        if (extra.experience != null) {
          setExperience(prev => prev || String(extra.experience));
        }
        if (typeof extra.issueDate === 'string') {
          setIssueDate(prev => prev || (extra.issueDate as string));
        }
        if (Array.isArray(extra.licenceClasses) && extra.licenceClasses.length) {
          const stored = extra.licenceClasses as string[];
          setClasses(prev =>
            prev.length === 1 && prev[0] === 'HMV' ? stored : prev,
          );
        }

        // The photograph already on file, shown so the operator can see it
        // landed. The stored URL is a signed display link, so it loads without
        // a bearer — pointed at both `url` and `preview` for the tile to draw.
        const photoUrl = user?.photoUrl ?? (extra.avatarUrl as string | undefined);
        if (photoUrl) {
          setPhoto(
            prev =>
              prev || {
                name: 'Current photo',
                size: 0,
                url: String(photoUrl),
                preview: String(photoUrl),
                type: 'image/*',
              },
          );
        }

        // Remembered so save can tell which numbers the operator changed.
        seededDl.current = packLicence(licence);
        seededAadhaar.current = String(aadhaarDoc?.number ?? '');
        seededPan.current = String(panDoc?.number ?? '');
      })
      // Best-effort: a driver that will not load leaves the form as-is.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const toggleClass = useCallback((value: string) => {
    setClasses(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value],
    );
  }, []);

  const closeSheet = useCallback(() => setTarget(null), []);

  /**
   * Attaches a real file to whichever tile opened the sheet.
   *
   * The picker runs, the bytes go to the server, and the tile is filled only
   * by a URL the server gave back. A cancelled picker leaves the tile
   * untouched; a failed upload says why and leaves it empty, which is the
   * honest state — a tile that looks filled over nothing is how a driver ends
   * up on the roster with no licence on file.
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
        const held: StoredFile = {
          // The picker's name, not the server's: `filename` comes back as a
          // 32-character hex key, which tells an operator nothing.
          name: file.fileName,
          size: stored.size ?? file.fileSize,
          url: stored.url,
          preview: file.uri,
          type: stored.mimetype ?? file.type,
        };
        if (slot === 'photo') {
          setPhoto(held);
        } else {
          setDocs(current => ({ ...current, [slot]: held }));
        }
      } catch (error) {
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

  /**
   * Writes the driver — an update when editing, a create otherwise.
   *
   * The footer button used to be `navigation.goBack` — the whole form was
   * collected and dropped, so "Add Driver" added nobody. The licence expiry is
   * checked before anything is sent because a driver whose licence has already
   * run out is the one case this screen exists to catch, and nothing
   * downstream looks again. Editing writes the changed details and returns to
   * the driver; its scans stay managed from the details screen, which is why
   * the document tiles are hidden in edit mode.
   */
  const addDriver = useCallback(async () => {
    const found: Errors<DriverForm> = {
      name: validateName(name),
      mobile: validateMobile(mobile),
      dob: validatePastDate('date of birth')(dob),
      dlNumber: validateLicence(dlNumber),
      issueDate: validatePastDate('issue date')(issueDate),
      validTill: validateFutureDate('expiry date')(validTill),
    };

    setErrors(found);
    setSubmitError(null);
    if (!isClean(found)) {
      return;
    }

    /*
     * A driver is not added without their licence and their identity on file.
     *
     * These were optional, so a driver could join the roster with a name, a
     * number and nothing to prove either — and the gap only surfaced later,
     * when the office needed to show a checked licence for someone already
     * carrying loads. Verifying afterwards means chasing a person who is on
     * the road; refusing here costs one photograph now.
     *
     * Reported as its own message rather than through `errors`, which is keyed
     * by the text fields — the tiles are what has to change colour, and they
     * are further down the screen than the inputs.
     */
    // Create only. Editing hides the upload tiles and never touches the scans,
    // so a driver already on the roster is not blocked over photos the edit
    // form does not even show.
    if (!editingId) {
      const missing = [
        !docs.dl ? 'the licence photo' : null,
        !docs.kyc ? 'the Aadhaar photo' : null,
      ].filter(Boolean);

      if (missing.length) {
        setSubmitError(
          `Attach ${missing.join(' and ')} before adding the driver. Both are required.`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        /*
         * Edit: write the details and return to the driver.
         *
         * The update DTO mirrors the create body's shape, so the same field
         * mapping serves it — the mobile packed to its national digits, the
         * licence packed of spaces, the address sent only when filled (an empty
         * string fails the DTO's length rule and would reject a valid driver).
         */
        await driverService.update(editingId, {
          name: name.trim(),
          mobile: packMobile(mobile),
          licenceNumber: packLicence(dlNumber),
          licenceValid: validTill,
          ...(address.trim() ? { address: address.trim() } : {}),
        });

        /*
         * A KYC number is re-filed only when it actually changed from what was
         * prefilled. Re-sending an unchanged number would drop an
         * already-approved document back to PENDING for review — the backend
         * clears the verdict on any `number` edit — so an untouched field is
         * left alone. The DL number also rides on the driver column above; this
         * keeps the document row's own number in step when it is the one edited.
         *
         * Deliberately not fatal, as on create: the details are already saved,
         * and a number that would not file can be corrected from the driver's
         * screen rather than failing the whole edit.
         */
        const nextDl = packLicence(dlNumber);
        const nextAadhaar = aadhar.trim();
        const nextPan = pan.trim();
        const refiled: Array<Promise<unknown>> = [];
        if (nextDl && nextDl !== seededDl.current) {
          refiled.push(
            driverService
              .saveDocument(editingId, { kind: dlKind.current, number: nextDl })
              .catch(() => undefined),
          );
        }
        if (nextAadhaar && nextAadhaar !== seededAadhaar.current) {
          refiled.push(
            driverService
              .saveDocument(editingId, { kind: 'AADHAAR', number: nextAadhaar })
              .catch(() => undefined),
          );
        }
        if (nextPan && nextPan !== seededPan.current) {
          refiled.push(
            driverService
              .saveDocument(editingId, { kind: 'PAN', number: nextPan })
              .catch(() => undefined),
          );
        }
        await Promise.all(refiled);

        navigation.goBack();
        return;
      }

      const created = await driverService.create({
        name: name.trim(),
        // The API normalises to E.164 itself; sending the ten national digits
        // is what the +91 prefix on the field already promised.
        mobile: packMobile(mobile),
        licenceNumber: packLicence(dlNumber),
        licenceValid: validTill,
        /*
         * The photograph and the address, both of which the form has always
         * collected and never sent. Omitted rather than sent empty: they are
         * optional, and a blank string fails the DTO's length rule and would
         * reject an otherwise valid driver.
         */
        ...(photo ? { photoUrl: photo.url } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });

      /*
       * The scans, filed against the driver who now exists.
       *
       * Deliberately not fatal: the driver is already on the roster by this
       * point, and their papers can be filed later from the driver's own
       * screen. Failing here would leave an operator believing the whole thing
       * had failed and adding them a second time.
       *
       * The KYC tile carries the Aadhaar number typed above it, and the DL
       * tile the licence number and its expiry, so the record is not just a
       * picture with nothing to check it against.
       */
      const papers: Array<{
        kind: string;
        fileUrl?: string;
        number?: string;
        expiresAt?: string;
      }> = [];
      if (docs.dl) {
        papers.push({
          kind: SLOT_KIND.dl,
          fileUrl: docs.dl.url,
          number: packLicence(dlNumber),
          expiresAt: validTill,
        });
      }
      if (docs.kyc) {
        papers.push({
          kind: SLOT_KIND.kyc,
          fileUrl: docs.kyc.url,
          ...(aadhar.trim() ? { number: aadhar.trim() } : {}),
        });
      }
      /* A PAN typed with no scan is still worth recording. */
      if (pan.trim()) {
        papers.push({ kind: 'PAN', number: pan.trim() });
      }

      await Promise.all(
        papers.map(paper =>
          driverService.saveDocument(created.id, paper).catch(() => undefined),
        ),
      );

      navigation.goBack();
    } catch (error) {
      // A number or licence already on the roster arrives here as the sentence
      // the API wrote for it, naming who holds it.
      setSubmitError(
        error instanceof Error
          ? error.message
          : editingId
            ? 'Could not update the driver'
            : 'Could not add the driver',
      );
    } finally {
      setSaving(false);
    }
  }, [
    aadhar,
    address,
    dlNumber,
    docs,
    dob,
    editingId,
    issueDate,
    mobile,
    name,
    navigation,
    pan,
    photo,
    validTill,
  ]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title={editingId ? 'Edit Driver' : 'Add New Driver'}
        subtitle={editingId ? 'Update driver profile' : 'Register driver profile'}
        showBack
        backIcon="x"
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* Photo upload */}
        <View style={styles.photoCard}>
          <View>
            {photo ? (
              /* The picture that was actually taken, not a placeholder over
                 nothing — the office needs to see it landed. */
              <View>
                <Image source={{ uri: photo.preview }} style={styles.photo} />
                {/* The picture says "chosen"; the tick says "and it is on the
                    server". Only drawn once the upload has returned. */}
                <View style={styles.photoTick}>
                  <Icon name="check" size={11} color={palette.white} />
                </View>
              </View>
            ) : (
              <LinearGradient
                colors={[palette.navyTint, '#c7d5e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.photo}
              >
                {uploading === 'photo' ? (
                  <ActivityIndicator size="small" color={palette.navy} />
                ) : (
                  <Icon name="user" size={24} color={palette.slate400} />
                )}
              </LinearGradient>
            )}
            <Pressable
              onPress={() => setTarget('photo')}
              accessibilityRole="button"
              accessibilityLabel="Take driver photo"
              style={({ pressed }) => [styles.photoFab, pressed && styles.pressed]}
            >
              <Icon name="camera" size={11} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.photoBody}>
            <Text style={styles.photoTitle}>Driver Photo</Text>
            <Text style={styles.photoMeta} numberOfLines={1}>
              {uploading === 'photo'
                ? 'Uploading…'
                : photo
                  ? ['Uploaded', readableSize(photo.size)]
                      .filter(Boolean)
                      .join(' · ')
                  : 'JPG or PNG · Max 5 MB'}
            </Text>
            <Pressable
              onPress={() => setTarget('photo')}
              accessibilityRole="button"
              accessibilityLabel="Upload driver photo"
              style={({ pressed }) => [
                styles.uploadBtn,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="upload" size={12} color={palette.navy} />
              <Text style={styles.uploadText}>
                {photo ? 'REPLACE' : 'UPLOAD'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* PERSONAL INFO */}
        <Text style={styles.section}>
          PERSONAL INFO <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Full Name"
            required
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ramesh Kumar"
            marginBottom={10}
            error={errors.name}
          />

          <Text style={styles.fieldLabel}>
            MOBILE NUMBER <Text style={styles.star}>*</Text>
          </Text>
          <View
            style={[styles.prefixWrap, errors.mobile && styles.prefixInvalid]}
          >
            <Text style={styles.prefix}>+91</Text>
            <Input
              value={mobile}
              onChangeText={setMobile}
              placeholder="10-digit mobile"
              keyboardType="phone-pad"
              maxLength={10}
              bare
              marginBottom={0}
              containerStyle={styles.prefixInputWrap}
              inputStyle={styles.prefixInput}
              accessibilityLabel="Mobile number"
            />
          </View>
          {/* The box is a compound row, so its reason sits outside it. */}
          <FieldError>{errors.mobile}</FieldError>

          <View style={styles.row}>
            <View style={styles.col}>
              <DateField
                label="DOB"
                value={dob}
                onChange={setDob}
                marginBottom={10}
                maximumDate={new Date()}
                error={errors.dob}
              />
            </View>
            <View style={styles.col}>
              <Input
                label="Experience (yrs)"
                value={experience}
                onChangeText={setExperience}
                placeholder="4"
                keyboardType="number-pad"
                marginBottom={10}
              />
            </View>
          </View>

          <Input
            label="Home Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Village/Street, District, State, PIN"
            multiline
            numberOfLines={2}
            minHeight={44}
            marginBottom={0}
          />
        </Card>

        {/* DRIVING LICENSE */}
        <Text style={[styles.section, styles.sectionGap]}>
          DRIVING LICENSE <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="DL Number"
            required
            value={dlNumber}
            onChangeText={setDlNumber}
            placeholder="AP04 20100012345"
            autoCapitalize="characters"
            marginBottom={10}
            inputStyle={styles.spaced}
            error={errors.dlNumber}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <DateField
                label="Issue Date"
                value={issueDate}
                onChange={setIssueDate}
                marginBottom={10}
                maximumDate={new Date()}
                error={errors.issueDate}
              />
            </View>
            <View style={styles.col}>
              <DateField
                label="Valid Till"
                required
                value={validTill}
                onChange={setValidTill}
                marginBottom={10}
                minimumDate={new Date()}
                error={errors.validTill}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>AUTHORIZED FOR</Text>
          <View style={styles.chips}>
            {LICENCE_CLASSES.map(item => {
              const active = classes.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleClass(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={item}
                  style={[styles.chip, active ? styles.chipOn : styles.chipOff]}
                >
                  <Text style={active ? styles.chipTextOn : styles.chipText}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* KYC DOCUMENTS */}
        <Text style={[styles.section, styles.sectionGap]}>
          KYC DOCUMENTS <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Aadhar Number"
            value={aadhar}
            onChangeText={setAadhar}
            placeholder="XXXX XXXX XXXX"
            keyboardType="number-pad"
            maxLength={14}
            marginBottom={10}
            inputStyle={styles.aadharInput}
          />
          <Input
            label="PAN Number"
            value={pan}
            onChangeText={setPan}
            placeholder="ABCDE1234F"
            autoCapitalize="characters"
            maxLength={10}
            marginBottom={0}
            inputStyle={styles.panInput}
          />
        </Card>

        {/*
          UPLOAD DOCUMENTS — create only.

          Editing an existing driver is purely their details; the licence and
          KYC scans are filed and reviewed from the Driver Profile screen, so
          the tiles would be a second, confusing way in that this form's update
          does not even read.
        */}
        {!editingId ? (
          <>
        {/*
          Marked required, like the sections above it.

          The tiles were indistinguishable from optional extras, so an operator
          filled in the form, pressed Add Driver and was refused by something
          they had no reason to think was needed. The asterisk is the same one
          Personal Info and Driving License already carry.
        */}
        <Text style={[styles.section, styles.sectionGap]}>
          UPLOAD DOCUMENTS <Text style={styles.star}>*</Text>
        </Text>
        <View style={styles.slotGrid}>
          {[
            { key: 'dl', label: 'DL Photo' },
            { key: 'kyc', label: 'Aadhar + PAN' },
          ].map(slot => {
            const attached = docs[slot.key];
            const busy = uploading === slot.key;
            return (
              <Pressable
                key={slot.key}
                onPress={() => setTarget(slot.key)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                accessibilityLabel={
                  attached
                    ? `${slot.label} uploaded. Tap to replace.`
                    : `Upload ${slot.label}`
                }
                style={({ pressed }) => [
                  styles.slot,
                  attached && styles.slotDone,
                  /* Outlined red once a submit has been refused for it. */
                  !attached && submitError ? styles.slotMissing : null,
                  pressed && styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={palette.gold} />
                ) : attached?.type?.startsWith('image/') ? (
                  /* Drawn from the local file so it appears instantly and
                     cannot 401; the tick is what reports the upload. */
                  <View style={styles.slotThumbWrap}>
                    <Image
                      source={{ uri: attached.preview }}
                      style={styles.slotThumb}
                    />
                    <View style={styles.slotThumbTick}>
                      <Icon name="check" size={9} color={palette.white} />
                    </View>
                  </View>
                ) : (
                  <Icon
                    name={attached ? 'file-check' : 'camera'}
                    size={18}
                    color={palette.gold}
                  />
                )}
                <Text style={styles.slotLabel}>{slot.label}</Text>
                <Text style={styles.slotFile} numberOfLines={1}>
                  {busy
                    ? 'Uploading…'
                    : attached
                      ? /* Said outright, rather than left to a colour change. */
                        ['Uploaded', readableSize(attached.size)]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Tap to upload'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {uploadError ? (
          <Text style={styles.uploadError}>{uploadError}</Text>
        ) : null}
          </>
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
          label={
            editingId
              ? saving
                ? 'Saving…'
                : 'Save Changes'
              : saving
                ? 'Adding…'
                : 'Add Driver'
          }
          variant="gold"
          icon="user-check"
          padding={12}
          fontSize={13}
          loading={saving}
          onPress={addDriver}
        />
      </Footer>

      <ImageSourceSheet
        visible={target !== null}
        onClose={closeSheet}
        onCamera={() => attach(fromCamera)}
        onGallery={() => attach(fromGallery)}
        // A driver's face is photographed, never attached as a PDF, so the
        // Files option is offered for documents only.
        onDocument={target === 'photo' ? undefined : () => attach(pickDocument)}
        title={target === 'photo' ? 'Driver Photo' : 'Upload Document'}
        subtitle="JPG · PNG · Max 5 MB"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    padding: s(14),
    marginBottom: s(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  photo: {
    width: s(56),
    height: s(56),
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFab: {
    position: 'absolute',
    bottom: s(-3),
    right: s(-3),
    width: s(22),
    height: s(22),
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.white,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBody: { flex: 1 },
  photoTitle: font(11, '800', { color: palette.navy }),
  photoMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(2),
  },
  uploadBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(5),
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    backgroundColor: palette.navyTint,
    borderRadius: radius.sm,
  },
  uploadText: font(9, '800', { color: palette.navy }),

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },
  star: font(9, '800', { color: palette.red }),
  fieldLabel: {
    ...font(9, '800', { color: palette.slate500 }),
    textTransform: 'uppercase',
    marginBottom: s(4),
  },

  row: { flexDirection: 'row', gap: s(8) },
  col: { flex: 1, minWidth: 0 },
  spaced: { letterSpacing: s(0.5) },
  aadharInput: { letterSpacing: s(2) },
  panInput: { letterSpacing: s(1.5) },

  prefixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: s(10),
  },
  prefixInvalid: {
    borderColor: palette.red,
    // The reason sits below this row rather than inside it, so the gap that
    // normally separates fields would strand it against the next one.
    marginBottom: s(2),
  },
  errorCard: {
    marginTop: s(12),
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    backgroundColor: palette.redTint,
  },
  errorText: {
    flex: 1,
    ...font(10, '700', { color: palette.red }),
  },
  prefix: {
    ...font(11, '800', { color: palette.navy }),
    paddingVertical: s(9),
    paddingHorizontal: s(10),
    backgroundColor: palette.surfaceAlt,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.gray200,
  },
  prefixInputWrap: { flex: 1, minWidth: 0 },
  prefixInput: { paddingVertical: s(9), paddingHorizontal: s(11) },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: s(5) },
  chip: {
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    borderRadius: s(14),
    borderWidth: s(1.5),
  },
  chipOn: { backgroundColor: palette.goldTint, borderColor: palette.gold },
  chipOff: { backgroundColor: palette.white, borderColor: palette.gray200 },
  chipText: font(10, '700', { color: palette.navy }),
  chipTextOn: font(10, '800', { color: palette.goldText }),

  slotGrid: { flexDirection: 'row', gap: s(6), marginBottom: s(10) },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(14),
    paddingHorizontal: s(8),
    backgroundColor: palette.goldTint,
    borderWidth: s(1.5),
    borderStyle: 'dashed',
    borderColor: palette.goldSoft,
    borderRadius: radius.lg,
  },
  slotLabel: font(10, '800', { color: palette.goldText }),
  /* Solid once something is on file, so a filled tile reads as finished
     rather than as one still waiting to be tapped. */
  /* The tile the submit is waiting on. */
  slotMissing: {
    borderStyle: 'solid',
    borderColor: palette.red,
    backgroundColor: palette.redTint,
  },
  slotDone: {
    borderStyle: 'solid',
    borderColor: palette.gold,
    backgroundColor: palette.white,
  },
  slotThumbWrap: { width: s(26), height: s(26) },
  slotThumb: {
    width: s(26),
    height: s(26),
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gold,
  },
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
  photoTick: {
    position: 'absolute',
    right: s(-2),
    top: s(-2),
    width: s(18),
    height: s(18),
    borderRadius: radius.full,
    backgroundColor: palette.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(2),
    borderColor: palette.white,
  },
  slotFile: {
    ...font(8, '600', { color: palette.goldText }),
    opacity: 0.85,
    maxWidth: '100%',
  },
  uploadError: {
    ...font(9, '600', { color: palette.red }),
    marginTop: s(6),
  },

  pressed: { opacity: 0.8 },
});
