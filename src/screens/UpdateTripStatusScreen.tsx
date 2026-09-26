import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  AppHeader,
  Button,
  Card,
  Content,
  Icon,
  ImageSourceSheet,
  Input,
  ListState,
  Screen,
} from '@components/index';
import { ConfirmDialog } from '@components/modals/ConfirmDialog';
import type { ConfirmTone } from '@components/modals/ConfirmDialog';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { s } from '@theme/metrics';
import type { IconName } from '@components/common/Icon';
import type { RootStackParamList } from '@navigation/types';
import { tripService } from '@services/fleet.service';
import { uploadService } from '@services/upload.service';
import { useApi } from '@hooks/useApi';
import { useDocumentPicker, useImagePicker } from '@hooks/useImagePicker';
import type { PickedImage } from '@hooks/useImagePicker';

/**
 * Update Trip Status — the office's manual control over a trip's lifecycle.
 *
 * The driver app drives a trip through its states from the road, but the office
 * needs the same power for the trips a driver cannot: a run started before the
 * driver marked it, a delivery confirmed over the radio, a trip that must be
 * called off. It offers only the moves the trip's current state allows — a
 * scheduled trip can start, an in-transit one can be delivered, either can be
 * cancelled — and a settled trip is left alone. Every action posts to the same
 * endpoints the driver app uses, so the vehicle, driver and booking move the
 * one, consistent way. Recording a delivery here does not close the trip: that
 * waits for the customer's confirmation and the office's approval, on the trip
 * screen.
 */
type Nav = NativeStackNavigationProp<RootStackParamList, 'UpdateTripStatus'>;
type Rt = RouteProp<RootStackParamList, 'UpdateTripStatus'>;

type Dialog = {
  tone: ConfirmTone;
  icon?: IconName;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
};

/** The pickup paperwork, the same four slots as the driver app and the web. */
const PICKUP_DOCS: Array<{ key: string; kind: string; label: string }> = [
  { key: 'waybill', kind: 'WAYBILL', label: 'Waybill' },
  { key: 'eway', kind: 'EWAY', label: 'E-way Bill' },
  { key: 'invoice', kind: 'INVOICE', label: 'Invoice' },
  { key: 'lr', kind: 'LR', label: 'LR' },
];

/** Where the image sheet is attaching to: a document slot, or the loading photos. */
type PickTarget = { doc: string } | 'photos' | 'pod' | null;

/**
 * The booking's declared weight as the field shows it — `"12.50"` or `12.5`
 * becomes `12.5`, `12.00` becomes `12`. Blank when the booking has none.
 */
function tonsText(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const tons = Number(value);
  return Number.isFinite(tons) && tons > 0 ? String(tons) : '';
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: palette.gold },
  IN_TRANSIT: { label: 'In Transit', color: palette.gold },
  DELIVERED: { label: 'Delivered', color: palette.navy },
  CANCELLED: { label: 'Cancelled', color: palette.red },
};

