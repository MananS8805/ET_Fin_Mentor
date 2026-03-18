import { StyleSheet, Text, View } from "react-native";

import { Screen } from "./Screen";
import { Button } from "./Button";
import { Colors, Radius, Spacing, Typography } from "../core/theme";

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  onPrimaryPress?: () => void;
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  primaryLabel,
  onPrimaryPress,
}: PlaceholderScreenProps) {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This screen is scaffolded for the next build day.</Text>
        <Text style={styles.cardBody}>
          Routing, styling, and navigation are already wired so we can slot the feature logic in next
          without reworking the shell.
        </Text>
        {primaryLabel && onPrimaryPress ? <Button label={primaryLabel} onPress={onPrimaryPress} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  eyebrow: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
  },
  description: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  cardBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
});

