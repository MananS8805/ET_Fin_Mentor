import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as Animatable from "react-native-animatable";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import {
  UserProfileData,
  formatINR,
  getEmergencyFundMonths,
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

function TypingIndicator() {
  return (
    <View style={[styles.messageRow, styles.modelRow]}>
      <View style={[styles.bubble, styles.modelBubble, styles.typingBubble]}>
        <View style={styles.typingRow}>
          {[0, 1, 2].map((index) => (
            <Animatable.View
              animation="bounce"
              delay={index * 120}
              duration={750}
              iterationCount="infinite"
              key={index}
              style={styles.typingDot}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function EmptyChatState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Day 4</Text>
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

  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || chatHistory.length > 0) {
      return;
    }

    setChatHistory([buildWelcomeMessage(profile)]);
  }, [chatHistory.length, profile, setChatHistory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => clearTimeout(timer);
  }, [chatHistory, sending]);

  const visibleMessages = useMemo(
    () => (sending ? [...chatHistory, GeminiService.createModelMessage("...", "system")] : chatHistory),
    [chatHistory, sending]
  );

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

    if (!trimmed || sending) {
      return;
    }

    const optimisticHistory = [...chatHistory, GeminiService.createUserMessage(trimmed)];

    setInput("");
    setSending(true);
    setSessionExpired(false);
    setChatHistory(optimisticHistory);

    try {
      const result = await GeminiService.sendMessage(trimmed, currentProfile, chatHistory);
      setChatHistory(result.history);
    } catch (error) {
      const isAuthError = error instanceof Error && error.message === "AUTH_REQUIRED";
      const fallbackMessage = GeminiService.createModelMessage(
        isAuthError
          ? "Session expired. Please sign in again to continue this conversation."
          : "I could not answer that right now. Please try again in a moment.",
        isAuthError ? "error" : "system"
      );

      setChatHistory([...optimisticHistory, fallbackMessage]);
      setSessionExpired(isAuthError);
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
        {QUICK_REPLIES.map((item) => (
          <Pressable key={item} onPress={() => void handleSend(item)} style={styles.quickReplyChip}>
            <Text style={styles.quickReplyLabel}>{item}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  function renderMessage({ item, index }: ListRenderItemInfo<ChatMessage>) {
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
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.modelRow]}>
        <Pressable onLongPress={() => void handleCopy(item)} style={[styles.bubble, bubbleStyle]}>
          <Text style={[styles.messageText, textStyle]}>{item.text}</Text>
          <View style={styles.metaRow}>
            {copiedId === item.id ? <Text style={[styles.metaText, textStyle]}>Copied</Text> : null}
            <Text style={[styles.metaText, textStyle]}>
              {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </Pressable>

        {!isUser && item.kind === "welcome" && index === 0 ? renderQuickReplies() : null}
      </View>
    );
  }

  const footer = (
    <View style={styles.composerShell}>
      {sessionExpired ? (
        <View style={styles.expiredBar}>
          <Text style={styles.expiredText}>Session expired. Sign in again to keep chatting.</Text>
          <Button label="Sign In" onPress={() => router.replace("/auth")} />
        </View>
      ) : (
        <View style={styles.composerRow}>
          <TextInput
            editable={!sending}
            multiline
            onChangeText={setInput}
            placeholder="Ask about savings, tax, SIP, debt, FIRE..."
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            value={input}
          />
          <Button
            disabled={!input.trim() || sending}
            label={sending ? "Sending..." : "Send"}
            loading={sending}
            onPress={() => void handleSend()}
          />
        </View>
      )}
    </View>
  );

  return (
    <Screen footer={footer}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Money Chat</Text>
          <Text style={styles.heroSubtitle}>
            FinMentor replies using your live profile numbers, Indian tax context, and PII-masked prompts.
          </Text>
          <View style={styles.heroMetrics}>
            <Text style={styles.heroMetric}>Savings: {formatINR(getMonthlySavings(currentProfile))}/month</Text>
            <Text style={styles.heroMetric}>Emergency: {getEmergencyFundMonths(currentProfile).toFixed(1)} months</Text>
          </View>
          <Button label="Clear Chat" onPress={clearChatHistory} variant="secondary" />
        </View>

        <FlatList
          contentContainerStyle={styles.messagesContent}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          ref={listRef}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  heroMetrics: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  heroMetric: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  messagesContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
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
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    maxWidth: "86%",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  userBubble: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
    borderBottomRightRadius: 6,
  },
  modelBubble: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderBottomLeftRadius: 6,
  },
  errorBubble: {
    backgroundColor: "#FDECEC",
    borderColor: "#F7C8C8",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  userText: {
    color: Colors.white,
  },
  modelText: {
    color: Colors.textPrimary,
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
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
    opacity: 0.72,
  },
  quickReplyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  quickReplyChip: {
    backgroundColor: "#FFF4DB",
    borderColor: "#F8D68A",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  quickReplyLabel: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  composerShell: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  composerRow: {
    alignItems: "flex-end",
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.sm,
  },
  input: {
    color: Colors.textPrimary,
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  expiredBar: {
    backgroundColor: "#FDECEC",
    borderColor: "#F7C8C8",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  expiredText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  typingBubble: {
    minWidth: 76,
  },
  typingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typingDot: {
    backgroundColor: Colors.textMuted,
    borderRadius: Radius.full,
    height: 8,
    width: 8,
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
  hero: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
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
