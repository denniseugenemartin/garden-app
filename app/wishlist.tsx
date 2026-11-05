import { Stack } from 'expo-router';
import PlantList from '../src/PlantList';

export default function WishlistScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Wishlist' }} />
      <PlantList wishlist />
    </>
  );
}
