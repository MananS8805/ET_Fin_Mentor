import { useMemo, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { Colors, Radius, Spacing, Typography } from "../core/theme";

type OtpInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
  dark?: boolean;
};

export function OtpInput({ value, onChange, dark = false }: OtpInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = useMemo(() => {
    const padded = value.slice(0, 6).split("");
    return Array.from({ length: 6 }).map((_, index) => padded[index] ?? "");
  }, [value]);

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          keyboardType="number-pad"
          maxLength={1}
          onChangeText={(text) => {
            const safeText = text.replace(/\D/g, "").slice(-1);
            const nextDigits = [...digits];
            nextDigits[index] = safeText;
            onChange(nextDigits.join(""));

            if (safeText && index < 5) {
              refs.current[index + 1]?.focus();
            }
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          placeholder="0"
          placeholderTextColor={dark ? "rgba(255,255,255,0.28)" : Colors.textMuted}
          style={[
            styles.input,
            {
              color: dark ? Colors.white : Colors.textPrimary,
              backgroundColor: dark ? "rgba(255,255,255,0.08)" : Colors.white,
              borderColor: dark ? "rgba(255,255,255,0.12)" : Colors.border,
            },
          ]}
          textAlign="center"
          value={digit}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  input: {
    flex: 1,
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
  },
});

