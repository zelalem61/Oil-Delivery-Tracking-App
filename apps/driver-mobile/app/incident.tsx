import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../src/app-context';
import { colors, common } from '../src/theme';
import {
  Button,
  ConfirmSheet,
  Field,
  Header,
  KeyboardAwareScrollView,
  useKeyboardHeight,
} from '../src/ui';

const types = [
  { value: 'BREAKDOWN', label: 'Breakdown', icon: '🔧' },
  { value: 'ACCIDENT', label: 'Accident', icon: '💥' },
  { value: 'TIRE_PROBLEM', label: 'Tyre problem', icon: '🛞' },
  { value: 'FUEL_LEAK', label: 'Fuel leak', icon: '🛢️' },
  { value: 'CUSTOMS_DELAY', label: 'Customs delay', icon: '🛃' },
  { value: 'SECURITY_ISSUE', label: 'Security', icon: '🛡️' },
  { value: 'MEDICAL_EMERGENCY', label: 'Medical', icon: '🩺' },
  { value: 'ROUTE_BLOCKED', label: 'Road blocked', icon: '🚧' },
  { value: 'OTHER', label: 'Other', icon: '📝' },
] as const;

const severities = [
  { value: 'LOW', label: 'Low', color: '#64748b' },
  { value: 'MEDIUM', label: 'Medium', color: '#2563eb' },
  { value: 'HIGH', label: 'High', color: '#d97706' },
  { value: 'CRITICAL', label: 'Critical', color: '#b42318' },
] as const;

const FOOTER_HEIGHT = 80;

export default function Incident() {
  const { delivery, enqueue } = useApp();
  const keyboard = useKeyboardHeight();
  const [type, setType] = useState<(typeof types)[number]['value']>('BREAKDOWN');
  const [severity, setSeverity] = useState<(typeof severities)[number]['value']>('MEDIUM');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'sent' | 'queued' | null>(null);

  const selectedType = types.find((item) => item.value === type)!;
  const selectedSeverity = severities.find((item) => item.value === severity)!;
  const length = description.trim().length;

  function review() {
    if (length < 10) {
      setError('Add a few more details (at least 10 characters) so operations can respond.');
      return;
    }
    setError('');
    setConfirmOpen(true);
  }

  async function send() {
    if (!delivery) return;
    setSending(true);
    let coords: { latitude: number; longitude: number } | undefined;
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
      if (last) coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
    } catch {
      // Location is optional for a report.
    }
    try {
      const outcome = await enqueue('INCIDENT', {
        deliveryId: delivery.id,
        type,
        severity,
        description: description.trim(),
        ...coords,
      });
      setConfirmOpen(false);
      setResult(outcome);
    } finally {
      setSending(false);
    }
  }

  if (!delivery)
    return (
      <View style={common.screen}>
        <Header title="Report incident" onBack={() => router.back()} />
        <View style={[common.body, s.center]}>
          <Text style={s.emptyTitle}>No active delivery</Text>
          <Text style={common.muted}>Incidents are linked to an active trip.</Text>
        </View>
      </View>
    );

  return (
    <View style={common.screen}>
      <Header eyebrow={delivery.deliveryNumber} title="Report incident" onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={[common.body, s.bodyPad]}
        extraBottom={FOOTER_HEIGHT}
      >
        <View style={common.card}>
          <Text style={[common.sectionTitle, s.sectionGap]}>What happened?</Text>
          <View style={s.grid}>
            {types.map((item) => {
              const active = type === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setType(item.value)}
                  style={({ pressed }) => [s.tile, active && s.tileActive, pressed && s.pressed]}
                >
                  <Text style={s.tileIcon}>{item.icon}</Text>
                  <Text style={[s.tileText, active && s.tileTextActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={common.card}>
          <Text style={[common.sectionTitle, s.sectionGap]}>Severity</Text>
          <View style={s.segment}>
            {severities.map((item) => {
              const active = severity === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setSeverity(item.value)}
                  style={[s.segBtn, active && { backgroundColor: item.color }]}
                >
                  <Text style={[s.segText, active && s.segTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={common.card}>
          <Field
            label="Details"
            multiline
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              if (error) setError('');
            }}
            placeholder="What happened, current condition, and what help you need"
            hint={length >= 10 ? `${length} characters` : `${length}/10 characters minimum`}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        <Text style={s.note}>
          Reports go straight to operations. With no signal they are kept on this phone and sent
          automatically later.
        </Text>
      </KeyboardAwareScrollView>

      <SafeAreaView
        edges={keyboard ? [] : ['bottom']}
        style={[s.footer, { bottom: keyboard }]}
      >
        <Button title="Review and send" variant="danger" onPress={review} />
      </SafeAreaView>

      <ConfirmSheet
        visible={confirmOpen}
        icon="⚠️"
        iconTone="danger"
        title="Send this incident report?"
        message="Operations will be alerted immediately on the admin dashboard."
        confirmLabel="Send report"
        confirmVariant="danger"
        loading={sending}
        onConfirm={() => void send()}
        onCancel={() => setConfirmOpen(false)}
      >
        <View style={s.summary}>
          <View style={s.summaryTop}>
            <View style={s.summaryType}>
              <Text style={s.summaryIcon}>{selectedType.icon}</Text>
              <Text style={s.summaryTitle}>{selectedType.label}</Text>
            </View>
            <View style={[s.sevPill, { backgroundColor: selectedSeverity.color }]}>
              <Text style={s.sevPillText}>{selectedSeverity.label}</Text>
            </View>
          </View>
          <Text style={s.summaryText} numberOfLines={4}>
            {description.trim()}
          </Text>
          <Text style={s.summaryMeta}>
            {delivery.deliveryNumber} · {delivery.truckPlate}
          </Text>
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={result !== null}
        icon={result === 'sent' ? '✅' : '📥'}
        iconTone={result === 'sent' ? 'brand' : 'amber'}
        title={result === 'sent' ? 'Report sent' : 'Saved on this phone'}
        message={
          result === 'sent'
            ? 'Operations has received your report and can see it on the dashboard now.'
            : 'There is no connection right now. The report will be sent automatically as soon as you are back online.'
        }
        confirmLabel="Done"
        cancelLabel={null}
        onConfirm={() => {
          setResult(null);
          router.back();
        }}
        onCancel={() => {
          setResult(null);
          router.back();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  bodyPad: { paddingBottom: FOOTER_HEIGHT + 30 },
  sectionGap: { marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31.5%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  tileActive: { borderColor: colors.red, backgroundColor: colors.red50, borderWidth: 1.5 },
  tileIcon: { fontSize: 22 },
  tileText: { color: colors.text2, fontSize: 12, fontWeight: '600' },
  tileTextActive: { color: colors.red, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#eef2f0',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segText: { color: colors.text2, fontSize: 13, fontWeight: '700' },
  segTextActive: { color: '#fff' },
  error: { color: colors.red, fontSize: 13, marginTop: 10, lineHeight: 18 },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
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
  summary: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryType: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryIcon: { fontSize: 20 },
  summaryTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sevPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  sevPillText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  summaryText: { color: colors.text2, fontSize: 14, lineHeight: 20 },
  summaryMeta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
