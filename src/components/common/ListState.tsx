import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { Loader } from './Loader';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { IconName } from './Icon';

/**
 * What a list shows when it has no rows to show.
 *
 * The three states a screen reading from the network can be in — still
 * loading, failed, or genuinely empty — and they are worth telling apart. A
 * failed request drawn as "No vehicles yet" reads as an empty fleet, and the
 * operator goes looking for the lorries rather than for the network.
 *
 * Returns `null` once there is something to draw, so a screen can render it
 * unconditionally above its list.
 */
export type ListStateProps = {
  loading?: boolean;
  error?: string | null;
  /** True when the request succeeded and came back with nothing. */
  empty?: boolean;
  /** What is being loaded, for the captions: "vehicles", "drivers". */
  what?: string;
  emptyIcon?: IconName;
  emptyHint?: string;
  onRetry?: () => void;
};

const ListStateComponent: React.FC<ListStateProps> = ({
  loading = false,
  error = null,
  empty = false,
  what = 'records',
  emptyIcon = 'package-search',
  emptyHint,
  onRetry,
}) => {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <Loader size={30} label={`Loading ${what}…`} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.well, styles.wellError]}>
          <Icon name="alert-circle" size={22} color={palette.red} />
        </View>
        <Text style={styles.title}>Could not load {what}</Text>
        <Text style={styles.body}>{error}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={`Retry loading ${what}`}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Icon name="arrow-right" size={12} color={palette.navy} />
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.wrap}>
        <View style={styles.well}>
          <Icon name={emptyIcon} size={22} color={palette.slate400} />
        </View>
        <Text style={styles.title}>No {what} yet</Text>
        {emptyHint ? <Text style={styles.body}>{emptyHint}</Text> : null}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(46),
    paddingHorizontal: s(24),
    gap: s(6),
  },
  well: {
    width: s(52),
    height: s(52),
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.navyTint,
    marginBottom: s(4),
  },
  wellError: { backgroundColor: palette.redTint },
  title: font(12, '800', { color: palette.navy }),
  body: {
    ...font(10, '500', { color: palette.slate500 }),
    textAlign: 'center',
    lineHeight: s(15),
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(10),
    paddingVertical: s(8),
    paddingHorizontal: s(14),
    borderRadius: radius.md,
    borderWidth: s(1.5),
    borderColor: palette.navy,
  },
  retryText: font(9, '800', { color: palette.navy, letterSpacing: 1 }),
  pressed: { opacity: 0.8 },
});

export const ListState = memo(ListStateComponent);
ListState.displayName = 'ListState';
