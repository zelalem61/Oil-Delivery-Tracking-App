import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../src/app-context';
import { DateField, formatDate, toIsoDate } from '../src/date-field';
import { colors, common } from '../src/theme';
import {
  Button,
  ConfirmSheet,
  Field,
  Header,
  KeyboardAwareScrollView,
  Plate,
  useKeyboardHeight,
} from '../src/ui';

type Attachment = { uri: string; name: string; mimeType: string; size?: number; isImage: boolean };

const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;
const FOOTER_HEIGHT = 80;
const docTypes = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const formatSize = (bytes?: number) =>
  !bytes ? '' : bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
const formatEtb = (value: number) =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETB`;

export default function NewMaintenance() {
  const { user, online, request } = useApp();
  const keyboard = useKeyboardHeight();
  const today = new Date();
  const [garageName, setGarageName] = useState('');
  const [garageLocation, setGarageLocation] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [workDone, setWorkDone] = useState('');
  const [cost, setCost] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const costValue = Number(cost.replace(/,/g, ''));
  const days = Math.round((stripTime(endDate) - stripTime(startDate)) / 86_400_000) + 1;

  function addFiles(items: Attachment[]) {
    setError('');
    const tooBig = items.find((item) => item.size && item.size > MAX_BYTES);
    if (tooBig) setError(`${tooBig.name} is larger than 10 MB.`);
    const accepted = items.filter((item) => !item.size || item.size <= MAX_BYTES);
    setFiles((current) => {
      const next = [...current, ...accepted];
      if (next.length > MAX_FILES) setError(`You can attach up to ${MAX_FILES} files.`);
      return next.slice(0, MAX_FILES);
    });
  }

  function fromImageAssets(assets: ImagePicker.ImagePickerAsset[]): Attachment[] {
    return assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
      isImage: true,
    }));
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Allow camera access to take a photo of the receipt or repair.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!result.canceled) addFiles(fromImageAssets(result.assets));
  }

  async function pickPhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_FILES - files.length),
      quality: 0.6,
    });
    if (!result.canceled) addFiles(fromImageAssets(result.assets));
  }

  async function pickDocuments() {
    const result = await DocumentPicker.getDocumentAsync({
      type: docTypes,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    addFiles(
      result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        size: asset.size,
        isImage: (asset.mimeType ?? '').startsWith('image/'),
      })),
    );
  }

  function review() {
    if (garageName.trim().length < 2) return setError('Enter the garage name.');
    if (stripTime(endDate) < stripTime(startDate))
      return setError('The end date cannot be before the start date.');
    if (workDone.trim().length < 5) return setError('Describe what was fixed.');
    if (!Number.isFinite(costValue) || costValue < 0 || cost.trim() === '')
      return setError('Enter the total cost in ETB.');
    if (!online) return setError('You need an internet connection to upload a garage record.');
    setError('');
    setSubmitError('');
    setConfirmOpen(true);
  }

  async function submit() {
    setSaving(true);
    setSubmitError('');
    try {
      const form = new FormData();
      form.append('garageName', garageName.trim());
      if (garageLocation.trim()) form.append('garageLocation', garageLocation.trim());
      form.append('startDate', toIsoDate(startDate));
      form.append('endDate', toIsoDate(endDate));
      form.append('workDone', workDone.trim());
      form.append('costEtb', String(costValue));
      for (const file of files) {
        // React Native's FormData accepts { uri, name, type } objects for file parts.
        form.append('files', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      }
      await request('/maintenance', { method: 'POST', body: form });
      setConfirmOpen(false);
      setDone(true);
    } catch (cause) {
      setSubmitError(
        cause instanceof TypeError
          ? 'Could not reach the FuelTrack server. Check your connection and try again.'
          : cause instanceof Error
            ? cause.message
            : 'Could not submit the record.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={common.screen}>
      <Header eyebrow="Garage & repairs" title="New garage record" onBack={() => router.back()} />
      <KeyboardAwareScrollView
        contentContainerStyle={[common.body, s.bodyPad]}
        extraBottom={FOOTER_HEIGHT}
      >
        <View style={[common.card, s.truckCard]}>
          <View>
            <Text style={common.label}>Truck</Text>
            <Text style={s.truckHint}>Record is saved against your assigned truck</Text>
          </View>
          {user?.truckPlate ? <Plate value={user.truckPlate} /> : null}
        </View>

        <View style={common.card}>
          <Text style={[common.sectionTitle, s.sectionGap]}>Garage</Text>
          <View style={s.gap}>
            <Field
              label="Garage name"
              value={garageName}
              onChangeText={setGarageName}
              placeholder="e.g. Awash Truck Service"
            />
            <Field
              label="Location (optional)"
              value={garageLocation}
              onChangeText={setGarageLocation}
              placeholder="Town or area"
            />
          </View>
        </View>

        <View style={common.card}>
          <Text style={[common.sectionTitle, s.sectionGap]}>Time in garage</Text>
          <View style={s.dates}>
            <DateField
              label="Start date"
              value={startDate}
              maximumDate={today}
              onChange={(date) => {
                setStartDate(date);
                if (stripTime(endDate) < stripTime(date)) setEndDate(date);
              }}
            />
            <DateField
              label="End date"
              value={endDate}
              minimumDate={startDate}
              onChange={setEndDate}
            />
          </View>
          <Text style={s.days}>
            {days > 0 ? `${days} day${days === 1 ? '' : 's'} in the garage` : 'Check the dates'}
          </Text>
        </View>

        <View style={common.card}>
          <Text style={[common.sectionTitle, s.sectionGap]}>Repair</Text>
          <View style={s.gap}>
            <Field
              label="What was fixed"
              multiline
              value={workDone}
              onChangeText={setWorkDone}
              placeholder="e.g. Replaced 2 rear tyres, fixed brake air leak, oil change"
            />
            <Field
              label="Total cost"
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              placeholder="0"
              suffix="ETB"
            />
          </View>
        </View>

        <View style={common.card}>
          <View style={s.attachHead}>
            <Text style={common.sectionTitle}>Attachments</Text>
            <Text style={s.attachCount}>
              {files.length}/{MAX_FILES}
            </Text>
          </View>
          <Text style={s.attachHint}>Receipts, invoices or photos of the repair · up to 10 MB each</Text>
          <View style={s.attachButtons}>
            <AttachButton icon="📷" label="Camera" onPress={() => void takePhoto()} disabled={files.length >= MAX_FILES} />
            <AttachButton icon="🖼️" label="Photos" onPress={() => void pickPhotos()} disabled={files.length >= MAX_FILES} />
            <AttachButton icon="📄" label="File" onPress={() => void pickDocuments()} disabled={files.length >= MAX_FILES} />
          </View>
          {files.length ? (
            <View style={s.fileList}>
              {files.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={s.fileRow}>
                  {file.isImage ? (
                    <Image source={{ uri: file.uri }} style={s.thumb} />
                  ) : (
                    <View style={[s.thumb, s.docThumb]}>
                      <Text style={s.docIcon}>📄</Text>
                    </View>
                  )}
                  <View style={s.fileInfo}>
                    <Text style={s.fileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={s.fileMeta}>{formatSize(file.size)}</Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel={`Remove ${file.name}`}
                    onPress={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    style={s.remove}
                  >
                    <Text style={s.removeText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={s.error}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <SafeAreaView edges={keyboard ? [] : ['bottom']} style={[s.footer, { bottom: keyboard }]}>
        <Button title="Review and submit" onPress={review} />
      </SafeAreaView>

      <ConfirmSheet
        visible={confirmOpen}
        icon="🔧"
        title="Submit garage record?"
        message="Operations will review it and approve or reject the cost."
        confirmLabel={files.length ? `Submit with ${files.length} file${files.length === 1 ? '' : 's'}` : 'Submit record'}
        loading={saving}
        error={submitError}
        onConfirm={() => void submit()}
        onCancel={() => setConfirmOpen(false)}
      >
        <View style={s.summary}>
          <SummaryRow label="Garage" value={garageName.trim()} />
          <SummaryRow
            label="Dates"
            value={`${formatDate(startDate)} → ${formatDate(endDate)} (${days} day${days === 1 ? '' : 's'})`}
          />
          <SummaryRow label="Cost" value={Number.isFinite(costValue) ? formatEtb(costValue) : '—'} strong />
          <Text style={s.summaryWork} numberOfLines={3}>
            {workDone.trim()}
          </Text>
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={done}
        icon="✅"
        title="Submitted for approval"
        message="Your garage record was sent to operations. You will see the approval status in Garage records."
        confirmLabel="View my records"
        cancelLabel={null}
        onConfirm={() => {
          setDone(false);
          router.replace('/maintenance');
        }}
        onCancel={() => {
          setDone(false);
          router.replace('/maintenance');
        }}
      />
    </View>
  );
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function AttachButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: string;
  label: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.attachBtn, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
    >
      <Text style={s.attachIcon}>{icon}</Text>
      <Text style={s.attachLabel}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={[s.summaryValue, strong && s.summaryStrong]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  bodyPad: { paddingBottom: FOOTER_HEIGHT + 30 },
  sectionGap: { marginBottom: 14 },
  gap: { gap: 14 },
  truckCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  truckHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  dates: { flexDirection: 'row', gap: 10 },
  days: { color: colors.brand, fontSize: 13, fontWeight: '700', marginTop: 12 },
  attachHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attachCount: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  attachHint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  attachButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  attachBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface2,
  },
  attachIcon: { fontSize: 20 },
  attachLabel: { color: colors.text2, fontSize: 13, fontWeight: '700' },
  fileList: { gap: 8, marginTop: 14 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.border },
  docThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },
  docIcon: { fontSize: 20 },
  fileInfo: { flex: 1 },
  fileName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  fileMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  remove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red50,
  },
  removeText: { color: colors.red, fontSize: 18, fontWeight: '700', marginTop: -2 },
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
  summary: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  summaryStrong: { color: colors.brand, fontSize: 16, fontWeight: '800' },
  summaryWork: { color: colors.text2, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
