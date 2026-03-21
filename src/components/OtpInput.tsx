import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";

import { Colors, Spacing, Typography } from "../core/theme";

type OtpInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
  dark?: boolean;
};

function OtpDigit({
  digit,
  dark,
  inputRef,
  onChangeText,
  onKeyPress,
}: {
  digit: string;
  dark: boolean;
  inputRef: (node: TextInput | null) => void;
  onChangeText: (text: string) => void;
  onKeyPress: (event: { nativeEvent: { key: string } }) => void;
}) {
  const scale = useSharedValue(1);
  const filled = digit.length > 0;

  useEffect(() => {
    if (!filled) {
      return;
    }

    scale.value = withSequence(
      withSpring(1.08, { damping: 11, stiffness: 180 }),
      withSpring(1, { damping: 11, stiffness: 180 })
    );
  }, [filled, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.boxWrap, animatedStyle]}>
      <TextInput
        ref={inputRef}
        keyboardType="number-pad"
        maxLength={1}
        onChangeText={onChangeText}
        onKeyPress={onKeyPress}
        placeholder="0"
        placeholderTextColor={dark ? "rgba(255,255,255,0.3)" : Colors.textMuted}
        style={[
          styles.input,
          {
            color: dark ? Colors.white : Colors.textPrimary,
            backgroundColor: filled ? "rgba(212,175,55,0.12)" : dark ? "rgba(255,255,255,0.06)" : Colors.white,
            borderColor: filled ? Colors.gold : dark ? "rgba(255,255,255,0.12)" : Colors.border,
          },
        ]}
        textAlign="center"
        value={digit}
      />
    </Animated.View>
  );
}

export function OtpInput({ value, onChange, dark = false }: OtpInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = useMemo(() => {
    const padded = value.slice(0, 6).split("");
    return Array.from({ length: 6 }).map((_, index) => padded[index] ?? "");
  }, [value]);

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <OtpDigit
          key={index}
          dark={dark}
          digit={digit}
          inputRef={(node) => {
            refs.current[index] = node;
          }}
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
  boxWrap: {
    flex: 1,
  },
  input: {
    height: 56,
    width: 52,
    borderRadius: 14,
    borderWidth: 0.5,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
    alignSelf: "center",
  },
});

