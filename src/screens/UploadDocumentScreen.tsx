import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  Icon,
  IconWell,
  ImageSourceSheet,
  Input,
  RadialGlow,
  Screen,
  Toggle,
} from '@components/index';
import { alpha, gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s, wp } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { vehicleService } from '@services/fleet.service';
import { uploadService } from '@services/upload.service';
import { useDocumentPicker, useImagePicker } from '@hooks/useImagePicker';
import type { PickedImage } from '@hooks/useImagePicker';

/** A file that is on the server, plus the local copy used to preview it. */
type StoredFile = {
  name: string;
  size: number;
  url: string;
  preview: string;
  type: string;
};

/** `904 KB`, `1.2 MB` — the caption under an attached file. */
const readableSize = (bytes: number): string => {
  if (!bytes) {
    return '';
  }
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Screen 9 — Upload Document.
 *
 *   navy hero (REGISTRATION CERTIFICATE / RC Book) · FRONT SIDE card with a
 *   green ✓ UPLOADED rail and the file preview + red remove · BACK SIDE
 *   dashed red PENDING card, tappable to open the source sheet ·
 *   DOCUMENT DETAILS · Expiry Reminder switch · Cancel / Save Document footer
 *
 * Both sides are captures of a physical card, so the sheet offers Camera and
 * Gallery only — attaching a PDF here would have no front/back to file. The
 * mock's inline Take Photo / Gallery pair is dropped: the sheet already asks
 * that question, and asking it twice in one screen is noise.
 */
export const UploadDocumentScreen: React.FC = () => {
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<RootStackParamList, 'UploadDocument'>>();

  // Reached from Add Vehicle the registration comes through as a param;
  // opened straight from a vehicle's document list it falls back to the mock.
  const ownerId = route.params?.ownerId ?? null;
  const ownerLabel = route.params?.ownerLabel ?? 'this vehicle';

  /*
   * Empty, because nothing has been uploaded.
   *
   * The screen opened with `RC-front.jpg · 842 KB` already filled in, along
   * with a registration number, both dates and an RTO — all carried over from
   * the HTML mock, where they existed to show what a completed form looks
   * like. On a real screen it meant every document appeared to be on file
   * before anyone had touched it, and an operator pressing Save would have
   * filed a record describing a scan that does not exist.
   */
  const [front, setFront] = useState<StoredFile | null>(null);
  const [back, setBack] = useState<StoredFile | null>(null);
  const [target, setTarget] = useState<'front' | 'back' | null>(null);

  const [rcNumber, setRcNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [validTill, setValidTill] = useState('');
  const [rto, setRto] = useState('');
  const [reminder, setReminder] = useState(true);

  const [uploading, setUploading] = useState<'front' | 'back' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fromCamera, fromGallery } = useImagePicker();
  const { pickDocument } = useDocumentPicker();

  const closeSheet = useCallback(() => setTarget(null), []);

  /**
   * Attaches a real file to whichever side opened the sheet.
   *
   * Replaces `applyUpload('RC-photo.jpg', '1.2 MB')` — a filename and a size
   * both invented by the screen, for a file that was never chosen and never
   * sent anywhere.
   */
  const attach = useCallback(
    async (pick: () => Promise<PickedImage[]>) => {
      const side = target;
      setTarget(null);
      if (!side) {
        return;
      }

      const [file] = await pick();
      if (!file) {
        return;
      }

      setError(null);
      setUploading(side);
      try {
        const stored = await uploadService.upload(file);
        const held: StoredFile = {
          name: file.fileName,
          size: stored.size ?? file.fileSize,
          url: stored.url,
          preview: file.uri,
          type: stored.mimetype ?? file.type,
        };
        if (side === 'front') {
          setFront(held);
        } else {
          setBack(held);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'That file could not be uploaded',
        );
      } finally {
        setUploading(null);
      }
    },
    [target],
  );

  /**
   * Files the scan against the truck's paper.
   *
   * The Save button called `goBack` and nothing else, so everything typed here
   * was discarded — which is why `fileUrl` was null on every vehicle document
   * in the fleet and the eye button had nothing to open.
   */
  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    if (!ownerId) {
      setError('This screen was opened without a vehicle to file against.');
      return;
    }
    if (!front) {
      setError('Attach the front of the document before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const vehicle = await vehicleService.get(ownerId);
      const rows = Array.isArray(vehicle.documents)
        ? (vehicle.documents as Array<{ id: string; kind: string }>)
        : [];
      const rc = rows.find(row => row.kind === 'RC');
      if (!rc) {
        throw new Error('That vehicle has no RC record to file against');
      }

      await vehicleService.saveDocument(rc.id, {
        fileUrl: front.url,
        ...(rcNumber.trim() ? { number: rcNumber.trim() } : {}),
        ...(validTill ? { expiresAt: validTill } : {}),
      });
      navigation.goBack();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the document',
      );
    } finally {
      setSaving(false);
    }
  }, [front, navigation, ownerId, rcNumber, saving, validTill]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Upload Document"
        subtitle={`RC Book · ${ownerLabel}`}
        showBack
        onBackPress={navigation.goBack}
      />

      {/*
        A wider gutter than the 12 design-px `Content` defaults to.

        This screen is a single column of full-width cards, so the default
        padding left them almost touching the edges. Only the horizontal side
        is overridden — the vertical rhythm between cards is unchanged.
      */}
      <Content contentStyle={styles.page}>
        {/* Document type hero */}
        <LinearGradient
          colors={gradients.navyHero as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <RadialGlow
            size={100}
            color={palette.gold}
            opacity={0.3}
            top={-20}
            right={-20}
          />
          <View style={styles.heroRow}>
            <View style={styles.heroTile}>
              <Icon name="file-text" size={20} color={palette.gold} />
            </View>
            <View style={styles.heroBody}>
              <Text style={styles.heroKicker}>REGISTRATION CERTIFICATE</Text>
              <Text style={styles.heroTitle}>RC Book</Text>
              <Text style={styles.heroMeta}>
                Original scan or clear photo required
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* FRONT SIDE */}
        <Text style={styles.section}>
          FRONT SIDE{' '}
          {front ? (
            <Text style={styles.sectionOk}>✓ UPLOADED</Text>
          ) : (
            <Text style={styles.sectionPending}>PENDING</Text>
          )}
        </Text>

        {front ? (
          <Card padding={0} clip accentColor={palette.green} accentWidth={3}>
            <LinearGradient
              colors={[palette.navyTint, palette.screenBg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.preview}
            >
              <View style={styles.previewBody}>
                {front.type?.startsWith('image/') ? (
                  /* The local file, so it appears instantly and cannot 401 —
                     `GET /uploads/*` is behind the bearer guard. */
                  <Image
                    source={{ uri: front.preview }}
                    style={styles.previewThumb}
                  />
                ) : (
                  <View style={styles.previewTile}>
                    <Icon name="file-text" size={20} color={palette.gold} />
                  </View>
                )}
                <Text style={styles.previewName} numberOfLines={1}>
                  {front.name}
                </Text>
                <Text style={styles.previewSize}>
                  {['Uploaded', readableSize(front.size)].filter(Boolean).join(' · ')}
                </Text>
              </View>

              <View style={styles.tagGreen}>
                <Icon name="check" size={10} color={palette.white} />
                <Text style={styles.tagGreenText}>FRONT</Text>
              </View>

              <Pressable
                onPress={() => setFront(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove front side"
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="x" size={12} color={palette.white} />
              </Pressable>
            </LinearGradient>
          </Card>
        ) : (
          <Pressable
            onPress={() => setTarget('front')}
            disabled={uploading === 'front'}
            accessibilityRole="button"
            accessibilityState={{ busy: uploading === 'front' }}
            accessibilityLabel={
              uploading === 'front' ? 'Uploading front side' : 'Upload front side'
            }
            style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
          >
            <View style={styles.emptyBody}>
              <IconWell
                icon="upload-cloud"
                size={46}
                iconSize={20}
                backgroundColor={palette.redTint}
                color={palette.red}
                borderRadius={radius.lg}
              />
              <Text style={styles.emptyTitle}>
                {uploading === 'front' ? 'Uploading…' : 'Upload front side'}
              </Text>
              <Text style={styles.emptyMeta}>Both sides required</Text>
            </View>
            <View style={styles.tagRed}>
              <Text style={styles.tagRedText}>FRONT</Text>
            </View>
          </Pressable>
        )}

        {/* BACK SIDE */}
        <Text style={[styles.section, styles.sectionGap]}>
          BACK SIDE{' '}
          {back ? (
            <Text style={styles.sectionOk}>✓ UPLOADED</Text>
          ) : (
            <Text style={styles.sectionPending}>PENDING</Text>
          )}
        </Text>

        <View style={styles.backCard}>
          {back ? (
            <LinearGradient
              colors={[palette.navyTint, palette.screenBg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.preview}
            >
              <View style={styles.previewBody}>
                {back.type?.startsWith('image/') ? (
                  /* The local file, so it appears instantly and cannot 401 —
                     `GET /uploads/*` is behind the bearer guard. */
                  <Image
                    source={{ uri: back.preview }}
                    style={styles.previewThumb}
                  />
                ) : (
                  <View style={styles.previewTile}>
                    <Icon name="file-text" size={20} color={palette.gold} />
                  </View>
                )}
                <Text style={styles.previewName} numberOfLines={1}>
                  {back.name}
                </Text>
                <Text style={styles.previewSize}>
                  {['Uploaded', readableSize(back.size)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.tagGreen}>
                <Icon name="check" size={10} color={palette.white} />
                <Text style={styles.tagGreenText}>BACK</Text>
              </View>
              <Pressable
                onPress={() => setBack(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove back side"
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="x" size={12} color={palette.white} />
              </Pressable>
            </LinearGradient>
          ) : (
            <Pressable
              onPress={() => setTarget('back')}
              disabled={uploading === 'back'}
              accessibilityRole="button"
              accessibilityState={{ busy: uploading === 'back' }}
              accessibilityLabel={
                uploading === 'back' ? 'Uploading back side' : 'Upload back side'
              }
              style={({ pressed }) => [styles.emptyBack, pressed && styles.pressed]}
            >
              <View style={styles.emptyBody}>
                <IconWell
                  icon="upload-cloud"
                  size={46}
                  iconSize={20}
                  backgroundColor={palette.redTint}
                  color={palette.red}
                  borderRadius={radius.lg}
                />
                <Text style={styles.emptyTitle}>
                {uploading === 'back' ? 'Uploading…' : 'Upload back side'}
              </Text>
                <Text style={styles.emptyMeta}>Both sides required</Text>
              </View>
              <View style={styles.tagRed}>
                <Text style={styles.tagRedText}>BACK</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Document details */}
        <Text style={[styles.section, styles.sectionGap]}>DOCUMENT DETAILS</Text>
        <Card padding={12}>
          <Input
            label="RC Number"
            required
            value={rcNumber}
            onChangeText={setRcNumber}
            placeholder="e.g. TS0987654321"
            autoCapitalize="characters"
            marginBottom={10}
            inputStyle={styles.rcInput}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <DateField
                label="Issue Date"
                value={issueDate}
                onChange={setIssueDate}
                marginBottom={10}
              />
            </View>
            <View style={styles.col}>
              <DateField
                label="Valid Till"
                required
                value={validTill}
                onChange={setValidTill}
                marginBottom={10}
              />
            </View>
          </View>

          <Input
            label="Issuing RTO"
            value={rto}
            onChangeText={setRto}
            placeholder="e.g. RTA Visakhapatnam"
            marginBottom={0}
          />
        </Card>

        {/* Reminder toggle */}
        <Card padding={11} marginBottom={0} style={styles.reminderRow}>
          <IconWell
            icon="bell-ring"
            size={38}
            iconSize={20}
            backgroundColor={palette.goldTint}
            color={palette.gold}
            borderRadius={radius.lg}
          />
          <View style={styles.reminderBody}>
            <Text style={styles.reminderTitle}>Expiry Reminder</Text>
            <Text style={styles.reminderMeta}>Notify 30 days before expiry</Text>
          </View>
          <Toggle
            value={reminder}
            onValueChange={setReminder}
            accessibilityLabel="Expiry reminder"
          />
        </Card>
      </Content>

      {error ? (
        <View style={styles.errorBar}>
          <Icon name="alert-circle" size={13} color={palette.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Footer row>
        <Button
          label="Cancel"
          variant="outline"
          flex={1}
          padding={10}
          fontSize={11}
          gap={5}
          borderColor={palette.border}
          onPress={navigation.goBack}
        />
        <Button
          label={saving ? 'Saving…' : 'Save Document'}
          variant="gold"
          icon="check-circle-2"
          flex={1.6}
          padding={10}
          fontSize={11}
          gap={5}
          loading={saving}
          onPress={save}
        />
      </Footer>

      <ImageSourceSheet
        visible={target !== null}
        onClose={closeSheet}
        onCamera={() => attach(fromCamera)}
        onGallery={() => attach(fromGallery)}
        onDocument={() => attach(pickDocument)}
        title={target === 'back' ? 'Back Side' : 'Front Side'}
        subtitle="JPG · PNG · PDF · Max 5 MB"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  /** Page gutter, as a share of the display rather than a scaled mock value. */
  page: { paddingHorizontal: wp(5) },
  hero: {
    padding: s(14),
    borderRadius: radius.xl,
    marginBottom: s(12),
    overflow: 'hidden',
  },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  heroTile: {
    width: s(44),
    height: s(44),
    backgroundColor: alpha.gold20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha.gold40,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1 },
  heroKicker: font(9, '800', { color: palette.gold, letterSpacing: 1.5 }),
  heroTitle: {
    ...font(14, '800', { color: palette.white }),
    marginTop: s(2),
  },
  heroMeta: {
    ...font(9, '600', { color: palette.white }),
    opacity: 0.75,
    marginTop: s(1),
  },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(12) },
  sectionOk: font(9, '800', { color: palette.green }),
  sectionPending: font(9, '800', { color: palette.red }),

  preview: {
    height: s(110),
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  previewBody: { alignItems: 'center' },
  previewTile: {
    width: s(46),
    height: s(46),
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.gold,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.goldSmall,
  },
  previewName: {
    ...font(9, '800', { color: palette.navy }),
    marginTop: s(6),
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(12),
    paddingBottom: s(6),
  },
  errorText: { ...font(10, '600', { color: palette.red }), flex: 1 },
  previewThumb: {
    width: s(52),
    height: s(52),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gold,
    marginBottom: s(6),
  },
  previewSize: {
    ...font(8, '700', { color: palette.slate500 }),
    marginTop: s(1),
  },
  tagGreen: {
    position: 'absolute',
    top: s(8),
    left: s(8),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: palette.green,
    borderRadius: s(20),
  },
  tagGreenText: font(8, '800', { color: palette.white, letterSpacing: 0.5 }),
  removeBtn: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    width: s(24),
    height: s(24),
    backgroundColor: 'rgba(220,38,38,0.9)',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backCard: {
    borderRadius: radius.card,
    borderWidth: s(1.5),
    borderStyle: 'dashed',
    borderColor: '#fca5a5',
    backgroundColor: '#fff8f8',
    overflow: 'hidden',
    marginBottom: s(12),
  },
  empty: {
    height: s(110),
    borderRadius: radius.card,
    borderWidth: s(1.5),
    borderStyle: 'dashed',
    borderColor: '#fca5a5',
    backgroundColor: '#fff8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBack: {
    height: s(110),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: { alignItems: 'center' },
  emptyTitle: {
    ...font(10, '800', { color: palette.red }),
    marginTop: s(6),
  },
  emptyMeta: {
    ...font(8, '700', { color: palette.slate500 }),
    marginTop: s(1),
  },
  tagRed: {
    position: 'absolute',
    top: s(8),
    left: s(8),
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: palette.red,
    borderRadius: s(20),
  },
  tagRedText: font(8, '800', { color: palette.white, letterSpacing: 0.5 }),


  row: { flexDirection: 'row', gap: s(8) },
  col: { flex: 1, minWidth: 0 },
  rcInput: {
    letterSpacing: s(0.5),
    ...font(12, '800', { color: palette.navy }),
  },

  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  reminderBody: { flex: 1 },
  reminderTitle: font(11, '800', { color: palette.navy }),
  reminderMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },

  pressed: { opacity: 0.8 },
});
