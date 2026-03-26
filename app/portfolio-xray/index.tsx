import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Button } from "../../src/components/Button";
import { Screen } from "../../src/components/Screen";
import { AuthService } from "../../src/core/services/AuthService";
import { ProfileService } from "../../src/core/services/ProfileService";
import {
  MFHolding,
  OverlapPair,
  PortfolioXRay,
  UserProfileData,
  calculateXIRR,
  formatINR,
  getCategoryAllocation,
  getExpenseRatioDrag,
  getOverlapPairs,
} from "../../src/core/models/UserProfile";
import { CAMSParseResult, GeminiService } from "../../src/core/services/GeminiService";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Shadows, Spacing, Typography } from "../../src/core/theme";

import { HoldingEditModal } from "./components/HoldingEditModal";
import { SchemeInputForm } from "./components/SchemeInputForm";

// â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function xirrColor(xirr: number | null): string {
  if (xirr === null) return Colors.t2;
  if (xirr >= 12) return Colors.teal;
  if (xirr >= 8)  return Colors.amber;
  return Colors.red;
}

function xirrLabel(xirr: number | null): string {
  if (xirr === null) return "N/A";
  return xirr.toFixed(1) + "% XIRR";
}

function categoryColor(cat: MFHolding["category"]): string {
  const map: Record<MFHolding["category"], string> = {
    large_cap: Colors.teal,
    mid_cap:   Colors.gold, 
    small_cap: Colors.red,
    elss:      Colors.purple,
    debt:      Colors.t3,
    hybrid:    Colors.amber,
    liquid:    Colors.blue,
    other:     Colors.t2,
  };
  return map[cat] ?? Colors.t2;
}

const CATEGORY_LABELS: Record<MFHolding["category"], string> = {
  large_cap: "Large cap",
  mid_cap:   "Mid cap",
  small_cap: "Small cap",
  elss:      "ELSS",
  debt:      "Debt",
  hybrid:    "Hybrid",
  liquid:    "Liquid",
  other:     "Other",
};

type RiskAlignmentAnalysis = {
  equityPct: number;
  recommendedMaxEquity: number | null;
  issues: string[];
};

type SavingsVelocityResult = {
  targetMonthly: number;
  currentMonthly: number;
  gap: number;
  savingsRate: number;
  source: "tracked_sip" | "estimated";
  sourceNote: string;
  monthsInvested: number | null;
};

type EmergencyFundStatus = {
  monthsCovered: number;
  recommendedMonths: number;
  shortfall: number;
  status: "adequate" | "low" | "critical";
  liquidAssets: number;
  monthlyExpenses: number;
};

type TaxEfficiencyAnalysis = {
  elssValue: number;
  estimated80CContribution: number;
  remaining80CLimit: number;
  recommendation: string;
};

function getEquityPct(xray: PortfolioXRay): number {
  const equity =
    (xray.categoryAllocation.large_cap ?? 0) +
    (xray.categoryAllocation.mid_cap ?? 0) +
    (xray.categoryAllocation.small_cap ?? 0) +
    (xray.categoryAllocation.elss ?? 0) +
    (xray.categoryAllocation.hybrid ?? 0);
  return Math.max(0, Math.min(100, equity));
}

function getCategoryValue(xray: PortfolioXRay, category: MFHolding["category"]): number {
  const pct = xray.categoryAllocation[category] ?? 0;
  return (xray.totalValue * pct) / 100;
}

function getOldestInvestmentDate(holdings: MFHolding[]): Date | null {
  const timestamps: number[] = [];

  holdings.forEach((holding) => {
    if (holding.transactions?.length) {
      holding.transactions.forEach((txn) => {
        const date = new Date(txn.date);
        if (!Number.isNaN(date.getTime())) timestamps.push(date.getTime());
      });
      return;
    }

    if (holding.purchaseDate) {
      const date = new Date(holding.purchaseDate);
      if (!Number.isNaN(date.getTime())) timestamps.push(date.getTime());
    }
  });

  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps));
}

function getRiskAlignmentAnalysis(xray: PortfolioXRay, profile: UserProfileData): RiskAlignmentAnalysis {
  const issues: string[] = [];
  const equityPct = getEquityPct(xray);
  const recommendedMaxEquity = profile.age > 0 ? Math.max(100 - profile.age, 30) : null;

  if (recommendedMaxEquity !== null && equityPct > recommendedMaxEquity) {
    issues.push(
      "Equity at " +
        equityPct.toFixed(0) +
        "% exceeds the age-based guide of " +
        recommendedMaxEquity.toFixed(0) +
        "% for age " +
        profile.age +
        "."
    );
  }

  if (profile.riskProfile === "conservative" && equityPct > 50) {
    issues.push("Conservative profile with " + equityPct.toFixed(0) + "% equity exposure.");
  }

  if (profile.riskProfile === "aggressive" && equityPct < 60) {
    issues.push("Aggressive profile but only " + equityPct.toFixed(0) + "% equity. Consider a growth tilt.");
  }

  return { equityPct, recommendedMaxEquity, issues };
}

function getSavingsVelocity(xray: PortfolioXRay, profile: UserProfileData): SavingsVelocityResult | null {
  if (profile.monthlyIncome <= 0) return null;

  const targetMonthly = profile.monthlyIncome * 0.2;
  let currentMonthly = Math.max(0, profile.monthlySIP);
  let source: SavingsVelocityResult["source"] = "tracked_sip";
  let sourceNote = "Based on your tracked SIP of " + formatINR(currentMonthly) + " per month.";
  let monthsInvested: number | null = null;

  if (currentMonthly <= 0) {
    const oldest = getOldestInvestmentDate(xray.holdings);
    if (oldest) {
      monthsInvested = Math.max(
        1,
        (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24 * 30.4375)
      );
      const base = xray.totalInvested > 0 ? xray.totalInvested : xray.totalValue;
      currentMonthly = base / monthsInvested;
      source = "estimated";
      sourceNote =
        "Estimated from " +
        monthsInvested.toFixed(1) +
        " months of portfolio history (tracked SIP is unavailable).";
    } else {
      source = "estimated";
      sourceNote = "Tracked SIP is zero and portfolio timeline is unavailable, so contribution pace cannot be estimated reliably.";
    }
  }

  const savingsRate = profile.monthlyIncome > 0 ? (currentMonthly / profile.monthlyIncome) * 100 : 0;

  return {
    targetMonthly,
    currentMonthly,
    gap: targetMonthly - currentMonthly,
    savingsRate,
    source,
    sourceNote,
    monthsInvested,
  };
}

function getEmergencyFundStatus(xray: PortfolioXRay, profile: UserProfileData): EmergencyFundStatus {
  const monthlyExpenses =
    profile.monthlyExpenses > 0 ? profile.monthlyExpenses : Math.max(0, profile.monthlyIncome * 0.5);

  const liquidAssets =
    Math.max(0, profile.emergencyFund) +
    getCategoryValue(xray, "liquid") +
    getCategoryValue(xray, "debt") * 0.5;

  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  const recommendedMonths = 6;

  return {
    monthsCovered,
    recommendedMonths,
    shortfall: Math.max(0, (recommendedMonths - monthsCovered) * monthlyExpenses),
    status: monthsCovered >= 6 ? "adequate" : monthsCovered >= 3 ? "low" : "critical",
    liquidAssets,
    monthlyExpenses,
  };
}

