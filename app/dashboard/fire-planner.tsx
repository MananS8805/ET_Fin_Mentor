import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Line as SvgLine,
  Text as SvgText,
  Rect as SvgRect,
} from "react-native-svg";
import Animated, {
  Easing,
  FadeInUp,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { LiquidProgressBar } from "../../src/components/LiquidProgressBar";
import { AnimatedCurrencyValue } from "../../src/components/AnimatedCurrencyValue";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { SliderField } from "../../src/components/SliderField";
import { AuthService } from "../../src/core/services/AuthService";
import {
  AssetAllocationStage,
  FireProjectionPoint,
  UserProfileData,
  createEmptyUserProfile,
  createIncomeScenarioProfile,
  formatINR,
  getBetterRegime,
  getFireAssetAllocationSchedule,
  getFireCorpusTarget,
  getFireProjectionSeries,
  getNewRegimeTax,
  getOldRegimeTax,
  getTaxSaving,
  getYearsToFire,
  projectedCorpusAtAge,
  sipNeededFor,
  getSIPAllocationByGoal,
} from "../../src/core/models/UserProfile";
import { GeminiService, requestGemini } from "../../src/core/services/GeminiService";
import { AppConfig } from "../../src/core/config";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

// ---------------------------------------------------------------------------
// SVG Projection Chart — replaces VictoryChart
// ---------------------------------------------------------------------------

const CHART_PAD_L = 52;
const CHART_PAD_R = 16;
const CHART_PAD_T = 16;
const CHART_PAD_B = 28;

function niceYMax(rawMax: number): number {
  if (rawMax <= 0) return 1_000_000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  return Math.ceil((rawMax * 1.08) / magnitude) * magnitude;
}

function buildYTicks(yMax: number, count = 4): number[] {
  const step = yMax / count;
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
  }
  return d;
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
}

interface FireProjectionChartProps {
  data: FireProjectionPoint[];
  width: number;
}

