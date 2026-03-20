import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine, VictoryTheme } from "victory-native";

import { AnimatedCurrencyValue } from "../../src/components/AnimatedCurrencyValue";
import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { SliderField } from "../../src/components/SliderField";
import { AuthService } from "../../src/core/services/AuthService";
import {
  AssetAllocationStage,
  GoalSIPAllocation,
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
import { GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        {/* Removed Day 6 */}
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

function AllocationCard({ item }: { item: AssetAllocationStage }) {
  return (
    <View style={styles.allocationCard}>
      <Text style={styles.allocationTitle}>{item.label}</Text>
      <Text style={styles.allocationHelper}>{item.helper}</Text>
      <View style={styles.allocationGrid}>
        <View style={styles.allocationChip}>
          <Text style={styles.allocationLabel}>Equity</Text>
          <Text style={styles.allocationValue}>{item.equity}%</Text>
        </View>
        <View style={styles.allocationChip}>
          <Text style={styles.allocationLabel}>Debt</Text>
          <Text style={styles.allocationValue}>{item.debt}%</Text>
        </View>
        <View style={styles.allocationChip}>
          <Text style={styles.allocationLabel}>Gold</Text>
          <Text style={styles.allocationValue}>{item.gold}%</Text>
        </View>
      </View>
    </View>
  );
}

function buildTaxFallbackNarrative(
  annualIncome: number,
  betterRegime: "old" | "new",
  taxSaving: number,
  oldTax: number,
  newTax: number
) {
  if (taxSaving < 5_000) {
    return `At ${formatINR(
      annualIncome
    )}, both regimes are almost neck and neck with your current deduction profile. A small change in deductions could flip the winner, so review before you lock it in.`;
  }

  return `At ${formatINR(annualIncome)}, the ${betterRegime} regime is ahead by about ${formatINR(
    taxSaving
  )} this year. Old regime tax is ${formatINR(oldTax)} and new regime tax is ${formatINR(
    newTax
  )}, assuming your current PF, 80C, and NPS inputs stay the same.`;
}

export default function FirePlannerTab() {
  const profile = useAppStore((state) => state.currentProfile);
  const shareCardRef = useRef<ViewShot | null>(null);
  const { width } = useWindowDimensions();

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
  const defaultRetirementAge = currentProfile
    ? Math.max(minRetirementAge, Math.min(maxRetirementAge, currentProfile.retirementAge || minRetirementAge))
    : 55;
  const defaultTargetExpense = currentProfile
    ? Math.max(20_000, Math.round((currentProfile.targetMonthlyExpenseRetirement || currentProfile.monthlyExpenses) / 5_000) * 5_000)
    : 50_000;
  const defaultAnnualIncome = currentProfile
    ? Math.max(500_000, Math.round(((currentProfile.annualIncome || currentProfile.monthlyIncome * 12) as number) / 50_000) * 50_000)
    : 500_000;

  const plannerRetirementAge = retirementAge || defaultRetirementAge;
  const plannerTargetExpense = targetExpense || defaultTargetExpense;
  const taxAnnualIncome = salaryAnnual || defaultAnnualIncome;

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

    setRetirementAge(defaultRetirementAge);
    setTargetExpense(defaultTargetExpense);
    setSalaryAnnual(defaultAnnualIncome);
  }, [currentProfile?.id, defaultAnnualIncome, defaultRetirementAge, defaultTargetExpense]);

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
  const fireTarget = useMemo(() => (plannerProfile ? getFireCorpusTarget(plannerProfile) : 0), [plannerProfile]);
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
    () => (plannerProfile ? getFireProjectionSeries(plannerProfile, plannerRetirementAge, plannerTargetExpense) : []),
    [plannerProfile, plannerRetirementAge, plannerTargetExpense]
  );

  const goalBreakdown = useMemo(
    () => (currentProfile ? getSIPAllocationByGoal(currentProfile) : []),
    [currentProfile]
  );
  const chartWidth = Math.max(320, width - Spacing["3xl"]);

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
  const taxSaving = useMemo(() => (taxScenarioProfile ? getTaxSaving(taxScenarioProfile) : 0), [taxScenarioProfile]);
  const taxFallbackNarrative = useMemo(
    () => buildTaxFallbackNarrative(taxAnnualIncome, betterRegime, taxSaving, oldTax, newTax),
    [betterRegime, newTax, oldTax, taxAnnualIncome, taxSaving]
  );

  

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

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

          if (active) {
            setTaxNarrative(nextNarrative);
          }
        } catch (error) {
          if (active) {
            setTaxNarrative(taxFallbackNarrative);
            setTaxNarrativeError(error instanceof Error ? error.message : "Showing offline tax summary for now.");
          }
        } finally {
          if (active) {
            setTaxNarrativeLoading(false);
          }
        }
      })();
    }, 700);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [betterRegime, currentProfile, newTax, oldTax, taxAnnualIncome, taxFallbackNarrative, taxSaving]);

  if (!currentProfile || !plannerProfile) {
    return <EmptyState />;
  }

  async function handleExport() {
    try {
      setExporting(true);

      const canUseBiometric = await AuthService.canUseBiometric();

      if (!canUseBiometric) {
        throw new Error("Biometric authentication is not available on this device.");
      }

      const verified = await AuthService.promptBiometric("Confirm before exporting your FIRE plan");

      if (!verified) {
        return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      const uri = await shareCardRef.current?.capture?.();

      if (!uri) {
        throw new Error("Unable to generate the plan export.");
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: "Export your ET FinMentor FIRE plan",
      });
    } catch (error) {
      Alert.alert("Unable to export plan", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen scroll>
      <Animatable.View animation="fadeInUp" duration={500} style={styles.hero}>
        {/* Removed Day 6 */}
        <Text style={styles.title}>FIRE Planner + Tax Battle</Text>
        <Text style={styles.subtitle}>
          Tune your retirement age and lifestyle target, then compare tax regimes live against the same deduction base.
        </Text>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={80} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>FIRE inputs</Text>
        <View style={styles.sliderStack}>
          <SliderField
            helper="Choose when you want work to become optional."
            label="Retirement age"
            max={maxRetirementAge}
            min={minRetirementAge}
            onValueChange={setRetirementAge}
            rangeLabel={`${minRetirementAge} to ${maxRetirementAge} years`}
            value={plannerRetirementAge}
            valueLabel={`${plannerRetirementAge} years`}
          />
          <SliderField
            helper="Your expected monthly living cost in retirement, in today's rupees."
            label="Target monthly expense"
            max={300_000}
            min={20_000}
            onValueChange={setTargetExpense}
            rangeLabel="₹20K to ₹3L"
            step={5_000}
            value={plannerTargetExpense}
            valueLabel={formatINR(plannerTargetExpense, true)}
          />
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={130} duration={500} style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Required SIP</Text>
            <AnimatedCurrencyValue style={styles.summaryValue} value={requiredSip} />
          </View>
          <View style={styles.summaryMetric}>
            <Text style={styles.summaryLabel}>Years to FIRE</Text>
            <Text style={styles.summaryValueText}>
              {yearsToFire === null ? "75+ years" : `${yearsToFire} years`}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillLabel}>Target corpus</Text>
            <Text style={styles.summaryPillValue}>{formatINR(fireTarget, true)}</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillLabel}>Current SIP gap</Text>
            <Text style={styles.summaryPillValue}>{sipGap > 0 ? formatINR(sipGap) : "Ahead of plan"}</Text>
          </View>
        </View>

        <Text style={styles.summaryBody}>
          {projectionGap > 0
            ? `At your current SIP, the projected corpus at age ${plannerRetirementAge} is ${formatINR(
                projectedRetirementCorpus,
                true
              )}, leaving a gap of ${formatINR(projectionGap, true)}.`
            : `At your current SIP, the projected corpus at age ${plannerRetirementAge} is ${formatINR(
                projectedRetirementCorpus,
                true
              )}, which clears the target.`}
        </Text>
        <Text style={styles.summaryBodyMuted}>
          Time remaining: {yearsRemaining} years. Existing SIP: {formatINR(currentProfile.monthlySIP)}/month.
        </Text>
      </Animatable.View>
              
      <Animatable.View animation="fadeInUp" delay={190} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>Projection chart</Text>
        {goalBreakdown.length > 0 ? (
        <Animatable.View animation="fadeInUp" delay={160} duration={500} style={styles.section}>
          <Text style={styles.sectionTitle}>SIP by goal</Text>
          <View style={styles.allocationStack}>
            {goalBreakdown.map((item) => (
              <View key={item.goal} style={styles.allocationCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.allocationTitle} numberOfLines={1}>{item.goal}</Text>
                  <Text style={styles.allocationValue}>{formatINR(item.sipAmount)}/mo</Text>
                </View>
                <Text style={styles.allocationHelper}>
                  {item.horizonYears}yr horizon · target {formatINR(item.targetCorpus, true)}
                </Text>
              </View>
            ))}
          </View>
        </Animatable.View>
      ) : null}
        <View style={styles.chartCard}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.teal }]} />
              <Text style={styles.legendText}>Projected corpus</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: Colors.red }]} />
              <Text style={styles.legendText}>Target corpus</Text>
            </View>
          </View>
          <VictoryChart
            height={280}
            padding={{ top: 20, bottom: 42, left: 64, right: 20 }}
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
                  fontSize: 11,
                },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(value) => formatINR(value, true)}
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
              data={projectionSeries}
              interpolation="monotoneX"
              style={{ data: { stroke: Colors.teal, strokeWidth: 3 } }}
              x="age"
              y="projectedCorpus"
            />
            <VictoryLine
              data={projectionSeries}
              style={{ data: { stroke: Colors.red, strokeDasharray: "8,6", strokeWidth: 2 } }}
              x="age"
              y="targetCorpus"
            />
          </VictoryChart>
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={250} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>Asset allocation schedule</Text>
        <View style={styles.allocationStack}>
          {allocationSchedule.map((item) => (
            <AllocationCard item={item} key={item.label} />
          ))}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={280} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>12-Month Roadmap</Text>
        <View style={{ backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.xl }}>
          {[...Array(12)].map((_, i) => (
            <View key={i} style={{ flexDirection: "row", borderBottomWidth: i === 11 ? 0 : 0.5, borderBottomColor: Colors.border, paddingVertical: 12 }}>
              <View style={{ width: 64, justifyContent: "center" }}>
                <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 13, textTransform: "uppercase" }}>MTH {i + 1}</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={{ color: Colors.textPrimary, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 15 }}>
                  Invest {formatINR(requiredSip)}
                </Text>
                <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.body, fontSize: 13, marginTop: 2 }}>
                  Split across {goalBreakdown.length > 0 ? goalBreakdown.map(g => g.goal).join(", ") : "Index Funds & Debt"}
                </Text>
                {i === 0 && sipGap > 0 && (
                  <View style={{ backgroundColor: "rgba(245,166,35,0.12)", padding: 8, borderRadius: 6, marginTop: 8 }}>
                    <Text style={{ color: Colors.gold, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 12 }}>
                      🚀 Action: Step up SIP by {formatINR(sipGap)} to close your trajectory gap.
                    </Text>
                  </View>
                )}
                {i === 3 && (
                  <View style={{ backgroundColor: "rgba(29,158,117,0.12)", padding: 8, borderRadius: 6, marginTop: 8 }}>
                    <Text style={{ color: Colors.teal, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 12 }}>
                      ⚖️ Action: Rebalance equity to match {allocationSchedule[0]?.equity || 70}%.
                    </Text>
                  </View>
                )}
                {i === 6 && (
                  <View style={{ backgroundColor: "rgba(127,119,221,0.12)", padding: 8, borderRadius: 6, marginTop: 8 }}>
                    <Text style={{ color: Colors.purple, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 12 }}>
                      💼 Action: Evaluate corporate bonus and lump-sum into FIRE corpus.
                    </Text>
                  </View>
                )}
                {i === 11 && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.06)", padding: 8, borderRadius: 6, marginTop: 8 }}>
                    <Text style={{ color: Colors.textSecondary, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 12 }}>
                      🛡️ Action: Annual review of Term Insurance & Emergency Fund limits.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={320} duration={500} style={styles.section}>
        <Text style={styles.sectionTitle}>Tax battle</Text>
        <SliderField
          helper="Move the salary slider to compare old vs new regime while keeping your current deductions fixed."
          label="Annual salary"
          max={5_000_000}
          min={500_000}
          onValueChange={setSalaryAnnual}
          rangeLabel="₹5L to ₹50L"
          step={50_000}
          value={taxAnnualIncome}
          valueLabel={formatINR(taxAnnualIncome, true)}
        />

        <View style={styles.taxWrap}>
          <Animatable.View
            animation="bounceIn"
            duration={380}
            key={betterRegime}
            style={[styles.winnerBadge, betterRegime === "old" ? styles.winnerBadgeLeft : styles.winnerBadgeRight]}
          >
            <Text style={styles.winnerBadgeText}>{betterRegime === "old" ? "Old wins" : "New wins"}</Text>
          </Animatable.View>

          <View style={styles.taxCardsRow}>
            <View style={[styles.taxCard, betterRegime === "old" ? styles.taxCardWinner : null]}>
              <Text style={styles.taxCardTitle}>Old Regime</Text>
              <Text style={styles.taxCardValue}>{formatINR(oldTax)}</Text>
              <Text style={styles.taxCardBody}>Standard deduction + your current PF, 80C, and NPS profile.</Text>
            </View>
            <View style={[styles.taxCard, betterRegime === "new" ? styles.taxCardWinner : null]}>
              <Text style={styles.taxCardTitle}>New Regime</Text>
              <Text style={styles.taxCardValue}>{formatINR(newTax)}</Text>
              <Text style={styles.taxCardBody}>Standard deduction only, with the new slab structure.</Text>
            </View>
          </View>
        </View>

        <View style={styles.switchCard}>
          <Text style={styles.switchTitle}>Switch regime, save {formatINR(taxSaving)} this year</Text>
          <Text style={styles.switchBody}>
            Current winner: {betterRegime === "old" ? "Old regime" : "New regime"} at {formatINR(taxAnnualIncome)} annual
            salary.
          </Text>
          {taxNarrativeLoading ? <Text style={styles.loadingText}>FinMentor is writing the tax summary...</Text> : null}
          {taxNarrativeError ? <Text style={styles.warningText}>{taxNarrativeError}</Text> : null}
          <Text style={styles.switchNarrative}>{taxNarrative || taxFallbackNarrative}</Text>
          <Button label="Open Full Tax Wizard" onPress={() => router.push("/tax-wizard" as never)} variant="secondary" />
        </View>
      </Animatable.View>

      <Animatable.View animation="fadeInUp" delay={390} duration={500} style={styles.section}>
        <View style={styles.exportCard}>
          <View style={styles.exportHeader}>
            <Text style={styles.exportTitle}>PDF-style export</Text>
            <Button label="Export Plan" loading={exporting} onPress={() => void handleExport()} />
          </View>
          <Text style={styles.exportBody}>
            The export includes your detailed FIRE target, required SIP, and tax recommendation, so biometric
            confirmation is required before sharing.
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
              Years to FIRE: {yearsToFire === null ? "Beyond 75 at current SIP" : `${yearsToFire} years`}
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
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  sliderStack: {
    gap: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(12,35,64,0.14)",
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
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.sm,
  },
  summaryValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size["2xl"],
  },
  summaryValueText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size["2xl"],
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  summaryPill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    flex: 1,
    minWidth: 140,
    padding: Spacing.md,
  },
  summaryPillLabel: {
    color: "rgba(255,255,255,0.68)",
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
    color: "rgba(255,255,255,0.84)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  summaryBodyMuted: {
    color: "rgba(255,255,255,0.66)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: "hidden",
    paddingVertical: Spacing.lg,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
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
  legendText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  allocationStack: {
    gap: Spacing.md,
  },
  allocationCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  allocationTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  allocationHelper: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  allocationGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  allocationChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flex: 1,
    padding: Spacing.md,
  },
  allocationLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  allocationValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
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
  winnerBadgeLeft: {
    left: 20,
  },
  winnerBadgeRight: {
    right: 20,
  },
  winnerBadgeText: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  taxCardsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  taxCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  taxCardWinner: {
    borderColor: Colors.gold,
    backgroundColor: "#FFF8E8",
  },
  taxCardTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  taxCardValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
  },
  taxCardBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  switchCard: {
    backgroundColor: "#EEF5FF",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "#D8E4F5",
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  switchTitle: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  switchBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  switchNarrative: {
    color: Colors.textPrimary,
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
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  exportHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exportTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  exportBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
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
    color: Colors.navy,
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
