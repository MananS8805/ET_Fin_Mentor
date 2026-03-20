import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { VictoryPie } from "victory-native";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { AuthService } from "../../src/core/services/AuthService";
import {
  MFHolding,
  OverlapPair,
  PortfolioXRay,
  calculateXIRR,
  formatINR,
  getCategoryAllocation,
  getExpenseRatioDrag,
  getOverlapPairs,
} from "../../src/core/models/UserProfile";
import { CAMSParseResult, GeminiService } from "../../src/core/services/GeminiService";
import {
  calculateMetrics,
  PortfolioMetrics,
  Fund,
  Transaction,
  HoldingWithOverlap,
} from "../../src/core/services/MutualFundService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";
import { AtAGlanceHeader } from "./components/AtAGlanceHeader";
import { FundPerformanceTable } from "./components/FundPerformanceTable";
import { SmartRecommendationPanel } from "./components/SmartRecommendationPanel";
import { SchemeInputForm } from "./components/SchemeInputForm";
import { HoldingEditModal } from "./components/HoldingEditModal";
import ManualFundEntry from "./components/ManualFundEntry";

// ─── helpers ────────────────────────────────────────────────────────────────

function xirrColor(xirr: number | null): string {
  if (xirr === null) return Colors.textMuted;
  if (xirr >= 12) return Colors.teal;
  if (xirr >= 8) return Colors.gold;
  return Colors.red;
}

function xirrLabel(xirr: number | null): string {
  if (xirr === null) return "Insufficient data";
  return `${xirr.toFixed(1)}% XIRR`;
}

const CATEGORY_LABELS: Record<MFHolding["category"], string> = {
  large_cap: "Large cap",
  mid_cap: "Mid cap",
  small_cap: "Small cap",
  elss: "ELSS",
  debt: "Debt",
  hybrid: "Hybrid",
  liquid: "Liquid",
  other: "Other",
};

const PIE_COLORS = [
  Colors.navy,
  Colors.teal,
  Colors.gold,
  Colors.purple,
  Colors.red,
  "#2E5B9A",
  "#1D9E75",
  "#888",
];

// Build a PortfolioXRay from an array of MFHolding — pure, offline
function buildXRay(holdings: MFHolding[]): PortfolioXRay {
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.purchaseValue, 0);

  // Collect all actual transactions from holdings
  const allCashflows: Array<{ date: Date; amount: number }> = [];
  
  holdings.forEach(h => {
    // Assuming transactions are part of the MFHolding type, which they should be
    // This part of the schema might need to be adjusted if not.
    // For now, let's assume `h.transactions` exists and is an array of { date: Date; amount: number }
    if (h.transactions && h.transactions.length > 0) {
      h.transactions.forEach(t => {
        allCashflows.push({ date: new Date(t.date), amount: -t.amount }); // Negative for investments
      });
    } else {
      // Fallback: assume purchase was when purchaseValue was invested
      // This is still an approximation but better than hardcoded 365 days
      const estimatedDate = new Date(Date.now() - 180 * 24 * 3600 * 1000); // 6 months ago
      allCashflows.push({ date: estimatedDate, amount: -h.purchaseValue });
    }
  });

  // Add current value as final positive cashflow
  if (totalValue > 0) {
    allCashflows.push({ date: new Date(), amount: totalValue });
  }

  const overallXIRR = allCashflows.length >= 2 ? calculateXIRR(allCashflows) : null;

  return {
    holdings,
    totalValue,
    totalInvested,
    overallXIRR,
    overlapPairs: getOverlapPairs(holdings),
    expenseRatioDrag: getExpenseRatioDrag(holdings),
    categoryAllocation: getCategoryAllocation(holdings),
  };
}

