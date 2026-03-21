import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Colors, Spacing, Typography } from "../core/theme";

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  prefix?: string;
  dark?: boolean;
  error?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, prefix, dark = false, error, style, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const borderProgress = useSharedValue(0);

  useEffect(() => {
    borderProgress.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [borderProgress, focused]);

  const inputRowAnimatedStyle = useAnimatedStyle(() => ({
    borderColor:
      error
        ? Colors.red
        : borderProgress.value > 0.5
          ? Colors.gold
          : dark
            ? "rgba(255,255,255,0.12)"
            : Colors.border,
  }));

  const backgroundColor = dark ? "#0D0D0D" : Colors.card;
  const textColor = dark ? Colors.white : Colors.textPrimary;
  const hintColor = dark ? "rgba(255,255,255,0.5)" : Colors.textSecondary;

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.label,
          dark ? styles.darkLabel : null,
          { color: dark ? "rgba(255,255,255,0.5)" : Colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          styles.inputRow,
          dark ? styles.darkInputRow : null,
          inputRowAnimatedStyle,
          { backgroundColor, borderWidth: error ? 1 : 0.5 },
        ]}
      >
        {prefix ? <Text style={[styles.prefix, { color: hintColor }]}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          onBlur={() => setFocused(false)}
          onFocus={() => setFocused(true)}
          placeholderTextColor={dark ? "rgba(255,255,255,0.2)" : Colors.textMuted}
          style={[styles.input, { color: textColor }, style]}
          {...props}
        />
      </Animated.View>
      {error ? <Text style={[styles.hint, styles.errorHint]}>{error}</Text> : null}
      {hint ? <Text style={[styles.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
  },
  label: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  darkLabel: {
    fontSize: 13,
  },
  inputRow: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 0.5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  darkInputRow: {
    borderColor: "#2A2A2A",
    minHeight: 52,
  },
  prefix: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  input: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    paddingVertical: Spacing.md,
  },
  hint: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
  },
  errorHint: {
    color: Colors.red,
    fontWeight: "600",
  },
});

