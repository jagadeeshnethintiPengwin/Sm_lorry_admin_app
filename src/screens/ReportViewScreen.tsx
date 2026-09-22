import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Footer,
  Icon,
  ListState,
  Screen,
} from '@components/index';
import {
  exportReportTableExcel,
  exportReportTablePdf,
  exportTripDocumentByRef,
} from '@services/tripReport.service';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { reportService, type ReportRow } from '@services/report.service';
import { useApi } from '@hooks/useApi';
import { reportDefByKind } from './reportDefs';

/**
 * One report's rows, as a searchable card list. The row shape varies by kind,
 * so the drawing is delegated to the report's definition (`reportDefs`), which
 * is the same catalogue the hub lists — headline, context, a trailing tag and
 * the money the row turns on.
 */
export const ReportViewScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ReportView'>>();
  const def = reportDefByKind(params.kind);

  const [query, setQuery] = useState('');
  const { data, loading, error, refetch } = useApi(
    () => reportService.table(params.kind),
    [params.kind],
  );

  /** Which download is running — one at a time, and the button says which. */
  const [busy, setBusy] = useState<string | null>(null);

  const rows: ReportRow[] = useMemo(() => data ?? [], [data]);
  const visible = useMemo(() => {
    if (!def) {
      return [];
    }
    const term = query.trim().toLowerCase();
    return term
      ? rows.filter(r => def.search(r).toLowerCase().includes(term))
      : rows;
  }, [rows, query, def]);

  /**
   * The table on screen, as a file.
   *
   * What was searched for is what is exported — the rows the operator is
   * looking at, not the unfiltered read behind them, which is the same promise
   * the panel's Export makes.
   */
  const exportTable = useCallback(
    async (format: 'excel' | 'pdf') => {
      if (!def || visible.length === 0) {
        return;
      }
      setBusy(format);
      try {
        const table = { headers: def.headers, rows: visible.map(def.row) };
        const fileBase = `SMT-${def.kind}-report`;
        if (format === 'excel') {
          await exportReportTableExcel(fileBase, def.title, table);
        } else {
          await exportReportTablePdf(fileBase, def.title, table);
        }
      } catch (failure) {
        Alert.alert(
          'Could not create the file',
          failure instanceof Error
            ? failure.message
            : 'The report could not be exported.',
        );
      } finally {
        setBusy(null);
      }
    },
    [def, visible],
  );

  /**
   * The full document behind one row — the trip's own report, or its invoice.
   *
   * The row holds a reference, so the trip is read back in full first; the
   * paper produced is byte for byte the one the trip screen makes.
   */
  const exportRow = useCallback(
    async (reference: string, kind: 'pdf' | 'invoice') => {
      setBusy(`${reference}:${kind}`);
      try {
        await exportTripDocumentByRef(reference, kind);
      } catch (failure) {
        Alert.alert(
          'Could not create the document',
          failure instanceof Error
            ? failure.message
            : 'That document could not be built.',
        );
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  if (!def) {
    return (
      <Screen backgroundColor={palette.white}>
        <AppHeader title={params.title} showBack onBackPress={navigation.goBack} />
        <Content padding={12}>
          <Text style={styles.unknown}>That report is not available.</Text>
        </Content>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title={def.title}
        subtitle={`${rows.length} row${rows.length === 1 ? '' : 's'}`}
        showBack
        onBackPress={navigation.goBack}
      />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="package-search" size={16} color={palette.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${def.title.toLowerCase()}...`}
            placeholderTextColor={palette.slate400}
            style={styles.searchInput}
            accessibilityLabel={`Search ${def.title}`}
          />
        </View>
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        <ListState
          loading={loading}
          error={error}
          empty={visible.length === 0}
          what="rows"
          emptyIcon="file-text"
          emptyHint={query.trim() ? 'Nothing matches that search.' : undefined}
          onRetry={refetch}
        />

        {visible.map((row, i) => {
          const meta = def.meta(row);
          const value = def.value ? def.value(row) : null;
          // Only a row that *is* a trip can produce a trip's paperwork.
          const reference = def.tripRef?.(row) ?? '';
          return (
            <Card key={i} padding={11}>
              <View style={styles.row}>
                <View style={styles.body}>
                  <Text style={styles.primary} numberOfLines={1}>
                    {def.primary(row)}
                  </Text>
                  <Text style={styles.secondary} numberOfLines={1}>
                    {def.secondary(row)}
                  </Text>
                  {meta && meta !== '—' ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {meta}
                    </Text>
                  ) : null}
                </View>
                {value ? <Text style={styles.value}>{value}</Text> : null}
              </View>

              {/* The papers for this one trip, as the panel's table offers
                  them beside each row. */}
              {reference ? (
                <View style={styles.rowActions}>
                  <RowAction
                    icon="file-text"
                    label="Report PDF"
                    busy={busy === `${reference}:pdf`}
                    disabled={busy !== null}
                    onPress={() => exportRow(reference, 'pdf')}
                  />
                  <RowAction
                    icon="receipt"
                    label="Invoice"
                    busy={busy === `${reference}:invoice`}
                    disabled={busy !== null}
                    onPress={() => exportRow(reference, 'invoice')}
                  />
                </View>
              ) : null}
            </Card>
          );
        })}
      </Content>

      {/* The whole table, filed. Excel is what the panel writes; the PDF is
          for the phone, which mostly cannot open a workbook. */}
      {visible.length > 0 ? (
        <Footer row gap={8}>
          <Button
            label="Excel"
            variant="outline"
            icon="download"
            iconSize={14}
            flex={1}
            padding={11}
            fontSize={11}
            gap={6}
            borderColor={palette.border}
            loading={busy === 'excel'}
            disabled={busy !== null}
            onPress={() => exportTable('excel')}
          />
          <Button
            label="PDF"
            variant="gold"
            icon="file-text"
            iconSize={14}
            flex={1}
            padding={11}
            fontSize={11}
            gap={6}
            loading={busy === 'pdf'}
            disabled={busy !== null}
            onPress={() => exportTable('pdf')}
          />
        </Footer>
      ) : null}
    </Screen>
  );
};

/** One small pill under a report row — the paper it can produce. */
const RowAction: React.FC<{
  icon: IconName;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}> = ({ icon, label, busy, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.rowAction,
      (pressed || busy) && styles.rowActionOn,
      disabled && !busy && styles.rowActionOff,
    ]}
    accessibilityRole="button"
    accessibilityLabel={`Download ${label}`}
  >
    <Icon name={icon} size={11} color={palette.navy} />
    <Text style={styles.rowActionText}>{busy ? 'Building…' : label}</Text>
  </Pressable>
);

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
  contentTop: { paddingTop: s(10) },

  row: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  body: { flex: 1, minWidth: 0 },
  primary: font(12, '800', { color: palette.navy }),
  secondary: font(9, '500', { color: palette.slate500 }),
  meta: font(9, '700', { color: palette.slate400 }),
  value: font(13, '800', { color: palette.navy }),

  rowActions: {
    flexDirection: 'row',
    gap: s(6),
    marginTop: s(9),
    paddingTop: s(9),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.gray200,
    backgroundColor: palette.surfaceAlt,
  },
  rowActionOn: { backgroundColor: palette.navyTint },
  rowActionOff: { opacity: 0.45 },
  rowActionText: font(9, '800', { color: palette.navy }),

  unknown: font(11, '600', { color: palette.slate500 }),
});
