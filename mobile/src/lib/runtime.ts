import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * True inside the Expo Go app (development preview). Expo Go ships a fixed set of native
 * modules, so a few newer APIs are swapped for their older equivalents there.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
