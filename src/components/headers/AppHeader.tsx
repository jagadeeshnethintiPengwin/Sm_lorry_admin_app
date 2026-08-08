import React, { memo, useCallback } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useTopInset } from '@hooks/useTopInset';
import { Icon, IconName } from '@components/common/Icon';
import { palette } from '@theme/colors';
import { typography } from '@theme/fonts';
import { radius } from '@theme/radius';
import { layout } from '@theme/spacing';
import { s } from '@theme/metrics';

/**
 * `.app-hdr` from the mock:
 *
 *   background:#0d2647; color:#fff; margin-top:-44px;
 *   padding:52px 14px 14px; display:flex; align-items:center; gap:10px;
 *   .back  { width:28px; height:28px; border-radius:50%;
 *            background:rgba(255,255,255,0.15) }
 *   .title { flex:1; font-size:13px; font-weight:700 }
 *   .ico   { width:28px; height:28px }
 *
 * The `margin-top:-44px` in the CSS pulls the header under the mock's status
 * bar; on device we achieve the same by painting the header behind the real
 * safe-area inset.
 */
export type AppHeaderProps = {
  title: string;
  /** Hides the circular back affordance (e.g. root tab screens). */
  showBack?: boolean;
  /** `chevron-left` by default; the Add/Edit sheets use `x`. */
  backIcon?: IconName;
  onBackPress?: () => void;
  /** `.app-hdr .sub` — 9px secondary line under the title, opacity .85. */
  subtitle?: string;
  /** Renders the 28px trailing spacer. Some screens omit `.ico` entirely. */
  showRightSlot?: boolean;
  /** Trailing icon — `.ico` is empty on most screens. */
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
  /** Extra bottom padding — some screens use `padding-bottom:18px`. */
  paddingBottom?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Rendered underneath the title row, inside the header background. */
  children?: React.ReactNode;
};

const AppHeaderComponent: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showRightSlot = true,
  showBack = true,
  backIcon = 'chevron-left',
  onBackPress,
  rightIcon,
  onRightPress,
  rightAccessibilityLabel,
  paddingBottom,
  backgroundColor = palette.navy,
  style,
  children,
}) => {
  const topInset = useTopInset();
  const navigation = useNavigation();

  const handleBack = useCallback(() => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onBackPress]);

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor,
          // `padding:52px …` minus the mock's 44px status bar = 8px of real
          // padding above the title row, plus the device inset.
          paddingTop: topInset + s(8),
          paddingBottom: paddingBottom !== undefined ? s(paddingBottom) : s(14),
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            style={styles.back}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name={backIcon} size={16} color={palette.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.back} />
        )}

        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {rightIcon ? (
          <TouchableOpacity
            style={styles.ico}
            onPress={onRightPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={rightAccessibilityLabel ?? rightIcon}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name={rightIcon} size={16} color={palette.white} />
          </TouchableOpacity>
        ) : showRightSlot ? (
          <View style={styles.ico} />
        ) : null}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexShrink: 0,
    paddingHorizontal: layout.headerPaddingH,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  back: {
    width: layout.headerIconSize,
    height: layout.headerIconSize,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: { flex: 1 },
  title: {
    ...typography.headerTitle,
    color: palette.white,
  },
  // `.app-hdr .sub { font-size:9px; opacity:0.85 }`
  sub: {
    ...typography.headerSub,
    color: palette.white,
    opacity: 0.85,
  },
  ico: {
    width: layout.headerIconSize,
    height: layout.headerIconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const AppHeader = memo(AppHeaderComponent);
AppHeader.displayName = 'AppHeader';
