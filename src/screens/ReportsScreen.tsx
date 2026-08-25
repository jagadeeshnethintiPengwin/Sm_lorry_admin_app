import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader, Card, Content, Icon, ListState, Screen } from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { reportService } from '@services/report.service';
import { useApi } from '@hooks/useApi';
import { REPORT_DEFS, rupee } from './reportDefs';

/**
 * Reports hub — the financial-year summary the owner reads first, then the
 * report catalogue (Trip, Invoice, Vehicle, Driver, Customer). Brings the web
 * admin's Reports section to the app; each card opens its rows in ReportView.
 */
export const ReportsScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { data, loading, error, refetch } = useApi(
    () => reportService.financialYear(),
    [],
  );

  const kpis = data?.kpis;
  const openReport = useCallback(
    (kind: string, title: string) =>
      navigation.navigate('ReportView', { kind, title }),
    [navigation],
  );

  const stats: Array<{ label: string; value: string; color: string }> = [
    { label: 'REVENUE', value: rupee(kpis?.totalRevenue ?? 0), color: palette.navy },
    { label: 'EXPENSES', value: rupee(kpis?.totalExpenses ?? 0), color: palette.gold },
    {
      label: 'NET PROFIT',
      value: rupee(kpis?.netProfit ?? 0),
      color: (kpis?.netProfit ?? 0) >= 0 ? '#16a34a' : palette.red,
    },
    {
      label: 'TRIPS DONE',
      value: String(kpis?.tripsCompleted ?? 0),
      color: palette.navy,
    },
  ];

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Reports"
        subtitle={data?.fy?.label ?? 'Financial year'}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={12} safeBottom>
        <ListState
          loading={loading && !data}
          error={error}
          empty={false}
          what="reports"
          onRetry={refetch}
        />

        {/* Financial-year summary */}
        <Card padding={13}>
          <View style={styles.cardHead}>
            <Icon name="layout-dashboard" size={13} color={palette.red} />
            <Text style={styles.cardKicker}>
              {data?.fy?.label ?? 'FINANCIAL YEAR'}
            </Text>
          </View>
          <View style={styles.kpiGrid}>
            {stats.map(stat => (
              <View key={stat.label} style={styles.kpiCell}>
                <Text style={[styles.kpiValue, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={styles.kpiLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          {kpis ? (
            <Text style={styles.kpiFoot}>
              {kpis.totalTrips} trips · {kpis.bookings} bookings ·{' '}
              {kpis.activeCustomers} active customers · {kpis.marginPct}% margin
            </Text>
          ) : null}
        </Card>

        <Text style={styles.sectionLabel}>REPORTS</Text>

        {REPORT_DEFS.map(def => (
          <Card
            key={def.kind}
            padding={12}
            onPress={() => openReport(def.kind, def.title)}
            accessibilityLabel={def.title}
          >
            <View style={styles.reportRow}>
              <View style={styles.reportIcon}>
                <Icon name={def.icon} size={18} color={palette.navy} />
              </View>
              <View style={styles.reportBody}>
                <Text style={styles.reportTitle} numberOfLines={1}>
                  {def.title}
                </Text>
                <Text style={styles.reportBlurb} numberOfLines={2}>
                  {def.blurb}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={palette.slate400} />
            </View>
          </Card>
        ))}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  cardKicker: font(9, '800', { color: palette.red, letterSpacing: 1 }),

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: s(10),
  },
  kpiCell: { width: '50%', paddingVertical: s(6) },
  kpiValue: font(17, '800'),
  kpiLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.8 }),
  kpiFoot: {
    marginTop: s(8),
    paddingTop: s(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    ...font(9, '700', { color: palette.slate500 }),
  },

  sectionLabel: {
    marginTop: s(14),
    marginBottom: s(8),
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
  },

  reportRow: { flexDirection: 'row', alignItems: 'center', gap: s(11) },
  reportIcon: {
    width: s(38),
    height: s(38),
    borderRadius: radius.lg,
    backgroundColor: palette.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBody: { flex: 1, minWidth: 0 },
  reportTitle: font(12, '800', { color: palette.navy }),
  reportBlurb: font(9, '500', { color: palette.slate500 }),
});
