import { useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { ProgressSegments } from "../../src/components/ProgressSegments";
import { Screen } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import { GeminiService } from "../../src/core/services/GeminiService";
import { RiskProfile, UserProfileData, createEmptyUserProfile, formatINR } from "../../src/core/models/UserProfile";
import { ProfileService } from "../../src/core/services/ProfileService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  1: {
    title: "Tell us about you",
    subtitle: "We start with the essentials so advice feels personal, not generic.",
  },
  2: {
    title: "Capture income",
    subtitle: "Enter income manually or scan a salary slip to auto-fill salary, PF, and HRA values.",
  },
  3: {
    title: "Map your investments",
    subtitle: "SIPs, emergency fund, and tax buckets drive your score and planning recommendations.",
  },
  4: {
    title: "Cover the safety layer",
    subtitle: "Insurance and debt decide how resilient your plan is when life throws surprises.",
  },
  5: {
    title: "Shape the future",
    subtitle: "Set risk, retirement, and near-term money goals so ET FinMentor can guide the right next move.",
  },
};

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

function parseNumber(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

function toInputValue(value: number) {
  return value > 0 ? String(Math.round(value)) : "";
}

function normalizePhoneInput(phone: string) {
  return phone.replace(/^\+91/, "").replace(/\D/g, "").slice(-10);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

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
      keyboardType="number-pad"
      label={label}
      hint={hint}
      onChangeText={(text) => onChange(parseNumber(text))}
      placeholder="0"
      value={toInputValue(value)}
    />
  );
}

