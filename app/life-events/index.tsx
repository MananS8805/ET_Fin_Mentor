import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, TextInput } from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import ConfettiCannon from "react-native-confetti-cannon";
import * as Animatable from "react-native-animatable";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
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

function LoadingDots() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = (dot: any, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }),
            withTiming(0.25, { duration: 280, easing: Easing.in(Easing.cubic) })
          ),
          -1,
          false
        )
      );
    };

    animate(dot1, 0);
    animate(dot2, 120);
    animate(dot3, 240);
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={styles.loadingDotsRow}>
      <Animated.Text style={[styles.loadingDot, s1]}>.</Animated.Text>
      <Animated.Text style={[styles.loadingDot, s2]}>.</Animated.Text>
      <Animated.Text style={[styles.loadingDot, s3]}>.</Animated.Text>
    </View>
  );
}

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
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

function AdviceSection({
  title,
  body,
  accent,
  index,
}: {
  title: string;
  body: string;
  accent: string;
  index: number;
}) {
  const y = useSharedValue(12);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(index * 100, withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(index * 100, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
  }, [index, opacity, y]);

  const sectionAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View style={[styles.adviceCard, sectionAnimatedStyle]}>
      <View style={styles.adviceRow}>
        <View style={[styles.adviceAccent, { backgroundColor: accent }]} />
        <View style={styles.adviceCopyWrap}>
          <Text style={styles.adviceTitle}>{title}</Text>
          <TypewriterText style={styles.adviceBody} text={body} />
        </View>
      </View>
    </Animated.View>
  );
}

