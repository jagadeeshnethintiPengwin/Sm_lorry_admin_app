import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  BottomSheet,
  Button,
  Card,
  Content,
  DateField,
  Input,
  ListState,
  Screen,
  Select,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import {
  tripService,
  type TripExpenseRow,
  type TripFinance,
  type TripPaymentRow,
} from '@services/fleet.service';
import { useApi } from '@hooks/useApi';
import { rupee } from './reportDefs';

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'CARD', 'OTHER'];
const EXPENSE_CATEGORIES = [
  'FUEL',
  'OIL',
  'TOLL',
  'FOOD',
  'LOADING',
  'UNLOADING',
  'REPAIR',
  'OTHER',
];
const today = () => new Date().toISOString().slice(0, 10);
const nice = (v: string) => v.charAt(0) + v.slice(1).toLowerCase();
const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * A trip's money — revenue billed, payments received against it, and the
 * running costs of the run — matching the web admin's Revenue & Payments tab.
 * Payments and expenses are added from bottom sheets and the totals recompute.
 */
export const TripFinanceScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'TripFinance'>>();
  const { tripId, reference } = params;

  const { data, loading, error, refetch } = useApi(
    () => tripService.finance(tripId),
    [tripId],
  );
  const [override, setOverride] = useState<TripFinance | null>(null);
  const fin = override ?? data;

  const [sheet, setSheet] = useState<'payment' | 'expense' | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pay, setPay] = useState({
    mode: PAYMENT_MODES[0],
    amount: '',
    paidAt: today(),
    reference: '',
    note: '',
  });
  const [exp, setExp] = useState({
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    spentAt: today(),
    note: '',
  });

  const closeSheet = useCallback(() => {
    if (!busy) {
      setSheet(null);
      setFormError('');
    }
  }, [busy]);

  const submitPayment = async () => {
    const amount = Number(pay.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter an amount above zero.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const updated = await tripService.addPayment(tripId, {
        mode: pay.mode,
        amount,
        paidAt: pay.paidAt,
        ...(pay.reference.trim() ? { reference: pay.reference.trim() } : {}),
        ...(pay.note.trim() ? { note: pay.note.trim() } : {}),
      });
      setOverride(updated);
      setSheet(null);
      setPay({ mode: PAYMENT_MODES[0], amount: '', paidAt: today(), reference: '', note: '' });
    } catch {
      setFormError('Could not record the payment. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitExpense = async () => {
    const amount = Number(exp.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const updated = await tripService.addExpense(tripId, {
        category: exp.category,
        amount,
        spentAt: exp.spentAt,
        ...(exp.note.trim() ? { note: exp.note.trim() } : {}),
      });
      setOverride(updated);
      setSheet(null);
      setExp({ category: EXPENSE_CATEGORIES[0], amount: '', spentAt: today(), note: '' });
    } catch {
      setFormError('Could not record the expense. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const tiles = useMemo(() => {
    const bal = fin?.balance ?? fin?.revenue ?? 0;
    const net = fin?.net ?? fin?.revenue ?? 0;
    return [
      { label: 'REVENUE', value: rupee(fin?.revenue ?? 0), color: palette.navy },
      { label: 'RECEIVED', value: rupee(fin?.received ?? 0), color: '#16a34a' },
      { label: 'BALANCE', value: rupee(bal), color: bal > 0 ? palette.red : '#16a34a' },
      { label: 'EXPENSES', value: rupee(fin?.expenses ?? 0), color: palette.gold },
      { label: 'NET', value: rupee(net), color: net >= 0 ? '#16a34a' : palette.red },
    ];
  }, [fin]);

  const status = useMemo(() => {
    const rev = fin?.revenue ?? 0;
    const bal = fin?.balance ?? rev;
    if (rev > 0 && bal <= 0) return { label: 'PAID', color: '#16a34a' };
    if ((fin?.received ?? 0) > 0) return { label: 'PART PAID', color: palette.gold };
    return { label: 'UNPAID', color: palette.red };
  }, [fin]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Revenue & Payments"
        subtitle={`#${reference}`}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content padding={12} safeBottom>
        <ListState
          loading={loading && !fin}
          error={error}
          empty={false}
          what="finance"
          onRetry={refetch}
        />

        {fin ? (
          <>
            {/* Summary */}
            <Card padding={13}>
              <View style={styles.tiles}>
                {tiles.map(t => (
                  <View key={t.label} style={styles.tile}>
                    <Text style={[styles.tileValue, { color: t.color }]}>{t.value}</Text>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                  </View>
                ))}
                <View style={[styles.tile, styles.statusTile]}>
                  <View style={[styles.statusPill, { backgroundColor: status.color }]}>
                    <Text style={styles.statusText}>{status.label}</Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Payments */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>
                PAYMENTS RECEIVED · {fin.payments.count}
              </Text>
              <Button
                label="Add"
                variant="outline"
                icon="plus-circle"
                fontSize={11}
                padding={6}
                onPress={() => {
                  setFormError('');
                  setSheet('payment');
                }}
              />
            </View>
            {fin.payments.items.length ? (
              fin.payments.items.map((p: TripPaymentRow) => (
                <Card key={p.id} padding={10}>
                  <View style={styles.row}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{p.mode}</Text>
                    </View>
                    <View style={styles.body}>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[dateOf(p.paidAt), p.reference, p.note].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{rupee(Number(p.amount))}</Text>
                  </View>
                </Card>
              ))
            ) : (
              <Text style={styles.empty}>No payments recorded yet.</Text>
            )}

            {/* Expenses */}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>
                TRIP EXPENSES · {fin.costs.count}
              </Text>
              <Button
                label="Add"
                variant="outline"
                icon="plus-circle"
                fontSize={11}
                padding={6}
                onPress={() => {
                  setFormError('');
                  setSheet('expense');
                }}
              />
            </View>
            {fin.costs.items.length ? (
              fin.costs.items.map((e: TripExpenseRow) => (
                <Card key={e.id} padding={10}>
                  <View style={styles.row}>
                    <View style={[styles.chip, styles.chipGold]}>
                      <Text style={[styles.chipText, styles.chipTextGold]}>
                        {nice(e.category)}
                      </Text>
                    </View>
                    <View style={styles.body}>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[dateOf(e.spentAt), e.note].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{rupee(Number(e.amount))}</Text>
                  </View>
                </Card>
              ))
            ) : (
              <Text style={styles.empty}>
                No expenses yet — add diesel, oil, toll and the rest.
              </Text>
            )}
          </>
        ) : null}
      </Content>

      {/* Add payment */}
      <BottomSheet visible={sheet === 'payment'} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>Record a payment</Text>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Select
          label="Mode"
          options={PAYMENT_MODES.map(m => ({ label: nice(m), value: m }))}
          value={pay.mode}
          onChange={v => setPay({ ...pay, mode: v })}
        />
        <Input
          label="Amount (₹)"
          keyboardType="numeric"
          value={pay.amount}
          onChangeText={v => setPay({ ...pay, amount: v })}
          placeholder="5000"
        />
        <DateField
          label="Paid on"
          value={pay.paidAt}
          onChange={v => setPay({ ...pay, paidAt: v })}
        />
        <Input
          label="Reference"
          value={pay.reference}
          onChangeText={v => setPay({ ...pay, reference: v })}
          placeholder="UPI / cheque / receipt no"
        />
        <Input
          label="Note"
          value={pay.note}
          onChangeText={v => setPay({ ...pay, note: v })}
          placeholder="e.g. Balance settled at drop"
        />
        <Button
          label={busy ? 'Saving…' : 'Add payment'}
          variant="gold"
          icon="plus-circle"
          loading={busy}
          disabled={busy}
          onPress={submitPayment}
        />
      </BottomSheet>

      {/* Add expense */}
      <BottomSheet visible={sheet === 'expense'} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>Add trip expense</Text>
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Select
          label="Category"
          options={EXPENSE_CATEGORIES.map(c => ({ label: nice(c), value: c }))}
          value={exp.category}
          onChange={v => setExp({ ...exp, category: v })}
        />
        <Input
          label="Amount (₹)"
          keyboardType="numeric"
          value={exp.amount}
          onChangeText={v => setExp({ ...exp, amount: v })}
          placeholder="3200"
        />
        <DateField
          label="Spent on"
          value={exp.spentAt}
          onChange={v => setExp({ ...exp, spentAt: v })}
        />
        <Input
          label="Note"
          value={exp.note}
          onChangeText={v => setExp({ ...exp, note: v })}
          placeholder="e.g. Diesel at Vijayawada bunk"
        />
        <Button
          label={busy ? 'Saving…' : 'Add expense'}
          variant="gold"
          icon="plus-circle"
          loading={busy}
          disabled={busy}
          onPress={submitExpense}
        />
      </BottomSheet>
    </Screen>
  );
};

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '33.33%', paddingVertical: s(6) },
  tileValue: font(14, '800'),
  tileLabel: font(8, '800', { color: palette.slate500, letterSpacing: 0.6 }),
  statusTile: { alignItems: 'flex-start', justifyContent: 'center' },
  statusPill: {
    paddingVertical: s(3),
    paddingHorizontal: s(9),
    borderRadius: radius.sm,
  },
  statusText: font(9, '800', { color: palette.white }),

  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: s(16),
    marginBottom: s(8),
  },
  sectionLabel: font(9, '800', { color: palette.red, letterSpacing: 1 }),

  row: { flexDirection: 'row', alignItems: 'center', gap: s(9) },
  chip: {
    paddingVertical: s(2),
    paddingHorizontal: s(7),
    backgroundColor: palette.navyTint,
    borderRadius: radius.sm,
  },
  chipGold: { backgroundColor: palette.goldTint },
  chipText: font(8, '800', { color: palette.navy }),
  chipTextGold: { color: palette.goldText },
  body: { flex: 1, minWidth: 0 },
  rowMeta: font(9, '600', { color: palette.slate500 }),
  amount: font(12, '800', { color: palette.navy }),

  empty: {
    paddingVertical: s(10),
    textAlign: 'center',
    ...font(10, '600', { color: palette.slate500 }),
  },

  sheetTitle: {
    marginBottom: s(10),
    ...font(14, '800', { color: palette.navy }),
  },
  formError: {
    marginBottom: s(8),
    ...font(10, '700', { color: palette.red }),
  },
});
