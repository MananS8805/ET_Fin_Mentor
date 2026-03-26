import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Animatable from "react-native-animatable";
import Animated from "react-native-reanimated";

import { LiquidProgressBar } from "../../src/components/LiquidProgressBar";
import { Screen } from "../../src/components/Screen";
import { TiltCard } from "../../src/components/TiltCard";
import {
  formatINR,
  getCategoryAllocation,
  getEmergencyFundMonths,
  getFireCorpusTarget,
  getOverallHealthScore,
  getSavingsRate,
  projectedCorpusAtAge,
} from "../../src/core/models/UserProfile";
import { useAppStore } from "../../src/core/services/store";
import { Colors, Radius, Shadows, Spacing, Typography } from "../../src/core/theme";

// ─── types ───────────────────────────────────────────────────────────────────

type FocusArea = "portfolio" | "profile" | "health" | "momentum" | "modules";

type ModuleTile = {
  icon:     string;
  key:      string;
  subtitle: string;
  title:    string;
  to:       string;
};

interface NewsItem {
  title:       string;
  link:        string;
  pubDate:     string;
  description: string;
  narrative:   string | null;
  loading:     boolean;
}

// ─── constants ───────────────────────────────────────────────────────────────

const MODULES: ModuleTile[] = [
  { key: "portfolio", icon: "◎", title: "Portfolio X-Ray", subtitle: "Overlap and XIRR",    to: "/portfolio-xray"         },
  { key: "fire",      icon: "↗", title: "FIRE Planner",    subtitle: "Retirement simulator", to: "/dashboard/fire-planner" },
  { key: "tax",       icon: "⊕", title: "Tax Wizard",      subtitle: "Old vs new regime",    to: "/tax-wizard"             },
  { key: "future",    icon: "◈", title: "Future You",      subtitle: "Scenario mirror",      to: "/dashboard/future-you"   },
  { key: "couple",    icon: "⊗", title: "Couple Planner",  subtitle: "Joint strategy",       to: "/couples-planner"        },
  { key: "chat",      icon: "◐", title: "Money Chat",      subtitle: "Ask FinMentor AI",     to: "/dashboard/chat"         },
  { key: "life",      icon: "◑", title: "Life Events",     subtitle: "SIP streak + advice",  to: "/life-events"            }, 
];

// ET Markets RSS feed — no API key needed, real ET content
const ET_RSS_URL = "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms";

// Groq API — key must be set as EXPO_PUBLIC_GROQ_API_KEY in your .env
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";

// ─── helpers ─────────────────────────────────────────────────────────────────

function focusText(isFocused: boolean) {
  return {
    fontFamily: isFocused
      ? Typography.fontFamily.displaySemiBold
      : Typography.fontFamily.bodyMedium,
  } as const;
}

function allocationColor(category: string): string {
  if (category === "large_cap") return Colors.gold;
  if (category === "mid_cap")   return Colors.teal;
  if (category === "small_cap") return Colors.purple;
  if (category === "elss")      return Colors.blue;
  if (category === "hybrid")    return Colors.amber;
  if (category === "debt")      return Colors.red;
  return Colors.t2;
}

/**
 * Parses RSS XML and strips CDATA wrappers.
 * Falls back to plain tag extraction if CDATA is absent.
 * Also strips any residual HTML tags from description.
 */
function parseRSSItems(
  xml: string,
): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];

  for (const item of itemMatches.slice(0, 6)) {
    // ── title: try CDATA first, then plain ──────────────────────────────────
    let title =
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ??
      "";

    // Belt-and-suspenders: strip any leftover CDATA markers the regex missed
    title = title.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();

    // ── link ────────────────────────────────────────────────────────────────
    const link =
      item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ??
      item.match(/<guid>([\s\S]*?)<\/guid>/)?.[1] ??
      "";

    // ── pubDate ─────────────────────────────────────────────────────────────
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";

    // ── description: strip CDATA + HTML tags ────────────────────────────────
    let description =
      item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
      item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ??
      "";
    description = description
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/<[^>]+>/g, "")
      .trim()
      .slice(0, 200);

    if (title) {
      items.push({ title, link: link.trim(), pubDate: pubDate.trim(), description });
    }
  }

  return items;
}

function formatPubDate(raw: string): string {
  try {
    const d = new Date(raw);
    return d.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return raw;
  }
}

// ─── news card ────────────────────────────────────────────────────────────────

