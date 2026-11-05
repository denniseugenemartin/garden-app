import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Plant, listPlants } from './garden';
import { usePhotoUris } from './photoStorage';
import { colors } from './theme';

/** The garden (wishlist = false) or the wishlist, with an add button and a photo viewer. */
export default function PlantList({ wishlist }: { wishlist: boolean }) {
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Plant | null>(null);
  const photoSrc = usePhotoUris((plants ?? []).map((plant) => plant.photoUri));

  const load = useCallback(() => {
    listPlants(wishlist)
      .then((result) => {
        setPlants(result);
        setLoadError(null);
      })
      .catch((error: Error) => setLoadError(error.message));
  }, [wishlist]);

  useFocusEffect(load);

  return (
    <View style={styles.screen}>
      {loadError && <Text style={styles.error}>{loadError}</Text>}
      {plants === null && !loadError && <ActivityIndicator style={styles.loading} color={colors.accent} />}
      <FlatList
        data={plants ?? []}
        keyExtractor={(plant) => plant.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          plants === null ? undefined : (
            <Text style={styles.empty}>
              {wishlist
                ? 'Your wishlist is empty. Tap “Add to wishlist” to save a plant you want.'
                : 'No plants yet. Tap “Add plant” to log your first one.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          // Thumbnail and body are siblings: on web a button nested inside the card's link can't take the tap.
          <View style={styles.card}>
            {item.photoUri ? (
              <Pressable
                style={styles.photoButton}
                onPress={() => setViewing(item)}
                accessibilityRole="button"
                accessibilityLabel="View photo"
              >
                <Image source={{ uri: photoSrc(item.photoUri) ?? undefined }} style={styles.photo} />
              </Pressable>
            ) : (
              <Link href={`/plant/${item.id}`} asChild>
                <Pressable style={styles.photoButton} accessibilityLabel={`Open ${item.commonName}`}>
                  <Image source={require('../assets/icon.png')} style={styles.photo} />
                </Pressable>
              </Link>
            )}
            <Link href={`/plant/${item.id}`} asChild>
              <Pressable style={styles.cardText}>
                <Text style={styles.name}>{item.commonName}</Text>
                {item.scientificName && (
                  <Text style={styles.scientific}>
                    {item.scientificName}
                    {item.cultivar ? ` '${item.cultivar}'` : ''}
                  </Text>
                )}
                {!wishlist && item.location && <Text style={styles.meta}>{item.location}</Text>}
              </Pressable>
            </Link>
          </View>
        )}
      />
      <Pressable
        style={styles.fab}
        onPress={() => router.push(wishlist ? '/plant/new?wishlist=1' : '/plant/new')}
      >
        <Text style={styles.fabText}>{wishlist ? 'Add to wishlist' : 'Add plant'}</Text>
      </Pressable>
      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable style={styles.viewer} onPress={() => setViewing(null)}>
          {viewing && (
            <>
              <Image
                source={{ uri: photoSrc(viewing.photoUri) ?? undefined }}
                style={styles.viewerPhoto}
                resizeMode="contain"
              />
              <Text style={styles.viewerTitle}>{viewing.commonName}</Text>
              {viewing.photoCredit && (
                <Pressable
                  disabled={!viewing.photoLicenseUrl}
                  onPress={() => Linking.openURL(viewing.photoLicenseUrl!)}
                >
                  <Text style={styles.viewerCredit}>
                    Photo: {viewing.photoCredit} · NC State Extension Plant Toolbox
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, paddingBottom: 96 },
  empty: { color: colors.muted, marginTop: 48, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, marginHorizontal: 16, marginTop: 12 },
  loading: { marginTop: 48 },
  card: {
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
  },
  photoButton: { justifyContent: 'center', padding: 12, paddingRight: 0 },
  photo: { borderRadius: 8, height: 56, width: 56 },
  cardText: { flex: 1, justifyContent: 'center', padding: 12 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  scientific: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  fab: {
    backgroundColor: colors.accent,
    borderRadius: 28,
    bottom: 28,
    paddingHorizontal: 24,
    paddingVertical: 16,
    position: 'absolute',
    right: 20,
  },
  fabText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  viewer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  viewerPhoto: { height: '70%', width: '100%' },
  viewerTitle: { color: '#ffffff', fontSize: 17, fontWeight: '600', marginTop: 12 },
  viewerCredit: {
    color: '#dddddd',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
