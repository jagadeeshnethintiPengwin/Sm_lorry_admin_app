import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Footer,
  Icon,
  ImageSourceSheet,
  Input,
  Screen,
  Select,
} from '@components/index';
import { useImagePicker, type PickedImage } from '@hooks/useImagePicker';
import { notificationService, type NotifyAudience } from '@services/fleet.service';
import { uploadService } from '@services/upload.service';
import { resolveMediaUrl } from '@utils/mediaUrl';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SendNotification'>;

/**
 * Who this goes to.
 *
 * A role, never one account — the same list the web panel offers and the only
 * thing `POST /notifications` accepts. Picking a person out of a roster is a
 * different feature, and a free-text id would be a way to message somebody by
 * guessing a `cuid`.
 */
const AUDIENCES: Array<{ label: string; value: NotifyAudience }> = [
  { label: 'All drivers', value: 'DRIVER' },
  { label: 'All customers', value: 'CUSTOMER' },
  { label: 'Owner', value: 'OWNER' },
  { label: 'Managers', value: 'MANAGER' },
  { label: 'Dispatchers', value: 'DISPATCHER' },
];

/** Decides the glyph and the tone the row is drawn with in every app's feed. */
const CATEGORIES = [
  { label: 'General', value: 'SYSTEM' },
  { label: 'Bookings', value: 'BOOKINGS' },
  { label: 'Trips', value: 'TRIPS' },
  { label: 'Drivers', value: 'DRIVERS' },
  { label: 'Delivery', value: 'DELIVERY' },
  { label: 'Payments', value: 'WALLET' },
];

/*
 * The server's own limits, so the count under each field is the real one and a
 * message is never lost to a rule it could have shown while it was typed.
 * `Notification.title`/`.detail` are varchar(191); the DTO bounds them tighter.
 */
const TITLE_MAX = 120;
const DETAIL_MAX = 180;
const MIN = 3;

/** What the API stores — matched here so a 5 MB photo is refused before it goes up. */
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * SEND A NOTIFICATION — the office writing to its drivers or its customers.
 *
 * Every notification in this system is raised as a side effect of something
 * else: a booking approved, a trip started, a fault reported. So the office
 * could read its feed and never speak into it — a depot closing on Sunday, a
 * rate change, a road shut had no route to the people it affects. The web panel
 * grew a composer for exactly that; this is the same thing on the phone, which
 * is where the owner actually is when the yard rings.
 *
 * The message goes out the way every other notification does — the row is
 * written, then the queue delivers it to sockets and to push — so it lands in
 * the app feed *and* on any device registered for push.
 */