export default function OnboardingScreen() {
  const session = useAppStore((state) => state.session);
  const currentProfile = useAppStore((state) => state.currentProfile);
  const demoMode = useAppStore((state) => state.demoMode);
  const setCurrentProfile = useAppStore((state) => state.setCurrentProfile);

  const initialProfile = useMemo(
    () =>
      createEmptyUserProfile({
        id: currentProfile?.id ?? session?.user?.id ?? "profile-local",
        ...currentProfile,
        phone: normalizePhoneInput(currentProfile?.phone ?? session?.user?.phone ?? ""),
        email: currentProfile?.email ?? session?.user?.email ?? "",
      }),
    [currentProfile, session?.user?.email, session?.user?.id, session?.user?.phone]
  );

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<UserProfileData>(initialProfile);
  const [busy, setBusy] = useState<null | "scan" | "save">(null);
  const [error, setError] = useState("");
  const [scanNote, setScanNote] = useState("");
  const [scanPreview, setScanPreview] = useState<string | null>(null);

  const annualizedIncome = draft.annualIncome || draft.monthlyIncome * 12;
  const currentStepCopy = STEP_COPY[step];
  const finalButtonLabel = draft.onboardingComplete ? "Save Changes" : "Complete Onboarding";

  function updateDraft<K extends keyof UserProfileData>(key: K, value: UserProfileData[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleGoal(goal: string) {
    setDraft((current) => {
      const exists = current.goals.includes(goal);

      return {
        ...current,
        goals: exists ? current.goals.filter((item) => item !== goal) : [...current.goals, goal],
      };
    });
  }

  function getStepError(targetStep: Step): string | null {
    if (targetStep === 1) {
      const phoneDigits = draft.phone.replace(/\D/g, "");

      if (!draft.name.trim()) {
        return "Add your name to personalize advice.";
      }

      if (draft.age < 18 || draft.age > 100) {
        return "Enter a valid age between 18 and 100.";
      }

      if (phoneDigits.length !== 10) {
        return "Enter a valid 10-digit Indian mobile number.";
      }

      if (draft.email.trim() && !isValidEmail(draft.email)) {
        return "Enter a valid email or leave it blank.";
      }
    }

    if (targetStep === 2) {
      if (draft.monthlyIncome <= 0) {
        return "Add your monthly income to continue.";
      }

      if (draft.monthlyExpenses < 0 || draft.monthlyEMI < 0 || draft.annualHRA < 0) {
        return "Income step values cannot be negative.";
      }
    }

    if (targetStep === 3) {
      if (draft.existingCorpus < 0 || draft.monthlySIP < 0 || draft.emergencyFund < 0) {
        return "Investment values cannot be negative.";
      }

      if (draft.annualPF < 0 || draft.annual80C < 0 || draft.annualNPS < 0) {
        return "Tax-saving values cannot be negative.";
      }
    }

    if (targetStep === 4) {
      if (draft.termInsuranceCover < 0 || draft.healthInsuranceCover < 0 || draft.totalDebt < 0) {
        return "Insurance and debt values cannot be negative.";
      }
    }

    if (targetStep === 5) {
      if (draft.retirementAge <= draft.age) {
        return "Retirement age should be greater than your current age.";
      }

      if (draft.targetMonthlyExpenseRetirement <= 0) {
        return "Add a target retirement expense to continue.";
      }

      if (!draft.goals.length) {
        return "Choose at least one money goal.";
      }
    }

    return null;
  }

  function handleNext() {
    const stepError = getStepError(step);

    if (stepError) {
      setError(stepError);
      return;
    }

    setError("");
    setStep((current) => (current < 5 ? ((current + 1) as Step) : current));
  }

  function handleBack() {
    setError("");
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  async function handleSalarySlipScan() {
    try {
      setBusy("scan");
      setError("");

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        base64: true,
        quality: 0.8,
      });

      if (pickerResult.canceled) {
        return;
      }

      const asset = pickerResult.assets[0];

      if (!asset?.base64) {
        throw new Error("The selected image did not include base64 data.");
      }

      const parsed = await GeminiService.parseSalarySlip(asset.base64, asset.mimeType ?? "image/jpeg");
      setScanPreview(asset.uri);
      setScanNote(parsed.notes ?? "Salary slip parsed. Please review the auto-filled values before saving.");

      setDraft((current) => ({
        ...current,
        name: current.name || parsed.name || current.name,
        monthlyIncome: parsed.monthlyIncome ?? current.monthlyIncome,
        annualIncome: parsed.annualIncome ?? current.annualIncome,
        annualPF: parsed.annualPF ?? current.annualPF,
        annual80C: parsed.annual80C ?? current.annual80C,
        annualNPS: parsed.annualNPS ?? current.annualNPS,
        annualHRA: parsed.annualHRA ?? current.annualHRA,
      }));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Unable to scan the salary slip right now.");
    } finally {
      setBusy(null);
    }
  }

  async function handleComplete() {
    const stepError = getStepError(5);

    if (stepError) {
      setError(stepError);
      return;
    }

    try {
      setBusy("save");
      setError("");

      const profileToSave = createEmptyUserProfile({
        ...draft,
        phone: draft.phone,
        email: draft.email.trim().toLowerCase(),
        annualIncome: annualizedIncome,
        onboardingComplete: true,
      });

      const result = await ProfileService.saveProfile(profileToSave, demoMode ? null : session);
      setCurrentProfile(result.profile);

      Alert.alert(
        result.syncedToSupabase ? "Profile saved" : "Saved securely on this device",
        result.syncedToSupabase
          ? "Your onboarding profile is now available for the dashboard and future AI guidance."
          : `Supabase sync did not complete${result.syncError ? `: ${result.syncError}` : ""}. Your onboarding profile is safely stored locally.`
      );

      router.replace("/dashboard");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your onboarding profile.");
    } finally {
      setBusy(null);
    }
  }

  function renderStepContent() {
    if (step === 1) {
      return (
        <View style={styles.sectionCard}>
          <TextField
            label="Full name"
            onChangeText={(value) => updateDraft("name", value)}
            placeholder="Rohan Sharma"
            value={draft.name}
          />
          <TextField
            keyboardType="number-pad"
            label="Age"
            onChangeText={(value) => updateDraft("age", parseNumber(value))}
            placeholder="28"
            value={toInputValue(draft.age)}
          />
          <TextField
            keyboardType="phone-pad"
            label="Mobile number"
            maxLength={10}
            onChangeText={(value) => updateDraft("phone", value.replace(/\D/g, "").slice(0, 10))}
            placeholder="9876543210"
            prefix="+91"
            value={draft.phone}
          />
          <TextField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            hint="Optional, but useful for account recovery and reports."
            onChangeText={(value) => updateDraft("email", value)}
            placeholder="you@example.com"
            value={draft.email}
          />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.sectionCard}>
          <View style={styles.scanCard}>
            <View style={styles.scanTextWrap}>
              <Text style={styles.cardTitle}>Salary slip scanner</Text>
              <Text style={styles.cardBody}>
                Upload a payslip image and Gemini Vision will try to pull salary, PF, and HRA numbers into the form.
              </Text>
            </View>

            <Button
              label={busy === "scan" ? "Scanning..." : "Scan Slip"}
              loading={busy === "scan"}
              onPress={() => void handleSalarySlipScan()}
            />

            {scanPreview ? <Image source={{ uri: scanPreview }} style={styles.scanPreview} /> : null}
            {scanNote ? <Text style={styles.scanNote}>{scanNote}</Text> : null}
          </View>

          <CurrencyField label="Monthly income" value={draft.monthlyIncome} onChange={(value) => updateDraft("monthlyIncome", value)} />
          <CurrencyField label="Monthly expenses" value={draft.monthlyExpenses} onChange={(value) => updateDraft("monthlyExpenses", value)} />
          <CurrencyField label="Monthly EMI" value={draft.monthlyEMI} onChange={(value) => updateDraft("monthlyEMI", value)} />
          <CurrencyField
            label="Annual HRA"
            value={draft.annualHRA}
            onChange={(value) => updateDraft("annualHRA", value)}
            hint="Optional. This can also be auto-filled from the salary slip."
          />

          <View style={styles.summaryStrip}>
            <Text style={styles.summaryLabel}>Annualized income</Text>
            <Text style={styles.summaryValue}>{formatINR(annualizedIncome)}</Text>
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.sectionCard}>
          <CurrencyField label="Existing corpus" value={draft.existingCorpus} onChange={(value) => updateDraft("existingCorpus", value)} />
          <CurrencyField label="Monthly SIP" value={draft.monthlySIP} onChange={(value) => updateDraft("monthlySIP", value)} />
          <CurrencyField label="Emergency fund" value={draft.emergencyFund} onChange={(value) => updateDraft("emergencyFund", value)} />
          <CurrencyField
            label="Annual PF contribution"
            value={draft.annualPF}
            onChange={(value) => updateDraft("annualPF", value)}
          />
          <CurrencyField
            label="Annual 80C investments"
            value={draft.annual80C}
            onChange={(value) => updateDraft("annual80C", value)}
          />
          <CurrencyField label="Annual NPS" value={draft.annualNPS} onChange={(value) => updateDraft("annualNPS", value)} />
        </View>
      );
    }

    if (step === 4) {
      return (
        <View style={styles.sectionCard}>
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
          <CurrencyField label="Total debt" value={draft.totalDebt} onChange={(value) => updateDraft("totalDebt", value)} />

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Why this matters</Text>
            <Text style={styles.tipBody}>
              These numbers directly influence the insurance and debt dimensions of your money health score.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Risk profile</Text>
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

        <TextField
          keyboardType="number-pad"
          label="Retirement age"
          onChangeText={(value) => updateDraft("retirementAge", parseNumber(value))}
          placeholder="55"
          value={toInputValue(draft.retirementAge)}
        />
        <CurrencyField
          label="Target monthly retirement expense"
          value={draft.targetMonthlyExpenseRetirement}
          onChange={(value) => updateDraft("targetMonthlyExpenseRetirement", value)}
        />

        <Text style={styles.cardTitle}>Money goals</Text>
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
      </View>
    );
  }

  const footer = (
    <View style={styles.footerRow}>
      <Button label="Back" onPress={handleBack} variant="secondary" disabled={step === 1 || busy !== null} />
      <Button
        disabled={busy !== null}
        label={step === 5 ? finalButtonLabel : "Next"}
        loading={busy === "save"}
        onPress={step === 5 ? () => void handleComplete() : handleNext}
      />
    </View>
  );

  return (
    <Screen scroll footer={footer} contentContainerStyle={styles.content}>
      <ProgressSegments current={step} total={5} variant="light" />

      <View style={styles.hero}>
        <Text style={styles.stepLabel}>Step {step} of 5</Text>
        <Text style={styles.title}>{currentStepCopy.title}</Text>
        <Text style={styles.subtitle}>{currentStepCopy.subtitle}</Text>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {renderStepContent()}
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
  stepLabel: {
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
    backgroundColor: Colors.redDim,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(220,78,78,0.25)",
    padding: Spacing.lg,
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
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  cardBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  scanCard: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.b1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scanTextWrap: {
    gap: Spacing.sm,
  },
  scanPreview: {
    width: "100%",
    height: 160,
    borderRadius: Radius.md,
    resizeMode: "cover",
  },
  scanNote: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  summaryStrip: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b1,
    borderWidth: 0.5,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  summaryLabel: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  summaryValue: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.xl,
  },
  tipCard: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b1,
    borderWidth: 0.5,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tipTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  tipBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
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
    borderColor: Colors.b1,
    backgroundColor: Colors.s2,
    elevation: 0,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  chipActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldDim,
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
    color: Colors.gold,
  },
});