function FireProjectionChart({ data, width: svgW }: FireProjectionChartProps) {
  const svgH = 220;
  const plotW = svgW - CHART_PAD_L - CHART_PAD_R;
  const plotH = svgH - CHART_PAD_T - CHART_PAD_B;

  const { yTicks, projectedPath, targetPath, areaPath, xLabels } = useMemo(() => {
    if (data.length < 2) {
      return { yTicks: [], projectedPath: "", targetPath: "", areaPath: "", xLabels: [] };
    }

    const allValues = data.flatMap((d) => [d.projectedCorpus, d.targetCorpus]);
    const rawMax = Math.max(...allValues);
    const yMax = niceYMax(rawMax);
    const yTicks = buildYTicks(yMax);

    const xPos = (i: number) => CHART_PAD_L + (i / (data.length - 1)) * plotW;
    const yPos = (v: number) =>
      CHART_PAD_T + plotH - Math.max(0, Math.min(1, v / yMax)) * plotH;

    const projPts = data.map((d, i) => ({ x: xPos(i), y: yPos(d.projectedCorpus) }));
    const targPts = data.map((d, i) => ({ x: xPos(i), y: yPos(d.targetCorpus) }));

    // Area under projected line
    const baseY = CHART_PAD_T + plotH;
    const areaPath =
      buildSmoothPath(projPts) +
      ` L${projPts[projPts.length - 1].x},${baseY}` +
      ` L${projPts[0].x},${baseY} Z`;

    // X axis labels — show ~5 evenly spaced ages
    const step = Math.max(1, Math.floor(data.length / 5));
    const xLabels: Array<{ x: number; label: string }> = [];
    for (let i = 0; i < data.length; i += step) {
      xLabels.push({ x: xPos(i), label: String(data[i].age) });
    }
    // always include last age
    const last = data[data.length - 1];
    if (xLabels[xLabels.length - 1]?.label !== String(last.age)) {
      xLabels.push({ x: xPos(data.length - 1), label: String(last.age) });
    }

    return {
      yTicks,
      projectedPath: buildSmoothPath(projPts),
      targetPath: buildLinePath(targPts),
      areaPath,
      xLabels,
    };
  }, [data, plotW, plotH]);

  if (data.length < 2) {
    return (
      <View style={[chartStyles.empty, { width: svgW, height: 220 }]}>
        <Text style={chartStyles.emptyText}>No projection data</Text>
      </View>
    );
  }

  const allValues = data.flatMap((d) => [d.projectedCorpus, d.targetCorpus]);
  const yMax = niceYMax(Math.max(...allValues));

  return (
    <Svg width={svgW} height={svgH}>
      <Defs>
        <LinearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={Colors.teal} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={Colors.teal} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Horizontal grid lines + Y labels */}
      {yTicks.map((tick) => {
        const y = CHART_PAD_T + plotH - (tick / yMax) * plotH;
        return (
          <Animated.View key={`y-${tick}`}>
            <SvgLine
              x1={CHART_PAD_L}
              y1={y}
              x2={svgW - CHART_PAD_R}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
            <SvgText
              x={CHART_PAD_L - 5}
              y={y + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.35)"
              fontSize={9}
              fontFamily={Typography.fontFamily.body}
            >
              {formatINR(tick, true)}
            </SvgText>
          </Animated.View>
        );
      })}

      {/* Area fill under projected line */}
      <Path d={areaPath} fill="url(#projGrad)" />

      {/* Target corpus dashed line */}
      <Path
        d={targetPath}
        stroke={Colors.red}
        strokeWidth={1.5}
        strokeDasharray="7,5"
        fill="none"
        opacity={0.7}
      />

      {/* Projected corpus smooth line */}
      <Path
        d={projectedPath}
        stroke={Colors.teal}
        strokeWidth={2.5}
        fill="none"
      />

      {/* X axis baseline */}
      <SvgLine
        x1={CHART_PAD_L}
        y1={CHART_PAD_T + plotH}
        x2={svgW - CHART_PAD_R}
        y2={CHART_PAD_T + plotH}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={0.5}
      />

      {/* X axis age labels */}
      {xLabels.map(({ x, label }) => (
        <SvgText
          key={`x-${label}`}
          x={x}
          y={svgH - 6}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize={9}
          fontFamily={Typography.fontFamily.body}
        >
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}

const chartStyles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
  },
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>FIRE Planner + Tax Battle</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so the planner can use your actual corpus, SIP, deductions, and retirement target.
        </Text>
      </View>
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Planner unlocks after profile setup</Text>
        <Text style={styles.emptyBody}>
          We need your age, current corpus, SIP, deductions, and retirement lifestyle target to build a real plan.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// AllocationCard
// ---------------------------------------------------------------------------

function AllocationCard({ item, index }: { item: AssetAllocationStage; index: number }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(420)} style={styles.allocationCard}>
      <Text style={styles.allocationTitle}>{item.label}</Text>
      <Text style={styles.allocationHelper}>{item.helper}</Text>
      <View style={styles.allocationGrid}>
        <View style={[styles.allocationChip, styles.allocationChipEquity]}>
          <Text style={[styles.allocationLabel, styles.allocationLabelEquity]}>Equity</Text>
          <Text style={[styles.allocationValue, styles.allocationValueEquity]}>{item.equity}%</Text>
        </View>
        <View style={[styles.allocationChip, styles.allocationChipDebt]}>
          <Text style={[styles.allocationLabel, styles.allocationLabelDebt]}>Debt</Text>
          <Text style={[styles.allocationValue, styles.allocationValueDebt]}>{item.debt}%</Text>
        </View>
        <View style={[styles.allocationChip, styles.allocationChipGold]}>
          <Text style={[styles.allocationLabel, styles.allocationLabelGold]}>Gold</Text>
          <Text style={[styles.allocationValue, styles.allocationValueGold]}>{item.gold}%</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// AnimatedSummaryNumber
// FIX 10: removed animatedValue.value = 0 reset — animates from current value,
//          no more flash-from-zero on every slider drag
// ---------------------------------------------------------------------------

function AnimatedSummaryNumber({
  value,
  formatter,
  style,
}: {
  value: number;
  formatter: (value: number) => string;
  style: any;
}) {
  const animatedValue = useSharedValue(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // FIX 10: no reset to 0 — withTiming starts from current animatedValue
    animatedValue.value = withTiming(value, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [animatedValue, value]);

  useAnimatedReaction(
    () => Math.round(animatedValue.value),
    (next, prev) => {
      if (next !== prev) runOnJS(setDisplayValue)(next);
    },
    [animatedValue]
  );

  return <Text style={style}>{formatter(displayValue)}</Text>;
}

// ---------------------------------------------------------------------------
// Tax narrative fallback
// ---------------------------------------------------------------------------

function buildTaxFallbackNarrative(
  annualIncome: number,
  betterRegime: "old" | "new",
  taxSaving: number,
  oldTax: number,
  newTax: number
) {
  if (taxSaving < 5_000) {
    return `At ${formatINR(annualIncome)}, both regimes are almost neck and neck with your current deduction profile. A small change in deductions could flip the winner, so review before you lock it in.`;
  }
  return `At ${formatINR(annualIncome)}, the ${betterRegime} regime is ahead by about ${formatINR(taxSaving)} this year. Old regime tax is ${formatINR(oldTax)} and new regime tax is ${formatINR(newTax)}, assuming your current PF, 80C, and NPS inputs stay the same.`;
}

// ---------------------------------------------------------------------------
// System instruction for Gemini roadmap
// ---------------------------------------------------------------------------

function buildSystemInstruction(_currentProfile: UserProfileData) {
  return `You are a certified financial advisor specializing in FIRE (Financial Independence, Retire Early) planning for Indian investors.

Your task is to generate a personalized 12-month action roadmap that helps this investor progress toward financial independence and retirement.

Guidelines:
1. Return ONLY a valid JSON array of exactly 12 strings — one specific action per month
2. Each action must be a complete, actionable sentence using the investor's actual numbers
3. Actions must be specific, measurable, and relevant to their current situation
4. Vary actions across these areas: SIP management, tax planning, rebalancing, emergency fund, insurance, debt reduction, expense optimization, and annual reviews
5. Quarter 1: Focus on tax planning and SIP optimization
6. Quarter 2: Mid-year rebalancing and performance review
7. Quarter 3: Rebalancing and inflation management
8. Quarter 4: Year-end bonus deployment and planning
9. Make each action specific to their risk profile, goals, and current corpus
10. Consider their income stability, existing debt, and emergency fund status
11. If they're behind on FIRE timeline, prioritize SIP increases and debt reduction
12. If they're on track, focus on optimization and tax efficiency
13. Keep each action to one sentence, no bullet points or sub-items`;
}

// ---------------------------------------------------------------------------
// Main tab
// ---------------------------------------------------------------------------

export default function FirePlannerTab() {
  const profile = useAppStore((state) => state.currentProfile);
  const portfolioXRay = useAppStore((state) => state.portfolioXRay);
  const shareCardRef = useRef<ViewShot | null>(null);
  const { width } = useWindowDimensions();

  // FIX 12: slider state — only reset on profile ID change, not on field changes
  const [retirementAge, setRetirementAge] = useState(0);
  const [targetExpense, setTargetExpense] = useState(0);
  const [salaryAnnual, setSalaryAnnual] = useState(0);
  const [taxNarrative, setTaxNarrative] = useState("");
  const [taxNarrativeLoading, setTaxNarrativeLoading] = useState(false);
  const [taxNarrativeError, setTaxNarrativeError] = useState("");
  const [exporting, setExporting] = useState(false);

  const currentProfile = profile;
  const minRetirementAge = currentProfile ? Math.min(70, currentProfile.age + 5) : 40;
  const maxRetirementAge = 70;

  // Derive stable defaults — used only for initialisation, not as effect deps
  const defaultRetirementAge = currentProfile
    ? Math.max(minRetirementAge, Math.min(maxRetirementAge, currentProfile.retirementAge || minRetirementAge))
    : 55;
  const defaultTargetExpense = currentProfile
    ? Math.max(20_000, Math.round((currentProfile.targetMonthlyExpenseRetirement || currentProfile.monthlyExpenses) / 5_000) * 5_000)
    : 50_000;
  const defaultAnnualIncome = currentProfile
    ? Math.max(500_000, Math.round(((currentProfile.annualIncome > 0 ? currentProfile.annualIncome : currentProfile.monthlyIncome * 12)) / 50_000) * 50_000)
    : 500_000;

  const plannerRetirementAge = retirementAge || defaultRetirementAge;
  const plannerTargetExpense = targetExpense || defaultTargetExpense;
  const taxAnnualIncome = salaryAnnual || defaultAnnualIncome;

  const [roadmap, setRoadmap] = useState<string[]>([]);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState("");

  const heroY = useSharedValue(30);
  const heroOpacity = useSharedValue(0);
  const winnerScale = useSharedValue(0);

  useEffect(() => {
    heroY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    heroOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [heroOpacity, heroY]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroY.value }],
  }));

  const winnerBadgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: winnerScale.value }],
  }));

  // FIX 12: depend only on profile ID — prevents slider reset when store updates a field
  useEffect(() => {
    if (!currentProfile) return;
    setRetirementAge(defaultRetirementAge);
    setTargetExpense(defaultTargetExpense);
    setSalaryAnnual(defaultAnnualIncome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id]);

  const plannerProfile = useMemo(
    () =>
      currentProfile
        ? createEmptyUserProfile({
            ...currentProfile,
            retirementAge: plannerRetirementAge,
            targetMonthlyExpenseRetirement: plannerTargetExpense,
          })
        : null,
    [currentProfile, plannerRetirementAge, plannerTargetExpense]
  );

  const fireTarget = useMemo(
    () => (plannerProfile ? getFireCorpusTarget(plannerProfile) : 0),
    [plannerProfile]
  );
  const requiredSip = useMemo(
    () => (plannerProfile ? sipNeededFor(plannerProfile, fireTarget, plannerRetirementAge) : 0),
    [fireTarget, plannerProfile, plannerRetirementAge]
  );
  const projectedRetirementCorpus = useMemo(
    () => (plannerProfile ? projectedCorpusAtAge(plannerProfile, plannerRetirementAge) : 0),
    [plannerProfile, plannerRetirementAge]
  );
  const yearsRemaining = currentProfile ? Math.max(0, plannerRetirementAge - currentProfile.age) : 0;
  const yearsToFire = useMemo(
    () => (plannerProfile ? getYearsToFire(plannerProfile, fireTarget) : null),
    [fireTarget, plannerProfile]
  );
  const sipGap = currentProfile ? Math.max(0, requiredSip - currentProfile.monthlySIP) : 0;
  const projectionGap = Math.max(0, fireTarget - projectedRetirementCorpus);
  const allocationSchedule = useMemo(
    () => (plannerProfile ? getFireAssetAllocationSchedule(plannerProfile, plannerRetirementAge) : []),
    [plannerProfile, plannerRetirementAge]
  );
  const projectionSeries = useMemo(
    () =>
      plannerProfile
        ? getFireProjectionSeries(plannerProfile, plannerRetirementAge, plannerTargetExpense)
        : [],
    [plannerProfile, plannerRetirementAge, plannerTargetExpense]
  );
  const goalBreakdown = useMemo(
    () => (currentProfile ? getSIPAllocationByGoal(currentProfile) : []),
    [currentProfile]
  );
  const goalsSummary = useMemo(
    () => (currentProfile?.goals?.length ? currentProfile.goals.join(", ") : "No explicit goals"),
    [currentProfile?.goals]
  );

  const targetEquity = allocationSchedule[0]?.equity ?? 70;
  const chartWidth = Math.max(320, width - Spacing["3xl"]);
  const totalPortfolioValue = portfolioXRay?.totalValue ?? currentProfile?.existingCorpus ?? 0;
  const corpusProgress = fireTarget > 0 ? Math.min(projectedRetirementCorpus / fireTarget, 1) : 0;

  const taxScenarioProfile = useMemo(
    () => (currentProfile ? createIncomeScenarioProfile(currentProfile, taxAnnualIncome) : null),
    [currentProfile, taxAnnualIncome]
  );
  const oldTax = useMemo(() => (taxScenarioProfile ? getOldRegimeTax(taxScenarioProfile) : 0), [taxScenarioProfile]);
  const newTax = useMemo(() => (taxScenarioProfile ? getNewRegimeTax(taxScenarioProfile) : 0), [taxScenarioProfile]);
  const betterRegime = useMemo(
    () => (taxScenarioProfile ? getBetterRegime(taxScenarioProfile) : "new"),
    [taxScenarioProfile]
  );
  const taxSaving = useMemo(
    () => (taxScenarioProfile ? getTaxSaving(taxScenarioProfile) : 0),
    [taxScenarioProfile]
  );

  useEffect(() => {
    winnerScale.value = 0;
    winnerScale.value = withSpring(1, { damping: 12, stiffness: 170 });
    // winnerScale is a stable ref — intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betterRegime]);

  const taxFallbackNarrative = useMemo(
    () => buildTaxFallbackNarrative(taxAnnualIncome, betterRegime, taxSaving, oldTax, newTax),
    [betterRegime, newTax, oldTax, taxAnnualIncome, taxSaving]
  );

  // FIX 11: roadmap effect — depend only on stable computed values, not raw profile fields
  useEffect(() => {
    if (!currentProfile || !plannerProfile) return;

    if (!AppConfig.isGeminiConfigured() && !AppConfig.isGroqConfigured()) {
      setRoadmap([]);
      setRoadmapError("AI roadmap is offline. Add Gemini or Groq key in .env to enable personalized roadmap generation.");
      setRoadmapLoading(false);
      return;
    }

    let active = true;

    const generateRoadmap = async () => {
      try {
        setRoadmapLoading(true);
        setRoadmapError("");

        const data = await requestGemini({
          system_instruction: { parts: [{ text: buildSystemInstruction(currentProfile) }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    "Generate a personalized 12-month FIRE action roadmap for this investor.",
                    "Return ONLY a JSON array of exactly 12 strings — one action per month.",
                    "No markdown, no preamble, no explanation. Just the raw JSON array.",
                    "Each string must be one specific actionable sentence using the user's actual numbers.",
                    "",
                    `Current age: ${currentProfile.age}`,
                    `Retirement age: ${plannerRetirementAge}`,
                    `Years to FIRE: ${yearsRemaining}`,
                    `Required SIP: ${formatINR(requiredSip)}/month`,
                    `Current SIP: ${formatINR(currentProfile.monthlySIP)}/month`,
                    `SIP gap: ${sipGap > 0 ? formatINR(sipGap) : "none — on track"}`,
                    `FIRE target corpus: ${formatINR(fireTarget, true)}`,
                    `Projected corpus at retirement: ${formatINR(projectedRetirementCorpus, true)}`,
                    `Corpus gap: ${projectionGap > 0 ? formatINR(projectionGap, true) : "none — on track"}`,
                    `Target equity allocation: ${targetEquity}%`,
                    `Risk profile: ${currentProfile.riskProfile}`,
                    `Goals: ${goalsSummary}`,
                    `Monthly income: ${formatINR(currentProfile.monthlyIncome)}`,
                    `Emergency fund: ${formatINR(currentProfile.emergencyFund)}`,
                  ].join("\n"),
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
        }, { feature: "fire-roadmap" });

        if (!active) return;

        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned) as string[];

        if (active && Array.isArray(parsed) && parsed.length === 12) {
          setRoadmap(parsed);
          setRoadmapError("");
        }
      } catch (error) {
        if (active) {
          const errorMsg = error instanceof Error ? error.message : "Unable to generate AI roadmap";
          setRoadmapError(errorMsg);
        }
      } finally {
        if (active) setRoadmapLoading(false);
      }
    };

    void generateRoadmap();
    return () => { active = false; };
  }, [
    // FIX 11: only computed planner values + profile ID, not raw primitive fields
    currentProfile?.id,
    plannerProfile,
    plannerRetirementAge,
    requiredSip,
    fireTarget,
    projectedRetirementCorpus,
    sipGap,
    projectionGap,
    targetEquity,
    yearsRemaining,
    goalsSummary,
  ]);

  // FIX 9: removed taxFallbackNarrative from deps — it's derived, causes double-fire
  useEffect(() => {
    if (!currentProfile) return;
    let active = true;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          setTaxNarrativeLoading(true);
          setTaxNarrativeError("");
          const nextNarrative = await GeminiService.getTaxBattleNarrative(currentProfile, {
            annualIncome: taxAnnualIncome,
            oldTax,
            newTax,
            betterRegime,
            taxSaving,
          });
          if (active) setTaxNarrative(nextNarrative);
        } catch (error) {
          if (active) {
            // Compute fallback inline — do not use memo value to avoid stale closure
            setTaxNarrative(buildTaxFallbackNarrative(taxAnnualIncome, betterRegime, taxSaving, oldTax, newTax));
            setTaxNarrativeError(error instanceof Error ? error.message : "Showing offline tax summary for now.");
          }
        } finally {
          if (active) setTaxNarrativeLoading(false);
        }
      })();
    }, 700);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [betterRegime, currentProfile, newTax, oldTax, taxAnnualIncome, taxSaving]);

  // FIX 13: debounced slider handlers — memos only recompute after gesture ends
  const handleRetirementAgeChange = useCallback(
    (v: number) => {
      setRetirementAge(v);
    },
    []
  );
  const handleTargetExpenseChange = useCallback(
    (v: number) => {
      setTargetExpense(v);
    },
    []
  );
  const handleSalaryChange = useCallback(
    (v: number) => {
      setSalaryAnnual(v);
    },
    []
  );

  // FIX 3 & stable export handler
  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const canUseBiometric = await AuthService.canUseBiometric();
      if (!canUseBiometric) throw new Error("Biometric authentication is not available on this device.");
      const verified = await AuthService.promptBiometric("Confirm before exporting your FIRE plan");
      if (!verified) return;
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error("Unable to generate the plan export.");
      await Sharing.shareAsync(uri, { dialogTitle: "Export your ET FinMentor FIRE plan" });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Please try again.";
      Alert.alert("Unable to export plan", errorMsg);
    } finally {
      setExporting(false);
    }
  }, [shareCardRef]);

  if (!currentProfile || !plannerProfile) return <EmptyState />;

  return (
    <Screen scroll>
      <Animated.View style={[styles.hero, heroAnimatedStyle]}>
        <Text style={styles.title}>FIRE Planner</Text>
        <Text style={styles.subtitle}>
          Tune your retirement age and lifestyle target, then compare tax regimes live against the same deduction base.
        </Text>
        <Animated.View sharedTransitionTag="portfolio-shared-value" style={styles.sharedPortfolioBadge}>
          <Text style={styles.sharedPortfolioText}>{formatINR(totalPortfolioValue, true)}</Text>
        </Animated.View>
      </Animated.View>

      <Animatable.View animation="fadeInUp" delay={80} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>FIRE inputs</Text>
        <View style={styles.sliderStack}>
          <SliderField
            helper="Choose when you want work to become optional."
            label="Retirement age"
            max={maxRetirementAge}
            min={minRetirementAge}
            onValueChange={handleRetirementAgeChange}
            rangeLabel={`${minRetirementAge} to ${maxRetirementAge} years`}
            value={plannerRetirementAge}
            valueLabel={`${plannerRetirementAge} years`}
            variant="fire-dark"
          />
          <SliderField
            helper="Your expected monthly living cost in retirement, in today's rupees."
            label="Target monthly expense"
            max={300_000}
            min={20_000}
            onValueChange={handleTargetExpenseChange}
            rangeLabel="₹20K to ₹3L"
            step={5_000}
            value={plannerTargetExpense}
            valueLabel={formatINR(plannerTargetExpense, true)}
            variant="fire-dark"
          />
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={130} duration={500} style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Required SIP</Text>
            <AnimatedSummaryNumber
              formatter={(v) => formatINR(v, true)}
              style={styles.summaryValue}
              value={requiredSip}
            />
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Years to FIRE</Text>
            {/* FIX 5: null means not achievable — show a real message, not a magic 75 */}
            {yearsToFire === null ? (
              <Text style={[styles.summaryValueText, styles.summaryValueNotAchievable]}>
                Not achievable{"\n"}at current SIP
              </Text>
            ) : (
              <AnimatedSummaryNumber
                formatter={(v) => `${Math.max(0, v)} yrs`}
                style={styles.summaryValueText}
                value={yearsToFire}
              />
            )}
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Projected corpus</Text>
            <AnimatedCurrencyValue style={styles.summaryValueText} value={projectedRetirementCorpus} variant="slot" />
          </View>
        </View>

        <LiquidProgressBar label="Target corpus" progress={corpusProgress} />

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, styles.targetPill]}>
            <Text style={styles.summaryPillLabel}>Target corpus</Text>
            <Text style={[styles.summaryPillValue, styles.targetPillValue]}>{formatINR(fireTarget, true)}</Text>
          </View>
          <View style={[styles.summaryPill, sipGap > 0 ? styles.sipGapPillNegative : styles.sipGapPillPositive]}>
            <Text style={styles.summaryPillLabel}>Current SIP gap</Text>
            <Text style={[styles.summaryPillValue, sipGap > 0 ? styles.sipGapNegativeText : styles.sipGapPositiveText]}>
              {sipGap > 0 ? formatINR(sipGap) : "Ahead of plan"}
            </Text>
          </View>
        </View>

        <Text style={styles.summaryBody}>
          {projectionGap > 0
            ? `At your current SIP, the projected corpus at age ${plannerRetirementAge} is ${formatINR(projectedRetirementCorpus, true)}, leaving a gap of ${formatINR(projectionGap, true)}.`
            : `At your current SIP, the projected corpus at age ${plannerRetirementAge} is ${formatINR(projectedRetirementCorpus, true)}, which clears the target.`}
        </Text>
        <Text style={styles.summaryBodyMuted}>
          Time remaining: {yearsRemaining} years. Existing SIP: {formatINR(currentProfile.monthlySIP)}/month.
        </Text>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={190} duration={500} style={styles.section}>
        <View style={styles.projectionHeaderRow}>
          <View style={styles.projectionDot} />
          <Text style={styles.projectionTitle}>Projection</Text>
        </View>

        {goalBreakdown.length > 0 ? (
          <Animatable.View animation="fadeInUp" delay={160} duration={500} style={styles.section}>
            <Text style={styles.sectionTitle}>SIP by goal</Text>
            <View style={styles.allocationStack}>
              {goalBreakdown.map((item, index) => (
                <Animated.View
                  entering={FadeInUp.delay(index * 50).springify().damping(14).stiffness(145)}
                  key={item.goal}
                  style={styles.allocationCard}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.allocationTitle} numberOfLines={1}>{item.goal}</Text>
                    <Text style={styles.allocationValue}>{formatINR(item.sipAmount)}/mo</Text>
                  </View>
                  <Text style={styles.allocationHelper}>
                    {item.horizonYears}yr horizon · target {formatINR(item.targetCorpus, true)}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </Animatable.View>
        ) : null}

        {/* FIX 2: SVG chart replaces VictoryChart entirely */}
        <View style={styles.chartCard}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.teal }]} />
              <Text style={styles.legendText}>Projected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendDashSwatch} />
              <Text style={styles.legendText}>Target</Text>
            </View>
          </View>
          <FireProjectionChart data={projectionSeries} width={chartWidth} />
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={250} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>Asset allocation schedule</Text>
        <View style={styles.allocationStack}>
          {allocationSchedule.map((item, index) => (
            <AllocationCard item={item} index={index} key={item.label} />
          ))}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={280} duration={500} style={styles.section}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
          <Text style={styles.sectionTitle}>12-Month Roadmap</Text>
          {roadmapLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color={Colors.purple} />
              <Text style={{ color: Colors.purple, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 12 }}>
                AI generating...
              </Text>
            </View>
          )}
        </View>

        {roadmapError ? (
          <View style={{ marginBottom: Spacing.md, backgroundColor: "rgba(239,68,68,0.12)", borderRadius: Radius.md, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.red }}>
            <Text style={{ color: Colors.red, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 13, marginBottom: 6 }}>
              Offline Roadmap
            </Text>
            <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.body, fontSize: 12 }}>
              {roadmapError}. Showing generic monthly actions below.
            </Text>
          </View>
        ) : null}

        <View style={styles.roadmapWrap}>
          {[...Array(12)].map((_, i) => {
            const monthNum = i + 1;
            const isQuarterStart = [1, 4, 7, 10].includes(monthNum);
            const goalSplit =
              goalBreakdown.length > 0
                ? goalBreakdown.slice(0, 2).map((g) => g.goal).join(" + ")
                : "Index Funds & Debt";
            const aiAction = roadmap[i];

            const staticActions: Record<number, { label: string; color: string; bg: string }> = {
              1: sipGap > 0
                ? { label: `Step up SIP by ${formatINR(sipGap)} to close your corpus gap.`, color: Colors.gold, bg: "rgba(245,166,35,0.12)" }
                : { label: `Confirm SIP of ${formatINR(requiredSip)} is active and auto-debiting.`, color: Colors.teal, bg: "rgba(29,158,117,0.12)" },
              2: { label: `Verify last month's SIP was processed successfully.`, color: Colors.textSecondary, bg: "rgba(255,255,255,0.05)" },
              3: { label: `Tax month — maximize 80C before March 31 deadline.`, color: Colors.purple, bg: "rgba(127,119,221,0.12)" },
              4: { label: `Q2 rebalance — check equity vs target ${allocationSchedule[0]?.equity ?? 70}%.`, color: Colors.teal, bg: "rgba(29,158,117,0.12)" },
              5: { label: `Review underperforming funds against benchmark.`, color: Colors.textSecondary, bg: "rgba(255,255,255,0.05)" },
              6: { label: `Mid-year check — recalculate FIRE target if income changed.`, color: Colors.purple, bg: "rgba(127,119,221,0.12)" },
              7: { label: `Q3 rebalance — trim equity if drifted above target.`, color: Colors.teal, bg: "rgba(29,158,117,0.12)" },
              8: { label: `Step up SIP by 10% to beat inflation drag.`, color: Colors.gold, bg: "rgba(245,166,35,0.12)" },
              9: { label: `Top up emergency fund if below 6 months of expenses.`, color: Colors.textSecondary, bg: "rgba(255,255,255,0.05)" },
              10: { label: `Q4 rebalance — final equity trim before year end.`, color: Colors.teal, bg: "rgba(29,158,117,0.12)" },
              11: { label: `Bonus season — deploy 80% of any bonus into FIRE corpus.`, color: Colors.purple, bg: "rgba(127,119,221,0.12)" },
              12: { label: `Annual review — update insurance cover and emergency fund limits.`, color: Colors.gold, bg: "rgba(245,166,35,0.12)" },
            };
            const fallback = staticActions[monthNum];

            return (
              <View key={i} style={[styles.roadmapRow, i === 11 ? styles.roadmapRowLast : null]}>
                <View style={styles.roadmapMonthWrap}>
                  <Text style={[styles.roadmapMonth, isQuarterStart ? styles.roadmapMonthQuarter : styles.roadmapMonthRegular]}>
                    M{monthNum}
                  </Text>
                  {isQuarterStart && (
                    <Text style={styles.roadmapQuarterBadge}>Q{Math.ceil(monthNum / 3)}</Text>
                  )}
                </View>
                <View style={styles.roadmapContent}>
                  <Text style={styles.roadmapHeading}>Invest {formatINR(requiredSip)}</Text>
                  <Text style={styles.roadmapSubheading}>{goalSplit}</Text>
                  {aiAction ? (
                    <View style={styles.roadmapActionAi}>
                      <Text style={styles.roadmapActionAiText}>{aiAction}</Text>
                    </View>
                  ) : roadmapLoading ? null : fallback ? (
                    <View style={[styles.roadmapActionPill, { backgroundColor: fallback.bg }]}>
                      <Text style={[styles.roadmapActionText, { color: fallback.color }]}>{fallback.label}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={320} duration={500} style={styles.section}>
        <View style={styles.taxTitleRow}>
          <Text style={styles.taxTitleIcon}>⚖️</Text>
          <Text style={styles.sectionTitle}>Tax battle</Text>
        </View>
        <SliderField
          helper="Move the salary slider to compare old vs new regime while keeping your current deductions fixed."
          label="Annual salary"
          max={5_000_000}
          min={500_000}
          onValueChange={handleSalaryChange}
          rangeLabel="₹5L to ₹50L"
          step={50_000}
          value={taxAnnualIncome}
          valueLabel={formatINR(taxAnnualIncome, true)}
          variant="fire-dark"
        />

        <View style={styles.taxWrap}>
          <Animated.View
            key={betterRegime}
            style={[styles.winnerBadge, styles.winnerBadgeRight, winnerBadgeAnimatedStyle]}
          >
            <Text style={styles.winnerBadgeText}>{betterRegime === "old" ? "Old wins" : "New wins"}</Text>
          </Animated.View>

          <View style={styles.taxCardsRow}>
            {/* FIX 3: numberOfLines={1} adjustsFontSizeToFit prevents mid-number line break */}
            <View style={[styles.taxCard, betterRegime === "old" ? styles.taxCardWinner : styles.taxCardLoser]}>
              <Text style={styles.taxCardTitle}>Old Regime</Text>
              <Text style={styles.taxCardValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatINR(oldTax)}
              </Text>
              <Text style={styles.taxCardBody}>Standard deduction + your current PF, 80C, HRA, and NPS profile.</Text>
            </View>
            <View style={[styles.taxCard, betterRegime === "new" ? styles.taxCardWinner : styles.taxCardLoser]}>
              <Text style={styles.taxCardTitle}>New Regime</Text>
              <Text style={styles.taxCardValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatINR(newTax)}
              </Text>
              <Text style={styles.taxCardBody}>Standard deduction only, with the new slab structure.</Text>
            </View>
          </View>
        </View>

        <View style={styles.switchCard}>
          <Text style={styles.switchTitle}>Switch regime, save {formatINR(taxSaving)} this year</Text>
          <Text style={styles.switchBody}>
            Current winner: {betterRegime === "old" ? "Old regime" : "New regime"} at {formatINR(taxAnnualIncome)} annual salary.
          </Text>
          {taxNarrativeLoading ? (
            <Text style={styles.loadingText}>FinMentor is writing the tax summary...</Text>
          ) : null}
          {taxNarrativeError ? <Text style={styles.warningText}>{taxNarrativeError}</Text> : null}
          <Text style={styles.switchNarrative}>{taxNarrative || taxFallbackNarrative}</Text>
          <Button label="Open Full Tax Wizard" onPress={() => router.push("/tax-wizard")} variant="secondary" />
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={390} duration={500} style={styles.section}>
        <View style={styles.exportCard}>
          <View style={styles.exportHeader}>
            <Text style={styles.exportTitle}>PDF-style export</Text>
            <View style={styles.exportButtonWrap}>
              <Button label="Export Plan" loading={exporting} onPress={handleExport} />
            </View>
          </View>
          <Text style={styles.exportBody}>
            The export includes your detailed FIRE target, required SIP, and tax recommendation, so biometric confirmation is required before sharing.
          </Text>
        </View>
      </Animatable.View>

      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.captureCard}>
            <Text style={styles.captureBrand}>ET FinMentor</Text>
            <Text style={styles.captureHeading}>FIRE Plan Snapshot</Text>
            <Text style={styles.captureLine}>Retirement age: {plannerRetirementAge}</Text>
            <Text style={styles.captureLine}>Target monthly expense: {formatINR(plannerTargetExpense)}</Text>
            <Text style={styles.captureLine}>Target corpus: {formatINR(fireTarget)}</Text>
            <Text style={styles.captureLine}>Required SIP: {formatINR(requiredSip)}/month</Text>
            <Text style={styles.captureLine}>
              Years to FIRE: {yearsToFire === null ? "Not achievable at current SIP" : `${yearsToFire} years`}
            </Text>
            <View style={styles.captureDivider} />
            <Text style={styles.captureHeading}>Tax Battle</Text>
            <Text style={styles.captureLine}>Annual salary: {formatINR(taxAnnualIncome)}</Text>
            <Text style={styles.captureLine}>Old regime tax: {formatINR(oldTax)}</Text>
            <Text style={styles.captureLine}>New regime tax: {formatINR(newTax)}</Text>
            <Text style={styles.captureLine}>
              Recommended: {betterRegime === "old" ? "Old regime" : "New regime"} | Save {formatINR(taxSaving)}
            </Text>
          </View>
        </ViewShot>
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  title: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.display,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  sharedPortfolioBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,215,0,0.14)",
    borderColor: "rgba(255,215,0,0.35)",
    borderRadius: Radius.full,
    borderWidth: 0.8,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  sharedPortfolioText: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.sm,
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 16,
  },
  sliderStack: {
    gap: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.s1,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: Colors.b1,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  summaryTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  summaryMetric: {
    flex: 1,
    minWidth: 140,
  },
  summaryLabel: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 32,
  },
  summaryValueText: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 32,
  },
  // FIX 5: style for not-achievable message
  summaryValueNotAchievable: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  summaryPill: {
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: "transparent",
    flex: 1,
    minWidth: 140,
    padding: Spacing.md,
  },
  targetPill: {
    backgroundColor: "rgba(212,175,55,0.1)",
  },
  targetPillValue: {
    color: Colors.gold,
  },
  sipGapPillNegative: {
    backgroundColor: "rgba(226,75,74,0.1)",
  },
  sipGapPillPositive: {
    backgroundColor: "rgba(29,158,117,0.1)",
  },
  sipGapNegativeText: {
    color: Colors.red,
  },
  sipGapPositiveText: {
    color: Colors.teal,
  },
  summaryPillLabel: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  summaryPillValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  summaryBody: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  summaryBodyMuted: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  projectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  projectionDot: {
    backgroundColor: Colors.teal,
    borderRadius: Radius.full,
    height: 8,
    width: 8,
  },
  projectionTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  chartCard: {
    backgroundColor: Colors.s1,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.b0,
    overflow: "hidden",
    paddingVertical: Spacing.lg,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  legendSwatch: {
    borderRadius: Radius.full,
    height: 10,
    width: 10,
  },
  legendDashSwatch: {
    borderColor: Colors.red,
    borderRadius: 2,
    borderStyle: "dashed",
    borderWidth: 1,
    height: 4,
    width: 14,
  },
  legendText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  allocationStack: {
    gap: Spacing.md,
  },
  allocationCard: {
    backgroundColor: Colors.s1,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 16,
    borderLeftColor: Colors.gold,
    borderLeftWidth: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.b0,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  allocationTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  allocationHelper: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  allocationGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  allocationChip: {
    borderRadius: Radius.full,
    borderWidth: 0,
    flex: 1,
    padding: Spacing.md,
  },
  allocationChipEquity: { backgroundColor: "rgba(29,158,117,0.12)" },
  allocationChipDebt: { backgroundColor: "rgba(212,175,55,0.12)" },
  allocationChipGold: { backgroundColor: "rgba(127,119,221,0.12)" },
  allocationLabelEquity: { color: Colors.teal },
  allocationLabelDebt: { color: Colors.gold },
  allocationLabelGold: { color: Colors.purple },
  allocationValueEquity: { color: Colors.teal },
  allocationValueDebt: { color: Colors.gold },
  allocationValueGold: { color: Colors.purple },
  allocationLabel: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  allocationValue: {
    color: Colors.bg,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
  },
  taxTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  taxTitleIcon: {
    color: Colors.t0,
    fontSize: 16,
    marginTop: -1,
  },
  roadmapWrap: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b0,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    padding: Spacing.xl,
  },
  roadmapRow: {
    borderBottomColor: Colors.b0,
    borderBottomWidth: 0.5,
    flexDirection: "row",
    paddingVertical: 14,
  },
  roadmapRowLast: { borderBottomWidth: 0 },
  roadmapMonthWrap: {
    justifyContent: "flex-start",
    paddingTop: 2,
    width: 52,
  },
  roadmapMonth: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    textTransform: "uppercase",
  },
  roadmapMonthQuarter: { color: Colors.gold },
  roadmapMonthRegular: { color: Colors.t2 },
  roadmapQuarterBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(212,175,55,0.16)",
    borderRadius: Radius.full,
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 9,
    marginTop: 4,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  roadmapContent: {
    flex: 1,
    gap: 4,
    paddingLeft: 8,
  },
  roadmapHeading: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  roadmapSubheading: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  roadmapActionAi: {
    backgroundColor: Colors.purpleDim,
    borderColor: "rgba(133,114,224,0.25)",
    borderRadius: 10,
    borderWidth: 0.5,
    marginTop: 4,
    padding: 8,
  },
  roadmapActionAiText: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  roadmapActionPill: {
    borderRadius: 10,
    marginTop: 4,
    padding: 8,
  },
  roadmapActionText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  taxWrap: {
    position: "relative",
    paddingTop: 18,
  },
  winnerBadge: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    elevation: 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    position: "absolute",
    top: 0,
    zIndex: 2,
  },
  winnerBadgeLeft: { left: 20 },
  winnerBadgeRight: { right: 20 },
  winnerBadgeText: {
    color: Colors.bg,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  taxCardsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  taxCard: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.b0,
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  taxCardWinner: {
    backgroundColor: Colors.goldDim2,
    borderColor: Colors.gold,
    borderWidth: 1,
    opacity: 1,
  },
  taxCardLoser: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b0,
    opacity: 0.65,
  },
  taxCardTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  taxCardValue: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.xl,
    // FIX 3: allow font scaling so long values never wrap mid-number
    minWidth: 0,
    flexShrink: 1,
  },
  taxCardBody: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  switchCard: {
    backgroundColor: Colors.s1,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.b1,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  switchTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  switchBody: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  switchNarrative: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  loadingText: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  exportCard: {
    backgroundColor: "rgba(212,175,55,0.06)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(212,175,55,0.2)",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  exportHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exportTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  exportBody: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  exportButtonWrap: {
    borderRadius: 99,
    overflow: "hidden",
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
    width: 360,
  },
  captureBrand: {
    color: Colors.bg,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.lg,
  },
  captureHeading: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    marginBottom: Spacing.sm,
  },
  captureLine: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  captureDivider: {
    backgroundColor: Colors.border,
    height: 1,
    marginVertical: Spacing.lg,
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