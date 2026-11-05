import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ToolboxPhoto, fetchToolboxPhotos } from './ncstateGallery';
import { colors } from './theme';

type Props = {
  visible: boolean;
  slug: string;
  onSelect: (photo: ToolboxPhoto) => void;
  onClose: () => void;
};

export default function NcStatePhotoPicker({ visible, slug, onSelect, onClose }: Props) {
  const [photos, setPhotos] = useState<ToolboxPhoto[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhotos(null);
    fetchToolboxPhotos(slug).then(setPhotos);
  }, [visible, slug]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a photo</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {photos === null && <ActivityIndicator style={styles.spinner} color={colors.accent} />}
          {photos?.length === 0 && (
            <Text style={styles.empty}>No photos found on the NC State Plant Toolbox for this plant.</Text>
          )}
          {photos?.map((photo, index) => (
            <Pressable key={`${photo.fullUrl}-${index}`} style={styles.card} onPress={() => onSelect(photo)}>
              <Image source={{ uri: photo.thumbnailUrl }} style={styles.thumb} />
              {photo.photographer && (
                <Text style={styles.credit} numberOfLines={1}>
                  {photo.photographer}
                  {photo.licenseName ? ` · ${photo.licenseName}` : ''}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
  close: { color: colors.accent, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  spinner: { marginTop: 32 },
  empty: { color: colors.muted, marginTop: 32, textAlign: 'center' },
  card: { width: '47%' },
  thumb: { aspectRatio: 1, backgroundColor: colors.border, borderRadius: 8, width: '100%' },
  credit: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
