import React, { useCallback, useState } from 'react';
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

/**
 * Screen 8 — Add New Vehicle.
 *
 *   BASIC INFO card (registration, type, capacity + year, make, model) ·
 *   IDENTIFIERS card (chassis, engine) · UPLOAD DOCUMENTS 2×2 tiles where an
 *   uploaded slot turns gold with a check · Assign Driver Now switch row ·
 *   gold Add to Fleet footer
 */
const VEHICLE_TYPES = [
  { label: 'Mini Truck (up to 1 Ton)', value: 'mini' },
  { label: '14 Ft Truck (up to 7 Ton)', value: '14ft' },
  { label: '17 Ft Truck (up to 9 Ton)', value: '17ft' },
  { label: '19 Ft Truck (up to 12 Ton)', value: '19ft' },
  { label: '22 Ft Trailer', value: '22ft' },
  { label: '32 Ft Trailer', value: '32ft' },
  { label: 'Container', value: 'container' },
];

const MAKES = [
  { label: 'Tata Motors', value: 'tata' },
  { label: 'Ashok Leyland', value: 'ashok' },
  { label: 'Eicher', value: 'eicher' },
  { label: 'Bharat Benz', value: 'benz' },
  { label: 'Mahindra', value: 'mahindra' },
  { label: 'Volvo', value: 'volvo' },
];

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
  const [make, setMake] = useState('tata');
  const [model, setModel] = useState('');
  const [chassis, setChassis] = useState('');
  const [engine, setEngine] = useState('');
  const [assignNow, setAssignNow] = useState(false);

  /** The mock ships Insurance already uploaded as `insurance.pdf`. */
  const [uploads, setUploads] = useState<Record<string, string | null>>({
    rc: null,
    insurance: 'insurance.pdf',
    fitness: null,
    puc: null,
  });
  const [target, setTarget] = useState<string | null>(null);

  const closeSheet = useCallback(() => setTarget(null), []);

  /**
   * Registering the truck is only half the job — the RC, insurance, fitness
   * and PUC still have to be filed, so hand straight off to Upload Document
   * rather than dropping back to the list.
   */
  const addToFleet = useCallback(() => {
    navigation.navigate('UploadDocument', {
      ownerLabel: registration.trim() || 'New vehicle',
    });
  }, [navigation, registration]);

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
          />

          <Select
            label="Vehicle Type"
            required
            options={VEHICLE_TYPES}
            value={type}
            onChange={setType}
            placeholder="Select vehicle type"
            marginBottom={10}
          />

          <View style={styles.row}>
            <View style={styles.col}>
              <Input
                label="Capacity (Ton)"
                value={capacity}
                onChangeText={setCapacity}
                placeholder="7"
                keyboardType="decimal-pad"
                marginBottom={10}
              />
            </View>
            <View style={styles.col}>
              <Input
                label="Year"
                value={year}
                onChangeText={setYear}
                placeholder="2022"
                keyboardType="number-pad"
                maxLength={4}
                marginBottom={10}
              />
            </View>
          </View>

          <Select
            label="Make / Manufacturer"
            options={MAKES}
            value={make}
            onChange={setMake}
            marginBottom={10}
          />

          <Input
            label="Model"
            value={model}
            onChangeText={setModel}
            placeholder="e.g. LPT 1109"
            marginBottom={0}
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
      </Content>

      <Footer>
        <Button
          label="Add to Fleet"
          variant="gold"
          icon="check-circle-2"
          padding={12}
          fontSize={13}
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
  assignBody: { flex: 1 },
  assignTitle: font(11, '800', { color: palette.navy }),
  assignMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },

  pressed: { opacity: 0.8 },
});
