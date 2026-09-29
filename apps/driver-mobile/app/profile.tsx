import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { colors, common } from '../src/theme';
import { Avatar, Button, Header, Plate } from '../src/ui';

export default function Profile() {
  const { user, logout, queue, online } = useApp();
  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Driver';
  const locations = queue.filter((event) => event.type === 'LOCATION').length;
  const incidents = queue.filter((event) => event.type === 'INCIDENT').length;

  function signOut() {
    const doIt = () => {
      logout();
      router.replace('/');
    };
    if (queue.length) {
      Alert.alert(
        'Sign out?',
        `${queue.length} items are still waiting to sync. They stay on this phone and upload after you sign in again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: doIt },
        ],
      );
    } else doIt();
  }

  return (
    <View style={common.screen}>
      <Header title="Profile" onBack={() => router.back()}>
        <View style={s.hero}>
          <Avatar name={name} size={64} />
          <View style={s.heroCopy}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.role}>{user?.role === 'DRIVER' ? 'Driver' : user?.role}</Text>
          </View>
        </View>
      </Header>

      <ScrollView contentContainerStyle={common.body}>
        <View style={[common.card, s.list]}>
          <Row label="Email" value={user?.email ?? '—'} />
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={common.label}>Assigned truck</Text>
            {user?.truckPlate ? <Plate value={user.truckPlate} /> : <Text style={s.value}>—</Text>}
          </View>
        </View>

        <Text style={common.sectionTitle}>Sync status</Text>
        <View style={[common.card, s.list]}>
          <View style={s.row}>
            <Text style={common.label}>Connection</Text>
            <View style={[s.state, { backgroundColor: online ? colors.brand50 : colors.amber50 }]}>
              <Text style={[s.stateText, { color: online ? colors.brand : colors.amber }]}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={s.divider} />
          <Row label="GPS points waiting" value={String(locations)} />
          <View style={s.divider} />
          <Row label="Incident reports on phone" value={String(incidents)} />
        </View>

        <Button title="Sign out" variant="dangerGhost" onPress={signOut} style={s.signOut} />
        <Text style={s.version}>FuelTrack Driver</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={common.label}>{label}</Text>
      <Text style={s.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroCopy: { flex: 1 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  role: { color: colors.heroMuted, fontSize: 14, fontWeight: '600', marginTop: 2 },
  list: { paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  value: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  state: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  stateText: { fontSize: 12, fontWeight: '700' },
  signOut: { marginTop: 8 },
  version: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
