import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
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

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── build xray ───────────────────────────────────────────────────────────────

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

function buildFallbackPlan(xray: PortfolioXRay): string {
  const lines: string[] = [];

  if (xray.overlapPairs.length > 0) {
    const pair = xray.overlapPairs[0];
    lines.push("1. Consider consolidating " + pair.fund1 + " and " + pair.fund2 + " — " + pair.reason);
  } else {
    lines.push("1. No significant fund overlap detected in your current portfolio.");
  }

  if (xray.expenseRatioDrag > 0) {
    lines.push("2. Your portfolio costs roughly " + formatINR(xray.expenseRatioDrag) + " more per year than an equivalent index fund. Consider switching high-expense funds to direct plans.");
  } else {
    lines.push("2. Expense ratio drag is within acceptable range.");
  }

  const equityPct =
    (xray.categoryAllocation.large_cap ?? 0) + (xray.categoryAllocation.mid_cap ?? 0) +
    (xray.categoryAllocation.small_cap ?? 0) + (xray.categoryAllocation.elss ?? 0) +
    (xray.categoryAllocation.hybrid ?? 0);

  if (equityPct > 90) {
    lines.push("3. Portfolio is heavily equity-concentrated. Consider adding a debt or liquid fund for stability.");
  } else if (equityPct < 40) {
    lines.push("3. Equity allocation looks low for long-term wealth creation. Review whether your goal horizon supports more equity.");
  } else {
    lines.push("3. Equity at " + equityPct.toFixed(0) + "% is broadly reasonable. Review annually.");
  }

  return lines.join("\n\n");
}

// ─── NAV refresh helper ───────────────────────────────────────────────────────

