import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';

export function ScreenContainer({ children }) {
  const extraBottomSpacing = 8;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const keyboardInset = Platform.OS === 'ios'
    ? Math.max(0, keyboardHeight - insets.bottom)
    : Math.max(0, keyboardHeight);
  const bottomInset = Math.max(insets.bottom, 10) + keyboardInset + extraBottomSpacing;

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.content,
          {
            paddingTop: 8,
            paddingBottom: bottomInset,
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: isLandscape ? Math.max(insets.right, 28) : Math.max(insets.right, 16),
          },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
