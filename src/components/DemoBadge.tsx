import { StyleSheet, Text, View } from "react-native";

import { Colors, Radius, Spacing, Typography } from "../core/theme";

export function DemoBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.label}>DEMO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  label: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    letterSpacing: 0.8,
  },
});

