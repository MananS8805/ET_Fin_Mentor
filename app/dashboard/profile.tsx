import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { AuthService } from "../../src/core/services/AuthService";
import { DemoPersonaKey, formatINR, getDemoProfile } from "../../src/core/models/UserProfile";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

const PERSONAS: DemoPersonaKey[] = ["rohan", "priya", "vikram"];

export default function ProfileTab() {
  const demoMode = useAppStore((state) => state.demoMode);
  const demoPersona = useAppStore((state) => state.demoPersona);
  const currentProfile = useAppStore((state) => state.currentProfile);
  const reset = useAppStore((state) => state.reset);
  const selectDemoPersona = useAppStore((state) => state.selectDemoPersona);

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void (async () => {
      setBiometricEnabled(await AuthService.isBiometricEnabled());
    })();
  }, []);

  async function handleSwitchPersona(persona: DemoPersonaKey) {
    try {
      await AuthService.setDemoPersona(persona);
      selectDemoPersona(persona);
    } catch (error) {
      Alert.alert("Unable to switch persona", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await AuthService.signOut();
      reset();
      router.replace("/auth");
    } catch (error) {
      Alert.alert("Unable to sign out", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{demoMode ? "Demo Controls" : "Security & Identity"}</Text>
        <Text style={styles.title}>{currentProfile ? currentProfile.name : "Your ET FinMentor profile"}</Text>
        <Text style={styles.subtitle}>
          {demoMode
            ? "Judges can switch between the three hardcoded personas here without going back through auth."
            : "Biometric preference and sign-out controls are ready. Full security management can layer on top of this shell next."}
        </Text>
      </View>

      {currentProfile ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Profile snapshot</Text>
          <Text style={styles.cardValue}>{formatINR(currentProfile.monthlyIncome)} monthly income</Text>
          <Text style={styles.summaryBody}>
            {currentProfile.riskProfile} profile, SIP of {formatINR(currentProfile.monthlySIP)}, retire at age{" "}
            {currentProfile.retirementAge}.
          </Text>
        </View>
      ) : null}

      <Button
  label="Edit profile"
  onPress={() => router.push("/profile-edit" as never)}
  variant="secondary"
/>

      <View style={styles.securityCard}>
        <Text style={styles.cardTitle}>Security</Text>
        <Text style={styles.cardBody}>
          Biometric unlock is currently {biometricEnabled ? "enabled" : "disabled"} for saved sessions.
        </Text>
      </View>

      {demoMode ? (
        <View style={styles.personaSection}>
          <Text style={styles.cardTitle}>Demo personas</Text>
          <View style={styles.personaGrid}>
            {PERSONAS.map((persona) => {
              const profile = getDemoProfile(persona);
              const selected = demoPersona === persona;

              return (
                <View key={persona} style={[styles.personaCard, selected ? styles.personaCardActive : null]}>
                  <Text style={styles.personaName}>{profile.name}</Text>
                  <Text style={styles.personaBody}>
                    {formatINR(profile.monthlyIncome)} income | {profile.riskProfile}
                  </Text>
                  <Button
                    label={selected ? "Selected" : "Switch"}
                    onPress={() => void handleSwitchPersona(persona)}
                    variant={selected ? "primary" : "secondary"}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Button label="Sign Out" loading={signingOut} onPress={() => void handleSignOut()} />
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
  summaryCard: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(12,35,64,0.1)",
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  securityCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  personaSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  personaGrid: {
    gap: Spacing.md,
  },
  personaCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  personaCardActive: {
    borderColor: Colors.gold,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  summaryTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  cardValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
  },
  cardBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  summaryBody: {
    color: "rgba(255,255,255,0.76)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  personaName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  personaBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
});
