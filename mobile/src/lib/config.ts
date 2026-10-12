import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Local `netlify dev` default port. */
const DEV_API_PORT = 8888;

function devApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }
  // On a device, reach the dev machine through the same host Metro is served from.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${DEV_API_PORT}`;
}

/** Base URL of the Netlify site serving /api. Set EXPO_PUBLIC_API_URL for builds (see eas.json). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? devApiUrl() : '')).replace(/\/$/, '');

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
