import { useCallback, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  Asset,
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { pick, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';

/**
 * Wraps `react-native-image-picker` with the permission handling and error
 * reporting the screens should not have to repeat.
 */
export type PickedImage = {
  uri: string;
  fileName: string;
  /** Bytes — used for the `842 KB` style captions. */
  fileSize: number;
  type: string;
};

const BASE: CameraOptions & ImageLibraryOptions = {
  mediaType: 'photo',
  quality: 0.8,
  // Documents are read on screen, not printed — cap the long edge so uploads
  // stay small on patchy mobile connections.
  maxWidth: 2000,
  maxHeight: 2000,
};

const toPicked = (asset: Asset): PickedImage | null =>
  asset.uri
    ? {
        uri: asset.uri,
        fileName: asset.fileName ?? 'photo.jpg',
        fileSize: asset.fileSize ?? 0,
        type: asset.type ?? 'image/jpeg',
      }
    : null;

/** Android needs an explicit runtime CAMERA grant; iOS uses Info.plist. */
const ensureCameraPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Camera access',
      message: 'SMT Admin needs the camera to capture vehicle and driver documents.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    },
  );
  if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert(
      'Camera blocked',
      'Enable camera access in Settings to take document photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return false;
  }
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

/**
 * File picker for document slots.
 *
 * The office attaches papers that arrive as files far more often than it
 * photographs them — an insurance certificate emailed as a PDF, an RC scanned
 * on a flatbed — so a document slot has to accept an existing file and not
 * only the camera.
 */
export const useDocumentPicker = () => {
  const pickDocument = useCallback(async (): Promise<PickedImage[]> => {
    try {
      const results = await pick({
        type: [types.pdf, types.images],
        allowMultiSelection: false,
      });
      return results
        .filter(r => !!r.uri)
        .map(r => ({
          uri: r.uri,
          fileName: r.name ?? 'document.pdf',
          fileSize: r.size ?? 0,
          type: r.type ?? 'application/pdf',
        }));
    } catch (err) {
      // Dismissing the picker is a normal outcome, not an error.
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return [];
      }
      Alert.alert('Could not attach file', 'Please try again.');
      return [];
    }
  }, []);

  return { pickDocument };
};

export const useImagePicker = () => {
  const [isPicking, setIsPicking] = useState(false);

  const handleResult = useCallback(
    (assets: Asset[] | undefined, errorCode?: string, errorMessage?: string) => {
      if (errorCode === 'camera_unavailable') {
        Alert.alert('Camera unavailable', 'No camera found on this device.');
        return [];
      }
      if (errorCode === 'permission') {
        Alert.alert(
          'Permission needed',
          'Allow photo access to attach documents.',
        );
        return [];
      }
      if (errorCode) {
        Alert.alert('Could not attach photo', errorMessage ?? 'Please try again.');
        return [];
      }
      return (assets ?? []).map(toPicked).filter(Boolean) as PickedImage[];
    },
    [],
  );

  const fromCamera = useCallback(async (): Promise<PickedImage[]> => {
    if (!(await ensureCameraPermission())) {
      return [];
    }
    setIsPicking(true);
    try {
      const res = await launchCamera({ ...BASE, saveToPhotos: false });
      if (res.didCancel) {
        return [];
      }
      return handleResult(res.assets, res.errorCode, res.errorMessage);
    } finally {
      setIsPicking(false);
    }
  }, [handleResult]);

  const fromGallery = useCallback(
    async (selectionLimit = 1): Promise<PickedImage[]> => {
      setIsPicking(true);
      try {
        const res = await launchImageLibrary({ ...BASE, selectionLimit });
        if (res.didCancel) {
          return [];
        }
        return handleResult(res.assets, res.errorCode, res.errorMessage);
      } finally {
        setIsPicking(false);
      }
    },
    [handleResult],
  );

  return { fromCamera, fromGallery, isPicking };
};

/**
 * A caption a driver can read.
 *
 * `react-native-image-picker` names its output
 * `rn_image_picker_lib_temp_9eb47caa-104d-43b0-aa07-e596c87257e5.jpg`, which
 * wrapped across three lines and told nobody anything. A file the driver
 * actually chose keeps its name; a camera temp file is described by size
 * alone.
 */
export const describeFile = (file: {
  fileName: string;
  fileSize: number;
}): string => {
  const size = formatFileSize(file.fileSize);
  const temp = /^rn_image_picker_lib_temp|^image_picker|^[0-9a-f-]{20,}\./i.test(
    file.fileName,
  );
  if (temp || !file.fileName) {
    return size || 'Attached';
  }
  const name =
    file.fileName.length > 22
      ? `${file.fileName.slice(0, 19)}…${file.fileName.slice(-4)}`
      : file.fileName;
  return size ? `${name} · ${size}` : name;
};

/** `842 KB` / `1.2 MB` captions used by the upload tiles. */
export const formatFileSize = (bytes: number): string => {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
