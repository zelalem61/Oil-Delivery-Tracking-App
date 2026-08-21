import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

export function apiBaseUrl() {
  if (Platform.OS !== 'web' && Constants.expoConfig?.hostUri) {
    const host = Constants.expoConfig.hostUri.split(':')[0];
    if (host) return `http://${host}:4000/api`;
  }
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const source = NativeModules.SourceCode as { scriptURL?: string } | undefined;
  if (source?.scriptURL) {
    const metro = new URL(source.scriptURL);
    return `${metro.protocol}//${metro.hostname}:4000/api`;
  }
  return 'http://localhost:4000/api';
}
