import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  Content,
  Icon,
  IconWell,
  RadialGlow,
  Screen,
  TwinkleDot,
} from '@components/index';
import { useTopInset } from '@hooks/useTopInset';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';

/**
 * Screen 25 — Menu / More.
 *
 *   navy owner hero (gold ring avatar, FLEET OWNER crown chip, gold + red
 *   blooms) · business stats overlapping by -24px · MANAGEMENT rows ·
 *   ACCOUNT & SETTINGS rows (Security carries a 2FA pill) · red Logout ·
 *   version chip
 */
type MenuRow = {
  id: string;
  title: string;
  meta: string;
  icon: IconName;
  bg: string;
  color: string;
  pill?: string;
  go: () => void;
};

export const MenuScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const topInset = useTopInset();

  const management: MenuRow[] = [
    {
      id: 'vehicles',
      title: 'Vehicles',
      meta: '42 fleet · 14 available',
      icon: 'truck',
      bg: palette.navyTint,
      color: palette.navy,
      go: () => navigation.navigate('Tabs', { screen: 'Vehicles' }),
    },
    {
      id: 'drivers',
      title: 'Drivers',
      meta: '38 drivers · 32 online',
      icon: 'user-cog',
      bg: palette.goldTint,
      color: palette.gold,
      go: () => navigation.navigate('Tabs', { screen: 'Drivers' }),
    },
    {
      id: 'customers',
      title: 'Customers',
      meta: '124 accounts · +8 mo',
      icon: 'users',
      bg: palette.redTint,
      color: palette.red,
      go: () => navigation.navigate('Customers'),
    },
    {
      // Section 07 — Trip Management. The mock's menu omits it, but every
      // other management section has a first-class entry here and trips were
      // otherwise only reachable through "See all" links on the dashboard.
      id: 'trips',
      title: 'Trips',
      meta: '18 in transit · 1,302 total',
      // The admin icon set has no `route`; `navigation` is the closest match
      // and is already the app's tracking glyph.
      icon: 'navigation',
      bg: palette.goldTint,
      color: palette.gold,
      go: () => navigation.navigate('Trips'),
    },
    {
      id: 'documents',
      title: 'Documents',
      meta: '4,322 files · 32 GB',
      icon: 'folder-archive',
      bg: palette.navyTint,
      color: palette.navy,
      go: () => navigation.navigate('Documents'),
    },
  ];

  const account: MenuRow[] = [
    {
      id: 'business',
      title: 'Business Details',
      meta: 'Company info · GSTIN',
      icon: 'building-2',
      bg: palette.navyTint,
      color: palette.navy,
      go: () => navigation.navigate('BusinessDetails'),
    },
    {
      id: 'security',
      title: 'Security & PIN',
      meta: '2FA enabled',
      icon: 'shield',
      bg: palette.navyTint,
      color: palette.navy,
      pill: '2FA',
      go: () => undefined,
    },
    {
      id: 'support',
      title: 'Support & Help',
      meta: 'Priority · Owner desk',
      icon: 'headphones',
      bg: palette.goldTint,
      color: palette.gold,
      go: () => undefined,
    },
  ];

  const logout = useCallback(
    () => navigation.navigate('LogoutConfirm'),
    [navigation],
  );

  const renderGroup = (rows: MenuRow[]) => (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Pressable
          key={row.id}
          onPress={row.go}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.meta}`}
          style={({ pressed }) => [
            styles.row,
            index < rows.length - 1 && styles.rowDivide,
            pressed && styles.pressed,
          ]}
        >
          <IconWell
            icon={row.icon}
            size={26}
            iconSize={14}
            backgroundColor={row.bg}
            color={row.color}
            borderRadius={radius.md}
          />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowMeta}>{row.meta}</Text>
          </View>

          {row.pill ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{row.pill}</Text>
            </View>
          ) : (
            <Icon name="chevron-right" size={16} color={palette.slate400} />
          )}
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen backgroundColor={palette.white}>
      {/*
       * No header bar.
       *
       * Menu is a tab root, so the back chevron had nothing to pop — it called
       * `goBack` on a stack with one screen in it — and the title only repeated
       * the tab that had just been pressed. Both gone, which gives the owner
       * card the top of the screen.
       *
       * `Screen` does not inset the top, so the hero now carries the status-bar
       * inset itself; without it the gradient would run under the clock.
       */}
      <Content padding={0} safeBottom>
        {/* Owner profile hero */}
        <LinearGradient
          colors={[palette.navy, palette.navyMid, palette.navyDark]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topInset + s(12) }]}
        >
          <RadialGlow
            size={140}
            color={palette.gold}
            opacity={0.28}
            top={-40}
            right={-40}
          />
          <RadialGlow
            size={130}
            color={palette.red}
            opacity={0.22}
            bottom={-40}
            left={-30}
          />
          <TwinkleDot size={4} color={palette.gold} style={styles.heroTwinkle} />

          <View style={styles.heroRow}>
            <View style={styles.avatarWrap}>
              <LinearGradient
                colors={gradients.gold as unknown as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>AD</Text>
              </View>
            </View>

            <View style={styles.heroBody}>
              <Text style={styles.heroName}>Admin (Owner)</Text>
              <Text style={styles.heroPhone}>+91 98980 XXXXX</Text>
              <View style={styles.crownChip}>
                <Icon name="crown" size={10} color={palette.navy} />
                <Text style={styles.crownText}>FLEET OWNER</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Business stats overlap */}
        <View style={styles.statsWrap}>
          <View style={styles.statsCard}>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue}>42</Text>
              <Text style={styles.statLabel}>VEHICLES</Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue}>38</Text>
              <Text style={styles.statLabel}>DRIVERS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>124</Text>
              <Text style={styles.statLabel}>CUSTOMERS</Text>
            </View>
          </View>
        </View>

        {/* Management */}
        <View style={styles.block}>
          <Text style={styles.section}>MANAGEMENT</Text>
          {renderGroup(management)}
        </View>

        {/* Account */}
        <View style={styles.block}>
          <Text style={styles.section}>ACCOUNT &amp; SETTINGS</Text>
          {renderGroup(account)}
        </View>

        {/* Logout */}
        <View style={styles.block}>
          <Pressable
            onPress={logout}
            accessibilityRole="button"
            accessibilityLabel="Logout"
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          >
            <Icon name="log-out" size={16} color={palette.red} />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

        {/* Version */}
        <View style={styles.version}>
          <View style={styles.versionChip}>
            <Image
              source={require('@assets/images/logo.png')}
              style={styles.versionLogo}
              resizeMode="contain"
              accessibilityLabel="SMT"
            />
            <Text style={styles.versionText}>Admin App v1.0.0</Text>
          </View>
          <Text style={styles.copyright}>
            SMT SIMHADRI TRANSPORT © 2026
          </Text>
        </View>
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  //  is applied inline — it carries the status-bar inset now that
  // the gradient runs to the top of the screen.
  // `paddingTop` is applied inline — it carries the status-bar inset now that
  // the gradient runs to the top of the screen.
  hero: {
    paddingHorizontal: s(14),
    paddingBottom: s(40),
    overflow: 'hidden',
  },
  // Pushed down from 14: it used to sit below a header bar, and at the old
  // offset it would now fall behind the status bar and read as a stray dot
  // next to the clock.
  heroTwinkle: { position: 'absolute', top: s(56), right: s(24) },
  heroRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  avatarWrap: {
    width: s(66),
    height: s(66),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: { ...StyleSheet.absoluteFill, borderRadius: radius.full },
  avatar: {
    width: s(60),
    height: s(60),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: font(22, '800', { color: palette.navy }),
  heroBody: { flex: 1, minWidth: 0 },
  heroName: font(15, '800', { color: palette.white, lineHeight: 1.15 }),
  heroPhone: {
    ...font(9, '400', { color: palette.white }),
    opacity: 0.75,
    marginTop: s(1),
  },
  crownChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(6),
    paddingVertical: s(2),
    paddingHorizontal: s(8),
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
  },
  crownText: font(8, '800', { color: palette.navy, letterSpacing: 0.5 }),

  statsWrap: { paddingHorizontal: s(12), marginTop: s(-24) },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    paddingVertical: s(12),
    paddingHorizontal: s(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    ...shadows.elevatedCard,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.divider,
  },
  statValue: font(16, '800', { color: palette.navy, lineHeight: 1 }),
  statLabel: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    marginTop: s(3),
  },

  block: { paddingTop: s(14), paddingHorizontal: s(12) },
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  group: {
    backgroundColor: palette.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(11),
    paddingVertical: s(11),
    paddingHorizontal: s(12),
  },
  rowDivide: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  rowBody: { flex: 1 },
  rowTitle: font(11, '800', { color: palette.navy }),
  rowMeta: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },
  pill: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.goldSoft,
    borderRadius: radius.sm,
  },
  pillText: font(8, '800', { color: palette.goldText }),

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
    padding: s(12),
    backgroundColor: palette.white,
    borderWidth: s(1.5),
    borderColor: palette.redSoft,
    borderRadius: radius.card,
  },
  logoutText: font(12, '800', { color: palette.red }),

  version: {
    alignItems: 'center',
    paddingTop: s(14),
    paddingHorizontal: s(12),
    paddingBottom: s(16),
  },
  versionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    backgroundColor: palette.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.pill,
  },
  versionLogo: { height: s(14), width: s(34) },
  versionText: font(9, '800', { color: palette.navy, letterSpacing: 0.3 }),
  copyright: {
    ...font(8, '700', { color: palette.slate400, letterSpacing: 0.5 }),
    marginTop: s(6),
  },

  pressed: { opacity: 0.8 },
});
