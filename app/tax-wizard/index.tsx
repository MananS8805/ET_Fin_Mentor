import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { TextField } from "../../src/components/TextField";
import {
  TaxDeductionOpportunity,
  TaxSavingRecommendation,
  TaxWizardInput,
  createTaxWizardInput,
  formatINR,
  getTaxWizardFallbackSummary,
  getTaxWizardSnapshot,
} from "../../src/core/models/UserProfile";
import { GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";

function parseNumber(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

function toInputValue(value: number) {
  return value > 0 ? String(Math.round(value)) : "";
}

function CurrencyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
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

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Phase 1</Text>
        <Text style={styles.title}>Tax Wizard</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so the wizard can use your salary, deductions, risk profile, and existing tax data.
        </Text>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Tax planning unlocks after profile setup</Text>
        <Text style={styles.emptyBody}>
          We need your profile before we can rank tax-saving moves or compare regimes against your actual financial
          situation.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

function OpportunityCard({ item }: { item: TaxDeductionOpportunity }) {
  return (
    <View style={styles.opportunityCard}>
      <Text style={styles.opportunityTitle}>{item.title}</Text>
      <Text style={styles.opportunityValue}>{formatINR(item.amount)}</Text>
      <Text style={styles.opportunityBody}>{item.helper}</Text>
    </View>
  );
}

function RecommendationCard({
  item,
  rank,
}: {
  item: TaxSavingRecommendation;
  rank: number;
}) {
  return (
    <View style={styles.recommendationCard}>
      <View style={styles.recommendationHeader}>
        <Text style={styles.recommendationRank}>#{rank}</Text>
        <Text style={styles.recommendationTitle}>{item.title}</Text>
      </View>
      <Text style={styles.recommendationMeta}>
        {item.bucket} | {item.risk} risk | {item.liquidity} liquidity
      </Text>
      <Text style={styles.recommendationValue}>Suggested amount: {formatINR(item.suggestedAmount)}</Text>
      <Text style={styles.recommendationBody}>{item.helper}</Text>
    </View>
  );
}

export default function TaxWizardScreen() {
  const profile = useAppStore((state) => state.currentProfile);

  const [draft, setDraft] = useState<TaxWizardInput | null>(profile ? createTaxWizardInput(profile) : null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState("");
  const [busy, setBusy] = useState<null | "scan" | "summary">(null);
  const [summary, setSummary] = useState("");
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDraft(createTaxWizardInput(profile));
  }, [profile?.id]);

  const currentProfile = profile;

  const snapshot = useMemo(
    () => (currentProfile && draft ? getTaxWizardSnapshot(currentProfile, draft) : null),
    [currentProfile, draft]
  );
  const fallbackSummary = useMemo(
    () => (currentProfile && snapshot ? getTaxWizardFallbackSummary(currentProfile, snapshot) : ""),
    [currentProfile, snapshot]
  );

  useEffect(() => {
    if (!currentProfile || !snapshot) {
      return;
    }

    let active = true;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          setBusy("summary");
          setSummaryError("");
          const nextSummary = await GeminiService.getTaxWizardSummary(currentProfile, snapshot);

          if (active) {
            setSummary(nextSummary);
          }
        } catch (error) {
          if (active) {
            setSummary(fallbackSummary);
            setSummaryError(error instanceof Error ? error.message : "Showing offline tax summary for now.");
          }
        } finally {
          if (active) {
            setBusy((current) => (current === "summary" ? null : current));
          }
        }
      })();
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentProfile, fallbackSummary, snapshot]);

  if (!currentProfile || !draft || !snapshot) {
    return <EmptyState />;
  }

  const safeProfile = currentProfile;
  const safeSnapshot = snapshot;

  function updateDraft<K extends keyof TaxWizardInput>(key: K, value: TaxWizardInput[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleParseForm16() {
    try {
      setBusy("scan");
      setSummaryError("");

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        base64: true,
        quality: 0.9,
      });

      if (pickerResult.canceled) {
        return;
      }

      const asset = pickerResult.assets[0];

      if (!asset?.base64) {
        throw new Error("The selected image did not include base64 data.");
      }

      const parsed = await GeminiService.parseForm16Image(asset.base64, asset.mimeType ?? "image/jpeg");
      setScanPreview(asset.uri);
      setScanNote(parsed.notes ?? "Form 16 parsed. Review the numbers before using them for tax decisions.");

      setDraft((current) =>
        current
          ? {
              ...current,
              annualIncome: parsed.annualIncome ?? current.annualIncome,
              basicSalary: parsed.basicSalary ?? current.basicSalary,
              annualHRAReceived: parsed.annualHRAReceived ?? current.annualHRAReceived,
              annualPF: parsed.annualPF ?? current.annualPF,
              annual80C: parsed.annual80C ?? current.annual80C,
              annualNPS: parsed.annualNPS ?? current.annualNPS,
            }
          : current
      );
    } catch (error) {
      Alert.alert("Unable to parse Form 16", error instanceof Error ? error.message : "Please enter the values manually.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRefreshSummary() {
    try {
      setBusy("summary");
      setSummaryError("");
      const nextSummary = await GeminiService.getTaxWizardSummary(safeProfile, safeSnapshot);
      setSummary(nextSummary);
    } catch (error) {
      setSummary(fallbackSummary);
      setSummaryError(error instanceof Error ? error.message : "Showing offline tax summary for now.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Phase 1</Text>
        <Text style={styles.title}>Tax Wizard</Text>
        <Text style={styles.subtitle}>
          Upload a Form 16 screenshot or enter your salary structure manually. The wizard compares regimes, surfaces
          deduction gaps, and ranks tax-saving moves for your profile.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.uploadCard}>
          <View style={styles.uploadCopy}>
            <Text style={styles.sectionTitle}>Form 16 Upload</Text>
            <Text style={styles.sectionBody}>
              Upload a clear screenshot or image of Form 16. The wizard will try to pull salary, HRA, PF, and current
              deduction numbers into the form.
            </Text>
          </View>
          <Button
            label={busy === "scan" ? "Parsing..." : "Upload Form 16"}
            loading={busy === "scan"}
            onPress={() => void handleParseForm16()}
          />
          {scanPreview ? <Image source={{ uri: scanPreview }} style={styles.scanPreview} /> : null}
          {scanNote ? <Text style={styles.scanNote}>{scanNote}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Salary Structure</Text>
        <View style={styles.card}>
          <CurrencyField
            label="Annual salary"
            hint="Gross annual salary before deductions."
            onChange={(value) => updateDraft("annualIncome", value)}
            value={draft.annualIncome}
          />
          <CurrencyField
            label="Annual basic salary"
            hint="Used for HRA exemption modeling."
            onChange={(value) => updateDraft("basicSalary", value)}
            value={draft.basicSalary}
          />
          <CurrencyField
            label="Annual HRA received"
            onChange={(value) => updateDraft("annualHRAReceived", value)}
            value={draft.annualHRAReceived}
          />
          <CurrencyField
            label="Annual rent paid"
            hint="Enter 0 if you do not claim HRA."
            onChange={(value) => updateDraft("annualRentPaid", value)}
            value={draft.annualRentPaid}
          />

          <View style={styles.toggleShell}>
            <Text style={styles.toggleLabel}>City type for HRA</Text>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => updateDraft("metroCity", false)}
                style={[styles.toggleChip, !draft.metroCity ? styles.toggleChipActive : null]}
              >
                <Text style={[styles.toggleChipLabel, !draft.metroCity ? styles.toggleChipLabelActive : null]}>
                  Non-metro
                </Text>
              </Pressable>
              <Pressable
                onPress={() => updateDraft("metroCity", true)}
                style={[styles.toggleChip, draft.metroCity ? styles.toggleChipActive : null]}
              >
                <Text style={[styles.toggleChipLabel, draft.metroCity ? styles.toggleChipLabelActive : null]}>
                  Metro
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Deductions</Text>
        <View style={styles.card}>
          <CurrencyField
            label="Annual PF contribution"
            onChange={(value) => updateDraft("annualPF", value)}
            value={draft.annualPF}
          />
          <CurrencyField
            label="Additional 80C investments"
            hint="ELSS, PPF, VPF, tax-saver FD, and similar items beyond PF."
            onChange={(value) => updateDraft("annual80C", value)}
            value={draft.annual80C}
          />
          <CurrencyField
            label="Annual NPS contribution"
            onChange={(value) => updateDraft("annualNPS", value)}
            value={draft.annualNPS}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Regime Comparison</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Winner: {snapshot.betterRegime === "old" ? "Old regime" : "New regime"}</Text>
            <Text style={styles.summaryBadge}>Save {formatINR(snapshot.taxSaving)}</Text>
          </View>

          <View style={styles.regimeRow}>
            <View style={[styles.regimeCard, snapshot.betterRegime === "old" ? styles.regimeCardWinner : null]}>
              <Text style={styles.regimeLabel}>Old regime</Text>
              <Text style={styles.regimeValue}>{formatINR(snapshot.oldTax)}</Text>
              <Text style={styles.regimeHelper}>Taxable income: {formatINR(snapshot.oldTaxableIncome)}</Text>
            </View>
            <View style={[styles.regimeCard, snapshot.betterRegime === "new" ? styles.regimeCardWinner : null]}>
              <Text style={styles.regimeLabel}>New regime</Text>
              <Text style={styles.regimeValue}>{formatINR(snapshot.newTax)}</Text>
              <Text style={styles.regimeHelper}>Taxable income: {formatINR(snapshot.newTaxableIncome)}</Text>
            </View>
          </View>

          <View style={styles.summaryStrip}>
            <Text style={styles.summaryStripLabel}>HRA exemption modeled</Text>
            <Text style={styles.summaryStripValue}>{formatINR(snapshot.hraExemption)}</Text>
          </View>
          <View style={styles.summaryStrip}>
            <Text style={styles.summaryStripLabel}>80C already used</Text>
            <Text style={styles.summaryStripValue}>{formatINR(snapshot.used80C)}</Text>
          </View>
          <View style={styles.summaryStrip}>
            <Text style={styles.summaryStripLabel}>Extra old-regime upside still available</Text>
            <Text style={styles.summaryStripValue}>{formatINR(snapshot.potentialAdditionalOldRegimeSaving)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Missing Deductions</Text>
        {snapshot.deductionOpportunities.length ? (
          <View style={styles.stack}>
            {snapshot.deductionOpportunities.map((item) => (
              <OpportunityCard item={item} key={item.id} />
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.allClearTitle}>No major deduction gaps detected</Text>
            <Text style={styles.sectionBody}>
              Your current inputs already use the main buckets this wizard models, so regime selection matters more than
              adding new products.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ranked Tax-Saving Moves</Text>
        <View style={styles.stack}>
          {snapshot.rankedRecommendations.map((item, index) => (
            <RecommendationCard item={item} key={item.id} rank={index + 1} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiTitle}>FinMentor summary</Text>
            <Button
              label={busy === "summary" ? "Refreshing..." : "Refresh"}
              loading={busy === "summary"}
              onPress={() => void handleRefreshSummary()}
              variant="secondary"
            />
          </View>
          {summaryError ? <Text style={styles.warningText}>{summaryError}</Text> : null}
          <Text style={styles.aiBody}>{summary || fallbackSummary}</Text>
        </View>
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
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
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
  uploadCard: {
    backgroundColor: "#EEF5FF",
    borderColor: "#D8E4F5",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  uploadCopy: {
    gap: Spacing.sm,
  },
  scanPreview: {
    borderRadius: Radius.md,
    height: 180,
    resizeMode: "cover",
    width: "100%",
  },
  scanNote: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  toggleShell: {
    gap: Spacing.sm,
  },
  toggleLabel: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  toggleChip: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  toggleChipActive: {
    backgroundColor: "#FFF4DB",
    borderColor: Colors.gold,
  },
  toggleChipLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  toggleChipLabelActive: {
    color: Colors.navy,
  },
  summaryCard: {
    backgroundColor: Colors.navy,
    borderColor: "rgba(12,35,64,0.12)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  summaryBadge: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  regimeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  regimeCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  regimeCardWinner: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(245,166,35,0.14)",
  },
  regimeLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    textTransform: "uppercase",
  },
  regimeValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
  },
  regimeHelper: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  summaryStrip: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStripLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  summaryStripValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  stack: {
    gap: Spacing.md,
  },
  opportunityCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  opportunityTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  opportunityValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.lg,
  },
  opportunityBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  recommendationCard: {
    backgroundColor: "#FFF9EC",
    borderColor: "#F1DFC2",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  recommendationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.md,
  },
  recommendationRank: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
  },
  recommendationTitle: {
    color: Colors.textPrimary,
    flex: 1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  recommendationMeta: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  recommendationValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  recommendationBody: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  aiCard: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  aiHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  aiTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  aiBody: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
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
  allClearTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
});
