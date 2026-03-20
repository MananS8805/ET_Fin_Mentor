import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { Colors, Radius, Spacing, Typography } from "../core/theme";

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
  const backgroundColor = Colors.card;
  const borderColor = error ? Colors.red : Colors.border;
  const textColor = Colors.textPrimary;
  const hintColor = Colors.textSecondary;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: Colors.textPrimary }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor, borderColor, borderWidth: error ? 1.5 : 1 }]}>
        {prefix ? <Text style={[styles.prefix, { color: hintColor }]}>{prefix}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, { color: textColor }, style]}
          {...props}
        />
      </View>
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
  errorHint: {
    color: Colors.red,
    fontWeight: "600",
  },
});

