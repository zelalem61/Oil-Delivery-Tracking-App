import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { common } from '../src/theme';
import { TopNavButton } from '../src/top-nav-button';
export default function Profile() {
  const { user, logout, queue } = useApp();
  return (
    <SafeAreaView style={common.screen}>
      <View style={common.content}>
        <TopNavButton icon="⌂" label="Go to driver home" onPress={() => router.replace('/home')} />
        <Text style={common.kicker}>DRIVER PROFILE</Text>
        <Text style={common.title}>
          {user?.firstName} {user?.lastName}
        </Text>
        <View style={common.card}>
          <Text style={common.label}>Email</Text>
          <Text style={common.value}>{user?.email}</Text>
          <Text style={[common.label, s.space]}>Role</Text>
          <Text style={common.value}>{user?.role}</Text>
          <Text style={[common.label, s.space]}>Offline queue</Text>
          <Text style={common.value}>{queue.length} pending events</Text>
        </View>
        <Pressable
          style={common.outlineButton}
          onPress={() => {
            logout();
            router.replace('/');
          }}
        >
          <Text style={common.outlineText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  space: { marginTop: 20 },
});
