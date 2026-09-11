import React, { memo, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BlinkDot } from '../common/Animations';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
import { IconWell } from '../common/IconWell';
import type { Halt } from '@services/fleet.service';
import { authedImageSource } from '@utils/mediaUrl';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { shadows } from '@theme/shadows';
import { s } from '@theme/metrics';

/**
 * The "HALT UPDATES" section — where the lorry stopped along the way, with each
 * halt's reason, place, date/time, duration, source and camera photos, and the
 * total time stopped up top. Photos open full-size in a lightbox.
 *
 * Self-contained so it reads the same on the Live Trip Track screen and on the
 * Trip Details screen — the office sees the same halt log whether the trip is
 * still on the road or already delivered. Renders nothing when there are no
 * halts. Halt photos are stored/signed images, so they load through
 * `authedImageSource` (URL + session token), not `resolveMediaUrl`.
 */
export type HaltUpdatesProps = {
  /** The trip's halts, in the order the tracking API returns them. */
  halts: Halt[];
};

/** `08 Sep` — the halt's date. */
const haltDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });

/** `4:35 PM` — the halt's time. */
const haltTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

/** `45 min` / `1h 12m` — a span of minutes as hours and minutes. */
const durationLabel = (mins: number): string => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) {
    return `${m} min`;
  }
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const HaltUpdatesComponent: React.FC<HaltUpdatesProps> = ({ halts }) => {
  const insets = useSafeAreaInsets();
  // A halt photo opened full-size in the lightbox, or null when it is closed.
  const [photo, setPhoto] = useState<string | null>(null);

  if (halts.length === 0) {
    return null;
  }

  // How long the vehicle has been stopped in total across every halt, and
  // whether any stop is still ongoing right now.
  const totalHaltMinutes = halts.reduce((sum, h) => sum + (h.minutes || 0), 0);
  const anyOngoingHalt = halts.some(h => h.ongoing);

  return (
    <>
      <Text style={styles.section}>HALT UPDATES</Text>

      {/* Total time stopped across every halt */}
      <View style={[styles.haltTotal, anyOngoingHalt && styles.haltTotalLive]}>
        <IconWell
          icon="clock"
          size={32}
          iconSize={15}
          backgroundColor={palette.white}
          color={anyOngoingHalt ? palette.red : palette.gold}
          borderRadius={radius.full}
        />
        <View style={styles.haltTotalBody}>
          <Text style={styles.haltTotalLabel}>
            {anyOngoingHalt ? 'STOPPED SO FAR' : 'TOTAL TIME STOPPED'}
          </Text>
          <Text style={styles.haltTotalValue}>
            {durationLabel(totalHaltMinutes)}
            <Text style={styles.haltTotalSub}>
              {`  ·  ${halts.length} ${halts.length === 1 ? 'stop' : 'stops'}`}
            </Text>
          </Text>
        </View>
      </View>

      <Card padding={0} marginBottom={10}>
        {halts.map((h, i) => {
          const reason =
            h.reason || (h.source === 'manual' ? 'Halt' : 'Long stop');
          const dur = h.ongoing
            ? 'Ongoing'
            : h.minutes > 0
              ? durationLabel(h.minutes)
              : null;
          return (
            <View
              key={`halt-${i}`}
              style={[styles.haltRow, i > 0 && styles.haltDivider]}
            >
              <View style={styles.haltHead}>
                <IconWell
                  icon="pause"
                  size={38}
                  iconSize={16}
                  backgroundColor={
                    h.ongoing ? palette.redTint : palette.goldTint
                  }
                  color={h.ongoing ? palette.red : palette.gold}
                  borderRadius={radius.md}
                />
                <View style={styles.haltBody}>
                  <Text style={styles.haltReason} numberOfLines={1}>
                    {reason}
                  </Text>
                  <View style={styles.haltMetaRow}>
                    <Icon name="map-pin" size={11} color={palette.slate400} />
                    <Text style={styles.haltPlace} numberOfLines={1}>
                      {h.place || `${h.lat.toFixed(4)}, ${h.lng.toFixed(4)}`}
                    </Text>
                  </View>
                </View>
                {dur ? (
                  <View
                    style={[
                      styles.haltDurPill,
                      h.ongoing && styles.haltDurPillLive,
                    ]}
                  >
                    {h.ongoing ? (
                      <BlinkDot size={5} color={palette.red} />
                    ) : null}
                    <Text
                      style={[
                        styles.haltDurText,
                        h.ongoing && styles.haltDurTextLive,
                      ]}
                    >
                      {dur}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.haltChips}>
                <View style={styles.haltChip}>
                  <Icon
                    name="calendar-days"
                    size={10}
                    color={palette.slate400}
                  />
                  <Text style={styles.haltChipText}>
                    {haltDate(h.startedAt)}
                  </Text>
                </View>
                <View style={styles.haltChip}>
                  <Icon name="clock" size={10} color={palette.slate400} />
                  <Text style={styles.haltChipText}>{haltTime(h.startedAt)}</Text>
                </View>
                <View
                  style={[
                    styles.haltChip,
                    styles.haltSourceChip,
                    h.source === 'manual'
                      ? styles.haltSourceManual
                      : styles.haltSourceAuto,
                  ]}
                >
                  <Text
                    style={[
                      styles.haltChipText,
                      h.source === 'manual'
                        ? styles.haltSourceTextManual
                        : styles.haltSourceTextAuto,
                    ]}
                  >
                    {h.source === 'manual' ? 'Driver logged' : 'Auto-detected'}
                  </Text>
                </View>
              </View>

              {h.note ? <Text style={styles.haltNote}>“{h.note}”</Text> : null}

              {h.photos && h.photos.length > 0 ? (
                <View style={styles.haltPhotoRow}>
                  {h.photos.map((url, p) => {
                    const src = authedImageSource(url);
                    return src ? (
                      <Pressable
                        key={`halt-${i}-photo-${p}`}
                        onPress={() => setPhoto(url)}
                        style={styles.haltThumbWrap}
                        accessibilityRole="button"
                        accessibilityLabel={`Open halt photo ${p + 1}`}
                      >
                        <Image
                          source={src}
                          style={styles.haltThumb}
                          resizeMode="cover"
                        />
                      </Pressable>
                    ) : null;
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      {/* Halt photo, full-size — tap anywhere to dismiss. */}
      <Modal
        visible={photo !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPhoto(null)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.lightbox}
          onPress={() => setPhoto(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {(() => {
            const src = authedImageSource(photo);
            return src ? (
              <Image
                source={src}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            ) : null;
          })()}
          <View style={[styles.close, { top: insets.top + s(12) }]}>
            <Icon name="x" size={20} color={palette.navy} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },

  haltTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    padding: s(11),
    marginBottom: s(10),
    backgroundColor: palette.goldTint,
    borderRadius: radius.xl,
  },
  haltTotalLive: { backgroundColor: palette.redTint },
  haltTotalBody: { flex: 1, minWidth: 0 },
  haltTotalLabel: font(8, '800', {
    color: palette.goldText,
    letterSpacing: 0.8,
  }),
  haltTotalValue: {
    ...font(15, '800', { color: palette.navy }),
    marginTop: s(1),
  },
  haltTotalSub: font(10, '600', { color: palette.slate500 }),
  haltRow: { padding: s(11), gap: s(9) },
  haltDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  haltHead: { flexDirection: 'row', alignItems: 'center', gap: s(10) },
  haltBody: { flex: 1, minWidth: 0 },
  haltReason: font(12, '800', { color: palette.navy }),
  haltMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginTop: s(2),
  },
  haltPlace: { ...font(10, '600', { color: palette.slate500 }), flexShrink: 1 },
  haltDurPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(9),
    paddingVertical: s(4),
    borderRadius: radius.full,
    backgroundColor: palette.goldTint,
  },
  haltDurPillLive: { backgroundColor: palette.redTint },
  haltDurText: font(9, '800', { color: palette.goldText }),
  haltDurTextLive: { color: palette.red },
  haltChips: { flexDirection: 'row', flexWrap: 'wrap', gap: s(6) },
  haltChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(9),
    paddingVertical: s(4),
    borderRadius: radius.full,
    backgroundColor: palette.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  haltChipText: font(9, '700', { color: palette.navy }),
  haltSourceChip: { borderWidth: 0 },
  haltSourceManual: { backgroundColor: palette.goldTint },
  haltSourceAuto: { backgroundColor: palette.navyTint },
  haltSourceTextManual: { color: palette.goldText },
  haltSourceTextAuto: { color: palette.navy },
  haltNote: {
    ...font(10, '500', { color: palette.slate500, lineHeight: 14 }),
    fontStyle: 'italic',
  },
  haltPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s(7) },
  haltThumbWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  haltThumb: { width: s(64), height: s(64) },

  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '80%' },
  close: {
    position: 'absolute',
    left: s(12),
    width: s(40),
    height: s(40),
    borderRadius: radius.full,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.mapMarker,
  },
});

export const HaltUpdates = memo(HaltUpdatesComponent);
HaltUpdates.displayName = 'HaltUpdates';
