import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/** Light status bar while a night (Oracle) screen is focused; back to dark on blur. */
export function useNightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light', true);
      return () => setStatusBarStyle('dark', true);
    }, []),
  );
}