// Map CAMSParseResult → MFHolding[]
function mapCAMSToHoldings(result: CAMSParseResult): MFHolding[] {
  return result.holdings
    .filter((h) => h.name && h.currentValue > 0)
    .map((h, index) => {
      // Create cashflows for XIRR: investments are negative
      const cashflows = (h.transactions ?? [])
        .filter((t) => t.date && t.amount !== undefined)
        .map((t) => ({ date: new Date(t.date), amount: -t.amount })); // Note the negative sign

      // Add the current value as the final positive cashflow
      cashflows.push({ date: new Date(), amount: h.currentValue });

      const xirr = cashflows.length >= 2 ? calculateXIRR(cashflows) : null;

      const rawCategory = (h.category ?? "other").toLowerCase().replace(/\s+/g, "_");
      const validCategories: MFHolding["category"][] = [
        "large_cap", "mid_cap", "small_cap", "elss", "debt", "hybrid", "liquid", "other",
      ];
      const category = validCategories.includes(rawCategory as MFHolding["category"])
        ? (rawCategory as MFHolding["category"])
        : "other";

      return {
        id: `h-${index}`,
        name: h.name,
        category,
        units: h.units ?? 0,
        nav: h.nav ?? 0,
        currentValue: h.currentValue,
        purchaseValue: h.purchaseValue ?? h.currentValue,
        xirr,
        // Ensure transactions are carried over if they exist
        transactions: (h.transactions ?? []).map(t => ({...t, date: new Date(t.date)}))
      };
    });
}

// Fallback rebalancing text built purely from xray numbers
function buildFallbackPlan(xray: PortfolioXRay): string {
  const lines: string[] = [];

  if (xray.overlapPairs.length > 0) {
    const pair = xray.overlapPairs[0];
    lines.push(
      `1. Consider consolidating ${pair.fund1} and ${pair.fund2} — ${pair.reason}`
    );
  } else {
    lines.push("1. No significant fund overlap detected in your current portfolio.");
  }

  if (xray.expenseRatioDrag > 0) {
    lines.push(
      `2. Your portfolio costs roughly ${formatINR(xray.expenseRatioDrag)} more per year than an equivalent index fund — consider switching high-expense funds to direct plans or index alternatives.`
    );
  } else {
    lines.push("2. Expense ratio drag is within acceptable range.");
  }

  const equityPct =
    (xray.categoryAllocation.large_cap ?? 0) +
    (xray.categoryAllocation.mid_cap ?? 0) +
    (xray.categoryAllocation.small_cap ?? 0) +
    (xray.categoryAllocation.elss ?? 0) +
    (xray.categoryAllocation.hybrid ?? 0);

  if (equityPct > 90) {
    lines.push(
      "3. Portfolio is heavily equity-concentrated — consider adding a debt or liquid fund for stability as you approach your goals."
    );
  } else if (equityPct < 40) {
    lines.push(
      "3. Equity allocation looks low for long-term wealth creation — review whether your goal horizon supports more equity exposure."
    );
  } else {
    lines.push(
      `3. Equity allocation is ${equityPct.toFixed(0)}% — broadly reasonable. Review annually and rebalance if equity drifts more than 10% from your target.`
    );
  }

  return lines.join("\n\n");
}

// ─── sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.hero}>
        {/* Removed Day 10 */}
        <Text style={styles.title}>Portfolio X-Ray</Text>
        <Text style={styles.subtitle}>
          Finish onboarding first so the X-Ray can align your risk profile and goals with the rebalancing plan.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>X-Ray unlocks after profile setup</Text>
        <Text style={styles.cardBody}>
          We need your risk profile before we can generate a personalised rebalancing recommendation.
        </Text>
        <Button label="Go To Onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

