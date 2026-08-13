import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import {
  documentService,
  type AdminDocument,
} from '@services/fleet.service';
import { useApi } from '@hooks/useApi';
import { openExternalUrl } from '@utils/openExternalUrl';

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
  hasFile: boolean;
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

/** How each kind of paperwork is drawn. Keyed by the API's `kind`. */
const DOC_STYLE: Record<string, { icon: IconName; bg: string; color: string }> = {
  WAYBILL: { icon: 'file-text', bg: palette.navyTint, color: palette.navy },
  EWAY: { icon: 'scroll-text', bg: palette.goldTint, color: palette.gold },
  INVOICE: { icon: 'receipt', bg: palette.navyTint, color: palette.navy },
  LR: { icon: 'file-check', bg: palette.goldTint, color: palette.gold },
  POD: { icon: 'package-check', bg: palette.redTint, color: palette.red },
  OTHER: { icon: 'file-text', bg: palette.navyTint, color: palette.navy },
};

/** `2004170` -> `2.0 MB`. The API stores bytes; nobody reads bytes. */
function formatSize(bytes: number): string {
  if (!bytes) {
    return 'Unknown size';
  }
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `2026-08-13T06:26:00Z` -> `13 Aug`. */
function formatDay(iso?: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * The archive, grouped by the shipment each document belongs to.
 *
 * `GROUPS` was three invented trips carrying eleven invented files — the same
 * "Waybill.pdf · 342 KB · Just now" shown to every office — while
 * `/documents` served the real archive the whole time. Documents filed
 * against nothing in particular are collected under one heading rather than
 * dropped, because an unattached scan is exactly the one somebody needs to
 * find and re-file.
 */
function toGroups(documents: AdminDocument[]): TripGroup[] {
  const byRef = new Map<string, TripGroup>();

  for (const doc of documents) {
    const trip = (doc.trip as { reference?: string } | null)?.reference;
    const booking = (doc.booking as { reference?: string } | null)?.reference;
    const reference = trip ?? booking ?? null;
    const key = reference ?? '__unfiled__';

    let group = byRef.get(key);
    if (!group) {
      group = {
        id: key,
        reference: reference ? `#${reference}` : 'Not filed against a trip',
        route: reference
          ? trip
            ? 'Trip paperwork'
            : 'Booking paperwork'
          : 'Uploaded without a trip or booking',
        status: trip ? 'TRIP' : booking ? 'BOOKING' : 'UNFILED',
        attached: 0,
        total: 0,
        tab: trip ? 'transit' : booking ? 'delivered' : 'incomplete',
        files: [],
      };
      byRef.set(key, group);
    }

    const kind = String(doc.kind ?? 'OTHER');
    const style = DOC_STYLE[kind] ?? DOC_STYLE.OTHER;
    group.files.push({
      id: String(doc.id),
      name: String(doc.name ?? kind),
      meta: [formatSize(Number(doc.sizeBytes ?? 0)), formatDay(String(doc.createdAt ?? ''))]
        .filter(Boolean)
        .join(' · '),
      icon: style.icon,
      bg: style.bg,
      color: style.color,
      /* A row with no stored file cannot be opened — say so on the row. */
      hasFile: Boolean(doc.fileUrl),
    });
  }

  for (const group of byRef.values()) {
    group.attached = group.files.filter(f => f.hasFile).length;
    group.total = group.files.length;
  }

  return [...byRef.values()];
}

const TABS: Array<[Tab, string, boolean]> = [
  ['transit', 'In Transit', false],
  ['delivered', 'Delivered', false],
  ['incomplete', 'Incomplete 8', true],
];

export const DocumentsScreen: React.FC = () => {
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('transit');

  /* The real archive. Re-read on focus so a fresh upload shows up. */
  const archive = useApi(() => documentService.list({ limit: 100 }), []);
  const groups = useMemo(
    () => toGroups(archive.data ?? []),
    [archive.data],
  );

  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  /**
   * Opens one, through a signed link.
   *
   * Both buttons on every row were `Pressable`s with no `onPress` — they
   * rendered, they pressed, and nothing happened, on a screen whose entire
   * purpose is getting at the paperwork.
   */
  const viewDocument = useCallback(async (id: string) => {
    setOpeningDoc(id);
    try {
      await openExternalUrl(await documentService.downloadUrl(id));
    } catch (failure) {
      Alert.alert(
        'Could not open it',
        failure instanceof Error
          ? failure.message
          : 'That document is not available.',
      );
    } finally {
      setOpeningDoc(null);
    }
  }, []);

  /**
   * Hands the link to the system share sheet.
   *
   * Distinct from viewing on purpose: the two buttons used to be
   * indistinguishable because neither did anything. Sharing is what "download"
   * means on a phone — the sheet offers Save to Files, mail, WhatsApp — and it
   * needs no extra library to do it.
   */
  const shareDocument = useCallback(async (id: string, name: string) => {
    setOpeningDoc(id);
    try {
      const url = await documentService.downloadUrl(id);
      await Share.share({ url, message: `${name}\n${url}` });
    } catch (failure) {
      Alert.alert(
        'Could not share it',
        failure instanceof Error
          ? failure.message
          : 'That document is not available.',
      );
    } finally {
      setOpeningDoc(null);
    }
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return groups.filter(group => {
      const inTab = group.tab === tab;
      if (!term) {
        return inTab;
      }
      return (
        inTab &&
        (group.reference.toLowerCase().includes(term) ||
          group.route.toLowerCase().includes(term) ||
          // Searching by file name matters more here than by trip: an
          // operator hunting "e-way" does not know which trip it was on.
          group.files.some(file => file.name.toLowerCase().includes(term)))
      );
    });
  }, [groups, query, tab]);

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
                    {/*
                      Dimmed rather than hidden when there is no stored file:
                      the row is still a record that the paperwork is expected,
                      and an operator needs to see that it is missing.
                    */}
                    <Pressable
                      onPress={() => viewDocument(file.id)}
                      disabled={!file.hasFile || openingDoc !== null}
                      accessibilityRole="button"
                      accessibilityLabel={
                        file.hasFile
                          ? `View ${file.name}`
                          : `${file.name} — no file stored`
                      }
                      accessibilityState={{
                        disabled: !file.hasFile,
                        busy: openingDoc === file.id,
                      }}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        !file.hasFile && styles.iconBtnDisabled,
                        pressed && file.hasFile && styles.pressed,
                      ]}
                    >
                      {openingDoc === file.id ? (
                        <ActivityIndicator size="small" color={palette.navy} />
                      ) : (
                        <Icon
                          name="eye"
                          size={13}
                          color={file.hasFile ? palette.navy : palette.slate400}
                        />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => shareDocument(file.id, file.name)}
                      disabled={!file.hasFile || openingDoc !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Share ${file.name}`}
                      accessibilityState={{ disabled: !file.hasFile }}
                      style={({ pressed }) => [
                        styles.iconBtn,
                        !file.hasFile && styles.iconBtnDisabled,
                        pressed && file.hasFile && styles.pressed,
                      ]}
                    >
                      <Icon
                        name="download"
                        size={13}
                        color={file.hasFile ? palette.navy : palette.slate400}
                      />
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
  iconBtnDisabled: { opacity: 0.45 },
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