async function fetchLatestNAV(schemeCode: string): Promise<{ nav: number; date: string } | null> {
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 6000);
    const res        = await fetch("https://api.mfapi.in/mf/" + schemeCode, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== "SUCCESS" || !json.data?.[0]) return null;
    const nav = parseFloat(json.data[0].nav);
    return isNaN(nav) ? null : { nav, date: json.data[0].date };
  } catch {
    return null;
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

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
        <Text style={styles.overlapFunds} numberOfLines={1}>{pair.fund1 + " · " + pair.fund2}</Text>
      </View>
      <Text style={styles.overlapReason}>{pair.reason}</Text>
    </View>
  );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function PortfolioXRayScreen() {
  const profile           = useAppStore((s) => s.currentProfile);
  const setCurrentProfile = useAppStore((s) => s.setCurrentProfile);
  const portfolioXRay     = useAppStore((s) => s.portfolioXRay);
  const setPortfolioXRay  = useAppStore((s) => s.setPortfolioXRay);
  const session           = useAppStore((s) => s.session);
  const shareCardRef      = useRef<ViewShot | null>(null);

  const [holdings,       setHoldings]      = useState<MFHolding[]>(portfolioXRay?.holdings ?? []);
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

  const xray           = useMemo(() => buildXRay(holdings), [holdings]);
  const fallbackPlan   = useMemo(() => buildFallbackPlan(xray), [xray]);
  const pieData        = useMemo(() =>
    Object.entries(xray.categoryAllocation)
      .filter(([, pct]) => pct > 0)
      .map(([cat, pct]) => ({ cat: cat as MFHolding["category"], pct })),
    [xray.categoryAllocation]);
  const hasPortfolio     = holdings.length > 0;
  const refreshableCount = holdings.filter((h) => !!h.schemeCode).length;

  useEffect(() => {
    if (holdings.length > 0) setPortfolioXRay(xray);
  }, [holdings, xray, setPortfolioXRay]);

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

  // ── persist ───────────────────────────────────────────────────────────────

  function persistHoldings(next: MFHolding[]) {
    if (!profile) return;
    setHoldings(next);
    const updatedProfile = { ...profile, camsData: { holdings: next } };
    setCurrentProfile(updatedProfile);
    void ProfileService.saveProfile(updatedProfile, session).catch((e) =>
      console.warn("[PortfolioXRay] Failed to persist:", e)
    );
  }

  // ── handlers ──────────────────────────────────────────────────────────────

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
      persistHoldings(mapped);
    } catch (err) {
      Alert.alert("Unable to parse statement", err instanceof Error ? err.message : "Please try a clearer image.");
    } finally { setParsing(false); }
  }

  function handleAddSchemeHoldings(newHoldings: MFHolding[]) {
    setHoldings((prev) => {
      const existingIds = new Set(prev.map((h) => h.id));
      const next = [...prev, ...newHoldings.filter((h) => !existingIds.has(h.id))];
      persistHoldings(next);
      return next;
    });
    setShowAddForm(false);
  }

  function handleSaveEditedHolding(updated: MFHolding) {
    setHoldings((prev) => { const next = prev.map((h) => h.id === updated.id ? updated : h); persistHoldings(next); return next; });
    setEditingHolding(null);
  }

  function handleDeleteHolding(id: string) {
    Alert.alert("Remove holding", "Remove this fund from your portfolio?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        setHoldings((prev) => { const next = prev.filter((h) => h.id !== id); persistHoldings(next); return next; });
        setEditingHolding(null);
      }},
    ]);
  }

  // ── NAV refresh ───────────────────────────────────────────────────────────

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
      setRefreshNote("Fetching latest NAVs...");
      let updated = 0;
      let failed  = 0;
      const now   = new Date();

      const updatedHoldings = await Promise.all(
        holdings.map(async (h) => {
          if (!h.schemeCode) return h;
          const result = await fetchLatestNAV(h.schemeCode);
          if (!result) { failed++; return h; }
          updated++;
          return { ...h, nav: result.nav, currentValue: h.units * result.nav } as MFHolding;
        })
      );

      persistHoldings(updatedHoldings);
      const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      setLastRefreshed(timeStr);
      setRefreshNote(
        updated + " fund" + (updated !== 1 ? "s" : "") + " updated" +
        (failed > 0 ? " · " + failed + " failed" : "") +
        " · " + timeStr
      );
    } catch {
      setRefreshNote("Refresh failed. Check your connection.");
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

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Screen scroll>

      <View style={styles.pageHeader}>
        <Text style={styles.screenEyebrow}>Portfolio X-Ray</Text>
        <Text style={styles.screenTitle}>Your funds, dissected</Text>
      </View>

      {/* ── hero card ── */}
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

            {/* ── refresh NAVs row ── */}
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

      {/* ── add funds ── */}
      <Animatable.View animation="fadeInUp" delay={50} duration={400}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Add funds</Text>
        </View>
        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload statement</Text>
          <Text style={styles.uploadBody}>
            CAMS or KFintech screenshot — Gemini Vision extracts holdings with real transaction dates for accurate XIRR.
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

      {/* ── holdings list ── */}
      {hasPortfolio ? (
        <>
          <Animatable.View animation="fadeInUp" delay={100} duration={400}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>{"Holdings · " + holdings.length + " funds"}</Text>
              <Text style={styles.sectionNote}>Tap to edit</Text>
            </View>
            <View style={styles.holdingList}>
              {holdings.map((h, i) => (
                <HoldingCard key={h.id} holding={h} index={i} onEdit={() => setEditingHolding(h)} />
              ))}
            </View>
          </Animatable.View>

          {/* ── benchmark ── */}
          <Animatable.View animation="fadeInUp" delay={140} duration={400}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Benchmark · vs Nifty 50</Text>
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

          {/* ── overlap ── */}
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

          {/* ── expense drag ── */}
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

          {/* ── AI rebalancing plan ── */}
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

          {/* ── share ── */}
          <Animatable.View animation="fadeInUp" delay={260} duration={400}>
            <View style={styles.shareRow}>
              <View style={styles.shareInfo}>
                <Text style={styles.shareTitle}>Export X-Ray card</Text>
                <Text style={styles.shareSubtitle}>Biometric required · no fund names shared</Text>
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

      {/* ── ViewShot ── */}
      <View pointerEvents="none" style={styles.captureContainer}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View collapsable={false} style={styles.captureCard}>
            <Text style={styles.captureBrand}>ET FinMentor · Portfolio X-Ray</Text>
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

      {/* ── modals ── */}
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

// ─── styles ───────────────────────────────────────────────────────────────────

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