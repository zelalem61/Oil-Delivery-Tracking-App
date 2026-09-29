import { StatusBar } from 'expo-status-bar';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadow, statusLabel, statusTone } from './theme';

/* ---------- Keyboard handling ----------
   Expo SDK 54 runs Android edge-to-edge, so the window no longer resizes when the keyboard
   opens. These helpers measure the keyboard, add room for it and scroll the focused input
   into view on both Android and iOS. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

const RevealFocusedContext = createContext<(() => void) | null>(null);

export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  extraBottom = 0,
  ...rest
}: ScrollViewProps & { extraBottom?: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const keyboard = useKeyboardHeight();
  const keyboardRef = useRef(0);
  keyboardRef.current = keyboard;

  const reveal = useCallback(() => {
    setTimeout(
      () => {
        if (!keyboardRef.current) return;
        const state = TextInput.State as Partial<typeof TextInput.State>;
        const input = state.currentlyFocusedInput?.();
        const content = contentRef.current;
        if (!input || !content) return;
        input.measureLayout(
          content,
          (_x, y, _width, height) => {
            const visible = viewportHeight.current - keyboardRef.current - extraBottom;
            const top = scrollY.current;
            if (y + height + 24 > top + visible) {
              scrollRef.current?.scrollTo({ y: Math.max(0, y + height + 24 - visible), animated: true });
            } else if (y < top + 12) {
              scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
            }
          },
          () => undefined,
        );
      },
      Platform.OS === 'android' ? 120 : 50,
    );
  }, [extraBottom]);

  useEffect(() => {
    if (keyboard > 0) reveal();
  }, [keyboard, reveal]);

  return (
    <RevealFocusedContext.Provider value={reveal}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...rest}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          rest.onLayout?.(event);
        }}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
          rest.onScroll?.(event);
        }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboard }}
      >
        <View ref={contentRef} collapsable={false} style={[{ flexGrow: 1 }, contentContainerStyle]}>
          {children}
        </View>
      </ScrollView>
    </RevealFocusedContext.Provider>
  );
}

/* ---------- Brand logo (truck drawn with Views, no icon package needed) ---------- */
export function Logo({ size = 44 }: { size?: number }) {
  const u = size / 44;
  return (
    <View style={[ui.logo, { width: size, height: size, borderRadius: 13 * u }]}>
      <View style={{ width: 26 * u, height: 16 * u }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 16 * u,
            height: 11 * u,
            borderRadius: 2 * u,
            backgroundColor: '#fff',
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 17 * u,
            top: 3 * u,
            width: 9 * u,
            height: 8 * u,
            borderRadius: 2 * u,
            borderTopRightRadius: 4 * u,
            backgroundColor: '#fff',
          }}
        />
        {[4, 19].map((left) => (
          <View
            key={left}
            style={{
              position: 'absolute',
              left: left * u,
              top: 10 * u,
              width: 6 * u,
              height: 6 * u,
              borderRadius: 3 * u,
              backgroundColor: '#fff',
              borderWidth: 1.5 * u,
              borderColor: colors.brand,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/* ---------- Dark hero header used at the top of every signed-in screen ---------- */
export function Header({
  title,
  eyebrow,
  onBack,
  right,
  children,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={ui.header}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']}>
        <View style={ui.headerRow}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={10}
              onPress={onBack}
              style={({ pressed }) => [ui.roundBtn, pressed && ui.pressed]}
            >
              <Text style={ui.roundBtnText}>‹</Text>
            </Pressable>
          ) : (
            <Logo size={36} />
          )}
          <View style={ui.headerCopy}>
            {eyebrow ? <Text style={ui.eyebrow}>{eyebrow}</Text> : null}
            <Text style={ui.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {right}
        </View>
        {children ? <View style={ui.headerBody}>{children}</View> : null}
      </SafeAreaView>
    </View>
  );
}

export function RoundButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress(): void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [ui.roundBtn, pressed && ui.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[ui.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[ui.avatarText, { fontSize: size * 0.36 }]}>{initials || 'D'}</Text>
    </View>
  );
}

/* ---------- Buttons ---------- */
type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'dangerGhost' | 'light';
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress(): void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        v.box,
        (disabled || loading) && { opacity: 0.6 },
        pressed && ui.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text.color} />
      ) : (
        <Text style={[ui.buttonText, v.text]}>{title}</Text>
      )}
    </Pressable>
  );
}
const buttonVariants: Record<ButtonVariant, { box: ViewStyle; text: { color: string } }> = {
  primary: { box: { backgroundColor: colors.brand, ...shadow }, text: { color: '#fff' } },
  ghost: {
    box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
    text: { color: colors.text2 },
  },
  danger: { box: { backgroundColor: colors.red }, text: { color: '#fff' } },
  dangerGhost: {
    box: { backgroundColor: colors.red50, borderWidth: 1, borderColor: '#f6cdc8' },
    text: { color: colors.red },
  },
  light: {
    box: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    text: { color: '#fff' },
  },
};

