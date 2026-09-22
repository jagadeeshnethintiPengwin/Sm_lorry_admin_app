import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  vehicleService,
  type AdminVehicleType,
} from '@services/fleet.service';
import { useApi } from '@hooks/useApi';
import { useImagePicker } from '@hooks/useImagePicker';
import type { PickedImage } from '@hooks/useImagePicker';
import { uploadService } from '@services/upload.service';
import { VEHICLE_ILLUSTRATIONS, vehicleImage } from '@assets/vehicleImages';

import {
  AppHeader,
  BottomSheet,
  Card,
  Content,
  Icon,
  Input,
  ListState,
  Screen,
  Select,
  Toggle,
} from '@components/index';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * Vehicle Types — the catalogue a customer picks from.
 *
 * The same catalogue the web panel manages. Both apps read `vehicles/types`,
 * which serves only the *selected* entries, so selecting a type here is what
 * puts it in front of customers. This screen reads `types/all` instead, so the
 * office can also see the ones that have been taken out — to bring them back or
 * correct a label.
 *
 * Deselecting is not deleting, and the wording says so: lorries and past
 * bookings still name the type, so it stays on the record and simply stops
 * being offered.
 */

const BODY_OPTIONS = ['Closed body', 'Open body', 'Container', 'Trailer'];

