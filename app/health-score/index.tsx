import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";

import { AnimatedScoreRing } from "../../src/components/AnimatedScoreRing";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import {
  HealthDimensionDetail,
  UserProfileData,
  getHealthDimensionDetails,
  getHealthImprovementFallback,
  getHealthScoreCategory,
  getHealthShareInsights,
  getOverallHealthScore,
} from "../../src/core/models/UserProfile";
import { GeminiService } from "../../src/core/services/GeminiService";
import { HealthScoreService, HealthScoreSnapshot } from "../../src/core/services/HealthScoreService";
import { VictoryLine, VictoryChart, VictoryAxis, VictoryTheme } from "victory-native";
import { useWindowDimensions } from "react-native";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

type ScoreBarProps = {
  item: HealthDimensionDetail;
  color: string;
  helper: string;
};

const DIMENSION_COLORS: Record<HealthDimensionDetail["key"], string> = {
  emergency: Colors.teal,
  insurance: Colors.gold,
  investment: Colors.purple,
  debt: Colors.red,
  tax: Colors.navy,
  retirement: "#2E5B9A",
};

const DIMENSION_HELPERS: Record<HealthDimensionDetail["key"], string> = {
  emergency: "6 months buffer target",
  insurance: "10x annual income target",
  investment: "20% of income investing pace",
  debt: "Lower EMI burden is healthier",
  tax: "Use 80C efficiently",
  retirement: "Corpus vs FIRE goal",
};

const CATEGORY_META = {
  Critical: {
    color: Colors.red,
    description: "Your plan needs immediate attention in a few core areas.",
  },
  "Needs Work": {
    color: Colors.gold,
    description: "A few smart adjustments can lift your score quickly.",
  },
  Good: {
    color: Colors.teal,
    description: "You have a solid base and can now optimize systematically.",
  },
  Excellent: {
    color: Colors.purple,
    description: "You are operating from a strong financial position.",
  },
} as const;

