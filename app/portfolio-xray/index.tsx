import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { VictoryPie } from "victory-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { ProfileService } from "../../src/core/services/ProfileService";
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
} from "../../src/core/services/MutualFundService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Spacing, Typography } from "../../src/core/theme";
import { AtAGlanceHeader } from "./components/AtAGlanceHeader";
import { FundPerformanceTable } from "./components/FundPerformanceTable";
import { SmartRecommendationPanel } from "./components/SmartRecommendationPanel";
import { SchemeInputForm } from "./components/SchemeInputForm";
import { HoldingEditModal } from "./components/HoldingEditModal";

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

const CATEGORY_THEME: Record<MFHolding["category"], string> = {
  large_cap: "#378ADD",
  mid_cap: "#1D9E75",
  small_cap: "#E24B4A",
  elss: "#7F77DD",
  debt: "#2E5B9A",
  hybrid: "#D4AF37",
  liquid: "#1D9E75",
  other: "#888888",
};

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

function HoldingCard({
  holding,
  onEdit,
  index,
}: {
  holding: MFHolding;
  onEdit?: () => void;
  index: number;
}) {
  const color = xirrColor(holding.xirr);
  const categoryColor = CATEGORY_THEME[holding.category] ?? "#888888";
  const y = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(index * 40, withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(index * 40, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [index, opacity, y]);

  const itemAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <Animated.View style={itemAnimatedStyle}>
      <TouchableOpacity style={styles.holdingCard} onPress={onEdit} disabled={!onEdit}>
      <View style={styles.holdingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.holdingName} numberOfLines={2}>{holding.name}</Text>
          <View
            style={[
              styles.categoryTag,
              {
                backgroundColor: `${categoryColor}1A`,
                borderColor: `${categoryColor}55`,
              },
            ]}
          >
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
          <Text style={[styles.metaValue, styles.metaXirrValue, { color }]}>{xirrLabel(holding.xirr)}</Text>
        </View>
      </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function OverlapCard({ pair }: { pair: OverlapPair }) {
  const isHigh = pair.overlapLevel === "high";
  const borderColor = isHigh ? "rgba(226,75,74,0.2)" : "rgba(212,175,55,0.2)";
  const labelColor = isHigh ? "#E24B4A" : "#D4AF37";
  const bg = isHigh ? "rgba(226,75,74,0.06)" : "rgba(212,175,55,0.06)";
  return (
    <View style={[styles.overlapCard, { backgroundColor: bg, borderColor }]}>
      <View style={[styles.overlapBadge, { backgroundColor: `${labelColor}1A`, borderColor: `${labelColor}66` }]}>
        <Text style={[styles.overlapLevel, { color: labelColor }]}>{pair.overlapLevel.toUpperCase()}</Text>
      </View>
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
  const session = useAppStore((state) => state.session);
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
  const heroY = useSharedValue(30);
  const heroOpacity = useSharedValue(0);
  const planOpacity = useSharedValue(0);

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

  useEffect(() => {
    heroY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    heroOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [heroOpacity, heroY]);

  useEffect(() => {
    if (!planLoading && (plan || fallbackPlan)) {
      planOpacity.value = 0;
      planOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    }
  }, [fallbackPlan, plan, planLoading, planOpacity]);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroY.value }],
  }));

  const planAnimatedStyle = useAnimatedStyle(() => ({
    opacity: planOpacity.value,
  }));

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
        // Category-based expense ratio defaults (direct plan averages)
const CATEGORY_EXPENSE_RATIOS: Record<string, number> = {
  large_cap: 0.95,
  mid_cap: 1.2,
  small_cap: 1.4,
  elss: 1.1,
  debt: 0.5,
  hybrid: 1.0,
  liquid: 0.2,
  other: 1.0,
};

const fundMetricsToCalc: Array<{
  fund: Fund;
  transactions: Transaction[];
}> = holdings.map((holding) => {
  // Use actual transaction dates if available, otherwise fall back to
  // purchase date estimate based on holding data
  const transactions: Transaction[] = holding.transactions && holding.transactions.length > 0
    ? holding.transactions.map((t) => ({
        date: new Date(t.date),
        amount: t.amount,
        units: holding.units / holding.transactions!.length,
      }))
    : [
        {
          date: new Date(Date.now() - 180 * 24 * 3600 * 1000),
          amount: -holding.purchaseValue,
          units: holding.units,
        },
        {
          date: new Date(),
          amount: holding.currentValue,
          units: 0,
        },
      ];

  return {
    fund: {
      schemeCode: holding.id,
      schemeName: holding.name,
      category: holding.category,
      nav: holding.nav,
      expenseRatio: CATEGORY_EXPENSE_RATIOS[holding.category] ?? 1.0,
    },
    transactions,
  };
});

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
              transactions: [{
                date: new Date(),
                amount: nav * 100,
              }],
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
  const updatedProfile = {
    ...currentProfile,
    camsData: {
      ...currentProfile.camsData,
      holdings: next,
    }
  };
  setCurrentProfile(updatedProfile);

  // Persist to SecureStore + Supabase so holdings survive app restarts
  void ProfileService.saveProfile(updatedProfile, session).catch((e) => {
    console.warn("[PortfolioXRay] Failed to persist holdings:", e);
    Alert.alert("Warning", "Holdings added but not saved to cloud. Please refresh when online.");
  });

  return next;
});

