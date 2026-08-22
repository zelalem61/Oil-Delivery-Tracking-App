import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useApp } from '../src/app-context';
import { colors, common } from '../src/theme';
import { TopNavButton } from '../src/top-nav-button';
export default function CreateDelivery() {
  const { user, createDelivery } = useApp();
  const [origin, setOrigin] = useState('Djibouti Depot');
  const [destination, setDestination] = useState('');
  const [fuelProduct, setFuelProduct] = useState('Diesel');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setError('');
    const liters = Number(quantity);
    if (
      !origin.trim() ||
      !destination.trim() ||
      !fuelProduct.trim() ||
      !Number.isFinite(liters) ||
      liters <= 0
    ) {
      setError('Origin, destination, fuel product, and a positive quantity are required.');
      return;
    }
    if (!user?.truckPlate) {
      setError(
        'No truck is assigned to your driver profile. Ask an administrator to update your account.',
      );
      return;
    }
    setSaving(true);
    try {
      await createDelivery({ origin, destination, fuelProduct, quantityLiters: liters });
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create trip. Try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <SafeAreaView style={common.screen}>
      <ScrollView contentContainerStyle={common.content}>
        <TopNavButton icon="⌂" label="Go to driver home" onPress={() => router.replace('/home')} />
        <Text style={common.kicker}>NEW TRIP</Text>
        <Text style={common.title}>Create trip</Text>
        <Text style={s.copy}>This delivery is assigned to your authenticated driver account.</Text>
        <TextInput style={s.input} value={origin} onChangeText={setOrigin} placeholder="Origin" />
        <TextInput
          style={s.input}
          value={destination}
          onChangeText={setDestination}
          placeholder="Destination station"
        />
        <TextInput
          style={s.input}
          value={fuelProduct}
          onChangeText={setFuelProduct}
          placeholder="Fuel product"
        />
        <TextInput
          style={s.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="Quantity in liters"
        />
        <Text style={s.label}>ASSIGNED TRUCK</Text>
        <Text style={s.readonly}>{user?.truckPlate ?? 'No truck assigned'}</Text>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Pressable style={[common.button, saving && s.disabled]} onPress={submit} disabled={saving}>
          <Text style={common.buttonText}>{saving ? 'Creating…' : 'Create and assign to me'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  copy: { color: colors.muted, lineHeight: 21 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '900', marginBottom: -10 },
  readonly: {
    backgroundColor: '#e9eee8',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '800',
    color: colors.dark,
  },
  error: { color: colors.red, lineHeight: 20, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
