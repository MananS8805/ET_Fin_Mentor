import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
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
import { IS_TAX_CONFIG_CURRENT, CURRENT_TAX_YEAR } from "../../src/core/config/tax";

function LoadingDots() {
  const d1 = useSharedValue(0.3);
  const d2 = useSharedValue(0.3);
  const d3 = useSharedValue(0.3);

  useEffect(() => {
    const animate = (dot: any, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
            withTiming(0.3, { duration: 260, easing: Easing.in(Easing.cubic) })
          ),
          -1,
          false
        )
      );
    };

    animate(d1, 0);
    animate(d2, 120);
    animate(d3, 240);
  }, [d1, d2, d3]);

  const s1 = useAnimatedStyle(() => ({ opacity: d1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: d2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: d3.value }));

  return (
    <View style={styles.loadingDotsRow}>
      <Animated.Text style={[styles.loadingDot, s1]}>.</Animated.Text>
      <Animated.Text style={[styles.loadingDot, s2]}>.</Animated.Text>
      <Animated.Text style={[styles.loadingDot, s3]}>.</Animated.Text>
    </View>
  );
}

function RecommendationAnimatedItem({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const y = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay, withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [delay, opacity, y]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

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
      dark
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
    Upload a Form 16 screenshot or enter your salary structure manually. The wizard compares regimes, surfaces
    deduction gaps, and ranks tax-saving moves for your profile.
  </Text>
  {!IS_TAX_CONFIG_CURRENT ? (
    <View style={styles.taxWarningCard}>
      <Text style={styles.taxWarningText}>
        ⚠ Tax slabs are for FY {CURRENT_TAX_YEAR}. Verify with a CA for the latest year.
      </Text>
    </View>
  ) : null}
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
  const winnerScale = useSharedValue(0.95);
  const heroY = useSharedValue(24);
  const heroOpacity = useSharedValue(0);

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
    winnerScale.value = 0.95;
    winnerScale.value = withSpring(1, { damping: 11, stiffness: 170 });
  }, [snapshot?.betterRegime, winnerScale]);

  useEffect(() => {
    heroY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
    heroOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [heroOpacity, heroY]);

  const winnerCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: winnerScale.value }],
  }));

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroY.value }],
  }));

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
      const msg = error instanceof Error ? error.message : "Parsing failed.";
      if (msg.includes("NOISY_DATA") || msg.includes("confidence")) {
        setScanNote("Image is blurry or missing key data. Please verify or enter manually below.");
      } else {
        setScanNote("Couldn't read Form 16 automatically. Please enter your salary details manually.");
      }
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
      <Animated.View style={[styles.hero, heroAnimatedStyle]}>
        <Text style={styles.eyebrow}>Phase 1</Text>
        <Text style={styles.title}>Tax Wizard</Text>
        <Text style={styles.subtitle}>
          Upload a Form 16 screenshot or enter your salary structure manually. The wizard compares regimes, surfaces
          deduction gaps, and ranks tax-saving moves for your profile.
        </Text>
        {!IS_TAX_CONFIG_CURRENT ? (
          <View style={styles.taxWarningCard}>
            <Text style={styles.taxWarningText}>⚠ Tax slabs are for FY {CURRENT_TAX_YEAR}. Verify with a CA for the latest year.</Text>
          </View>
        ) : null}
      </Animated.View>

      <View style={styles.section}>
        <View style={styles.uploadCard}>
          <View style={styles.uploadCopy}>
            <Text style={styles.sectionTitle}>Form 16 Upload</Text>
            <Text style={styles.sectionBody}>
              Upload a clear screenshot or image of Form 16. The wizard will try to pull salary, HRA, PF, and current
              deduction numbers into the form.
            </Text>
          </View>
          <View style={styles.uploadDropzone}>
            <Text style={styles.uploadIcon}>📄</Text>
            <Text style={styles.uploadDropHint}>Drop or select Form 16 image</Text>
          </View>
          <Pressable onPress={() => void handleParseForm16()} style={[styles.uploadButton, busy === "scan" ? styles.uploadButtonDisabled : null]}>
            <Text style={styles.uploadButtonText}>{busy === "scan" ? "Parsing..." : "Upload Form 16"}</Text>
          </Pressable>
          {scanPreview ? <Image source={{ uri: scanPreview }} style={styles.scanPreview} /> : null}
          {scanNote ? <Text style={styles.scanNote}>{scanNote}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeadingIcon}>💼</Text>
          <Text style={styles.sectionHeadingLabel}>Salary Structure</Text>
        </View>
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
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeadingIcon}>🧾</Text>
          <Text style={styles.sectionHeadingLabel}>Current Deductions</Text>
        </View>
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
          <CurrencyField
            label="Health insurance premium (80D)"
            hint="Self + family: up to ₹25,000. Add parents' premium for up to ₹75,000 total."
            onChange={(value) => updateDraft("annual80D", value)}
            value={draft.annual80D}
          />
          <CurrencyField
            label="Home loan interest paid (Sec 24b)"
            hint="Up to ₹2,00,000 deduction for self-occupied property. Old regime only."
            onChange={(value) => updateDraft("homeLoanInterest", value)}
            value={draft.homeLoanInterest}
          />
          <CurrencyField
            label="Professional tax paid"
            hint="Usually ₹200/month deducted by employer. Check your salary slip."
            onChange={(value) => updateDraft("professionalTax", value)}
            value={draft.professionalTax}
          />
        </View>

        {/* Not modeled disclaimer */}
        <View style={styles.notModeledCard}>
          <Text style={styles.notModeledTitle}>⚠ Not modeled in this tool</Text>
          <Text style={styles.notModeledBody}>
            The following exemptions are real but require CA verification and are not calculated here:{"\n"}
            {"• "}LTA (Leave Travel Allowance){"\n"}
            {"• "}80E — Education loan interest{"\n"}
            {"• "}80G — Donations to eligible NGOs{"\n"}
            {"• "}Meal / food allowance (₹26,400/yr){"\n"}
            {"• "}Gratuity exemption{"\n"}
            {"• "}80DD / 80U — Disability deductions{"\n"}
            {"• "}Children education allowance
          </Text>
          <Text style={styles.notModeledCta}>Consult a CA to claim these before filing.</Text>
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
            <Animated.View
              style={[
                styles.regimeCard,
                snapshot.betterRegime === "old" ? styles.regimeCardWinner : styles.regimeCardLoser,
                snapshot.betterRegime === "old" ? winnerCardStyle : null,
              ]}
            >
              <Text style={styles.regimeLabel}>Old regime</Text>
              <Text style={styles.regimeValue}>{formatINR(snapshot.oldTax)}</Text>
              <Text style={styles.regimeHelper}>Taxable income: {formatINR(snapshot.oldTaxableIncome)}</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.regimeCard,
                snapshot.betterRegime === "new" ? styles.regimeCardWinner : styles.regimeCardLoser,
                snapshot.betterRegime === "new" ? winnerCardStyle : null,
              ]}
            >
              <Text style={styles.regimeLabel}>New regime</Text>
              <Text style={styles.regimeValue}>{formatINR(snapshot.newTax)}</Text>
              <Text style={styles.regimeHelper}>Taxable income: {formatINR(snapshot.newTaxableIncome)}</Text>
            </Animated.View>
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
            <RecommendationAnimatedItem delay={index * 80} key={item.id}>
              <RecommendationCard item={item} rank={index + 1} />
            </RecommendationAnimatedItem>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiTitle}>FinMentor summary</Text>
            <Pressable onPress={() => void handleRefreshSummary()} style={styles.refreshGhostBtn}>
              <Text style={styles.refreshGhostText}>{busy === "summary" ? "Refreshing..." : "Refresh"}</Text>
            </Pressable>
          </View>
          {summaryError ? <Text style={styles.warningText}>{summaryError}</Text> : null}
          {busy === "summary" ? (
            <View style={styles.summaryLoadingRow}>
              <Text style={styles.loadingText}>FinMentor is thinking</Text>
              <LoadingDots />
            </View>
          ) : null}
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
    alignSelf: "flex-start",
    backgroundColor: "rgba(212,175,55,0.12)",
    borderColor: "rgba(212,175,55,0.3)",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  title: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.display,
    fontSize: 28,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 24,
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  sectionHeadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  sectionHeadingIcon: {
    fontSize: 14,
  },
  sectionHeadingLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionBody: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  uploadCard: {
    backgroundColor: Colors.tealDim,
    borderColor: "rgba(31,190,114,0.20)",
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
  uploadDropzone: {
    alignItems: "center",
    borderColor: "rgba(29,158,117,0.3)",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1,
    gap: Spacing.sm,
    justifyContent: "center",
    padding: 20,
  },
  uploadIcon: {
    fontSize: 18,
  },
  uploadDropHint: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
  },
  uploadButton: {
    alignItems: "center",
    backgroundColor: Colors.teal,
    borderRadius: Radius.full,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  card: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b1,
    borderRadius: 20,
    borderWidth: 0.5,
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  toggleShell: {
    gap: Spacing.sm,
  },
  toggleLabel: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  toggleChip: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  toggleChipActive: {
    backgroundColor: "rgba(212,175,55,0.12)",
    borderColor: Colors.gold,
  },
  toggleChipLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  toggleChipLabelActive: {
    color: Colors.gold,
  },
  summaryCard: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b1,
    borderRadius: 24,
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
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 18,
  },
  summaryBadge: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  regimeRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  regimeCard: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b0,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  regimeCardWinner: {
    backgroundColor: Colors.goldDim2,
    borderColor: Colors.gold,
    borderWidth: 1,
    opacity: 1,
  },
  regimeCardLoser: {
    backgroundColor: Colors.s1,
    borderColor: Colors.b0,
    opacity: 0.65,
  },
  regimeLabel: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  regimeValue: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 24,
  },
  regimeHelper: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 20,
  },
  summaryStrip: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStripLabel: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  summaryStripValue: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: Typography.size.md,
  },
  stack: {
    gap: Spacing.md,
  },
  opportunityCard: {
    backgroundColor: Colors.tealDim,
    borderColor: "rgba(31,190,114,0.20)",
    borderRadius: 16,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  opportunityTitle: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  opportunityValue: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 20,
  },
  opportunityBody: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  recommendationCard: {
    backgroundColor: Colors.amberDim,
    borderColor: "rgba(200,168,75,0.15)",
    borderRadius: 16,
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
    fontFamily: Typography.fontFamily.numeric,
    fontSize: 22,
  },
  recommendationTitle: {
    color: Colors.t0,
    flex: 1,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  recommendationMeta: {
    color: Colors.t2,
    fontFamily: Typography.fontFamily.body,
    fontSize: 11,
    borderColor: Colors.b1,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    alignSelf: "flex-start",
    backgroundColor: Colors.s2,
  },
  recommendationValue: {
    color: Colors.t0,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 16,
  },
  recommendationBody: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  aiCard: {
    backgroundColor: Colors.purpleDim,
    borderColor: "rgba(133,114,224,0.20)",
    borderRadius: 20,
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
    color: Colors.t0,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  aiBody: {
    color: Colors.t1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 24,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  loadingText: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  refreshGhostBtn: {
    alignItems: "center",
    borderColor: "rgba(127,119,221,0.2)",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: Spacing.md,
  },
  refreshGhostText: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  summaryLoadingRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  loadingDotsRow: {
    flexDirection: "row",
    marginLeft: 4,
  },
  loadingDot: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 16,
    marginRight: 1,
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
    taxWarningCard: {
      backgroundColor: "rgba(212,175,55,0.08)",
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: "rgba(212,175,55,0.2)",
      padding: Spacing.md,
    },
    taxWarningText: {
        color: Colors.gold,
      fontFamily: Typography.fontFamily.bodyMedium,
      fontSize: Typography.size.sm,
      lineHeight: 20,
    },
      notModeledCard: {
    backgroundColor: "rgba(217,142,56,0.08)",
    borderColor: "rgba(217,142,56,0.25)",
    borderRadius: 16,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  notModeledTitle: {
    color: Colors.amber,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  notModeledBody: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  notModeledCta: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },

});