export const UpdateTripStatusScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { tripId } = useRoute<Rt>().params;

  const trip = useApi(() => tripService.get(tripId), [tripId]);

  const [mode, setMode] = useState<'complete' | 'cancel' | 'pickup' | null>(
    null,
  );
  const [loadedWeight, setLoadedWeight] = useState('');
  const [pickupDocs, setPickupDocs] = useState<Record<string, PickedImage>>({});
  const [loadingPhotos, setLoadingPhotos] = useState<PickedImage[]>([]);
  const [pickTarget, setPickTarget] = useState<PickTarget>(null);
  const [progress, setProgress] = useState('');
  const { fromCamera, fromGallery } = useImagePicker();
  const { pickDocument } = useDocumentPicker();
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [podFiles, setPodFiles] = useState<PickedImage[]>([]);
  const [remarks, setRemarks] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const data = (trip.data ?? null) as Record<string, any> | null;
  const reference: string = data?.reference ?? '';
  const status: string = data?.status ?? '';
  /*
   * Delivered on the road but not yet closed: the trip stays IN_TRANSIT until
   * the customer confirms and the office completes it from the trip screen.
   * The server refuses pickups, milestones and cancelling from here on, so
   * this screen treats it as settled rather than offering moves that fail.
   */
  const handedOver = status === 'IN_TRANSIT' && Boolean(data?.deliveredAt);
  const meta = handedOver
    ? { label: 'Delivered · awaiting completion', color: palette.green }
    : (STATUS_META[status] ?? { label: status, color: palette.slate500 });
  const live = (status === 'SCHEDULED' || status === 'IN_TRANSIT') && !handedOver;
  /*
   * The load is on board once the pickup milestone is on the timeline — the
   * driver app files it on Confirm Pickup, the office through Start pickup
   * here. Delivery is locked until then, exactly as on the web panel.
   */
  const events: Array<{ stage?: string }> = Array.isArray(data?.events)
    ? data.events
    : [];
  const pickupDone = events.some(e => e.stage === 'PICKUP_COMPLETED');
  // The office rarely weighs the load itself — start from what was booked.
  const declaredWeight = tonsText(data?.booking?.weightTons);

  const succeed = useCallback(
    (title: string, message: string) =>
      setDialog({
        tone: 'success',
        icon: 'check-circle-2',
        title,
        message,
        confirmLabel: 'Done',
        onConfirm: () => {
          setDialog(null);
          navigation.goBack();
        },
      }),
    [navigation],
  );

  const failWith = useCallback(
    (message: string) =>
      setDialog({
        tone: 'danger',
        icon: 'alert-circle',
        title: 'Could not update the trip',
        message,
        confirmLabel: 'Close',
        onConfirm: () => setDialog(null),
      }),
    [],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>, title: string, message: string) => {
      setBusy(true);
      try {
        await action();
        succeed(title, message);
      } catch (error) {
        failWith(
          error instanceof Error ? error.message : 'That action failed',
        );
      } finally {
        setBusy(false);
      }
    },
    [succeed, failWith],
  );

  const askStart = useCallback(() => {
    setDialog({
      tone: 'gold',
      icon: 'arrow-right',
      title: `Start #${reference}?`,
      message:
        'The trip moves to In Transit and the lorry is marked on the road.',
      confirmLabel: 'Start trip',
      cancelLabel: 'Cancel',
      onConfirm: () =>
        run(
          () => tripService.start(tripId),
          'Trip started',
          `#${reference} is now in transit.`,
        ),
    });
  }, [reference, run, tripId]);

  /*
   * The booking already names who takes the load — pre-filled, so the office
   * confirms rather than retypes it. Typed from scratch, a real delivery was
   * recorded as received by "fsjg khjag".
   */
  const bookingReceiver: string = data?.booking?.receiverName ?? '';
  const openComplete = useCallback(() => {
    setReceiverName(bookingReceiver);
    setReceiverPhone(data?.booking?.receiverPhone ?? '');
    setRemarks('');
    setPodFiles([]);
    setMode('complete');
  }, [bookingReceiver, data?.booking?.receiverPhone]);

  const confirmComplete = useCallback(() => {
    if (receiverName.trim().length < 2) {
      failWith('Enter the name of who received the load.');
      return;
    }
    const phone = receiverPhone.trim();
    if (phone && phone.replace(/\D/g, '').length < 10) {
      failWith("Enter the receiver's 10-digit mobile number, or leave it blank.");
      return;
    }
    const files = [...podFiles];
    run(
      async () => {
        /*
         * Proof of delivery first, then the delivery — never a delivered trip
         * with an empty POD gallery. Each file leaves the form once filed, so a retry
         * after a dropped connection never sends the same photo twice.
         */
        for (const [i, file] of files.entries()) {
          setProgress(`Uploading ${i + 1} of ${files.length}…`);
          const stored = await uploadService.upload(file);
          await tripService.attachDocument(tripId, {
            name: file.fileName || `POD-${reference}-${i + 1}.jpg`,
            kind: 'POD',
            fileUrl: stored.url,
            sizeBytes: stored.size,
          });
          setPodFiles(prev => prev.filter(f => f !== file));
        }
        setProgress('Marking delivered…');
        await tripService.complete(tripId, {
          receiverName: receiverName.trim(),
          receiverPhone: phone || undefined,
          remarks: remarks.trim() || undefined,
        });
      },
      'Marked delivered',
      `#${reference} is delivered. It completes once the customer confirms and you approve it from the trip — the lorry and driver stay on it until then.`,
    ).finally(() => setProgress(''));
  }, [
    receiverName,
    receiverPhone,
    remarks,
    podFiles,
    run,
    tripId,
    reference,
    failWith,
  ]);

  const openPickup = useCallback(() => {
    setLoadedWeight(declaredWeight);
    setPickupDocs({});
    setLoadingPhotos([]);
    setMode('pickup');
  }, [declaredWeight]);

  /** Attaches what the image sheet picked to the slot it was opened for. */
  const attachPicked = useCallback(
    async (pickFn: () => Promise<PickedImage[]>) => {
      const target = pickTarget;
      setPickTarget(null);
      const picked = await pickFn();
      if (!picked.length || !target) {
        return;
      }
      if (target === 'photos') {
        setLoadingPhotos(prev => [...prev, ...picked]);
      } else if (target === 'pod') {
        setPodFiles(prev => [...prev, ...picked]);
      } else {
        setPickupDocs(prev => ({ ...prev, [target.doc]: picked[0] }));
      }
    },
    [pickTarget],
  );

  const confirmPickup = useCallback(() => {
    const text = loadedWeight.trim().replace(',', '.');
    const loadedTons = text ? Number(text) : undefined;
    if (
      loadedTons !== undefined &&
      (!Number.isFinite(loadedTons) || loadedTons <= 0 || loadedTons > 100)
    ) {
      failWith('Enter the loaded weight in tons, e.g. 12.5 — or leave it blank.');
      return;
    }
    const docs = PICKUP_DOCS.filter(d => pickupDocs[d.key]);
    const total = docs.length + loadingPhotos.length;
    run(
      async () => {
        let done = 0;
        const tick = () =>
          setProgress(
            total ? `Uploading ${Math.min(done + 1, total)} of ${total}…` : '',
          );
        /*
         * Each file leaves the form once it is filed, so a retry after a
         * dropped connection sends only what is left — never the same scan
         * twice.
         */
        for (const doc of docs) {
          const file = pickupDocs[doc.key];
          tick();
          const stored = await uploadService.upload(file);
          await tripService.attachDocument(tripId, {
            name: file.fileName || `${doc.kind}-${reference}`,
            kind: doc.kind,
            fileUrl: stored.url,
            sizeBytes: stored.size,
          });
          done += 1;
          setPickupDocs(prev => {
            const next = { ...prev };
            delete next[doc.key];
            return next;
          });
        }
        for (const [i, photo] of loadingPhotos.entries()) {
          tick();
          const stored = await uploadService.upload(photo);
          await tripService.attachDocument(tripId, {
            name: photo.fileName || `OTHER-${reference}-${i + 1}.jpg`,
            kind: 'OTHER',
            fileUrl: stored.url,
            sizeBytes: stored.size,
          });
          done += 1;
          setLoadingPhotos(prev => prev.filter(p => p !== photo));
        }
        setProgress('Confirming pickup…');
        await tripService.pickupComplete(tripId, loadedTons);
      },
      'Pickup complete',
      `#${reference} is loaded — Mark as Delivered is now unlocked.`,
    ).finally(() => setProgress(''));
  }, [loadedWeight, pickupDocs, loadingPhotos, run, tripId, reference, failWith]);

  const confirmCancel = useCallback(() => {
    run(
      () => tripService.cancel(tripId, reason.trim() || 'Cancelled by the office'),
      'Trip cancelled',
      `#${reference} has been cancelled and the lorry freed.`,
    );
  }, [reason, run, tripId, reference]);

  return (
    <Screen backgroundColor={palette.white}>
      <AppHeader
        title="Trip Status"
        subtitle={reference ? `#${reference}` : 'Loading…'}
        showBack
        onBackPress={navigation.goBack}
      />

      <Content>
        <ListState
          loading={trip.loading}
          error={trip.error}
          empty={!trip.loading && !trip.error && !data}
          what="trip"
          emptyIcon="truck"
          emptyHint="This trip could not be found."
          onRetry={trip.refetch}
        />

        {data ? (
          <>
            <Card padding={14} style={styles.card}>
              <Text style={styles.kicker}>CURRENT STATUS</Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: meta.color }]} />
                <Text style={styles.statusText}>{meta.label}</Text>
              </View>
            </Card>

            {!live ? (
              <Card padding={14} style={styles.settled}>
                <Icon name="check-circle-2" size={18} color={palette.navy} />
                <Text style={styles.settledText}>
                  {handedOver
                    ? 'This trip is delivered. Complete it from the trip screen once the customer has confirmed — its status can no longer be changed here.'
                    : `This trip is ${meta.label.toLowerCase()} — its status is settled and cannot be changed.`}
                </Text>
              </Card>
            ) : mode === 'complete' ? (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>MARK AS DELIVERED</Text>
                <Input
                  label="Received by"
                  placeholder="Name of who took the load"
                  value={receiverName}
                  onChangeText={setReceiverName}
                  autoCapitalize="words"
                />
                <Text style={styles.hint}>
                  {bookingReceiver &&
                  receiverName.trim() === bookingReceiver.trim()
                    ? 'The receiver on the booking — change it if someone else took the load.'
                    : 'Who actually signed for the load.'}
                </Text>
                <Input
                  label="Receiver mobile (optional)"
                  placeholder="e.g. 98765 43210"
                  value={receiverPhone}
                  onChangeText={setReceiverPhone}
                  keyboardType="phone-pad"
                />
                <Input
                  label="Remarks (optional)"
                  placeholder="Any note on the delivery"
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                />

                <Text style={styles.subKicker}>PROOF OF DELIVERY</Text>
                <Pressable
                  style={[styles.slot, podFiles.length ? styles.slotDone : null]}
                  onPress={() => setPickTarget('pod')}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Add proof of delivery"
                >
                  <Icon
                    name={podFiles.length ? 'check-circle-2' : 'camera'}
                    size={16}
                    color={podFiles.length ? palette.green : palette.navy}
                  />
                  <View style={styles.slotText}>
                    <Text style={styles.slotLabel}>
                      {podFiles.length
                        ? `${podFiles.length} file${podFiles.length > 1 ? 's' : ''} ready`
                        : 'Signed challan, photos or POD scan'}
                    </Text>
                    <Text style={styles.slotMeta}>
                      Optional · photo or PDF · tap to add
                    </Text>
                  </View>
                  {podFiles.length ? (
                    <Pressable
                      hitSlop={10}
                      onPress={() => setPodFiles([])}
                      accessibilityLabel="Remove proof of delivery"
                    >
                      <Icon name="x" size={16} color={palette.slate500} />
                    </Pressable>
                  ) : (
                    <Icon name="upload" size={16} color={palette.slate500} />
                  )}
                </Pressable>

                {/* No "approve now" any more: a trip completes only when the
                    customer has confirmed too, which cannot have happened to a
                    delivery only now being recorded. The trip screen's
                    completion checklist takes it from here. */}
                <Text style={styles.fieldHint}>
                  The trip stays open, with the lorry and driver on it, until
                  the customer confirms and you complete it.
                </Text>

                <Button
                  label={busy ? progress || 'Saving…' : 'Confirm Delivery'}
                  variant="gold"
                  icon="package-check"
                  loading={busy}
                  disabled={busy}
                  onPress={confirmComplete}
                  style={styles.action}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setMode(null)}
                />
              </Card>
            ) : mode === 'pickup' ? (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>START PICKUP</Text>
                <Text style={styles.help}>
                  Record the pickup the way the driver app does. Everything here
                  is optional — confirming marks the load as picked up.
                </Text>
                <Input
                  label="Loaded weight (tons)"
                  placeholder="e.g. 12.5"
                  value={loadedWeight}
                  onChangeText={setLoadedWeight}
                  keyboardType="decimal-pad"
                />
                {/* Says where the figure came from, so a booked weight is
                    not mistaken for one somebody put on a weighbridge. */}
                {!declaredWeight ? (
                  <Text style={styles.fieldHint}>
                    Not on the booking — leave blank if unknown.
                  </Text>
                ) : loadedWeight.trim() === declaredWeight ? (
                  <Text style={styles.fieldHint}>
                    Declared on the booking — change it if the actual load
                    differs.
                  </Text>
                ) : null}

                <Text style={styles.subKicker}>DOCUMENTS</Text>
                {PICKUP_DOCS.map(doc => {
                  const file = pickupDocs[doc.key];
                  return (
                    <Pressable
                      key={doc.key}
                      style={[styles.slot, file ? styles.slotDone : null]}
                      onPress={() => setPickTarget({ doc: doc.key })}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`Attach ${doc.label}`}
                    >
                      <Icon
                        name={file ? 'check-circle-2' : 'file-text'}
                        size={16}
                        color={file ? palette.green : palette.navy}
                      />
                      <View style={styles.slotText}>
                        <Text style={styles.slotLabel}>{doc.label}</Text>
                        <Text style={styles.slotMeta} numberOfLines={1}>
                          {file ? file.fileName : 'Tap to attach a photo or PDF'}
                        </Text>
                      </View>
                      {file ? (
                        <Pressable
                          hitSlop={10}
                          onPress={() =>
                            setPickupDocs(prev => {
                              const next = { ...prev };
                              delete next[doc.key];
                              return next;
                            })
                          }
                          accessibilityLabel={`Remove ${doc.label}`}
                        >
                          <Icon name="x" size={16} color={palette.slate500} />
                        </Pressable>
                      ) : (
                        <Icon name="upload" size={16} color={palette.slate500} />
                      )}
                    </Pressable>
                  );
                })}

                <Text style={styles.subKicker}>LOADING PHOTOS</Text>
                <Pressable
                  style={[
                    styles.slot,
                    loadingPhotos.length ? styles.slotDone : null,
                  ]}
                  onPress={() => setPickTarget('photos')}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Add loading photos"
                >
                  <Icon
                    name={loadingPhotos.length ? 'check-circle-2' : 'camera'}
                    size={16}
                    color={loadingPhotos.length ? palette.green : palette.navy}
                  />
                  <View style={styles.slotText}>
                    <Text style={styles.slotLabel}>
                      {loadingPhotos.length
                        ? `${loadingPhotos.length} photo${loadingPhotos.length > 1 ? 's' : ''} ready`
                        : 'Photos of the loaded goods'}
                    </Text>
                    <Text style={styles.slotMeta}>Tap to add more</Text>
                  </View>
                  {loadingPhotos.length ? (
                    <Pressable
                      hitSlop={10}
                      onPress={() => setLoadingPhotos([])}
                      accessibilityLabel="Remove loading photos"
                    >
                      <Icon name="x" size={16} color={palette.slate500} />
                    </Pressable>
                  ) : (
                    <Icon name="upload" size={16} color={palette.slate500} />
                  )}
                </Pressable>

                <Button
                  label={busy ? progress || 'Saving…' : 'Confirm Pickup'}
                  variant="gold"
                  icon="package-check"
                  loading={busy}
                  disabled={busy}
                  onPress={confirmPickup}
                  style={styles.action}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setMode(null)}
                />
              </Card>
            ) : mode === 'cancel' ? (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>CANCEL TRIP</Text>
                <Input
                  label="Reason"
                  placeholder="Why is this trip being cancelled?"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Button
                  label={busy ? 'Cancelling…' : 'Confirm Cancellation'}
                  variant="red"
                  icon="alert-triangle"
                  loading={busy}
                  disabled={busy}
                  onPress={confirmCancel}
                  style={styles.action}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setMode(null)}
                />
              </Card>
            ) : (
              <Card padding={14} style={styles.card}>
                <Text style={styles.kicker}>CHANGE STATUS</Text>
                {status === 'SCHEDULED' ? (
                  <Button
                    label="Start Trip · Ongoing"
                    variant="gold"
                    icon="arrow-right"
                    onPress={askStart}
                    style={styles.action}
                  />
                ) : null}
                {status === 'IN_TRANSIT' ? (
                  <>
                    {/*
                      * Both steps always show; only the one the trip is up to
                      * is live — the same as the web panel. Before pickup,
                      * Start pickup is live and delivery is locked; after it,
                      * Start pickup reads done and delivery unlocks.
                      */}
                    <Button
                      label={pickupDone ? 'Pickup Complete' : 'Start Pickup'}
                      variant={pickupDone ? 'outline' : 'gold'}
                      icon={pickupDone ? 'check-circle-2' : 'file-text'}
                      disabled={pickupDone}
                      onPress={openPickup}
                      style={styles.action}
                    />
                    <Button
                      label="Mark as Delivered"
                      variant="gold"
                      icon={pickupDone ? 'package-check' : 'lock'}
                      disabled={!pickupDone}
                      onPress={openComplete}
                      style={styles.action}
                    />
                    {!pickupDone ? (
                      <Text style={styles.lockNote}>
                        Delivery unlocks once the pickup is complete.
                      </Text>
                    ) : null}
                  </>
                ) : null}
                <Button
                  label="Cancel Trip"
                  variant="outline"
                  icon="alert-triangle"
                  color={palette.red}
                  borderColor={palette.redSoft}
                  onPress={() => setMode('cancel')}
                  style={styles.action}
                />
              </Card>
            )}
          </>
        ) : null}
      </Content>

      <ImageSourceSheet
        visible={pickTarget !== null}
        onClose={() => setPickTarget(null)}
        onCamera={() => attachPicked(fromCamera)}
        onGallery={() =>
          attachPicked(() =>
            fromGallery(pickTarget === 'photos' || pickTarget === 'pod' ? 10 : 1),
          )
        }
        // Papers can be PDFs; loading photos are photographs.
        onDocument={
          pickTarget === 'photos' ? undefined : () => attachPicked(pickDocument)
        }
        title={
          pickTarget === 'photos'
            ? 'Loading Photos'
            : pickTarget === 'pod'
              ? 'Proof of Delivery'
              : 'Attach Document'
        }
        subtitle="JPG · PNG · PDF"
      />

      <ConfirmDialog
        visible={dialog !== null}
        tone={dialog?.tone}
        icon={dialog?.icon}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        busy={busy}
        onConfirm={() => dialog?.onConfirm()}
        onCancel={() => (busy ? undefined : setDialog(null))}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: s(10) },
  kicker: {
    ...font(9, '800', { color: palette.red, letterSpacing: 1 }),
    marginBottom: s(8),
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  dot: { width: s(9), height: s(9), borderRadius: s(5) },
  statusText: font(14, '800', { color: palette.navy }),
  action: { marginTop: s(10) },
  hint: {
    ...font(10, '500', { color: palette.slate500 }),
    marginTop: s(-4),
    marginBottom: s(10),
  },
  help: {
    ...font(11, '500', { color: palette.slate500 }),
    marginBottom: s(10),
  },
  fieldHint: {
    ...font(10, '500', { color: palette.slate500, lineHeight: 1.4 }),
    marginTop: s(4),
  },
  subKicker: {
    ...font(9, '800', { color: palette.navy, letterSpacing: 1 }),
    marginTop: s(6),
    marginBottom: s(6),
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: s(10),
    paddingVertical: s(10),
    paddingHorizontal: s(12),
    marginBottom: s(8),
  },
  slotDone: {
    borderColor: palette.green,
    backgroundColor: palette.greenTint,
  },
  // Margins, not `gap`: column gap misbehaves on the New Architecture here.
  slotText: { flex: 1, marginHorizontal: s(10) },
  slotLabel: font(12, '700', { color: palette.navy }),
  slotMeta: font(10, '500', { color: palette.slate500 }),
  lockNote: {
    ...font(10, '600', { color: palette.slate500 }),
    textAlign: 'center',
    marginTop: s(6),
  },
  settled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    backgroundColor: palette.navyTint,
  },
  settledText: { ...font(11, '600', { color: palette.navy }), flex: 1 },
});
