import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import {
  RiskProfile,
  UserProfileData,
  createEmptyUserProfile,
} from "../../src/core/models/UserProfile";
import { ProfileService } from "../../src/core/services/ProfileService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

// ─── helpers (same as onboarding) ────────────────────────────────────────────

function parseNumber(value: string): number {
  const digitsOnly = value.replace(/[^\d]/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

function toInputValue(value: number): string {
  return value > 0 ? String(Math.round(value)) : "";
}

const GOAL_OPTIONS = [
  "retirement",
  "buy a home",
  "children education",
  "parents care fund",
  "emergency backup",
  "vacation",
  "debt free",
  "wealth creation",
] as const;

const RISK_OPTIONS: RiskProfile[] = ["conservative", "moderate", "aggressive"];

// ─── shared sub-components ───────────────────────────────────────────────────

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected ? styles.chipActive : null]}>
      <Text style={[styles.chipLabel, selected ? styles.chipLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function CurrencyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <TextField
      hint={hint}
      keyboardType="number-pad"
      label={label}
      onChangeText={(text) => onChange(parseNumber(text))}
      placeholder="0"
      value={toInputValue(value)}
    />
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionCardTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ProfileEditScreen() {
  const profile = useAppStore((s) => s.currentProfile);
  const session = useAppStore((s) => s.session);
  const demoMode = useAppStore((s) => s.demoMode);
  const setCurrentProfile = useAppStore((s) => s.setCurrentProfile);

  const [draft, setDraft] = useState<UserProfileData>(() =>
    profile ? { ...profile } : createEmptyUserProfile()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateDraft<K extends keyof UserProfileData>(key: K, value: UserProfileData[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleGoal(goal: string) {
    setDraft((current) => ({
      ...current,
      goals: current.goals.includes(goal)
        ? current.goals.filter((g) => g !== goal)
        : [...current.goals, goal],
    }));
  }

  async function handleSave() {
    if (!session && !demoMode) {
      setError("No active session. Please sign in again.");
      return;
    }

    if (draft.monthlyIncome <= 0) {
      setError("Monthly income must be greater than zero.");
      return;
    }

    if (draft.retirementAge <= draft.age) {
      setError("Retirement age must be greater than your current age.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const result = await ProfileService.saveProfile(draft, session);
      setCurrentProfile(result.profile);
      Alert.alert(
        "Profile updated",
        result.syncedToSupabase
          ? "Your profile has been saved and synced."
          : "Saved locally. Will sync when connection is available.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save profile. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Edit your profile</Text>
        <Text style={styles.subtitle}>
          Changes here update your health score, FIRE projection, tax wizard, and AI advice immediately.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Income ── */}
      <SectionCard title="Income">
        <CurrencyField
          label="Monthly income"
          hint="Take-home or net monthly salary."
          value={draft.monthlyIncome}
          onChange={(value) => {
            updateDraft("monthlyIncome", value);
            updateDraft("annualIncome", value * 12);
          }}
        />
        <CurrencyField
          label="Monthly expenses"
          hint="Regular living costs excluding EMIs."
          value={draft.monthlyExpenses}
          onChange={(value) => updateDraft("monthlyExpenses", value)}
        />
        <CurrencyField
          label="Monthly EMI"
          value={draft.monthlyEMI}
          onChange={(value) => updateDraft("monthlyEMI", value)}
        />
        <CurrencyField
          label="Annual HRA received"
          hint="From your salary slip if applicable."
          value={draft.annualHRA}
          onChange={(value) => updateDraft("annualHRA", value)}
        />
      </SectionCard>

      {/* ── Investments ── */}
      <SectionCard title="Investments">
        <CurrencyField
          label="Existing corpus"
          hint="Total current investments and savings."
          value={draft.existingCorpus}
          onChange={(value) => updateDraft("existingCorpus", value)}
        />
        <CurrencyField
          label="Monthly SIP"
          value={draft.monthlySIP}
          onChange={(value) => updateDraft("monthlySIP", value)}
        />
        <CurrencyField
          label="Emergency fund"
          value={draft.emergencyFund}
          onChange={(value) => updateDraft("emergencyFund", value)}
        />
        <CurrencyField
          label="Annual PF contribution"
          value={draft.annualPF}
          onChange={(value) => updateDraft("annualPF", value)}
        />
        <CurrencyField
          label="Annual 80C investments"
          hint="ELSS, PPF, tuition fees, etc."
          value={draft.annual80C}
          onChange={(value) => updateDraft("annual80C", value)}
        />
        <CurrencyField
          label="Annual NPS"
          value={draft.annualNPS}
          onChange={(value) => updateDraft("annualNPS", value)}
        />
      </SectionCard>

      {/* ── Insurance & Debt ── */}
      <SectionCard title="Insurance &amp; Debt">
        <CurrencyField
          label="Term insurance cover"
          value={draft.termInsuranceCover}
          onChange={(value) => updateDraft("termInsuranceCover", value)}
        />
        <CurrencyField
          label="Health insurance cover"
          value={draft.healthInsuranceCover}
          onChange={(value) => updateDraft("healthInsuranceCover", value)}
        />
        <CurrencyField
          label="Total debt outstanding"
          value={draft.totalDebt}
          onChange={(value) => updateDraft("totalDebt", value)}
        />
      </SectionCard>

      {/* ── Goals & Retirement ── */}
      <SectionCard title="Goals &amp; Retirement">
        <TextField
          keyboardType="number-pad"
          label="Retirement age"
          onChangeText={(value) => updateDraft("retirementAge", parseNumber(value))}
          placeholder="55"
          value={toInputValue(draft.retirementAge)}
        />
        <CurrencyField
          label="Target monthly retirement expense"
          hint="How much you want to spend per month in retirement."
          value={draft.targetMonthlyExpenseRetirement}
          onChange={(value) => updateDraft("targetMonthlyExpenseRetirement", value)}
        />

        <Text style={styles.fieldLabel}>Risk profile</Text>
        <View style={styles.chipGrid}>
          {RISK_OPTIONS.map((option) => (
            <OptionChip
              key={option}
              label={option}
              selected={draft.riskProfile === option}
              onPress={() => updateDraft("riskProfile", option)}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Money goals</Text>
        <View style={styles.chipGrid}>
          {GOAL_OPTIONS.map((goal) => (
            <OptionChip
              key={goal}
              label={goal}
              selected={draft.goals.includes(goal)}
              onPress={() => toggleGoal(goal)}
            />
          ))}
        </View>
      </SectionCard>

      {/* ── Actions ── */}
      <View style={styles.actions}>
        <Button
          label="Cancel"
          onPress={() => router.back()}
          variant="secondary"
          disabled={busy}
        />
        <Button
          label={busy ? "Saving..." : "Save changes"}
          loading={busy}
          onPress={() => void handleSave()}
        />
      </View>
    </Screen>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

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
  errorCard: {
    backgroundColor: "#FDECEC",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "#F7C8C8",
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionCardTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  fieldLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    elevation: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  chipActive: {
    borderColor: Colors.gold,
    backgroundColor: "#FFF4DB",
    elevation: 2,
    shadowOpacity: 0.15,
  },
  chipLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    textTransform: "capitalize",
  },
  chipLabelActive: {
    color: Colors.navy,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
});