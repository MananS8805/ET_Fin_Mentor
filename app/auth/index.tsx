import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { OtpInput } from "../../src/components/OtpInput";
import { ProgressSegments } from "../../src/components/ProgressSegments";
import { Screen } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import { AppConfig } from "../../src/core/config";
import { AuthLockoutError, AuthService } from "../../src/core/services/AuthService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

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

  const reset = useAppStore((state) => state.reset);
  const setSession = useAppStore((state) => state.setSession);
  const setCurrentProfile = useAppStore((state) => state.setCurrentProfile);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const currentStep = STEP_COPY[step];
  const isConfigured = AppConfig.isSupabaseConfigured();

  const footer = useMemo(() => {
    switch (step) {
      case 1:
        return (
          <Button
            label={isConfigured ? "Send OTP" : "Add Supabase Keys First"}
            loading={busy === "phone-send"}
            onPress={() => void handlePhoneSubmit()}
            disabled={!isConfigured || phone.length !== 10}
          />
        );
      case 2:
        return (
          <Button
            label="Verify SMS OTP"
            loading={busy === "phone-verify"}
            onPress={() => void handlePhoneVerification()}
            disabled={phoneOtp.length !== 6}
          />
        );
      case 3:
        return (
          <View style={styles.footerActions}>
            <Button label="Skip For Now" variant="ghost" onPress={() => setStep(5)} />
            <Button
              label="Send Email OTP"
              loading={busy === "email-send"}
              onPress={() => void handleEmailSubmit()}
              disabled={!isConfigured || !email.trim()}
            />
          </View>
        );
      case 4:
        return (
          <Button
            label="Verify Email OTP"
            loading={busy === "email-verify"}
            onPress={() => void handleEmailVerification()}
            disabled={emailOtp.length !== 6}
          />
        );
      case 5:
        return (
          <View style={styles.footerActions}>
            <Button
              label="Skip"
              variant="secondary"
              loading={busy === "finish"}
              onPress={() => void completeAuth(false)}
            />
            <Button
              label="Enable Biometric"
              loading={busy === "finish"}
              onPress={() => void completeAuth(true)}
            />
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
          throw new Error("No biometrics are enrolled on this device yet.");
        }

        const authenticated = await AuthService.promptBiometric("Enable biometric unlock");

        if (!authenticated) {
          throw new Error("Biometric setup was cancelled.");
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
    <Screen dark scroll footer={footer} contentContainerStyle={styles.content}>
      <ProgressSegments total={5} current={step} />

      {step > 1 ? (
        <View style={styles.backRow}>
          <Button label="Back" variant="ghost" onPress={goBackStep} />
        </View>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.stepLabel}>Step {step} of 5</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.subtitle}>{currentStep.subtitle}</Text>
      </View>

      {!isConfigured && step === 1 ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>Live auth needs Supabase keys</Text>
          <Text style={styles.warningBody}>
            Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`, then restart Expo.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.panel}>
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
        <View style={styles.panel}>
          <OtpInput dark value={phoneOtp} onChange={setPhoneOtp} />
          <View style={styles.inlineRow}>
            <Text style={styles.inlineLabel}>
              {countdown > 0 ? `Resend available in ${countdown}s` : "Didn't get the code?"}
            </Text>
            <Button
              label="Resend"
              onPress={() => void handlePhoneSubmit()}
              variant="ghost"
              disabled={countdown > 0}
            />
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.panel}>
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
        <View style={styles.panel}>
          <OtpInput dark value={emailOtp} onChange={setEmailOtp} />
          <View style={styles.inlineRow}>
            <Text style={styles.inlineLabel}>
              {countdown > 0 ? `Resend available in ${countdown}s` : "Didn't get the email?"}
            </Text>
            <Button
              label="Resend"
              onPress={() => void handleEmailSubmit()}
              variant="ghost"
              disabled={countdown > 0}
            />
          </View>
        </View>
      ) : null}

      {step === 5 ? (
        <View style={styles.panel}>
          <View style={styles.biometricCard}>
            <Text style={styles.biometricTitle}>Secure every app reopen</Text>
            <Text style={styles.biometricBody}>
              If enabled, ET FinMentor will ask for device biometrics before opening a saved session.
            </Text>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  hero: {
    gap: Spacing.md,
  },
  backRow: {
    alignItems: "flex-start",
  },
  stepLabel: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  panel: {
    gap: Spacing.lg,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
    padding: Spacing.xl,
  },
  inlineRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inlineLabel: {
    color: "rgba(255,255,255,0.68)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  warningCard: {
    backgroundColor: "rgba(245,166,35,0.14)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(245,166,35,0.24)",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  warningTitle: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  warningBody: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  errorCard: {
    backgroundColor: "rgba(226,75,74,0.14)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(226,75,74,0.28)",
    padding: Spacing.lg,
  },
  errorText: {
    color: "#FFD7D7",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
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
  footerActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
});
