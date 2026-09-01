import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateField } from '@components/inputs/DateField';
import { Icon } from '@components/common/Icon';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * A date-range filter for the list screens — the phone twin of the web panel's
 * `DateRangeFilter`. Presets cover the everyday windows; "Custom" reveals two
 * native date fields for an exact span. The value is a plain `{ from, to }` of
 * ISO `YYYY-MM-DD` strings, which every list endpoint accepts as `?from`/`?to`.
 */
export type DatePreset = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom';
export type DateRange = { from: string; to: string; preset: DatePreset };

export const ALL_TIME: DateRange = { from: '', to: '', preset: 'all' };

const iso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const shift = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const startOfMonth = (): Date => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const PRESETS: Array<{ key: DatePreset; label: string; make: () => DateRange }> = [
  { key: 'all', label: 'All', make: () => ALL_TIME },
  {
    key: 'today',
    label: 'Today',
    make: () => ({ from: iso(new Date()), to: iso(new Date()), preset: 'today' }),
  },
  {
    key: '7d',
    label: '7 days',
    make: () => ({ from: iso(shift(6)), to: iso(new Date()), preset: '7d' }),
  },
  {
    key: '30d',
    label: '30 days',
    make: () => ({ from: iso(shift(29)), to: iso(new Date()), preset: '30d' }),
  },
  {
    key: 'month',
    label: 'This month',
    make: () => ({ from: iso(startOfMonth()), to: iso(new Date()), preset: 'month' }),
  },
];

/** The `{ from, to }` query params for a range — empty object for All-time. */
export function dateRangeParams(range: DateRange): { from?: string; to?: string } {
  const params: { from?: string; to?: string } = {};
  if (range.from) {
    params.from = range.from;
  }
  if (range.to) {
    params.to = range.to;
  }
  return params;
}

export const DateFilter: React.FC<{
  range: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
}> = ({ range, onChange, label = 'Date' }) => {
  const custom = range.preset === 'custom';
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <View style={styles.kicker}>
          <Icon name="calendar-days" size={12} color={palette.slate500} />
          <Text style={styles.kickerText}>{label}</Text>
        </View>
        {PRESETS.map(preset => {
          const on = range.preset === preset.key;
          return (
            <Pressable
              key={preset.key}
              onPress={() => onChange(preset.make())}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={on ? styles.chipTextOn : styles.chipText}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() =>
            onChange({
              from: range.from || iso(new Date()),
              to: range.to || iso(new Date()),
              preset: 'custom',
            })
          }
          accessibilityRole="button"
          accessibilityState={{ selected: custom }}
          style={[styles.chip, custom && styles.chipOn]}
        >
          <Text style={custom ? styles.chipTextOn : styles.chipText}>Custom</Text>
        </Pressable>
      </ScrollView>

      {custom ? (
        <View style={styles.customRow}>
          <View style={styles.customCol}>
            <DateField
              label="From"
              value={range.from}
              maximumDate={range.to ? new Date(range.to) : undefined}
              onChange={value => onChange({ ...range, from: value, preset: 'custom' })}
            />
          </View>
          <View style={styles.customCol}>
            <DateField
              label="To"
              value={range.to}
              minimumDate={range.from ? new Date(range.from) : undefined}
              onChange={value => onChange({ ...range, to: value, preset: 'custom' })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: s(12),
    paddingTop: s(8),
    gap: s(8),
  },
  chips: {
    alignItems: 'center',
    gap: s(6),
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginRight: s(2),
  },
  kickerText: {
    ...font(9, '800', { color: palette.slate500, letterSpacing: 0.5 }),
    textTransform: 'uppercase',
  },
  chip: {
    paddingVertical: s(5),
    paddingHorizontal: s(11),
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.white,
  },
  chipOn: { backgroundColor: palette.navy, borderColor: palette.navy },
  chipText: font(9, '700', { color: palette.slate500 }),
  chipTextOn: font(9, '800', { color: palette.white }),
  customRow: {
    flexDirection: 'row',
    gap: s(10),
  },
  customCol: { flex: 1 },
});

DateFilter.displayName = 'DateFilter';