function ScoreBar({ item, color, helper }: ScoreBarProps) {
  return (
    <View style={styles.dimensionCard}>
      <View style={styles.dimensionRow}>
        <Text style={styles.dimensionLabel}>{item.label}</Text>
        <Text style={styles.dimensionValue}>{item.score.toFixed(0)}/100</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(4, item.score)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.dimensionHelper}>{helper}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        {/* Removed Day 3 */}
        <Text style={styles.title}>Money Health Score</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so the app has enough financial context to calculate your 6-dimension score.
        </Text>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Your score unlocks after profile setup</Text>
        <Text style={styles.emptyBody}>
          We need income, emergency fund, SIP, insurance, debt, tax-saving, and retirement targets to generate the
          score and AI actions.
        </Text>
        <Button label="Start Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

export default function HealthScoreScreen() {
  const profile = useAppStore((state) => state.currentProfile);
  const shareCardRef = useRef<any>(null);

  const [tips, setTips] = useState<string[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<HealthScoreSnapshot[]>([]);
const { width } = useWindowDimensions();
const chartWidth = Math.max(300, width - Spacing["3xl"] * 2);

// Save this month's score and load history on mount
useEffect(() => {
  if (!profile) return;
  void (async () => {
    const history = await HealthScoreService.saveScore(profile);
    setScoreHistory(history);
  })();
}, [profile]);

  const score = profile ? getOverallHealthScore(profile) : 0;
  const category = getHealthScoreCategory(score);
  const categoryMeta = CATEGORY_META[category];
  const dimensions = useMemo(() => (profile ? getHealthDimensionDetails(profile) : []), [profile]);
  const shareInsights = useMemo(() => (profile ? getHealthShareInsights(profile) : []), [profile]);
  const fallbackTips = useMemo(() => (profile ? getHealthImprovementFallback(profile) : []), [profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    let active = true;

    async function loadTips(currentProfile: UserProfileData) {
      try {
        setTipsLoading(true);
        setTipsError("");
        const aiTips = await GeminiService.getHealthImprovementTips(currentProfile);

        if (active) {
          setTips(aiTips);
        }
      } catch (error) {
        if (active) {
          setTips(fallbackTips);
          setTipsError(error instanceof Error ? error.message : "Showing offline actions for now.");
        }
      } finally {
        if (active) {
          setTipsLoading(false);
        }
      }
    }

    void loadTips(profile);

    return () => {
      active = false;
    };
  }, [fallbackTips, profile]);

  if (!profile) {
    return <EmptyState />;
  }

  const currentProfile = profile;

  async function handleRefreshTips() {
    try {
      setTipsLoading(true);
      setTipsError("");
      const aiTips = await GeminiService.getHealthImprovementTips(currentProfile);
      setTips(aiTips);
    } catch (error) {
      setTips(fallbackTips);
      setTipsError(error instanceof Error ? error.message : "Showing offline actions for now.");
    } finally {
      setTipsLoading(false);
    }
  }

  async function handleShare() {
    try {
      setSharing(true);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      const uri = await shareCardRef.current?.capture?.();

      if (!uri) {
        throw new Error("Unable to generate the share card.");
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: "Share your ET FinMentor health score",
      });
    } catch (error) {
      Alert.alert("Unable to share score", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen scroll>
      <Animatable.View animation="fadeInUp" duration={500} style={styles.hero}>
        {/* Removed Day 3 */}
        <Text style={styles.title}>Money Health Score</Text>
        <Text style={styles.subtitle}>
          Your overall score blends emergency readiness, protection, investing, debt, tax efficiency, and retirement
          progress into one simple snapshot.
        </Text>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={100} duration={500} style={styles.ringCard}>
        <AnimatedScoreRing color={categoryMeta.color} score={score}>
          <Text style={styles.ringValue}>{score.toFixed(0)}</Text>
          <Text style={[styles.categoryChip, { backgroundColor: categoryMeta.color }]}>{category}</Text>
          <Text style={styles.ringLabel}>Overall health</Text>
        </AnimatedScoreRing>

        <Text style={styles.categoryDescription}>{categoryMeta.description}</Text>
      </Animatable.View>
      {scoreHistory.length >= 2 ? (
  <Animatable.View animation="fadeInUp" delay={140} duration={500} style={styles.section}>
    <Text style={styles.sectionTitle}>Score history</Text>
    <View style={styles.chartCard}>
      <VictoryChart
        height={120}
        padding={{ top: 16, bottom: 32, left: 48, right: 16 }}
        theme={VictoryTheme.material}
        width={chartWidth}
      >
        <VictoryAxis
          style={{
            axis: { stroke: Colors.border },
            grid: { stroke: "transparent" },
            tickLabels: {
              fill: Colors.textSecondary,
              fontFamily: Typography.fontFamily.body,
              fontSize: 10,
            },
          }}
          tickFormat={(t: string) => t.slice(5)} // "MM" only
        />
        <VictoryAxis
          dependentAxis
          domain={[0, 100]}
          style={{
            axis: { stroke: "transparent" },
            grid: { stroke: "#E8EDF4" },
            tickLabels: {
              fill: Colors.textSecondary,
              fontFamily: Typography.fontFamily.body,
              fontSize: 10,
            },
          }}
        />
        <VictoryLine
          data={scoreHistory.map((s) => ({ x: s.monthKey, y: s.score }))}
          interpolation="monotoneX"
          style={{ data: { stroke: Colors.gold, strokeWidth: 2.5 } }}
        />
      </VictoryChart>
    </View>
  </Animatable.View>
) : null}
      <Animatable.View animation="fadeInUp" delay={180} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>6 score dimensions</Text>
        <View style={styles.dimensionsWrap}>
          {dimensions.map((item) => (
            <ScoreBar
              key={item.key}
              color={DIMENSION_COLORS[item.key]}
              helper={DIMENSION_HELPERS[item.key]}
              item={item}
            />
          ))}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={240} duration={500} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI improvement tips</Text>
          <Button
            label={tipsLoading ? "Refreshing..." : "Refresh"}
            loading={tipsLoading}
            onPress={() => void handleRefreshTips()}
            variant="secondary"
          />
        </View>

        {tipsError ? <Text style={styles.warningText}>{tipsError}</Text> : null}

        <View style={styles.tipsWrap}>
          {(tips.length ? tips : fallbackTips).slice(0, 3).map((tip, index) => (
            <View key={`${index}-${tip}`} style={styles.tipCard}>
              <Text style={styles.tipIndex}>0{index + 1}</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={320} duration={500} style={styles.section}>
        <View style={styles.shareCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.shareTitle}>Share your score</Text>
            <Button label="Share Card" loading={sharing} onPress={() => void handleShare()} />
          </View>
          <Text style={styles.shareBody}>
            The shared card includes your score, category, and 3 non-currency insights only. No rupee amounts are
            included.
          </Text>
          <View style={styles.shareInsightList}>
            {shareInsights.map((insight) => (
              <Text key={insight} style={styles.shareInsightText}>
                {insight}
              </Text>
            ))}
          </View>
        </View>
      </Animatable.View>

      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.captureCard}>
            <Text style={styles.captureBrand}>ET FinMentor</Text>
            <Text style={styles.captureScore}>{score.toFixed(0)}/100</Text>
            <Text style={[styles.captureCategory, { color: categoryMeta.color }]}>{category}</Text>
            <View style={styles.captureDivider} />
            {shareInsights.map((insight) => (
              <Text key={insight} style={styles.captureInsight}>
                {insight}
              </Text>
            ))}
          </View>
        </ViewShot>
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
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
  },
  subtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  ringCard: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  ringValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: 56,
  },
  ringLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  categoryChip: {
    borderRadius: Radius.full,
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    overflow: "hidden",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  categoryDescription: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
    textAlign: "center",
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  dimensionsWrap: {
    gap: Spacing.md,
  },
  dimensionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  dimensionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dimensionLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  dimensionValue: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  dimensionHelper: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  barTrack: {
    backgroundColor: "#E8EDF4",
    borderRadius: Radius.full,
    height: 10,
    overflow: "hidden",
  },
  barFill: {
    borderRadius: Radius.full,
    height: "100%",
  },
  tipsWrap: {
    gap: Spacing.md,
  },
  tipCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  tipIndex: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
  },
  tipText: {
    color: Colors.textPrimary,
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  shareCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(12,35,64,0.15)",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  shareBody: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  shareInsightList: {
    gap: Spacing.sm,
  },
  shareTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  shareInsightText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  captureContainer: {
    left: -9999,
    position: "absolute",
    top: 0,
  },
  captureCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 28,
    width: 340,
  },
  captureBrand: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.lg,
  },
  captureScore: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: 56,
  },
  captureCategory: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.lg,
  },
  captureDivider: {
    backgroundColor: Colors.border,
    height: 1,
    marginBottom: Spacing.lg,
  },
  captureInsight: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  emptyBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  chartCard: {
  backgroundColor: Colors.card,
  borderRadius: Radius.lg,
  borderWidth: 0.5,
  borderColor: Colors.border,
  overflow: "hidden",
  paddingVertical: Spacing.sm,
},
});
