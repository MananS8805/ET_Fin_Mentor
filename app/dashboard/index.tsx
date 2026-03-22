import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import Animated from "react-native-reanimated";

import { LiquidProgressBar } from "../../src/components/LiquidProgressBar";
import { Screen } from "../../src/components/Screen";
import { TiltCard } from "../../src/components/TiltCard";
import {
  formatINR,
  getEmergencyFundMonths,
  getFireCorpusTarget,
  getOverallHealthScore,
  getSavingsRate,
} from "../../src/core/models/UserProfile";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Shadows, Spacing, Typography } from "../../src/core/theme";

// ─── types ───────────────────────────────────────────────────────────────────

type FocusArea = "portfolio" | "profile" | "health" | "momentum" | "modules";

type ModuleTile = {
  icon: string;
  key: string;
  subtitle: string;
  title: string;
  to: string;
};

// ─── constants ───────────────────────────────────────────────────────────────

const MODULES: ModuleTile[] = [
  {
    key: "portfolio",
    icon: "◎",
    title: "Portfolio X-Ray",
    subtitle: "Overlap and XIRR",
    to: "/portfolio-xray",
  },
  {
    key: "fire",
    icon: "↗",
    title: "FIRE Planner",
    subtitle: "Retirement simulator",
    to: "/dashboard/fire-planner",
  },
  {
    key: "tax",
    icon: "⊕",
    title: "Tax Wizard",
    subtitle: "Old vs new regime",
    to: "/tax-wizard",
  },
  {
    key: "future",
    icon: "◈",
    title: "Future You",
    subtitle: "Scenario mirror",
    to: "/dashboard/future-you",
  },
  {
    key: "couple",
    icon: "⊗",
    title: "Couple Planner",
    subtitle: "Joint strategy",
    to: "/couples-planner",
  },
  {
    key: "chat",
    icon: "◐",
    title: "Money Chat",
    subtitle: "Ask FinMentor AI",
    to: "/dashboard/chat",
  },
];

// ─── helpers ─────────────────────────────────────────────────────────────────

function focusText(isFocused: boolean) {
  return {
    fontFamily: isFocused
      ? Typography.fontFamily.displaySemiBold
      : Typography.fontFamily.bodyMedium,
  } as const;
}

function allocationColor(category: string): string {
  if (category === "large_cap") return Colors.gold;
  if (category === "mid_cap")   return Colors.teal;
  if (category === "small_cap") return Colors.purple;
  if (category === "elss")      return Colors.blue;
  if (category === "hybrid")    return Colors.amber;
  if (category === "debt")      return Colors.red;
  return Colors.t2;
}

