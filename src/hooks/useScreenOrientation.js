import { useFocusEffect } from '@react-navigation/native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback } from 'react';

export function usePortraitScreen(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }

      ScreenOrientation.unlockAsync();

      return undefined;
    }, [enabled]),
  );
}

export function useEditorOrientation(enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        return undefined;
      }

      ScreenOrientation.unlockAsync();

      return undefined;
    }, [enabled]),
  );
}
