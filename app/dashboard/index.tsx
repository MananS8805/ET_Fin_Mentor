import { useEffect, useState, useMemo } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import {
  FinancialAlert,
  UserProfileData,
  formatINR,
  getEmergencyFundMonths,
  getFireCorpusTarget,
  getMonthlySavings,
  getOverallHealthScore,
  getSavingsRate,
} from "../../src/core/models/UserProfile";
import { AlertService } from "../../src/core/services/AlertService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

function QuickActionGlass({
  title,
  subtitle,
  onPress,
  icon,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: string;
}) {
  return (
    <TouchableOpacity style={styles.glassActionCard} onPress={onPress}>
      <View style={styles.glassActionIconBox}>
        <Text style={styles.glassActionIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.glassActionTitle}>{title}</Text>
        <Text style={styles.glassActionSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.glassActionPill}>
        <Text style={styles.glassActionPillText}>Open</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardHome() {
  const profile = useAppStore((state) => state.currentProfile);
  const demoMode = useAppStore((state) => state.demoMode);
  const portfolioXRay = useAppStore((state) => state.portfolioXRay);
  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);

  const monthlySavings = profile ? getMonthlySavings(profile) : 0;
  const emergencyMonths = profile ? getEmergencyFundMonths(profile) : 0;
  const fireTarget = profile ? getFireCorpusTarget(profile) : 0;
  const healthScore = profile ? getOverallHealthScore(profile) : 0;
  const savingsRate = profile ? getSavingsRate(profile) : 0;

  useEffect(() => {
    if (!profile) {
      setAlerts([]);
      return;
    }
    let active = true;
    void (async () => {
      const nextAlerts = await AlertService.getActiveAlerts(profile);
      if (active) setAlerts(nextAlerts);
    })();
    return () => { active = false; };
  }, [profile]);

  const totalPortfolioValue = portfolioXRay?.totalValue || 0;
  const xirr = portfolioXRay?.overallXIRR ?? null;
  // Get time of day for greeting
  const hours = new Date().getHours();
  let greeting = "Good Evening";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 17) greeting = "Good Afternoon";

  return (
    <Screen scroll>
      {/* ── Header: Hero Section ── */}
      <Animatable.View animation="fadeIn" duration={600} style={styles.heroContainer}>
        <Text style={styles.greetingText}>{greeting}, {profile?.name?.split(' ')[0] || "Investor"}</Text>
        <Text style={styles.heroSubText}>Total Portfolio Value</Text>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValueText}>{formatINR(totalPortfolioValue)}</Text>
          <View style={styles.badgeGreen}>
            <Text style={styles.badgeGreenText}>+1.2% (1D)</Text>
          </View>
        </View>
        <View style={styles.xirrRow}>
          <Text style={styles.xirrLabel}>Overall XIRR</Text>
          <Text style={styles.xirrValue}>{xirr !== null ? `${xirr.toFixed(1)}%` : "N/A"}</Text>
        </View>
      </Animatable.View>

      {/* ── The "Lollipop" Progress Bars (Asset Allocation) ── */}
      {profile && (
        <Animatable.View animation="fadeInUp" delay={100} duration={500} style={styles.lollipopSection}>
          <Text style={styles.sectionTitle}>Asset Class Breakdown</Text>
          <View style={styles.lollipopContainer}>
            {Object.entries(portfolioXRay?.categoryAllocation || {}).map(([category, percentage]) => (
              <View key={category} style={styles.lollipopCol}>
                <View style={styles.lollipopTrack}>
                  <View style={[styles.lollipopFill, { height: `${percentage}%`, backgroundColor: Colors.teal }]} />
                </View>
                <Text style={styles.lollipopLabel}>{category}</Text>
                <Text style={styles.lollipopPct}>{percentage}%</Text>
              </View>
            ))}
          </View>
          {demoMode && <Text style={styles.demoBadge}>DEMO DATA</Text>}
        </Animatable.View>
      )}

      {/* ── Report Card Section (Financial Health) ── */}
      {profile && (
        <Animatable.View animation="fadeInUp" delay={200} duration={500} style={styles.healthSection}>
          <View style={styles.glassCardNested}>
            <View style={{ flex: 1 }}>
              <Text style={styles.healthTitle}>Financial Health</Text>
              <Text style={styles.healthSub}>Based on 6 dimensions of ET FinMentor wellness.</Text>
              <TouchableOpacity style={styles.investBtn} onPress={() => router.push("/health-score")}>
                 <Text style={styles.investBtnText}>Improve Score</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.healthMeterBox}>
               {/* Faked Segmented Circular Gauge via border trick */}
               <View style={styles.meterOuter}>
                  <View style={styles.meterInner}>
                     <Text style={styles.meterScore}>{healthScore.toFixed(0)}</Text>
                     <Text style={styles.meterMax}>/100</Text>
                  </View>
               </View>
            </View>
          </View>
        </Animatable.View>
      )}

      {/* ── Insights Feed (Social Media Style Cards) ── */}
      {profile && (
        <Animatable.View animation="fadeInUp" delay={300} duration={500} style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>ET FinMentor Insights</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Personalized insights coming soon!</Text>
            <Text style={styles.insightAction}>Stay tuned for updates.</Text>
          </View>
        </Animatable.View>
      )}

      {/* ── App Navigation / Quick Actions (Glassmorphic) ── */}
      <Animatable.View animation="fadeInUp" delay={400} duration={500} style={styles.navSection}>
        <Text style={styles.sectionTitle}>App Modules</Text>
        <View style={styles.navGrid}>
          <QuickActionGlass icon="📊" title="Portfolio X-Ray" subtitle="Upload statement for overlap & XIRR." onPress={() => router.push("/portfolio-xray" as never)} />
          <QuickActionGlass icon="🔥" title="FIRE Planner" subtitle="Model your path to early retirement." onPress={() => router.push("/dashboard/fire-planner")} />
          <QuickActionGlass icon="⚖️" title="Tax Wizard" subtitle="Upload Form 16 & optimize regimes." onPress={() => router.push("/tax-wizard" as never)} />
          <QuickActionGlass icon="💕" title="Couple's Planner" subtitle="Joint wealth and tax optimization." onPress={() => router.push("/couples-planner" as never)} />
          <QuickActionGlass icon="🔮" title="Future You" subtitle="Visualize corpus growth trajectories." onPress={() => router.push("/dashboard/future-you")} />
          <QuickActionGlass icon="🎉" title="Life Events" subtitle="Navigate marriage, baby, or home buys." onPress={() => router.push("/life-events")} />
          <QuickActionGlass icon="💬" title="Money Chat" subtitle="Ask AI advisor profile-aware queries." onPress={() => router.push("/dashboard/chat")} />
          <QuickActionGlass icon="🚀" title="Onboarding" subtitle="Complete your initial financial profile setup." onPress={() => router.push("/onboarding")} />
        </View>
      </Animatable.View>

      <View style={{height: 100}} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Hero
  heroContainer: {
    padding: Spacing.xl,
    paddingTop: Spacing["3xl"],
    paddingBottom: Spacing["2xl"],
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(12, 12, 12, 0.4)", // Darker embedded look
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: Spacing.xl,
    marginTop: Spacing.lg,
  },
  greetingText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    marginBottom: Spacing.xl,
  },
  heroSubText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  heroValueText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["3xl"],
    letterSpacing: -1,
  },
  badgeGreen: {
    backgroundColor: "rgba(0, 184, 82, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0, 184, 82, 0.3)",
  },
  badgeGreenText: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    fontWeight: "600",
  },
  xirrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  xirrLabel: {
    color: Colors.textMuted,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
  },
  xirrValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.sm,
  },

  sectionTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },

  // Lollipop Progress
  lollipopSection: {
    marginBottom: Spacing["2xl"],
  },
  lollipopContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    height: 120,
  },
  lollipopCol: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 60,
  },
  lollipopTrack: {
    width: 12,
    height: 80,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: Radius.full,
    justifyContent: "flex-end",
    marginBottom: Spacing.sm,
  },
  lollipopFill: {
    width: 12,
    borderRadius: Radius.full,
  },
  lollipopLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
    marginBottom: 2,
  },
  lollipopPct: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.sm,
  },

  // Health Section
  healthSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  glassCardNested: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.4)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: Spacing.xl,
  },
  healthTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.xl,
    marginBottom: 4,
  },
  healthSub: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
    paddingRight: Spacing.md,
  },
  investBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    alignSelf: "flex-start",
  },
  investBtnText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  healthMeterBox: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  meterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: "rgba(0,184,82,0.2)",
    borderTopColor: Colors.teal,
    borderRightColor: Colors.teal,
    borderBottomColor: Colors.teal,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  meterInner: {
    transform: [{ rotate: "-45deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  meterScore: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.xl,
    lineHeight: 28,
  },
  meterMax: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: 10,
  },

  // Insights
  insightsSection: {
    marginBottom: Spacing["2xl"],
  },
  insightsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  insightCard: {
    width: 260,
    backgroundColor: "rgba(20,20,20,0.8)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: Spacing.lg,
    justifyContent: "space-between",
  },
  insightTag: {
    color: "#00E5FF", // Electric blue
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  insightTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  insightAction: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },

  // Nav actions
  navSection: {
    paddingHorizontal: Spacing.lg,
  },
  navGrid: {
    gap: Spacing.md,
  },
  glassActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 20, 20, 0.6)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  glassActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  glassActionIcon: {
    fontSize: 20,
  },
  glassActionTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    marginBottom: 2,
  },
  glassActionSubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
  },
  glassActionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  glassActionPillText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  demoBadge: {
    backgroundColor: Colors.gold,
    color: Colors.black,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
});
