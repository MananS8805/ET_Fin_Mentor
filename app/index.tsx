import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { Button } from "../src/components/Button";
import { Screen } from "../src/components/Screen";
import { AppConfig } from "../src/core/config";
import { AuthService } from "../src/core/services/AuthService";
import { ProfileService } from "../src/core/services/ProfileService";
import { useAppStore } from "../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../src/core/theme";
import * as SecureStore from "expo-secure-store";
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SplashRoute() {
  const [statusMessage, setStatusMessage] = useState("Checking your secure session...");
  const [demoLoading, setDemoLoading] = useState(false);
  const demoTriggered = useRef(false);
  const tapLog = useRef<number[]>([]);

  const reset = useAppStore((state) => state.reset);
  const setSession = useAppStore((state) => state.setSession);
  const setDemoMode = useAppStore((state) => state.setDemoMode);
  const setCurrentProfile = useAppStore((state) => state.setCurrentProfile);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      
      try {
        reset();
        const [authState] = await Promise.all([AuthService.restoreSession(), delay(2000)]);

        if (!mounted || demoTriggered.current) {
          return;
        }

        if (authState?.mode === "demo") {
          setStatusMessage("Opening demo mode...");
          setDemoMode(true, authState.persona);
          router.replace("/dashboard");
          return;
        }

        if (authState?.mode === "auth") {
          setStatusMessage("Restoring your vault...");
          setSession(authState.session);

          if (await AuthService.isBiometricEnabled()) {
            const passed = await AuthService.promptBiometric();

            if (!passed) {
              reset();
              router.replace("/auth");
              return;
            }
        
          }

          setStatusMessage("Loading your financial profile...");
          const restoredProfile = await ProfileService.loadProfile(authState.session);
          setCurrentProfile(restoredProfile);
          try {
  const rawJoint = await SecureStore.getItemAsync(
    "et_finmentor_joint_profile",
    { keychainService: "et-finmentor" }
  );
  if (rawJoint) {
    const jointProfile = JSON.parse(rawJoint);
    useAppStore.getState().setJointProfile(jointProfile);
  }
} catch {
  // Joint profile restore failed — not critical
}
          router.replace("/dashboard");
          return;
        }

        setStatusMessage("No session found. Heading to secure sign-in...");
        await delay(400);
        router.replace("/auth");
      } catch (error) {
        console.error(error);
        if (mounted && !demoTriggered.current) {
          reset();
          router.replace("/auth");
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [reset, setCurrentProfile, setDemoMode, setSession]);

  const configHint = useMemo(() => {
    if (AppConfig.isFullyConfigured()) {
      return "Ready for Supabase auth and Gemini guidance.";
    }

    return "Add your .env keys to enable live auth and AI. Demo mode still works.";
  }, []);

  const activateDemoMode = async () => {
    if (demoTriggered.current || demoLoading) {
      return;
    }

    try {
      demoTriggered.current = true;
      setDemoLoading(true);
      setStatusMessage("Demo mode unlocked. Loading Rohan...");
      await AuthService.activateDemoMode("rohan");
      setDemoMode(true, "rohan");
      router.replace("/dashboard");
    } catch (error) {
      demoTriggered.current = false;
      setDemoLoading(false);
      Alert.alert("Unable to start demo mode", error instanceof Error ? error.message : "Please try again.");
    }
  };

  return (
    <Screen dark>
      <LinearGradient colors={["#0A1830", "#0C2340", "#173D70"]} style={StyleSheet.absoluteFill} />

      <View style={styles.container}>
        <Pressable
          accessibilityLabel="ET FinMentor logo"
          onPress={() => {
            const now = Date.now();
            tapLog.current = [...tapLog.current, now].filter(
              (timestamp) => now - timestamp <= AppConfig.demoTapWindowMs
            );

            if (tapLog.current.length >= AppConfig.demoTapThreshold) {
              void activateDemoMode();
            }
          }}
          style={styles.logoWrap}
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>FM</Text>
          </View>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.title}>ET FinMentor</Text>
          <Text style={styles.subtitle}>
            AI-powered money coaching for India, built to feel like a trusted CA in your pocket.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={styles.infoValue}>{statusMessage}</Text>
          <Text style={styles.infoHint}>{configHint}</Text>
        </View>

        <Button
          label={demoLoading ? "Loading Demo..." : "Continue To Sign In"}
          loading={demoLoading}
          onPress={() => router.replace("/auth")}
          variant="secondary"
          style={styles.cta}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: Spacing["2xl"],
  },
  logoWrap: {
    alignSelf: "center",
    marginTop: Spacing["3xl"],
  },
  logo: {
    width: 116,
    height: 116,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  logoText: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["3xl"],
  },
  hero: {
    gap: Spacing.md,
  },
  title: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["3xl"],
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  infoCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 0.5,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  infoLabel: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  infoHint: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  cta: {
    marginTop: Spacing.lg,
  },
});
