import { Stack } from 'expo-router';
import { AppProvider } from '../src/app-context';
export default function Layout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProvider>
  );
}
