import { ReactNode, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Animatable from "react-native-animatable";
import Animated from "react-native-reanimated";
import { BlurView } from "expo-blur";

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
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

type FocusArea = "portfolio" | "profile" | "health" | "momentum" | "modules";

type ModuleTile = {
  icon: string;
  key: string;
  subtitle: string;
  title: string;
  to: string;
};

const MODULES: ModuleTile[] = [
  { key: "portfolio", icon: "📊", title: "Portfolio X-Ray", subtitle: "Overlap and XIRR", to: "/portfolio-xray" },
  { key: "fire", icon: "🔥", title: "FIRE Planner", subtitle: "Live retirement simulator", to: "/dashboard/fire-planner" },
  { key: "tax", icon: "⚖️", title: "Tax Wizard", subtitle: "Old vs new regime", to: "/tax-wizard" },
  { key: "future", icon: "🔮", title: "Future You", subtitle: "Scenario mirror", to: "/dashboard/future-you" },
  { key: "couple", icon: "💕", title: "Couple Planner", subtitle: "Joint strategy", to: "/couples-planner" },
  { key: "chat", icon: "💬", title: "Money Chat", subtitle: "Ask FinMentor AI", to: "/dashboard/chat" },
];

function focusText(isFocused: boolean) {
  return {
    fontFamily: isFocused ? Typography.fontFamily.displaySemiBold : Typography.fontFamily.bodyMedium,
    fontWeight: isFocused ? "700" : "500",
  } as const;
}

function GlassCard({
  children,
  delay = 0,
  onPress,
  style,
}: {
  children: ReactNode;
  delay?: number;
  onPress?: () => void;
  style?: object;
}) {
  return (
    <Animatable.View animation="fadeInUp" delay={delay} duration={520}>
      <Pressable onPress={onPress} style={[styles.glassCard, style]}>
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={["rgba(168,85,247,0.15)", "rgba(255,215,0,0.12)", "rgba(255,255,255,0.04)"]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.meshOrbA} />
        <View style={styles.meshOrbB} />
        {children}
      </Pressable>
    </Animatable.View>
  );
}

export default function DashboardHome() {
  const profile = useAppStore((state) => state.currentProfile);
  const portfolioXRay = useAppStore((state) => state.portfolioXRay);
  const [focusArea, setFocusArea] = useState<FocusArea>("portfolio");

  const totalPortfolioValue = portfolioXRay?.totalValue || 0;
  const xirr = portfolioXRay?.overallXIRR ?? null;
  const healthScore = profile ? getOverallHealthScore(profile) : 0;
  const savingsRate = profile ? getSavingsRate(profile) : 0;
  const emergencyMonths = profile ? getEmergencyFundMonths(profile) : 0;
  const fireTarget = profile ? getFireCorpusTarget(profile) : 0;
  const corpusProgress = fireTarget > 0 ? Math.min(totalPortfolioValue / fireTarget, 1) : 0;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  return (
    <Screen scroll>
      {__DEV__ ? (
        <View style={styles.devBuildBadge}>
          <Text style={styles.devBuildBadgeText}>DEV BUILD: UI REFRESH ACTIVE</Text>
        </View>
      ) : null}

      <GlassCard delay={0} onPress={() => setFocusArea("portfolio")} style={styles.heroCard}>
        <Text style={[styles.heroGreeting, focusText(focusArea === "portfolio")]}>
          {greeting}, {profile?.name?.split(" ")[0] || "Investor"}
        </Text>
        <Text style={styles.heroLabel}>Total Portfolio Value</Text>

        <Animated.View sharedTransitionTag="portfolio-shared-value" style={styles.portfolioSharedWrap}>
          <Text style={[styles.heroValue, focusText(focusArea === "portfolio")]}>{formatINR(totalPortfolioValue)}</Text>
        </Animated.View>

        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMetaText}>Overall XIRR: {xirr !== null ? `${xirr.toFixed(1)}%` : "N/A"}</Text>
          <Text style={styles.heroMetaText}>Savings Rate: {savingsRate.toFixed(0)}%</Text>
        </View>
      </GlassCard>

      <View style={styles.bentoRow}>
        <TiltCard onPress={() => router.push("/profile-edit") as never} style={styles.bentoCell}>
          <GlassCard delay={70} onPress={() => setFocusArea("profile")} style={styles.tiltCard}>
            <Text style={[styles.bentoHeading, focusText(focusArea === "profile")]}>Profile Snapshot</Text>
            <Text style={styles.bentoBody}>Emergency runway: {emergencyMonths.toFixed(1)} months</Text>
            <Text style={styles.bentoBody}>Risk style: {profile?.riskProfile || "Balanced"}</Text>
          </GlassCard>
        </TiltCard>

        <TiltCard onPress={() => router.push("/health-score") as never} style={styles.bentoCell}>
          <GlassCard delay={120} onPress={() => setFocusArea("health")} style={styles.tiltCard}>
            <Text style={[styles.bentoHeading, focusText(focusArea === "health")]}>Financial Health</Text>
            <Text style={styles.healthDial}>{healthScore.toFixed(0)}/100</Text>
            <Text style={styles.bentoBody}>Tap to improve weak dimensions</Text>
          </GlassCard>
        </TiltCard>
      </View>

      <GlassCard delay={180} onPress={() => setFocusArea("momentum")} style={styles.momentumCard}>
        <Text style={[styles.bentoHeading, focusText(focusArea === "momentum")]}>Momentum To FIRE</Text>
        <LiquidProgressBar label="Corpus fill" progress={corpusProgress} />
        <Text style={styles.bentoBody}>
          {fireTarget > 0
            ? `${formatINR(totalPortfolioValue, true)} of ${formatINR(fireTarget, true)} target corpus`
            : "Complete profile details to unlock FIRE target projection."}
        </Text>
      </GlassCard>

      <Animatable.View animation="fadeInUp" delay={240} duration={520}>
        <Text style={[styles.sectionTitle, focusText(focusArea === "modules")]}>Bento Modules</Text>
        <View style={styles.moduleGrid}>
          {MODULES.map((module) => (
            <Pressable
              key={module.key}
              onPress={() => {
                setFocusArea("modules");
                router.push(module.to as never);
              }}
              style={styles.moduleTile}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.08)", "rgba(168,85,247,0.11)", "rgba(255,215,0,0.07)"]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.moduleIcon}>{module.icon}</Text>
              <Text style={styles.moduleTitle}>{module.title}</Text>
              <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </Animatable.View>

      <View style={styles.bottomPad} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  devBuildBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(29,158,117,0.16)",
    borderColor: "rgba(29,158,117,0.42)",
    borderRadius: Radius.full,
    borderWidth: 0.8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  devBuildBadgeText: {
    color: "#63D7AE",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  heroCard: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
    minHeight: 180,
  },
  heroGreeting: {
    color: Colors.textSecondary,
    fontSize: Typography.size.md,
    marginBottom: Spacing.sm,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
  },
  portfolioSharedWrap: {
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  heroValue: {
    color: Colors.textPrimary,
    fontSize: Typography.size["3xl"],
    letterSpacing: -0.6,
  },
  heroMetaRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  heroMetaText: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.full,
    borderWidth: 0.8,
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    overflow: "hidden",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  bentoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  bentoCell: {
    flex: 1,
  },
  tiltCard: {
    minHeight: 140,
  },
  momentumCard: {
    marginBottom: Spacing.lg,
  },
  bentoHeading: {
    color: Colors.textPrimary,
    fontSize: Typography.size.md,
    marginBottom: Spacing.sm,
  },
  bentoBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  healthDial: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size["2xl"],
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.md,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  moduleTile: {
    backgroundColor: "rgba(17,18,26,0.56)",
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.lg,
    borderWidth: 0.8,
    minHeight: 128,
    overflow: "hidden",
    padding: Spacing.md,
    width: "47.8%",
  },
  moduleIcon: {
    fontSize: 20,
    marginBottom: Spacing.sm,
  },
  moduleTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    marginBottom: 4,
  },
  moduleSubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
    lineHeight: 16,
  },
  glassCard: {
    backgroundColor: "rgba(14,16,24,0.62)",
    borderColor: "rgba(255,255,255,0.17)",
    borderRadius: Radius.lg,
    borderWidth: 0.8,
    overflow: "hidden",
    padding: Spacing.lg,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  meshOrbA: {
    backgroundColor: "rgba(168,85,247,0.17)",
    borderRadius: 90,
    height: 110,
    position: "absolute",
    right: -35,
    top: -25,
    width: 110,
  },
  meshOrbB: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 80,
    bottom: -34,
    height: 88,
    left: -34,
    position: "absolute",
    width: 88,
  },
  bottomPad: {
    height: 90,
  },
});
