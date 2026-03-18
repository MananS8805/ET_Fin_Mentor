import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function QuickAction({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.quickCard}>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
      <Button label="Open" onPress={onPress} variant="secondary" />
    </View>
  );
}

function CompletionCard({ profile }: { profile: UserProfileData | null }) {
  const completion = profile?.onboardingComplete ? 100 : profile ? 65 : 20;
  const label = profile?.onboardingComplete
    ? "Your financial profile is ready."
    : "Complete onboarding to unlock personalized advice, health scores, and FIRE planning.";

  return (
    <View style={styles.completionCard}>
      <View style={styles.completionHeader}>
        <Text style={styles.sectionTitleDark}>Profile Completion</Text>
        <Text style={styles.completionValue}>{completion}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completion}%` }]} />
      </View>
      <Text style={styles.sectionBodyDark}>{label}</Text>
      {!profile?.onboardingComplete ? (
        <Button label="Start Onboarding" onPress={() => router.push("/onboarding")} />
      ) : null}
    </View>
  );
}

export default function DashboardHome() {
  const profile = useAppStore((state) => state.currentProfile);
  const demoMode = useAppStore((state) => state.demoMode);
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

      if (!active) {
        return;
      }

      setAlerts(nextAlerts);
      await AlertService.syncNotifications(nextAlerts);
    })();

    return () => {
      active = false;
    };
  }, [profile]);

  async function handleDismissAlert(alertId: FinancialAlert["id"]) {
    if (!profile) {
      return;
    }

    await AlertService.dismissAlert(alertId);
    const nextAlerts = await AlertService.getActiveAlerts(profile);
    setAlerts(nextAlerts);
    await AlertService.syncNotifications(nextAlerts);
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{demoMode ? "Judge Demo Mode" : "Money HQ"}</Text>
        <Text style={styles.title}>
          {profile ? `Hi ${profile.name}, your money dashboard is live.` : "Let's build your personal finance cockpit."}
        </Text>
        <Text style={styles.subtitle}>
          {profile
            ? "Your key metrics are calculated offline from the current profile, so core financial insights stay available even without network."
            : "Phone auth is ready. The next step is onboarding so ET FinMentor can personalize every answer."}
        </Text>
      </View>

      <CompletionCard profile={profile} />

      {alerts.length ? (
        <View style={styles.alertSection}>
          <View style={styles.alertHeader}>
            <Text style={styles.sectionTitle}>Financial 911</Text>
            <Text style={styles.alertCount}>{alerts.length}</Text>
          </View>
          <View style={styles.alertStack}>
            {alerts.slice(0, 3).map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <Text style={styles.alertPriority}>{alert.priority === "critical" ? "Critical" : "High priority"}</Text>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertBody}>{alert.body}</Text>
                <Text style={styles.alertAction}>Next step: {alert.action}</Text>
                <Button label="Dismiss" onPress={() => void handleDismissAlert(alert.id)} variant="secondary" />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {profile ? (
        <View style={styles.statsGrid}>
          <StatCard label="Monthly Savings" value={formatINR(monthlySavings)} accent={Colors.teal} />
          <StatCard label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} accent={Colors.gold} />
          <StatCard label="Emergency Fund" value={`${emergencyMonths.toFixed(1)} months`} accent={Colors.purple} />
          <StatCard label="Health Score" value={`${healthScore.toFixed(0)}/100`} accent={Colors.red} />
        </View>
      ) : null}

      {profile ? (
        <View style={styles.fireCard}>
          <Text style={styles.sectionTitle}>FIRE Snapshot</Text>
          <Text style={styles.fireValue}>{formatINR(fireTarget, true)}</Text>
          <Text style={styles.sectionBody}>
            Based on your target retirement lifestyle, this is the corpus ET FinMentor will aim toward in the
            upcoming planner modules.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickAction
            title="Onboarding"
            subtitle="Capture salary, SIPs, insurance, and goals."
            onPress={() => router.push("/onboarding")}
          />
          <QuickAction
            title="Money Chat"
            subtitle="Ask profile-aware questions with quick replies and PII masking."
            onPress={() => router.push("/dashboard/chat")}
          />
          <QuickAction
            title="Health Score"
            subtitle="See the animated score ring, AI actions, and share-safe insights."
            onPress={() => router.push("/health-score")}
          />
          <QuickAction
            title="Voice Alerts"
            subtitle="Run a voice check-in and review red-priority financial alerts."
            onPress={() => router.push("/voice-alerts")}
          />
          <QuickAction
            title="Future You"
            subtitle="Project your corpus with age, SIP, and CAGR what-if controls."
            onPress={() => router.push("/dashboard/future-you")}
          />
          <QuickAction
            title="FIRE Planner"
            subtitle="Model required SIP, allocation shifts, and tax-regime savings."
            onPress={() => router.push("/dashboard/fire-planner")}
          />
          <QuickAction
            title="Tax Wizard"
            subtitle="Upload Form 16, compare regimes, and spot missing deductions."
            onPress={() => router.push("/tax-wizard" as never)}
          />
          <QuickAction
            title="Life Events"
            subtitle="Prepare bonus, marriage, baby, or home-buying decisions."
            onPress={() => router.push("/life-events")}
          />
        </View>
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
  completionCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(12,35,64,0.12)",
    padding: Spacing.xl,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  completionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  completionValue: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.teal,
  },
  section: {
    gap: Spacing.md,
  },
  alertSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  alertHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  alertCount: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
  },
  alertStack: {
    gap: Spacing.md,
  },
  alertCard: {
    backgroundColor: "#FFF1F1",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "#F1C5C5",
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  alertPriority: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    textTransform: "uppercase",
  },
  alertTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  alertBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  alertAction: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  sectionTitleDark: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  sectionBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  sectionBodyDark: {
    color: "rgba(255,255,255,0.74)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: "48%",
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  statAccent: {
    width: 32,
    height: 4,
    borderRadius: Radius.full,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  statValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
  },
  fireCard: {
    backgroundColor: "#EEF5FF",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "#D8E4F5",
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  fireValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
  },
  quickGrid: {
    gap: Spacing.md,
  },
  quickCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  quickTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  quickSubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
});
