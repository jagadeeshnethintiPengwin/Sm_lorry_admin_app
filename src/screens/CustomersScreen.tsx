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
  ListState,
  Screen,
  Select,
} from '@components/index';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { customerService } from '@services/fleet.service';
import type { AdminCustomer } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

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

/**
 * A customer as the API sends it, turned into the row this screen draws.
 *
 * Replaces a literal list under a header that claimed "124 accounts · +8 this
 * month" — numbers no record ever backed, on an account book of five.
 */
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

function toRow(customer: AdminCustomer): CustomerRow {
  const company = String(customer.company ?? 'Customer');
  const user = (customer.user ?? {}) as { name?: string; mobile?: string };
  const contactName = String(customer.contactName ?? user.name ?? '');

  // `_count.bookings` is what the API joins on; a customer with none is new.
  const counts = (customer._count ?? {}) as { bookings?: number };
  const trips = Number(counts.bookings ?? 0);

  const since = customer.since ? new Date(String(customer.since)) : null;
  const sinceYear =
    since && !Number.isNaN(since.getTime()) ? since.getFullYear() : null;

  return {
    id: String(customer.id),
    company,
    contact: [contactName, user.mobile].filter(Boolean).join(' · '),
    trips: [
      `${trips} trip${trips === 1 ? '' : 's'}`,
      sinceYear ? `Since ${sinceYear}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    tripsTone: trips > 0 ? 'gold' : 'muted',
    // "Verified" is the account book's own flag; anyone without a booking yet
    // is genuinely new rather than merely quiet.
    pill: trips > 0 ? 'ACTIVE' : 'NEW',
    initials: initialsOf(company),
    tileBg: trips > 0 ? palette.navyTint : palette.goldTint,
    tileColor: trips > 0 ? palette.navy : palette.gold,
    tripCount: trips,
  };
}

export const CustomersScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');

  const { data, loading, error, refetch } = useApi(
    () => customerService.page({ limit: 100 }),
    [],
  );

  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? rows.filter(
          item =>
            item.company.toLowerCase().includes(term) ||
            item.contact.toLowerCase().includes(term),
        )
      : [...rows];

    if (sort === 'name') {
      return filtered.sort((a, b) => a.company.localeCompare(b.company));
    }
    if (sort === 'trips') {
      return filtered.sort((a, b) => b.tripCount - a.tripCount);
    }
    return filtered;
  }, [query, rows, sort]);

  const total = data?.meta?.total ?? rows.length;
  const active = rows.filter(row => row.tripCount > 0).length;

  const openCustomer = useCallback(
    (id: string) => navigation.navigate('CustomerDetails', { customerId: id }),
    [navigation],
  );

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Customers"
        subtitle={`${total} account${total === 1 ? '' : 's'} · ${active} active`}
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
        <Text style={styles.sortLabel}>ALL CUSTOMERS · {total}</Text>
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
        <ListState
          loading={loading}
          error={error}
          empty={visible.length === 0}
          what="customers"
          emptyIcon="building-2"
          emptyHint={
            query.trim() ? 'Nothing matches that search.' : undefined
          }
          onRetry={refetch}
        />

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
                {/* Real company names run long; they ellipsize rather than
                    reflow the card. */}
                <Text style={styles.company} numberOfLines={1}>
                  {customer.company}
                </Text>
                <Text style={styles.contact} numberOfLines={1}>
                  {customer.contact}
                </Text>

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