function NewsCard({
  item,
  onNarrativeRequest,
}: {
  item: NewsItem;
  onNarrativeRequest: () => void;
}) {
  async function handlePress() {
    if (!item.link) return;
    try { await Linking.openURL(item.link); } catch { /* silently ignore */ }
  }

  return (
    <TouchableOpacity style={styles.newsCard} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.newsCardHeader}>
        <View style={styles.etBadge}>
          <Text style={styles.etBadgeText}>ET Markets</Text>
        </View>
        <Text style={styles.newsPubDate}>{formatPubDate(item.pubDate)}</Text>
      </View>

      <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>

      {item.description ? (
        <Text style={styles.newsDesc} numberOfLines={2}>{item.description}</Text>
      ) : null}

      {/* AI narrative section */}
      {item.narrative ? (
        <View style={styles.newsNarrativeBox}>
          <View style={styles.newsNarrativeBadge}>
            <Text style={styles.newsNarrativeBadgeText}>AI · What this means for you</Text>
          </View>
          <Text style={styles.newsNarrativeText}>{item.narrative}</Text>
        </View>
      ) : (
        // FIX: wrap in View with onStartShouldSetResponder to prevent
        // touch bubbling to the parent TouchableOpacity without relying
        // on e.stopPropagation() which does not work in React Native.
        <View onStartShouldSetResponder={() => true}>
          <TouchableOpacity
            style={styles.newsNarrativeBtn}
            onPress={onNarrativeRequest}
            activeOpacity={0.7}
          >
            {item.loading ? (
              <ActivityIndicator color={Colors.gold} size="small" />
            ) : (
              <Text style={styles.newsNarrativeBtnText}>✦ What does this mean for me?</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.newsOpenLink}>Read full story on ET →</Text>
    </TouchableOpacity>
  );
}

// ─── screen ──────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const profile         = useAppStore((state) => state.currentProfile);
  const portfolioXRay   = useAppStore((state) => state.portfolioXRay);
  const setPortfolioXRay = useAppStore((state) => state.setPortfolioXRay);
  const [focusArea, setFocusArea] = useState<FocusArea>("portfolio");

  // news state
  const [newsItems,   setNewsItems]   = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError,   setNewsError]   = useState("");

  const { totalPortfolioValue, corpusProgress } = useMemo(() => {
    const fromStore = portfolioXRay?.totalValue ?? 0;
    const fromProfile =
      profile?.camsData?.holdings?.reduce((sum, h) => sum + (h.currentValue || 0), 0) ?? 0;

    const value = fromStore > 0 ? fromStore : fromProfile;
    const target = profile ? getFireCorpusTarget(profile) : 0;

    const projected = profile ? projectedCorpusAtAge(profile, profile.retirementAge) : 0;
    const progress = target > 0 ? Math.min(value / target, 1) : 0;

    return { totalPortfolioValue: value, corpusProgress: progress };
  }, [portfolioXRay?.totalValue, profile?.camsData?.holdings, profile]);

  const xirr            = portfolioXRay?.overallXIRR ?? null;
  const healthScore     = profile ? getOverallHealthScore(profile) : 0;
  const savingsRate     = profile ? getSavingsRate(profile) : 0;
  const emergencyMonths = profile ? getEmergencyFundMonths(profile) : 0;
  const fireTarget      = profile ? getFireCorpusTarget(profile) : 0;
  const firstName       = profile?.name?.split(" ")[0] ?? "Investor";

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []); 

  const greetingText    = greeting + ", " + firstName;
  const xirrText        = "XIRR: " + (xirr !== null ? xirr.toFixed(1) + "%" : "N/A");
  const savingsText     = "Savings: " + savingsRate.toFixed(0) + "%";
  const emergencyText   = "Emergency runway: " + emergencyMonths.toFixed(1) + " months";
  const riskText        = "Risk style: " + (profile?.riskProfile ?? "Balanced");
  const healthScoreText = healthScore.toFixed(0) + "/100";
  
  const hasPortfolio       = portfolioXRay !== null && portfolioXRay.holdings.length > 0;
  const allocationSegments = portfolioXRay
    ? Object.entries(portfolioXRay.categoryAllocation).filter(([, v]) => v > 0)
    : [];

  useEffect(() => {
    if (!portfolioXRay && profile?.camsData?.holdings?.length) {
      const holdings = profile.camsData.holdings;
      const computedXRay = {
        holdings,
        totalValue: holdings.reduce((s, h) => s + h.currentValue, 0),
        totalInvested: holdings.reduce((s, h) => s + h.purchaseValue, 0),
        overallXIRR: null,
        overlapPairs: [],
        expenseRatioDrag: 0,
        categoryAllocation: getCategoryAllocation(holdings),
      };
      setPortfolioXRay(computedXRay);
    }
  }, [portfolioXRay, profile, setPortfolioXRay]);

  useEffect(() => {
    if (!__DEV__) return;
    if (!profile) return;
    console.log("[FIRE]", {
      value: totalPortfolioValue,
      target: fireTarget,
      progress: corpusProgress,
    });
  }, [totalPortfolioValue, fireTarget, corpusProgress, profile]);

  // ── fetch ET news on mount ─────────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setNewsLoading(true);
        setNewsError("");

        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(ET_RSS_URL, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error("Failed to fetch ET news.");

        const xml    = await res.text();
        const parsed = parseRSSItems(xml);

        if (active) {
          setNewsItems(parsed.map((p) => ({ ...p, narrative: null, loading: false })));
        }
      } catch {
        if (active) setNewsError("Unable to load ET Markets news. Check your connection.");
      } finally {
        if (active) setNewsLoading(false);
      }
    })();

    return () => { active = false; };
  }, []);

  // ── fetch AI narrative for a single news item via Groq ────────────────────

  async function handleNarrativeRequest(index: number) {
    if (!profile) return;
    const item = newsItems[index];
    if (!item || item.loading || item.narrative) return;

    // mark as loading
    setNewsItems((prev) =>
      prev.map((n, i) => (i === index ? { ...n, loading: true } : n)),
    );

    try {
      const prompt =
        "You are ET FinMentor, a personal finance AI. The user has the following profile:\n" +
        "Monthly income: " + formatINR(profile.monthlyIncome) + "\n" +
        "Monthly SIP: "    + formatINR(profile.monthlySIP)    + "\n" +
        "Risk profile: "   + profile.riskProfile              + "\n" +
        "Emergency fund: " + getEmergencyFundMonths(profile).toFixed(1) + " months\n\n" +
        "This ET Markets news headline just appeared:\n" +
        "\"" + item.title + "\"\n\n" +
        item.description + "\n\n" +
        "In 2-3 sentences, explain what this news means specifically for this user's financial " +
        "situation. Be direct, personal, and actionable. No generic advice.";

      // FIX: switched from Anthropic to Groq; added Authorization header
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model:      "llama-3.1-8b-instant", // fast & cheap; swap to llama-3.3-70b-versatile for higher quality
          max_tokens: 200,
          messages:   [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.warn("Groq API error:", response.status, errBody);
        throw new Error("Groq API returned " + response.status);
      }

      const data      = await response.json();
      const narrative = data.choices?.[0]?.message?.content?.trim()
        ?? "Unable to generate narrative.";

      setNewsItems((prev) =>
        prev.map((n, i) => (i === index ? { ...n, narrative, loading: false } : n)),
      );
    } catch (err) {
      console.warn("Narrative generation failed:", err);
      setNewsItems((prev) =>
        prev.map((n, i) =>
          i === index
            ? { ...n, narrative: "Unable to generate narrative. Check your connection.", loading: false }
            : n,
        ),
      );
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Screen scroll>

      {/* ── hero card ── */}
      <Animatable.View animation="fadeInUp" delay={0} duration={500}>
        <Pressable onPress={() => setFocusArea("portfolio")}>
          <View style={[styles.card, styles.heroCard]}>
            <Text style={[styles.heroGreeting, focusText(focusArea === "portfolio")]}>
              {greetingText}
            </Text>
            <Text style={styles.heroLabel}>Total portfolio value</Text>
            <Animated.View sharedTransitionTag="portfolio-shared-value" style={styles.portfolioSharedWrap}>
              <Text style={[styles.heroValue, focusText(focusArea === "portfolio")]}>
                {formatINR(totalPortfolioValue)}
              </Text>
            </Animated.View>
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMetaText}>{xirrText}</Text>
              <Text style={styles.heroMetaText}>{savingsText}</Text>
            </View>
          </View>
        </Pressable>
      </Animatable.View>

      {/* ── profile + health ── */}
      <View style={styles.bentoColumn}>
        <TiltCard
          onPress={() => { setFocusArea("profile"); router.push("/profile-edit" as never); }}
          style={styles.bentoCell}
        >
          <Animatable.View animation="fadeInUp" delay={70} duration={500}>
            <View style={[styles.card, styles.tiltCard]}>
              <Text style={[styles.bentoHeading, focusText(focusArea === "profile")]}>Profile Snapshot</Text>
              <Text style={styles.bentoBody}>{emergencyText}</Text>
              <Text style={styles.bentoBody}>{riskText}</Text>
            </View>
          </Animatable.View>
        </TiltCard>

        <TiltCard
          onPress={() => { setFocusArea("health"); router.push("/health-score" as never); }}
          style={styles.bentoCell}
        >
          <Animatable.View animation="fadeInUp" delay={120} duration={500}>
            <View style={[styles.card, styles.tiltCard]}>
              <Text style={[styles.bentoHeading, focusText(focusArea === "health")]}>Financial Health</Text>
              <Text style={styles.healthDial}>{healthScoreText}</Text>
              <Text style={styles.bentoBody}>Tap to improve weak dimensions</Text>
            </View>
          </Animatable.View>
        </TiltCard>
      </View>

      {/* ── momentum to FIRE ── */}
      <Animatable.View animation="fadeInUp" delay={180} duration={500}>
        <Pressable onPress={() => setFocusArea("momentum")}>
          <View style={[styles.card, styles.momentumCard]}>
            <Text style={[styles.bentoHeading, focusText(focusArea === "momentum")]}>Momentum To FIRE</Text>
            <LiquidProgressBar label="Retirement corpus readiness" progress={corpusProgress} />
<Text style={styles.bentoBody}>
  {fireTarget > 0 && profile
    ? formatINR(projectedCorpusAtAge(profile, profile.retirementAge), true) +
      " projected by age " +
      profile.retirementAge +
      " · target " +
      formatINR(fireTarget, true)
    : "Set your retirement expense in profile to unlock this."}
</Text>
          </View>
        </Pressable>
      </Animatable.View>

      {/* ── asset allocation ── */}
      {hasPortfolio ? (
        <Animatable.View animation="fadeInUp" delay={210} duration={500}>
          <View style={[styles.card, styles.allocCard]}>
            <Text style={styles.bentoHeading}>Asset Allocation</Text>
            <View style={styles.allocBar}>
              {allocationSegments.map(([cat, val]) => (
                <View
                  key={cat}
                  style={[styles.allocSegment, { flex: val, backgroundColor: allocationColor(cat) }]}
                />
              ))}
            </View>
          </View>
        </Animatable.View>
      ) : null}

      {/* ── bento modules ── */}
      <Animatable.View animation="fadeInUp" delay={240} duration={500}>
        <Text style={[styles.sectionTitle, focusText(focusArea === "modules")]}>Bento Modules</Text>
        <View style={styles.moduleGrid}>
          {MODULES.map((mod) => (
            <Pressable
              key={mod.key}
              onPress={() => { setFocusArea("modules"); router.push(mod.to as never); }}
              style={styles.moduleTile}
            >
              <Text style={styles.moduleIcon}>{mod.icon}</Text>
              <Text style={styles.moduleTitle}>{mod.title}</Text>
              <Text style={styles.moduleSubtitle}>{mod.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </Animatable.View>

      {/* ── ET Markets news ── */}
      <Animatable.View animation="fadeInUp" delay={290} duration={500}>
        <View style={styles.newsSectionHeader}>
          <Text style={styles.sectionTitle}>Market Pulse</Text>
          <View style={styles.etSourceBadge}>
            <Text style={styles.etSourceText}>via Economic Times</Text>
          </View>
        </View>
        <Text style={styles.newsSectionSub}>
          Top headlines · tap any story to read on ET · tap the AI button for your personal impact
        </Text>

        {newsLoading ? (
          <View style={styles.newsLoadingBox}>
            <ActivityIndicator color={Colors.gold} size="small" />
            <Text style={styles.newsLoadingText}>Fetching ET Markets headlines...</Text>
          </View>
        ) : newsError ? (
          <View style={styles.newsErrorBox}>
            <Text style={styles.newsErrorText}>{newsError}</Text>
          </View>
        ) : (
          // FIX: replaced View+map with FlatList for better performance (fewer dropped frames).
          // scrollEnabled={false} because the parent Screen component handles scrolling.
          // keyExtractor uses item.link (stable) instead of array index.
          <FlatList
            data={newsItems}
            keyExtractor={(item) => item.link || item.pubDate}
            scrollEnabled={false}
            contentContainerStyle={styles.newsList}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
            renderItem={({ item, index }) => (
              <NewsCard
                item={item}
                onNarrativeRequest={() => handleNarrativeRequest(index)}
              />
            )}
          />
        )}
      </Animatable.View>

      <View style={styles.bottomPad} />

    </Screen>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  card: {
    backgroundColor: Colors.s1, borderColor: Colors.b1,
    borderRadius: Radius.lg, borderWidth: 0.5,
    padding: Spacing.lg, ...Shadows.md,
  },

  heroCard:            { marginBottom: Spacing.lg, marginTop: Spacing.md, minHeight: 160 },
  heroGreeting:        { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.md, marginBottom: Spacing.sm },
  heroLabel:           { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm, marginBottom: Spacing.xs },
  portfolioSharedWrap: { alignSelf: "flex-start", marginBottom: Spacing.sm },
  heroValue:           { color: Colors.t0, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size["3xl"], letterSpacing: -0.6 },
  heroMetaRow:         { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  heroMetaText:        { backgroundColor: Colors.s2, borderColor: Colors.b1, borderRadius: Radius.full, borderWidth: 0.5, color: Colors.t1, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs, overflow: "hidden", paddingHorizontal: Spacing.md, paddingVertical: 6 },

  bentoColumn: { flexDirection: "column", gap: Spacing.md, marginBottom: Spacing.md },
  bentoCell:   { width: "100%" },
  tiltCard:    { minHeight: 110 },
  bentoHeading:{ color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.md, marginBottom: Spacing.sm },
  bentoBody:   { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm, lineHeight: 20 },
  healthDial:  { color: Colors.gold, fontFamily: Typography.fontFamily.numeric, fontSize: Typography.size["2xl"], marginBottom: Spacing.xs },
  momentumCard:{ marginBottom: Spacing.lg },
  allocCard:   { marginBottom: Spacing.lg },
  allocBar:    { backgroundColor: Colors.s3, borderRadius: Radius.full, flexDirection: "row", gap: 1, height: 8, marginTop: Spacing.sm, overflow: "hidden" },
  allocSegment:{ height: "100%" },

  sectionTitle: { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.lg, marginBottom: Spacing.md },

  moduleGrid:    { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md },
  moduleTile:    { backgroundColor: Colors.s1, borderColor: Colors.b0, borderRadius: Radius.lg, borderWidth: 0.5, minHeight: 120, overflow: "hidden", padding: Spacing.md, width: "47.8%" },
  moduleIcon:    { color: Colors.gold, fontSize: 20, marginBottom: Spacing.sm },
  moduleTitle:   { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm, marginBottom: 4 },
  moduleSubtitle:{ color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 16 },

  // ── news ───────────────────────────────────────────────────────────────────
  newsSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.xs },
  etSourceBadge:     { backgroundColor: Colors.s2, borderColor: Colors.b1, borderRadius: Radius.full, borderWidth: 0.5, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  etSourceText:      { color: Colors.t2, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10 },
  newsSectionSub:    { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 17, marginBottom: Spacing.md },

  newsLoadingBox:  { alignItems: "center", flexDirection: "row", gap: Spacing.sm, padding: Spacing.lg, backgroundColor: Colors.s1, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.b0 },
  newsLoadingText: { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm },
  newsErrorBox:    { padding: Spacing.md, backgroundColor: Colors.redDim, borderRadius: Radius.md, borderWidth: 0.5, borderColor: "rgba(220,78,78,0.22)" },
  newsErrorText:   { color: Colors.red, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.sm },

  newsList: { gap: Spacing.md, marginBottom: Spacing.lg },
  newsCard:  {
    backgroundColor: Colors.s1, borderColor: Colors.b1,
    borderRadius: Radius.lg, borderWidth: 0.5,
    padding: Spacing.md, gap: Spacing.sm,
  },
  newsCardHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  etBadge:          { backgroundColor: Colors.amberDim, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  etBadgeText:      { color: Colors.amber, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 9, letterSpacing: 0.5 },
  newsPubDate:      { color: Colors.t3, fontFamily: Typography.fontFamily.body, fontSize: 10 },
  newsTitle:        { color: Colors.t0, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.sm, lineHeight: 20 },
  newsDesc:         { color: Colors.t2, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 17 },
  newsOpenLink:     { color: Colors.t3, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 10, textAlign: "right" },

  newsNarrativeBox:       { backgroundColor: Colors.s2, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.b0, padding: Spacing.sm, gap: Spacing.xs },
  newsNarrativeBadge:     { alignSelf: "flex-start", backgroundColor: Colors.goldDim, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  newsNarrativeBadgeText: { color: Colors.gold, fontFamily: Typography.fontFamily.bodyMedium, fontSize: 9 },
  newsNarrativeText:      { color: Colors.t1, fontFamily: Typography.fontFamily.body, fontSize: Typography.size.xs, lineHeight: 17 },

  newsNarrativeBtn:     { alignItems: "center", borderColor: "rgba(200,168,75,0.25)", borderRadius: Radius.full, borderWidth: 0.5, paddingVertical: 7 },
  newsNarrativeBtnText: { color: Colors.gold, fontFamily: Typography.fontFamily.bodyMedium, fontSize: Typography.size.xs },

  bottomPad: { height: 100 },
});