function getTaxEfficiencyAnalysis(xray: PortfolioXRay, profile: UserProfileData): TaxEfficiencyAnalysis {
  const ELSS_LIMIT = 150_000;
  const elssValue = getCategoryValue(xray, "elss");
  const estimated80CContribution = Math.min(ELSS_LIMIT, Math.max(0, profile.annual80C + profile.annualPF));
  const remaining80CLimit = Math.max(0, ELSS_LIMIT - estimated80CContribution);

  let recommendation = "80C limit appears utilized. Focus on low-cost and goal-aligned allocation.";
  if (remaining80CLimit > 30_000) {
    recommendation =
      "Add an ELSS SIP of about " +
      formatINR(remaining80CLimit / 12) +
      " per month to improve 80C utilization.";
  } else if (remaining80CLimit > 0) {
    recommendation = "Invest remaining " + formatINR(remaining80CLimit) + " in eligible 80C options before the tax deadline.";
  }

  return {
    elssValue,
    estimated80CContribution,
    remaining80CLimit,
    recommendation,
  };
}

function areTransactionsEqual(
  a: Array<{ date: Date; amount: number }> | undefined,
  b: Array<{ date: Date; amount: number }> | undefined
): boolean {
  const txA = a ?? [];
  const txB = b ?? [];
  if (txA.length !== txB.length) return false;

  for (let i = 0; i < txA.length; i += 1) {
    const left = txA[i];
    const right = txB[i];
    if (new Date(left.date).getTime() !== new Date(right.date).getTime()) return false;
    if (left.amount !== right.amount) return false;
  }

  return true;
}

function areHoldingsEqual(a: MFHolding[], b: MFHolding[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left.id !== right.id) return false;
    if (left.name !== right.name) return false;
    if (left.schemeCode !== right.schemeCode) return false;
    if (left.category !== right.category) return false;
    if (left.units !== right.units) return false;
    if (left.nav !== right.nav) return false;
    if (left.currentValue !== right.currentValue) return false;
    if (left.purchaseValue !== right.purchaseValue) return false;
    if ((left.purchaseDate ?? "") !== (right.purchaseDate ?? "")) return false;
    if (left.xirr !== right.xirr) return false;
    if (!areTransactionsEqual(left.transactions, right.transactions)) return false;
  }

  return true;
}

// â”€â”€â”€ build xray â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildXRay(holdings: MFHolding[]): PortfolioXRay {
  const totalValue    = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = holdings.reduce((s, h) => s + h.purchaseValue, 0);

  const allCashflows: Array<{ date: Date; amount: number }> = [];
  holdings.forEach((h) => {
    if (h.transactions && h.transactions.length > 0) {
      h.transactions.forEach((t) => {
        allCashflows.push({ date: new Date(t.date), amount: -Math.abs(t.amount) });
      });
    } else if (h.purchaseDate) {
      allCashflows.push({ date: new Date(h.purchaseDate), amount: -h.purchaseValue });
    }
  });

  let overallXIRR: number | null = null;
  if (allCashflows.length > 0 && totalValue > 0) {
    allCashflows.push({ date: new Date(), amount: totalValue });
    overallXIRR = calculateXIRR(allCashflows);
  }

  return {
    holdings,
    totalValue,
    totalInvested,
    overallXIRR,
    overlapPairs:       getOverlapPairs(holdings),
    expenseRatioDrag:   getExpenseRatioDrag(holdings),
    categoryAllocation: getCategoryAllocation(holdings),
  };
}

function mapCAMSToHoldings(result: CAMSParseResult): MFHolding[] {
  return result.holdings
    .filter((h) => h.name && h.currentValue > 0)
    .map((h, index) => {
      const cashflows: Array<{ date: Date; amount: number }> = (h.transactions ?? [])
        .filter((t) => t.date && t.amount !== undefined)
        .map((t) => ({ date: new Date(t.date), amount: -Math.abs(t.amount) }));

      if (cashflows.length > 0) cashflows.push({ date: new Date(), amount: h.currentValue });

      const xirr = cashflows.length >= 2 ? calculateXIRR(cashflows) : null;

      const raw = (h.category ?? "other").toLowerCase().replace(/\s+/g, "_");
      const validCats: MFHolding["category"][] = [
        "large_cap","mid_cap","small_cap","elss","debt","hybrid","liquid","other",
      ];
      const category = validCats.includes(raw as MFHolding["category"])
        ? (raw as MFHolding["category"]) : "other";

      return {
        id:            "h-" + index,
        name:          h.name,
        category,
        units:         h.units ?? 0,
        nav:           h.nav ?? 0,
        currentValue:  h.currentValue,
        purchaseValue: h.purchaseValue ?? h.currentValue,
        xirr,
        schemeCode:    undefined,
        transactions:  (h.transactions ?? []).map((t) => ({ ...t, date: new Date(t.date) })),
      };
    });
}

function buildFallbackPlan(
  xray: PortfolioXRay,
  profile: UserProfileData | null,
  riskAnalysis: RiskAlignmentAnalysis | null,
  emergencyStatus: EmergencyFundStatus | null,
  savingsVelocity: SavingsVelocityResult | null,
  taxEfficiency: TaxEfficiencyAnalysis | null
): string {
  const lines: string[] = [];

  if (xray.overlapPairs.length > 0) {
    const pair = xray.overlapPairs[0];
    lines.push("1. Consider consolidating " + pair.fund1 + " and " + pair.fund2 + " - " + pair.reason);
  } else if (xray.expenseRatioDrag > 0) {
    lines.push(
      "1. Expense drag is about " +
        formatINR(xray.expenseRatioDrag) +
        "/yr. Prioritize shifting high-cost active funds to low-cost direct/index alternatives."
    );
  } else {
    lines.push("1. No major overlap or cost drag detected. Keep portfolio complexity low and rebalance annually.");
  }

  if (riskAnalysis && riskAnalysis.issues.length > 0) {
    lines.push("2. " + riskAnalysis.issues[0]);
  } else if (riskAnalysis && profile) {
    lines.push(
      "2. Equity at " +
        riskAnalysis.equityPct.toFixed(0) +
        "% is broadly aligned with your " +
        profile.riskProfile +
        " profile. Keep allocation drift checks quarterly."
    );
  } else {
    lines.push("2. Keep your equity-debt mix aligned with age and declared risk profile.");
  }

  if (emergencyStatus && emergencyStatus.status !== "adequate") {
    lines.push(
      "3. Emergency buffer covers about " +
        emergencyStatus.monthsCovered.toFixed(1) +
        " months. Build a shortfall of " +
        formatINR(emergencyStatus.shortfall) +
        " in liquid/debt buckets first."
    );
  } else if (savingsVelocity && savingsVelocity.gap > 0) {
    lines.push(
      "3. Increase monthly investing by " +
        formatINR(savingsVelocity.gap) +
        " to approach a 20% savings rate target."
    );
  } else if (taxEfficiency && taxEfficiency.remaining80CLimit > 0) {
    lines.push("3. " + taxEfficiency.recommendation);
  } else {
    lines.push("3. Savings pace and tax utilization look reasonable; focus next on reducing overlap and cost drag.");
  }

  return lines.join("\n\n");
}