Alert.alert("Success", `Successfully added ${newHoldings.length} fund${newHoldings.length !== 1 ? 's' : ''}. Calculating metrics...`);
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

// Persist CAMS parsed holdings so they survive app restarts
const updatedProfile = {
  ...currentProfile,
  camsData: { holdings: mapped },
};
setCurrentProfile(updatedProfile);
void ProfileService.saveProfile(updatedProfile, session).catch((e) => {
  console.warn("[PortfolioXRay] Failed to persist CAMS holdings:", e);
  Alert.alert("Warning", "Holdings parsed but not saved to cloud. Please try again when online.");
});
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
  setHoldings((prev) => {
    const next = prev.map((h) => (h.id === updatedHolding.id ? updatedHolding : h));
    const updatedProfile = {
      ...currentProfile,
      camsData: {
        ...currentProfile.camsData,
        holdings: next,
      }
    };
    setCurrentProfile(updatedProfile);

    // Persist edited holdings
    void ProfileService.saveProfile(updatedProfile, session).catch((e) => {
      console.warn("[PortfolioXRay] Failed to persist edited holding:", e);
      Alert.alert("Warning", "Changes made but not saved to cloud. Please try again when online.");
    });

    return next;
  });
  setEditingHolding(null);
  Alert.alert("Success", "Holding updated successfully.");
}

  const overallXirrColor = xirrColor(xray.overallXIRR);
  const chartWidth = Math.min(width - Spacing["3xl"] * 2, 320);
  
  return (
    <Screen scroll>
      {/* ── Hero ── */}
      <Animated.View style={[styles.hero, heroAnimatedStyle]}>
        <Text style={styles.title}>Portfolio X-Ray</Text>
        <Text style={styles.subtitle}>
          Enter your fund holdings or upload a CAMS/KFintech statement to get your true XIRR,
          fund overlap, expense drag, and a personalised rebalancing plan.
        </Text>
      </Animated.View>

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
          <TouchableOpacity
            disabled={parsing}
            onPress={async () => {
              try {
                await handleParseStatement();
              } catch (e) {
                Alert.alert(
                  "Unable to parse statement",
                  e instanceof Error ? e.message : "Please try a clearer image."
                );
              }
            }}
            style={[styles.uploadBtn, parsing ? styles.uploadBtnDisabled : null]}
          >
            <Text style={styles.uploadBtnText}>Upload CAMS / KFintech</Text>
          </TouchableOpacity>
          {parsing ? (
            <View style={styles.uploadLoadingRow}>
              <ActivityIndicator color="#1D9E75" size="small" />
              <Text style={styles.uploadLoadingText}>Analysing portfolio...</Text>
            </View>
          ) : null}
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
  {metricsLoading && !portfolioMetrics ? (
    <View style={styles.metricsLoadingCard}>
      <ActivityIndicator size="small" color={Colors.purple} />
      <Text style={styles.metricsLoadingText}>Fetching live NAV data...</Text>
    </View>
  ) : (
    <AtAGlanceHeader metrics={portfolioMetrics} previousValue={xray.totalInvested} />
  )}
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
          {/* ── Metrics loading indicator ── */}
{metricsLoading && (
  <Animatable.View animation="fadeIn" duration={300} style={styles.section}>
    <View style={styles.metricsLoadingCard}>
      <ActivityIndicator size="small" color={Colors.purple} />
      <Text style={styles.metricsLoadingText}>Calculating portfolio metrics...</Text>
    </View>
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
            <View style={[styles.card, styles.benchmarkCard]}>
              <View style={styles.benchmarkRow}>
                <View style={styles.benchmarkCol}>
                  <Text style={styles.benchmarkLabel}>Your XIRR</Text>
                  <Text style={[styles.benchmarkValue, { color: overallXirrColor }]}>
                    {xray.overallXIRR !== null ? `${xray.overallXIRR.toFixed(1)}%` : "—"}
                  </Text>
                </View>
                <View style={styles.benchmarkCol}>
                  <Text style={styles.benchmarkLabel}>NIFTY 50</Text>
                  <Text style={styles.benchmarkValue}>
                    12.5%
                  </Text>
                </View>
                <View style={[styles.benchmarkCol, styles.benchmarkColRight]}>
                  <Text style={styles.benchmarkLabel}>Alpha</Text>
                  <Text
                    style={[
                      styles.benchmarkValue,
                      { color: (xray.overallXIRR || 0) >= 12.5 ? Colors.teal : Colors.red },
                    ]}
                  >
                    {xray.overallXIRR !== null ? `${((xray.overallXIRR || 0) - 12.5) > 0 ? "+" : ""}${((xray.overallXIRR || 0) - 12.5).toFixed(1)}%` : "—"}
                  </Text>
                </View>
              </View>
              <Text style={styles.benchmarkBody}>
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
              {holdings.map((h, i) => (
                <HoldingCard
                  key={h.id}
                  holding={h}
                  index={i}
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
              <Text style={styles.dragBody}>
                Switching high-expense funds to their direct plan equivalent or a Nifty 50 index
                fund is the single easiest way to recover this amount annually.
              </Text>
            </View>
          </Animatable.View>

          {/* ── AI rebalancing plan ── */}
          <Animatable.View animation="fadeInUp" delay={420} duration={500} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Rebalancing plan</Text>
              <TouchableOpacity
                disabled={planLoading}
                onPress={async () => {
                  try {
                    await handleRefreshPlan();
                  } catch (e) {
                    setPlanError(e instanceof Error ? e.message : "Unable to refresh plan.");
                  }
                }}
                style={styles.refreshGhostBtn}
              >
                <Text style={styles.refreshGhostText}>{planLoading ? "Refreshing..." : "Refresh"}</Text>
              </TouchableOpacity>
            </View>
            {planError ? <Text style={styles.warningText}>{planError}</Text> : null}
            <Animated.View style={[styles.planCard, planAnimatedStyle]}>
              {planLoading && !plan ? (
                <Text style={styles.loadingText}>FinMentor is building your plan...</Text>
              ) : (
                <Text style={styles.planText}>{plan || fallbackPlan}</Text>
              )}
            </Animated.View>
          </Animatable.View>

          {/* ── Share ── */}
          <Animatable.View animation="fadeInUp" delay={460} duration={500} style={styles.section}>
            <View style={styles.shareOuter}>
              <View style={styles.shareHeader}>
                <Text style={styles.shareTitle}>Share X-Ray summary</Text>
                <Button
                  label="Share Card"
                  loading={sharing}
                  onPress={() => {
  handleShare().catch((e) => {
    Alert.alert("Unable to share", e instanceof Error ? e.message : "Please try again.");
  });
}}
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
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
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
    backgroundColor: "rgba(29,158,117,0.05)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(29,158,117,0.2)",
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  uploadBtn: {
    backgroundColor: "#1D9E75",
    borderRadius: 99,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.md,
  },
  uploadLoadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  uploadLoadingText: {
    color: "#1D9E75",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  scanPreview: {
    width: "100%",
    height: 160,
    borderRadius: Radius.md,
    resizeMode: "cover",
  },
  parseNote: {
    color: "#1D9E75",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  summaryStrip: {
    backgroundColor: "#0D1B35",
    borderRadius: 20,
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
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: Colors.white,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 18,
  },
  summaryXirr: {
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 18,
  },
  summaryDrag: {
    color: Colors.gold,
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 16,
  },
  holdingCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#2A2A2A",
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
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  categoryTag: {
    borderWidth: 0.5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  categoryTagText: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
  },
  editBadge: {
    backgroundColor: "rgba(212,175,55,0.10)",
    borderRadius: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  editBadgeText: {
    color: "#D4AF37",
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
    fontSize: 16,
  },
  metaXirrValue: {
    fontSize: 14,
  },
  overlapCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  overlapBadge: {
    alignSelf: "flex-start",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
  },
  overlapLevel: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.xs,
    letterSpacing: 0.6,
  },
  overlapFunds: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 22,
  },
  overlapReason: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  dragCard: {
    backgroundColor: "rgba(212,175,55,0.06)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(212,175,55,0.2)",
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  dragValue: {
    color: "#D4AF37",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 28,
  },
  dragLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
  },
  dragBody: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: "rgba(127,119,221,0.06)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(127,119,221,0.2)",
    padding: Spacing.xl,
  },
  planText: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.md,
    lineHeight: 26,
  },
  refreshGhostBtn: {
    alignItems: "center",
    borderColor: "rgba(127,119,221,0.24)",
    borderRadius: Radius.full,
    borderWidth: 0.5,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: Spacing.md,
  },
  refreshGhostText: {
    color: "#7F77DD",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 12,
  },
  loadingText: {
    color: "#7F77DD",
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  warningText: {
    color: Colors.red,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  shareOuter: {
    backgroundColor: "#0D1B35",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
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
  metricsLoadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  metricsLoadingText: {
    color: Colors.textSecondary,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.size.sm,
  },
  benchmarkRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  benchmarkCol: {
    flex: 1,
  },
  benchmarkColRight: {
    alignItems: "flex-end",
  },
  benchmarkLabel: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.size.sm,
    marginBottom: 4,
  },
  benchmarkValue: {
    color: "#FFFFFF",
    fontFamily: Typography.fontFamily.displaySemiBold,
    fontSize: 24,
  },
  benchmarkBody: {
    color: "rgba(255,255,255,0.4)",
    fontFamily: Typography.fontFamily.body,
    fontSize: 12,
    lineHeight: 18,
  },
  benchmarkCard: {
    backgroundColor: "#1A1A1A",
    borderColor: "#2A2A2A",
    borderRadius: 20,
  },
});