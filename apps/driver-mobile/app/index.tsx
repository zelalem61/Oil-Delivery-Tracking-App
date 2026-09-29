import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../src/app-context';
import { apiBaseUrl } from '../src/mobile-api';
import { colors, shadow } from '../src/theme';
import { Button, Field, KeyboardAwareScrollView, Logo } from '../src/ui';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.replace('/home');
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? `Cannot reach the FuelTrack server at ${apiBaseUrl()}. Check that your phone is on the same network.`
          : cause instanceof Error
            ? cause.message
            : 'Unable to sign in.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <KeyboardAwareScrollView contentContainerStyle={s.scroll} bounces={false}>
          <SafeAreaView edges={['top']} style={s.hero}>
            <View style={s.gridOverlay} pointerEvents="none">
              {Array.from({ length: 8 }, (_, i) => (
                <View key={i} style={[s.gridLine, { top: i * 44 }]} />
              ))}
            </View>
            <View style={s.brandRow}>
              <Logo size={44} />
              <View>
                <Text style={s.brandName}>FuelTrack</Text>
                <Text style={s.brandSub}>DRIVER</Text>
              </View>
            </View>
            <View style={s.pill}>
              <Text style={s.pillText}>Djibouti → Ethiopia corridor</Text>
            </View>
            <Text style={s.heroTitle}>
              Every trip,{'\n'}
              <Text style={s.heroAccent}>on track.</Text>
            </Text>
            <Text style={s.heroCopy}>
              Start your delivery, share your location and update each stage in a tap.
            </Text>
          </SafeAreaView>

          <View style={s.card}>
            <Text style={s.cardTitle}>Sign in</Text>
            <Text style={s.cardCopy}>Use the account your administrator created for you.</Text>
            <View style={s.form}>
              <Field
                label="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                placeholder="driver@company.com"
                returnKeyType="next"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                placeholder="Your password"
                returnKeyType="done"
                onSubmitEditing={() => void submit()}
                right={
                  <Pressable hitSlop={8} onPress={() => setShowPassword((value) => !value)}>
                    <Text style={s.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                }
              />
              {error ? (
                <View style={s.error}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}
              <Button title="Sign in" onPress={() => void submit()} loading={loading} />
            </View>
            <Text style={s.footer}>Authorized drivers only</Text>
          </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.hero,
    paddingHorizontal: 24,
    paddingBottom: 64,
    overflow: 'hidden',
  },
  gridOverlay: { ...StyleSheet.absoluteFillObject },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  brandName: { color: '#fff', fontSize: 18, fontWeight: '800' },
  brandSub: { color: '#7fbfa4', fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: 40,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pillText: { color: '#b9dccd', fontSize: 12, fontWeight: '600' },
  heroTitle: {
    color: '#fff',
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 16,
  },
  heroAccent: { color: '#4ad39f' },
  heroCopy: { color: '#a9cbbd', fontSize: 15, lineHeight: 22, marginTop: 12, maxWidth: 320 },
  card: {
    flex: 1,
    marginTop: -36,
    marginHorizontal: 14,
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 22,
    ...shadow,
  },
  cardTitle: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  cardCopy: { color: colors.muted, fontSize: 14, marginTop: 4 },
  form: { gap: 16, marginTop: 22 },
  toggle: { color: colors.brand, fontWeight: '700', fontSize: 13, paddingLeft: 8 },
  error: {
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: '#f6cdc8',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.red, fontSize: 14, lineHeight: 20 },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
