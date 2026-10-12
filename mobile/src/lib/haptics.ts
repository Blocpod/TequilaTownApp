import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { usePrefs } from '@/state/prefs';

const enabled = () => Platform.OS !== 'web' && usePrefs.getState().haptics;

/** Haptic vocabulary used across the app so feedback feels consistent. */
export const haptic = {
  tap: () => enabled() && void Haptics.selectionAsync(),
  press: () => enabled() && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  thunk: () => enabled() && void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => enabled() && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => enabled() && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => enabled() && void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