// â”€â”€â”€ NAV refresh helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type NAVFetchFailureReason = "timeout" | "http_error" | "invalid_response" | "network_error";

type NAVFetchResult =
  | { ok: true; nav: number; date: string }
  | { ok: false; reason: NAVFetchFailureReason };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
  
async function fetchLatestNAV(schemeCode: string): Promise<NAVFetchResult> {
  const TIMEOUT_MS = 20_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.mfapi.in/mf/" + schemeCode, {
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn("[NAV] Server error " + res.status + " for scheme " + schemeCode);
      return { ok: false, reason: "http_error" };
    }

    const json = await res.json();
    if (json.status !== "SUCCESS" || !json.data?.[0]) {
      console.warn("[NAV] Invalid response for scheme " + schemeCode);
      return { ok: false, reason: "invalid_response" };
    }

    const nav = parseFloat(json.data[0].nav);
    if (Number.isNaN(nav)) {
      console.warn("[NAV] NAV parse failed for scheme " + schemeCode);
      return { ok: false, reason: "invalid_response" };
    }

    return { ok: true, nav, date: json.data[0].date };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[NAV] Timeout after " + TIMEOUT_MS + "ms for scheme " + schemeCode);
      return { ok: false, reason: "timeout" };
    }
    console.warn("[NAV] Network error for scheme " + schemeCode + ":", err);
    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchLatestNAVWithRetry(
  schemeCode: string,
  retries = 1,
  delayMs = 2000
): Promise<NAVFetchResult> {
  let lastFailure: NAVFetchResult = { ok: false, reason: "network_error" };

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = await fetchLatestNAV(schemeCode);
    if (result.ok) return result;
    lastFailure = result;

    if (attempt < retries) {
      console.warn(
        "[NAV] Retry " +
          (attempt + 1) +
          " for scheme " +
          schemeCode +
          " in " +
          delayMs +
          "ms."
      );
      await sleep(delayMs);
    }
  }

  return lastFailure;
}

// â”€â”€â”€ sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EmptyState() {
  return (
    <Screen scroll>
      <View style={styles.emptyHero}>
        <Text style={styles.screenEyebrow}>Portfolio X-Ray</Text>
        <Text style={styles.screenTitle}>Your funds, dissected</Text>
        <Text style={styles.screenSubtitle}>
          Upload a CAMS or KFintech statement, or add funds by scheme code to get your true XIRR, overlap analysis, expense drag, and rebalancing plan.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>X-Ray unlocks after profile setup</Text>
        <Text style={styles.cardBody}>Complete your profile first so we can align your risk profile with the rebalancing plan.</Text>
        <Button label="Go to onboarding" onPress={() => router.push("/onboarding")} />
      </View>
    </Screen>
  );
}

