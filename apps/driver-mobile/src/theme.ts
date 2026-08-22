import { StyleSheet } from 'react-native';

export const colors = {
  green: '#0d7a56',
  dark: '#10201a',
  muted: '#66746e',
  bg: '#f3f6f4',
  white: '#ffffff',
  line: '#d6dfdb',
  amber: '#b86b13',
  red: '#a22',
};
export const common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 22, gap: 18 },
  kicker: { color: colors.green, fontWeight: '800', letterSpacing: 1.8, fontSize: 11 },
  title: { color: colors.dark, fontWeight: '900', fontSize: 32 },
  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: { color: colors.dark, fontSize: 16, fontWeight: '700', marginTop: 4 },
  button: {
    backgroundColor: colors.green,
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  outlineButton: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  outlineText: { color: colors.green, fontSize: 15, fontWeight: '800' },
});
