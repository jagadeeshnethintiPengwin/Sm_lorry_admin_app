import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

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
   * Registers the driver and their sign-in account.
   *
   * The footer button used to be `navigation.goBack` — the whole form was
   * collected and dropped, so "Add Driver" added nobody. The licence expiry is
   * checked before anything is sent because a driver whose licence has already
   * run out is the one case this screen exists to catch, and nothing
   * downstream looks again.
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

    setSaving(true);
    try {
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
        error instanceof Error ? error.message : 'Could not add the driver',
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
        title="Add New Driver"
        subtitle="Register driver profile"
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

        {/* UPLOAD DOCUMENTS */}
        <Text style={[styles.section, styles.sectionGap]}>UPLOAD DOCUMENTS</Text>
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

        {submitError ? (
          <Card padding={11} marginBottom={0} style={styles.errorCard}>
            <Icon name="alert-circle" size={14} color={palette.red} />
            <Text style={styles.errorText}>{submitError}</Text>
          </Card>
        ) : null}
      </Content>

      <Footer>
        <Button
          label={saving ? 'Adding…' : 'Add Driver'}
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
