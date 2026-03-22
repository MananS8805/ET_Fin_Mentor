import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import {
  UserProfileData,
  formatINR,
  getEmergencyFundMonths,
  getFinancial911Alerts,
  getMonthlySavings,
} from "../../src/core/models/UserProfile";
import { ChatMessage, GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

const QUICK_REPLIES = [
  "How much should I save every month?",
  "Am I investing enough right now?",
  "Do I have enough emergency fund?",
  "Which tax regime looks better for me?",
  "How close am I to FIRE?",
  "Where should my SIP go?",
] as const;

const SCROLL_BOTTOM_THRESHOLD = 120;

function formatTimeHHMM(dateInput: string | number | Date) {
  return new Date(dateInput).toLocaleTimeString([], {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });
}

function classifyChatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "unknown_error");
  const lower = message.toLowerCase();

  if (message === "AUTH_REQUIRED") return "AUTH_REQUIRED";
  if (lower.includes("cooling down")) return "COOLDOWN";
  if (lower.includes("session limit")) return "SESSION_LIMIT";
  if (lower.includes("quota") || lower.includes("rate") || lower.includes("429")) return "RATE_LIMIT";
  if (lower.includes("invalid") || lower.includes("revoked") || lower.includes("401") || lower.includes("403")) {
    return "API_KEY";
  }
  if (lower.includes("network") || lower.includes("timed out") || lower.includes("failed to fetch")) {
    return "NETWORK";
  }
  if (lower.includes("empty") || lower.includes("no content")) return "EMPTY_RESPONSE";
  return "UNKNOWN";
}

function buildWelcomeMessage(profile: UserProfileData) {
  const monthlySavings = getMonthlySavings(profile);
  const emergencyMonths = getEmergencyFundMonths(profile);

  return GeminiService.createModelMessage(
    `Hi ${profile.name || "there"}! You currently save ${formatINR(
      monthlySavings
    )} a month and have ${emergencyMonths.toFixed(
      1
    )} months of emergency cover. Ask me about tax, SIPs, debt, FIRE, or budgeting.`,
    "welcome"
  );
}

function TypingDot({ delay }: { delay: number }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 200, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) })
        ),
        -1,
        false
      )
    );
  }, [delay, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[styles.typingDot, style]} />;
}

function TypingIndicator() {
  return (
    <View style={[styles.messageRow, styles.modelRow]}>
      <View style={[styles.bubble, styles.modelBubble, styles.typingBubble]}>
        <View style={styles.typingRow}>
          <TypingDot delay={0} />
          <TypingDot delay={120} />
          <TypingDot delay={240} />
        </View>
      </View>
    </View>
  );
}

function MessageRowAnimated({ children, isUser }: { children: React.ReactNode; isUser: boolean }) {
  const x = useSharedValue(isUser ? 20 : -20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    x.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
  }, [opacity, x]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

function QuickReplyChip({
  item,
  onPress,
  critical = false,
}: {
  item: string;
  onPress: () => void;
  critical?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 14, stiffness: 180 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 180 });
        }}
        style={[styles.quickReplyChip, critical ? styles.quickReplyCriticalChip : null]}
      >
        <Text style={[styles.quickReplyLabel, critical ? styles.quickReplyCriticalLabel : null]}>{item}</Text>
      </Pressable>
    </Animated.View>
  );
}

