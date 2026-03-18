import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import ConfettiCannon from "react-native-confetti-cannon";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { TypewriterText } from "../../src/components/TypewriterText";
import {
  LIFE_EVENT_OPTIONS,
  LifeEventAdvice,
  LifeEventKey,
  getMonthKey,
  getMonthlyMoneyCardData,
  getLifeEventFallbackAdvice,
  getSipCalendar,
  getSipStreakCount,
} from "../../src/core/models/UserProfile";
import { GeminiService } from "../../src/core/services/GeminiService";
import { SipStreakService } from "../../src/core/services/SipStreakService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Day 8</Text>
        <Text style={styles.title}>Life Events + SIP Streak</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so event advice, streaks, and the monthly money card all use your real financial
          context.
        </Text>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Life event planning unlocks after profile setup</Text>
        <Text style={styles.emptyBody}>
          We need your profile before we can tailor advice for bonus, marriage, baby, inheritance, job changes, or a
          home purchase.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

function AdviceSection({ title, body, accent }: { title: string; body: string; accent: string }) {
  return (
    <View style={styles.adviceCard}>
      <View style={[styles.adviceAccent, { backgroundColor: accent }]} />
      <Text style={styles.adviceTitle}>{title}</Text>
      <TypewriterText style={styles.adviceBody} text={body} />
    </View>
  );
}

