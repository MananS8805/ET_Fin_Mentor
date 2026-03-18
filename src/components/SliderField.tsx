import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";

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
}: SliderFieldProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valueLabel}</Text>
      </View>
      <Slider
        maximumTrackTintColor="#D8DEEA"
        maximumValue={max}
        minimumTrackTintColor={Colors.gold}
        minimumValue={min}
        onValueChange={onValueChange}
        step={step}
        thumbTintColor={Colors.navy}
        value={value}
      />
      <View style={styles.footer}>
        <Text style={styles.helper}>{helper}</Text>
        <Text style={styles.range}>{rangeLabel ?? `${min} - ${max}`}</Text>
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
  value: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
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
  range: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
});