function ChatHeroCard({
  onClear,
  profile,
  activeProvider,
}: {
  onClear: () => void;
  profile: UserProfileData;
  activeProvider: string;
}) {
  const y = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [opacity, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View style={[styles.heroCard, animatedStyle]}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>Money Chat</Text>
          <Text style={styles.heroSubtitle}>FinMentor replies using your profile context and Indian money logic.</Text>
        </View>
        <Pressable onPress={onClear} style={styles.clearGhostBtn}>
          <Text style={styles.clearGhostText}>Clear Chat</Text>
        </Pressable>
      </View>

      <View style={styles.heroPillsRow}>
        <View style={[styles.metricPill, styles.savingsPill]}>
          <Text style={[styles.metricPillText, styles.savingsPillText]}>
            Savings {formatINR(getMonthlySavings(profile))}/mo
          </Text>
        </View>
        <View style={[styles.metricPill, styles.emergencyPill]}>
          <Text style={[styles.metricPillText, styles.emergencyPillText]}>
            Emergency {getEmergencyFundMonths(profile).toFixed(1)} mo
          </Text>
        </View>
        {__DEV__ ? (
          <View style={[styles.metricPill, styles.providerPill]}>
            <Text style={[styles.metricPillText, styles.providerPillText]}>AI {activeProvider.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function EmptyChatState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.title}>Money Chat</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so FinMentor can answer with your actual numbers and context.
        </Text>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Chat unlocks after profile setup</Text>
        <Text style={styles.emptyBody}>
          The assistant uses your income, SIP, emergency fund, debt, tax, and retirement data to give personalized
          answers.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

export default function ChatTab() {
  const profile = useAppStore((state) => state.currentProfile);
  const chatHistory = useAppStore((state) => state.chatHistory);
  const setChatHistory = useAppStore((state) => state.setChatHistory);
  const clearChatHistory = useAppStore((state) => state.clearChatHistory);
  const alertChip = useMemo(() => {
    if (!profile) return null;
    const alerts = getFinancial911Alerts(profile);
    const critical = alerts.find((a) => a.priority === "critical");
    if (!critical) return null;
    const questionMap: Record<string, string> = {
      emergency_low: "Why is my emergency fund critical?",
      insurance_gap_high: "How do I fix my insurance gap?",
      health_cover_missing: "Why do I need health insurance?",
      debt_ratio_high: "How do I reduce my debt burden?",
      retirement_corpus_low: "How far am I from retirement readiness?",
    };
    return questionMap[critical.id] ?? `Tell me about: ${critical.title}`;
  }, [profile]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const stickToBottomRef = useRef(true);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 960;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  useEffect(() => {
    if (!profile || chatHistory.length > 0) {
      return;
    }

    setChatHistory([buildWelcomeMessage(profile)]);
  }, [chatHistory.length, profile, setChatHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (stickToBottomRef.current) {
        listRef.current?.scrollToEnd({ animated: true });
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [chatHistory.length, sending]);

  function handleListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const isNearBottom = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
    stickToBottomRef.current = isNearBottom;
    setShowScrollToLatest(!isNearBottom && visibleMessages.length > 4);
  }

  function handleJumpToLatest() {
    stickToBottomRef.current = true;
    setShowScrollToLatest(false);
    listRef.current?.scrollToEnd({ animated: true });
    void Haptics.selectionAsync();
  }

  const visibleMessages = useMemo(() => {
    if (!sending) return chatHistory;
    if (streamingText && chatHistory.length > 0) {
      const last = chatHistory[chatHistory.length - 1];
      if (last.role === "model") {
        return [
          ...chatHistory.slice(0, -1),
          { ...last, text: streamingText },
        ];
      }
    }
    return [...chatHistory, GeminiService.createModelMessage("...", "system")];
  }, [chatHistory, sending, streamingText]);
  const activeProvider = GeminiService.getLastProviderUsed();

  if (!profile) {
    return <EmptyChatState />;
  }

  const currentProfile = profile;

  async function handleCopy(message: ChatMessage) {
    await Clipboard.setStringAsync(message.text);
    setCopiedId(message.id);
    void Haptics.selectionAsync();
    setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1200);
  }

  async function handleSend(textOverride?: string) {
    const trimmed = (textOverride ?? input).trim();
    if (!trimmed || sending) return;

    const optimisticHistory = [...chatHistory, GeminiService.createUserMessage(trimmed)];
    setInput("");
    setSending(true);
    setSessionExpired(false);
    setStreamingText("");
    setChatHistory(optimisticHistory);

    try {
      const placeholderId = `stream-${Date.now()}`;
      const placeholder = { ...GeminiService.createModelMessage(""), id: placeholderId };
      setChatHistory([...optimisticHistory, placeholder]);

      let accumulated = "";
      const { modelMessage } = await GeminiService.streamMessage(
        trimmed,
        currentProfile,
        (delta) => {
          accumulated += delta;
          setStreamingText(accumulated);
        },
        chatHistory
      );

      setChatHistory([...optimisticHistory, modelMessage]);
      setStreamingText("");
    } catch (error) {
      const isAuthError = error instanceof Error && error.message === "AUTH_REQUIRED";
      const errorCode = classifyChatError(error);
      const errorDetail = error instanceof Error ? error.message : String(error ?? "unknown_error");
      if (__DEV__) {
        console.warn("[MoneyChat] request failed", {
          errorCode,
          errorDetail,
          provider: GeminiService.getLastProviderUsed(),
        });
      }
      const fallbackMessage = GeminiService.createModelMessage(
        isAuthError
          ? "Session expired. Please sign in again to continue this conversation."
          : __DEV__
            ? `AI failed [${errorCode}] ${errorDetail}`
            : "I could not answer that right now. Please try again in a moment.",
        isAuthError ? "error" : "error"
      );
      if (isAuthError) setSessionExpired(true);
      setChatHistory([...optimisticHistory, fallbackMessage]);
      setStreamingText("");
    } finally {
      setSending(false);
    }
  }

  function renderQuickReplies() {
    if (chatHistory.length !== 1 || chatHistory[0]?.kind !== "welcome") {
      return null;
    }

    return (
      <View style={styles.quickReplyWrap}>
        {alertChip ? (
          <QuickReplyChip
            critical
            item={alertChip}
            onPress={() => {
              void handleSend(alertChip);
            }}
          />
        ) : null}
        {QUICK_REPLIES.map((item) => (
          <QuickReplyChip
            item={item}
            key={item}
            onPress={() => {
              void handleSend(item);
            }}
          />
        ))}
      </View>
    );
  }

  function renderMessage({ item }: ListRenderItemInfo<ChatMessage>) {
    const isUser = item.role === "user";
    const isError = item.kind === "error";
    const isTypingGhost = item.kind === "system" && item.text === "...";
    const bubbleStyle = isUser
      ? styles.userBubble
      : isError
        ? styles.errorBubble
        : styles.modelBubble;
    const textStyle = isUser ? styles.userText : isError ? styles.errorText : styles.modelText;

    if (isTypingGhost) {
      return <TypingIndicator />;
    }

    return (
      <MessageRowAnimated isUser={isUser}>
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.modelRow]}>
          <Pressable onLongPress={() => void handleCopy(item)} style={[styles.bubble, bubbleStyle]}>
            <Text style={[styles.messageText, textStyle]}>{item.text}</Text>
            <View style={styles.metaRow}>
              {copiedId === item.id ? <Text style={[styles.metaText, textStyle]}>Copied</Text> : null}
              <Text style={[styles.metaText, textStyle]}>{formatTimeHHMM(item.createdAt)}</Text>
            </View>
          </Pressable>

          {!isUser && item.kind === "welcome" ? renderQuickReplies() : null}
        </View>
      </MessageRowAnimated>
    );
  }

  function renderHeroHeader() {
    return <ChatHeroCard activeProvider={activeProvider} onClear={clearChatHistory} profile={currentProfile} />;
  }

  const footer = (
    <View
      style={[
        styles.composerShell,
        {
          paddingBottom: isWideLayout ? Spacing.lg + insets.bottom : 84 + insets.bottom,
        },
      ]}
    >
      {sessionExpired ? (
        <View style={styles.expiredBar}>
          <Text style={styles.expiredText}>Session expired. Sign in again to keep chatting.</Text>
          <Pressable onPress={() => router.push("/auth")} style={styles.expiredSigninBtn}>
            <Text style={styles.expiredSigninText}>Sign In</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.composerBar}>
          <View style={styles.composerInner}>
            <TextInput
              editable={!sending}
              multiline
              onChangeText={setInput}
              placeholder="Ask about savings, tax, SIP, debt, FIRE..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.input}
              value={input}
            />
            <Pressable
              disabled={!input.trim() || sending}
              onPress={() => void handleSend()}
              style={[styles.sendBtn, !input.trim() || sending ? styles.sendBtnDisabled : null]}
            >
              {sending ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={styles.sendBtnIcon}>▶</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <Screen footer={footer}>
      <View style={styles.container}>
        <FlatList
          contentContainerStyle={styles.messagesContent}
          data={visibleMessages}
          decelerationRate="normal"
          initialNumToRender={10}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeroHeader}
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          maxToRenderPerBatch={10}
          onContentSizeChange={() => {
            if (stickToBottomRef.current) {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScroll={handleListScroll}
          ref={listRef}
          removeClippedSubviews
          renderItem={renderMessage}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          windowSize={8}
        />

        {showScrollToLatest ? (
          <Pressable onPress={handleJumpToLatest} style={styles.scrollToLatestFab}>
            <Text style={styles.scrollToLatestText}>Scroll to latest</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b1,
    borderRadius: 20,
    borderWidth: 0.5,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
    padding: Spacing.lg,
  },
  heroTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroTextWrap: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  heroTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 20,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  clearGhostBtn: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: Spacing.md,
  },
  clearGhostText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  heroPillsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  metricPill: {
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  savingsPill: {
    backgroundColor: Colors.tealDim,
    borderColor: "rgba(31,190,114,0.30)",
  },
  emergencyPill: {
    backgroundColor: Colors.goldDim,
    borderColor: "rgba(200,168,75,0.30)",
  },
  metricPillText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
  },
  savingsPillText: {
    color: Colors.teal,
  },
  emergencyPillText: {
    color: Colors.gold,
  },
  providerPill: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.35)",
  },
  providerPillText: {
    color: Colors.blue,
  },
  messagesContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.xs,
  },
  messageRow: {
    gap: Spacing.sm,
  },
  userRow: {
    alignItems: "flex-end",
  },
  modelRow: {
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: 18,
    borderWidth: 0.5,
    maxWidth: "82%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userBubble: {
    backgroundColor: Colors.gold,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    borderColor: Colors.gold,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  modelBubble: {
    backgroundColor: Colors.s2,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    borderColor: Colors.b1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  errorBubble: {
    backgroundColor: Colors.redDim,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    borderColor: "rgba(220,78,78,0.25)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  messageText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: Colors.bg,
  },
  modelText: {
    color: Colors.t0,
  },
  errorText: {
    color: Colors.red,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "flex-end",
    marginTop: Spacing.sm,
  },
  metaText: {
    color: "rgba(255,255,255,0.25)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 10,
  },
  quickReplyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  quickReplyChip: {
    backgroundColor: Colors.s2,
    borderColor: Colors.b1,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  quickReplyCriticalChip: {
    backgroundColor: "rgba(226,75,74,0.08)",
    borderColor: "rgba(226,75,74,0.25)",
  },
  quickReplyLabel: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  quickReplyCriticalLabel: {
    color: Colors.red,
  },
  composerShell: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  composerBar: {
    backgroundColor: Colors.s1,
    borderTopColor: Colors.b1,
    borderTopWidth: 0.5,
    paddingTop: Spacing.sm,
  },
  composerInner: {
    alignItems: "flex-end",
    backgroundColor: Colors.s2,
    borderColor: Colors.b1,
    borderRadius: 20,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: Spacing.sm,
    minHeight: 56,
    padding: Spacing.sm,
  },
  input: {
    color: Colors.t0,
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sendBtn: {
    alignItems: "center",
    backgroundColor: Colors.gold,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sendBtnDisabled: {
    opacity: 0.3,
  },
  sendBtnIcon: {
    color: Colors.bg,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 16,
    marginLeft: 1,
  },
  expiredBar: {
    backgroundColor: "rgba(226,75,74,0.1)",
    borderColor: "rgba(226,75,74,0.2)",
    borderRadius: 16,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  expiredText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  expiredSigninBtn: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: Spacing.lg,
  },
  expiredSigninText: {
    color: Colors.bg,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  typingBubble: {
    minWidth: 78,
  },
  typingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typingDot: {
    backgroundColor: Colors.gold,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  hero: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
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
  emptyCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
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
  scrollToLatestFab: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderColor: Colors.gold,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    bottom: 88,
    elevation: 5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    position: "absolute",
    right: Spacing.lg,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 8,
  },
  scrollToLatestText: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    letterSpacing: 0.3,
  },
});