export default function LifeEventsScreen() {
  const profile = useAppStore((state) => state.currentProfile);
  const shareCardRef = useRef<ViewShot | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<LifeEventKey>("bonus");
  const [advice, setAdvice] = useState<LifeEventAdvice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState("");
  const [sipLogs, setSipLogs] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [confettiLevel, setConfettiLevel] = useState<number | null>(null);

  const currentProfile = profile;
  const fallbackAdvice = useMemo(
    () => (currentProfile ? getLifeEventFallbackAdvice(currentProfile, selectedEvent) : null),
    [currentProfile, selectedEvent]
  );
  const activeAdvice = advice ?? fallbackAdvice;
  const streak = useMemo(() => getSipStreakCount(sipLogs), [sipLogs]);
  const calendar = useMemo(() => getSipCalendar(sipLogs, 12), [sipLogs]);
  const currentMonthLogged = useMemo(() => sipLogs.includes(getMonthKey()), [sipLogs]);
  const monthlyCard = useMemo(
    () => (currentProfile ? getMonthlyMoneyCardData(currentProfile) : null),
    [currentProfile]
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const logs = await SipStreakService.getLogs();

      if (active) {
        setSipLogs(logs);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

    let active = true;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          setLoadingAdvice(true);
          setAdviceError("");
          const nextAdvice = await GeminiService.getLifeEventAdvice(currentProfile, selectedEvent);

          if (active) {
            setAdvice(nextAdvice);
          }
        } catch (error) {
          if (active) {
            setAdvice(fallbackAdvice);
            setAdviceError(error instanceof Error ? error.message : "Showing offline life-event advice for now.");
          }
        } finally {
          if (active) {
            setLoadingAdvice(false);
          }
        }
      })();
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentProfile, fallbackAdvice, selectedEvent]);

  if (!currentProfile || !activeAdvice || !monthlyCard) {
    return <EmptyState />;
  }

  async function handleLogSip() {
    const result = await SipStreakService.logMonth();
    setSipLogs(result.logs);

    if (!result.alreadyLogged && (result.streak === 3 || result.streak === 6 || result.streak === 12)) {
      setConfettiLevel(result.streak);
      setTimeout(() => setConfettiLevel(null), 2600);
    }
  }

  async function handleShareMonthlyCard() {
    try {
      setSharing(true);

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      const uri = await shareCardRef.current?.capture?.();

      if (!uri) {
        throw new Error("Unable to generate the story card.");
      }

      await Sharing.shareAsync(uri, {
        dialogTitle: "Share your ET FinMentor monthly money card",
      });
    } catch (error) {
      Alert.alert("Unable to share card", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSharing(false);
    }
  }

  const immediateText = activeAdvice.immediate.map((item) => `• ${item}`).join("\n");
  const soonText = activeAdvice.soon.map((item) => `• ${item}`).join("\n");
  const longTermText = activeAdvice.longTerm.map((item) => `• ${item}`).join("\n");

  return (
    <Screen scroll>
      {confettiLevel ? <ConfettiCannon count={160} fadeOut origin={{ x: 180, y: 0 }} /> : null}

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Day 8</Text>
        <Text style={styles.title}>Life Events + SIP Streak</Text>
        <Text style={styles.subtitle}>
          Pick a real-life money moment, get a structured plan back, and keep your SIP habit alive month after month.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Life event advisor</Text>
        <View style={styles.eventGrid}>
          {LIFE_EVENT_OPTIONS.map((event) => {
            const selected = selectedEvent === event.key;

            return (
              <Pressable
                key={event.key}
                onPress={() => setSelectedEvent(event.key)}
                style={[styles.eventCard, selected ? styles.eventCardActive : null]}
              >
                <Text style={[styles.eventLabel, selected ? styles.eventLabelActive : null]}>{event.label}</Text>
                <Text style={styles.eventHelper}>{event.helper}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.responseShell}>
          <Text style={styles.responseTitle}>
            {LIFE_EVENT_OPTIONS.find((item) => item.key === selectedEvent)?.label} plan
          </Text>
          {loadingAdvice ? <Text style={styles.loadingText}>FinMentor is typing your action plan...</Text> : null}
          {adviceError ? <Text style={styles.warningText}>{adviceError}</Text> : null}

          <AdviceSection accent={Colors.gold} body={immediateText} title="Immediate (0-30 days)" />
          <AdviceSection accent={Colors.teal} body={soonText} title="Soon (1-6 months)" />
          <AdviceSection accent={Colors.purple} body={longTermText} title="Long term" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SIP streak</Text>
        <View style={styles.streakHero}>
          <Text style={styles.streakFlame}>Flame {streak}</Text>
          <Text style={styles.streakBody}>
            {currentMonthLogged
              ? "This month is already logged. Keep the streak alive next month too."
              : "Log this month's SIP to keep your compounding habit visible and motivating."}
          </Text>
          <Button
            disabled={currentMonthLogged}
            label={currentMonthLogged ? "This Month Logged" : "Log This Month's SIP"}
            onPress={() => void handleLogSip()}
          />
        </View>

        <View style={styles.badgeRow}>
          {[3, 6, 12].map((milestone) => {
            const reached = streak >= milestone;

            return (
              <View key={milestone} style={[styles.badge, reached ? styles.badgeActive : null]}>
                <Text style={[styles.badgeLabel, reached ? styles.badgeLabelActive : null]}>{milestone} months</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.calendarCard}>
          <Text style={styles.calendarTitle}>Last 12 months</Text>
          <View style={styles.calendarGrid}>
            {calendar.map((month) => (
              <View
                key={month.key}
                style={[
                  styles.monthChip,
                  month.logged ? styles.monthChipLogged : null,
                  month.isCurrent ? styles.monthChipCurrent : null,
                ]}
              >
                <Text style={[styles.monthChipLabel, month.logged ? styles.monthChipLabelLogged : null]}>
                  {month.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.monthlyCard}>
          <View style={styles.monthlyHeader}>
            <View>
              <Text style={styles.monthlyTitle}>Monthly money card</Text>
              <Text style={styles.monthlySubtitle}>{monthlyCard.monthLabel}</Text>
            </View>
            <Button label="Share Story" loading={sharing} onPress={() => void handleShareMonthlyCard()} />
          </View>

          <Text style={styles.monthlyBody}>
            A share-safe story card built from percentages only. No rupee amounts are included in the exported image.
          </Text>

          <View style={styles.monthlyMetric}>
            <Text style={styles.monthlyMetricLabel}>Expenses</Text>
            <Text style={styles.monthlyMetricValue}>{monthlyCard.expensePct.toFixed(0)}%</Text>
          </View>
          <View style={styles.monthlyTrack}>
            <View style={[styles.monthlyFill, { width: `${monthlyCard.expensePct}%`, backgroundColor: Colors.red }]} />
          </View>

          <View style={styles.monthlyMetric}>
            <Text style={styles.monthlyMetricLabel}>EMIs</Text>
            <Text style={styles.monthlyMetricValue}>{monthlyCard.emiPct.toFixed(0)}%</Text>
          </View>
          <View style={styles.monthlyTrack}>
            <View style={[styles.monthlyFill, { width: `${monthlyCard.emiPct}%`, backgroundColor: Colors.gold }]} />
          </View>

          <View style={styles.monthlyMetric}>
            <Text style={styles.monthlyMetricLabel}>Saved</Text>
            <Text style={styles.monthlyMetricValue}>{monthlyCard.savingsPct.toFixed(0)}%</Text>
          </View>
          <View style={styles.monthlyTrack}>
            <View style={[styles.monthlyFill, { width: `${monthlyCard.savingsPct}%`, backgroundColor: Colors.teal }]} />
          </View>
        </View>
      </View>

      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.storyCard}>
            <Text style={styles.storyBrand}>ET FinMentor</Text>
            <Text style={styles.storyMonth}>{monthlyCard.monthLabel}</Text>
            <Text style={styles.storyTitle}>Monthly Money Card</Text>

            <View style={styles.storyMetric}>
              <Text style={styles.storyMetricLabel}>Expenses</Text>
              <Text style={styles.storyMetricValue}>{monthlyCard.expensePct.toFixed(0)}%</Text>
            </View>
            <View style={styles.storyTrack}>
              <View style={[styles.storyFill, { width: `${monthlyCard.expensePct}%`, backgroundColor: Colors.red }]} />
            </View>

            <View style={styles.storyMetric}>
              <Text style={styles.storyMetricLabel}>EMIs</Text>
              <Text style={styles.storyMetricValue}>{monthlyCard.emiPct.toFixed(0)}%</Text>
            </View>
            <View style={styles.storyTrack}>
              <View style={[styles.storyFill, { width: `${monthlyCard.emiPct}%`, backgroundColor: Colors.gold }]} />
            </View>

            <View style={styles.storyMetric}>
              <Text style={styles.storyMetricLabel}>Saved</Text>
              <Text style={styles.storyMetricValue}>{monthlyCard.savingsPct.toFixed(0)}%</Text>
            </View>
            <View style={styles.storyTrack}>
              <View style={[styles.storyFill, { width: `${monthlyCard.savingsPct}%`, backgroundColor: Colors.teal }]} />
            </View>

            <Text style={styles.storyFooter}>Percentages only. No rupee values shared.</Text>
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
  eventGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  eventCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
    width: "48%",
  },
  eventCardActive: {
    backgroundColor: "#EEF5FF",
    borderColor: "#BFD1EC",
  },
  eventLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  eventLabelActive: {
    color: Colors.navy,
  },
  eventHelper: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  responseShell: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  responseTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
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
  adviceCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  adviceAccent: {
    borderRadius: Radius.full,
    height: 4,
    width: 36,
  },
  adviceTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  adviceBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  streakHero: {
    backgroundColor: Colors.navy,
    borderColor: "rgba(12,35,64,0.12)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  streakFlame: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
  },
  streakBody: {
    color: "rgba(255,255,255,0.76)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  badge: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  badgeActive: {
    backgroundColor: "#FFF4DB",
    borderColor: "#F7D48A",
  },
  badgeLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  badgeLabelActive: {
    color: Colors.navy,
  },
  calendarCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  calendarTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  monthChip: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 48,
    width: "22%",
  },
  monthChipLogged: {
    backgroundColor: "#EAF7F1",
    borderColor: "#BFE3D4",
  },
  monthChipCurrent: {
    borderColor: Colors.gold,
  },
  monthChipLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  monthChipLabelLogged: {
    color: Colors.teal,
  },
  monthlyCard: {
    backgroundColor: "#EEF5FF",
    borderColor: "#D8E4F5",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  monthlyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthlyTitle: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  monthlySubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginTop: Spacing.xs,
  },
  monthlyBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  monthlyMetric: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthlyMetricLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  monthlyMetricValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  monthlyTrack: {
    backgroundColor: "#DCE6F5",
    borderRadius: Radius.full,
    height: 10,
    overflow: "hidden",
  },
  monthlyFill: {
    borderRadius: Radius.full,
    height: "100%",
  },
  captureContainer: {
    left: -9999,
    position: "absolute",
    top: 0,
  },
  storyCard: {
    backgroundColor: Colors.navy,
    borderRadius: 28,
    padding: 28,
    width: 360,
    height: 640,
  },
  storyBrand: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
    marginBottom: Spacing.md,
  },
  storyMonth: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  storyTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
    marginBottom: Spacing.xl,
  },
  storyMetric: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  storyMetricLabel: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  storyMetricValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
  },
  storyTrack: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.full,
    height: 12,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  storyFill: {
    borderRadius: Radius.full,
    height: "100%",
  },
  storyFooter: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
    marginTop: "auto",
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
