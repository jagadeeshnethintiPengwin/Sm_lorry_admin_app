import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  vehicleRequestService,
  type AdminVehicleRequest,
} from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

import {
  AppHeader,
  Card,
  Content,
  Icon,
  ListState,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';

/**
 * Vehicle Requests — the customer app's "Request a Vehicle" queue.
 *
 * A customer files one of these when the lorry they need is not in the
 * catalogue. The web panel has answered them since the queue existed; this app
 * could not see them at all, so an operator away from a desk had no idea a
 * customer was waiting.
 *
 * The buckets mirror the panel's, and for the same reason: OPEN is work to do,
 * QUOTED is waiting on the customer, and the rest are history worth reading but
 * not acting on.
 */

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'OPEN', label: 'Open' },
  { key: 'QUOTED', label: 'Quoted' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: '', label: 'All' },
];

/** `21 Sep, 5:30 PM` — the app's stamp for a moment in time. */
function stamp(iso?: string | null): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
}

const TONE: Record<string, { bg: string; fg: string }> = {
  OPEN: { bg: '#fef3c7', fg: '#92400e' },
  QUOTED: { bg: '#e0e7ff', fg: '#3730a3' },
  CONFIRMED: { bg: '#dcfce7', fg: '#166534' },
  CLOSED: { bg: '#f1f5f9', fg: '#475569' },
  CANCELLED: { bg: '#fee2e2', fg: '#991b1b' },
};

export const VehicleRequestsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = useState('OPEN');

  const { data, loading, error, refetch } = useApi(
    () => vehicleRequestService.list(filter || undefined),
    [filter],
  );
  const rows: AdminVehicleRequest[] = data?.items ?? [];

  return (
    <Screen>
      <AppHeader title="Vehicle Requests" subtitle="Customer asks for a lorry" />
      <Content>
        <View style={styles.filters}>
          {FILTERS.map(f => {
            const on = f.key === filter;
            return (
              <Pressable
                key={f.key || 'all'}
                onPress={() => setFilter(f.key)}
                style={[styles.filter, on && styles.filterOn]}
              >
                <Text style={[styles.filterText, on && styles.filterTextOn]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && rows.length === 0}
          what="vehicle requests"
          emptyIcon="package-search"
          emptyHint="Requests a customer files from their app land here."
          onRetry={refetch}
        />

        {rows.map(r => {
          const tone = TONE[r.status] ?? TONE.CLOSED;
          return (
            <Pressable
              key={r.id}
              onPress={() =>
                navigation.navigate('VehicleRequestDetails', { requestId: r.id })
              }
            >
              <Card style={styles.card}>
                <View style={styles.top}>
                  <Text style={styles.company} numberOfLines={1}>
                    {r.company ?? r.contactName ?? 'Customer'}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.pillText, { color: tone.fg }]}>
                      {r.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Icon name="truck" size={13} color={palette.slate500} />
                  <Text style={styles.rowText} numberOfLines={1}>
                    {r.vehicleType}
                    {r.material ? ` · ${r.material}` : ''}
                    {r.weightTons != null ? ` · ${r.weightTons} Ton` : ''}
                  </Text>
                </View>

                <View style={styles.row}>
                  <Icon name="map-pin" size={13} color={palette.slate500} />
                  <Text style={styles.rowText} numberOfLines={2}>
                    {r.pickupPlace} → {r.dropPlace}
                  </Text>
                </View>

                <View style={styles.foot}>
                  <Text style={styles.footText}>
                    {r.neededAt ? `Needed ${stamp(r.neededAt)}` : `Raised ${stamp(r.createdAt)}`}
                  </Text>
                  <View style={styles.view}>
                    <Text style={styles.viewText}>View details</Text>
                    <Icon name="chevron-right" size={13} color={palette.navy} />
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', marginBottom: s(10) },
  filter: {
    paddingHorizontal: s(12),
    paddingVertical: s(6),
    borderRadius: radius.pill,
    backgroundColor: '#f1f5f9',
    marginRight: s(6),
  },
  filterOn: { backgroundColor: palette.navy },
  filterText: font(10, '800', { color: palette.slate500 }),
  filterTextOn: { color: palette.white },
  card: { marginBottom: s(10) },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(6),
  },
  company: { flex: 1, ...font(12, '800', { color: palette.navy }) },
  pill: { paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: radius.pill },
  pillText: font(9, '800'),
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: s(3) },
  rowText: {
    flex: 1,
    marginLeft: s(6),
    ...font(11, '600', { color: palette.navy }),
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: s(8),
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: s(7),
  },
  footText: font(9, '700', { color: palette.slate500 }),
  view: { flexDirection: 'row', alignItems: 'center' },
  viewText: {
    marginRight: s(2),
    ...font(9, '800', { color: palette.navy }),
  },
});
