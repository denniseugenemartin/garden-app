import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

const PHOTO_DIR = 'photos';

/**
 * Image picker results live in the cache directory, which the OS may purge.
 * Copy into document storage so saved plant photos survive.
 */
export function persistPhoto(sourceUri: string): string {
  // expo-file-system has no web implementation; the web picker returns a self-contained data URI.
  if (Platform.OS === 'web') return sourceUri;

  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true });

  const source = new File(sourceUri);
  const extension = source.extension || '.jpg';
  const destination = new File(dir, `${Date.now()}${extension}`);
  source.copy(destination);
  return destination.uri;
}

/** Downloads a remote image (e.g. from NC State) so it survives after the presigned URL expires. */
export async function persistRemotePhoto(url: string): Promise<string> {
  // expo-file-system has no web implementation, so web keeps the remote URL.
  if (Platform.OS === 'web') return url;

  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true });

  const destination = new File(dir, `${Date.now()}.jpg`);
  const output = await File.downloadFileAsync(url, destination);
  return output.uri;
}

export function deletePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}

/** Lets the user take or choose a photo and stores it; returns null if they cancel or deny access. */
export async function pickPhoto(fromCamera: boolean): Promise<string | null> {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Allow access to add a photo of this plant.');
    return null;
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6,
    allowsEditing: true,
  };
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return null;
  return persistPhoto(result.assets[0].uri);
}
