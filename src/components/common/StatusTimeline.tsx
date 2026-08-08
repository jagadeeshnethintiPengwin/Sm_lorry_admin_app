import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Icon, IconName } from './Icon';
import { PulseGlow } from './Animations';
import { gradients, palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * The vertical progress timeline used on Booking Status (8c) and Shipment
 * Details (10):
 *
 *   done    : 24px gold-gradient disc + white check,
 *             rail `linear-gradient(180deg,#f5a623,#e5e7eb)`
 *   current : 24px red disc with a pulsing halo, red title + IN PROGRESS chip
 *   pending : 24px white disc, 2px #e5e7eb border, #94a3b8 glyph and text
 *
 *   rail    : width:2px; margin-top:4px; min-height:16px
 *   title   : 11px/800 · detail 9px, `margin-top:1px`
 */
export type TimelineStep = {
  title: string;
  detail?: string;
  state: 'done' | 'current' | 'pending';
  icon?: IconName;
  /** Small chip beside the title, e.g. `IN PROGRESS`. */
  badge?: string;
  /**
   * Accent for the `current` disc, title and badge. Booking Status (8c) uses
   * red `IN PROGRESS`; Shipment Details (10) uses navy `LIVE`.
   */
  tone?: 'red' | 'navy';
};

export type StatusTimelineProps = {
  steps: TimelineStep[];
};

const Row = memo<{ step: TimelineStep; isLast: boolean; nextDone: boolean }>(
  ({ step, isLast, nextDone }) => {
    const isDone = step.state === 'done';
    const isCurrent = step.state === 'current';
    const navyTone = step.tone === 'navy';

    return (
      <View style={[styles.row, isLast ? null : styles.rowGap]}>
        <View style={styles.rail}>
          {isDone ? (
            <LinearGradient
              colors={gradients.gold as unknown as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.disc}
            >
              <Icon name="check" size={12} color={palette.white} strokeWidth={3} />
            </LinearGradient>
          ) : isCurrent ? (
            <View style={styles.currentWrap}>
              <PulseGlow
                color={navyTone ? palette.navy : palette.red}
                opacity={0.25}
                duration={1600}
              />
              <View
                style={[
                  styles.currentDisc,
                  navyTone && styles.currentDiscNavy,
                ]}
              >
                <Icon name={step.icon ?? 'activity'} size={10} color={palette.white} />
              </View>
            </View>
          ) : (
            <View style={styles.pendingDisc}>
              <Icon
                name={step.icon ?? 'map-pin'}
                size={10}
                color={palette.slate400}
              />
            </View>
          )}

          {!isLast ? (
            isDone && nextDone ? (
              <View style={[styles.connector, styles.connectorGold]} />
            ) : isDone ? (
              <LinearGradient
                colors={[palette.gold, palette.gray200]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.connector}
              />
            ) : (
              <View style={[styles.connector, styles.connectorGrey]} />
            )
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text
              style={
                isCurrent && !navyTone
                  ? styles.titleCurrent
                  : step.state === 'pending'
                  ? styles.titlePending
                  : styles.title
              }
            >
              {step.title}
            </Text>
            {step.badge ? (
              <View style={[styles.badge, navyTone && styles.badgeNavy]}>
                <Text
                  style={[styles.badgeText, navyTone && styles.badgeTextNavy]}
                >
                  {step.badge}
                </Text>
              </View>
            ) : null}
          </View>
          {step.detail ? (
            <Text
              style={
                step.state === 'pending' ? styles.detailPending : styles.detail
              }
            >
              {step.detail}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
);
Row.displayName = 'TimelineRow';

const StatusTimelineComponent: React.FC<StatusTimelineProps> = ({ steps }) => (
  <View>
    {steps.map((step, index) => (
      <Row
        key={step.title}
        step={step}
        isLast={index === steps.length - 1}
        nextDone={steps[index + 1]?.state === 'done'}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: s(10) },
  rowGap: { paddingBottom: s(12) },
  rail: { alignItems: 'center', alignSelf: 'stretch' },
  disc: {
    width: s(24),
    height: s(24),
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: s(3) },
    shadowRadius: s(4),
    shadowOpacity: 0.3,
    elevation: 3,
  },
  currentWrap: { width: s(24), height: s(24), position: 'relative' },
  currentDisc: {
    position: 'absolute',
    top: s(3),
    left: s(3),
    right: s(3),
    bottom: s(3),
    backgroundColor: palette.red,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentDiscNavy: { backgroundColor: palette.navy },
  pendingDisc: {
    width: s(24),
    height: s(24),
    backgroundColor: palette.white,
    borderWidth: s(2),
    borderColor: palette.gray200,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  connector: {
    width: s(2),
    flex: 1,
    marginTop: s(4),
    minHeight: s(16),
  },
  connectorGold: { backgroundColor: palette.gold },
  connectorGrey: { backgroundColor: palette.gray200 },

  body: { flex: 1, paddingBottom: s(6) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  title: font(11, '800', { color: palette.navy }),
  titleCurrent: font(11, '800', { color: palette.red }),
  titlePending: font(11, '800', { color: palette.slate400 }),
  badge: {
    paddingVertical: s(1),
    paddingHorizontal: s(6),
    backgroundColor: palette.redSoft,
    borderRadius: s(5),
  },
  badgeNavy: { backgroundColor: palette.navyTint },
  badgeText: font(7, '800', { letterSpacing: 0.5, color: palette.redDark }),
  badgeTextNavy: { color: palette.navy },
  detail: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },
  detailPending: {
    ...font(9, '400', { color: palette.slate400 }),
    marginTop: s(1),
  },
});

export const StatusTimeline = memo(StatusTimelineComponent);
StatusTimeline.displayName = 'StatusTimeline';
