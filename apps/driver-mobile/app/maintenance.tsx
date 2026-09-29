import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../src/app-context';
import type { MaintenanceRecord } from '../src/domain';
import { colors, common } from '../src/theme';
import { Badge, Button, Header, RoundButton } from '../src/ui';

type ListResponse = {
  items: MaintenanceRecord[];
  summary: { count: number; totalCostEtb: number; byStatus: Record<string, { count: number; costEtb: number }> };
};

const etb = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function MaintenanceList() {
  const { request } = useApp();
  const requestRef = useRef(request);
  requestRef.current = request;
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await requestRef.current<ListResponse>('/maintenance?pageSize=100'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load garage records.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen comes back into view (e.g. after adding a record).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const pending = data?.summary.byStatus.PENDING;
  const approved = data?.summary.byStatus.APPROVED;

  return (
    <View style={common.screen}>
      <Header
        eyebrow="Truck maintenance"
        title="Garage records"
        onBack={() => router.replace('/home')}
        right={
          <RoundButton label="Add garage record" onPress={() => router.push('/maintenance-new')}>
            <Text style={s.plus}>+</Text>
          </RoundButton>
        }
      >
        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statLabel}>Records</Text>
            <Text style={s.statValue}>{data?.summary.count ?? '–'}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>Pending</Text>
            <Text style={[s.statValue, { color: '#f5c170' }]}>{pending?.count ?? 0}</Text>
          </View>
          <View style={[s.stat, s.statWide]}>
            <Text style={s.statLabel}>Approved cost</Text>
            <Text style={s.statValue} numberOfLines={1}>
              {etb(approved?.costEtb ?? 0)}
            </Text>
          </View>
        </View>
      </Header>

      <ScrollView
        contentContainerStyle={common.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        {error ? (
          <View style={s.error}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !data ? (
          <Text style={[common.muted, s.center]}>Loading…</Text>
        ) : !data?.items.length ? (
          <View style={[common.card, s.empty]}>
            <View style={s.emptyIcon}>
              <Text style={s.emptyEmoji}>🔧</Text>
            </View>
            <Text style={s.emptyTitle}>No garage records yet</Text>
            <Text style={[common.muted, s.center]}>
              When your truck goes to a garage, record the dates, what was fixed and the cost, with
              receipts attached.
            </Text>
            <Button
              title="+ Add garage record"
              onPress={() => router.push('/maintenance-new')}
              style={s.stretch}
            />
          </View>
        ) : (
          data.items.map((record) => (
            <View key={record.id} style={common.card}>
              <View style={s.top}>
                <Text style={s.garage} numberOfLines={1}>
                  {record.garageName}
                </Text>
                <Badge status={record.status} />
              </View>
              <Text style={s.meta}>
                {shortDate(record.startDate)} → {shortDate(record.endDate)} · {record.daysInGarage} day
                {record.daysInGarage === 1 ? '' : 's'}
                {record.garageLocation ? ` · ${record.garageLocation}` : ''}
              </Text>
              <Text style={s.work} numberOfLines={3}>
                {record.workDone}
              </Text>
              <View style={s.bottom}>
                <Text style={s.cost}>{etb(record.costEtb)}</Text>
                <Text style={s.files}>
                  {record.attachments.length
                    ? `📎 ${record.attachments.length} file${record.attachments.length === 1 ? '' : 's'}`
                    : 'No attachments'}
                </Text>
              </View>
              {record.reviewNote ? (
                <View style={[s.note, record.status === 'REJECTED' && s.noteRejected]}>
                  <Text style={[s.noteText, record.status === 'REJECTED' && { color: colors.red }]}>
                    Admin: {record.reviewNote}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  plus: { color: '#fff', fontSize: 24, fontWeight: '600', marginTop: -2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.hero2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statWide: { flex: 1.6 },
  statLabel: { color: colors.heroMuted, fontSize: 11, fontWeight: '600' },
  statValue: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  center: { textAlign: 'center' },
  stretch: { alignSelf: 'stretch', marginTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: { fontSize: 26 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  garage: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  work: { color: colors.text2, fontSize: 14, lineHeight: 20, marginTop: 10 },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cost: { color: colors.text, fontSize: 17, fontWeight: '800' },
  files: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  note: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.brand50,
  },
  noteRejected: { backgroundColor: colors.red50 },
  noteText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  error: {
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: '#f6cdc8',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: colors.red, fontSize: 14 },
});
