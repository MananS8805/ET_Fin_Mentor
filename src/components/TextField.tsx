import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { Colors, Radius, Spacing, Typography } from "../core/theme";

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  prefix?: string;
  dark?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, prefix, dark = false, style, ...props },
  ref
) {
  const backgroundColor = dark ? "rgba(255,255,255,0.08)" : Colors.white;
  const borderColor = dark ? "rgba(255,255,255,0.12)" : Colors.border;
  const textColor = dark ? Colors.white : Colors.textPrimary;
  const hintColor = dark ? "rgba(255,255,255,0.68)" : Colors.textSecondary;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: dark ? Colors.white : Colors.textPrimary }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor, borderColor }]}>
        {prefix ? <Text style={[styles.prefix, { color: hintColor }]}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={dark ? "rgba(255,255,255,0.45)" : Colors.textMuted}
          style={[styles.input, { color: textColor }, style]}
          {...props}
        />
      </View>
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
  inputRow: {
    minHeight: 52,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
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
});

