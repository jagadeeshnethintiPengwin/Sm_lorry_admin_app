import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppHeader, Card, Content, Icon, ListState, Screen } from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
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
            </Card>
          );
        })}
      </Content>
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
  contentTop: { paddingTop: s(10) },

  row: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  body: { flex: 1, minWidth: 0 },
  primary: font(12, '800', { color: palette.navy }),
  secondary: font(9, '500', { color: palette.slate500 }),
  meta: font(9, '700', { color: palette.slate400 }),
  value: font(13, '800', { color: palette.navy }),

  unknown: font(11, '600', { color: palette.slate500 }),
});
