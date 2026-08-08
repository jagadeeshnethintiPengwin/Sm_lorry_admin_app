import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  DateField,
  Button,
  Card,
  Content,
  Footer,
  Icon,
  ImageSourceSheet,
  Input,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Screen 12 — Add New Driver.
 *
 *   photo upload strip · PERSONAL INFO · DRIVING LICENSE (number, dates,
 *   Authorized For chips with HMV preselected) · KYC DOCUMENTS ·
 *   UPLOAD DOCUMENTS dashed gold tiles · gold Add Driver footer
 */
const LICENCE_CLASSES = ['HMV', 'MGV', 'LMV', 'MCWG'];

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

  const toggleClass = useCallback((value: string) => {
    setClasses(current =>
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value],
    );
  }, []);

  const closeSheet = useCallback(() => setTarget(null), []);

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
            <LinearGradient
              colors={[palette.navyTint, '#c7d5e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.photo}
            >
              <Icon name="user" size={24} color={palette.slate400} />
            </LinearGradient>
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
            <Text style={styles.photoMeta}>JPG or PNG · Max 5 MB</Text>
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
              <Text style={styles.uploadText}>UPLOAD</Text>
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
          />

          <Text style={styles.fieldLabel}>
            MOBILE NUMBER <Text style={styles.star}>*</Text>
          </Text>
          <View style={styles.prefixWrap}>
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
            />
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <DateField
                label="DOB"
                value={dob}
                onChange={setDob}
                marginBottom={10}
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
            placeholder="DLAP 04XXXXXXXX"
            autoCapitalize="characters"
            marginBottom={10}
            inputStyle={styles.spaced}
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
                value={validTill}
                onChange={setValidTill}
                marginBottom={10}
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
          ].map(slot => (
            <Pressable
              key={slot.key}
              onPress={() => setTarget(slot.key)}
              accessibilityRole="button"
              accessibilityLabel={`Upload ${slot.label}`}
              style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
            >
              <Icon name="camera" size={18} color={palette.gold} />
              <Text style={styles.slotLabel}>{slot.label}</Text>
            </Pressable>
          ))}
        </View>
      </Content>

      <Footer>
        <Button
          label="Add Driver"
          variant="gold"
          icon="user-check"
          padding={12}
          fontSize={13}
          onPress={navigation.goBack}
        />
      </Footer>

      <ImageSourceSheet
        visible={target !== null}
        onClose={closeSheet}
        onCamera={closeSheet}
        onGallery={closeSheet}
        onDocument={target === 'photo' ? undefined : closeSheet}
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

  pressed: { opacity: 0.8 },
});
