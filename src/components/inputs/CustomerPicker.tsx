import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import { Input, type InputProps } from './Input';
import { Icon } from '../common/Icon';
import { customerService, type AdminCustomer } from '@services/fleet.service';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

const str = (v: unknown): string => (v == null ? '' : String(v));
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/** Letters needed before the roster is searched. */
export const CUSTOMER_SEARCH_MIN = 3;

// ------------------------------------------------------------------ readers
// One place that knows where a customer record keeps its name, its company and
// its number, so the picker, the chosen-customer card and anything else that
// names an account all read them the same way.

/** The person the office actually speaks to. */
export const customerPerson = (customer: AdminCustomer): string =>
  str(rec(customer).contactName) || str(rec(rec(customer).user).name);

/** The account's billing name — a firm, or the person for a sole trader. */
export const customerCompany = (customer: AdminCustomer): string =>
  str(rec(customer).company);

/** The number the account signs in with. */
export const customerMobile = (customer: AdminCustomer): string =>
  str(rec(rec(customer).user).mobile || rec(customer).mobile);

/**
 * Whether the office has checked this account.
 *
 * A trip cannot be raised against an unverified customer — `bookings.approve`
 * refuses it — so a picker that never showed this would let the office fill a
 * whole form and only then be told no.
 */
export const customerVerified = (customer: AdminCustomer): boolean =>
  rec(customer).verified === true;

/** `+919876543210` → `+91 98765 43210`; anything else is left alone. */
export const prettyMobile = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  const local = digits.slice(-10);
  if (local.length !== 10) {
    return raw;
  }
  const code = digits.slice(0, -10);
  return `${code ? `+${code} ` : ''}${local.slice(0, 5)} ${local.slice(5)}`;
};

/** Up to two initials for the row's avatar. */
const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0] ?? '')
    .join('')
    .toUpperCase() || '?';

/**
 * How well a record answers what was typed: 0 its name begins with those
 * letters, 1 a word inside the name does, 2 they merely appear somewhere.
 *
 * Typing "sri" should put *Sri Sai Traders* above *Anand Sri Logistics*, and
 * the API's alphabetical page cannot do that ordering — the three letters are
 * a filter to it, not a ranking. Doing it here keeps it one readable function
 * rather than a query nobody can follow.
 */
const rankOf = (customer: AdminCustomer, query: string): number => {
  const q = query.toLowerCase();
  const names = [customerCompany(customer), customerPerson(customer)]
    .filter(Boolean)
    .map(text => text.toLowerCase());
  if (names.some(text => text.startsWith(q))) {
    return 0;
  }
  const startsAWord = names.some(text =>
    text
      .split(/[^\p{L}\p{N}]+/u)
      .some(word => word.length > 0 && word.startsWith(q)),
  );
  return startsAWord ? 1 : 2;
};

/**
 * The part of a row that matched what was typed, in gold.
 *
 * Purely cosmetic, and deliberately forgiving: a query the API matched on a
 * column this line does not show (an email, or a number typed with spaces)
 * simply renders as plain text rather than guessing.
 */