function HoldingCard({ holding, index, onEdit }: { holding: MFHolding; index: number; onEdit: () => void }) {
  const color   = categoryColor(holding.category);
  const y       = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    y.value       = withDelay(index * 40, withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }));
    opacity.value = withDelay(index * 40, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [index, opacity, y]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value, transform: [{ translateY: y.value }],
  }));

  const returnColor = holding.xirr === null ? Colors.t2 : holding.xirr >= 12 ? Colors.teal : holding.xirr >= 8 ? Colors.amber : Colors.red;

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity style={styles.holdingCard} onPress={onEdit} activeOpacity={0.7}>
        <View style={[styles.holdingDot, { backgroundColor: color }]} />
        <View style={styles.holdingBody}>
          <Text style={styles.holdingName} numberOfLines={2}>{holding.name}</Text>
          <View style={styles.holdingMeta}>
            <Text style={styles.holdingCat}>{CATEGORY_LABELS[holding.category]}</Text>
            {holding.schemeCode ? (
              <View style={styles.schemeBadge}>
                <Text style={styles.schemeBadgeText}>{"#" + holding.schemeCode}</Text>
              </View>
            ) : null}
            {holding.purchaseDate || (holding.transactions && holding.transactions.length > 0) ? (
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>Date known</Text>
              </View>
            ) : (
              <View style={[styles.dateBadge, styles.dateBadgeWarn]}>
                <Text style={[styles.dateBadgeText, { color: Colors.amber }]}>No purchase date</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.holdingRight}>
          <Text style={styles.holdingValue}>{formatINR(holding.currentValue)}</Text>
          <Text style={[styles.holdingXirr, { color: returnColor }]}>{xirrLabel(holding.xirr)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function OverlapCard({ pair }: { pair: OverlapPair }) {
  const isHigh      = pair.overlapLevel === "high";
  const borderColor = isHigh ? "rgba(220,78,78,0.22)" : "rgba(217,142,56,0.22)";
  const labelColor  = isHigh ? Colors.red : Colors.amber;
  const bgColor     = isHigh ? Colors.redDim : Colors.amberDim;

  return (
    <View style={[styles.overlapCard, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.overlapHeader}>
        <View style={[styles.overlapBadge, { backgroundColor: bgColor, borderColor }]}>
          <Text style={[styles.overlapLevel, { color: labelColor }]}>{pair.overlapLevel.toUpperCase()}</Text>
        </View>
        <Text style={styles.overlapFunds} numberOfLines={1}>{pair.fund1 + " Â· " + pair.fund2}</Text>
      </View>
      <Text style={styles.overlapReason}>{pair.reason}</Text>
    </View>
  );
}

// â”€â”€â”€ main screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function PortfolioXRayScreen() {
  const profile           = useAppStore((s) => s.currentProfile);
  const setCurrentProfile = useAppStore((s) => s.setCurrentProfile);
  const portfolioXRay     = useAppStore((s) => s.portfolioXRay);
  const setPortfolioXRay  = useAppStore((s) => s.setPortfolioXRay);
  const session           = useAppStore((s) => s.session);
  const shareCardRef      = useRef<ViewShot | null>(null);

  const [holdings,       setHoldings]      = useState<MFHolding[]>(portfolioXRay?.holdings ?? profile?.camsData?.holdings ?? []);
  const [holdingsInitialized, setHoldingsInitialized] = useState(false);
  const [parsing,        setParsing]        = useState(false);
  const [parseNote,      setParseNote]      = useState("");
  const [scanPreview,    setScanPreview]    = useState<string | null>(null);
  const [plan,           setPlan]           = useState("");
  const [planLoading,    setPlanLoading]    = useState(false);
  const [planError,      setPlanError]      = useState("");
  const [sharing,        setSharing]        = useState(false);
  const [editingHolding, setEditingHolding] = useState<MFHolding | null>(null);
  const [showAddForm,    setShowAddForm]    = useState(false);

  // NAV refresh
  const [refreshing,    setRefreshing]    = useState(false);
  const [refreshNote,   setRefreshNote]   = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  const xray            = useMemo(() => buildXRay(holdings), [holdings]);
  const riskAnalysis    = useMemo(() => (profile ? getRiskAlignmentAnalysis(xray, profile) : null), [xray, profile]);
  const emergencyStatus = useMemo(() => (profile ? getEmergencyFundStatus(xray, profile) : null), [xray, profile]);
  const savingsVelocity = useMemo(() => (profile ? getSavingsVelocity(xray, profile) : null), [xray, profile]);
  const taxEfficiency   = useMemo(() => (profile ? getTaxEfficiencyAnalysis(xray, profile) : null), [xray, profile]);
  const fallbackPlan    = useMemo(
    () => buildFallbackPlan(xray, profile, riskAnalysis, emergencyStatus, savingsVelocity, taxEfficiency),
    [xray, profile, riskAnalysis, emergencyStatus, savingsVelocity, taxEfficiency]
  );
  const pieData        = useMemo(() =>
    Object.entries(xray.categoryAllocation)
      .filter(([, pct]) => pct > 0)
      .map(([cat, pct]) => ({ cat: cat as MFHolding["category"], pct })),
    [xray.categoryAllocation]);
  const hasPortfolio     = holdings.length > 0;
  const refreshableCount = holdings.filter((h) => !!h.schemeCode).length;

  useEffect(() => {
    setPortfolioXRay(holdings.length > 0 ? xray : null);
  }, [holdings, xray, setPortfolioXRay]);

  useEffect(() => {
    if (!profile || holdingsInitialized) return;
    const initialHoldings = portfolioXRay?.holdings ?? profile.camsData?.holdings ?? [];
    if (initialHoldings.length > 0 && holdings.length === 0) {
      setHoldings(initialHoldings);
    }
    setHoldingsInitialized(true);
  }, [profile, portfolioXRay, holdings.length, holdingsInitialized]);

  useEffect(() => {
    if (!profile || !holdingsInitialized) return;
    const existingHoldings = profile.camsData?.holdings ?? [];
    if (areHoldingsEqual(existingHoldings, holdings)) return;

    const updatedProfile = { ...profile, camsData: { holdings } };
    setCurrentProfile(updatedProfile);
    void ProfileService.saveProfile(updatedProfile, session).catch((e) =>
      console.warn("[PortfolioXRay] Failed to persist:", e)
    );
  }, [holdings, profile, session, setCurrentProfile, holdingsInitialized]);

  useEffect(() => {
    if (!profile || holdings.length === 0) return;
    const safeProfile = profile;
    let active = true;
    void (async () => {
      try {
        setPlanLoading(true); setPlanError("");
        const result = await GeminiService.getPortfolioRebalancingPlan(safeProfile, xray);
        if (active) setPlan(result);
      } catch (err) {
        if (active) { setPlan(fallbackPlan); setPlanError(err instanceof Error ? err.message : "Showing offline plan."); }
      } finally { if (active) setPlanLoading(false); }
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  if (!profile) return <EmptyState />;

  // â”€â”€ handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleParseStatement() {
    try {
      setParsing(true); setPlanError(""); setParseNote("");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, base64: true, quality: 0.9,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("Image did not include base64 data.");
      const parsed = await GeminiService.parseCAMSStatement(asset.base64, asset.mimeType ?? "image/jpeg");
      const mapped = mapCAMSToHoldings(parsed);
      if (mapped.length === 0) throw new Error("No fund holdings found. Try a clearer screenshot.");
      setScanPreview(asset.uri);
      setParseNote(parsed.notes ?? mapped.length + " fund" + (mapped.length !== 1 ? "s" : "") + " detected.");
      setHoldings(mapped);
    } catch (err) {
      Alert.alert("Unable to parse statement", err instanceof Error ? err.message : "Please try a clearer image.");
    } finally { setParsing(false); }
  }

  function handleAddSchemeHoldings(newHoldings: MFHolding[]) {
    const stamp = Date.now();
    const normalized = newHoldings.map((holding, index) => {
      const schemeCode =
        holding.schemeCode ?? (/^\d{6}$/.test(holding.id) ? holding.id : undefined);
      return {
        ...holding,
        schemeCode,
        id: "manual-" + (schemeCode ?? "fund") + "-" + stamp + "-" + index,
      };
    });

    setHoldings((prev) => {
      const existingSchemeCodes = new Set(
        prev.map((h) => h.schemeCode).filter((code): code is string => !!code)
      );
      const existingNames = new Set(prev.map((h) => h.name.trim().toLowerCase()));

      return [
        ...prev,
        ...normalized.filter((holding) => {
          if (holding.schemeCode) return !existingSchemeCodes.has(holding.schemeCode);
          return !existingNames.has(holding.name.trim().toLowerCase());
        }),
      ];
    });
    setShowAddForm(false);
  }

  function handleSaveEditedHolding(updated: MFHolding) {
    setHoldings((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    setEditingHolding(null);
  }

  function handleDeleteHolding(id: string) {
    Alert.alert("Remove holding", "Remove this fund from your portfolio?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        setHoldings((prev) => prev.filter((h) => h.id !== id));
        setEditingHolding(null);
      }},
    ]);
  }

  // â”€â”€ NAV refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleRefreshNAVs() {
    const refreshable = holdings.filter((h) => !!h.schemeCode);
    if (refreshable.length === 0) {
      Alert.alert(
        "No scheme codes found",
        "Holdings added via scheme code can be refreshed. Edit a holding to add a scheme code to CAMS-imported funds."
      );
      return;
    }

    try {
      setRefreshing(true);
      setRefreshNote("Fetching latest NAVs for " + refreshable.length + " funds...");
      let updated = 0;
      let failed = 0;
      let timedOut = 0;
      const now = new Date();

      const results = await Promise.allSettled(
        holdings.map(async (holding) => {
          if (!holding.schemeCode) {
            return { status: "skipped" as const };
          }

          const navResult = await fetchLatestNAVWithRetry(holding.schemeCode, 1, 2000);
          if (!navResult.ok) {
            return { status: "failed" as const, reason: navResult.reason };
          }

          return {
            status: "success" as const,
            holding: {
              ...holding,
              nav: navResult.nav,
              currentValue: holding.units * navResult.nav,
            } as MFHolding,
          };
        })
      );

      const updatedHoldings = results.map((outcome, index) => {
        const original = holdings[index];

        if (outcome.status === "rejected") {
          failed += 1;
          console.warn("[Refresh] Rejected promise for " + original.name + ":", outcome.reason);
          return original;
        }

        if (outcome.value.status === "success") {
          updated += 1;
          return outcome.value.holding;
        }

        if (outcome.value.status === "failed") {
          failed += 1;
          if (outcome.value.reason === "timeout") timedOut += 1;
        }

        return original;
      });

      setHoldings(updatedHoldings);
      const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setLastRefreshed(timeStr);

      const parts: string[] = [];
      if (updated > 0) parts.push(updated + " updated");
      if (failed > 0) parts.push(failed + " failed");
      if (timedOut > 0) parts.push(timedOut + " timed out");
      parts.push(timeStr);
      setRefreshNote(parts.join(" · "));

      if (updated === 0 && failed > 0) {
        Alert.alert(
          "NAV refresh unavailable",
          timedOut > 0
            ? "mfapi is responding slowly right now. None of your NAVs were updated. Please try again in a few minutes."
            : "Could not refresh NAVs right now. The API may be temporarily unavailable. Please try again in a few minutes."
        );
      }
    } catch (err) {
      console.error("[Refresh] Unexpected error:", err);
      setRefreshNote("Refresh failed. Check your connection.");
      Alert.alert(
        "Refresh failed",
        "Something went wrong while refreshing NAVs. Please check your connection and try again."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRefreshPlan() {
    if (!profile) return;
    const safeProfile = profile;
    try {
      setPlanLoading(true); setPlanError("");
      const result = await GeminiService.getPortfolioRebalancingPlan(safeProfile, xray);
      setPlan(result);
    } catch (err) {
      setPlan(fallbackPlan);
      setPlanError(err instanceof Error ? err.message : "Showing offline plan.");
    } finally { setPlanLoading(false); }
  }

  async function handleShare() {
    try {
      setSharing(true);
      const canBio = await AuthService.canUseBiometric();
      if (canBio) {
        const verified = await AuthService.promptBiometric("Confirm before sharing portfolio card");
        if (!verified) return;
      }
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available.");
      const uri = await shareCardRef.current?.capture?.();
      if (!uri) throw new Error("Unable to generate the share card.");
      await Sharing.shareAsync(uri, { dialogTitle: "Share your ET FinMentor portfolio X-Ray" });
    } catch (err) {
      Alert.alert("Unable to share", err instanceof Error ? err.message : "Please try again.");
    } finally { setSharing(false); }
  }

  const overallXirrColor = xirrColor(xray.overallXIRR);
  const xirrText         = xray.overallXIRR !== null ? xray.overallXIRR.toFixed(1) + "%" : "N/A";
  const dragText         = formatINR(xray.expenseRatioDrag) + "/yr";
  const riskAligned      = !!riskAnalysis && riskAnalysis.issues.length === 0;
  const emergencyLabel   =
    emergencyStatus?.status === "adequate"
      ? "Adequate"
      : emergencyStatus?.status === "low"
        ? "Low"
        : "Critical";

  // â”€â”€ render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <Screen scroll>

      <View style={styles.pageHeader}>
        <Text style={styles.screenEyebrow}>Portfolio X-Ray</Text>
        <Text style={styles.screenTitle}>Your funds, dissected</Text>
      </View>

      {/* â”€â”€ hero card â”€â”€ */}
      {hasPortfolio ? (
        <Animatable.View animation="fadeInUp" delay={0} duration={400}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total value</Text>
            <Text style={styles.heroValue}>{formatINR(xray.totalValue)}</Text>

            <View style={styles.tagRow}>
              <View style={[styles.tag, { backgroundColor: Colors.tealDim }]}>
                <Text style={[styles.tagText, { color: Colors.teal }]}>{xirrText + " XIRR"}</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: Colors.amberDim }]}>
                <Text style={[styles.tagText, { color: Colors.amber }]}>{dragText + " drag"}</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: Colors.s2 }]}>
                <Text style={[styles.tagText, { color: Colors.t1 }]}>{holdings.length + " funds"}</Text>
              </View>
            </View>

            <View style={styles.allocBar}>
              {pieData.map(({ cat, pct }) => (
                <View key={cat} style={[styles.allocSeg, { flex: pct, backgroundColor: categoryColor(cat) }]} />
              ))}
            </View>
            <View style={styles.allocLegend}>
              {pieData.map(({ cat, pct }) => (
                <View key={cat} style={styles.allocItem}>
                  <View style={[styles.allocDot, { backgroundColor: categoryColor(cat) }]} />
                  <Text style={styles.allocText}>{CATEGORY_LABELS[cat] + " " + pct.toFixed(0) + "%"}</Text>
                </View>
              ))}
            </View>

            {/* â”€â”€ refresh NAVs row â”€â”€ */}
            <View style={styles.refreshNavRow}>
              <View style={styles.refreshNavLeft}>
                <Text style={styles.refreshNavTime}>
                  {lastRefreshed
                    ? "NAVs as of " + lastRefreshed
                    : refreshableCount > 0
                      ? refreshableCount + " fund" + (refreshableCount !== 1 ? "s" : "") + " refreshable"
                      : "Add scheme codes to enable refresh"}
                </Text>
                {refreshNote ? <Text style={styles.refreshNavNote}>{refreshNote}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.refreshNavBtn, refreshing && styles.refreshNavBtnDisabled]}
                onPress={handleRefreshNAVs}
                disabled={refreshing}
                activeOpacity={0.8}
              >
                {refreshing
                  ? <ActivityIndicator color={Colors.bg} size="small" style={{ width: 52 }} />
                  : <Text style={styles.refreshNavBtnText}>Refresh NAVs</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Animatable.View>
      ) : null}

      {hasPortfolio && riskAnalysis ? (
        <Animatable.View animation="fadeInUp" delay={30} duration={400}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Risk alignment</Text>
          </View>
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeaderRow}>
              <Text style={styles.analysisTitle}>Profile vs allocation</Text>
              <View
                style={[
                  styles.analysisBadge,
                  riskAligned ? styles.analysisBadgeOk : styles.analysisBadgeWarn,
                ]}
              >
                <Text style={[styles.analysisBadgeText, riskAligned ? styles.analysisBadgeTextOk : styles.analysisBadgeTextWarn]}>
                  {riskAligned ? "Aligned" : "Needs attention"}
                </Text>
              </View>
            </View>
            <Text style={styles.analysisBody}>
              {"Equity exposure: " +
                riskAnalysis.equityPct.toFixed(0) +
                "%" +
                (riskAnalysis.recommendedMaxEquity !== null
                  ? " - age-guide max " + riskAnalysis.recommendedMaxEquity.toFixed(0) + "%"
                  : "")}
            </Text>
            {riskAnalysis.issues.length > 0 ? (
              <View style={styles.analysisList}>
                {riskAnalysis.issues.map((issue, index) => (
                  <Text key={index} style={styles.analysisListItem}>
                    {"- " + issue}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.analysisSubtext}>
                Current mix looks consistent with your declared risk profile.
              </Text>
            )}
          </View>
        </Animatable.View>
      ) : null}

      {hasPortfolio && savingsVelocity ? (
        <Animatable.View animation="fadeInUp" delay={45} duration={400}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Savings velocity</Text>
          </View>
          <View style={styles.analysisCard}>
            <View style={styles.analysisMetricRow}>
              <View style={styles.analysisMetric}>
                <Text style={styles.analysisMetricLabel}>Target / month</Text>
                <Text style={styles.analysisMetricValue}>{formatINR(savingsVelocity.targetMonthly)}</Text>
              </View>
              <View style={styles.analysisMetricDivider} />
              <View style={styles.analysisMetric}>
                <Text style={styles.analysisMetricLabel}>Current / month</Text>
                <Text style={styles.analysisMetricValue}>{formatINR(savingsVelocity.currentMonthly)}</Text>
              </View>
            </View>
            <Text
              style={[
                styles.analysisBody,
                savingsVelocity.gap > 0 ? styles.analysisWarningText : styles.analysisOkText,
              ]}
            >
              {savingsVelocity.gap > 0
                ? "Invest about " + formatINR(savingsVelocity.gap) + " more monthly to reach the 20% savings target."
                : "Savings pace is on track at roughly " + savingsVelocity.savingsRate.toFixed(0) + "% of monthly income."}
            </Text>
            <Text style={styles.analysisSubtext}>{savingsVelocity.sourceNote}</Text>
          </View>
        </Animatable.View>
      ) : null}

      {hasPortfolio && emergencyStatus ? (
        <Animatable.View animation="fadeInUp" delay={60} duration={400}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Emergency fund</Text>
          </View>
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeaderRow}>
              <Text style={styles.analysisTitle}>Liquidity readiness</Text>
              <View
                style={[
                  styles.analysisBadge,
                  emergencyStatus.status === "adequate"
                    ? styles.analysisBadgeOk
                    : emergencyStatus.status === "low"
                      ? styles.analysisBadgeWarn
                      : styles.analysisBadgeCritical,
                ]}
              >
                <Text
                  style={[
                    styles.analysisBadgeText,
                    emergencyStatus.status === "adequate"
                      ? styles.analysisBadgeTextOk
                      : emergencyStatus.status === "low"
                        ? styles.analysisBadgeTextWarn
                        : styles.analysisBadgeTextCritical,
                  ]}
                >
                  {emergencyLabel}
                </Text>
              </View>
            </View>
            <Text style={styles.analysisBody}>
              {"Covers " +
                emergencyStatus.monthsCovered.toFixed(1) +
                " months of expenses - liquid assets " +
                formatINR(emergencyStatus.liquidAssets)}
            </Text>
            {emergencyStatus.status !== "adequate" ? (
              <Text style={styles.analysisWarningText}>
                {"Build " + formatINR(emergencyStatus.shortfall) + " more to reach a 6-month buffer."}
              </Text>
            ) : (
              <Text style={styles.analysisOkText}>Emergency reserve looks adequate for current expense levels.</Text>
            )}
          </View>
        </Animatable.View>
      ) : null}

      {hasPortfolio && taxEfficiency ? (
        <Animatable.View animation="fadeInUp" delay={75} duration={400}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Tax efficiency</Text>
          </View>
          <View style={styles.analysisCard}>
            <View style={styles.analysisMetricRow}>
              <View style={styles.analysisMetric}>
                <Text style={styles.analysisMetricLabel}>80C used</Text>
                <Text style={styles.analysisMetricValue}>{formatINR(taxEfficiency.estimated80CContribution)}</Text>
              </View>
              <View style={styles.analysisMetricDivider} />
              <View style={styles.analysisMetric}>
                <Text style={styles.analysisMetricLabel}>80C remaining</Text>
                <Text style={styles.analysisMetricValue}>{formatINR(taxEfficiency.remaining80CLimit)}</Text>
              </View>
            </View>
            <Text style={styles.analysisBody}>{"ELSS allocation value: " + formatINR(taxEfficiency.elssValue)}</Text>
            <Text style={styles.analysisSubtext}>{taxEfficiency.recommendation}</Text>
          </View>
        </Animatable.View>
      ) : null}

      {/* â”€â”€ add funds â”€â”€ */}
      <Animatable.View animation="fadeInUp" delay={50} duration={400}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Add funds</Text>
        </View>
        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload statement</Text>
          <Text style={styles.uploadBody}>
            CAMS or KFintech screenshot â€” Gemini Vision extracts holdings with real transaction dates for accurate XIRR.
          </Text>
          <TouchableOpacity
            disabled={parsing}
            onPress={handleParseStatement}
            style={[styles.uploadBtn, parsing && styles.uploadBtnDisabled]}
            activeOpacity={0.8}
          >
            {parsing ? <ActivityIndicator color={Colors.bg} size="small" /> : <Text style={styles.uploadBtnText}>Upload CAMS / KFintech</Text>}
          </TouchableOpacity>
          {scanPreview ? <Image source={{ uri: scanPreview }} style={styles.scanPreview} /> : null}
          {parseNote ? <Text style={styles.parseNote}>{parseNote}</Text> : null}
        </View>
        <TouchableOpacity style={styles.addByCodeBtn} onPress={() => setShowAddForm(true)} activeOpacity={0.8}>
          <Text style={styles.addByCodeText}>+ Add by scheme code</Text>
        </TouchableOpacity>
      </Animatable.View>

      {/* â”€â”€ holdings list â”€â”€ */}
      {hasPortfolio ? (
        <>
          <Animatable.View animation="fadeInUp" delay={100} duration={400}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{"Holdings Â· " + holdings.length + " funds"}</Text>
              <Text style={styles.sectionNote}>Tap to edit</Text>
            </View>
            <View style={styles.holdingList}>
              {holdings.map((h, i) => (
                <HoldingCard key={h.id} holding={h} index={i} onEdit={() => setEditingHolding(h)} />
              ))}
            </View>
          </Animatable.View>

          {/* â”€â”€ benchmark â”€â”€ */}
          <Animatable.View animation="fadeInUp" delay={140} duration={400}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Benchmark Â· vs Nifty 50</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.benchRow}>
                <View style={styles.benchCol}>
                  <Text style={styles.benchLabel}>Your XIRR</Text>
                  <Text style={[styles.benchValue, { color: overallXirrColor }]}>{xirrText}</Text>
                </View>
                <View style={styles.benchDivider} />
                <View style={styles.benchCol}>
                  <Text style={styles.benchLabel}>Nifty 50</Text>
                  <Text style={styles.benchValue}>12.5%</Text>
                </View>
                <View style={styles.benchDivider} />
                <View style={styles.benchCol}>
                  <Text style={styles.benchLabel}>Alpha</Text>
                  <Text style={[styles.benchValue, {
                    color: xray.overallXIRR !== null ? xray.overallXIRR >= 12.5 ? Colors.teal : Colors.red : Colors.t2,
                  }]}>
                    {xray.overallXIRR !== null
                      ? (xray.overallXIRR - 12.5 > 0 ? "+" : "") + (xray.overallXIRR - 12.5).toFixed(1) + "%"
                      : "N/A"}
                  </Text>
                </View>
              </View>
              <View style={styles.benchNote}>
                <Text style={styles.benchNoteText}>
                  {xray.overallXIRR === null
                    ? "Add purchase dates to calculate accurate XIRR and alpha."
                    : xray.overallXIRR >= 12.5
                      ? "Your active fund selection is beating the index. Review annually to ensure it stays ahead after fees."
                      : "Marginally below benchmark after fees. Consider switching high-expense funds to index equivalents."}
                </Text>
              </View>
            </View>
          </Animatable.View>

          {/* â”€â”€ overlap â”€â”€ */}
          {xray.overlapPairs.length > 0 ? (
            <Animatable.View animation="fadeInUp" delay={170} duration={400}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Fund overlap</Text>
              </View>
              <View style={styles.overlapList}>
                {xray.overlapPairs.map((pair, i) => <OverlapCard key={i} pair={pair} />)}
              </View>
            </Animatable.View>
          ) : null}

          {/* â”€â”€ expense drag â”€â”€ */}
          <Animatable.View animation="fadeInUp" delay={200} duration={400}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Expense drag</Text>
            </View>
            <View style={styles.dragCard}>
              <Text style={styles.dragLabel}>Annual drag vs index equivalent</Text>
              <Text style={styles.dragValue}>{formatINR(xray.expenseRatioDrag)}</Text>
              <Text style={styles.dragBody}>
                Lost per year to active fund expense ratios vs a 0.1% Nifty 50 index. Switching to direct plan equivalents recovers this instantly.
              </Text>
            </View>
          </Animatable.View>

          {/* â”€â”€ AI rebalancing plan â”€â”€ */}
          <Animatable.View animation="fadeInUp" delay={230} duration={400}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>AI rebalancing plan</Text>
              <TouchableOpacity disabled={planLoading} onPress={handleRefreshPlan} style={styles.refreshBtn}>
                <Text style={styles.refreshBtnText}>{planLoading ? "Refreshing..." : "Refresh"}</Text>
              </TouchableOpacity>
            </View>
            {planError ? <Text style={styles.errorText}>{planError}</Text> : null}
            <View style={styles.planList}>
              {(plan || fallbackPlan).split("\n\n").map((line, i) => (
                <View key={i} style={styles.tipCard}>
                  <Text style={styles.tipNum}>{"0" + (i + 1)}</Text>
                  <Text style={styles.tipText}>{line.replace(/^\d+\.\s*/, "")}</Text>
                </View>
              ))}
            </View>
          </Animatable.View>

          {/* â”€â”€ share â”€â”€ */}
          <Animatable.View animation="fadeInUp" delay={260} duration={400}>
            <View style={styles.shareRow}>
              <View style={styles.shareInfo}>
                <Text style={styles.shareTitle}>Export X-Ray card</Text>
                <Text style={styles.shareSubtitle}>Biometric required Â· no fund names shared</Text>
              </View>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
                {sharing ? <ActivityIndicator color={Colors.bg} size="small" /> : <Text style={styles.shareBtnText}>Share</Text>}
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </>
      ) : (
        <Animatable.View animation="fadeInUp" delay={100} duration={400}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No portfolio data yet</Text>
            <Text style={styles.cardBody}>
              Upload a CAMS or KFintech statement above, or tap the scheme code button to add funds manually.
            </Text>
          </View>
        </Animatable.View>
      )}

      <View style={styles.bottomPad} />

      {/* â”€â”€ ViewShot â”€â”€ */}
      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.captureCard}>
            <Text style={styles.captureBrand}>ET FinMentor Â· Portfolio X-Ray</Text>
            <Text style={styles.captureValue}>{formatINR(xray.totalValue)}</Text>
            <Text style={styles.captureLabel}>Portfolio value</Text>
            <View style={styles.captureDivider} />
            <Text style={[styles.captureXirr, { color: overallXirrColor }]}>
              {xray.overallXIRR !== null ? xray.overallXIRR.toFixed(1) + "% XIRR" : "XIRR: insufficient data"}
            </Text>
            <Text style={styles.captureLabel}>{holdings.length + " fund" + (holdings.length !== 1 ? "s" : "") + " analysed"}</Text>
          </View>
        </ViewShot>
      </View>

      {/* â”€â”€ modals â”€â”€ */}
      {editingHolding ? (
        <HoldingEditModal
          holding={editingHolding}
          isVisible={!!editingHolding}
          onClose={() => setEditingHolding(null)}
          onSave={handleSaveEditedHolding}
          onDelete={() => handleDeleteHolding(editingHolding.id)}
        />
      ) : null}

      <Modal
        visible={showAddForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddForm(false)}
      >
        <SchemeInputForm onSubmit={handleAddSchemeHoldings} onCancel={() => setShowAddForm(false)} />
      </Modal>

    </Screen>
  );
}

