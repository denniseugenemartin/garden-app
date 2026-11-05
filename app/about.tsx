import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors } from '../src/theme';

const SLIDE_MS = 7000;

type Slide = { image: ImageSourcePropType; title: string; body: string };

const SLIDES: Slide[] = [
  {
    image: require('../assets/about/home.png'),
    title: 'Your garden at a glance',
    body: 'Every plant you add shows up here, sorted by scientific name. Tap a plant to open it, or its photo to see it full size. Wishlist, Profile and About are along the top.',
  },
  {
    image: require('../assets/about/search.png'),
    title: 'Add plants in seconds',
    body: "Tap Add plant and search NC State's list of 4,700+ plants by common or scientific name. Picking one fills in the name and links it to NC State's growing info.",
  },
  {
    image: require('../assets/about/plant.png'),
    title: 'Plant: your details',
    body: "Record where it's planted, when, and your own notes. Choose its main photo: take one, pick one from NC State, or use one from its journal.",
  },
  {
    image: require('../assets/about/info.png'),
    title: 'Info: expert growing guide',
    body: 'Light, soil, hardiness zone, flowers, leaves and more. Your own zone is highlighted in green. Tap a heading to expand it, Edit to adjust it, or Sync for the latest from NC State.',
  },
  {
    image: require('../assets/about/journal.png'),
    title: 'Journal: track it over time',
    body: 'Log what you notice — blooms, pests, growth, harvests — with an optional photo. Each entry is dated for you.',
  },
  {
    image: require('../assets/about/wishlist.png'),
    title: 'Wishlist: plants you want',
    body: "Save plants you'd like to grow, with the same details and growing info. When you get one, turn off “On my wishlist” and it moves into your garden.",
  },
  {
    image: require('../assets/about/profile.png'),
    title: 'Profile: your hardiness zone',
    body: 'Enter your ZIP code to look up your USDA hardiness zone, or pick it from the list. You can also sign out here.',
  },
  {
    image: require('../assets/about/photo.png'),
    title: 'Where the info comes from',
    body: "Plant info comes from the NC State Extension Gardener Plant Toolbox. Photos are shared by their photographers under Creative Commons licenses, and every one is credited. Your garden is saved to your account, so it's there on any device you sign in on.",
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  // Auto-advance until the user takes over by swiping or tapping.
  const [autoPlay, setAutoPlay] = useState(true);
  const isLast = index === SLIDES.length - 1;

  const imageHeight = Math.min(height * 0.55, 520);

  function goTo(next: number) {
    listRef.current?.scrollToOffset({ offset: next * width, animated: true });
    setIndex(next);
  }

  useEffect(() => {
    progress.setValue(0);
    if (!autoPlay || isLast) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, useNativeDriver: false });
    animation.start(({ finished }) => {
      if (finished) goTo(index + 1);
    });
    return () => animation.stop();
  }, [index, autoPlay]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const current = Math.round(event.nativeEvent.contentOffset.x / width);
    if (current !== index && current >= 0 && current < SLIDES.length) setIndex(current);
  }

  function takeOver(action: () => void) {
    setAutoPlay(false);
    action();
  }

  function close() {
    // A directly opened/refreshed web page has no history to go back to.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(slide) => slide.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setAutoPlay(false)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image
              source={item.image}
              style={[styles.image, { height: imageHeight, width: imageHeight / 2 }]}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityRole="tablist">
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.title}
              onPress={() => takeOver(() => goTo(i))}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityLabel={slide.title}
              accessibilityState={{ selected: i === index }}
            >
              {i === index ? (
                <View style={styles.activeDot}>
                  <Animated.View
                    style={[
                      styles.activeDotFill,
                      { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                    ]}
                  />
                </View>
              ) : (
                <View style={[styles.dot, i < index && styles.dotSeen]} />
              )}
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.next}
          onPress={() => (isLast ? close() : takeOver(() => goTo(index + 1)))}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  slide: { alignItems: 'center', gap: 12, paddingHorizontal: 28, paddingTop: 24 },
  image: { borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  title: { color: colors.text, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22, maxWidth: 420, textAlign: 'center' },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  dot: { backgroundColor: colors.border, borderRadius: 4, height: 8, width: 8 },
  dotSeen: { backgroundColor: colors.accent, opacity: 0.4 },
  activeDot: { backgroundColor: colors.border, borderRadius: 4, height: 8, overflow: 'hidden', width: 28 },
  activeDotFill: { backgroundColor: colors.accent, height: '100%' },
  next: { paddingHorizontal: 8, paddingVertical: 6 },
  nextText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
});
