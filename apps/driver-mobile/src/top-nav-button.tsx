import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from './theme';

type TopNavButtonProps = {
  icon: string;
  label: string;
  onPress: () => void;
};

export function TopNavButton({ icon, label, onPress }: TopNavButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text accessible={false} style={styles.icon}>
        {icon}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 54,
    height: 54,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 27,
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  icon: {
    color: colors.green,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
});