/* ---------- Form field with focus ring ---------- */
export function Field({
  label,
  hint,
  suffix,
  right,
  ...input
}: TextInputProps & { label: string; hint?: string; suffix?: string; right?: ReactNode }) {
  const [focused, setFocused] = useState(false);
  const reveal = useContext(RevealFocusedContext);
  return (
    <View style={ui.field}>
      <Text style={ui.fieldLabel}>{label}</Text>
      <View style={[ui.inputBox, focused && ui.inputFocused]}>
        <TextInput
          placeholderTextColor="#9aa7a2"
          {...input}
          onFocus={(event) => {
            setFocused(true);
            reveal?.();
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[ui.input, input.multiline && ui.inputMultiline, input.style]}
        />
        {suffix ? <Text style={ui.suffix}>{suffix}</Text> : null}
        {right}
      </View>
      {hint ? <Text style={ui.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ---------- Chips ---------- */
export function Chip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active: boolean;
  onPress(): void;
  tone?: string;
}) {
  const activeColor = tone ?? colors.hero;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        ui.chip,
        active && { backgroundColor: activeColor, borderColor: activeColor },
        pressed && ui.pressed,
      ]}
    >
      <Text style={[ui.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Status badge ---------- */
export function Badge({ status, onDark }: { status: string; onDark?: boolean }) {
  const tone = statusTone[status] ?? statusTone.CREATED!;
  return (
    <View style={[ui.badge, { backgroundColor: onDark ? 'rgba(255,255,255,0.14)' : tone.bg }]}>
      <View style={[ui.badgeDot, { backgroundColor: onDark ? '#7ee0b8' : tone.dot }]} />
      <Text style={[ui.badgeText, { color: onDark ? '#fff' : tone.fg }]}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

/* ---------- Truck plate ---------- */
export function Plate({ value }: { value: string }) {
  return (
    <View style={ui.plate}>
      <Text style={ui.plateText}>{value}</Text>
    </View>
  );
}

/* ---------- Origin → destination visual ---------- */
export function Route({ origin, destination }: { origin: string; destination: string }) {
  return (
    <View style={ui.route}>
      <View style={ui.routeRail}>
        <View style={[ui.routeDot, { borderColor: colors.brand }]} />
        <View style={ui.routeLine} />
        <View style={[ui.routeDot, ui.routeDotEnd]} />
      </View>
      <View style={ui.routeStops}>
        <View>
          <Text style={ui.routeLabel}>From</Text>
          <Text style={ui.routePlace} numberOfLines={1}>
            {origin}
          </Text>
        </View>
        <View>
          <Text style={ui.routeLabel}>To</Text>
          <Text style={ui.routePlace} numberOfLines={1}>
            {destination}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- Pulsing live dot ---------- */
export function PulseDot({ active, color = colors.brandBright }: { active: boolean; color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 2.2, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);
  const opacity = scale.interpolate({ inputRange: [1, 2.2], outputRange: [0.5, 0] });
  return (
    <View style={ui.pulseWrap}>
      {active ? (
        <Animated.View
          style={[ui.pulseRing, { backgroundColor: color, opacity, transform: [{ scale }] }]}
        />
      ) : null}
      <View style={[ui.pulseCore, { backgroundColor: active ? color : '#b8c4bf' }]} />
    </View>
  );
}

export function Stat({ label, value, style }: { label: string; value: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[ui.stat, style]}>
      <Text style={ui.statLabel}>{label}</Text>
      <Text style={ui.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ---------- Bottom-sheet confirmation (replaces the system Alert) ---------- */
export function ConfirmSheet({
  visible,
  icon,
  iconTone = 'brand',
  title,
  message,
  children,
  confirmLabel,
  confirmVariant = 'primary',
  cancelLabel = 'Cancel',
  loading,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  icon?: string;
  iconTone?: 'brand' | 'danger' | 'amber';
  title: string;
  message?: string;
  children?: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  /** Pass null to show a single-button sheet (e.g. a success message). */
  cancelLabel?: string | null;
  loading?: boolean;
  error?: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    Animated.spring(slide, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
    }).start();
  }, [visible, slide]);
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => !loading && onCancel()}
    >
      <View style={ui.sheetBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close"
          onPress={() => !loading && onCancel()}
        />
        <Animated.View style={[ui.sheet, { transform: [{ translateY }] }]}>
          <SafeAreaView edges={['bottom']}>
            <View style={ui.sheetHandle} />
            {icon ? (
              <View
                style={[
                  ui.sheetIcon,
                  iconTone === 'danger' && { backgroundColor: colors.red50 },
                  iconTone === 'amber' && { backgroundColor: colors.amber50 },
                ]}
              >
                <Text style={ui.sheetIconText}>{icon}</Text>
              </View>
            ) : null}
            <Text style={ui.sheetTitle}>{title}</Text>
            {message ? <Text style={ui.sheetMessage}>{message}</Text> : null}
            {children ? <View style={ui.sheetBody}>{children}</View> : null}
            {error ? (
              <View style={ui.sheetError}>
                <Text style={ui.sheetErrorText}>{error}</Text>
              </View>
            ) : null}
            <View style={ui.sheetActions}>
              <Button title={confirmLabel} variant={confirmVariant} onPress={onConfirm} loading={loading} />
              {cancelLabel ? (
                <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
              ) : null}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------- "From status → To status" visual for confirmations ---------- */
export function StatusChange({ from, to }: { from: string; to: string }) {
  return (
    <View style={ui.change}>
      <View style={ui.changeCol}>
        <Text style={ui.changeLabel}>Now</Text>
        <Badge status={from} />
      </View>
      <View style={ui.changeArrow}>
        <Text style={ui.changeArrowText}>→</Text>
      </View>
      <View style={[ui.changeCol, ui.changeColEnd]}>
        <Text style={ui.changeLabel}>Next</Text>
        <View style={ui.changeEndBadge}>
          <Badge status={to} />
        </View>
      </View>
    </View>
  );
}

export const ui = StyleSheet.create({
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,27,20,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 18,
  },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sheetIconText: { fontSize: 26 },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sheetMessage: { color: colors.text2, fontSize: 15, lineHeight: 22, marginTop: 6 },
  sheetBody: { marginTop: 18 },
  sheetError: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: '#f6cdc8',
  },
  sheetErrorText: { color: colors.red, fontSize: 14, lineHeight: 20 },
  sheetActions: { gap: 10, marginTop: 22 },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeCol: { flex: 1, gap: 6 },
  changeColEnd: { alignItems: 'flex-end' },
  changeEndBadge: { flexDirection: 'row', justifyContent: 'flex-end' },
  changeLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  changeArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  changeArrowText: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: -2 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  logo: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1fa876',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  header: {
    backgroundColor: colors.hero,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 10 },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: colors.heroMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerTitle: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  headerBody: { marginTop: 18 },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.hero2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnText: { color: '#fff', fontSize: 28, lineHeight: 30, marginTop: -3 },
  avatar: { backgroundColor: '#1c4a3a', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#bfe6d5', fontWeight: '800' },
  button: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  field: { gap: 7 },
  fieldLabel: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputFocused: { borderColor: colors.brand, borderWidth: 1.5 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: colors.text },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  suffix: { color: colors.muted, fontSize: 15, fontWeight: '600', marginLeft: 8 },
  hint: { color: colors.muted, fontSize: 12 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  plate: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#1f2d28',
    borderRadius: 6,
    backgroundColor: '#fffbea',
  },
  plateText: { color: '#1f2d28', fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  route: { flexDirection: 'row', gap: 12 },
  routeRail: { alignItems: 'center', paddingVertical: 6 },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    backgroundColor: '#fff',
  },
  routeDotEnd: { borderColor: colors.amber, backgroundColor: colors.amber },
  routeLine: {
    flex: 1,
    width: 2,
    marginVertical: 3,
    backgroundColor: colors.border,
    minHeight: 22,
  },
  routeStops: { flex: 1, justifyContent: 'space-between', gap: 10 },
  routeLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  routePlace: { color: colors.text, fontSize: 16, fontWeight: '700' },
  pulseWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  pulseCore: { width: 10, height: 10, borderRadius: 5 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
});
