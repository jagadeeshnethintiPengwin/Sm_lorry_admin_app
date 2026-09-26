import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  ConfirmDialog,
  Content,
  FieldError,
  FieldLabel,
  Footer,
  Icon,
  Input,
  Screen,
} from '@components/index';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import type { IconName } from '@components/common/Icon';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import { useApi } from '@hooks/useApi';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RequestDocuments'>;
type Rt = RouteProp<RootStackParamList, 'RequestDocuments'>;

type Dialog = {
  tone: ConfirmTone;
  icon: IconName;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

/** The papers a customer is usually asked for, one tap each. */
const QUICK_TYPES = [
  'E-way bill',
  'Invoice',
  'Waybill',
  'LR copy',
  'Delivery challan',
  'Weighment slip',
] as const;

/*
 * The server's own limits (`OfficeDocumentRequestDto`), so the form refuses
 * what the API would, while it is still being filled in.
 */
const MAX_TYPES = 8;
const TYPE_MAX = 60;
const NOTE_MAX = 200;

/** `" E-Way  Bill "` and `e-way bill` are the same paper. */
const keyOf = (type: string) => type.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * REQUEST DOCUMENTS — the office asking the customer for papers on a trip.
 *
 * The driver could already ask from the cab; the office, which is usually the
 * one chasing an e-way bill before the lorry can leave, could not. Each type
 * chosen becomes its own pending request, the customer is notified and
 * prompted on their shipment screen, and the office is told when they upload.
 *
 * A type already waiting on the customer is shown but locked — asking twice
 * would only send them a second notification for the same paper.
 */
export const RequestDocumentsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { tripId, reference, customerName } = useRoute<Rt>().params;
  const customer = customerName?.trim() || 'the customer';

  const { data: history, refetch: refetchHistory } = useApi(
    () => tripService.documentRequestHistory(tripId),
    [tripId],
  );

  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [otherError, setOtherError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  /*
   * What the customer still owes, keyed case-insensitively. Only requests of
   * the customer count — a paper the driver asked the office for is not the
   * customer's to send.
   */
  const pending = useMemo(() => {
    const rows = (history ?? []).filter(
      r => r.status === 'PENDING' && r.requestedFrom === 'customer',
    );
    const byKey = new Map<string, string>();
    for (const row of rows) {
      byKey.set(keyOf(row.documentType), row.documentType.trim());
    }
    return byKey;
  }, [history]);

  // Pending custom types, drawn locked after the quick picks.
  const pendingOthers = useMemo(() => {
    const quick = new Set(QUICK_TYPES.map(keyOf));
    return [...pending.entries()]
      .filter(([key]) => !quick.has(key))
      .map(([, label]) => label);
  }, [pending]);

  /*
   * What goes out: the quick picks in their fixed order, then the typed ones.
   * A pick that turned out to be pending once the history loaded is dropped
   * here rather than sent twice.
   */
  const types = useMemo(
    () => [
      ...QUICK_TYPES.filter(t => picked.includes(t) && !pending.has(keyOf(t))),
      ...custom.filter(t => !pending.has(keyOf(t))),
    ],
    [picked, custom, pending],
  );
  const full = types.length >= MAX_TYPES;

  const toggle = useCallback(
    (type: string) => {
      setPicked(prev =>
        prev.includes(type)
          ? prev.filter(t => t !== type)
          : types.length >= MAX_TYPES
          ? prev
          : [...prev, type],
      );
    },
    [types.length],
  );

  /** Adds the typed paper as its own chip — or ticks the quick pick it names. */
  const addOther = useCallback(() => {
    const label = other.trim().replace(/\s+/g, ' ');
    if (!label) {
      return;
    }
    const key = keyOf(label);
    if (pending.has(key)) {
      setOtherError(`${pending.get(key)} is already waiting on ${customer}.`);
      return;
    }
    const quick = QUICK_TYPES.find(t => keyOf(t) === key);
    const already = quick
      ? picked.includes(quick)
      : custom.some(t => keyOf(t) === key);
    if (!already && full) {
      setOtherError(`Up to ${MAX_TYPES} documents per request.`);
      return;
    }
    if (quick) {
      setPicked(prev => (prev.includes(quick) ? prev : [...prev, quick]));
    } else if (!already) {
      setCustom(prev => [...prev, label]);
    }
    setOther('');
    setOtherError('');
  }, [other, pending, customer, picked, custom, full]);

  const send = useCallback(async () => {
    if (busy || !types.length) {
      return;
    }
    setBusy(true);
    try {
      await tripService.requestDocuments(tripId, types, note);
      const count = types.length;
      // Cleared at once, so a dismissed dialog cannot lead to a second send.
      setPicked([]);
      setCustom([]);
      setNote('');
      refetchHistory();
      setDialog({
        tone: 'success',
        icon: 'check-circle-2',
        title: 'Request sent',
        message: `Requested ${count} document${
          count === 1 ? '' : 's'
        } from ${customer}. They have been notified and will see it on their shipment.`,
        confirmLabel: 'Done',
        onConfirm: () => {
          setDialog(null);
          navigation.goBack();
        },
      });
    } catch (error) {
      setDialog({
        tone: 'danger',
        icon: 'alert-circle',
        title: 'Could not send the request',
        message:
          error instanceof Error
            ? error.message
            : 'The request did not go through. Check your signal and try again.',
        confirmLabel: 'Close',
        onConfirm: () => setDialog(null),
      });
    } finally {
      setBusy(false);
    }
  }, [busy, types, tripId, note, refetchHistory, customer, navigation]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Request Documents"
        subtitle={reference ? `#${reference}` : undefined}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        {/* WHAT */}
        <Text style={styles.section}>
          DOCUMENTS <Text style={styles.star}>*</Text>
        </Text>
        <Card padding={12}>
          <Text style={styles.lead}>What does {customer} need to share?</Text>
          <View style={styles.chips}>
            {QUICK_TYPES.map(type => {
              const requested = pending.has(keyOf(type));
              const on = !requested && picked.includes(type);
              return (
                <Pressable
                  key={type}
                  onPress={() => toggle(type)}
                  disabled={requested || busy || (!on && full)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    requested ? `${type}, already requested` : type
                  }
                  accessibilityState={{ selected: on, disabled: requested }}
                  style={[
                    styles.chip,
                    on ? styles.chipOn : null,
                    requested ? styles.chipLocked : null,
                  ]}
                >
                  <Icon
                    name={requested ? 'clock' : on ? 'check' : 'plus'}
                    size={11}
                    color={
                      requested
                        ? palette.slate400
                        : on
                        ? palette.goldText
                        : palette.slate500
                    }
                  />
                  <Text
                    style={[
                      styles.chipText,
                      on ? styles.chipTextOn : null,
                      requested ? styles.chipTextLocked : null,
                    ]}
                  >
                    {type}
                  </Text>
                  {requested ? (
                    <Text style={styles.chipTag}>Requested</Text>
                  ) : null}
                </Pressable>
              );
            })}

            {/* Typed papers — always selected; the cross takes one back out.
                One found pending once the history loads is drawn below. */}
            {custom
              .filter(type => !pending.has(keyOf(type)))
              .map(type => (
                <Pressable
                  key={`custom-${type}`}
                  onPress={() =>
                    setCustom(prev => prev.filter(t => t !== type))
                  }
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${type}`}
                  style={[styles.chip, styles.chipOn]}
                >
                  <Text style={[styles.chipTextOn, styles.chipTextFirst]}>
                    {type}
                  </Text>
                  <View style={styles.chipX}>
                    <Icon name="x" size={11} color={palette.goldText} />
                  </View>
                </Pressable>
              ))}

            {/* Earlier typed requests still waiting — shown, not re-askable. */}
            {pendingOthers.map(type => (
              <View
                key={`pending-${type}`}
                accessibilityLabel={`${type}, already requested`}
                style={[styles.chip, styles.chipLocked]}
              >
                <Icon name="clock" size={11} color={palette.slate400} />
                <Text style={[styles.chipText, styles.chipTextLocked]}>
                  {type}
                </Text>
                <Text style={styles.chipTag}>Requested</Text>
              </View>
            ))}
          </View>

          <FieldLabel marginBottom={4} style={styles.otherLabel}>
            Other
          </FieldLabel>
          <View style={styles.otherRow}>
            <Input
              value={other}
              onChangeText={text => {
                setOther(text);
                setOtherError('');
              }}
              onSubmitEditing={addOther}
              returnKeyType="done"
              maxLength={TYPE_MAX}
              placeholder="e.g. Packing list"
              accessibilityLabel="Other document"
              editable={!busy}
              containerStyle={styles.otherInput}
            />
            <Button
              label="Add"
              variant="outline"
              icon="plus"
              iconSize={13}
              padding={9}
              paddingHorizontal={12}
              fontSize={11}
              gap={4}
              borderColor={palette.border}
              disabled={!other.trim() || busy}
              onPress={addOther}
              style={styles.otherAdd}
            />
          </View>
          <FieldError>{otherError}</FieldError>

          <Text style={styles.hint}>
            {full
              ? `That's the most one request can carry — ${MAX_TYPES} documents.`
              : `Each one is asked of ${customer} separately; they are notified and prompted on their shipment.`}
          </Text>
        </Card>

        {/* NOTE */}
        <Text style={[styles.section, styles.sectionGap]}>
          NOTE <Text style={styles.optional}>(optional)</Text>
        </Text>
        <Card padding={12}>
          <Input
            label="Note to the customer"
            labelNote={`${note.length}/${NOTE_MAX}`}
            labelNoteColor={palette.slate400}
            value={note}
            onChangeText={setNote}
            maxLength={NOTE_MAX}
            placeholder="Needed before the lorry leaves the yard"
            multiline
            minHeight={70}
            editable={!busy}
          />
        </Card>
      </Content>

      <Footer>
        <Button
          label={busy ? 'Sending…' : 'Send Request'}
          variant="gold"
          icon="send"
          padding={12}
          fontSize={13}
          loading={busy}
          disabled={!types.length || busy}
          onPress={send}
        />
      </Footer>

      <ConfirmDialog
        visible={dialog !== null}
        tone={dialog?.tone}
        icon={dialog?.icon}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={() => setDialog(null)}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  sectionGap: { marginTop: s(14) },
  star: font(9, '800', { color: palette.red }),
  optional: font(9, '700', { color: palette.slate400 }),

  lead: {
    ...font(11, '700', { color: palette.navy }),
    marginBottom: s(10),
  },

  // Margins, not `gap`: a wrapped row's cross-axis gap misbehaves on the New
  // Architecture, so each chip carries its own spacing.
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(5),
    paddingHorizontal: s(10),
    borderRadius: radius.full,
    borderWidth: s(1.5),
    borderColor: palette.gray200,
    backgroundColor: palette.white,
    marginRight: s(7),
    marginBottom: s(8),
  },
  chipOn: { borderColor: palette.gold, backgroundColor: palette.goldTint },
  chipLocked: {
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
  },
  chipText: { ...font(10, '700', { color: palette.navy }), marginLeft: s(4) },
  chipTextOn: font(10, '800', { color: palette.goldText }),
  chipTextLocked: { color: palette.slate400 },
  // A typed chip leads with its label, so it needs no gap before it.
  chipTextFirst: { marginLeft: 0 },
  chipTag: {
    ...font(8, '800', { color: palette.slate500, letterSpacing: 0.3 }),
    marginLeft: s(5),
  },
  chipX: { marginLeft: s(5) },

  otherLabel: { marginTop: s(4) },
  otherRow: { flexDirection: 'row', alignItems: 'center' },
  otherInput: { flex: 1 },
  // The button base is full width; beside the field it takes only its label.
  otherAdd: { width: 'auto', marginLeft: s(8) },

  hint: {
    ...font(9, '400', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(10),
  },
});
