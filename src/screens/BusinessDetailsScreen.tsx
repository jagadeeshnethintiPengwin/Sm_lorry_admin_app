import React, { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Field,
  Footer,
  Icon,
  ImageSourceSheet,
  Input,
  Screen,
  Select,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Screen 26 — Business Details.
 *
 *   business logo card with a gold camera fab · BUSINESS INFO ·
 *   TAX & REGISTRATION (verified GSTIN chip, PAN, CIN) ·
 *   REGISTERED ADDRESS · CONTACT · gold Save Changes footer
 */
const BUSINESS_TYPES = [
  { label: 'Transport & Logistics', value: 'transport' },
  { label: 'Fleet Owner', value: 'fleet' },
  { label: 'Cargo Services', value: 'cargo' },
];

const STATES = [
  { label: 'Telangana', value: 'TS' },
  { label: 'Andhra Pradesh', value: 'AP' },
];

export const BusinessDetailsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [company, setCompany] = useState('SMT Simhadri Transport Pvt Ltd');
  const [type, setType] = useState('transport');
  const [year, setYear] = useState('2010');
  const [pan, setPan] = useState('AABCS1234H');
  const [cin, setCin] = useState('U60232TG2010PTC123456');
  const [address, setAddress] = useState(
    'Plot 42, Industrial Estate, Gachibowli, Hyderabad',
  );
  const [city, setCity] = useState('Hyderabad');
  const [pin, setPin] = useState('500032');
  const [state, setState] = useState('TS');
  const [supportMobile, setSupportMobile] = useState('+91 40 4000 8888');
  const [supportEmail, setSupportEmail] = useState('care@smtsimhadri.com');
  const [pickerOpen, setPickerOpen] = useState(false);

  const closePicker = useCallback(() => setPickerOpen(false), []);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Business Details"
        subtitle="Company & GSTIN info"
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* Business logo */}
        <Card padding={14} style={styles.logoCard}>
          <View>
            <LinearGradient
              colors={gradients.navyHero as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoTile}
            >
              <Image
                source={require('@assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="SMT"
              />
            </LinearGradient>

            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Change business logo"
              style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            >
              <Icon name="camera" size={12} color={palette.navy} />
            </Pressable>
          </View>

          <View style={styles.logoBody}>
            <Text style={styles.logoTitle}>Business Logo</Text>
            <Text style={styles.logoMeta}>JPG or PNG · Max 5 MB</Text>
          </View>
        </Card>

        {/* BUSINESS INFO */}
        <Text style={styles.section}>BUSINESS INFO</Text>
        <Card padding={12}>
          <Input
            label="Company Name"
            value={company}
            onChangeText={setCompany}
            marginBottom={10}
          />
          <Select
            label="Business Type"
            options={BUSINESS_TYPES}
            value={type}
            onChange={setType}
            marginBottom={10}
          />
          <Input
            label="Year Established"
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
            marginBottom={0}
          />
        </Card>

        {/* TAX & REGISTRATION */}
        <Text style={[styles.section, styles.sectionGap]}>
          TAX &amp; REGISTRATION
        </Text>
        <Card padding={12}>
          <Field
            label="GSTIN"
            labelNote="· verified"
            labelNoteColor={palette.gold}
            value="36AABCS1234H1Z5"
            icon="badge-check"
            iconColor={palette.gold}
            variant="tinted"
            valueStyle={styles.gstin}
            marginBottom={10}
          />
          <Input
            label="PAN Number"
            value={pan}
            onChangeText={setPan}
            autoCapitalize="characters"
            marginBottom={10}
            inputStyle={styles.pan}
          />
          <Input
            label="CIN (Company)"
            value={cin}
            onChangeText={setCin}
            autoCapitalize="characters"
            marginBottom={0}
            inputStyle={styles.cin}
          />
        </Card>

        {/* REGISTERED ADDRESS */}
        <Text style={[styles.section, styles.sectionGap]}>
          REGISTERED ADDRESS
        </Text>
        <Card padding={12}>
          <Input
            value={address}
            onChangeText={setAddress}
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
                marginBottom={10}
              />
            </View>
            <View style={styles.col}>
              <Input
                label="PIN"
                value={pin}
                onChangeText={setPin}
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

        {/* CONTACT */}
        <Text style={[styles.section, styles.sectionGap]}>CONTACT</Text>
        <Card padding={12} marginBottom={0}>
          <Input
            label="Support Mobile"
            value={supportMobile}
            onChangeText={setSupportMobile}
            keyboardType="phone-pad"
            marginBottom={10}
          />
          <Input
            label="Support Email"
            value={supportEmail}
            onChangeText={setSupportEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            marginBottom={0}
          />
        </Card>
      </Content>

      <Footer>
        <Button
          label="Save Changes"
          variant="gold"
          icon="check"
          padding={12}
          fontSize={13}
          onPress={navigation.goBack}
        />
      </Footer>

      <ImageSourceSheet
        visible={pickerOpen}
        onClose={closePicker}
        onCamera={closePicker}
        onGallery={closePicker}
        title="Business Logo"
        subtitle="JPG or PNG · Max 5 MB"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  logoCard: { flexDirection: 'row', alignItems: 'center', gap: s(14) },
  logoTile: {
    width: s(60),
    height: s(60),
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: s(44), height: s(30) },
  fab: {
    position: 'absolute',
    bottom: s(-3),
    right: s(-3),
    width: s(24),
    height: s(24),
    backgroundColor: palette.gold,
    borderWidth: s(2),
    borderColor: palette.white,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBody: { flex: 1 },
  logoTitle: font(12, '800', { color: palette.navy }),
  logoMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(2),
  },

  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },

  gstin: { letterSpacing: s(0.5) },
  pan: { letterSpacing: s(1) },
  cin: { letterSpacing: s(0.5) },

  row: { flexDirection: 'row', gap: s(8) },
  col: { flex: 1, minWidth: 0 },

  pressed: { opacity: 0.8 },
});
