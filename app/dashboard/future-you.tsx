import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import ConfettiCannon from "react-native-confetti-cannon";
import { VictoryChart, VictoryTheme } from "victory-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { LiquidProgressBar } from "../../src/components/LiquidProgressBar";
import { VictoryAxisWrapper, VictoryBarWrapper, VictoryLineWrapper } from "../../src/components/VictoryWrappers";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { SliderField } from "../../src/components/SliderField";
import { AuthService } from "../../src/core/services/AuthService";
import {
  FutureMilestone,
  formatINR,
  getFireCorpusTarget,
  getFutureMilestones,
  getFutureProjectionPoints,
  getFutureYouFallbackNarrative,
  getMonthlyPassiveIncome,
  projectedCorpusForScenario,
} from "../../src/core/models/UserProfile";
import { GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

const MILESTONE_COLORS: Record<FutureMilestone["key"], string> = {
  emergency: "#1D9E75",
  halfFire: "#D4AF37",
  fullFire: "#7F77DD",
};

function AnimatedProjectionValue({ value }: { value: number }) {
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.value = 0;
    animatedValue.value = withTiming(value, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [animatedValue, value]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (next, prev) => {
      if (next !== prev) {
        runOnJS(setDisplayValue)(next);
      }
    },
    [animatedValue]
  );

  return <Text style={styles.projectionValue}>{formatINR(displayValue, true)}</Text>;
}

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>Future You Mirror</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so the app can project your future corpus using your real SIP, corpus, retirement
          goal, and risk context.
        </Text>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Your future projection unlocks after profile setup</Text>
        <Text style={styles.emptyBody}>
          We need your age, corpus, monthly SIP, expenses, and retirement target to build the projection curve and
          FIRE status.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

function MilestoneCard({ milestone }: { milestone: FutureMilestone }) {
  const color = MILESTONE_COLORS[milestone.key];
  const progressValue = useSharedValue(0);
  const targetProgress = Math.max(milestone.progress * 100, milestone.complete ? 100 : 6);

  useEffect(() => {
    progressValue.value = 0;
    progressValue.value = withTiming(targetProgress, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [progressValue, targetProgress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value}%`,
  }));

  return (
    <View style={[styles.milestoneCard, { borderLeftColor: color }]}> 
      <View style={styles.milestoneHeader}>
        <Text style={styles.milestoneTitle}>{milestone.label}</Text>
        <Text style={[styles.milestoneStatus, { color }]}>
          {milestone.complete ? "On track" : `${Math.round(milestone.progress * 100)}%`}
        </Text>
      </View>
      <Text style={styles.milestoneHelper}>{milestone.helper}</Text>
      <Text style={styles.milestoneValue}>
        {formatINR(milestone.current, true)} / {formatINR(milestone.target, true)}
      </Text>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            fillStyle,
            {
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function FutureYouTab() {
  const profile = useAppStore((state) => state.currentProfile);
  const shareCardRef = useRef<ViewShot | null>(null);
  const { width } = useWindowDimensions();

  const [targetAge, setTargetAge] = useState(0);
  const [sipMultiplier, setSipMultiplier] = useState(1);
  const [cagr, setCagr] = useState(0.12);
  const [narrative, setNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState("");
  const [sharing, setSharing] = useState(false);
  const narrativeOpacity = useSharedValue(0);

  const currentProfile = profile;
  const minTargetAge = currentProfile ? Math.min(70, currentProfile.age + 5) : 35;
  const maxTargetAge = 70;
  const initialTargetAge = currentProfile
    ? Math.max(minTargetAge, Math.min(maxTargetAge, currentProfile.retirementAge || minTargetAge))
    : 35;
  const selectedAge = targetAge || initialTargetAge;

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

    setTargetAge(initialTargetAge);
    setSipMultiplier(1);
    setCagr(0.12);
  }, [currentProfile?.id, initialTargetAge]);

  const scenarioSip = useMemo(
    () => (currentProfile ? Math.round(currentProfile.monthlySIP * sipMultiplier) : 0),
    [currentProfile, sipMultiplier]
  );
  const projectedCorpus = useMemo(
    () => (currentProfile ? projectedCorpusForScenario(currentProfile, selectedAge, sipMultiplier, cagr) : 0),
    [cagr, currentProfile, selectedAge, sipMultiplier]
  );
  const fireTarget = useMemo(() => (currentProfile ? getFireCorpusTarget(currentProfile) : 0), [currentProfile]);
  const passiveIncome = useMemo(() => getMonthlyPassiveIncome(projectedCorpus), [projectedCorpus]);
  const fireAchieved = fireTarget > 0 && projectedCorpus >= fireTarget;
  const fireGap = Math.max(0, fireTarget - projectedCorpus);
  const fireProgress = fireTarget > 0 ? Math.min(projectedCorpus / fireTarget, 1) : 0;
  const milestones = useMemo(
    () => (currentProfile ? getFutureMilestones(currentProfile, projectedCorpus) : []),
    [currentProfile, projectedCorpus]
  );
  const chartData = useMemo(
    () => (currentProfile ? getFutureProjectionPoints(currentProfile, selectedAge, sipMultiplier, cagr) : []),
    [cagr, currentProfile, selectedAge, sipMultiplier]
  );
  const fallbackNarrative = useMemo(
    () =>
      currentProfile
        ? getFutureYouFallbackNarrative(currentProfile, selectedAge, projectedCorpus, fireTarget, sipMultiplier, cagr)
        : "",
    [cagr, currentProfile, fireTarget, projectedCorpus, selectedAge, sipMultiplier]
  );
  const chartWidth = Math.max(320, width - Spacing["3xl"]);

  useEffect(() => {
    if (!narrativeLoading && (narrative || fallbackNarrative)) {
      narrativeOpacity.value = 0;
      narrativeOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    }
  }, [fallbackNarrative, narrative, narrativeLoading, narrativeOpacity]);

  const narrativeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: narrativeOpacity.value,
  }));

  useEffect(() => {
    if (!currentProfile) {
      setNarrative("");
      return;
    }

    let active = true;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          setNarrativeLoading(true);
          setNarrativeError("");
          
          const nextNarrative = await GeminiService.getFutureYouNarrative(currentProfile, {
            targetAge: selectedAge,
            sipMultiplier,
            cagr,
            projectedCorpus,
            fireTarget,
          });

          if (active) {
            setNarrative(nextNarrative);
            setNarrativeError("");
          }
        } catch (error) {
          if (active) {
            const fallback = getFutureYouFallbackNarrative(
              currentProfile,
              selectedAge,
              projectedCorpus,
              fireTarget,
              sipMultiplier,
              cagr
            );
            setNarrative(fallback);
            const errorMsg = error instanceof Error ? error.message : "Using offline narrative";
            setNarrativeError(errorMsg);
            if (!(error instanceof Error && /offline|configured|api key/i.test(error.message))) {
              console.warn("[FutureYou] Narrative generation failed:", error);
            }
          }
        } finally {
          if (active) {
            setNarrativeLoading(false);
          }
        }
      })();
    }, 800);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentProfile?.id, currentProfile?.monthlySIP, selectedAge, sipMultiplier, cagr, projectedCorpus, fireTarget]);

  if (!currentProfile) {
    return <EmptyState />;
  }

  async function handleShare() {
    try {
      setSharing(true);

      const canUseBiometric = await AuthService.canUseBiometric();

      if (!canUseBiometric) {
        throw new Error("Biometric authentication is not available on this device.");
      }

      const verified = await AuthService.promptBiometric("Confirm before sharing your Future You card");

      if (!verified) {
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      const uri = await shareCardRef.current?.capture?.();

      if (!uri) {
        throw new Error("Unable to generate the share card.");
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: `Share your age ${selectedAge} Future You card`,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Please try again.";
      Alert.alert("Unable to share projection", errorMsg);
      console.error("[FutureYou] Share error:", error);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen scroll>
      <Animatable.View animation="fadeInUp" duration={500} style={styles.hero}>
        <Text style={styles.title}>Future You Mirror</Text>
        <Text style={styles.subtitle}>
          Drag ahead in time, stress-test your SIP, and see how close this path gets you to financial independence.
        </Text>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={90} duration={500} style={styles.projectionCard}>
        {fireAchieved ? (
          <View pointerEvents="none" style={styles.confettiMask}>
            <ConfettiCannon count={28} fadeOut fallSpeed={1700} origin={{ x: 120, y: -8 }} />
          </View>
        ) : null}
        <View style={styles.projectionHeader}>
          <View>
            <Text style={styles.projectionLabel}>Projected net worth at age {selectedAge}</Text>
            <View style={styles.glowWrap}>
              <AnimatedProjectionValue value={projectedCorpus} />
            </View>
          </View>
          
          <Text style={[styles.statusBadge, fireAchieved ? styles.statusBadgeSuccess : styles.statusBadgeBuilding]}>
            {fireAchieved ? "FIRE achieved" : "Building towards FIRE"}
          </Text>
          
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricChip}>
            <Text style={styles.metricLabel}>Passive income</Text>
            <Text style={styles.metricValue}>{formatINR(passiveIncome)}/month</Text>
          </View>
          <View style={styles.metricChip}>
            <Text style={styles.metricLabel}>Scenario SIP</Text>
            <Text style={styles.metricValue}>{formatINR(scenarioSip)}/month</Text>
          </View>
        </View>

        <LiquidProgressBar label={fireAchieved ? "Ahead of plan" : "FIRE readiness"} progress={fireProgress} />

        <Text style={styles.projectionBody}>
          {fireAchieved
            ? `This path clears your FIRE target of ${formatINR(fireTarget, true)} by age ${selectedAge}.`
            : `You are ${formatINR(fireGap, true)} short of your FIRE target of ${formatINR(
                fireTarget,
                true
              )} in this scenario.`}
        </Text>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={150} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>What-if controls</Text>
        <View style={styles.sliderStack}>
          <SliderField
            helper="Choose the age where you want to meet your future self."
            label="Mirror age"
            max={maxTargetAge}
            min={minTargetAge}
            onValueChange={setTargetAge}
            rangeLabel={`${minTargetAge} to ${maxTargetAge} years`}
            value={selectedAge}
            valueLabel={`${selectedAge} years`}
            variant="fire-dark"
          />
          <SliderField
            helper={`Current SIP of ${formatINR(currentProfile.monthlySIP)} grows or shrinks here.`}
            label="SIP multiplier"
            max={3}
            min={0.5}
            onValueChange={(value) => setSipMultiplier(Number(value.toFixed(1)))}
            rangeLabel="0.5x to 3.0x"
            step={0.1}
            value={sipMultiplier}
            valueLabel={`${sipMultiplier.toFixed(1)}x`}
            variant="fire-dark"
          />
          <Text style={styles.centerControlValue}>{sipMultiplier.toFixed(1)}x</Text>
          <SliderField
            helper="Try different long-term return assumptions to pressure-test the outcome."
            label="Expected CAGR"
            max={0.2}
            min={0.06}
            onValueChange={(value) => setCagr(Number(value.toFixed(2)))}
            rangeLabel="6% to 20%"
            step={0.01}
            value={cagr}
            valueLabel={`${(cagr * 100).toFixed(0)}%`}
            variant="fire-dark"
          />
          <Text style={styles.centerControlValue}>{(cagr * 100).toFixed(0)}%</Text>
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={210} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>Milestone progress</Text>
        <View style={styles.milestoneStack}>
          {milestones.map((milestone) => (
            <MilestoneCard key={milestone.key} milestone={milestone} />
          ))}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={260} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>5-year projection curve</Text>
        <View style={styles.chartCard}>
          <Text style={styles.chartBody}>
            Every bar is a future age checkpoint. The selected age is highlighted in gold.
          </Text>

          <VictoryChart
            domainPadding={{ x: 18, y: 22 }}
            height={260}
            padding={{ top: 20, bottom: 42, left: 64, right: 18 }}
            theme={VictoryTheme.material}
            width={chartWidth}
          >
            <VictoryAxisWrapper
              style={{
                axis: { stroke: Colors.border },
                grid: { stroke: "transparent" },
                tickLabels: {
                  fill: Colors.textSecondary,
                  fontFamily: Typography.fontFamily.body,
                  fontSize: 11,
                },
              }}
            />
            <VictoryAxisWrapper
              dependentAxis
              tickFormat={(value: number) => formatINR(value, true)}
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
            <VictoryBarWrapper
              animate={{ duration: 1000, onLoad: { duration: 700 } }}
              barRatio={0.72}
              cornerRadius={{ top: 6 }}
              data={chartData}
              style={{
                data: {
                  fill: ({ datum }: { datum: any }) => (datum.highlighted ? "#D4AF37" : "#2A4A7F"),
                },
              }}
              x="age"
              y="corpus"
            />
            
            <VictoryLineWrapper
  animate={{ duration: 1050, onLoad: { duration: 760 } }}
  data={chartData.map((d) => ({ age: d.age, target: fireTarget }))}
  style={{ data: { stroke: Colors.red, strokeDasharray: "6,4", strokeWidth: 1.5, opacity: 0.7 } }}
  x="age"
  y="target"
/>
          </VictoryChart>
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={320} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>AI narrative</Text>
        <Animated.View style={[styles.narrativeCard, narrativeAnimatedStyle]}>
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
          {narrativeLoading ? <Text style={styles.loadingText}>FinMentor is writing your future note...</Text> : null}
          {narrativeError ? <Text style={styles.warningText}>{narrativeError}</Text> : null}
          <Text style={styles.narrativeText}>{narrative || fallbackNarrative}</Text>
        </Animated.View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={380} duration={500} style={styles.section}>
        <View style={styles.shareCard}>
          <View style={styles.shareHeader}>
            <Text style={styles.shareTitle}>Secure share card</Text>
            <Button
              label="Share Card"
              loading={sharing}
              onPress={() => {
                handleShare().catch((e) => {
                  Alert.alert("Unable to share card", e instanceof Error ? e.message : "Please try again.");
                });
              }}
              style={styles.shareButton}
            />
          </View>
          <Text style={styles.shareBody}>
            This detailed card includes your projected corpus at age {selectedAge}, so biometric confirmation is
            required before sharing.
          </Text>
        </View>
      </Animatable.View>

      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.captureCard}>
            <Text style={styles.captureBrand}>ET FinMentor</Text>
            <Text style={styles.captureEyebrow}>Future You at age {selectedAge}</Text>
            <Text style={styles.captureValue}>{formatINR(projectedCorpus)}</Text>
            <Text style={[styles.captureStatus, { color: fireAchieved ? Colors.teal : Colors.gold }]}>
              {fireAchieved ? "FIRE achieved" : "Still building toward FIRE"}
            </Text>
            <View style={styles.captureDivider} />
            <Text style={styles.captureLine}>Monthly passive income: {formatINR(passiveIncome)}</Text>
            <Text style={styles.captureLine}>Scenario SIP: {formatINR(scenarioSip)}/month</Text>
            <Text style={styles.captureLine}>Assumed CAGR: {(cagr * 100).toFixed(0)}%</Text>
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
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  projectionCard: {
    backgroundColor: "#0D1B35",
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
    overflow: "hidden",
    padding: Spacing.xl,
  },
  confettiMask: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  projectionHeader: {
    gap: Spacing.md,
  },
  projectionLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  projectionValue: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1,
  },
  glowWrap: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 54,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderWidth: 0.5,
    borderRadius: Radius.full,
    overflow: "hidden",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  statusBadgeBuilding: {
    backgroundColor: "rgba(212,175,55,0.15)",
    borderColor: "rgba(212,175,55,0.3)",
    color: "#D4AF37",
  },
  statusBadgeSuccess: {
    backgroundColor: "rgba(29,158,117,0.15)",
    borderColor: "rgba(29,158,117,0.3)",
    color: "#1D9E75",
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  metricChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    flex: 1,
    minWidth: 140,
    padding: Spacing.md,
  },
  metricLabel: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  metricValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
  },
  projectionBody: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 16,
  },
  sliderStack: {
    gap: Spacing.sm,
  },
  centerControlValue: {
    alignSelf: "center",
    color: "#D4AF37",
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  milestoneStack: {
    gap: Spacing.md,
  },
  milestoneCard: {
    backgroundColor: "#1A1A1A",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 16,
    borderLeftWidth: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 16,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  milestoneHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  milestoneTitle: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  milestoneStatus: {
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.sm,
  },
  milestoneHelper: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
  },
  milestoneValue: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 14,
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: Radius.full,
    height: 6,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: Radius.full,
    height: "100%",
  },
  chartCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
    overflow: "hidden",
    paddingVertical: Spacing.lg,
  },
  chartBody: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  narrativeCard: {
    backgroundColor: "rgba(127,119,221,0.06)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(127,119,221,0.2)",
    gap: Spacing.sm,
    padding: 20,
  },
  aiBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(127,119,221,0.15)",
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  aiBadgeText: {
    color: "#7F77DD",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
  loadingText: {
    color: "#7F77DD",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  narrativeText: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  shareCard: {
    backgroundColor: "rgba(212,175,55,0.06)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(212,175,55,0.2)",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  shareHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shareTitle: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  shareBody: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  shareButton: {
    borderRadius: 99,
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
  captureEyebrow: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  captureValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: 44,
    marginBottom: Spacing.sm,
  },
  captureStatus: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    marginBottom: Spacing.lg,
  },
  captureDivider: {
    backgroundColor: Colors.border,
    height: 1,
    marginBottom: Spacing.lg,
  },
  captureLine: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
    marginBottom: Spacing.sm,
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
});
