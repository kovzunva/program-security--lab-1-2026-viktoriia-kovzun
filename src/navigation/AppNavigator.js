import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ROUTES } from '../constants/routes';
import { t, useLocalization } from '../localization';
import { PopupMenu } from '../components/PopupMenu';
import { LibraryScreen } from '../screens/LibraryScreen';
import { BookDetailsScreen } from '../screens/BookDetailsScreen';
import { BookMetaFormScreen } from '../screens/BookMetaFormScreen';
import { BookChaptersScreen } from '../screens/BookChaptersScreen';
import { EditorScreen } from '../screens/EditorScreen';
import { BookStatsScreen } from '../screens/BookStatsScreen';
import { InfoScreen } from '../screens/InfoScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppTheme } from '../theme';

const Stack = createNativeStackNavigator();

function HeaderMenuButton({ navigation }) {
  const { colors } = useAppTheme();
  const { locale } = useLocalization();
  const menuRef = useRef(null);

  const handleMenuPress = useCallback(() => {
    const menuItems = [
      {
        label: t('menu.about'),
        onPress: () => {
          navigation.navigate(ROUTES.INFO);
        },
      },
      {
        label: t('menu.changeTheme'),
        onPress: () => {
          navigation.navigate(ROUTES.SETTINGS);
        },
      },
    ];
    menuRef.current?.show(menuItems);
  }, [locale, navigation]);

  return (
    <>
      <Pressable
        style={[styles.menuButton, { borderColor: colors.border }]}
        onPress={handleMenuPress}
      >
        <Text style={[styles.menuButtonText, { color: colors.textPrimary }]}>⋮</Text>
      </Pressable>
      <PopupMenu forwardRef={menuRef} />
    </>
  );
}

export function AppNavigator() {
  const { colors } = useAppTheme();
  const { locale } = useLocalization();

  return (
    <Stack.Navigator
      key={locale}
      initialRouteName={ROUTES.LIBRARY}
      screenOptions={({ navigation }) => ({
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerBackTitleVisible: true,
        headerRight: () => (
          <HeaderMenuButton navigation={navigation} />
        ),
        contentStyle: {
          backgroundColor: colors.background,
        },
      })}
    >
      <Stack.Screen
        name={ROUTES.LIBRARY}
        component={LibraryScreen}
        options={{
          title: t('navigation.libraryTitle'),
        }}
      />
      <Stack.Screen
        name={ROUTES.BOOK_DETAILS}
        component={BookDetailsScreen}
        options={{
          title: t('navigation.bookOverviewTitle'),
          headerBackTitle: t('navigation.libraryTitle'),
        }}
      />
      <Stack.Screen
        name={ROUTES.BOOK_META_FORM}
        component={BookMetaFormScreen}
        options={({ route }) => ({
          title: t('navigation.bookMetaFormTitle'),
          headerBackTitle:
            route?.params?.mode === 'edit'
              ? t('navigation.bookOverviewTitle')
              : t('navigation.libraryTitle'),
        })}
      />
      <Stack.Screen
        name={ROUTES.BOOK_CHAPTERS}
        component={BookChaptersScreen}
        options={{
          title: t('navigation.bookDetailsTitle'),
          headerBackTitle: t('navigation.bookOverviewTitle'),
        }}
      />
      <Stack.Screen
        name={ROUTES.EDITOR}
        component={EditorScreen}
        options={{
          title: t('navigation.editorTitle'),
          headerBackTitle: t('navigation.bookDetailsTitle'),
        }}
      />
      <Stack.Screen
        name={ROUTES.STATS}
        component={BookStatsScreen}
        options={{
          title: t('navigation.statsTitle'),
          headerBackTitle: t('navigation.bookOverviewTitle'),
        }}
      />
      <Stack.Screen
        name={ROUTES.INFO}
        component={InfoScreen}
        options={{
          title: t('navigation.infoTitle'),
          headerBackTitle: t('navigation.libraryTitle'),
        }}
      />
      <Stack.Screen
        name={ROUTES.SETTINGS}
        component={SettingsScreen}
        options={{
          title: t('navigation.settingsTitle'),
          headerBackTitle: t('navigation.libraryTitle'),
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: 2,
    width: 44,
  },
  menuButtonText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 20,
  },
});
