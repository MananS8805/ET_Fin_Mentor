import { useRef } from "react";
import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { Colors, Radius, Spacing, Typography } from "../core/theme";

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  helper: string;
  valueLabel: string;
  rangeLabel?: string;
  onValueChange: (value: number) => void;
  variant?: "default" | "fire-dark";
};

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  helper,
  valueLabel,
  rangeLabel,
  onValueChange,
  variant = "default",
}: SliderFieldProps) {
  const lastHapticAt = useRef(0);

  const handleValueChange = (next: number) => {
    onValueChange(next);

    const now = Date.now();
    if (now - lastHapticAt.current < 45) {
      return;
    }

    lastHapticAt.current = now;
    void Haptics.selectionAsync().catch(() => {
      // Ignore devices that do not support haptics.
    });
  };

  const isFireDark = variant === "fire-dark";

  return (
    <View style={[styles.card, isFireDark ? styles.fireCard : null]}>
      <View style={styles.header}>
        <Text style={[styles.label, isFireDark ? styles.fireLabel : null]}>{label}</Text>
        <Text style={[styles.value, isFireDark ? styles.fireValue : null]}>{valueLabel}</Text>
      </View>
      <Slider
        maximumTrackTintColor={isFireDark ? "rgba(255,255,255,0.08)" : "#D8DEEA"}
        maximumValue={max}
        minimumTrackTintColor={isFireDark ? "#D4AF37" : Colors.gold}
        minimumValue={min}
        onSlidingComplete={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
            // Ignore devices that do not support haptics.
          });
        }}
        onValueChange={handleValueChange}
        step={step}
        thumbTintColor={isFireDark ? "#D4AF37" : Colors.navy}
        style={isFireDark ? styles.fireSlider : undefined}
        value={value}
      />
      <View style={styles.footer}>
        <Text style={[styles.helper, isFireDark ? styles.fireHelper : null]}>{helper}</Text>
        <Text style={[styles.range, isFireDark ? styles.fireRange : null]}>{rangeLabel ?? `${min} - ${max}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  fireCard: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
    borderRadius: 20,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  fireLabel: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  value: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  fireValue: {
    color: "#D4AF37",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 22,
    textAlign: "right",
  },
  fireSlider: {
    height: 22,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  helper: {
    color: Colors.textSecondary,
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  fireHelper: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    lineHeight: 18,
  },
  range: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  fireRange: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
  },
});
