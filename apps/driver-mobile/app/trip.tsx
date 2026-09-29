import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../src/app-context';
import { actionLabel, nextStatus, type TripStatus } from '../src/domain';
import { colors, common, statusLabel } from '../src/theme';
import {
  Badge,
  Button,
  ConfirmSheet,
  Header,
  Plate,
  PulseDot,
  Route,
  Stat,
  StatusChange,
} from '../src/ui';

const steps: { status: TripStatus; title: string; detail: string }[] = [
  { status: 'CREATED', title: 'Trip created', detail: 'Loaded and ready at the depot' },
  { status: 'DISPATCHED', title: 'Dispatched', detail: 'Leaving the depot' },
  { status: 'IN_TRANSIT', title: 'In transit', detail: 'On the road to the station' },
  { status: 'ARRIVED', title: 'Arrived', detail: 'At the destination station' },
  { status: 'UNLOADING', title: 'Unloading', detail: 'Discharging fuel' },
  {
    status: 'AWAITING_DELIVERY_APPROVAL',
    title: 'Approval requested',
    detail: 'Waiting for the administrator',
  },
  { status: 'DELIVERED', title: 'Delivered', detail: 'Confirmed by the administrator' },
];

const confirmCopy: Partial<Record<TripStatus, { icon: string; title: string; message: (to: string) => string }>> = {
  DISPATCHED: {
    icon: '🚚',
    title: 'Start this delivery?',
    message: () => 'You are leaving the depot. Operations will see your truck as dispatched.',
  },
  IN_TRANSIT: {
    icon: '🛣️',
    title: 'Begin transit?',
    message: () => 'You are on the road. Keep this screen open so your location keeps updating.',
  },
  ARRIVED: {
    icon: '📍',
    title: 'Arrived at the station?',
    message: (to) => `Confirm only when the truck is at ${to}.`,
  },
  UNLOADING: {
    icon: '⛽',
    title: 'Start unloading?',
    message: () => 'Fuel discharge is starting at the station.',
  },
  AWAITING_DELIVERY_APPROVAL: {
    icon: '✅',
    title: 'Request delivery approval?',
    message: () =>
      'Unloading is finished. The administrator will review the trip and mark it as delivered.',
  },
};

