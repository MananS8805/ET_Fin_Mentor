import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import Voice from "@react-native-voice/voice";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { AlertService } from "../../src/core/services/AlertService";
import { GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { FinancialAlert, formatINR, getMonthlySavings } from "../../src/core/models/UserProfile";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

function detectHindi(text: string) {
  return /[\u0900-\u097F]/.test(text) || /\b(mera|meri|paisa|sip|nahi|hai|aur|loan|ghar)\b/i.test(text);
}

async function ensureMicrophonePermission() {
  if (Platform.OS !== "android") {
    return true;
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: "Microphone access",
    message: "ET FinMentor uses the microphone only when you tap the voice check-in button.",
    buttonPositive: "Allow",
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Day 7</Text>
        <Text style={styles.title}>Voice Check-in + Financial 911</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so voice replies and alerts can use your actual savings, SIP, insurance, and debt
          numbers.
        </Text>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Voice check-ins unlock after profile setup</Text>
        <Text style={styles.emptyBody}>
          We need your financial profile before we can analyze spoken check-ins or generate the 911 alert list.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

function WaveBars() {
  return (
    <View style={styles.waveRow}>
      {[0, 1, 2, 3].map((index) => (
        <Animatable.View
          animation="pulse"
          delay={index * 140}
          duration={780}
          iterationCount="infinite"
          key={index}
          style={[styles.waveBar, { height: 18 + index * 10 }]}
        />
      ))}
    </View>
  );
}

export default function VoiceAlertsScreen() {
  const profile = useAppStore((state) => state.currentProfile);
  const chatHistory = useAppStore((state) => state.chatHistory);
  const setChatHistory = useAppStore((state) => state.setChatHistory);

  const [alerts, setAlerts] = useState<FinancialAlert[]>([]);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [voiceError, setVoiceError] = useState("");

  const currentProfile = profile;
  const nativeVoiceAvailable =
    Voice !== null &&
    typeof Voice === "object" &&
    typeof Voice.start === "function" &&
    typeof Voice.stop === "function";

  const latestLanguage = useMemo(
    () => (detectHindi(transcript || reply) ? "hi-IN" : "en-IN"),
    [reply, transcript]
  );

  useEffect(() => {
    if (!currentProfile) {
      return;
    }

    let active = true;

    void (async () => {
      const nextAlerts = await AlertService.getActiveAlerts(currentProfile);

      if (!active) {
        return;
      }

      setAlerts(nextAlerts);
      await AlertService.syncNotifications(nextAlerts);
    })();

    return () => {
      active = false;
    };
  }, [currentProfile]);

  useEffect(() => {
    if (!nativeVoiceAvailable) {
      return;
    }

    Voice.onSpeechStart = () => {
      setListening(true);
      setVoiceError("");
      setTranscript("");
    };
    Voice.onSpeechPartialResults = (event) => {
      const nextTranscript = event.value?.[0] ?? "";
      if (nextTranscript) {
        setTranscript(nextTranscript);
      }
    };
    Voice.onSpeechResults = (event) => {
      setTranscript(event.value?.[0] ?? "");
    };
    Voice.onSpeechEnd = () => {
      setListening(false);
    };
    Voice.onSpeechError = (event) => {
      setListening(false);
      const message = event.error?.message ?? "Voice recognition stopped unexpectedly.";
      setVoiceError(message);
    };

    return () => {
      Speech.stop();
      Voice.destroy().catch(() => undefined);
      Voice.removeAllListeners();
    };
  }, [nativeVoiceAvailable]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state !== "active" && listening) {
        void stopListening();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [listening]);

  if (!currentProfile) {
    return <EmptyState />;
  }

  const safeProfile = currentProfile;

  async function startListening() {
    try {
      setReply("");
      setVoiceError("");

      const permissionGranted = await ensureMicrophonePermission();

      if (!permissionGranted) {
        throw new Error("Microphone permission is required for voice check-ins.");
      }

      if (!nativeVoiceAvailable) {
        throw new Error(
          "Voice recognition is unavailable in Expo Go. Use an Android development build for this feature."
        );
      }

      const available = await Voice.isAvailable();

      if (!available) {
        throw new Error(
          "Voice recognition is unavailable here. Use a development build on your Android device for this feature."
        );
      }

      void Haptics.selectionAsync();
      await Voice.start("en-IN");
    } catch (error) {
      setListening(false);
      setVoiceError(error instanceof Error ? error.message : "Unable to start the microphone.");
    }
  }

  async function stopListening() {
    try {
      if (!nativeVoiceAvailable) {
        return;
      }

      await Voice.stop();
    } catch (error) {
      console.warn("[VoiceAlerts] stop failed", error);
    } finally {
      setListening(false);
    }
  }

  async function handleAnalyzeCheckIn() {
    if (!transcript.trim() || processing) {
      return;
    }

    try {
      setProcessing(true);
      setVoiceError("");
      const result = await GeminiService.sendMessage(transcript.trim(), safeProfile, chatHistory);
      setChatHistory(result.history);
      setReply(result.modelMessage.text);

      Speech.stop();
      Speech.speak(result.modelMessage.text, {
        language: latestLanguage,
        pitch: 1,
        rate: 0.98,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "AUTH_REQUIRED"
          ? "Session expired. Please sign in again before running a voice check-in."
          : error instanceof Error
            ? error.message
            : "Unable to process your voice note right now.";
      setVoiceError(message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDismissAlert(alertId: FinancialAlert["id"]) {
    await AlertService.dismissAlert(alertId);
    const nextAlerts = await AlertService.getActiveAlerts(safeProfile);
    setAlerts(nextAlerts);
    await AlertService.syncNotifications(nextAlerts);
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Day 7</Text>
        <Text style={styles.title}>Voice Check-in + Financial 911</Text>
        <Text style={styles.subtitle}>
          Speak a money question aloud, get a spoken reply back, and review the highest-priority financial risks on the
          same screen.
        </Text>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Native voice note</Text>
        <Text style={styles.bannerBody}>
          Voice check-ins require a development build on Android because `@react-native-voice/voice` uses custom native
          code and will not run inside plain Expo Go.
        </Text>
      </View>

      <View style={styles.voiceCard}>
        <Text style={styles.voiceTitle}>Tap-to-talk money check-in</Text>
        <Text style={styles.voiceBody}>
          Current savings pace: {formatINR(getMonthlySavings(safeProfile))}/month. Ask in English, Hindi, or
          Hinglish.
        </Text>

        <Pressable onPress={() => void (listening ? stopListening() : startListening())} style={styles.micButton}>
          <Text style={styles.micButtonLabel}>{listening ? "Stop Listening" : "Start Voice Check-in"}</Text>
        </Pressable>

        {!nativeVoiceAvailable ? (
          <Text style={styles.warningText}>
            Voice input is disabled in Expo Go. Install an Android development build to use live speech recognition.
          </Text>
        ) : null}
        {listening ? <WaveBars /> : null}
        {voiceError ? <Text style={styles.warningText}>{voiceError}</Text> : null}

        <View style={styles.noteCard}>
          <Text style={styles.noteLabel}>Transcript</Text>
          <Text style={styles.noteText}>
            {transcript || "Your recognized voice note will appear here after you speak."}
          </Text>
        </View>

        <Button
          disabled={!nativeVoiceAvailable || !transcript.trim() || processing}
          label={processing ? "Analyzing..." : "Analyze Check-in"}
          loading={processing}
          onPress={() => void handleAnalyzeCheckIn()}
        />

        <View style={styles.noteCard}>
          <Text style={styles.noteLabel}>FinMentor reply</Text>
          <Text style={styles.noteText}>
            {reply || "The AI reply will show up here and read itself aloud after analysis."}
          </Text>
        </View>
      </View>

      <View style={styles.alertSection}>
        <View style={styles.alertHeader}>
          <Text style={styles.sectionTitle}>Financial 911 alerts</Text>
          <Text style={styles.alertCount}>{alerts.length}</Text>
        </View>
        <Text style={styles.sectionBody}>
          These alerts are pure offline checks based on your current profile. Notification payloads carry only alert
          IDs, never financial data.
        </Text>

        {alerts.length ? (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <Text style={styles.alertPriority}>{alert.priority === "critical" ? "Critical" : "High Priority"}</Text>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertBody}>{alert.body}</Text>
              <Text style={styles.alertAction}>Next step: {alert.action}</Text>
              <Button label="Dismiss" onPress={() => void handleDismissAlert(alert.id)} variant="secondary" />
            </View>
          ))
        ) : (
          <View style={styles.allClearCard}>
            <Text style={styles.allClearTitle}>No active 911 alerts</Text>
            <Text style={styles.allClearBody}>
              Your current profile does not trigger any of the offline high-risk rules right now.
            </Text>
          </View>
        )}
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
  banner: {
    backgroundColor: "#EEF5FF",
    borderColor: "#D8E4F5",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  bannerTitle: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  bannerBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  voiceCard: {
    backgroundColor: Colors.navy,
    borderColor: "rgba(12,35,64,0.12)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
  },
  voiceTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  voiceBody: {
    color: "rgba(255,255,255,0.76)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  micButton: {
    alignItems: "center",
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  micButtonLabel: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  waveRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  waveBar: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    width: 12,
  },
  noteCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  noteLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  noteText: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  warningText: {
    color: "#FFD4D4",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
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
  sectionTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  sectionBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  alertCard: {
    backgroundColor: "#FFF1F1",
    borderColor: "#F1C5C5",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
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
  allClearCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  allClearTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  allClearBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
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
