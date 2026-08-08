import React, { memo } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StatusBar,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@theme/colors';
import { s } from '@theme/metrics';

/**
 * `.screen` + `.content` from the mock:
 *
 *   .screen  { background:#fff; display:flex; flex-direction:column }
 *   .content { flex:1; overflow-y:auto; background:#f5f7fa; padding:12px }
 *   .content::-webkit-scrollbar { display:none }
 */
export type ScreenProps = {
  children: React.ReactNode;
  /** `.screen` background. */
  backgroundColor?: string;
  /** Light content for navy headers, dark for white screens. */
  statusBarStyle?: 'light-content' | 'dark-content';
  style?: StyleProp<ViewStyle>;
};

/*
 * `backgroundColor` and `translucent` are gone from `StatusBar` in React Native
 * 0.87. Android 15 draws every app edge-to-edge and ignores both, so they were
 * removed rather than left as props that quietly did nothing.
 *
 * Nothing is lost here: this passed `translucent` with a transparent colour,
 * which is precisely the behaviour the platform now applies by default. The
 * `statusBarColor` prop went with them — no caller ever set it.
 */
const ScreenComponent: React.FC<ScreenProps> = ({
  children,
  backgroundColor = palette.screenBg,
  statusBarStyle = 'light-content',
  style,
}) => (
  <View style={[styles.screen, { backgroundColor }, style]}>
    <StatusBar barStyle={statusBarStyle} />
    {children}
  </View>
);

export const Screen = memo(ScreenComponent);
Screen.displayName = 'Screen';

/**
 * The scrollable `.content` region. Scroll indicators are hidden to match
 * `::-webkit-scrollbar { display:none }`.
 */
export type ContentProps = ScrollViewProps & {
  children: React.ReactNode;
  /** Overrides `padding:12px`. Pass 0 for the `padding:0` screens. */
  padding?: number;
  backgroundColor?: string;
  /** Adds bottom inset so content clears the home indicator. */
  safeBottom?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

const ContentComponent: React.FC<ContentProps> = ({
  children,
  padding = 12,
  backgroundColor = palette.screenBg,
  safeBottom = false,
  contentStyle,
  style,
  ...rest
}) => {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={[styles.content, { backgroundColor }, style]}
      contentContainerStyle={[
        {
          padding: s(padding),
          paddingBottom: safeBottom ? insets.bottom + s(padding) : s(padding),
        },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
};

export const Content = memo(ContentComponent);
Content.displayName = 'Content';

/**
 * The sticky action bar that ends most screens:
 *
 *   flex-shrink:0; background:#fff; border-top:1px solid #eef2f7;
 *   padding:10px 14px 14px;
 */
export type FooterProps = {
  children: React.ReactNode;
  paddingHorizontal?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Lays children out in a row with `gap:8px`. */
  row?: boolean;
  gap?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

const FooterComponent: React.FC<FooterProps> = ({
  children,
  paddingHorizontal = 14,
  paddingTop = 10,
  paddingBottom = 14,
  row = false,
  gap = 8,
  backgroundColor = palette.white,
  style,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor,
          paddingHorizontal: s(paddingHorizontal),
          paddingTop: s(paddingTop),
          paddingBottom: s(paddingBottom) + insets.bottom,
        },
        row ? styles.footerRow : null,
        row ? { gap: s(gap) } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const Footer = memo(FooterComponent);
Footer.displayName = 'Footer';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'column',
  },
  content: { flex: 1 },
  footer: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  footerRow: { flexDirection: 'row' },
});
