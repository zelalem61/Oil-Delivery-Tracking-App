import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.keyboardView}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[common.content, s.content]}
          keyboardShouldPersistTaps="handled"
        >
          <TopNavButton
            icon="⌂"
            label="Go to driver home"
            onPress={() => router.replace('/home')}
          />
          <Text style={common.kicker}>NEW TRIP</Text>
          <Text style={common.title}>Create trip</Text>
          <Text style={s.copy}>
            This delivery is assigned to your authenticated driver account.
          </Text>
          <View style={s.field}>
            <Text style={s.label}>ORIGIN</Text>
            <TextInput
              accessibilityLabel="Origin"
              style={s.input}
              value={origin}
              onChangeText={setOrigin}
              placeholder="Enter loading location"
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>DESTINATION</Text>
            <TextInput
              accessibilityLabel="Destination"
              style={s.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="Enter destination station"
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>FUEL PRODUCT</Text>
            <TextInput
              accessibilityLabel="Fuel product"
              style={s.input}
              value={fuelProduct}
              onChangeText={setFuelProduct}
              placeholder="Enter fuel product"
              returnKeyType="next"
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>QUANTITY (LITERS)</Text>
            <TextInput
              accessibilityLabel="Quantity in liters"
              style={s.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="Enter quantity"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
          </View>
          <View style={s.field}>
            <Text style={s.label}>ASSIGNED TRUCK</Text>
            <Text style={s.readonly}>{user?.truckPlate ?? 'No truck assigned'}</Text>
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable
            style={[common.button, saving && s.disabled]}
            onPress={submit}
            disabled={saving}
          >
            <Text style={common.buttonText}>
              {saving ? 'Creating…' : 'Create and assign to me'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  keyboardView: { flex: 1 },
  content: { paddingBottom: 48 },
  copy: { color: colors.muted, lineHeight: 21 },
  field: { gap: 8 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
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