function EventOptionCard({
  label,
  helper,
  selected,
  onPress,
}: {
  label: string;
  helper: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 12, stiffness: 180 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 180 });
        }}
        style={[styles.eventCard, selected ? styles.eventCardActive : null]}
      >
        {selected ? <View style={styles.eventActiveAccent} /> : null}
        <Text
          ellipsizeMode="tail"
          numberOfLines={1}
          style={[styles.eventLabel, selected ? styles.eventLabelActive : null]}
        >
          {label}
        </Text>
        <Text numberOfLines={3} style={styles.eventHelper}>
          {helper}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function CalendarMonthChip({
  label,
  logged,
  isCurrent,
}: {
  label: string;
  logged: boolean;
  isCurrent: boolean;
}) {
  const scale = useSharedValue(logged ? 0.9 : 1);

  const monthStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    if (logged) {
      scale.value = withSpring(1, { damping: 11, stiffness: 170 });
    }
  }, [logged, scale]);

  return (
    <Animated.View
      style={[
        styles.monthChip,
        logged ? styles.monthChipLogged : null,
        isCurrent ? styles.monthChipCurrent : null,
        monthStyle,
      ]}
    >
      <Text
        style={[
          styles.monthChipLabel,
          logged ? styles.monthChipLabelLogged : null,
          isCurrent ? styles.monthChipLabelCurrent : null,
        ]}
      >
        {label}
      </Text>
    </Animated.View>
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
  const [followUpInput, setFollowUpInput] = useState("");
const [followUpReply, setFollowUpReply] = useState("");
const [followUpLoading, setFollowUpLoading] = useState(false);
  const heroY = useSharedValue(24);
  const heroOpacity = useSharedValue(0);

  useEffect(() => {
    heroY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    heroOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [heroOpacity, heroY]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroY.value }],
  }));

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

  async function handleFollowUp() {
  const trimmed = followUpInput.trim();
  if (!trimmed || followUpLoading || !currentProfile) return;
  try {
    setFollowUpLoading(true);
    setFollowUpReply("");
    // Inject event context into the question
    const contextualQuestion = `Regarding my ${selectedEvent} life event plan: ${trimmed}`;
    const result = await GeminiService.sendMessage(contextualQuestion, currentProfile, []);
    setFollowUpReply(result.modelMessage.text);
    setFollowUpInput("");
  } catch (error) {
    setFollowUpReply("Unable to load a reply right now. Please try again.");
  } finally {
    setFollowUpLoading(false);
  }
}

  const immediateText = activeAdvice.immediate.map((item) => `• ${item}`).join("\n");
  const soonText = activeAdvice.soon.map((item) => `• ${item}`).join("\n");
  const longTermText = activeAdvice.longTerm.map((item) => `• ${item}`).join("\n");

  return (
    <Screen scroll>
      {confettiLevel ? <ConfettiCannon count={160} fadeOut origin={{ x: 180, y: 0 }} /> : null}

      <Animated.View style={[styles.hero, heroAnimatedStyle]}>
        <Text style={styles.title}>Life Events + SIP Streak</Text>
        <Text style={styles.subtitle}>
          Pick a real-life money moment, get a structured plan back, and keep your SIP habit alive month after month.
        </Text>
      </Animated.View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Life event advisor</Text>
        <View style={styles.eventGrid}>
          {LIFE_EVENT_OPTIONS.map((event) => {
            const selected = selectedEvent === event.key;

            return (
              <EventOptionCard
                helper={event.helper}
                key={event.key}
                label={event.label}
                onPress={() => setSelectedEvent(event.key)}
                selected={selected}
              />
            );
          })}
        </View>

        <View style={styles.responseShell}>
          <Text style={styles.responseTitle}>
            {LIFE_EVENT_OPTIONS.find((item) => item.key === selectedEvent)?.label} plan
          </Text>
          {loadingAdvice ? (
            <View style={styles.loadingRow}>
              <Text style={styles.loadingText}>FinMentor is typing</Text>
              <LoadingDots />
            </View>
          ) : null}
          {adviceError ? <Text style={styles.warningText}>{adviceError}</Text> : null}

          <AdviceSection accent={Colors.red} body={immediateText} index={0} title="Immediate (0-30 days)" />
          <AdviceSection accent={Colors.amber} body={soonText} index={1} title="Soon (1-6 months)" />
          <AdviceSection accent={Colors.teal} body={longTermText} index={2} title="Long term" />
        </View>
        {/* ── Follow-up Chat ── */}
<View style={styles.followUpShell}>
  <Text style={styles.followUpTitle}>Ask a follow-up</Text>
  <Text style={styles.followUpSubtitle}>
    Have a specific question about your {LIFE_EVENT_OPTIONS.find(e => e.key === selectedEvent)?.label.toLowerCase()} plan?
  </Text>

  <View style={styles.followUpInputRow}>
    <TextInput
      style={styles.followUpInput}
      placeholder="e.g. Should I clear my loan first?"
      placeholderTextColor={Colors.textMuted}
      value={followUpInput}
      onChangeText={setFollowUpInput}
      multiline
      editable={!followUpLoading}
    />
  </View>

  <Pressable
    disabled={!followUpInput.trim() || followUpLoading}
    onPress={() => {
      handleFollowUp().catch((e) => {
        setFollowUpReply("Unable to load a reply right now. Please try again.");
        console.error("[LifeEvents] Follow-up error:", e);
      });
    }}
    style={[styles.followUpBtn, !followUpInput.trim() || followUpLoading ? styles.followUpBtnDisabled : null]}
  >
    <Text style={styles.followUpBtnText}>{followUpLoading ? "Thinking..." : "Ask FinMentor"}</Text>
  </Pressable>

  {followUpReply ? (
    <Animatable.View animation="fadeIn" duration={400} style={styles.followUpReply}>
      <Text style={styles.followUpReplyLabel}>FinMentor says</Text>
      <Text style={styles.followUpReplyText}>{followUpReply}</Text>
    </Animatable.View>
  ) : null}
</View>
         
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SIP streak</Text>
        <View style={styles.streakHero}>
          <View style={styles.streakFlameRow}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakFlameCount}>{streak}</Text>
          </View>
          <Text style={styles.streakBody}>
            {currentMonthLogged
              ? "This month is already logged. Keep the streak alive next month too."
              : "Log this month's SIP to keep your compounding habit visible and motivating."}
          </Text>
          <Button
            disabled={currentMonthLogged}
            label={currentMonthLogged ? "This Month Logged" : "Log This Month's SIP"}
            onPress={() => {
  handleLogSip().catch((e) => {
    Alert.alert("Unable to log SIP", e instanceof Error ? e.message : "Please try again.");
  });
}}
          />
        </View>

        <View style={styles.badgeRow}>
          {[3, 6, 12].map((milestone) => {
            const reached = streak >= milestone;

            return (
              <View key={milestone} style={[styles.badge, reached ? styles.badgeActive : null]}>
                <Text style={[styles.badgeLabel, reached ? styles.badgeLabelActive : null]}>
                  {reached ? "✓ " : ""}
                  {milestone} months
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.calendarCard}>
          <Text style={styles.calendarTitle}>Last 12 months</Text>
          <View style={styles.calendarGrid}>
            {calendar.map((month) => (
              <CalendarMonthChip
                isCurrent={month.isCurrent}
                key={month.key}
                label={month.label}
                logged={month.logged}
              />
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
            <Button
              label="Share Story"
              loading={sharing}
              onPress={() => void handleShareMonthlyCard()}
              style={styles.shareStoryBtn}
            />
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
            <View style={[styles.monthlyFill, { width: `${monthlyCard.emiPct}%`, backgroundColor: Colors.amber }]} />
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
    color: Colors.t0,
    fontFamily: Typography.fontFamily.display,
    fontSize: 26,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: Colors.s2,
    borderColor: Colors.b0,
    borderRadius: 16,
    borderWidth: 0.5,
    flex: 1,
    flexBasis: "45%",
    gap: Spacing.sm,
    minWidth: 150,
    overflow: "hidden",
    padding: Spacing.lg,
  },
  eventCardActive: {
    backgroundColor: Colors.goldDim,
    borderColor: Colors.gold,
    borderWidth: 1,
  },
  eventActiveAccent: {
    backgroundColor: Colors.gold,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 3,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 3,
    bottom: 12,
    left: 0,
    position: "absolute",
    top: 12,
    width: 3,
  },
  eventLabel: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 14,
  },
  eventLabelActive: {
    color: Colors.gold,
  },
  eventHelper: {
    color: "rgba(255,255,255,0.3)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  responseShell: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b1,
    borderRadius: 20,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  responseTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 18,
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  loadingDotsRow: {
    flexDirection: "row",
    marginLeft: 4,
  },
  loadingDot: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 16,
    marginRight: 1,
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
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 12,
    gap: Spacing.sm,
    padding: 12,
  },
  adviceRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  adviceAccent: {
    borderRadius: 4,
    height: 32,
    marginTop: 2,
    width: 4,
  },
  adviceCopyWrap: {
    flex: 1,
  },
  adviceTitle: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 13,
    marginBottom: 6,
  },
  adviceBody: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 24,
  },
  streakHero: {
    backgroundColor: Colors.s1,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.b1,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  streakFlameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakFlameCount: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 40,
  },
  streakBody: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  badge: {
    backgroundColor: "transparent",
    borderColor: Colors.b1,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  badgeActive: {
    backgroundColor: Colors.goldDim,
    borderColor: "rgba(200,168,75,0.30)",
  },
  badgeLabel: {
    color: Colors.t3,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  badgeLabelActive: {
    color: Colors.gold,
  },
  calendarCard: {
    backgroundColor: Colors.s1,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.b0,
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
    backgroundColor: Colors.s2,
    borderColor: Colors.b0,
    borderRadius: 12,
    borderWidth: 0.5,
    justifyContent: "center",
    height: 52,
    width: "22%",
  },
  monthChipLogged: {
    backgroundColor: Colors.tealDim,
    borderColor: "rgba(31,190,114,0.25)",
  },
  monthChipCurrent: {
    borderColor: Colors.gold,
    borderWidth: 1,
  },
  monthChipLabel: {
    color: Colors.t3,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  monthChipLabelLogged: {
    color: Colors.teal,
  },
  monthChipLabelCurrent: {
    color: Colors.gold,
  },
  monthlyCard: {
    backgroundColor: Colors.goldDim,
    borderColor: "rgba(200,168,75,0.20)",
    borderRadius: 20,
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
    color: Colors.t0,
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
    color: Colors.t1,
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
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  monthlyMetricValue: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.md,
  },
  monthlyTrack: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: Radius.full,
    height: 8,
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
  followUpShell: {
    backgroundColor: "rgba(127,119,221,0.06)",
    borderColor: "rgba(127,119,221,0.2)",
    borderRadius: 20,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
    marginTop: Spacing.md,
  },
  followUpTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 16,
  },
  followUpSubtitle: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  followUpInputRow: {
    borderWidth: 0.5,
    borderColor: Colors.b0,
    borderRadius: 14,
    backgroundColor: Colors.s2,
  },
  followUpInput: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    minHeight: 80,
    padding: Spacing.lg,
    textAlignVertical: "top",
  },
  followUpBtn: {
    alignItems: "center",
    backgroundColor: Colors.purple,
    borderRadius: Radius.full,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
  },
  followUpBtnDisabled: {
    opacity: 0.5,
  },
  followUpBtnText: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  followUpReply: {
    backgroundColor: "rgba(127,119,221,0.08)",
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(127,119,221,0.25)",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  followUpReplyLabel: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  followUpReplyText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 22,
  },
  shareStoryBtn: {
    borderRadius: 99,
  },
});