export const VehicleTypesScreen: React.FC = () => {
  const { data, loading, error, refetch } = useApi(() => vehicleService.allTypes(), []);
  const types: AdminVehicleType[] = data ?? [];

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [name, setName] = useState('');
  const [illustration, setIllustration] = useState(VEHICLE_ILLUSTRATIONS[0]);

  /*
   * A photograph of the actual lorry, chosen from the phone.
   *
   * The bundled pictures cover the fleet as it stands, but an office adding a
   * type this app has never shipped art for — a Bajaj auto, a 32-footer with
   * their own livery — should be able to show a customer the real thing. The
   * panel already allows it, and the two catalogues have to agree.
   *
   * Held as the picked file until Save: uploading on pick would leave an
   * orphaned file on the server every time somebody changed their mind.
   */
  const { fromGallery, isPicking } = useImagePicker();
  const [photo, setPhoto] = useState<PickedImage | null>(null);

  /*
   * Adding asks for the parts; editing shows the stored labels.
   *
   * The same split the web panel makes, and for the same reason. Someone adding
   * a type is describing a lorry — how long, what body, how much it carries —
   * and should not have to know that the catalogue stores two composed strings.
   * Someone editing is usually fixing a label that reads wrong, and rebuilding
   * it from parts would throw away whatever was already there.
   */
  const [feet, setFeet] = useState('');
  const [body, setBody] = useState(BODY_OPTIONS[0]);
  const [weight, setWeight] = useState('');
  const [vehicleClass, setVehicleClass] = useState('');

  const [capacityLabel, setCapacityLabel] = useState('');
  const [bodyLabel, setBodyLabel] = useState('');

  const openEdit = (t: AdminVehicleType) => {
    setEditing(t.id);
    setAdding(false);
    setFormError('');
    setName(t.name);
    setCapacityLabel(t.capacityLabel ?? '');
    setBodyLabel(t.bodyLabel ?? '');
    setIllustration(t.illustration || VEHICLE_ILLUSTRATIONS[0]);
    setPhoto(null);
  };

  const openAdd = () => {
    setAdding(true);
    setEditing(null);
    setFormError('');
    setName('');
    setFeet('');
    setBody(BODY_OPTIONS[0]);
    setWeight('');
    setVehicleClass('');
    setIllustration(VEHICLE_ILLUSTRATIONS[0]);
    setPhoto(null);
  };

  const close = () => {
    setEditing(null);
    setAdding(false);
  };

  const save = async () => {
    if (name.trim().length < 2) {
      setFormError('Enter a vehicle name.');
      return;
    }
    if (adding && !weight.trim()) {
      setFormError('Enter the max load weight.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      /*
       * Upload first, and only if a photograph was chosen.
       *
       * The stored `illustration` is either one of this app's slugs or a URL,
       * and both render — so a type keeps whatever it had unless the office
       * actually picked something new. Uploading here rather than on pick means
       * a change of mind costs nothing and leaves nothing behind.
       */
      const picture = photo ? (await uploadService.upload(photo)).url : illustration;

      if (adding) {
        /*
         * The two labels the catalogue stores, composed the way the panel
         * composes them — so a type added from a phone reads identically to
         * one added from a desk, and the customer app renders both the same.
         *
         * "Ton" is appended only when the office has not already typed it:
         * they write "6" or "6 Ton" depending on habit, and both should end up
         * as one string rather than "6 Ton Ton".
         */
        const w = /ton/i.test(weight) ? weight.trim() : `${weight.trim()} Ton`;
        await vehicleService.createType({
          name: name.trim(),
          capacityLabel: [vehicleClass.trim(), w].filter(Boolean).join(' · '),
          bodyLabel: [feet.trim() ? `${feet.trim()} ft` : '', body]
            .filter(Boolean)
            .join(' · '),
          illustration: picture,
        });
      } else if (editing) {
        await vehicleService.updateType(editing, {
          name: name.trim(),
          capacityLabel: capacityLabel.trim(),
          bodyLabel: bodyLabel.trim(),
          illustration: picture,
        });
      }
      close();
      refetch();
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : 'Could not save the vehicle type.',
      );
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (t: AdminVehicleType) => {
    try {
      await vehicleService.updateType(t.id, { active: !t.active });
      refetch();
    } catch (e) {
      Alert.alert(
        'Could not change it',
        e instanceof Error ? e.message : 'Try again in a moment.',
      );
    }
  };

  const form = adding || editing !== null;

  return (
    <Screen>
      <AppHeader
        title="Vehicle Types"
        subtitle="What customers can book"
        showBack
        rightIcon="plus"
        onRightPress={openAdd}
        rightAccessibilityLabel="Add a vehicle type"
      />
      <Content>
        {/*
          * The form is a sheet, not a card wedged above the list.
          *
          * Adding a type is a task with six fields and a picture: inline it
          * pushed the catalogue off screen and left the office scrolling
          * between what they were typing and what they already had. A sheet
          * puts the task in front of everything, dims the list behind it, and
          * leaves by the same gesture it arrived.
          */}
        <BottomSheet
          visible={form}
          onClose={close}
          scrollable
          /*
           * A little tighter at the foot than the default.
           *
           * The sheet already lifts its content clear of the navigation bar;
           * the default sixteen on top of that left a visible band of nothing
           * under the buttons on a form this tall.
           */
          paddingBottom={8}
        >
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {adding ? 'New vehicle type' : 'Edit vehicle type'}
            </Text>
            <Text style={styles.sheetSub}>
              {adding
                ? 'What customers will see when they book'
                : 'Correct how this type reads'}
            </Text>
          </View>

          <Input
            label="Vehicle name"
            required
            value={name}
            onChangeText={setName}
            placeholder="Tata Ace"
          />

          {adding ? (
            <>
              <Input
                label="Length (feet)"
                value={feet}
                onChangeText={setFeet}
                keyboardType="number-pad"
                placeholder="14"
              />
              <Select
                label="Body type"
                options={BODY_OPTIONS.map(b => ({ label: b, value: b }))}
                value={body}
                onChange={setBody}
              />
              <Input
                label="Max load weight"
                required
                value={weight}
                onChangeText={setWeight}
                placeholder="6 Ton"
              />
              <Input
                label="Vehicle class"
                value={vehicleClass}
                onChangeText={setVehicleClass}
                placeholder="Pickup"
              />
            </>
          ) : (
            <>
              {/* Editing shows the stored strings, so a label that reads wrong
                  can be corrected without rebuilding it from parts and losing
                  whatever was already there. */}
              <Input
                label="Capacity label"
                value={capacityLabel}
                onChangeText={setCapacityLabel}
                placeholder="Pickup · 1.5 Ton"
              />
              <Input
                label="Body label"
                value={bodyLabel}
                onChangeText={setBodyLabel}
                placeholder="14 ft · Closed body"
              />
            </>
          )}

          <Text style={styles.label}>Picture</Text>
          <Pressable
            style={styles.pickPhoto}
            disabled={busy || isPicking}
            onPress={async () => {
              const [picked] = await fromGallery(1);
              if (picked) {
                setPhoto(picked);
              }
            }}
          >
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.pickPhotoImg}
                resizeMode="cover"
              />
            ) : (
              <>
                <Icon name="image" size={16} color={palette.navy} />
                <Text style={styles.pickPhotoText}>
                  {isPicking ? 'Opening gallery…' : 'Choose a photo from the gallery'}
                </Text>
                <Text style={styles.pickPhotoHint}>
                  or pick one of ours below
                </Text>
              </>
            )}
          </Pressable>

          {photo ? (
            <Pressable onPress={() => setPhoto(null)} style={styles.clearPhoto}>
              <Text style={styles.clearPhotoText}>
                Use one of the pictures below instead
              </Text>
            </Pressable>
          ) : (
            <View style={styles.pictures}>
              {VEHICLE_ILLUSTRATIONS.map(slug => {
                const src = vehicleImage(slug);
                const on = slug === illustration;
                return (
                  <Pressable
                    key={slug}
                    onPress={() => setIllustration(slug)}
                    style={[styles.picture, on && styles.pictureOn]}
                  >
                    {src ? (
                      <Image
                        source={src}
                        style={styles.pictureImg}
                        resizeMode="contain"
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          <View style={styles.formActions}>
            <Pressable onPress={close} style={styles.cancel} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={styles.save} disabled={busy}>
              <Text style={styles.saveText}>
                {busy ? 'Saving…' : adding ? 'Add type' : 'Save changes'}
              </Text>
            </Pressable>
          </View>
        </BottomSheet>

        <ListState
          loading={loading}
          error={error}
          empty={!loading && !error && types.length === 0}
          what="vehicle types"
          emptyIcon="truck"
          emptyHint="Add the lorries customers can book."
          onRetry={refetch}
        />

        {/*
          * One card per type, led by the lorry.
          *
          * The office is choosing what a customer will see, so the photograph
          * is the row — big enough to tell a Tata Ace from a 407 at a glance,
          * on the same tinted stage the customer app sets its vehicles on. A
          * cramped thumbnail beside two lines of text made this a list of
          * strings that happened to have pictures.
          */}
        {types.map(t => {
          const picture = vehicleImage(t.illustration);
          const chips = [t.capacityLabel, t.bodyLabel].filter(Boolean);
          return (
            <Card key={t.id} padding={0} clip style={styles.card}>
              <View>
                <View style={styles.stage}>
                  {picture ? (
                    <Image
                      source={picture}
                      style={[styles.photo, !t.active && styles.photoOff]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.photoEmpty}>
                      <Icon name="truck" size={30} color={palette.slate400} />
                    </View>
                  )}

                  {/* Deselected reads as a state of the type, not a fault. */}
                  {!t.active ? (
                    <View style={styles.offBadge}>
                      <Text style={styles.offBadgeText}>Not offered</Text>
                    </View>
                  ) : null}

                  {/*
                    * Edit sits in the corner of the picture, where an edit
                    * affordance is looked for, and clear of the switch.
                    *
                    * It used to be an icon stacked above the toggle, which read
                    * as one control in two halves — and because it lived inside
                    * the card's own Pressable, flipping the switch also opened
                    * the form. Two different outcomes from one tap is a bug the
                    * office would have hit every time they deselected a type.
                    */}
                  <Pressable
                    onPress={() => openEdit(t)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${t.name}`}
                    style={styles.editBtn}
                  >
                    <Icon name="edit-3" size={14} color={palette.navy} />
                  </Pressable>
                </View>

                <View style={styles.cardBody}>
                  <Pressable
                    style={styles.cardBodyText}
                    onPress={() => openEdit(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${t.name}`}
                  >
                    <Text style={styles.name} numberOfLines={1}>
                      {t.name}
                    </Text>
                    {chips.length ? (
                      <View style={styles.chips}>
                        {chips.map(c => (
                          <View key={String(c)} style={styles.chip}>
                            <Text style={styles.chipText}>{String(c)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.meta}>No capacity or body set</Text>
                    )}
                    {!t.active ? (
                      <Text style={styles.off}>
                        Still on existing lorries and bookings — just not offered
                      </Text>
                    ) : null}
                  </Pressable>

                  {/* Outside the pressable above, so the switch is only ever a
                      switch. */}
                  <View style={styles.actions}>
                    <Toggle value={t.active} onValueChange={() => toggle(t)} />
                  </View>
                </View>
              </View>
            </Card>
          );
        })}
      </Content>
    </Screen>
  );
};

const styles = StyleSheet.create({
  /* The sheet's own heading — a title with the task named under it, so the
     office knows which of the two forms they are in without reading fields. */
  sheetHead: { marginBottom: s(12) },
  sheetTitle: font(17, '800', { color: palette.navy }),
  sheetSub: { marginTop: s(2), ...font(10, '600', { color: palette.slate500 }) },
  label: {
    marginTop: s(8),
    marginBottom: s(3),
    ...font(9, '800', { color: palette.slate500, letterSpacing: 0.5 }),
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: s(10),
    paddingVertical: s(8),
    ...font(12, '600', { color: palette.navy }),
  },
  bodies: { flexDirection: 'row', flexWrap: 'wrap' },
  body: {
    paddingHorizontal: s(10),
    paddingVertical: s(5),
    borderRadius: radius.pill,
    backgroundColor: '#f1f5f9',
    marginRight: s(6),
    marginBottom: s(6),
  },
  bodyOn: { backgroundColor: palette.navy },
  bodyText: font(10, '700', { color: palette.slate500 }),
  bodyTextOn: { color: palette.white },
  pickPhoto: {
    height: s(116),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: s(8),
  },
  pickPhotoImg: { width: '100%', height: '100%' },
  pickPhotoText: { marginTop: s(6), ...font(11, '800', { color: palette.navy }) },
  pickPhotoHint: { marginTop: s(2), ...font(9, '600', { color: palette.slate500 }) },
  clearPhoto: { paddingVertical: s(4), marginBottom: s(4) },
  clearPhotoText: font(9, '700', { color: palette.slate500 }),
  pictures: { flexDirection: 'row', flexWrap: 'wrap' },
  picture: {
    width: s(64),
    height: s(44),
    marginRight: s(6),
    marginBottom: s(6),
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pictureOn: { borderColor: palette.gold, backgroundColor: palette.goldTint },
  pictureImg: { width: '100%', height: '100%' },
  formError: { marginTop: s(8), ...font(10, '700', { color: palette.red }) },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(14),
  },
  cancel: {
    paddingHorizontal: s(18),
    paddingVertical: s(13),
    marginRight: s(6),
  },
  cancelText: font(12, '800', { color: palette.slate500 }),
  save: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(13),
    borderRadius: radius.pill,
    backgroundColor: palette.gold,
  },
  saveText: font(12, '800', { color: palette.navy }),
  card: { marginBottom: s(12) },
  /* The tinted stage the customer app also sets its vehicles on. */
  stage: {
    height: s(132),
    backgroundColor: palette.navyTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '82%', height: '82%' },
  /* Deselected types stay legible but plainly not on offer. */
  photoOff: { opacity: 0.3 },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  offBadge: {
    position: 'absolute',
    top: s(8),
    left: s(8),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: radius.pill,
    backgroundColor: palette.red,
  },
  offBadgeText: font(9, '800', { color: palette.white }),
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(12),
    paddingVertical: s(10),
  },
  cardBodyText: { flex: 1 },
  name: font(14, '800', { color: palette.navy }),
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: s(4) },
  chip: {
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: radius.pill,
    backgroundColor: '#f1f5f9',
    marginRight: s(5),
    marginTop: s(3),
  },
  chipText: font(9, '700', { color: palette.slate500 }),
  meta: { marginTop: s(3), ...font(10, '600', { color: palette.slate500 }) },
  off: { marginTop: s(5), ...font(9, '600', { color: palette.red }) },
  actions: { alignItems: 'center', marginLeft: s(12) },
  /* A floating control on the photograph, so it reads above the image rather
     than painted onto it. */
  editBtn: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
  },
});
