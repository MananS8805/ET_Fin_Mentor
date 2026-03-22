import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { OtpInput } from "../../src/components/OtpInput";
import { TextField } from "../../src/components/TextField";
import { AppConfig } from "../../src/core/config";
import { AuthLockoutError, AuthService } from "../../src/core/services/AuthService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Spacing, Typography } from "../../src/core/theme";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  1: {
    title: "Verify your phone",
    subtitle: "Enter your Indian mobile number to start your secure ET FinMentor account.",
  },
  2: {
    title: "Enter SMS OTP",
    subtitle: "We sent a 6-digit code to your phone. It expires quickly for safety.",
  },
  3: {
    title: "Add your email",
    subtitle: "Email helps with recovery and statements later. You can skip this for now.",
  },
  4: {
    title: "Verify email OTP",
    subtitle: "Confirm your email with the 6-digit code we just sent.",
  },
  5: {
    title: "Protect with biometrics",
    subtitle: "Use your fingerprint or face unlock before opening your money dashboard.",
  },
};

type AuthActionButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "secondary";
};

function AuthActionButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
}: AuthActionButtonProps) {
  const scale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";

  return (
    <Animated.View style={buttonAnimatedStyle}>
      <Pressable
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 14, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 200 });
        }}
        style={[
          styles.button,
          isPrimary ? styles.primaryButton : styles.secondaryButton,
          isGhost ? styles.ghostButton : null,
          disabled || loading ? styles.buttonDisabled : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary ? Colors.bg : Colors.white} />
        ) : (
          <Text style={[styles.buttonText, isPrimary ? styles.primaryButtonText : styles.secondaryButtonText]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function AuthScreen() {
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState<null | "phone-send" | "phone-verify" | "email-send" | "email-verify" | "finish">(
    null
  );
  const [error, setError] = useState("");
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);

  const logoScale = useSharedValue(0.6);
  const progressWidth = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(40);
  const errorTranslateY = useSharedValue(-10);
  const errorOpacity = useSharedValue(0);
  const biometricPulse = useSharedValue(1);

  const reset = useAppStore((state) => state.reset);
  const setSession = useAppStore((state) => state.setSession);
  const setCurrentProfile = useAppStore((state) => state.setCurrentProfile);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, [logoScale]);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!progressTrackWidth) {
      return;
    }

    progressWidth.value = withTiming(progressTrackWidth * (step / 5), {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [progressTrackWidth, progressWidth, step]);

  useEffect(() => {
    cardOpacity.value = 0;
    cardTranslateY.value = 40;

    cardOpacity.value = withTiming(1, { duration: 350 });
    cardTranslateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [cardOpacity, cardTranslateY, step]);

  useEffect(() => {
    if (error) {
      errorOpacity.value = withTiming(1, { duration: 180 });
      errorTranslateY.value = withSpring(0, { damping: 14, stiffness: 160 });
      return;
    }

    errorOpacity.value = withTiming(0, { duration: 140 });
    errorTranslateY.value = -10;
  }, [error, errorOpacity, errorTranslateY]);

  useEffect(() => {
    if (step !== 5) {
      biometricPulse.value = 1;
      return;
    }

    biometricPulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
  }, [biometricPulse, step]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const progressFillAnimatedStyle = useAnimatedStyle(() => ({
    width: progressWidth.value,
  }));

  const stepCardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const errorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ translateY: errorTranslateY.value }],
  }));

  const biometricPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: biometricPulse.value }],
  }));

  const currentStep = STEP_COPY[step];
  const isConfigured = AppConfig.isSupabaseConfigured();

  const footer = useMemo(() => {
    switch (step) {
      case 1:
        return (
          <AuthActionButton
            label={isConfigured ? "Send OTP" : "Add Supabase Keys First"}
            loading={busy === "phone-send"}
            onPress={() => {
              handlePhoneSubmit().catch((e) => presentError(e));
            }}
            disabled={!isConfigured || phone.length !== 10}
          />
        );
      case 2:
        return (
          <AuthActionButton
            label="Verify SMS OTP"
            loading={busy === "phone-verify"}
            onPress={() => {
              handlePhoneVerification().catch((e) => presentError(e));
            }}
            disabled={phoneOtp.length !== 6}
          />
        );
      case 3:
        return (
          <View style={styles.footerActions}>
            <View style={styles.footerActionItem}>
              <AuthActionButton label="Skip For Now" variant="ghost" onPress={() => setStep(5)} />
            </View>
            <View style={styles.footerActionItem}>
              <AuthActionButton
                label="Send Email OTP"
                loading={busy === "email-send"}
                onPress={() => {
                  handleEmailSubmit().catch((e) => presentError(e));
                }}
                disabled={!isConfigured || !email.trim()}
              />
            </View>
          </View>
        );
      case 4:
        return (
          <AuthActionButton
            label="Verify Email OTP"
            loading={busy === "email-verify"}
            onPress={() => {
              void handleEmailVerification();
            }}
            disabled={emailOtp.length !== 6}
          />
        );
      case 5:
        return (
          <View style={styles.footerActions}>
            <View style={styles.footerActionItem}>
              <AuthActionButton
                label="Skip"
                variant="secondary"
                disabled={busy === "finish"}
                onPress={() => {
                  void completeAuth(false);
                }}
              />
            </View>
            <View style={styles.footerActionItem}>
              <AuthActionButton
                label={error ? "Try Again" : "Enable Biometric"}
                loading={busy === "finish"}
                disabled={busy === "finish"}
                onPress={() => {
                  void completeAuth(true);
                }}
              />
            </View>
          </View>
        );
    }
  }, [busy, email, emailOtp.length, isConfigured, phone.length, phoneOtp.length, step]);

  function goBackStep() {
    if (step === 1) {
      return;
    }

    if (step === 5) {
      setStep(email ? 4 : 3);
      return;
    }

    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  async function handlePhoneSubmit() {
    setBusy("phone-send");
    setError("");

    try {
      await AuthService.sendPhoneOtp(phone);
      setStep(2);
      setCountdown(AppConfig.otpResendSeconds);
    } catch (authError) {
      presentError(authError);
    } finally {
      setBusy(null);
    }
  }

  async function handlePhoneVerification() {
    setBusy("phone-verify");
    setError("");

    try {
      const session = await AuthService.verifyPhoneOtp(phone, phoneOtp);

      if (!session) {
        throw new Error("Phone verification succeeded, but no session was returned.");
      }

      reset();
      setSession(session);
      setCurrentProfile(null);
      setStep(3);
      setPhoneOtp("");
    } catch (authError) {
      presentError(authError);
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailSubmit() {
    setBusy("email-send");
    setError("");

    try {
      await AuthService.sendEmailOtp(email);
      setStep(4);
      setCountdown(AppConfig.otpResendSeconds);
    } catch (authError) {
      presentError(authError);
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailVerification() {
    setBusy("email-verify");
    setError("");

    try {
      const session = await AuthService.verifyEmailOtp(email, emailOtp);

      if (!session) {
        throw new Error("Email verification succeeded, but no session was returned.");
      }

      setSession(session);
      setStep(5);
      setEmailOtp("");
    } catch (authError) {
      presentError(authError);
    } finally {
      setBusy(null);
    }
  }

  async function completeAuth(enableBiometric: boolean) {
    setBusy("finish");
    setError("");

    try {
      if (enableBiometric) {
        const canUseBiometric = await AuthService.canUseBiometric();

        if (!canUseBiometric) {
          await AuthService.setBiometricEnabled(false);
          router.replace("/dashboard");
          return;
        }

        const authenticated = await AuthService.promptBiometric("Enable biometric unlock");

        if (!authenticated) {
          setError("Biometric setup failed or was cancelled. You can try again or skip.");
          return;
        }
      }

      await AuthService.setBiometricEnabled(enableBiometric);
      router.replace("/dashboard");
    } catch (authError) {
      presentError(authError);
    } finally {
      setBusy(null);
    }
  }

  function presentError(authError: unknown) {
    if (authError instanceof AuthLockoutError) {
      setError(authError.message);
      return;
    }

    setError(authError instanceof Error ? authError.message : "Something went wrong. Please try again.");
  }

  return (
    <SafeAreaView edges={["left", "right", "top", "bottom"]} style={styles.safeArea}>
      <LinearGradient
        colors={["#060610", "#0A0A1A", "#0D0D24"]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.brandBlock, logoAnimatedStyle]}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>FM</Text>
            </View>
            <Text style={styles.brandTitle}>ET FinMentor</Text>
            <Text style={styles.brandSubtitle}>Your AI-powered CA in your pocket</Text>
          </Animated.View>

          <View style={styles.progressHeaderRow}>
            <View style={styles.progressSpacer} />
            <Text style={styles.progressStepLabel}>Step {step} of 5</Text>
          </View>
          <View
            onLayout={(event) => setProgressTrackWidth(event.nativeEvent.layout.width)}
            style={styles.progressTrack}
          >
            <Animated.View style={[styles.progressFill, progressFillAnimatedStyle]} />
          </View>

          {step > 1 ? (
            <View style={styles.backRow}>
              <AuthActionButton label="Back" onPress={goBackStep} variant="ghost" />
            </View>
          ) : null}

          <Animated.View style={[styles.stepCard, stepCardAnimatedStyle]}>
            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.subtitle}>{currentStep.subtitle}</Text>

            {!isConfigured && step === 1 ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Live auth needs Supabase keys</Text>
                <Text style={styles.warningBody}>
                  Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`, then restart Expo.
                </Text>
              </View>
            ) : null}

            {error ? (
              <Animated.View style={[styles.errorCard, errorAnimatedStyle]}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            {step === 1 ? (
              <View style={styles.panelSection}>
                <TextField
                  dark
                  keyboardType="phone-pad"
                  label="Mobile number"
                  maxLength={10}
                  onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  prefix="+91"
                  value={phone}
                />
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.panelSection}>
                <OtpInput dark value={phoneOtp} onChange={setPhoneOtp} />
                <View style={styles.inlineRow}>
                  <Text style={styles.inlineLabel}>
                    {countdown > 0 ? `Please wait ${countdown}s before resending` : "Didn't get the code?"}
                  </Text>
                  {countdown === 0 ? (
                    <AuthActionButton
                      label="Resend"
                      onPress={() => {
                        void handlePhoneSubmit();
                      }}
                      variant="ghost"
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.panelSection}>
                <TextField
                  dark
                  autoCapitalize="none"
                  keyboardType="email-address"
                  label="Email address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  value={email}
                />
              </View>
            ) : null}

            {step === 4 ? (
              <View style={styles.panelSection}>
                <OtpInput dark value={emailOtp} onChange={setEmailOtp} />
                <View style={styles.inlineRow}>
                  <Text style={styles.inlineLabel}>
                    {countdown > 0 ? `Please wait ${countdown}s before resending` : "Didn't get the email?"}
                  </Text>
                  {countdown === 0 ? (
                    <AuthActionButton
                      label="Resend"
                      onPress={() => {
                        void handleEmailSubmit();
                      }}
                      variant="ghost"
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {step === 5 ? (
              <View style={styles.panelSection}>
                <Animated.View style={[styles.biometricIconWrap, biometricPulseStyle]}>
                  <Text style={styles.biometricIcon}>🔐</Text>
                </Animated.View>
                <Animatable.View animation="fadeIn" duration={420} style={styles.biometricCard}>
                  <Text style={styles.biometricTitle}>Secure every app reopen</Text>
                  <Text style={styles.biometricBody}>
                    If enabled, ET FinMentor will ask for device biometrics before opening a saved session.
                  </Text>
                </Animatable.View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.bg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
  },
  brandBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  logoCircle: {
    alignItems: "center",
    backgroundColor: Colors.gold,
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    marginBottom: Spacing.md,
    width: 80,
  },
  logoText: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  brandTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  brandSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
  },
  progressHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressSpacer: {
    flex: 1,
  },
  progressStepLabel: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 99,
    height: 3,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    backgroundColor: Colors.gold,
    borderRadius: 99,
    height: 3,
  },
  backRow: {
    alignItems: "flex-start",
    marginTop: Spacing.xs,
  },
  stepCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 0.5,
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  title: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 22,
  },
  warningCard: {
    backgroundColor: Colors.amberDim,
    borderColor: "rgba(217,142,56,0.28)",
    borderRadius: 14,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  warningTitle: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  warningBody: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: Colors.redDim,
    borderColor: "rgba(220,78,78,0.30)",
    borderRadius: 14,
    borderWidth: 0.5,
    padding: Spacing.lg,
  },
  errorText: {
    color: "#FFD7D7",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  panelSection: {
    gap: Spacing.lg,
  },
  inlineRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inlineLabel: {
    color: "rgba(255,255,255,0.68)",
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    paddingRight: Spacing.sm,
  },
  biometricIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  biometricIcon: {
    fontSize: 64,
    textAlign: "center",
  },
  biometricCard: {
    gap: Spacing.sm,
  },
  biometricTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  biometricBody: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
  },
  footerActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  footerActionItem: {
    flex: 1,
  },
  button: {
    alignItems: "center",
    borderRadius: 99,
    height: 56,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  primaryButton: {
    backgroundColor: Colors.gold,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 0.5,
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 0.5,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 16,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: Colors.bg,
  },
  secondaryButtonText: {
    color: "rgba(255,255,255,0.7)",
  },
});
