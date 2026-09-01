import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Input, type InputProps } from './Input';
import { Icon } from '../common/Icon';
import {
  placesService,
  type PlaceDetail,
  type PlaceSuggestion,
} from '@services/places.service';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * An address field that suggests as you type — the app's half of the same
 * autocomplete the web panel's booking form uses.
 *
 * A couple of letters bring back Google's matches (through the API, so the
 * mapping key never reaches the handset), and choosing one fills the address
 * and the latitude/longitude the live map needs. It degrades to the plain
 * `Input` it wraps: no suggestions, and the operator types the name by hand.
 *
 * The list is rendered inline beneath the field rather than floated over it —
 * an absolute dropdown gets clipped by the card it sits in, and pushing the
 * next field down for a moment is the reliable behaviour on a phone.
 */
type Props = Omit<InputProps, 'value' | 'onChangeText'> & {
  value: string;
  /** Free typing — the caller should drop any address/coordinates it held. */
  onChangeText: (place: string) => void;
  /** A suggestion was chosen — its full address and coordinates. */
  onSelect: (detail: PlaceDetail) => void;
};

/** A per-choice token so Google bills one lookup, not one per keystroke. */
function newSession(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1e8)}`.slice(0, 32);
}

export const PlaceInput: React.FC<Props> = ({
  value,
  onChangeText,
  onSelect,
  marginBottom = 0,
  ...rest
}) => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const session = useRef(newSession());
  /** Set while a pick is applied, so echoing the name back does not re-search. */
  const picking = useRef(false);

  // Debounced lookup — every state change inside the deferred timer, never as
  // the effect runs.
  useEffect(() => {
    if (picking.current) {
      picking.current = false;
      return;
    }
    const q = value.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) {
        return;
      }
      if (q.length < 2) {
        setSuggestions([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      // `search` swallows its own failures (returns []), so this cannot reject.
      placesService.search(q, session.current).then(results => {
        if (cancelled) {
          return;
        }
        setSuggestions(results);
        setOpen(results.length > 0);
        setLoading(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  const pick = async (suggestion: PlaceSuggestion) => {
    picking.current = true;
    onChangeText(suggestion.primary);
    setOpen(false);
    setSuggestions([]);
    const detail = await placesService.details(suggestion.id, session.current);
    // A fresh token for the next address — the one just spent is closed.
    session.current = newSession();
    if (detail) {
      onSelect(detail);
    }
  };

  return (
    <View style={{ marginBottom }}>
      <Input
        value={value}
        onChangeText={onChangeText}
        marginBottom={0}
        autoCapitalize="words"
        autoCorrect={false}
        {...rest}
      />

      {loading && value.trim().length >= 2 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.gold} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      ) : null}

      {open && suggestions.length > 0 ? (
        <View style={styles.list}>
          {suggestions.map((sug, i) => (
            <Pressable
              key={sug.id}
              onPress={() => pick(sug)}
              style={({ pressed }) => [
                styles.row,
                i < suggestions.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={sug.label}
            >
              <Icon name="map-pin" size={13} color={palette.gold} />
              <View style={styles.rowBody}>
                <Text style={styles.primary} numberOfLines={1}>
                  {sug.primary}
                </Text>
                {sug.secondary ? (
                  <Text style={styles.secondary} numberOfLines={1}>
                    {sug.secondary}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(6),
  },
  loadingText: font(9, '600', { color: palette.slate500 }),
  list: {
    marginTop: s(6),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s(8),
    paddingVertical: s(9),
    paddingHorizontal: s(11),
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  rowPressed: { backgroundColor: palette.surfaceAlt },
  rowBody: { flex: 1, minWidth: 0 },
  primary: font(11, '800', { color: palette.navy }),
  secondary: {
    ...font(9, '400', { color: palette.slate500 }),
    marginTop: s(1),
  },
});
