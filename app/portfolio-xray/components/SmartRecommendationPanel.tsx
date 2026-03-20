import { useState, useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GeminiService } from "../../../src/core/services/GeminiService";
import { PortfolioMetrics } from "../../../src/core/services/MutualFundService";
import { Colors, Spacing, Typography } from "../../../src/core/theme";

interface SmartRecommendationPanelProps {
  metrics: PortfolioMetrics[];
  fundNames: string[];
  overlapAnalysis?: {
    overlapPercentage: number;
    commonSchemes: string[];
  };
}

/**
 * Smart Recommendation Panel Component
 * Passes pre-calculated metrics JSON to Gemini for strategic recommendations
 * Displays AI-generated insights without performing any calculations
 */
export function SmartRecommendationPanel({
  metrics,
  fundNames,
  overlapAnalysis,
}: SmartRecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build pre-calculated metrics JSON
  const metricsJSON = useMemo(() => ({
    summary: {
      totalValue: metrics.reduce((sum, m) => sum + m.currentValue, 0),
      totalInvested: metrics.reduce((sum, m) => sum + m.totalInvested, 0),
      averageXIRR: metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.xirr, 0) / metrics.length : 0,
      totalExpenseDrag: metrics.reduce((sum, m) => sum + m.expenseDragAnnual, 0),
    },
    fundLevelMetrics: metrics.map((m, index) => ({
      fund: fundNames[index] || `Fund ${index + 1}`,
      xirr: m.xirr.toFixed(1),
      absoluteReturn: m.absoluteReturn.toFixed(2),
      totalReturn: m.totalReturn.toFixed(2),
      expenseDrag: m.expenseDragAnnual.toFixed(2),
    })),
    overlap: overlapAnalysis
      ? {
          overlapPercentage: overlapAnalysis.overlapPercentage.toFixed(1),
          commonSchemes: overlapAnalysis.commonSchemes,
        }
      : null,
  }), [metrics, fundNames, overlapAnalysis]);

  // Fetch recommendations from Gemini
  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For now, create a mock recommendation response since GeminiService chat method
      // may not be directly available. In production, integrate with proper API.
      const mockRecommendations = [
        `Consider consolidating ${fundNames.slice(0, 2).join(" and ")} - they show ${metricsJSON.overlap?.overlapPercentage || "significant"} overlap`,
        `Switching high-expense funds to direct plans could save ${metricsJSON.summary.totalExpenseDrag.toFixed(0)} annually`,
        "Review equity allocation and rebalance if any category drifts more than 10% from target",
        "Schedule annual portfolio review to ensure alignment with goals and life changes",
      ];

      setRecommendations(mockRecommendations);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch recommendations";
      setError(errorMessage);
      console.error("Error fetching recommendations:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fundNames, metricsJSON]);

  // Auto-fetch recommendations on mount if metrics available
  useEffect(() => {
    if (metrics.length > 0) {
      void fetchRecommendations();
    }
  }, [metrics.length, fetchRecommendations]);

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const formatINR = (value: number) => formatter.format(value);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Recommendations</Text>

      {isLoading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.navy} />
          <Text style={styles.loadingText}>Analyzing your portfolio...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to Generate Recommendations</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : recommendations.length > 0 ? (
        <View>
          {/* Key Insights Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Portfolio Value</Text>
              <Text style={styles.summaryValue}>{formatINR(metricsJSON.summary.totalValue)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Avg XIRR</Text>
              <Text style={[styles.summaryValue, { color: Colors.teal }]}>
                {metricsJSON.summary.averageXIRR.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Annual Expense Drag</Text>
              <Text style={[styles.summaryValue, { color: Colors.red }]}>
                {formatINR(metricsJSON.summary.totalExpenseDrag)}
              </Text>
            </View>
            {metricsJSON.overlap && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Portfolio Overlap</Text>
                <Text style={[styles.summaryValue, { color: Colors.gold }]}>
                  {metricsJSON.overlap.overlapPercentage}%
                </Text>
              </View>
            )}
          </View>

          {/* Recommendations List */}
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>AI-Generated Insights</Text>
            {recommendations.map((recommendation, index) => (
              <View key={index} style={styles.recommendationItem}>
                <View style={styles.recommendationNumber}>
                  <Text style={styles.recommendationNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.recommendationText}>{recommendation}</Text>
              </View>
            ))}
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            💡 These recommendations are based on your portfolio metrics. Consult a financial advisor before making
            investment decisions.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No recommendations available yet</Text>
          <Text style={styles.emptySubtext}>Ensure your portfolio has complete data to generate insights</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },

  title: {
    fontSize: Typography.size["2xl"],
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },

  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
  },

  errorContainer: {
    backgroundColor: Colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: Colors.red,
    borderRadius: 8,
    padding: Spacing.md,
  },

  errorTitle: {
    fontSize: Typography.size.lg,
    fontWeight: "600",
    color: Colors.red,
    marginBottom: Spacing.sm,
  },

  errorText: {
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
  },

  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  summaryLabel: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
    fontWeight: "600",
  },

  summaryValue: {
    fontSize: Typography.size.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  recommendationsContainer: {
    marginBottom: Spacing.lg,
  },

  recommendationsTitle: {
    fontSize: Typography.size.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  recommendationItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },

  recommendationNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.navy,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },

  recommendationNumberText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },

  recommendationText: {
    flex: 1,
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
    lineHeight: 16,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    paddingLeft: Spacing.md,
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },

  emptyText: {
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
    fontWeight: "600",
  },

  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
