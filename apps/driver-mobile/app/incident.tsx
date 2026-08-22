import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../src/app-context';
import { colors, common } from '../src/theme';
const types = [
  'BREAKDOWN',
  'ACCIDENT',
  'TIRE_PROBLEM',
  'FUEL_LEAK',
  'CUSTOMS_DELAY',
  'SECURITY_ISSUE',
  'MEDICAL_EMERGENCY',
  'ROUTE_BLOCKED',
  'OTHER',
] as const;
export default function Incident() {
  const { delivery, enqueue } = useApp();
  const [type, setType] = useState<(typeof types)[number]>('BREAKDOWN');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [description, setDescription] = useState('');
  async function submit() {
    if (!delivery) return;
    if (description.trim().length < 10) {
      Alert.alert('Add more detail', 'Enter at least 10 characters so operations can respond.');
      return;
    }
    await enqueue('INCIDENT', {
      deliveryId: delivery.id,
      type,
      severity,
      description: description.trim(),
    });
    Alert.alert('Incident saved', 'The report is queued locally and ready for synchronization.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  }
  if (!delivery)
    return (
      <SafeAreaView style={common.screen}>
        <Text>No active delivery.</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={common.screen}>
      <ScrollView contentContainerStyle={common.content}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.back}>← Live trip</Text>
        </Pressable>
        <Text style={common.kicker}>{delivery.deliveryNumber}</Text>
        <Text style={common.title}>Report incident</Text>
        <View>
          <Text style={common.label}>Type</Text>
          <View style={s.chips}>
            {types.map((item) => (
              <Pressable
                key={item}
                onPress={() => setType(item)}
                style={[s.chip, type === item && s.chipActive]}
              >
                <Text style={[s.chipText, type === item && s.chipTextActive]}>
                  {item.replaceAll('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View>
          <Text style={common.label}>Severity</Text>
          <View style={s.chips}>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setSeverity(item)}
                style={[s.chip, severity === item && s.chipActive]}
              >
                <Text style={[s.chipText, severity === item && s.chipTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <TextInput
          style={s.input}
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what happened, current condition, and assistance needed"
        />
        <Pressable style={common.button} onPress={submit}>
          <Text style={common.buttonText}>Save incident report</Text>
        </Pressable>
        <Text style={s.note}>
          Reports are retained on this device when connectivity is unavailable.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  back: { color: colors.green, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#0b382b', borderColor: '#0b382b' },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.dark },
  chipTextActive: { color: '#fff' },
  input: {
    minHeight: 140,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