export const SendNotificationScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { fromCamera, fromGallery } = useImagePicker();

  const [audience, setAudience] = useState<NotifyAudience>('DRIVER');
  const [category, setCategory] = useState('SYSTEM');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');

  /*
   * The picked file and the address the server gave it back under.
   *
   * Both, not one: the preview shows the local file, because an upload's
   * address is a guarded `/uploads` URL that a bare `<Image>` — carrying no
   * bearer — cannot load. Previewing the stored address showed a broken frame
   * for a picture that would send perfectly well.
   */
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const audienceLabel = useMemo(
    () => AUDIENCES.find(option => option.value === audience)?.label ?? audience,
    [audience],
  );

  /*
   * Uploaded when it is chosen rather than when Send is pressed.
   *
   * It means the operator sees the picture that will actually go out, and sees
   * a storage failure while they can still do something about it — instead of
   * losing a written message to one.
   */
  const attach = useCallback(
    async (pick: () => Promise<PickedImage[]>) => {
      // Closed first: the picker takes over the screen, and leaving the sheet
      // underneath means it is still there when the camera returns.
      setSheetOpen(false);
      const [file] = await pick();
      if (!file) {
        // Dismissing the picker is an ordinary outcome, not a failure.
        return;
      }
      if (file.fileSize > IMAGE_MAX_BYTES) {
        setFailure('Pictures must be 5 MB or smaller.');
        return;
      }

      setFailure(null);
      setUploading(true);
      setPicked(file);
      try {
        const stored = await uploadService.upload(file);
        setImageUrl(stored.url);
      } catch (error) {
        setPicked(null);
        setFailure(
          error instanceof Error
            ? error.message
            : 'That picture could not be uploaded.',
        );
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const removeImage = useCallback(() => {
    setPicked(null);
    setImageUrl('');
    setFailure(null);
  }, []);

  /** The same rules the DTO enforces, so Send is live only when it would pass. */
  const ready =
    title.trim().length >= MIN && detail.trim().length >= MIN && !uploading;

  const send = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await notificationService.send({
        audience,
        category,
        title: title.trim(),
        detail: detail.trim(),
        // Left out rather than sent empty: the field is optional, and `''`
        // fails its `http(s)` rule and would reject an otherwise fine message.
        ...(imageUrl ? { imageUrl } : {}),
      });
      Alert.alert(
        'Notification sent',
        `“${title.trim()}” has gone to ${audienceLabel.toLowerCase()}.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      setBusy(false);
      setFailure(
        error instanceof Error
          ? error.message
          : 'That message could not be sent.',
      );
    }
  }, [audience, audienceLabel, busy, category, detail, imageUrl, navigation, title]);

  const previewUri = picked?.uri ?? (imageUrl ? resolveMediaUrl(imageUrl) : null);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Send Notification"
        subtitle="Write to your drivers or customers"
        showBack
        backIcon="x"
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* WHO */}
        <Text style={styles.section}>
          SEND TO <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Select
            label="Audience"
            options={AUDIENCES}
            value={audience}
            onChange={value => setAudience(value as NotifyAudience)}
            marginBottom={10}
          />
          <Select
            label="Category"
            options={CATEGORIES}
            value={category}
            onChange={setCategory}
            marginBottom={0}
          />
          <Text style={styles.hint}>
            Decides the icon and colour the message is drawn with in the app it
            lands in.
          </Text>
        </Card>

        {/* MESSAGE */}
        <Text style={[styles.section, styles.sectionGap]}>
          MESSAGE <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Title"
            required
            labelNote={`${title.trim().length}/${TITLE_MAX}`}
            labelNoteColor={palette.slate400}
            value={title}
            onChangeText={setTitle}
            maxLength={TITLE_MAX}
            placeholder="Depot closed on Sunday"
            marginBottom={10}
          />
          <Input
            label="Message"
            required
            labelNote={`${detail.trim().length}/${DETAIL_MAX}`}
            labelNoteColor={palette.slate400}
            value={detail}
            onChangeText={setDetail}
            maxLength={DETAIL_MAX}
            placeholder="The Kompally yard is shut this Sunday for repairs."
            multiline
            minHeight={78}
            marginBottom={0}
          />
        </Card>

        {/* PICTURE */}
        <Text style={[styles.section, styles.sectionGap]}>
          PICTURE <Text style={styles.optional}>(optional)</Text>
        </Text>
        <Card padding={12}>
          {previewUri ? (
            /*
             * The picture itself, not a filename — this is what lands on a
             * driver's lock screen, and the office has no other way to check
             * they attached the right one.
             */
            <View style={styles.previewWrap}>
              <Image
                source={{ uri: previewUri }}
                style={styles.preview}
                resizeMode="cover"
              />
              <Pressable
                onPress={removeImage}
                style={styles.removeBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Remove the picture"
              >
                <Icon name="x" size={12} color={palette.white} />
              </Pressable>
              {uploading ? (
                <View style={styles.uploadingVeil}>
                  <Text style={styles.uploadingText}>Uploading…</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={() => setSheetOpen(true)}
            disabled={uploading}
            style={({ pressed }) => [
              styles.pickRow,
              pressed && styles.pickPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Attach a picture"
          >
            <Icon name="image" size={14} color={palette.navy} />
            <Text style={styles.pickText}>
              {previewUri ? 'Change the picture' : 'Attach a picture'}
            </Text>
          </Pressable>
        </Card>

        {failure ? (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={13} color={palette.red} />
            <Text style={styles.errorText}>{failure}</Text>
          </View>
        ) : null}

        <Text style={styles.footNote}>
          Goes to the app feed of everyone in {audienceLabel.toLowerCase()}, and
          to any device registered for push. It cannot be recalled once sent.
        </Text>
      </Content>

      <Footer>
        <Button
          label={busy ? 'Sending…' : `Send to ${audienceLabel.toLowerCase()}`}
          variant="gold"
          icon="send"
          padding={12}
          fontSize={13}
          loading={busy}
          disabled={!ready || busy}
          onPress={send}
        />
      </Footer>

      <ImageSourceSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCamera={() => attach(fromCamera)}
        onGallery={() => attach(fromGallery)}
        title="Attach a picture"
        subtitle="Shown full width when the notification is opened"
        {...(previewUri ? { onRemove: removeImage } : {})}
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
  optional: font(9, '700', { color: palette.slate400 }),

  hint: {
    ...font(9, '400', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(10),
  },

  previewWrap: { marginBottom: s(10) },
  preview: {
    width: '100%',
    height: s(150),
    borderRadius: radius.md,
    backgroundColor: palette.navyTint,
  },
  removeBtn: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    width: s(24),
    height: s(24),
    borderRadius: radius.full,
    backgroundColor: 'rgba(13,38,71,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `absoluteFillObject` is gone from RN 0.87's types; the four edges named
  // here are exactly what it stood for.
  uploadingVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.md,
    backgroundColor: 'rgba(13,38,71,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: font(10, '800', { color: palette.white }),

  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(7),
    paddingVertical: s(11),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gray200,
    backgroundColor: palette.surfaceAlt,
  },
  pickPressed: { opacity: 0.7 },
  pickText: font(10, '800', { color: palette.navy }),

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(7),
    marginTop: s(12),
    padding: s(10),
    borderRadius: radius.md,
    backgroundColor: palette.redTint,
  },
  errorText: {
    ...font(9, '700', { color: palette.redDark, lineHeight: 1.4 }),
    flex: 1,
  },

  footNote: {
    ...font(9, '400', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(12),
  },
});
