import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../src/app-context';
import { colors, common } from '../src/theme';
import {
  Button,
  Chip,
  Field,
  Header,
  KeyboardAwareScrollView,
  Plate,
  useKeyboardHeight,
} from '../src/ui';

const products = ['Diesel', 'Benzine', 'Jet A-1', 'Kerosene', 'Fuel oil'];

export default function CreateDelivery() {
  const { user, createDelivery } = useApp();
  const keyboard = useKeyboardHeight();
  const [origin, setOrigin] = useState('Djibouti Depot');
  const [destination, setDestination] = useState('');
  const [fuelProduct, setFuelProduct] = useState('Diesel');
  const [quantity, setQuantity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    const liters = Number(quantity.replace(/,/g, ''));
    if (
      !origin.trim() ||
      !destination.trim() ||
      !fuelProduct.trim() ||
      !Number.isFinite(liters) ||
      liters <= 0
    ) {
      setError('Origin, destination, fuel product and a positive quantity are required.');
      return;
    }
    if (!user?.truckPlate) {
      setError('No truck is assigned to your profile. Ask an administrator to update your account.');
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

  const preset = products.includes(fuelProduct);

  return (
    <View style={common.screen}>
      <Header eyebrow="New trip" title="Create trip" onBack={() => router.replace('/home')} />
      <KeyboardAwareScrollView contentContainerStyle={[common.body, s.bodyPad]} extraBottom={80}>
          <View style={common.card}>
            <Text style={[common.sectionTitle, s.sectionGap]}>Route</Text>
            <View style={s.gap}>
              <Field
                label="Loading point"
                value={origin}
                onChangeText={setOrigin}
                placeholder="Depot or terminal"
                returnKeyType="next"
              />
              <Field
                label="Destination station"
                value={destination}
                onChangeText={setDestination}
                placeholder="e.g. Dire Dawa Station"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={common.card}>
            <Text style={[common.sectionTitle, s.sectionGap]}>Load</Text>
            <Text style={s.fieldLabel}>Fuel product</Text>
            <View style={s.chips}>
              {products.map((product) => (
                <Chip
                  key={product}
                  label={product}
                  active={fuelProduct === product}
                  onPress={() => setFuelProduct(product)}
                  tone={colors.brand}
                />
              ))}
              <Chip
                label="Other"
                active={!preset}
                onPress={() => preset && setFuelProduct('')}
                tone={colors.brand}
              />
            </View>
            {!preset ? (
              <View style={s.otherField}>
                <Field
                  label="Other product"
                  value={fuelProduct}
                  onChangeText={setFuelProduct}
                  placeholder="Enter fuel product"
                />
              </View>
            ) : null}
            <View style={s.qty}>
              <Field
                label="Quantity"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="e.g. 40000"
                suffix="litres"
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
              />
            </View>
          </View>

          <View style={[common.card, s.truckCard]}>
            <View>
              <Text style={common.label}>Assigned truck</Text>
              <Text style={s.truckHint}>Set by your administrator</Text>
            </View>
            {user?.truckPlate ? (
              <Plate value={user.truckPlate} />
            ) : (
              <Text style={s.noTruck}>Not assigned</Text>
            )}
          </View>

          {error ? (
            <View style={s.error}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
      </KeyboardAwareScrollView>
      <SafeAreaView edges={keyboard ? [] : ['bottom']} style={[s.footer, { bottom: keyboard }]}>
        <Button title="Create and start trip" onPress={() => void submit()} loading={saving} />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  bodyPad: { paddingBottom: 110 },
  sectionGap: { marginBottom: 14 },
  gap: { gap: 14 },
  fieldLabel: { color: colors.text2, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  otherField: { marginTop: 14 },
  qty: { marginTop: 16 },
  truckCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  truckHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  noTruck: { color: colors.red, fontWeight: '700' },
  error: {
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: '#f6cdc8',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.red, fontSize: 14, lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(244,246,245,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
