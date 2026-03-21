import { useState, useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

export function SmartRecommendationPanel({
  metrics,
  fundNames,
  overlapAnalysis,
}: SmartRecommendationPanelProps) {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const summary = useMemo(() => ({
    totalValue: metrics.reduce((sum, m) => sum + m.currentValue, 0),
    totalInvested: metrics.reduce((sum, m) => sum + m.totalInvested, 0),
    averageXIRR: metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.xirr, 0) / metrics.length
      : 0,
    totalExpenseDrag: metrics.reduce((sum, m) => sum + m.expenseDragAnnual, 0),
  }), [metrics]);

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const formatINR = (v: number) => formatter.format(v);

  const fetchRecommendations = useCallback(async () => {
    if (metrics.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      // Build a compact prompt payload — no PII, pure numbers
      const payload = {
        funds: fundNames.map((name, i) => ({
          name,
          xirr: metrics[i]?.xirr?.toFixed(1) ?? "0",
          expenseDrag: metrics[i]?.expenseDragAnnual?.toFixed(0) ?? "0",
          absoluteReturn: metrics[i]?.absoluteReturn?.toFixed(1) ?? "0",
        })),
        portfolio: {
          totalValue: summary.totalValue.toFixed(0),
          averageXIRR: summary.averageXIRR.toFixed(1),
          totalExpenseDrag: summary.totalExpenseDrag.toFixed(0),
          overlapPct: overlapAnalysis?.overlapPercentage?.toFixed(1) ?? "0",
          commonSchemes: overlapAnalysis?.commonSchemes ?? [],
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: [
                      "You are a mutual fund advisor for Indian investors.",
                      "Based on this portfolio data, give exactly 4 short actionable recommendations.",
                      "Each recommendation must be one sentence, specific, and mention fund names or numbers where relevant.",
                      "Return ONLY a JSON array of 4 strings. No markdown, no explanation, no preamble.",
                      "Example format: [\"Sell X and move to Y index fund\", \"Your XIRR of Z% lags the benchmark\"]",
                      "",
                      `Portfolio data: ${JSON.stringify(payload)}`,
                    ].join("\n"),
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.5, maxOutputTokens: 400 },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini request failed: ${response.status}`);
      }

      const data = await response.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned) as string[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Unexpected response format from Gemini.");
      }

      setRecommendations(parsed.slice(0, 4));
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch recommendations.");
      // Fallback: build basic recommendations from the numbers we have
      const fallback: string[] = [];
      if (summary.totalExpenseDrag > 5000) {
        fallback.push(`Switching to direct plans or index funds could recover ${formatINR(summary.totalExpenseDrag)} lost annually to expense ratios.`);
      }
      if (summary.averageXIRR < 10) {
        fallback.push(`Your average XIRR of ${summary.averageXIRR.toFixed(1)}% is below the Nifty 50 benchmark — review underperforming funds.`);
      }
      if (overlapAnalysis && overlapAnalysis.overlapPercentage > 30) {
        fallback.push(`${overlapAnalysis.overlapPercentage.toFixed(0)}% portfolio overlap detected — consolidate overlapping funds to reduce redundancy.`);
      }
      fallback.push("Review and rebalance your portfolio annually to stay aligned with your risk profile.");
      setRecommendations(fallback);
      setFetched(true);
    } finally {
      setIsLoading(false);
    }
  }, [metrics, fundNames, overlapAnalysis, summary]);

  useEffect(() => {
    if (metrics.length > 0 && !fetched) {
      void fetchRecommendations();
    }
  }, [metrics.length, fetched, fetchRecommendations]);

  if (metrics.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Smart recommendations</Text>
        {fetched && !isLoading && (
          <TouchableOpacity onPress={() => { setFetched(false); setRecommendations([]); }}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Summary strip */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Portfolio value</Text>
          <Text style={styles.summaryValue}>{formatINR(summary.totalValue)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Avg XIRR</Text>
          <Text style={[styles.summaryValue, { color: Colors.teal }]}>
            {summary.averageXIRR.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Annual expense drag</Text>
          <Text style={[styles.summaryValue, { color: Colors.red }]}>
            {formatINR(summary.totalExpenseDrag)}
          </Text>
        </View>
        {overlapAnalysis && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Portfolio overlap</Text>
            <Text style={[styles.summaryValue, { color: Colors.gold }]}>
              {overlapAnalysis.overlapPercentage.toFixed(0)}%
            </Text>
          </View>
        )}
      </View>

      {/* Recommendations */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={Colors.purple} />
          <Text style={styles.loadingText}>Analyzing your portfolio...</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>Showing offline recommendations</Text>
      ) : null}

      {recommendations.length > 0 && (
        <View style={styles.recsContainer}>
          <Text style={styles.recsTitle}>AI insights</Text>
          {recommendations.map((rec, index) => (
            <View key={index} style={styles.recItem}>
              <View style={styles.recNumber}>
                <Text style={styles.recNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.disclaimer}>
        These recommendations are based on your portfolio metrics. Consult a financial advisor before making investment decisions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.size.xl,
    fontFamily: Typography.fontFamily.display,
    color: Colors.textPrimary,
  },
  refreshText: {
    fontSize: Typography.size.sm,
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  summaryCard: {
    backgroundColor: Colors.card,
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
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  summaryValue: {
    fontSize: Typography.size.md,
    fontFamily: Typography.fontFamily.display,
    color: Colors.textPrimary,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: Typography.size.sm,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
  },
  errorText: {
    fontSize: Typography.size.sm,
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.sm,
  },
  recsContainer: {
    marginBottom: Spacing.lg,
  },
  recsTitle: {
    fontSize: Typography.size.lg,
    fontFamily: Typography.fontFamily.display,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  recItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  recNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.purple,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  recNumberText: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  recText: {
    flex: 1,
    fontSize: Typography.size.md,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    lineHeight: 22,
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.body,
    lineHeight: 16,
    marginTop: Spacing.md,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
  },
});