function HoldingCard({ holding, onEdit }: { holding: MFHolding; onEdit?: () => void }) {
  const color = xirrColor(holding.xirr);
  return (
    <TouchableOpacity style={styles.holdingCard} onPress={onEdit} disabled={!onEdit}>
      <View style={styles.holdingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.holdingName} numberOfLines={2}>{holding.name}</Text>
          <View style={[styles.categoryTag, { borderColor: Colors.border }]}>
            <Text style={styles.categoryTagText}>{CATEGORY_LABELS[holding.category]}</Text>
          </View>
        </View>
        {onEdit && (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>✎ Edit</Text>
          </View>
        )}
      </View>
      <View style={styles.holdingMetaRow}>
        <View>
          <Text style={styles.metaLabel}>Current value</Text>
          <Text style={styles.metaValue}>{formatINR(holding.currentValue)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.metaLabel}>Returns</Text>
          <Text style={[styles.metaValue, { color }]}>{xirrLabel(holding.xirr)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function OverlapCard({ pair }: { pair: OverlapPair }) {
  const borderColor = pair.overlapLevel === "high" ? Colors.red : Colors.gold;
  const labelColor = pair.overlapLevel === "high" ? Colors.red : Colors.gold;
  const bg = pair.overlapLevel === "high" ? "#FFF1F1" : "#FFFBF0";
  return (
    <View style={[styles.overlapCard, { backgroundColor: bg, borderColor }]}>
      <Text style={[styles.overlapLevel, { color: labelColor }]}>
        {pair.overlapLevel.toUpperCase()} OVERLAP
      </Text>
      <Text style={styles.overlapFunds}>
        {pair.fund1} &amp; {pair.fund2}
      </Text>
      <Text style={styles.overlapReason}>{pair.reason}</Text>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function PortfolioXRayScreen() {
  const profile = useAppStore((state) => state.currentProfile);
  const setCurrentProfile = useAppStore((state) => state.setCurrentProfile);
  const portfolioXRay = useAppStore((state) => state.portfolioXRay);
  const setPortfolioXRay = useAppStore((state) => state.setPortfolioXRay);
  const shareCardRef = useRef<ViewShot | null>(null);
  const { width } = useWindowDimensions();

  const [holdings, setHoldings] = useState<MFHolding[]>(portfolioXRay?.holdings ?? []);
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState("");
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [editingHolding, setEditingHolding] = useState<MFHolding | null>(null);

  // New metrics state for MutualFundService
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [fundMetrics, setFundMetrics] = useState<Array<{ fund: Fund; metrics: PortfolioMetrics }>>([]);

  const xray = useMemo(() => buildXRay(holdings), [holdings]);
  const fallbackPlan = useMemo(() => buildFallbackPlan(xray), [xray]);

  // Pie chart data — filter out zero-allocation categories
  const pieData = useMemo(() => {
    return Object.entries(xray.categoryAllocation)
      .filter(([, pct]) => pct > 0)
      .map(([cat, pct]) => ({
        x: CATEGORY_LABELS[cat as MFHolding["category"]],
        y: pct,
      }));
  }, [xray.categoryAllocation]);

  const recommendationMetrics = useMemo(() => portfolioMetrics ? [portfolioMetrics] : [], [portfolioMetrics]);
  const fundNamesList = useMemo(() => holdings.map((h) => h.name), [holdings]);

  // Persist to store whenever holdings change
  useEffect(() => {
    if (holdings.length > 0) {
      setPortfolioXRay(xray);
    }
  }, [holdings, xray, setPortfolioXRay]);

  // Fetch AI plan whenever holdings load
  useEffect(() => {
    if (!profile || holdings.length === 0) return;

    let active = true;

    void (async () => {
      try {
        setPlanLoading(true);
        setPlanError("");
        const result = await GeminiService.getPortfolioRebalancingPlan(profile, xray);
        if (active) setPlan(result);
      } catch (error) {
        if (active) {
          setPlan(fallbackPlan);
          setPlanError(
            error instanceof Error ? error.message : "Showing offline rebalancing plan."
          );
        }
      } finally {
        if (active) setPlanLoading(false);
      }
    })();

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  // Calculate metrics using MutualFundService when holdings change
  useEffect(() => {
    if (holdings.length === 0) {
      setPortfolioMetrics(null);
      setFundMetrics([]);
      return;
    }

    let active = true;

    void (async () => {
      try {
        setMetricsLoading(true);

        // Convert MFHoldings to Fund objects and Transactions for MutualFundService
        const fundMetricsToCalc: Array<{
          fund: Fund;
          transactions: Transaction[];
        }> = holdings.map((holding) => ({
          fund: {
            schemeCode: holding.id,
            schemeName: holding.name,
            category: holding.category,
            nav: holding.nav,
            expenseRatio: 0.75, // Default; would ideally come from API or input
          },
          transactions: [
            {
              date: new Date(Date.now() - 365 * 24 * 3600 * 1000),
              amount: holding.purchaseValue,
              units: holding.units,
            },
          ],
        }));

        // Calculate metrics for each fund
        const metricsResults: Array<{
          fund: Fund;
          metrics: PortfolioMetrics;
        }> = [];

        for (const item of fundMetricsToCalc) {
          const metrics = await calculateMetrics(item.transactions, item.fund, false);
          if (metrics) {
            metricsResults.push({ fund: item.fund, metrics });
          }
        }

        if (active) {
          setFundMetrics(metricsResults);

          // Calculate portfolio-level metrics
          const totalInvested = metricsResults.reduce((sum, m) => sum + m.metrics.totalInvested, 0);
          const currentValue = metricsResults.reduce((sum, m) => sum + m.metrics.currentValue, 0);
          const totalReturn = currentValue - totalInvested;
          const absoluteReturn = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
          const avgXIRR =
            metricsResults.length > 0
              ? metricsResults.reduce((sum, m) => sum + m.metrics.xirr, 0) / metricsResults.length
              : 0;
          const totalExpenseDrag = metricsResults.reduce((sum, m) => sum + m.metrics.expenseDragAnnual, 0);

          const portfolioLevelMetrics: PortfolioMetrics = {
            totalInvested,
            currentValue,
            totalReturn,
            absoluteReturn,
            xirr: avgXIRR,
            expenseDragAnnual: totalExpenseDrag,
            lastUpdated: Date.now(),
          };

          setPortfolioMetrics(portfolioLevelMetrics);
        }
      } catch (error) {
        console.error("Error calculating metrics:", error);
      } finally {
        if (active) setMetricsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [holdings]);

  if (!profile) return <EmptyState />;

  const currentProfile = profile;

  async function handleAddSchemeCodes(codes: string[]) {
    if (!currentProfile) return;
    try {
      setParsing(true);
      
      const validCodes = codes.filter(code => /^\d{6}$/.test(code.trim()));
      if (validCodes.length === 0) {
        Alert.alert("Error", "Please enter valid 6-digit scheme codes");
        return;
      }
      if (validCodes.length > 20) {
        Alert.alert("Error", "Maximum 20 schemes at a time");
        return;
      }

      const newHoldings: MFHolding[] = [];
      
      const fetchWithTimeout = (url: string, timeout = 5000) => {
        return Promise.race([
          fetch(url),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]);
      };

      for (const code of validCodes) {
        try {
          const res = await fetchWithTimeout(`https://api.mfapi.in/mf/${code}`) as Response;
          const json = await res.json();
          if (json.status === "SUCCESS") {
            const nav = Number(json.data[0]?.nav) || 10;
            
            const amfiCat = (json.meta.scheme_category || "").toLowerCase();
            let mappedCat: MFHolding["category"] = "other";
            if (amfiCat.includes("large")) mappedCat = "large_cap";
            else if (amfiCat.includes("mid")) mappedCat = "mid_cap";
            else if (amfiCat.includes("small")) mappedCat = "small_cap";
            else if (amfiCat.includes("equity") || amfiCat.includes("flexi") || amfiCat.includes("multi")) mappedCat = "large_cap";
            else if (amfiCat.includes("elss")) mappedCat = "elss";
            else if (amfiCat.includes("debt") || amfiCat.includes("bond")) mappedCat = "debt";
            else if (amfiCat.includes("hybrid") || amfiCat.includes("balanced") || amfiCat.includes("arbitrage")) mappedCat = "hybrid";
            else if (amfiCat.includes("liquid")) mappedCat = "liquid";

            newHoldings.push({
              id: code.toString(),
              name: json.meta.scheme_name,
              category: mappedCat,
              purchaseValue: nav * 100, 
              currentValue: nav * 100,
              nav: nav,
              units: 100,
              xirr: null,
            });
          }
        } catch (e) {
          console.error("Failed to fetch MFAPI for code: " + code, e);
        }
      }
      
      if (newHoldings.length === 0) {
        Alert.alert("Error", "Could not verify any of the scheme codes. Please try again.");
        return;
      }
      
      setHoldings((prev) => {
        const next = [...prev, ...newHoldings];
        setCurrentProfile({
          ...currentProfile,
          camsData: {
            ...currentProfile.camsData,
            holdings: next,
          }
        });
        return next;
      });
      
      Alert.alert("Success", `Successfully fetched ${newHoldings.length} funds. A default of 100 units is applied. Click the Edit button on the holdings below to adjust your true invested amount.`);
    } finally {
      setParsing(false);
    }
  }

  async function handleParseStatement() {
    try {
      setParsing(true);
      setPlanError("");
      setParseNote("");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        base64: true,
        quality: 0.9,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("Image did not include base64 data.");

      const parsed = await GeminiService.parseCAMSStatement(
        asset.base64,
        asset.mimeType ?? "image/jpeg"
      );

      const mapped = mapCAMSToHoldings(parsed);
      if (mapped.length === 0) {
        throw new Error(
          "No fund holdings found in the image. Try a clearer screenshot showing fund names and values."
        );
      }

      setScanPreview(asset.uri);
      setParseNote(
        parsed.notes ??
          `${mapped.length} fund${mapped.length !== 1 ? "s" : ""} detected. Review the values before relying on them for decisions.`
      );
      setHoldings(mapped);
    } catch (error) {
      Alert.alert(
        "Unable to parse statement",
        error instanceof Error ? error.message : "Please try a clearer image."
      );
    } finally {
      setParsing(false);
    }
  }

  async function handleRefreshPlan() {
    try {
      setPlanLoading(true);
      setPlanError("");
      const result = await GeminiService.getPortfolioRebalancingPlan(currentProfile, xray);
      setPlan(result);
    } catch (error) {
      setPlan(fallbackPlan);
      setPlanError(
        error instanceof Error ? error.message : "Showing offline rebalancing plan."
      );
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleShare() {
    try {
      setSharing(true);

      const canBio = await AuthService.canUseBiometric();
      if (canBio) {
        const verified = await AuthService.promptBiometric("Confirm before sharing portfolio card");
        if (!verified) return;
      }

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Sharing is not available on this device.");
      }

      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error("Unable to generate the share card.");

      await Sharing.shareAsync(uri, {
        dialogTitle: "Share your ET FinMentor portfolio X-Ray",
      });
    } catch (error) {
      Alert.alert(
        "Unable to share",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSharing(false);
    }
  }

  function handleSaveEditedHolding(updatedHolding: MFHolding) {
    setHoldings((prev) =>
      prev.map((h) => (h.id === updatedHolding.id ? updatedHolding : h))
    );
    setEditingHolding(null);
    Alert.alert("Success", "Holding updated successfully.");
  }

  const overallXirrColor = xirrColor(xray.overallXIRR);
  const chartWidth = Math.min(width - Spacing["3xl"] * 2, 320);

  return (
    <Screen scroll>
      {/* ── Hero ── */}
      <Animatable.View animation="fadeInUp" duration={500} style={styles.hero}>
        {/* Removed Day 10 */}
        <Text style={styles.title}>Portfolio X-Ray</Text>
        <Text style={styles.subtitle}>
          Enter your fund holdings or upload a CAMS/KFintech statement to get your true XIRR,
          fund overlap, expense drag, and a personalised rebalancing plan.
        </Text>
      </Animatable.View>

      {/* ── Manual Input Section (Primary) ── */}
      <Animatable.View animation="fadeInUp" delay={50} duration={500} style={styles.section}>
        <SchemeInputForm
          onSubmit={(codes) => void handleAddSchemeCodes(codes)}
          isLoading={parsing}
        />
      </Animatable.View>

      {/* ── Upload ── */}
      <Animatable.View animation="fadeInUp" delay={80} duration={500} style={styles.section}>
        <View style={styles.uploadCard}>
          <Text style={styles.sectionTitle}>Upload statement</Text>
          <Text style={styles.cardBody}>
            Take a clear screenshot of your CAMS or KFintech consolidated statement showing fund
            names, units, NAV, and current value.
          </Text>
          <Button
            label={parsing ? "Analysing portfolio..." : "Upload CAMS / KFintech"}
            loading={parsing}
            onPress={() => void handleParseStatement()}
          />
          {scanPreview ? (
            <Image source={{ uri: scanPreview }} style={styles.scanPreview} />
          ) : null}
          {parseNote ? <Text style={styles.parseNote}>{parseNote}</Text> : null}
        </View>
      </Animatable.View>

      {holdings.length > 0 ? (
        <>
          {/* ── New Metrics Dashboard ── */}
          <Animatable.View animation="fadeInUp" delay={100} duration={500} style={styles.section}>
            <AtAGlanceHeader metrics={portfolioMetrics} previousValue={xray.totalInvested} />
          </Animatable.View>

          {/* ── Fund Performance Table ── */}
          {fundMetrics.length > 0 && (
            <Animatable.View animation="fadeInUp" delay={140} duration={500} style={styles.section}>
              <FundPerformanceTable
                funds={fundMetrics.map((item) => ({
                  fund: item.fund,
                  metrics: item.metrics,
                }))}
              />
            </Animatable.View>
          )}

          {/* ── Smart Recommendations ── */}
          {portfolioMetrics && (
            <Animatable.View animation="fadeInUp" delay={160} duration={500} style={styles.section}>
              <SmartRecommendationPanel
                metrics={recommendationMetrics}
                fundNames={fundNamesList}
              />
            </Animatable.View>
          )}

          {/* ── Summary strip ── */}
          <Animatable.View animation="fadeInUp" delay={220} duration={500} style={styles.section}>
            <View style={styles.summaryStrip}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Portfolio value</Text>
                <Text style={styles.summaryValue}>{formatINR(xray.totalValue)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Overall XIRR</Text>
                <Text style={[styles.summaryXirr, { color: overallXirrColor }]}>
                  {xray.overallXIRR !== null ? `${xray.overallXIRR.toFixed(1)}%` : "—"}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>Expense drag</Text>
                <Text style={styles.summaryDrag}>{formatINR(xray.expenseRatioDrag)}/yr</Text>
              </View>
            </View>
          </Animatable.View>

          {/* ── Benchmark Comparison ── */}
          <Animatable.View animation="fadeInUp" delay={240} duration={500} style={styles.section}>
            <Text style={styles.sectionTitle}>Benchmark Comparison (NIFTY 50)</Text>
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View>
                  <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.sm, marginBottom: 4 }}>Your XIRR</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.display, fontSize: 24, color: overallXirrColor }}>
                    {xray.overallXIRR !== null ? `${xray.overallXIRR.toFixed(1)}%` : "—"}
                  </Text>
                </View>
                <View>
                  <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.sm, marginBottom: 4 }}>NIFTY 50</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.display, fontSize: 24, color: Colors.textPrimary }}>
                    12.5%
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.sm, marginBottom: 4 }}>Alpha</Text>
                  <Text style={{ fontFamily: Typography.fontFamily.display, fontSize: 24, color: (xray.overallXIRR || 0) >= 12.5 ? Colors.teal : Colors.red }}>
                    {xray.overallXIRR !== null ? `${((xray.overallXIRR || 0) - 12.5) > 0 ? "+" : ""}${((xray.overallXIRR || 0) - 12.5).toFixed(1)}%` : "—"}
                  </Text>
                </View>
              </View>
              <Text style={{ color: Colors.textSecondary, fontSize: Typography.size.sm, lineHeight: 20 }}>
                Alpha is your excess return relative to the benchmark. A positive alpha means your fund selection is outperforming a simple low-cost index fund.
              </Text>
            </View>
          </Animatable.View>

          {/* ── Category donut ── */}
          {pieData.length > 0 ? (
            <Animatable.View animation="fadeInUp" delay={260} duration={500} style={styles.section}>
              <Text style={styles.sectionTitle}>Category allocation</Text>
              <View style={styles.card}>
                <VictoryPie
                  data={pieData}
                  width={chartWidth}
                  height={chartWidth}
                  colorScale={PIE_COLORS}
                  innerRadius={chartWidth * 0.22}
                  padAngle={2}
                  labels={({ datum }) => `${datum.x}\n${(datum.y as number).toFixed(0)}%`}
                  style={{
                    labels: {
                      fontFamily: Typography.fontFamily.body,
                      fontSize: 11,
                      fill: Colors.textSecondary,
                    },
                  }}
                  padding={64}
                />
              </View>
            </Animatable.View>
          ) : null}

          {/* ── Holdings list ── */}
          <Animatable.View animation="fadeInUp" delay={300} duration={500} style={styles.section}>
            <Text style={styles.sectionTitle}>Holdings ({holdings.length})</Text>
            <View style={styles.stack}>
              {holdings.map((h) => (
                <HoldingCard
                  key={h.id}
                  holding={h}
                  onEdit={() => setEditingHolding(h)}
                />
              ))}
            </View>
          </Animatable.View>

          {/* ── Overlap alerts ── */}
          {xray.overlapPairs.length > 0 ? (
            <Animatable.View animation="fadeInUp" delay={340} duration={500} style={styles.section}>
              <Text style={styles.sectionTitle}>Fund overlap detected</Text>
              <View style={styles.stack}>
                {xray.overlapPairs.map((pair, i) => (
                  <OverlapCard key={i} pair={pair} />
                ))}
              </View>
            </Animatable.View>
          ) : null}

          {/* ── Expense drag ── */}
          <Animatable.View animation="fadeInUp" delay={380} duration={500} style={styles.section}>
            <Text style={styles.sectionTitle}>Expense ratio drag</Text>
            <View style={styles.dragCard}>
              <Text style={styles.dragValue}>{formatINR(xray.expenseRatioDrag)}</Text>
              <Text style={styles.dragLabel}>lost per year vs index equivalent (0.1% TER)</Text>
              <Text style={styles.cardBody}>
                Switching high-expense funds to their direct plan equivalent or a Nifty 50 index
                fund is the single easiest way to recover this amount annually.
              </Text>
            </View>
          </Animatable.View>

          {/* ── AI rebalancing plan ── */}
          <Animatable.View animation="fadeInUp" delay={420} duration={500} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rebalancing plan</Text>
              <Button
                label={planLoading ? "Refreshing..." : "Refresh"}
                loading={planLoading}
                onPress={() => void handleRefreshPlan()}
                variant="secondary"
              />
            </View>
            {planError ? <Text style={styles.warningText}>{planError}</Text> : null}
            <View style={styles.planCard}>
              {planLoading && !plan ? (
                <Text style={styles.loadingText}>FinMentor is building your plan...</Text>
              ) : (
                <Text style={styles.planText}>{plan || fallbackPlan}</Text>
              )}
            </View>
          </Animatable.View>

          {/* ── Share ── */}
          <Animatable.View animation="fadeInUp" delay={460} duration={500} style={styles.section}>
            <View style={styles.shareOuter}>
              <View style={styles.shareHeader}>
                <Text style={styles.shareTitle}>Share X-Ray summary</Text>
                <Button
                  label="Share Card"
                  loading={sharing}
                  onPress={() => void handleShare()}
                />
              </View>
              <Text style={styles.shareBody}>
                Biometric confirmation required. Card shows portfolio value and XIRR only — no
                fund names or rupee breakdowns.
              </Text>
            </View>
          </Animatable.View>
        </>
      ) : (
        /* ── Empty holdings placeholder ── */
        <Animatable.View animation="fadeInUp" delay={140} duration={500} style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No portfolio data yet</Text>
            <Text style={styles.cardBody}>
              Upload a CAMS or KFintech consolidated account statement above. A single clear
              screenshot of the summary page is usually enough.
            </Text>
          </View>
        </Animatable.View>
      )}

      {/* ── Off-screen ViewShot capture card ── */}
      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.captureCard}>
            <Text style={styles.captureBrand}>ET FinMentor · Portfolio X-Ray</Text>
            <Text style={styles.captureValue}>{formatINR(xray.totalValue)}</Text>
            <Text style={styles.captureLabel}>Portfolio value</Text>
            <View style={styles.captureDivider} />
            <Text style={[styles.captureXirr, { color: overallXirrColor }]}>
              {xray.overallXIRR !== null ? `${xray.overallXIRR.toFixed(1)}% XIRR` : "XIRR: insufficient data"}
            </Text>
            <Text style={styles.captureLabel}>
              {holdings.length} fund{holdings.length !== 1 ? "s" : ""} analysed
            </Text>
          </View>
        </ViewShot>
      </View>

      {/* ── Holding Edit Modal ── */}
      {editingHolding && (
        <HoldingEditModal
          holding={editingHolding}
          isVisible={!!editingHolding}
          onClose={() => setEditingHolding(null)}
          onSave={handleSaveEditedHolding}
        />
      )}
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
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stack: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    padding: Spacing.xl,
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
  uploadCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  scanPreview: {
    width: "100%",
    height: 160,
    borderRadius: Radius.md,
    resizeMode: "cover",
  },
  parseNote: {
    color: Colors.teal,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  summaryStrip: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    flexDirection: "row",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  summaryCol: {
    flex: 1,
    gap: Spacing.xs,
  },
  summaryDivider: {
    width: 0.5,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
  },
  summaryValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
  },
  summaryXirr: {
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.lg,
  },
  summaryDrag: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.md,
  },
  holdingCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  holdingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  holdingName: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    flex: 1,
    lineHeight: 22,
  },
  categoryTag: {
    borderWidth: 0.5,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  categoryTagText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
  },
  editBadge: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  editBadgeText: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
  },
  holdingMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.xs,
    marginBottom: 2,
  },
  metaValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: Typography.size.md,
  },
  overlapCard: {
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  overlapLevel: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    letterSpacing: 0.6,
  },
  overlapFunds: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
    lineHeight: 22,
  },
  overlapReason: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  dragCard: {
    backgroundColor: "#FFF8E8",
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "#F0D990",
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  dragValue: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size["2xl"],
  },
  dragLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  planText: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 26,
  },
  loadingText: {
    color: Colors.purple,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  shareOuter: {
    backgroundColor: Colors.navy,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: "rgba(12,35,64,0.15)",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  shareHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shareTitle: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.lg,
  },
  shareBody: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  captureContainer: {
    left: -9999,
    position: "absolute",
    top: 0,
  },
  captureCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 28,
    width: 340,
    gap: Spacing.sm,
  },
  captureBrand: {
    color: Colors.navy,
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.md,
    marginBottom: Spacing.md,
  },
  captureValue: {
    color: Colors.textPrimary,
    fontFamily: Typography.fontFamily.display,
    fontSize: 44,
  },
  captureLabel: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
  },
  captureDivider: {
    backgroundColor: Colors.border,
    height: 1,
    marginVertical: Spacing.md,
  },
  captureXirr: {
    fontFamily: Typography.fontFamily.display,
    fontSize: Typography.size.xl,
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