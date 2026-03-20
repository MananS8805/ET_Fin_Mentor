import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { PortfolioMetrics } from "../../../src/core/services/MutualFundService";
import { Colors, Spacing, Typography } from "../../../src/core/theme";

interface AtAGlanceHeaderProps {
  metrics: PortfolioMetrics | null;
  previousValue?: number;
}

/**
 * At a Glance Header Component
 * Displays total portfolio value with day's change and XIRR gauge
 */
export function AtAGlanceHeader({ metrics, previousValue }: AtAGlanceHeaderProps) {
  const [changeAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (metrics) {
      Animated.timing(changeAnimation, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }).start();
    }
  }, [metrics, changeAnimation]);

  if (!metrics) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading portfolio data...</Text>
      </View>
    );
  }

  const dayChange = previousValue ? metrics.currentValue - previousValue : null;
  const dayChangePercent = previousValue ? (dayChange! / previousValue) * 100 : null;
  const isPositiveChange = dayChange ? dayChange > 0 : null;
  const changeColor = isPositiveChange ? Colors.teal : isPositiveChange === false ? Colors.red : Colors.textSecondary;

  // Format currency with Indian locale
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatValue = (value: number) => formatter.format(value);

  // XIRR gauge color
  const xirrColor =
    metrics.xirr >= 12
      ? Colors.teal
      : metrics.xirr >= 8
        ? Colors.gold
        : metrics.xirr >= 0
          ? Colors.purple
          : Colors.red;

  return (
    <View style={styles.container}>
      {/* Total Portfolio Value - Large Bold Display */}
      <View style={styles.heroSection}>
        <Text style={styles.labelSmall}>Total Portfolio Value</Text>
        <Text style={styles.valueHuge}>{formatValue(metrics.currentValue)}</Text>

        {/* Day's Change Section */}
        {dayChange !== null && dayChangePercent !== null && (
          <View style={styles.changeSection}>
            <Text style={[styles.changeText, { color: changeColor }]}>
              {isPositiveChange ? "+" : ""}
              {formatValue(dayChange)} ({dayChangePercent.toFixed(2)}%)
            </Text>
          </View>
        )}
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {/* XIRR Gauge */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>XIRR</Text>
          <View style={styles.gaugeContainer}>
            <Text style={[styles.gaugeValue, { color: xirrColor }]}>{metrics.xirr.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Total Return */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Return</Text>
          <Text style={[styles.metricValue, { color: metrics.totalReturn >= 0 ? Colors.teal : Colors.red }]}>
            {formatValue(metrics.totalReturn)}
          </Text>
          <Text style={styles.metricSubtext}>
            {metrics.absoluteReturn.toFixed(1)}% absolute
          </Text>
        </View>

        {/* Time Invested */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Invested Capital</Text>
          <Text style={styles.metricValue}>{formatValue(metrics.totalInvested)}</Text>
        </View>

        {/* Expense Drag */}
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Annual Drag</Text>
          <Text style={[styles.metricValue, { color: Colors.red }]}>
            {formatValue(metrics.expenseDragAnnual)}
          </Text>
          <Text style={styles.metricSubtext}>Expense impact/year</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },

  heroSection: {
    marginBottom: Spacing.xl,
  },

  labelSmall: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: "500",
  },

  valueHuge: {
    fontSize: 44,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  changeSection: {
    paddingVertical: Spacing.sm,
  },

  changeText: {
    fontSize: Typography.size.md,
    fontWeight: "600",
  },

  metricsGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },

  metricCard: {
    flex: 1,
    minWidth: "48%",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  metricLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontWeight: "600",
    textTransform: "uppercase",
  },

  metricValue: {
    fontSize: Typography.size.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  metricSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  gaugeContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },

  gaugeValue: {
    fontSize: 28,
    fontWeight: "700",
  },

  loadingText: {
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
});