// ─── screen ──────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const profile       = useAppStore((state) => state.currentProfile);
  const portfolioXRay = useAppStore((state) => state.portfolioXRay);
  const [focusArea, setFocusArea] = useState<FocusArea>("portfolio");

  const totalPortfolioValue = portfolioXRay?.totalValue ?? 0;
  const xirr            = portfolioXRay?.overallXIRR ?? null;
  const healthScore     = profile ? getOverallHealthScore(profile) : 0;
  const savingsRate     = profile ? getSavingsRate(profile) : 0;
  const emergencyMonths = profile ? getEmergencyFundMonths(profile) : 0;
  const fireTarget      = profile ? getFireCorpusTarget(profile) : 0;
  const corpusProgress  = fireTarget > 0 ? Math.min(totalPortfolioValue / fireTarget, 1) : 0;

  const firstName = profile?.name?.split(" ")[0] ?? "Investor";

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // build strings outside JSX — no concatenation inside Text nodes
  const greetingText    = greeting + ", " + firstName;
  const xirrText        = "XIRR: " + (xirr !== null ? xirr.toFixed(1) + "%" : "N/A");
  const savingsText     = "Savings: " + savingsRate.toFixed(0) + "%";
  const emergencyText   = "Emergency runway: " + emergencyMonths.toFixed(1) + " months";
  const riskText        = "Risk style: " + (profile?.riskProfile ?? "Balanced");
  const healthScoreText = healthScore.toFixed(0) + "/100";
  const fireBodyText    = fireTarget > 0
    ? formatINR(totalPortfolioValue, true) + " of " + formatINR(fireTarget, true) + " target corpus"
    : "Complete your profile to unlock FIRE target.";

  const hasPortfolio =
    portfolioXRay !== null && portfolioXRay.holdings.length > 0;

  const allocationSegments = portfolioXRay
    ? Object.entries(portfolioXRay.categoryAllocation).filter(([, v]) => v > 0)
    : [];

  return (
    <Screen scroll>

      {/* ── hero card ── */}
      <Animatable.View animation="fadeInUp" delay={0} duration={500}>
        <Pressable onPress={() => setFocusArea("portfolio")}>
          <View style={[styles.card, styles.heroCard]}>

            <Text style={[styles.heroGreeting, focusText(focusArea === "portfolio")]}>
              {greetingText}
            </Text>

            <Text style={styles.heroLabel}>
              Total portfolio value
            </Text>

            <Animated.View
              sharedTransitionTag="portfolio-shared-value"
              style={styles.portfolioSharedWrap}
            >
              <Text style={[styles.heroValue, focusText(focusArea === "portfolio")]}>
                {formatINR(totalPortfolioValue)}
              </Text>
            </Animated.View>

            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMetaText}>{xirrText}</Text>
              <Text style={styles.heroMetaText}>{savingsText}</Text>
            </View>

          </View>
        </Pressable>
      </Animatable.View>

      {/* ── profile snapshot + financial health stacked ── */}
      <View style={styles.bentoColumn}>

        <TiltCard
          onPress={() => {
            setFocusArea("profile");
            router.push("/profile-edit" as never);
          }}
          style={styles.bentoCell}
        >
          <Animatable.View animation="fadeInUp" delay={70} duration={500}>
            <View style={[styles.card, styles.tiltCard]}>
              <Text style={[styles.bentoHeading, focusText(focusArea === "profile")]}>
                Profile Snapshot
              </Text>
              <Text style={styles.bentoBody}>{emergencyText}</Text>
              <Text style={styles.bentoBody}>{riskText}</Text>
            </View>
          </Animatable.View>
        </TiltCard>

        <TiltCard
          onPress={() => {
            setFocusArea("health");
            router.push("/health-score" as never);
          }}
          style={styles.bentoCell}
        >
          <Animatable.View animation="fadeInUp" delay={120} duration={500}>
            <View style={[styles.card, styles.tiltCard]}>
              <Text style={[styles.bentoHeading, focusText(focusArea === "health")]}>
                Financial Health
              </Text>
              <Text style={styles.healthDial}>{healthScoreText}</Text>
              <Text style={styles.bentoBody}>
                Tap to improve weak dimensions
              </Text>
            </View>
          </Animatable.View>
        </TiltCard>

      </View>

      {/* ── momentum to FIRE ── */}
      <Animatable.View animation="fadeInUp" delay={180} duration={500}>
        <Pressable onPress={() => setFocusArea("momentum")}>
          <View style={[styles.card, styles.momentumCard]}>
            <Text style={[styles.bentoHeading, focusText(focusArea === "momentum")]}>
              Momentum To FIRE
            </Text>
            <LiquidProgressBar label="Corpus fill" progress={corpusProgress} />
            <Text style={styles.bentoBody}>{fireBodyText}</Text>
          </View>
        </Pressable>
      </Animatable.View>

      {/* ── asset allocation bar — only when portfolio data exists ── */}
      {hasPortfolio ? (
        <Animatable.View animation="fadeInUp" delay={210} duration={500}>
          <View style={[styles.card, styles.allocCard]}>
            <Text style={styles.bentoHeading}>Asset Allocation</Text>
            <View style={styles.allocBar}>
              {allocationSegments.map(([cat, val]) => (
                <View
                  key={cat}
                  style={[
                    styles.allocSegment,
                    { flex: val, backgroundColor: allocationColor(cat) },
                  ]}
                />
              ))}
            </View>
          </View>
        </Animatable.View>
      ) : null}

      {/* ── bento modules grid ── */}
      <Animatable.View animation="fadeInUp" delay={240} duration={500}>
        <Text style={[styles.sectionTitle, focusText(focusArea === "modules")]}>
          Bento Modules
        </Text>
        <View style={styles.moduleGrid}>
          {MODULES.map((mod) => (
            <Pressable
              key={mod.key}
              onPress={() => {
                setFocusArea("modules");
                router.push(mod.to as never);
              }}
              style={styles.moduleTile}
            >
              <Text style={styles.moduleIcon}>{mod.icon}</Text>
              <Text style={styles.moduleTitle}>{mod.title}</Text>
              <Text style={styles.moduleSubtitle}>{mod.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </Animatable.View>

      <View style={styles.bottomPad} />

    </Screen>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── card base ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.s1,
    borderColor:     Colors.b1,
    borderRadius:    Radius.lg,
    borderWidth:     0.5,
    padding:         Spacing.lg,
    ...Shadows.md,
  },

  // ── hero ───────────────────────────────────────────────────────────────────
  heroCard: {
    marginBottom: Spacing.lg,
    marginTop:    Spacing.md,
    minHeight:    160,
  },
  heroGreeting: {
    color:        Colors.t2,
    fontFamily:   Typography.fontFamily.bodyMedium,
    fontSize:     Typography.size.md,
    marginBottom: Spacing.sm,
  },
  heroLabel: {
    color:        Colors.t2,
    fontFamily:   Typography.fontFamily.body,
    fontSize:     Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  portfolioSharedWrap: {
    alignSelf:    "flex-start",
    marginBottom: Spacing.sm,
  },
  heroValue: {
    color:         Colors.t0,
    fontFamily:    Typography.fontFamily.numeric,
    fontSize:      Typography.size["3xl"],
    letterSpacing: -0.6,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           Spacing.md,
  },
  heroMetaText: {
    backgroundColor:   Colors.s2,
    borderColor:       Colors.b1,
    borderRadius:      Radius.full,
    borderWidth:       0.5,
    color:             Colors.t1,
    fontFamily:        Typography.fontFamily.bodyMedium,
    fontSize:          Typography.size.xs,
    overflow:          "hidden",
    paddingHorizontal: Spacing.md,
    paddingVertical:   6,
  },

  // ── stacked bento cards ────────────────────────────────────────────────────
  bentoColumn: {
    flexDirection: "column",
    gap:           Spacing.md,
    marginBottom:  Spacing.md,
  },
  bentoCell: {
    width: "100%",
  },
  tiltCard: {
    minHeight: 110,
  },

  // ── shared card text ───────────────────────────────────────────────────────
  bentoHeading: {
    color:        Colors.t0,
    fontFamily:   Typography.fontFamily.bodyMedium,
    fontSize:     Typography.size.md,
    marginBottom: Spacing.sm,
  },
  bentoBody: {
    color:      Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize:   Typography.size.sm,
    lineHeight: 20,
  },
  healthDial: {
    color:        Colors.gold,
    fontFamily:   Typography.fontFamily.numeric,
    fontSize:     Typography.size["2xl"],
    marginBottom: Spacing.xs,
  },

  // ── momentum ───────────────────────────────────────────────────────────────
  momentumCard: {
    marginBottom: Spacing.lg,
  },

  // ── allocation bar ─────────────────────────────────────────────────────────
  allocCard: {
    marginBottom: Spacing.lg,
  },
  allocBar: {
    backgroundColor: Colors.s3,
    borderRadius:    Radius.full,
    flexDirection:   "row",
    gap:             1,
    height:          8,
    marginTop:       Spacing.sm,
    overflow:        "hidden",
  },
  allocSegment: {
    height: "100%",
  },

  // ── section title ──────────────────────────────────────────────────────────
  sectionTitle: {
    color:        Colors.t0,
    fontFamily:   Typography.fontFamily.bodyMedium,
    fontSize:     Typography.size.lg,
    marginBottom: Spacing.md,
  },

  // ── module grid ────────────────────────────────────────────────────────────
  moduleGrid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           Spacing.md,
  },
  moduleTile: {
    backgroundColor: Colors.s1,
    borderColor:     Colors.b0,
    borderRadius:    Radius.lg,
    borderWidth:     0.5,
    minHeight:       120,
    overflow:        "hidden",
    padding:         Spacing.md,
    width:           "47.8%",
  },
  moduleIcon: {
    color:        Colors.gold,
    fontSize:     20,
    marginBottom: Spacing.sm,
  },
  moduleTitle: {
    color:        Colors.t0,
    fontFamily:   Typography.fontFamily.bodyMedium,
    fontSize:     Typography.size.sm,
    marginBottom: 4,
  },
  moduleSubtitle: {
    color:      Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize:   Typography.size.xs,
    lineHeight: 16,
  },

  // ── bottom pad for floating nav ────────────────────────────────────────────
  bottomPad: {
    height: 100,
  },
});