import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  AppHeader,
  BlinkDot,
  Card,
  Content,
  Icon,
  IconWell,
  Screen,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';

/**
 * Screen 24 — Documents.
 *
 *   search · In Transit / Delivered / Incomplete tabs · per-trip groups with a
 *   gold left rail, "n of 5 documents attached" progress rail, and the file
 *   rows on a `#f7f9fc` tray with view + download buttons
 */
type Tab = 'transit' | 'delivered' | 'incomplete';

type DocFile = {
  id: string;
  name: string;
  meta: string;
  icon: IconName;
  bg: string;
  color: string;
};

type TripGroup = {
  id: string;
  reference: string;
  route: string;
  status: string;
  attached: number;
  total: number;
  tab: Tab;
  files: DocFile[];
};

const GROUPS: TripGroup[] = [
  {
    id: 'g1',
    reference: '#TR-2026-8842',
    route: 'Vizag → Hyderabad · Sri Sai Traders',
    status: 'IN TRANSIT',
    attached: 4,
    total: 5,
    tab: 'transit',
    files: [
      {
        id: 'waybill',
        name: 'Waybill.pdf',
        meta: '342 KB · Just now',
        icon: 'file-text',
        bg: palette.navyTint,
        color: palette.navy,
      },
      {
        id: 'eway',
        name: 'E-way Bill.pdf',
        meta: '234 KB · Valid till 21 May',
        icon: 'scroll-text',
        bg: palette.goldTint,
        color: palette.gold,
      },
      {
        id: 'invoice',
        name: 'Invoice.pdf',
        meta: '1.1 MB · 20 May',
        icon: 'receipt',
        bg: palette.navyTint,
        color: palette.navy,
      },
      {
        id: 'lr',
        name: 'LR.pdf',
        meta: '456 KB · 20 May',
        icon: 'file-check',
        bg: palette.goldTint,
        color: palette.gold,
      },
    ],
  },
];

const TABS: Array<[Tab, string, boolean]> = [
  ['transit', 'In Transit', false],
  ['delivered', 'Delivered', false],
  ['incomplete', 'Incomplete 8', true],
];

export const DocumentsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('transit');

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return GROUPS.filter(group => {
      const inTab = group.tab === tab;
      if (!term) {
        return inTab;
      }
      return (
        inTab &&
        (group.reference.toLowerCase().includes(term) ||
          group.route.toLowerCase().includes(term))
      );
    });
  }, [query, tab]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Documents"
        subtitle="Trip-wise archive"
        showBack
        onBackPress={navigation.goBack}
      />

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="search" size={16} color={palette.slate400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by trip ID or route..."
            placeholderTextColor={palette.slate400}
            style={styles.searchInput}
            accessibilityLabel="Search documents"
          />
        </View>
      </View>

      <View style={styles.tabs}>
        {TABS.map(([key, label, gold]) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text
                style={
                  on
                    ? styles.tabTextOn
                    : gold
                    ? styles.tabTextGold
                    : styles.tabText
                }
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Content padding={12} contentStyle={styles.contentTop} safeBottom>
        {visible.map(group => (
          <Card
            key={group.id}
            padding={0}
            clip
            accentColor={palette.gold}
            accentWidth={3}
          >
            <View style={styles.groupHead}>
              <View style={styles.groupTop}>
                <View style={styles.groupTitleBlock}>
                  <Text style={styles.groupRef}>{group.reference}</Text>
                  <Text style={styles.groupRoute}>{group.route}</Text>
                </View>
                <View style={styles.statusChip}>
                  <BlinkDot color={palette.gold} size={5} />
                  <Text style={styles.statusText}>{group.status}</Text>
                </View>
              </View>

              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {group.attached} of {group.total} documents attached
                </Text>
                <View style={styles.track}>
                  <LinearGradient
                    colors={[palette.gold, palette.goldDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.fill,
                      { width: `${(group.attached / group.total) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.tray}>
              {group.files.map(file => (
                <View key={file.id} style={styles.fileRow}>
                  <View style={styles.fileLeft}>
                    <IconWell
                      icon={file.icon}
                      size={26}
                      iconSize={14}
                      backgroundColor={file.bg}
                      color={file.color}
                      borderRadius={radius.md}
                    />
                    <View style={styles.fileBody}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Text style={styles.fileMeta}>{file.meta}</Text>
                    </View>
                  </View>

                  <View style={styles.fileActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${file.name}`}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon name="eye" size={13} color={palette.navy} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Download ${file.name}`}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon name="download" size={13} color={palette.navy} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        ))}
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

  tabs: {
    flexDirection: 'row',
    backgroundColor: palette.navyTint,
    marginTop: s(12),
    marginHorizontal: s(12),
    borderRadius: radius.lg,
    padding: s(3),
    gap: s(2),
  },
  tab: {
    flex: 1,
    paddingVertical: s(6),
    paddingHorizontal: s(4),
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: palette.navy },
  tabText: font(9, '700', { color: palette.slate500 }),
  tabTextGold: font(9, '800', { color: palette.gold }),
  tabTextOn: font(9, '800', { color: palette.white }),

  contentTop: { paddingTop: s(10) },

  groupHead: { padding: s(11), backgroundColor: palette.white },
  groupTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: s(8),
    marginBottom: s(6),
  },
  groupTitleBlock: { flex: 1, minWidth: 0 },
  groupRef: font(11, '800', { color: palette.navy, letterSpacing: 0.3 }),
  groupRoute: {
    ...font(9, '600', { color: palette.slate500 }),
    marginTop: s(1),
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(3),
    paddingHorizontal: s(8),
    backgroundColor: palette.goldTint,
    borderRadius: s(20),
  },
  statusText: font(8, '800', { color: palette.goldText, letterSpacing: 0.5 }),

  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressText: font(9, '800', { color: palette.navy }),
  track: {
    height: s(5),
    flex: 1,
    maxWidth: s(80),
    backgroundColor: palette.border,
    borderRadius: s(5),
    marginLeft: s(8),
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: s(5) },

  tray: {
    backgroundColor: palette.surfaceAlt,
    paddingVertical: s(6),
    paddingHorizontal: s(8),
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(7),
    paddingHorizontal: s(8),
    backgroundColor: palette.white,
    borderRadius: radius.md,
    marginBottom: s(5),
  },
  fileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    flex: 1,
    minWidth: 0,
  },
  fileBody: { flex: 1, minWidth: 0 },
  fileName: font(10, '800', { color: palette.navy }),
  fileMeta: font(8, '400', { color: palette.slate500 }),
  fileActions: { flexDirection: 'row', gap: s(4) },
  iconBtn: {
    width: s(26),
    height: s(26),
    backgroundColor: palette.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: { opacity: 0.75 },
});
