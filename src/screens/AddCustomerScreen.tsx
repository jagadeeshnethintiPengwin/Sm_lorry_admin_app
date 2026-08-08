import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Footer,
  IconWell,
  Input,
  Screen,
  Select,
  Toggle,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Screen 15 — Add Customer.
 *
 *   BUSINESS INFO (company, Individual / Company segmented, GSTIN, PAN) ·
 *   CONTACT PERSON · ADDRESS (address, city + PIN, state) ·
 *   Send Welcome SMS switch · gold Save Customer footer
 */
const STATES = [
  { label: 'Telangana', value: 'TS' },
  { label: 'Andhra Pradesh', value: 'AP' },
  { label: 'Tamil Nadu', value: 'TN' },
  { label: 'Karnataka', value: 'KA' },
  { label: 'Kerala', value: 'KL' },
  { label: 'Maharashtra', value: 'MH' },
];

type BusinessType = 'individual' | 'company';

export const AddCustomerScreen: React.FC = () => {
  const navigation = useNavigation();

  const [company, setCompany] = useState('');
  const [type, setType] = useState<BusinessType>('company');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState('');
  const [state, setState] = useState('TS');
  const [welcomeSms, setWelcomeSms] = useState(true);

  const selectIndividual = useCallback(() => setType('individual'), []);
  const selectCompany = useCallback(() => setType('company'), []);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Add Customer"
        subtitle="New client account"
        showBack
        backIcon="x"
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* BUSINESS INFO */}
        <Text style={styles.section}>
          BUSINESS INFO <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Company Name"
            required
            value={company}
            onChangeText={setCompany}
            placeholder="e.g. Sri Sai Traders Pvt Ltd"
            marginBottom={10}
          />

          <Text style={styles.fieldLabel}>BUSINESS TYPE</Text>
          <View style={styles.segmented}>
            <Pressable
              onPress={selectIndividual}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === 'individual' }}
              accessibilityLabel="Individual"
              style={[
                styles.segment,
                type === 'individual' ? styles.segmentOn : styles.segmentOff,
              ]}
            >
              <Text
                style={
                  type === 'individual'
                    ? styles.segmentTextOn
                    : styles.segmentText
                }
              >
                Individual
              </Text>
            </Pressable>
            <Pressable
              onPress={selectCompany}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === 'company' }}
              accessibilityLabel="Company"
              style={[
                styles.segment,
                type === 'company' ? styles.segmentOn : styles.segmentOff,
              ]}
            >
              <Text
                style={
                  type === 'company' ? styles.segmentTextOn : styles.segmentText
                }
              >
                Company
              </Text>
            </Pressable>
          </View>

          <Input
            label="GSTIN"
            labelNote="(optional)"
            labelNoteColor={palette.slate400}
            value={gstin}
            onChangeText={setGstin}
            placeholder="e.g. 36AABCS1234H1Z5"
            autoCapitalize="characters"
            marginBottom={10}
            inputStyle={styles.gstin}
          />

          <Input
            label="PAN Number"
            value={pan}
            onChangeText={setPan}
            placeholder="ABCDE1234F"
            autoCapitalize="characters"
            maxLength={10}
            marginBottom={0}
            inputStyle={styles.pan}
          />
        </Card>

        {/* CONTACT PERSON */}
        <Text style={[styles.section, styles.sectionGap]}>
          CONTACT PERSON <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Full Name"
            required
            value={name}
            onChangeText={setName}
            placeholder="Contact person name"
            marginBottom={10}
          />
          <Input
            label="Designation"
            value={designation}
            onChangeText={setDesignation}
            placeholder="e.g. Director, Store Manager"
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

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.in"
            keyboardType="email-address"
            autoCapitalize="none"
            marginBottom={0}
          />
        </Card>

        {/* ADDRESS */}
        <Text style={[styles.section, styles.sectionGap]}>
          ADDRESS <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Full Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, Area, Landmark..."
            multiline
            numberOfLines={3}
            minHeight={56}
            marginBottom={10}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Input
                label="City"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Hyderabad"
                marginBottom={10}
              />
            </View>
            <View style={styles.col}>
              <Input
                label="PIN Code"
                value={pin}
                onChangeText={setPin}
                placeholder="500032"
                keyboardType="number-pad"
                maxLength={6}
                marginBottom={10}
              />
            </View>
          </View>

          <Select
            label="State"
            options={STATES}
            value={state}
            onChange={setState}
            marginBottom={0}
          />
        </Card>

        {/* Notify customer toggle */}
        <Card padding={11} marginBottom={0} style={styles.smsRow}>
          <IconWell
            icon="send"
            size={38}
            iconSize={20}
            backgroundColor={palette.goldTint}
            color={palette.gold}
            borderRadius={radius.lg}
          />
          <View style={styles.smsBody}>
            <Text style={styles.smsTitle}>Send Welcome SMS</Text>
            <Text style={styles.smsMeta}>With login link to customer app</Text>
          </View>
          <Toggle
            value={welcomeSms}
            onValueChange={setWelcomeSms}
            accessibilityLabel="Send welcome SMS"
          />
        </Card>
      </Content>

      <Footer>
        <Button
          label="Save Customer"
          variant="gold"
          icon="check-circle-2"
          padding={12}
          fontSize={13}
          onPress={navigation.goBack}
        />
      </Footer>
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
  fieldLabel: {
    ...font(9, '800', { color: palette.slate500 }),
    textTransform: 'uppercase',
    marginBottom: s(4),
  },

  segmented: { flexDirection: 'row', gap: s(6), marginBottom: s(10) },
  segment: {
    flex: 1,
    padding: s(9),
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  segmentOn: { backgroundColor: palette.navy },
  segmentOff: {
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
  },
  segmentText: font(11, '700', { color: palette.slate500 }),
  segmentTextOn: font(11, '800', { color: palette.white }),

  gstin: { letterSpacing: s(0.5) },
  pan: { letterSpacing: s(1.5) },

  row: { flexDirection: 'row', gap: s(8) },
  col: { flex: 1, minWidth: 0 },

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

  smsRow: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  smsBody: { flex: 1 },
  smsTitle: font(11, '800', { color: palette.navy }),
  smsMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },
});
