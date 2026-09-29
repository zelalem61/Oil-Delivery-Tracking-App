import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import { nextStatus, type TripStatus } from '../src/domain';
import { colors, common } from '../src/theme';
import {
  Avatar,
  Badge,
  Button,
  ConfirmSheet,
  Header,
  Plate,
  Route,
  RoundButton,
  Stat,
} from '../src/ui';

const steps: TripStatus[] = [
  'CREATED',
  'DISPATCHED',
  'IN_TRANSIT',
  'ARRIVED',
  'UNLOADING',
  'AWAITING_DELIVERY_APPROVAL',
  'DELIVERED',
];

function timeAgo(value?: string) {
  if (!value) return '';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const {
    user,
    delivery,
    lastCompleted,
    justApproved,
    dismissApproval,
    queue,
    online,
    loadingDelivery,
    refreshDelivery,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Driver';
  const stepIndex = delivery ? Math.max(0, steps.indexOf(delivery.status)) : 0;
  const progress = delivery ? (stepIndex / (steps.length - 1)) * 100 : 0;
  const waitingApproval = delivery && !nextStatus[delivery.status];

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshDelivery();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View style={common.screen}>
      <Header
        eyebrow={greeting()}
        title={user?.firstName ?? 'Driver'}
        right={
          <RoundButton label="Open profile" onPress={() => router.push('/profile')}>
            <Avatar name={name} size={38} />
          </RoundButton>
        }
      >
        <View style={s.statusRow}>
          <View style={[s.pill, online ? s.pillOnline : s.pillOffline]}>
            <View style={[s.dot, { backgroundColor: online ? '#34c08b' : '#f0a43a' }]} />
            <Text style={s.pillText}>{online ? 'Online' : 'Offline'}</Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillText}>
              {queue.length ? `${queue.length} waiting to sync` : 'All data synced'}
            </Text>
          </View>
          {user?.truckPlate ? (
            <View style={s.pill}>
              <Text style={s.pillText}>🚚 {user.truckPlate}</Text>
            </View>
          ) : null}
        </View>
      </Header>

      <ScrollView
        contentContainerStyle={common.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <Text style={common.sectionTitle}>Current trip</Text>

        {loadingDelivery && !delivery ? (
          <View style={[common.card, s.skeletonCard]}>
            <View style={[s.skeleton, { width: '40%' }]} />
            <View style={[s.skeleton, { width: '70%', height: 20 }]} />
            <View style={[s.skeleton, { width: '90%' }]} />
          </View>
        ) : delivery ? (
          <View style={common.card}>
            <View style={s.tripTop}>
              <Text style={s.tripNumber}>{delivery.deliveryNumber}</Text>
              <Badge status={delivery.status} />
            </View>

            <View style={s.routeWrap}>
              <Route origin={delivery.origin} destination={delivery.destination} />
            </View>

            <View style={s.stats}>
              <Stat label="Fuel" value={delivery.fuelProduct} />
              <Stat label="Quantity" value={`${delivery.quantityLiters.toLocaleString()} L`} />
            </View>

            <View style={s.progressHead}>
              <Text style={common.label}>Trip progress</Text>
              <Text style={s.progressStep}>
                Step {stepIndex + 1} of {steps.length}
              </Text>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.max(progress, 4)}%` }]} />
            </View>

            {waitingApproval ? (
              <View style={s.notice}>
                <Text style={s.noticeText}>
                  Waiting for the administrator to confirm delivery.
                </Text>
                <Text style={s.noticeSub}>
                  Checking automatically every 15 s · pull down to check now
                </Text>
              </View>
            ) : null}

            <View style={s.cardFooter}>
              <Plate value={delivery.truckPlate} />
              <Button
                title="Open trip  →"
                onPress={() => router.push('/trip')}
                style={s.openBtn}
              />
            </View>
          </View>
        ) : (
          <View style={[common.card, s.empty]}>
            <View style={s.emptyIcon}>
              <Text style={s.emptyEmoji}>⛽</Text>
            </View>
            <Text style={s.emptyTitle}>No active trip</Text>
            <Text style={[common.muted, s.center]}>
              When you are loaded and ready to leave the depot, create your trip here.
            </Text>
            <Button
              title="+ Create trip"
              onPress={() => router.push('/create-delivery')}
              style={s.emptyBtn}
            />
          </View>
        )}

        {!delivery && lastCompleted ? (
          <>
            <Text style={[common.sectionTitle, s.gapTop]}>Last delivery</Text>
            <View style={[common.card, s.lastCard]}>
              <View style={s.tripTop}>
                <Text style={s.tripNumber}>{lastCompleted.deliveryNumber}</Text>
                <Badge status="DELIVERED" />
              </View>
              <Text style={s.lastRoute} numberOfLines={1}>
                {lastCompleted.origin} → {lastCompleted.destination}
              </Text>
              <Text style={s.lastMeta}>
                ✓ Approved by admin
                {lastCompleted.updatedAt ? ` · ${timeAgo(lastCompleted.updatedAt)}` : ''} ·{' '}
                {lastCompleted.quantityLiters.toLocaleString()} L {lastCompleted.fuelProduct}
              </Text>
            </View>
          </>
        ) : null}

        <Text style={[common.sectionTitle, s.gapTop]}>Quick actions</Text>
        <View style={s.actions}>
          <Button
            title="Refresh"
            variant="ghost"
            onPress={() => void onRefresh()}
            loading={refreshing}
            style={s.action}
          />
          <Button
            title="Report incident"
            variant="dangerGhost"
            onPress={() => router.push('/incident')}
            disabled={!delivery}
            style={s.action}
          />
        </View>
        <Button
          title="🔧  Garage & repairs"
          variant="ghost"
          onPress={() => router.push('/maintenance')}
        />
        <Text style={s.hint}>Pull down to refresh from operations.</Text>
      </ScrollView>

      <ConfirmSheet
        visible={Boolean(justApproved)}
        icon="🎉"
        title="Delivery approved"
        message={
          justApproved
            ? `${justApproved.deliveryNumber} to ${justApproved.destination} has been confirmed as delivered by the administrator. You can now start a new trip.`
            : undefined
        }
        confirmLabel="Great"
        cancelLabel={null}
        onConfirm={dismissApproval}
        onCancel={dismissApproval}
      />
    </View>
  );
}

const s = StyleSheet.create({
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillOnline: { backgroundColor: 'rgba(52,192,139,0.15)' },
  pillOffline: { backgroundColor: 'rgba(240,164,58,0.15)' },
  pillText: { color: colors.heroText, fontSize: 12, fontWeight: '600' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  tripTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripNumber: { color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  routeWrap: { marginTop: 16, marginBottom: 16 },
  stats: { flexDirection: 'row', gap: 10 },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  progressStep: { color: colors.text2, fontSize: 12, fontWeight: '700' },
  track: {
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 99, backgroundColor: colors.brand },
  notice: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.amber50,
    borderWidth: 1,
    borderColor: '#f5dfbd',
  },
  noticeText: { color: colors.amber, fontSize: 13, fontWeight: '600' },
  noticeSub: { color: colors.amber, fontSize: 12, marginTop: 4, opacity: 0.8 },
  lastCard: { gap: 6 },
  lastRoute: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 6 },
  lastMeta: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  openBtn: { minHeight: 46, paddingHorizontal: 20 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyEmoji: { fontSize: 26 },
  emptyTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  center: { textAlign: 'center', maxWidth: 280 },
  emptyBtn: { marginTop: 12, alignSelf: 'stretch' },
  gapTop: { marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  skeletonCard: { gap: 12 },
  skeleton: { height: 14, borderRadius: 7, backgroundColor: colors.surface2 },
});