export default function Trip() {
  const { delivery, advanceTrip, enqueue, queue, refreshDelivery, justApproved, dismissApproval } =
    useApp();
  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshDelivery();
    } catch {
      // Keep showing the current trip if the refresh fails.
    } finally {
      setRefreshing(false);
    }
  }
  const [tracking, setTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<string>('Waiting for GPS…');
  const [lastFixAt, setLastFixAt] = useState<Date | null>(null);
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (!delivery || delivery.status === 'DELIVERED') return;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;
    const record = (position: Location.LocationObject) => {
      if (!active) return;
      const payload = {
        deliveryId: delivery.id,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: new Date(position.timestamp).toISOString(),
      };
      void enqueue('LOCATION', payload);
      setLastLocation(
        `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
      );
      setLastFixAt(new Date(position.timestamp));
    };
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setLastLocation('Location permission required');
          Alert.alert(
            'Location required',
            'Allow location access so FuelTrack can record this active trip every 10 seconds.',
          );
          return;
        }
        setLastLocation('Getting current position…');
        record(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 0 },
          record,
        );
        if (active) setTracking(true);
        else subscription.remove();
      } catch {
        if (active) setLastLocation('GPS unavailable');
      }
    })();
    return () => {
      active = false;
      subscription?.remove();
      setTracking(false);
    };
  }, [delivery?.id]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  function next() {
    if (!delivery || !nextStatus[delivery.status]) return;
    setConfirmError('');
    setConfirmOpen(true);
  }

  async function confirmNext() {
    setAdvancing(true);
    setConfirmError('');
    try {
      await advanceTrip();
      setConfirmOpen(false);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : 'Could not update status. Try again.');
    } finally {
      setAdvancing(false);
    }
  }

  if (!delivery && justApproved)
    return (
      <View style={common.screen}>
        <Header
          eyebrow={justApproved.deliveryNumber}
          title="Trip complete"
          onBack={() => {
            dismissApproval();
            router.replace('/home');
          }}
        />
        <View style={[common.body, s.center]}>
          <View style={s.doneIcon}>
            <Text style={s.doneEmoji}>🎉</Text>
          </View>
          <Text style={s.emptyTitle}>Delivery approved</Text>
          <Text style={[common.muted, s.doneText]}>
            {justApproved.quantityLiters.toLocaleString()} L of {justApproved.fuelProduct} to{' '}
            {justApproved.destination} has been confirmed as delivered by the administrator.
          </Text>
          <Button
            title="Back to home"
            onPress={() => {
              dismissApproval();
              router.replace('/home');
            }}
            style={s.stretch}
          />
        </View>
      </View>
    );

  if (!delivery)
    return (
      <View style={common.screen}>
        <Header title="Live trip" onBack={() => router.replace('/home')} />
        <View style={[common.body, s.center]}>
          <Text style={s.emptyTitle}>No active delivery</Text>
          <Text style={common.muted}>Create a trip from the home screen first.</Text>
          <Button title="Go to home" onPress={() => router.replace('/home')} style={s.stretch} />
        </View>
      </View>
    );

  const action = actionLabel[delivery.status];
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.status === delivery.status),
  );
  const queued = queue.filter(
    (event) => event.type === 'LOCATION' && event.payload.deliveryId === delivery.id,
  ).length;
  const secondsAgo = lastFixAt ? Math.round((Date.now() - lastFixAt.getTime()) / 1000) : null;

  return (
    <View style={common.screen}>
      <Header eyebrow={delivery.deliveryNumber} title="Live trip" onBack={() => router.replace('/home')}>
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <Badge status={delivery.status} onDark />
            <Plate value={delivery.truckPlate} />
          </View>
          <View style={s.heroRoute}>
            <Text style={s.heroPlace} numberOfLines={1}>
              {delivery.origin}
            </Text>
            <Text style={s.heroArrow}>→</Text>
            <Text style={[s.heroPlace, s.heroDest]} numberOfLines={1}>
              {delivery.destination}
            </Text>
          </View>
        </View>
      </Header>

      <ScrollView
        contentContainerStyle={[common.body, s.bodyPad]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {/* GPS */}
        <View style={common.card}>
          <View style={s.gpsHead}>
            <View style={s.gpsTitleRow}>
              <PulseDot active={tracking} />
              <Text style={s.gpsTitle}>{tracking ? 'Sharing live location' : 'Starting GPS…'}</Text>
            </View>
            <Text style={s.gpsEvery}>every 10 s</Text>
          </View>
          <Text style={s.coords}>{lastLocation}</Text>
          <View style={s.gpsMeta}>
            <Text style={common.muted}>
              {secondsAgo !== null ? `Last fix ${secondsAgo < 5 ? 'just now' : `${secondsAgo}s ago`}` : 'No fix yet'}
            </Text>
            <Text style={[common.muted, queued ? { color: colors.amber } : null]}>
              {queued ? `${queued} points waiting to upload` : 'Up to date'}
            </Text>
          </View>
        </View>

        {/* Load */}
        <View style={s.stats}>
          <Stat label="Fuel" value={delivery.fuelProduct} />
          <Stat label="Quantity" value={`${delivery.quantityLiters.toLocaleString()} L`} />
        </View>

        {/* Route */}
        <View style={common.card}>
          <Route origin={delivery.origin} destination={delivery.destination} />
        </View>

        {/* Timeline */}
        <View style={common.card}>
          <Text style={[common.sectionTitle, s.timelineTitle]}>Trip progress</Text>
          {steps.map((step, index) => {
            const done = index < currentIndex || delivery.status === 'DELIVERED';
            const current = index === currentIndex && delivery.status !== 'DELIVERED';
            const last = index === steps.length - 1;
            return (
              <View key={step.status} style={s.step}>
                <View style={s.stepRail}>
                  <View
                    style={[
                      s.stepDot,
                      done && s.stepDotDone,
                      current && s.stepDotCurrent,
                    ]}
                  >
                    {done ? <Text style={s.check}>✓</Text> : null}
                  </View>
                  {!last ? <View style={[s.stepLine, done && s.stepLineDone]} /> : null}
                </View>
                <View style={s.stepCopy}>
                  <Text
                    style={[
                      s.stepTitle,
                      !done && !current && s.stepTitleFuture,
                      current && { color: colors.brand },
                    ]}
                  >
                    {step.title}
                  </Text>
                  <Text style={s.stepDetail}>{step.detail}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Button
          title="Report an incident"
          variant="dangerGhost"
          onPress={() => router.push('/incident')}
        />
        <Text style={s.disclaimer}>
          Location is recorded while this screen is open. Only an administrator can mark the
          delivery as Delivered.
        </Text>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={s.footer}>
        {action ? (
          <Button title={action} onPress={next} loading={advancing} />
        ) : (
          <View style={[s.footerNote, delivery.status === 'DELIVERED' && s.footerDone]}>
            <Text
              style={[
                s.footerNoteText,
                delivery.status === 'DELIVERED' && { color: colors.brand },
              ]}
            >
              {delivery.status === 'AWAITING_DELIVERY_APPROVAL'
                ? '⏳  Waiting for admin approval'
                : '✓  Delivery approved'}
            </Text>
          </View>
        )}
      </SafeAreaView>
      {nextStatus[delivery.status] ? (
        <ConfirmSheet
          visible={confirmOpen}
          icon={confirmCopy[nextStatus[delivery.status]!]?.icon}
          title={confirmCopy[nextStatus[delivery.status]!]?.title ?? 'Confirm status change'}
          message={confirmCopy[nextStatus[delivery.status]!]?.message(delivery.destination)}
          confirmLabel={`Yes, ${(actionLabel[delivery.status] ?? 'continue').toLowerCase()}`}
          loading={advancing}
          error={confirmError}
          onConfirm={() => void confirmNext()}
          onCancel={() => setConfirmOpen(false)}
        >
          <StatusChange from={delivery.status} to={nextStatus[delivery.status]!} />
        </ConfirmSheet>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', paddingTop: 60, gap: 10 },
  stretch: { alignSelf: 'stretch', marginTop: 12 },
  doneIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  doneEmoji: { fontSize: 38 },
  doneText: { textAlign: 'center', maxWidth: 300 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  bodyPad: { paddingBottom: 120 },
  heroCard: {
    backgroundColor: colors.hero2,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRoute: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroPlace: { color: '#fff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  heroDest: { color: '#7ee0b8' },
  heroArrow: { color: colors.heroMuted, fontSize: 16 },
  gpsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gpsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gpsTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  gpsEvery: {
    color: colors.brand,
    backgroundColor: colors.brand50,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: 'hidden',
  },
  coords: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },
  gpsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  stats: { flexDirection: 'row', gap: 10 },
  plateStat: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  plateLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  timelineTitle: { marginBottom: 14 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 22 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.brand, borderColor: colors.brand },
  stepDotCurrent: { borderColor: colors.brand, borderWidth: 6 },
  check: { color: '#fff', fontSize: 12, fontWeight: '900', lineHeight: 14 },
  stepLine: { flex: 1, width: 2, backgroundColor: colors.border, minHeight: 18 },
  stepLineDone: { backgroundColor: colors.brand },
  stepCopy: { flex: 1, paddingBottom: 16 },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  stepTitleFuture: { color: colors.muted, fontWeight: '600' },
  stepDetail: { color: colors.muted, fontSize: 13, marginTop: 1 },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(244,246,245,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerNote: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#f5dfbd',
    marginBottom: 4,
  },
  footerDone: { backgroundColor: colors.brand50, borderColor: '#bfe6d5' },
  footerNoteText: { color: colors.amber, fontSize: 15, fontWeight: '700' },
});
