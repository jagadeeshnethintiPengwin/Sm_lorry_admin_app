import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon, IconName } from './Icon';
import { palette } from '@theme/colors';
import { typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { layout } from '@theme/spacing';
import { s, vs } from '@theme/metrics';

/**
 * `.tabs` / `.tab` from the mock:
 *
 *   .tabs { height:62px; background:#fff; display:flex;
 *           justify-content:space-around; align-items:center;
 *           padding:8px 8px 12px; border-top:1px solid #eef2f7 }
 *   .tab  { flex-direction:column; align-items:center; gap:3px;
 *           color:#94a3b8; font-size:10px; font-weight:600; flex:1 }
 *   .tab svg { width:22px; height:22px }
 *   .tab .tab-icon-wrap { width:32px; height:32px }
 *   .tab.on         { color:#0d2647 }
 *   .tab.on svg     { stroke-width:2.5 }
 *   .tab.on span    { font-weight:800 }
 *   .tab.on::before { content:""; position:absolute; top:-6px; left:50%;
 *                     width:5px; height:5px; background:#f5a623;
 *                     border-radius:50%;
 *                     box-shadow:0 0 8px rgba(245,166,35,0.6) }
 */
const TAB_ICONS: Record<string, IconName> = {
  Home: 'home',
  Vehicles: 'truck',
  Drivers: 'users',
  Bookings: 'clipboard-check',
  Menu: 'menu',
};

/**
 * The 1px lift applied to the active tab icon. Resolved here on the JS runtime
 * because `s()` cannot be called from inside a worklet.
 */
const ICON_LIFT = s(1);

type TabItemProps = {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  /** Unread count rendered as a red dot on the Notify tab. */
  badge?: number;
};

const TabItem = memo<TabItemProps>(
  ({ label, icon, focused, onPress, onLongPress, badge }) => {
    const progress = useDerivedValue(
      () => withTiming(focused ? 1 : 0, { duration: 220 }),
      [focused],
    );

    // `.tab.on::before` — the gold dot fades/scales in above the icon.
    const dotStyle = useAnimatedStyle(() => ({
      opacity: progress.value,
      transform: [{ scale: 0.4 + progress.value * 0.6 }],
    }));

    const iconStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: -progress.value * ICON_LIFT }],
    }));

    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={styles.tab}
      >
        <Animated.View style={[styles.dot, dotStyle]} />
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          {/* 18, down from 22 — the glyph sat heavy against its 10px label. */}
          <Icon
            name={icon}
            size={18}
            color={focused ? palette.navy : palette.slate400}
            strokeWidth={focused ? 2.5 : 2}
          />
          {badge && badge > 0 ? <View style={styles.badge} /> : null}
        </Animated.View>
        <Text
          style={[
            focused ? styles.labelOn : styles.label,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  },
);
TabItem.displayName = 'TabItem';

export type TabBarProps = BottomTabBarProps & {
  /** Unread notification count, surfaced on the Notify tab. */
  unreadCount?: number;
};

const TabBarComponent: React.FC<TabBarProps> = ({
  state,
  descriptors,
  navigation,
  unreadCount = 0,
}) => {
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(
    (routeKey: string, routeName: string, isFocused: boolean) => () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    (routeKey: string) => () => {
      navigation.emit({ type: 'tabLongPress', target: routeKey });
    },
    [navigation],
  );

  return (
    <View style={[styles.tabs, { paddingBottom: s(12) + insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title ?? route.name;
        const isFocused = state.index === index;

        return (
          <TabItem
            key={route.key}
            label={label}
            icon={TAB_ICONS[route.name] ?? 'home'}
            focused={isFocused}
            onPress={handlePress(route.key, route.name, isFocused)}
            onLongPress={handleLongPress(route.key)}
            badge={route.name === 'Bookings' ? unreadCount : undefined}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabs: {
    minHeight: layout.tabBarHeight,
    backgroundColor: palette.white,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: s(8),
    paddingHorizontal: s(8),
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: s(3),
    position: 'relative',
  },
  // The well follows the glyph down, so the icon stays centred in it and the
  // bar does not keep the height the larger icon needed.
  iconWrap: {
    width: s(26),
    height: s(26),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: -vs(6),
    width: s(5),
    height: s(5),
    borderRadius: radius.full,
    backgroundColor: palette.gold,
    shadowColor: palette.gold,
    shadowOpacity: 0.6,
    shadowRadius: s(4),
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: s(4),
    right: s(4),
    width: s(7),
    height: s(7),
    borderRadius: radius.full,
    backgroundColor: palette.red,
  },
  label: {
    ...typography.tabLabel,
    color: palette.slate400,
  },
  labelOn: {
    ...typography.tabLabelActive,
    color: palette.navy,
  },
});

export const TabBar = memo(TabBarComponent);
TabBar.displayName = 'TabBar';
