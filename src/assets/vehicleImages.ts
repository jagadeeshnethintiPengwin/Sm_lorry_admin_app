import type { ImageSourcePropType } from 'react-native';

/**
 * The photograph shown for each bookable vehicle type.
 *
 * Keyed by the catalogue's `illustration` slug — the same keys the customer app
 * and the web panel use, so all three show a customer the same lorry for the
 * same type. That is why the column is a slug and not a generated id.
 *
 * `require` cannot take a variable in React Native: the bundler resolves these
 * at build time, so every entry has to be written out literally.
 */
const VEHICLE_IMAGES: Record<string, ImageSourcePropType> = {
  'tata-ace': require('./images/vehicles/tata-ace.png'),
  bolero: require('./images/vehicles/bolero.png'),
  'tata-407': require('./images/vehicles/tata-407.png'),
  'truck-14ft': require('./images/vehicles/truck-14ft.png'),
  'truck-17ft': require('./images/vehicles/truck-17ft.png'),
  trailer: require('./images/vehicles/trailer.png'),
};

/** The bundled slugs, for the picker on the Vehicle Types form. */
export const VEHICLE_ILLUSTRATIONS = Object.keys(VEHICLE_IMAGES);

/**
 * The picture for a type, however the catalogue names it.
 *
 * A slug resolves to a bundled photograph. A full URL is returned as a remote
 * source, so a type added later with a hosted image still shows one without
 * shipping a new build. Anything else is null, and the caller draws its icon —
 * an office adding "Bajaj auto" should see a tidy placeholder, not a gap.
 */
export function vehicleImage(
  illustration?: string | null,
): ImageSourcePropType | null {
  if (!illustration) {
    return null;
  }
  if (/^https?:\/\//i.test(illustration)) {
    return { uri: illustration };
  }
  return VEHICLE_IMAGES[illustration] ?? null;
}
