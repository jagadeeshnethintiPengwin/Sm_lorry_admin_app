import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

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
  const ownerLabel = route.params?.ownerLabel ?? 'AP 31 XX 1234';

  const [front, setFront] = useState<{ name: string; size: string } | null>({
    name: 'RC-front.jpg',
    size: '842 KB',
  });
  const [back, setBack] = useState<{ name: string; size: string } | null>(null);
  const [target, setTarget] = useState<'front' | 'back' | null>(null);

  const [rcNumber, setRcNumber] = useState('TS0987654321');
  const [issueDate, setIssueDate] = useState('2022-04-15');
  const [validTill, setValidTill] = useState('2037-04-14');
  const [rto, setRto] = useState('RTA Hyderabad');
  const [reminder, setReminder] = useState(true);

  const closeSheet = useCallback(() => setTarget(null), []);

  const applyUpload = useCallback(
    (name: string, size: string) => {
      if (target === 'front') {
        setFront({ name, size });
      } else if (target === 'back') {
        setBack({ name, size });
      }
      setTarget(null);
    },
    [target],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Upload Document"
        subtitle={`RC Book · ${ownerLabel}`}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
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
                <View style={styles.previewTile}>
                  <Icon name="file-text" size={20} color={palette.gold} />
                </View>
                <Text style={styles.previewName}>{front.name}</Text>
                <Text style={styles.previewSize}>{front.size}</Text>
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
            accessibilityRole="button"
            accessibilityLabel="Upload front side"
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
              <Text style={styles.emptyTitle}>Upload front side</Text>
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
                <View style={styles.previewTile}>
                  <Icon name="file-text" size={20} color={palette.gold} />
                </View>
                <Text style={styles.previewName}>{back.name}</Text>
                <Text style={styles.previewSize}>{back.size}</Text>
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
              accessibilityRole="button"
              accessibilityLabel="Upload back side"
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
                <Text style={styles.emptyTitle}>Upload back side</Text>
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
          label="Save Document"
          variant="gold"
          icon="check-circle-2"
          flex={1.6}
          padding={10}
          fontSize={11}
          gap={5}
          onPress={navigation.goBack}
        />
      </Footer>

      <ImageSourceSheet
        visible={target !== null}
        onClose={closeSheet}
        onCamera={() => applyUpload('RC-photo.jpg', '1.2 MB')}
        onGallery={() => applyUpload('RC-scan.jpg', '904 KB')}
        title={target === 'back' ? 'Back Side' : 'Front Side'}
        subtitle="JPG · PNG · Max 10 MB"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
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
