import { StyleSheet, View } from "react-native";

import { Colors, Radius, Spacing } from "../core/theme";

type ProgressSegmentsProps = {
  total: number;
  current: number;
  variant?: "dark" | "light";
};

export function ProgressSegments({ total, current, variant = "dark" }: ProgressSegmentsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => {
        const segmentIndex = index + 1;
        const backgroundColor =
          segmentIndex < current
            ? Colors.teal
            : segmentIndex === current
              ? Colors.gold
              : variant === "dark"
                ? "rgba(255,255,255,0.18)"
                : "#D9DEE7";

        return <View key={segmentIndex} style={[styles.segment, { backgroundColor }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: Radius.full,
  },
});
