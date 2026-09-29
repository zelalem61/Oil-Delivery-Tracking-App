import { Stack } from 'expo-router';
import { AppProvider } from '../src/app-context';
import { colors } from '../src/theme';

export default function Layout() {
  return (
    <AppProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </AppProvider>
  );
}