// â”€â”€â”€ styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  pageHeader:    { marginBottom: Spacing.lg },
  screenEyebrow: { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  screenTitle:   { fontFamily: Typography.fontFamily.display, fontSize: Typography.size.xl, color: Colors.t0 },
  screenSubtitle:{ color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm, lineHeight: 22, marginTop: Spacing.sm },
  emptyHero:     { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm, marginTop: Spacing.md },
  sectionLabel:  { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, letterSpacing: 1.0, textTransform: "uppercase" },
  sectionNote:   { color: Colors.t3, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs },
  bottomPad:     { height: 100 },

  card:      { backgroundColor: Colors.s1, borderColor: Colors.b1, borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.sm },
  cardTitle: { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.lg, marginBottom: Spacing.sm },
  cardBody:  { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm, lineHeight: 22, marginBottom: Spacing.md },

  heroCard:  { backgroundColor: Colors.s1, borderColor: Colors.b1, borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.md },
  heroLabel: { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: Spacing.xs },
  heroValue: { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size["2xl"], letterSpacing: -0.5, marginBottom: Spacing.sm },
  tagRow:    { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap", marginBottom: Spacing.md },
  tag:       { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  tagText:   { fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs },
  allocBar:    { flexDirection: "row", height: 6, borderRadius: Radius.full, overflow: "hidden", gap: 1, marginBottom: Spacing.sm },
  allocSeg:    { height: "100%" },
  allocLegend: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  allocItem:   { flexDirection: "row", alignItems: "center", gap: 5 },
  allocDot:    { width: 6, height: 6, borderRadius: 3 },
  allocText:   { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs },

  analysisCard: { backgroundColor: Colors.s1, borderColor: Colors.b1, borderRadius: Radius.md, borderWidth: 0.5, padding: Spacing.md, marginBottom: Spacing.md },
  analysisHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm, marginBottom: Spacing.xs },
  analysisTitle: { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm },
  analysisBadge: { borderRadius: Radius.full, borderWidth: 0.5, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  analysisBadgeOk: { backgroundColor: Colors.tealDim, borderColor: "rgba(31,190,114,0.22)" },
  analysisBadgeWarn: { backgroundColor: Colors.amberDim, borderColor: "rgba(217,142,56,0.22)" },
  analysisBadgeCritical: { backgroundColor: Colors.redDim, borderColor: "rgba(220,78,78,0.22)" },
  analysisBadgeText: { fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10 },
  analysisBadgeTextOk: { color: Colors.teal },
  analysisBadgeTextWarn: { color: Colors.amber },
  analysisBadgeTextCritical: { color: Colors.red },
  analysisBody: { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 18, marginBottom: Spacing.xs },
  analysisSubtext: { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: 10, lineHeight: 16 },
  analysisList: { gap: 4 },
  analysisListItem: { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 18 },
  analysisMetricRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  analysisMetric: { flex: 1 },
  analysisMetricLabel: { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10, textTransform: "uppercase", marginBottom: 3 },
  analysisMetricValue: { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.sm },
  analysisMetricDivider: { width: 0.5, height: 34, backgroundColor: Colors.b0, marginHorizontal: Spacing.sm },
  analysisWarningText: { color: Colors.amber, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, lineHeight: 18 },
  analysisOkText: { color: Colors.teal, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, lineHeight: 18 },

  refreshNavRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: Colors.b0, marginTop: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  refreshNavLeft:        { flex: 1 },
  refreshNavTime:        { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: 10 },
  refreshNavNote:        { color: Colors.teal, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10, marginTop: 2 },
  refreshNavBtn:         { backgroundColor: Colors.teal, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, flexShrink: 0 },
  refreshNavBtnDisabled: { opacity: 0.6 },
  refreshNavBtnText:     { color: Colors.bg, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs },

  uploadCard:        { backgroundColor: Colors.tealDim, borderColor: "rgba(31,190,114,0.22)", borderRadius: Radius.lg, borderWidth: 0.5, padding: Spacing.lg, marginBottom: Spacing.sm },
  uploadTitle:       { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.md, marginBottom: Spacing.xs },
  uploadBody:        { color: Colors.teal, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 18, marginBottom: Spacing.md },
  uploadBtn:         { backgroundColor: Colors.teal, borderRadius: Radius.full, alignItems: "center", justifyContent: "center", paddingVertical: 11 },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText:     { color: Colors.bg, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm },
  scanPreview:       { width: "100%", height: 130, borderRadius: Radius.md, resizeMode: "cover", marginTop: Spacing.md },
  parseNote:         { color: Colors.teal, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, lineHeight: 18, marginTop: Spacing.sm },
  addByCodeBtn:      { backgroundColor: Colors.s2, borderColor: Colors.b1, borderRadius: Radius.full, borderWidth: 0.5, alignItems: "center", justifyContent: "center", paddingVertical: 11, marginBottom: Spacing.md },
  addByCodeText:     { color: Colors.gold, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm },

  holdingList: { gap: Spacing.sm, marginBottom: Spacing.md },
  holdingCard: { backgroundColor: Colors.s1, borderColor: Colors.b0, borderRadius: Radius.md, borderWidth: 0.5, flexDirection: "row", alignItems: "flex-start", gap: Spacing.md, padding: Spacing.md },
  holdingDot:  { width: 8, height: 8, borderRadius: 2, marginTop: 4, flexShrink: 0 },
  holdingBody: { flex: 1, minWidth: 0 },
  holdingName: { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm, marginBottom: 4, lineHeight: 20 },
  holdingMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" },
  holdingCat:  { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, letterSpacing: 0.5, textTransform: "uppercase" },
  schemeBadge:     { backgroundColor: Colors.s3, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  schemeBadgeText: { color: Colors.t2, fontFamily: Typography.fontFamily.numeric, fontSize: 10 },
  dateBadge:     { backgroundColor: Colors.tealDim, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  dateBadgeWarn: { backgroundColor: Colors.amberDim },
  dateBadgeText: { color: Colors.teal, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10 },
  holdingRight:  { alignItems: "flex-end", flexShrink: 0 },
  holdingValue:  { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.sm, marginBottom: 3 },
  holdingXirr:   { fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.xs },

  benchRow:     { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  benchCol:     { flex: 1 },
  benchDivider: { width: 0.5, height: 40, backgroundColor: Colors.b0, marginHorizontal: Spacing.sm },
  benchLabel:   { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },
  benchValue:   { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.xl },
  benchNote:    { borderTopWidth: 0.5, borderTopColor: Colors.b0, paddingTop: Spacing.md },
  benchNoteText:{ color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 18 },

  overlapList:   { gap: Spacing.sm, marginBottom: Spacing.md },
  overlapCard:   { borderRadius: Radius.md, borderWidth: 0.5, padding: Spacing.md },
  overlapHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs, flexWrap: "wrap" },
  overlapBadge:  { borderRadius: Radius.full, borderWidth: 0.5, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  overlapLevel:  { fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10, letterSpacing: 0.6 },
  overlapFunds:  { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm, flex: 1 },
  overlapReason: { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 18 },

  dragCard:  { backgroundColor: Colors.amberDim, borderColor: "rgba(217,142,56,0.22)", borderRadius: Radius.md, borderWidth: 0.5, padding: Spacing.md, marginBottom: Spacing.md },
  dragLabel: { color: Colors.amber, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: Spacing.xs },
  dragValue: { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.xl, marginBottom: Spacing.xs },
  dragBody:  { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 18 },

  planList:       { gap: Spacing.sm, marginBottom: Spacing.md },
  tipCard:        { backgroundColor: Colors.s1, borderColor: Colors.b0, borderLeftColor: Colors.gold, borderLeftWidth: 2, borderTopRightRadius: Radius.md, borderBottomRightRadius: Radius.md, borderWidth: 0.5, flexDirection: "row", gap: Spacing.md, padding: Spacing.md },
  tipNum:         { color: Colors.gold, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.sm, flexShrink: 0 },
  tipText:        { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 19, flex: 1 },
  errorText:      { color: Colors.red, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, marginBottom: Spacing.sm },
  refreshBtn:     { borderColor: "rgba(133,114,224,0.25)", borderRadius: Radius.full, borderWidth: 0.5, paddingHorizontal: Spacing.md, paddingVertical: 4 },
  refreshBtnText: { color: Colors.purple, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs },

  shareRow:      { backgroundColor: Colors.s1, borderColor: Colors.b1, borderRadius: Radius.lg, borderWidth: 0.5, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, marginBottom: Spacing.md },
  shareInfo:     { flex: 1 },
  shareTitle:    { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm, marginBottom: 2 },
  shareSubtitle: { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: 10 },
  shareBtn:      { backgroundColor: Colors.gold, borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: 9, marginLeft: Spacing.md },
  shareBtnText:  { color: Colors.bg, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm },

  captureContainer: { left: -9999, position: "absolute", top: 0 },
  captureCard:      { backgroundColor: Colors.s1, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.b1, padding: 28, width: 340, gap: Spacing.sm },
  captureBrand:     { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm, marginBottom: Spacing.md },
  captureValue:     { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: 40 },
  captureLabel:     { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs },
  captureDivider:   { backgroundColor: Colors.b1, height: 0.5, marginVertical: Spacing.md },
  captureXirr:      { fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size.xl },
});