const Highlight: React.FC<{
  text: string;
  query: string;
  style: TextStyle;
  matchStyle: TextStyle;
}> = ({ text, query, style, matchStyle }) => {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  // Two lines, not one: a picker whose whole job is to show which account this
  // is must not cut "Sri Sai Traders (Kondapur)" down to "Sri Sai Trade…".
  if (at < 0) {
    return (
      <Text style={style} numberOfLines={2}>
        {text}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={2}>
      {text.slice(0, at)}
      <Text style={matchStyle}>{text.slice(at, at + query.length)}</Text>
      {text.slice(at + query.length)}
    </Text>
  );
};

export type CustomerPickerProps = Omit<InputProps, 'value' | 'onChangeText'> & {
  /** What has been typed so far. */
  value: string;
  onChangeText: (text: string) => void;
  /** A customer was chosen from the list. */
  onSelect: (customer: AdminCustomer) => void;
  /**
   * Tapped "add as a new customer", with the text typed so far. Leave it out
   * to hide the row — the suggestion variant offers no such escape.
   */
  onAddNew?: (typed: string) => void;
  /**
   * Letters needed before the roster is searched. Three by default: one or two
   * match half the book, which is a slow query answered with a list nobody can
   * read.
   */
  minChars?: number;
  /** How many rows to ask for. The API caps a page at 100. */
  limit?: number;
  /** Heading above the list, e.g. `Already on file?` for the duplicate hint. */
  listTitle?: string;
  /** Draws the list only when there are matches — no prompt, no empty line. */
  quiet?: boolean;
  /** False keeps the field but suppresses its list, so two can share a form. */
  enabled?: boolean;
  marginBottom?: number;
};

/**
 * A customer field that completes as you type.
 *
 * Three letters of a company or of the person who rang are enough: the term
 * goes to the API, which matches it against the firm, the contact, the email,
 * the account's own name and its mobile number, and every match comes back
 * named in full — the firm on the first line, the person and their number
 * underneath, wrapped rather than cut short. Two firms whose names differ only
 * at the end are exactly the case a picker must not blur.
 *
 * Searching on the server rather than filtering a roster held on the handset
 * is the point: the previous screen read 200 accounts once and filtered those,
 * which silently stopped finding anyone past the two-hundredth and asked for a
 * page the API refuses outright (its limit is 100).
 *
 * The list is rendered inline beneath the field rather than floated over it,
 * for the same reason `PlaceInput` does: an absolute dropdown is clipped by
 * the card it sits in, and pushing the next field down is the behaviour that
 * actually works on a phone.
 */
export const CustomerPicker: React.FC<CustomerPickerProps> = ({
  value,
  onChangeText,
  onSelect,
  onAddNew,
  minChars = CUSTOMER_SEARCH_MIN,
  limit = 6,
  listTitle,
  quiet = false,
  enabled = true,
  marginBottom = 0,
  ...rest
}) => {
  const [results, setResults] = useState<AdminCustomer[]>([]);
  /** How many accounts match altogether, not just on this page. */
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Set by a pick or the × — cleared by the next keystroke. */
  const [dismissed, setDismissed] = useState(false);
  /** Bumped by "try again" so the effect re-runs on an unchanged query. */
  const [attempt, setAttempt] = useState(0);

  const query = value.trim();
  /** Enough typed to search on. */
  const ready = enabled && query.length >= minChars;

  /*
   * Debounced lookup, with every state change inside the deferred timer rather
   * than as the effect runs.
   *
   * `stale` guards against the answer to "sri" landing after the answer to
   * "sri s" — the cleanup runs before the next effect, so a reply whose flag
   * has been set is simply dropped.
   */
  useEffect(() => {
    if (!ready) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      setFailed(false);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      setLoading(true);
      customerService
        .page({ search: query, limit })
        .then(({ items, meta }) => {
          if (stale) {
            return;
          }
          setResults(items);
          setTotal(meta.total ?? items.length);
          setFailed(false);
          setLoading(false);
        })
        .catch(() => {
          if (stale) {
            return;
          }
          setResults([]);
          setTotal(0);
          setFailed(true);
          setLoading(false);
        });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, ready, limit, attempt]);

  /** Best answers first — see `rankOf`. `sort` is stable, so ties keep A–Z. */
  const ranked = useMemo(
    () =>
      query
        ? [...results].sort((a, b) => rankOf(a, query) - rankOf(b, query))
        : results,
    [results, query],
  );

  const handleChange = useCallback(
    (text: string) => {
      setDismissed(false);
      onChangeText(text);
    },
    [onChangeText],
  );

  const pick = useCallback(
    (customer: AdminCustomer) => {
      setDismissed(true);
      onSelect(customer);
    },
    [onSelect],
  );

  /*
   * Return, on a search that found exactly one account, takes it — the office
   * types three letters and presses go. Not on the quiet variant: there the
   * field is the Company box of a form being filled in, and swapping the whole
   * card out because Return happened to land on one match is a surprise.
   */
  const submitEditing = useCallback(() => {
    if (!quiet && ranked.length === 1) {
      pick(ranked[0]);
    }
  }, [quiet, ranked, pick]);

  const hasMatches = ranked.length > 0;
  const more = Math.max(0, total - ranked.length);
  /*
   * The quiet variant draws a box only when it has matches to show: a hint
   * under the Company field of a *new* customer has nothing useful to say when
   * nobody matches, and "no customer matches" is exactly the wrong thing to
   * tell someone who is busy entering one. The full variant keeps its panel up
   * throughout, because it also holds the way out — "add a new customer".
   */
  const open = enabled && !dismissed && (hasMatches || !quiet);

  return (
    <View style={{ marginBottom: s(marginBottom) }}>
      <Input
        value={value}
        onChangeText={handleChange}
        marginBottom={0}
        autoCorrect={false}
        returnKeyType={quiet ? 'next' : 'search'}
        onSubmitEditing={submitEditing}
        {...rest}
      />

      {open ? (
        <View style={styles.panel}>
          {listTitle ? (
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>{listTitle}</Text>
              <Pressable
                onPress={() => setDismissed(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Hide suggestions"
              >
                <Icon name="x" size={11} color={palette.slate400} />
              </Pressable>
            </View>
          ) : null}

          {ranked.map((customer, i) => {
            const person = customerPerson(customer);
            const company = customerCompany(customer);
            const mobile = prettyMobile(customerMobile(customer));
            // Whichever name the account actually carries leads the row; the
            // other follows with the number.
            const title = company || person || 'Customer';
            const meta = [company && person ? person : '', mobile]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={customer.id}
                onPress={() => pick(customer)}
                style={({ pressed }) => [
                  styles.row,
                  i < ranked.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${title}${meta ? `, ${meta}` : ''}`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(title)}</Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <View style={styles.flexMin}>
                      <Highlight
                        text={title}
                        query={query}
                        style={styles.primary}
                        matchStyle={styles.match}
                      />
                    </View>
                    {customerVerified(customer) ? (
                      <Icon name="badge-check" size={12} color={palette.green} />
                    ) : (
                      <Text style={styles.unverified}>UNVERIFIED</Text>
                    )}
                  </View>
                  {meta ? (
                    <Highlight
                      text={meta}
                      query={query}
                      style={styles.secondary}
                      matchStyle={styles.matchSecondary}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          {/*
            * Everything below belongs to the full variant — the prompt, the
            * states and the way out. The quiet one is only ever drawn when it
            * has matches, so it ends with the rows above.
            */}
          {quiet ? null : (
            <>
              {more > 0 ? (
                <Text style={styles.moreText}>
                  {`${more} more match${
                    more === 1 ? '' : 'es'
                  } — keep typing to narrow it down.`}
                </Text>
              ) : null}

              {!ready ? (
                <View style={styles.stateRow}>
                  <Icon name="search" size={12} color={palette.slate400} />
                  <Text style={styles.stateText}>
                    {query.length === 0
                      ? `Type the first ${minChars} letters of the name or company.`
                      : `Keep typing — ${minChars - query.length} more letter${
                          minChars - query.length === 1 ? '' : 's'
                        }.`}
                  </Text>
                </View>
              ) : loading && !hasMatches ? (
                <View style={styles.stateRow}>
                  <ActivityIndicator size="small" color={palette.gold} />
                  <Text style={styles.stateText}>Searching…</Text>
                </View>
              ) : failed ? (
                <Pressable
                  onPress={() => setAttempt(n => n + 1)}
                  style={styles.stateRow}
                  accessibilityRole="button"
                  accessibilityLabel="Retry the customer search"
                >
                  <Icon name="alert-circle" size={12} color={palette.red} />
                  <Text style={styles.stateText}>
                    Could not search customers — tap to try again.
                  </Text>
                </Pressable>
              ) : !hasMatches ? (
                <Text style={styles.emptyText}>
                  {`No customer matches “${query}”.`}
                </Text>
              ) : null}

              {onAddNew ? (
                <Pressable
                  onPress={() => onAddNew(query)}
                  style={({ pressed }) => [
                    styles.addRow,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Add a new customer"
                >
                  <Icon name="user-plus" size={12} color={palette.red} />
                  <Text style={styles.addText} numberOfLines={2}>
                    {ready && !hasMatches
                      ? `Add “${query}” as a new customer`
                      : 'Other — add a new customer'}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },

  panel: {
    marginTop: s(6),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(7),
    paddingHorizontal: s(11),
    backgroundColor: palette.surfaceAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  panelTitle: font(9, '800', { color: palette.slate500, letterSpacing: 0.6 }),

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
    paddingVertical: s(8),
    paddingHorizontal: s(11),
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.divider,
  },
  rowPressed: { backgroundColor: palette.surfaceAlt },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: s(6) },

  avatar: {
    width: s(28),
    height: s(28),
    borderRadius: radius.full,
    backgroundColor: palette.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: font(9, '800', { color: palette.navy }),

  primary: font(11, '800', { color: palette.navy, lineHeight: 1.3 }),
  secondary: {
    ...font(9, '400', { color: palette.slate500, lineHeight: 1.35 }),
    marginTop: s(2),
  },
  match: font(11, '800', { color: palette.goldDark, lineHeight: 1.3 }),
  matchSecondary: font(9, '700', { color: palette.goldDark }),
  unverified: {
    ...font(7, '800', { color: palette.red, letterSpacing: 0.5 }),
    marginTop: s(2),
  },

  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: s(10),
    paddingHorizontal: s(11),
  },
  stateText: { ...font(9, '500', { color: palette.slate400 }), flex: 1 },
  emptyText: {
    ...font(9, '500', { color: palette.slate400 }),
    paddingVertical: s(10),
    paddingHorizontal: s(11),
  },
  moreText: {
    ...font(8, '600', { color: palette.slate400 }),
    paddingHorizontal: s(11),
    paddingTop: s(7),
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: s(10),
    paddingHorizontal: s(11),
    backgroundColor: palette.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.divider,
  },
  addText: { ...font(10, '800', { color: palette.red }), flex: 1 },
});
