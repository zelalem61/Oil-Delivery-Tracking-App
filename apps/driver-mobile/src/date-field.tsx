import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { Button } from './ui';

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

export const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Tappable date field: native calendar on Android, bottom sheet on iOS, text input on web. */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange(date: Date): void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  if (Platform.OS === 'web') {
    return (
      <View style={s.field}>
        <Text style={s.label}>{label}</Text>
        <TextInput
          style={s.box}
          value={toIsoDate(value)}
          onChangeText={(text) => {
            const parsed = new Date(`${text}T00:00:00`);
            if (!Number.isNaN(parsed.getTime())) onChange(parsed);
          }}
        />
      </View>
    );
  }

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(date);
        },
      });
    } else {
      setDraft(value);
      setIosOpen(true);
    }
  }

  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(value)}`}
        onPress={open}
        style={({ pressed }) => [s.box, s.row, pressed && { opacity: 0.75 }]}
      >
        <Text style={s.value}>{formatDate(value)}</Text>
        <Text style={s.icon}>📅</Text>
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={s.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIosOpen(false)} />
            <SafeAreaView edges={['bottom']} style={s.sheet}>
              <Text style={s.sheetTitle}>{label}</Text>
              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                accentColor={colors.brand}
                onChange={(_event, date) => date && setDraft(date)}
              />
              <Button
                title="Done"
                onPress={() => {
                  onChange(draft);
                  setIosOpen(false);
                }}
              />
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  field: { flex: 1, gap: 7 },
  label: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { color: colors.text, fontSize: 15, fontWeight: '600' },
  icon: { fontSize: 16 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,27,20,0.5)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
});
