import { StyleSheet } from 'react-native';

/** Design tokens shared with the web admin. */
export const colors = {
  bg: '#f4f6f5',
  surface: '#ffffff',
  surface2: '#f8faf9',
  border: '#e3e8e6',
  borderStrong: '#cfd8d4',
  text: '#0f1d18',
  text2: '#475650',
  muted: '#6b7a74',
  brand: '#0e7c58',
  brandDark: '#0b6a4b',
  brand50: '#e8f5ef',
  brandBright: '#34c08b',
  hero: '#0b2a20',
  hero2: '#12392c',
  heroText: '#cfe3da',
  heroMuted: '#86a99b',
  blue: '#2563eb',
  blue50: '#eaf1fe',
  purple: '#6d28d9',
  purple50: '#f1ebfd',
  amber: '#b45309',
  amber50: '#fef4e6',
  red: '#b42318',
  red50: '#fdecea',
  white: '#ffffff',
  // Legacy aliases kept for any older imports.
  green: '#0e7c58',
  dark: '#0f1d18',
  line: '#e3e8e6',
};

export const statusTone: Record<string, { fg: string; bg: string; dot: string }> = {
  CREATED: { fg: '#475569', bg: '#eef0f4', dot: '#94a3b8' },
  DISPATCHED: { fg: '#475569', bg: '#eef0f4', dot: '#94a3b8' },
  IN_TRANSIT: { fg: colors.blue, bg: colors.blue50, dot: colors.blue },
  ARRIVED: { fg: colors.purple, bg: colors.purple50, dot: '#8b5cf6' },
  UNLOADING: { fg: colors.purple, bg: colors.purple50, dot: '#8b5cf6' },
  AWAITING_DELIVERY_APPROVAL: { fg: colors.amber, bg: colors.amber50, dot: '#e38a17' },
  DELIVERED: { fg: colors.brand, bg: colors.brand50, dot: colors.brand },
  CANCELLED: { fg: '#737373', bg: '#f1f1f1', dot: '#a3a3a3' },
  PENDING: { fg: colors.amber, bg: colors.amber50, dot: '#e38a17' },
  APPROVED: { fg: colors.brand, bg: colors.brand50, dot: colors.brand },
  REJECTED: { fg: colors.red, bg: colors.red50, dot: colors.red },
};

export const statusLabel = (status: string) =>
  status === 'AWAITING_DELIVERY_APPROVAL'
    ? 'Awaiting approval'
    : status
        .toLowerCase()
        .split('_')
        .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
        .join(' ');

export const shadow = {
  shadowColor: '#10201a',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 18, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    ...shadow,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  value: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 3 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  // Legacy keys used by older screens.
  content: { padding: 18, gap: 16 },
  kicker: { color: colors.brand, fontWeight: '700', letterSpacing: 1.4, fontSize: 11 },
  title: { color: colors.text, fontWeight: '800', fontSize: 28 },
  button: {
    backgroundColor: colors.brand,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  outlineButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { color: colors.text2, fontSize: 15, fontWeight: '700' },
});
