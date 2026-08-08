import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Card,
  Content,
  Icon,
  Screen,
  Select,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 13 — Customers List.
 *
 *   search · "ALL CUSTOMERS · 124" + Sort select · account cards with an
 *   initials tile, contact line, trip count and ACTIVE / NEW pill · gold FAB
 */
const SORTS = [
  { label: 'Sort: Recent', value: 'recent' },
  { label: 'By Name', value: 'name' },
  { label: 'By Trips', value: 'trips' },
];

type CustomerRow = {
  id: string;
  company: string;
  contact: string;
  trips: string;
  tripsTone: 'gold' | 'muted';
  pill: 'ACTIVE' | 'NEW';
  initials: string;
  tileBg: string;
  tileColor: string;
  tripCount: number;
};

const CUSTOMERS: CustomerRow[] = [
  {
    id: 'c1',
    company: 'Sri Sai Traders',
    contact: 'Rajesh Kumar · +91 98765 43210',
    trips: '28 trips · Since 2024',
    tripsTone: 'gold',
    pill: 'ACTIVE',
    initials: 'SS',
    tileBg: palette.navyTint,
    tileColor: palette.navy,
    tripCount: 28,
  },
  {
    id: 'c2',
    company: 'Krishna Industries',
    contact: 'Suresh M · +91 90140 22883',
    trips: '42 trips · Since 2023',
    tripsTone: 'gold',
    pill: 'ACTIVE',
    initials: 'KI',
    tileBg: palette.goldTint,
    tileColor: palette.gold,
    tripCount: 42,
  },
  {
    id: 'c3',
    company: 'Anand Logistics',
    contact: 'Anand P · +91 99880 12233',
    trips: '15 trips · Since 2025',
    tripsTone: 'gold',
    pill: 'ACTIVE',
    initials: 'AL',
    tileBg: palette.redTint,
    tileColor: palette.red,
    tripCount: 15,
  },
  {
    id: 'c4',
    company: 'Vardhan Enterprises',
    contact: 'Vardhan R · +91 87651 44322',
    trips: '62 trips · Since 2022',
    tripsTone: 'gold',
    pill: 'ACTIVE',
    initials: 'VE',
    tileBg: palette.navyTint,
    tileColor: palette.navy,
    tripCount: 62,
  },
  {
    id: 'c5',
    company: 'Ganga Traders',
    contact: 'Ganga R · +91 88767 22988',
    trips: '3 trips · Since 2026',
    tripsTone: 'muted',
    pill: 'NEW',
    initials: 'GT',
    tileBg: palette.redTint,
    tileColor: palette.red,
    tripCount: 3,
  },
];

export const CustomersScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? CUSTOMERS.filter(
          item =>
            item.company.toLowerCase().includes(term) ||
            item.contact.toLowerCase().includes(term),
        )
      : [...CUSTOMERS];

    if (sort === 'name') {
      return filtered.sort((a, b) => a.company.localeCompare(b.company));
    }
    if (sort === 'trips') {
      return filtered.sort((a, b) => b.tripCount - a.tripCount);
    }
    return filtered;
  }, [query, sort]);

  const openCustomer = useCallback(
    (id: string) => navigation.navigate('CustomerDetails', { customerId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Customers"
        subtitle="124 accounts · +8 this month"
        showBack
        onBackPress={navigation.goBack}
      />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={palette.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search company, contact..."
            placeholderTextColor={palette.slate400}
            style={styles.searchInput}
            accessibilityLabel="Search customers"
          />
        </View>
      </View>

      {/* Sort strip */}
      <View style={styles.sortStrip}>
        <Text style={styles.sortLabel}>ALL CUSTOMERS · 124</Text>
        <Select
          options={SORTS}
          value={sort}
          onChange={setSort}
          marginBottom={0}
          containerStyle={styles.sortSelect}
          style={styles.sortControl}
        />
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {visible.map(customer => (
          <Card
            key={customer.id}
            padding={11}
            onPress={() => openCustomer(customer.id)}
            accessibilityLabel={`${customer.company}, ${customer.trips}`}
          >
            <View style={styles.row}>
              <View style={[styles.tile, { backgroundColor: customer.tileBg }]}>
                <Text style={[styles.tileText, { color: customer.tileColor }]}>
                  {customer.initials}
                </Text>
              </View>

              <View style={styles.body}>
                <Text style={styles.company}>{customer.company}</Text>
                <Text style={styles.contact}>{customer.contact}</Text>

                <View style={styles.footer}>
                  <Text
                    style={
                      customer.tripsTone === 'gold'
                        ? styles.tripsGold
                        : styles.tripsMuted
                    }
                  >
                    {customer.trips}
                  </Text>
                  <View
                    style={
                      customer.pill === 'ACTIVE' ? styles.pillGold : styles.pillNew
                    }
                  >
                    <Text style={styles.pillText}>{customer.pill}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        ))}
      </Content>

      <Pressable
        onPress={() => navigation.navigate('AddCustomer')}
        accessibilityRole="button"
        accessibilityLabel="Add customer"
        style={({ pressed }) => [styles.fabWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={gradients.gold as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Icon name="plus" size={22} color={palette.navy} />
        </LinearGradient>
      </Pressable>
    </Screen>
  );
};

const styles = StyleSheet.create({
  searchWrap: {
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    backgroundColor: palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(9),
    paddingHorizontal: s(11),
    backgroundColor: palette.screenBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.lg,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    ...font(11, '600', { color: palette.navy }),
  },

  sortStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: s(10),
    paddingHorizontal: s(12),
  },
  sortLabel: font(9, '800', { color: palette.red, letterSpacing: 1 }),
  sortSelect: { width: s(104) },
  sortControl: {
    paddingVertical: s(4),
    paddingHorizontal: s(8),
    borderRadius: radius.sm,
  },

  contentTop: { paddingTop: s(10) },

  row: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  tile: {
    width: s(38),
    height: s(38),
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: font(12, '800'),
  body: { flex: 1, minWidth: 0 },
  company: font(12, '800', { color: palette.navy }),
  contact: font(9, '400', { color: palette.slate500 }),
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(4),
  },
  tripsGold: font(9, '800', { color: palette.gold }),
  tripsMuted: font(9, '800', { color: palette.slate500 }),
  pillGold: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillNew: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldTint,
    borderRadius: radius.sm,
  },
  pillText: font(8, '800', { color: palette.goldText }),

  fabWrap: { position: 'absolute', bottom: s(20), right: s(20) },
  fab: {
    width: s(54),
    height: s(54),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.vehicleSelected,
  },

  pressed: { opacity: 0.8 },
});
