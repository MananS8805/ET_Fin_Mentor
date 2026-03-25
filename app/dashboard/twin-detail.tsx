import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Animatable from "react-native-animatable";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import {
  formatINR,
  getFireCorpusTarget,
  getFutureProjectionPoints,
  getFutureYouFallbackNarrative,
  getMonthlyPassiveIncome,
  projectedCorpusForScenario,
  estimateFireAge,
} from "../../src/core/models/UserProfile";
import { GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

// ─── helpers ──────────────────────────────────────────────────────────────────

function yFmt(v: number): string {
  if (v >= 10_000_000) return (v / 10_000_000).toFixed(1) + "Cr";
  if (v >= 100_000)    return (v / 100_000).toFixed(1) + "L";
  if (v >= 1_000)      return (v / 1_000).toFixed(0) + "K";
  return v === 0 ? "0" : String(Math.round(v));
}

function scenarioColor(key: string): string {
  switch (key) {
    case "today":      return Colors.blue;
    case "optimised":  return Colors.teal;
    case "aggressive": return Colors.gold;
    case "debtfree":   return Colors.purple;
    default:           return Colors.t2;
  }
}

// ─── bar chart ────────────────────────────────────────────────────────────────

function TwinBarChart({
  data,
  fireTarget,
  color,
  width,
}: {
  data:        Array<{ age: number; corpus: number; highlighted: boolean }>;
  fireTarget:  number;
  color:       string;
  width:       number;
}) {
  if (data.length === 0) return null;

  const svgW  = width;
  const svgH  = 220;
  const padL  = 50;
  const padR  = 16;
  const padT  = 12;
  const padB  = 36;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const dataMax = Math.max(...data.map((d) => d.corpus));
  const yMax    = dataMax * 1.15;
  const barW    = (plotW / data.length) * 0.55;

  const xPos  = (i: number) => padL + (i + 0.5) * (plotW / data.length);
  const yPos  = (v: number) => padT + plotH - (v / yMax) * plotH;

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));
  const fireY  = yPos(fireTarget);
  const showFireLine = fireTarget > 0 && fireY >= padT && fireY <= padT + plotH;

  return (
    <Svg width={svgW} height={svgH}>
      {yTicks.map((tick) => {
        const y = yPos(tick);
        return (
          <React.Fragment key={"y-" + tick}>
            <Line x1={padL} y1={y} x2={svgW - padR} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
            <SvgText x={padL - 6} y={y + 4} textAnchor="end"
              fill="rgba(255,255,255,0.35)" fontSize={9}>
              {yFmt(tick)}
            </SvgText>
          </React.Fragment>
        );
      })}
      {showFireLine ? (
        <Line x1={padL} y1={fireY} x2={svgW - padR} y2={fireY}
          stroke="#DC4E4E" strokeWidth={1.5} strokeDasharray="6,4" opacity={0.7} />
      ) : null}
      {data.map((d, i) => {
        const x   = xPos(i) - barW / 2;
        const top = yPos(d.corpus);
        const h   = Math.max(padT + plotH - top, 2);
        return (
          <Rect key={"bar-" + d.age} x={x} y={top} width={barW} height={h}
            fill={d.highlighted ? color : color + "55"} rx={3} />
        );
      })}
      <Line x1={padL} y1={padT + plotH} x2={svgW - padR} y2={padT + plotH}
        stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
      {data.map((d, i) => (
        <SvgText key={"x-" + d.age} x={xPos(i)} y={svgH - 8}
          textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={10}>
          {String(d.age)}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── animated stat ────────────────────────────────────────────────────────────

function AnimatedStat({ label, value, delay = 0, color }: { label: string; value: string; delay?: number; color: string }) {
  const opacity = useSharedValue(0);
  const y       = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
    y.value       = withDelay(delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, [delay, opacity, y]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }] }));

  return (
    <Animated.View style={[styles.statCard, style]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function TwinDetailScreen() {
  const params  = useLocalSearchParams<{
    key:          string;
    label:        string;
    sipMultiplier:string;
    cagr:         string;
    extraMonthly: string;
  }>();
  const insets  = useSafeAreaInsets();
  const profile = useAppStore((s) => s.currentProfile);

  const [narrative,        setNarrative]        = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError,   setNarrativeError]   = useState("");

  const key           = params.key ?? "today";
  const label         = params.label ?? "You Today";
  const sipMultiplier = parseFloat(params.sipMultiplier ?? "1");
  const cagr          = parseFloat(params.cagr ?? "0.12");
  const extraMonthly  = parseFloat(params.extraMonthly ?? "0");
  const color         = scenarioColor(key);

  const retirementAge  = profile?.retirementAge ?? 60;
  const selectedAge    = retirementAge;

  const projectedCorpus = useMemo(() => {
    if (!profile) return 0;
    // for debt-free scenario, add redirected EMI to SIP
    const effectiveProfile = extraMonthly > 0
      ? { ...profile, monthlySIP: profile.monthlySIP + extraMonthly }
      : profile;
    return projectedCorpusForScenario(effectiveProfile, selectedAge, sipMultiplier, cagr);
  }, [profile, selectedAge, sipMultiplier, cagr, extraMonthly]);

  const fireTarget    = useMemo(() => profile ? getFireCorpusTarget(profile) : 0, [profile]);
  const passiveIncome = useMemo(() => getMonthlyPassiveIncome(projectedCorpus), [projectedCorpus]);
  const fireAchieved  = fireTarget > 0 && projectedCorpus >= fireTarget;
  const fireGap       = Math.max(0, fireTarget - projectedCorpus);

  const fireAge = useMemo(() => {
    if (!profile) return null;
    const effectiveProfile = extraMonthly > 0
      ? { ...profile, monthlySIP: profile.monthlySIP + extraMonthly }
      : profile;
    return estimateFireAge(effectiveProfile, fireTarget, cagr);
  }, [profile, fireTarget, cagr, extraMonthly]);

  const chartData = useMemo(() => {
    if (!profile) return [];
    const effectiveProfile = extraMonthly > 0
      ? { ...profile, monthlySIP: profile.monthlySIP + extraMonthly }
      : profile;
    return getFutureProjectionPoints(effectiveProfile, selectedAge, sipMultiplier, cagr);
  }, [profile, selectedAge, sipMultiplier, cagr, extraMonthly]);

  const chartWidth = 340;

  // load narrative on mount
  useEffect(() => {
    if (!profile) return;
    const safeProfile = profile;
    let active = true;

    void (async () => {
      try {
        setNarrativeLoading(true);
        setNarrativeError("");
        const result = await GeminiService.getFutureYouNarrative(safeProfile, {
          targetAge: selectedAge,
          sipMultiplier,
          cagr,
          projectedCorpus,
          fireTarget,
        });
        if (active) setNarrative(result);
      } catch {
        if (active) {
          setNarrative(getFutureYouFallbackNarrative(safeProfile, selectedAge, projectedCorpus, fireTarget, sipMultiplier, cagr));
          setNarrativeError("Showing offline narrative.");
        }
      } finally {
        if (active) setNarrativeLoading(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const corpusText  = formatINR(projectedCorpus, true);
  const incomeText  = formatINR(passiveIncome) + "/mo";
  const fireAgeText = fireAge !== null ? "Age " + fireAge : "Beyond 75";
  const gapText     = fireAchieved ? "Achieved" : "-" + formatINR(fireGap, true);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── header ── */}
      <Animatable.View animation="fadeInDown" duration={400} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backLabel}>Future You</Text>
        </TouchableOpacity>
        <View style={[styles.scenarioBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
          <Text style={[styles.scenarioBadgeText, { color }]}>{label}</Text>
        </View>
      </Animatable.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── hero corpus ── */}
        <Animatable.View animation="fadeInUp" delay={50} duration={500}>
          <View style={[styles.heroCard, { borderColor: color + "33" }]}>
            <Text style={styles.heroLabel}>Corpus at retirement</Text>
            <Text style={[styles.heroValue, { color }]}>{corpusText}</Text>
            <View style={[styles.statusBadge, {
              backgroundColor: fireAchieved ? Colors.tealDim : Colors.amberDim,
              borderColor: fireAchieved ? Colors.teal + "44" : Colors.amber + "44",
            }]}>
              <Text style={[styles.statusText, { color: fireAchieved ? Colors.teal : Colors.amber }]}>
                {fireAchieved ? "FIRE achieved ✓" : "Building towards FIRE"}
              </Text>
            </View>
          </View>
        </Animatable.View>

        {/* ── stat row ── */}
        <View style={styles.statRow}>
          <AnimatedStat label="Passive income" value={incomeText}  delay={100} color={color} />
          <AnimatedStat label="FIRE age"        value={fireAgeText} delay={150} color={color} />
          <AnimatedStat label="Gap to FIRE"     value={gapText}     delay={200} color={color} />
        </View>

        {/* ── projection chart ── */}
        <Animatable.View animation="fadeInUp" delay={250} duration={500}>
          <Text style={styles.sectionTitle}>Projection curve</Text>
          <View style={styles.chartCard}>
            <Text style={styles.chartNote}>
              Bars show corpus at each age checkpoint. Red line is your FIRE target.
            </Text>
            <TwinBarChart
              data={chartData}
              fireTarget={fireTarget}
              color={color}
              width={chartWidth}
            />
          </View>
        </Animatable.View>

        {/* ── scenario assumptions ── */}
        <Animatable.View animation="fadeInUp" delay={300} duration={500}>
          <Text style={styles.sectionTitle}>Scenario assumptions</Text>
          <View style={styles.assumptionsCard}>
            <View style={styles.assumptionRow}>
              <Text style={styles.assumptionLabel}>SIP multiplier</Text>
              <Text style={[styles.assumptionValue, { color }]}>{sipMultiplier.toFixed(1)}x</Text>
            </View>
            <View style={styles.assumptionDivider} />
            <View style={styles.assumptionRow}>
              <Text style={styles.assumptionLabel}>Expected CAGR</Text>
              <Text style={[styles.assumptionValue, { color }]}>{(cagr * 100).toFixed(0)}%</Text>
            </View>
            {extraMonthly > 0 ? (
              <>
                <View style={styles.assumptionDivider} />
                <View style={styles.assumptionRow}>
                  <Text style={styles.assumptionLabel}>EMI redirected to SIP</Text>
                  <Text style={[styles.assumptionValue, { color }]}>{formatINR(extraMonthly)}/mo</Text>
                </View>
              </>
            ) : null}
            <View style={styles.assumptionDivider} />
            <View style={styles.assumptionRow}>
              <Text style={styles.assumptionLabel}>Retirement age</Text>
              <Text style={[styles.assumptionValue, { color }]}>{selectedAge}</Text>
            </View>
          </View>
        </Animatable.View>

        {/* ── AI narrative ── */}
        <Animatable.View animation="fadeInUp" delay={350} duration={500}>
          <Text style={styles.sectionTitle}>AI narrative</Text>
          <View style={[styles.narrativeCard, { borderColor: color + "33" }]}>
            <View style={[styles.aiBadge, { backgroundColor: color + "22" }]}>
              <Text style={[styles.aiBadgeText, { color }]}>AI · {label}</Text>
            </View>
            {narrativeLoading ? (
              <Text style={[styles.narrativeLoading, { color }]}>FinMentor is writing your twin note...</Text>
            ) : null}
            {narrativeError ? (
              <Text style={styles.narrativeError}>{narrativeError}</Text>
            ) : null}
            <Text style={styles.narrativeText}>{narrative}</Text>
          </View>
        </Animatable.View>

      </ScrollView>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: Colors.b0,
  },
  backBtn:   { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  backIcon:  { color: Colors.t0, fontSize: 20 },
  backLabel: { color: Colors.t1, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm },
  scenarioBadge: {
    borderRadius: Radius.full, borderWidth: 0.5,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
  },
  scenarioBadgeText: { fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs },

  heroCard: {
    backgroundColor: Colors.s1, borderRadius: Radius.lg,
    borderWidth: 0.5, padding: Spacing.xl, gap: Spacing.md,
  },
  heroLabel: { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, textTransform: "uppercase", letterSpacing: 0.8 },
  heroValue: { fontFamily: Typography.fontFamily.numeric, fontSize: 44, letterSpacing: -1 },
  statusBadge: { alignSelf: "flex-start", borderRadius: Radius.full, borderWidth: 0.5, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  statusText: { fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs },

  statRow:  { flexDirection: "row", gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.s1, borderColor: Colors.b0, borderWidth: 0.5, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  statValue:{ fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.lg },
  statLabel:{ color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: 10 },

  sectionTitle: { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.md },
  chartCard:    { backgroundColor: Colors.s1, borderColor: Colors.b0, borderRadius: Radius.lg, borderWidth: 0.5, overflow: "hidden", paddingVertical: Spacing.md },
  chartNote:    { color: "rgba(255,255,255,0.3)", fontFamily: Typography.fontFamily.body, fontSize: 11, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },

  assumptionsCard:   { backgroundColor: Colors.s1, borderColor: Colors.b0, borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.md },
  assumptionRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.sm },
  assumptionLabel:   { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm },
  assumptionValue:   { fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.sm },
  assumptionDivider: { height: 0.5, backgroundColor: Colors.b0 },

  narrativeCard:    { backgroundColor: Colors.s1, borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.lg, gap: Spacing.sm },
  aiBadge:          { alignSelf: "flex-start", borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  aiBadgeText:      { fontFamily: Typography.fontFamily.bodyMedium, fontSize: 11 },
  narrativeLoading: { fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm },
  narrativeError:   { color: Colors.red, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs },
  narrativeText:    { color: "rgba(255,255,255,0.8)", fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm, lineHeight: 22 },
});