import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Plant, listPlants } from '../src/db';
import { colors } from '../src/theme';

export default function PlantListScreen() {
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [viewing, setViewing] = useState<Plant | null>(null);
  // Attribution only applies when the NC State reference photo is what's shown.
  const viewingReference = viewing !== null && !viewing.photoUri;

  useFocusEffect(
    useCallback(() => {
      setPlants(listPlants());
    }, []),
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/about')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="About My Garden"
            >
              <Text style={styles.headerIcon}>ⓘ</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={plants}
        keyExtractor={(plant) => String(plant.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No plants yet. Tap “Add plant” to log your first one.
          </Text>
        }
        renderItem={({ item }) => (
          // Thumbnail and body are siblings: on web a button nested inside the card's link can't take the tap.
          <View style={styles.card}>
            {item.photoUri || item.referencePhotoUri ? (
              <Pressable
                style={styles.photoButton}
                onPress={() => setViewing(item)}
                accessibilityRole="button"
                accessibilityLabel="View photo"
              >
                <Image source={{ uri: item.photoUri ?? item.referencePhotoUri! }} style={styles.photo} />
              </Pressable>
            ) : (
              <Link href={`/plant/${item.id}`} asChild>
                <Pressable style={styles.photoButton}>
                  <View style={[styles.photo, styles.photoEmpty]} />
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
                {item.location && <Text style={styles.meta}>{item.location}</Text>}
              </Pressable>
            </Link>
          </View>
        )}
      />
      <Pressable style={styles.fab} onPress={() => router.push('/plant/new')}>
        <Text style={styles.fabText}>Add plant</Text>
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
                source={{ uri: viewing.photoUri ?? viewing.referencePhotoUri! }}
                style={styles.viewerPhoto}
                resizeMode="contain"
              />
              <Text style={styles.viewerTitle}>{viewing.commonName}</Text>
              {viewingReference && viewing.referencePhotoCredit && (
                <Pressable
                  disabled={!viewing.referencePhotoLicenseUrl}
                  onPress={() => Linking.openURL(viewing.referencePhotoLicenseUrl!)}
                >
                  <Text style={styles.viewerCredit}>
                    Photo: {viewing.referencePhotoCredit} · NC State Extension Plant Toolbox
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
  headerIcon: { color: colors.accent, fontSize: 22, paddingHorizontal: 8 },
  list: { padding: 16, paddingBottom: 96 },
  empty: { color: colors.muted, marginTop: 48, textAlign: 'center' },
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
  photoEmpty: { backgroundColor: colors.border },
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
