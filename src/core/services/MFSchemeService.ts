import AsyncStorage from "@react-native-async-storage/async-storage";

export interface MFScheme {
  isin: string;
  schemeName: string;
  schemeCode: string;
  nav: number;
  navDate: string;
  fundManager: string;
  expenseRatio: number;
  category: "large_cap" | "mid_cap" | "small_cap" | "elss" | "debt" | "hybrid" | "liquid" | "other";
}

const CACHE_KEY = "mf_scheme_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

function normalizeCategory(apiCategory: string): MFScheme["category"] {
  const lower = apiCategory.toLowerCase();
  
  if (lower.includes("large cap")) return "large_cap";
  if (lower.includes("mid cap")) return "mid_cap";
  if (lower.includes("small cap")) return "small_cap";
  if (lower.includes("elss")) return "elss";
  if (lower.includes("debt") || lower.includes("fixed income")) return "debt";
  if (lower.includes("hybrid") || lower.includes("balanced")) return "hybrid";
  if (lower.includes("liquid") || lower.includes("money market")) return "liquid";
  
  return "other";
}

async function getCachedScheme(schemeCode: string): Promise<MFScheme | null> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache = JSON.parse(cacheStr) as Record<string, { data: MFScheme; timestamp: number }>;
    const cached = cache[schemeCode.toUpperCase()];

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CACHE_DURATION) {
      delete cache[schemeCode.toUpperCase()];
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return cached.data;
  } catch (error) {
    console.warn("[MFSchemeService] Failed to read cache", error);
    return null;
  }
}

async function setCachedScheme(scheme: MFScheme): Promise<void> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    const cache = cacheStr ? JSON.parse(cacheStr) : {};

    cache[scheme.schemeCode.toUpperCase()] = {
      data: scheme,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("[MFSchemeService] Failed to cache scheme", error);
  }
}

export const MFSchemeService = {
  /**
   * Fetch scheme details from MFAPI.in
   * Tries cache first, then API
   */
  async fetchScheme(schemeCode: string): Promise<MFScheme> {
    if (!schemeCode || schemeCode.trim().length === 0) {
      throw new Error("Scheme code cannot be empty");
    }

    const normalizedCode = schemeCode.trim().toUpperCase();

    // Check cache first
    const cached = await getCachedScheme(normalizedCode);
    if (cached) {
      return cached;
    }

    // Fetch from API
    try {
      const response = await fetch(
        `https://api.mfapi.in/mf/${normalizedCode}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Scheme code "${schemeCode}" not found. Please check and try again.`);
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.meta || !data.data || data.data.length === 0) {
        throw new Error("Invalid scheme data received from API");
      }

      const meta = data.meta;
      const latest = data.data[0];

      const scheme: MFScheme = {
        isin: meta.isin || "",
        schemeName: meta.fund_name || "Unknown Fund",
        schemeCode: meta.scheme_code || normalizedCode,
        nav: parseFloat(latest.nav) || 0,
        navDate: latest.date || new Date().toISOString().split("T")[0],
        fundManager: meta.fund_manager || "N/A",
        expenseRatio: parseFloat(meta.expense_ratio || "0") || 0,
        category: normalizeCategory(meta.category || "Other"),
      };

      // Cache the result
      await setCachedScheme(scheme);

      return scheme;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw new Error(
        error instanceof Error ? error.message : "Failed to fetch scheme details. Please check your internet connection."
      );
    }
  },

  /**
   * Clear all cached schemes
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch (error) {
      console.warn("[MFSchemeService] Failed to clear cache", error);
    }
  },
};
