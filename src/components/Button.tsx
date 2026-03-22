import { ReactNode, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { Colors, Radius, Spacing, Typography, Shadows } from "../core/theme";

type ButtonProps = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "ghost" | "success" | "error";
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  const isSuccess = variant === "success";
  const isError = variant === "error";

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!disabled && !loading) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onPress(event);
  };

  let textColor: string = Colors.textPrimary;
  if (isPrimary) textColor = Colors.bg;
  if (isGhost) textColor = Colors.gold;
  if (isSuccess) textColor = Colors.bg;
  if (isError) textColor = Colors.white;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        disabled={disabled || loading}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.base,
          isPrimary && styles.primary,
          variant === "secondary" && styles.secondary,
          isGhost && styles.ghost,
          isSuccess && styles.success,
          isError && styles.error,
          pressed && !disabled && !loading ? styles.pressed : null,
          (disabled || loading) && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : icon ? (
          icon
        ) : null}
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  primary: {
    backgroundColor: Colors.gold,
    ...Shadows.md,
  },
  secondary: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.b2,
    ...Shadows.sm,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.goldDim,
  },
  success: {
    backgroundColor: Colors.teal,
    ...Shadows.md,
  },
  error: {
    backgroundColor: Colors.red,
    ...Shadows.md,
  },
  pressed: {
    opacity: 0.92,
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    fontWeight: "600",
  },
});
