import React, { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { Icon } from '@components/common/Icon';
import { resolveMediaUrl } from '@utils/mediaUrl';
import { palette } from '@theme/colors';
import { font } from '@theme/fonts';
import { radius } from '@theme/radius';
import { s } from '@theme/metrics';

/**
 * A stored scan, shown inside the app.
 *
 * The eye buttons used to hand every document to the OS, which took the
 * operator out of the panel and into a gallery or browser to read one paper.
 * An image opens here instead — a dark, full-bleed viewer over the screen it
 * was tapped on. PDFs still leave the app: there is no in-app renderer for one,
 * and pretending otherwise would show a blank frame.
 *
 * Built from the app's own Modal/Icon/theme, and dependency-free, so a Metro
 * reload is all it takes.
 */
/** One side of a paper shown in the pager — the front, or the back. */
export type ViewerImage = { uri: string; label?: string };

export type ImageViewerModalProps = {
  visible: boolean;
  /** The stored file's link — re-rooted onto the reachable host before it loads. */
  uri?: string | null;
  /**
   * Several sides of one paper — front and back — shown as a swipeable pager.
   * When given (and non-empty) it wins over `uri`; a single-`uri` caller keeps
   * the plain one-image view unchanged.
   */
  images?: ViewerImage[];
  /** The paper's name, shown in the bar. */
  title?: string;
  onClose: () => void;
};

/**
 * One full-screen page of the pager, with its own spinner and failure.
 *
 * Tracked per page rather than for the pager as a whole, so a back that 404s
 * shows its own error while a front that loaded stays readable beside it. Sized
 * from the stage the pager measured, so each page snaps exactly one width.
 */
const PagerPage: React.FC<{
  image: ViewerImage;
  title?: string;
  width: number;
  height: number;
  onPress: () => void;
}> = ({ image, title, width, height, onPress }) => {
  // Reset when the source changes — a recycled page must not inherit the last
  // side's spinner or its failure.
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [image.uri]);

  const source = resolveMediaUrl(image.uri) ?? image.uri ?? undefined;
  const label = image.label ? `${title ?? 'Document'} · ${image.label}` : title ?? 'Document preview';

  return (
    // Tap anywhere on the page to dismiss — the pager sits over the backdrop
    // and swallows its taps, so each page carries the gesture itself.
    <Pressable
      onPress={onPress}
      style={[styles.page, { width, height }]}
      accessibilityRole="button"
      accessibilityLabel="Close preview"
    >
      {source && !failed ? (
        <Image
          source={{ uri: source }}
          style={styles.image}
          resizeMode="contain"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          accessibilityLabel={label}
        />
      ) : null}

      {loading && !failed ? (
        <ActivityIndicator size="large" color={palette.gold} style={styles.spinner} />
      ) : null}

      {failed ? (
        <View style={styles.error} pointerEvents="none">
          <Icon name="alert-circle" size={22} color={palette.white} />
          <Text style={styles.errorText}>That scan could not be loaded.</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

/**
 * The front/back viewer, shown when several sides are handed in.
 *
 * One side is on screen at a time and the Front / Back buttons beneath it swap
 * which — pressing Back shows the back, pressing Front shows the front, with no
 * swipe to discover. The stage is measured rather than taken from the window so
 * the image fits the area under the bar exactly; the bar names the side shown.
 */
const Pager: React.FC<{
  images: ViewerImage[];
  title?: string;
  visible: boolean;
  onClose: () => void;
}> = ({ images, title, visible, onClose }) => {
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0);
  // Back to the front each time the sheet opens or its set changes.
  useEffect(() => {
    setIndex(0);
  }, [visible, images.length]);

  // The one side on screen. Clamped, so a set that shrank under a stale index
  // still resolves to a real image rather than `undefined`.
  const active = Math.min(index, images.length - 1);
  const current = images[active];
  const label = current?.label;
  const heading = (title ?? 'Document') + (label ? ` · ${label}` : '');

  const onMeasure = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage(prev =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  return (
    <>
      <View style={styles.bar}>
        <Text style={styles.title} numberOfLines={1}>
          {heading}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Icon name="x" size={18} color={palette.white} />
        </Pressable>
      </View>

      {/* One side at a time; the Front / Back buttons below swap which shows.
          Keyed on the uri so switching mounts a fresh page (its own spinner). */}
      <View style={styles.stage} onLayout={onMeasure}>
        {stage.width > 0 && current ? (
          <PagerPage
            key={current.uri}
            image={current}
            title={title}
            width={stage.width}
            height={stage.height}
            onPress={onClose}
          />
        ) : null}
      </View>

      {/* Front / Back — tap to show that side; the active one is lit. */}
      {images.length > 1 ? (
        <View style={styles.tabs}>
          {images.map((image, i) => (
            <Pressable
              key={`${i}-${image.uri}`}
              onPress={() => setIndex(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === active }}
              accessibilityLabel={image.label ?? `Side ${i + 1}`}
              style={[styles.tab, i === active && styles.tabActive]}
            >
              <Text style={[styles.tabText, i === active && styles.tabTextActive]}>
                {image.label ?? `Side ${i + 1}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
};

const ImageViewerModalComponent: React.FC<ImageViewerModalProps> = ({
  visible,
  uri,
  images,
  title,
  onClose,
}) => {
  // A pager when several sides were handed in; the plain single view otherwise,
  // which is the path `DocumentsScreen` and any other one-image caller uses.
  const gallery = images && images.length > 0 ? images : null;

  // Reset per open, so a fresh scan never inherits the last one's spinner or
  // its failure — the source can change while the modal stays mounted. (Only
  // the single-image path reads these; the pager tracks its own per page.)
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [uri, visible]);

  // The same resolve the rest of the app uses at an `<Image source>`: a
  // `/uploads/…` link the backend stamped against its internal host is re-based
  // onto the public API origin the handset can actually reach.
  const source = resolveMediaUrl(uri) ?? uri ?? undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        {/* Tap the backdrop to dismiss — the whole area behind the image. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
        />

        {gallery ? (
          <Pager images={gallery} title={title} visible={visible} onClose={onClose} />
        ) : (
          <>
            <View style={styles.bar}>
              <Text style={styles.title} numberOfLines={1}>
                {title ?? 'Document'}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
              >
                <Icon name="x" size={18} color={palette.white} />
              </Pressable>
            </View>

            {/* `box-none`, so a tap that lands beside the image still reaches the
                backdrop behind it and dismisses. */}
            <View style={styles.stage} pointerEvents="box-none">
              {source && !failed ? (
                <Image
                  source={{ uri: source }}
                  style={styles.image}
                  resizeMode="contain"
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setFailed(true);
                  }}
                  accessibilityLabel={title ?? 'Document preview'}
                />
              ) : null}

              {loading && !failed ? (
                <ActivityIndicator
                  size="large"
                  color={palette.gold}
                  style={styles.spinner}
                />
              ) : null}

              {failed ? (
                <View style={styles.error} pointerEvents="none">
                  <Icon name="alert-circle" size={22} color={palette.white} />
                  <Text style={styles.errorText}>That scan could not be loaded.</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(4,10,20,0.94)' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(10),
    paddingHorizontal: s(16),
    paddingTop: s(16),
    paddingBottom: s(10),
  },
  title: { ...font(12, '800', { color: palette.white }), flex: 1, minWidth: 0 },
  close: {
    width: s(34),
    height: s(34),
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // One pager page, sized to the measured stage so a swipe snaps exactly one.
  page: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  spinner: { position: 'absolute' },
  error: { alignItems: 'center', gap: s(8), padding: s(20) },
  errorText: font(11, '600', { color: palette.white }),

  // Front / Back switch under the image.
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: s(8),
    marginBottom: s(28),
    padding: s(4),
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tab: {
    paddingVertical: s(8),
    paddingHorizontal: s(22),
    borderRadius: radius.full,
  },
  tabActive: { backgroundColor: palette.gold },
  tabText: font(11, '800', { color: palette.white }),
  tabTextActive: { color: palette.navy },

  pressed: { opacity: 0.7 },
});

export const ImageViewerModal = memo(ImageViewerModalComponent);
ImageViewerModal.displayName = 'ImageViewerModal';
