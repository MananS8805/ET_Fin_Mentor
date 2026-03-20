import { startOfDay, differenceInDays } from "date-fns";
import { create } from "zustand";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Transaction {
  date: Date;
  amount: number; // Amount invested in rupees
  units: number; // Units purchased
}

export interface Fund {
  schemeCode: string;
  schemeName: string;
  category: string;
  nav: number; // Current Net Asset Value
  expenseRatio: number; // Annual expense ratio as percentage (e.g., 0.5 for 0.5%)
}

export interface PortfolioMetrics {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  absoluteReturn: number; // As percentage
  xirr: number; // As percentage
  expenseDragAnnual: number; // Annual expense drag in rupees
  lastUpdated: number; // Timestamp
}

export interface HoldingWithOverlap {
  schemeCode: string;
  schemeName: string;
  quantity: number;
}

export interface NAVData {
  schemeCode: string;
  schemeName: string;
  nav: number;
  date: string;
}

// ============================================================================
// ZUSTAND STORE FOR CACHING
// ============================================================================

interface NAVCache {
  [schemeCode: string]: {
    data: NAVData;
    timestamp: number;
  };
}

interface MutualFundStore {
  navCache: NAVCache;
  setCacheEntry: (schemeCode: string, data: NAVData, timestamp: number) => void;
  getCacheEntry: (schemeCode: string) => NAVData | null;
  isCacheValid: (schemeCode: string, maxAgeMs: number) => boolean;
  clearCache: () => void;
}

const useMutualFundStore = create<MutualFundStore>((set, get) => ({
  navCache: {},
  setCacheEntry: (schemeCode: string, data: NAVData, timestamp: number) =>
    set((state) => ({
      navCache: {
        ...state.navCache,
        [schemeCode]: { data, timestamp },
      },
    })),
  getCacheEntry: (schemeCode: string) => {
    const cache = get().navCache[schemeCode];
    return cache ? cache.data : null;
  },
  isCacheValid: (schemeCode: string, maxAgeMs: number) => {
    const cache = get().navCache[schemeCode];
    if (!cache) return false;
    return Date.now() - cache.timestamp < maxAgeMs;
  },
  clearCache: () => set({ navCache: {} }),
}));

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate Absolute Return as a percentage
 * Formula: (Current Value - Invested Amount) / Invested Amount * 100
 */
function calculateAbsoluteReturn(currentValue: number, investedAmount: number): number {
  if (investedAmount === 0) return 0;
  return ((currentValue - investedAmount) / investedAmount) * 100;
}

/**
 * Calculate Net Present Value (NPV) for a given rate of return
 * Used in XIRR calculation via Newton-Raphson method
 */
function calculateNPV(transactions: Transaction[], rate: number): number {
  if (transactions.length === 0) return 0;

  const referenceDate = transactions[0].date;
  let npv = 0;

  for (const transaction of transactions) {
    const daysElapsed = differenceInDays(transaction.date, referenceDate);
    const yearsElapsed = daysElapsed / 365.25;
    const discountFactor = Math.pow(1 + rate, yearsElapsed);
    npv += transaction.amount / discountFactor;
  }

  return npv;
}

/**
 * Calculate derivative of NPV with respect to rate (for Newton-Raphson)
 */
function calculateNPVDerivative(transactions: Transaction[], rate: number): number {
  if (transactions.length === 0) return 0;

  const referenceDate = transactions[0].date;
  let derivative = 0;

  for (const transaction of transactions) {
    const daysElapsed = differenceInDays(transaction.date, referenceDate);
    const yearsElapsed = daysElapsed / 365.25;
    const discountFactor = Math.pow(1 + rate, yearsElapsed);
    derivative += (-yearsElapsed * transaction.amount) / (discountFactor * (1 + rate));
  }

  return derivative;
}

/**
 * Calculate XIRR (Extended Internal Rate of Return)
 * Uses Newton-Raphson method for finding the root
 * Handles edge cases gracefully
 */
function calculateXIRR(transactions: Transaction[]): number {
  if (transactions.length < 2) {
    // XIRR requires at least 2 transactions
    return 0;
  }

  // Check if there are both positive and negative cash flows
  const hasPositive = transactions.some((t) => t.amount > 0);
  const hasNegative = transactions.some((t) => t.amount < 0);

  if (!hasPositive || !hasNegative) {
    // XIRR cannot be calculated without both cash inflows and outflows
    return 0;
  }

  // Newton-Raphson method to find the rate where NPV = 0
  let rate = 0.1; // Initial guess: 10%
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(transactions, rate);
    const npvDerivative = calculateNPVDerivative(transactions, rate);

    // Avoid division by zero
    if (Math.abs(npvDerivative) < tolerance) {
      break;
    }

    const newRate = rate - npv / npvDerivative;

    // Check for convergence
    if (Math.abs(newRate - rate) < tolerance) {
      rate = newRate;
      break;
    }

    rate = newRate;

    // Prevent rate from going below -100% (no infinite losses)
    if (rate < -0.99) {
      rate = -0.99;
    }
  }

  return rate * 100; // Convert to percentage
}

/**
 * Calculate portfolio overlap between two sets of holdings
 * Overlap % = (Number of common schemes / Total unique schemes) * 100
 */
function calculatePortfolioOverlap(holdings1: HoldingWithOverlap[], holdings2: HoldingWithOverlap[]): number {
  if (holdings1.length === 0 || holdings2.length === 0) {
    return 0;
  }

  const codes1 = new Set(holdings1.map((h) => h.schemeCode));
  const codes2 = new Set(holdings2.map((h) => h.schemeCode));

  // Find intersection
  const intersection = [...codes1].filter((code) => codes2.has(code));

  // Find union
  const union = new Set([...codes1, ...codes2]);

  // Overlap percentage
  return (intersection.length / union.size) * 100;
}

/**
 * Calculate the current value of a portfolio given units held and current NAV
 */
function calculateCurrentValue(units: number, nav: number): number {
  return units * nav;
}

/**
 * Aggregate transactions to get total units and invested amount
 */
function aggregateTransactions(transactions: Transaction[]): { totalUnits: number; totalInvested: number } {
  let totalUnits = 0;
  let totalInvested = 0;

  for (const transaction of transactions) {
    totalUnits += transaction.units;
    totalInvested += transaction.amount;
  }

  return { totalUnits, totalInvested };
}

/**
 * Calculate expense drag in rupees per year
 * Formula: Current Value * (Expense Ratio / 100)
 */
function calculateExpenseDrag(currentValue: number, expenseRatio: number): number {
  return currentValue * (expenseRatio / 100);
}

// ============================================================================
// API CALLS
// ============================================================================

/**
 * Fetch live NAV data from mfapi.in
 * API endpoint: https://api.mfapi.in/mf/{schemeCode}/latest
 */
async function fetchLiveNAVFromAPI(schemeCode: string): Promise<NAVData | null> {
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);

    if (!response.ok) {
      console.error(`Failed to fetch NAV for ${schemeCode}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // mfapi.in returns data in format: { meta: { ...}, data: { ...} }
    const meta = data.meta || {};
    const navData = data.data || {};

    // Extract NAV from the latest data point
    const nav = parseFloat(navData.nav || 0);
    const date = meta.fund_name || new Date().toISOString();

    if (nav <= 0) {
      console.error(`Invalid NAV received for ${schemeCode}: ${nav}`);
      return null;
    }

    return {
      schemeCode,
      schemeName: meta.fund_name || schemeCode,
      nav,
      date,
    };
  } catch (error) {
    console.error(`Error fetching NAV for ${schemeCode}:`, error);
    return null;
  }
}

/**
 * Get NAV data with caching strategy
 * Cache validity: 1 hour (3600000 ms)
 */
async function getNAVWithCache(schemeCode: string): Promise<NAVData | null> {
  const CACHE_DURATION_MS = 3600000; // 1 hour

  // Check cache first
  if (useMutualFundStore.getState().isCacheValid(schemeCode, CACHE_DURATION_MS)) {
    return useMutualFundStore.getState().getCacheEntry(schemeCode);
  }

  // Fetch fresh data
  const navData = await fetchLiveNAVFromAPI(schemeCode);

  if (navData) {
    useMutualFundStore.getState().setCacheEntry(schemeCode, navData, Date.now());
  }

  return navData;
}

// ============================================================================
// MAIN PUBLIC API
// ============================================================================

/**
 * Calculate comprehensive portfolio metrics
 * This is the main orchestrator function
 */
export async function calculateMetrics(
  transactions: Transaction[],
  fund: Fund,
  fetchLiveNAV: boolean = true,
): Promise<PortfolioMetrics | null> {
  try {
    if (transactions.length === 0) {
      return null;
    }

    // Get current NAV (either use provided or fetch live)
    let currentNav = fund.nav;

    if (fetchLiveNAV) {
      const navData = await getNAVWithCache(fund.schemeCode);
      if (navData) {
        currentNav = navData.nav;
      }
    }

    // Aggregate transactions
    const { totalUnits, totalInvested } = aggregateTransactions(transactions);

    // Calculate metrics
    const currentValue = calculateCurrentValue(totalUnits, currentNav);
    const totalReturn = currentValue - totalInvested;
    const absoluteReturn = calculateAbsoluteReturn(currentValue, totalInvested);
    const xirr = calculateXIRR(transactions);
    const expenseDragAnnual = calculateExpenseDrag(currentValue, fund.expenseRatio);

    return {
      totalInvested,
      currentValue,
      totalReturn,
      absoluteReturn,
      xirr,
      expenseDragAnnual,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error("Error calculating metrics:", error);
    return null;
  }
}

/**
 * Calculate metrics for multiple funds
 */
export async function calculatePortfolioMetrics(
  funds: Array<{ fund: Fund; transactions: Transaction[] }>,
): Promise<PortfolioMetrics[]> {
  const results = await Promise.all(
    funds.map((item) => calculateMetrics(item.transactions, item.fund, true)),
  );

  return results.filter((result): result is PortfolioMetrics => result !== null);
}

/**
 * Fetch NAV for a single fund (public API)
 */
export const fetchLiveNAV = (schemeCode: string): Promise<NAVData | null> =>
  getNAVWithCache(schemeCode);

/**
 * Get portfolio overlap between two portfolios
 */
export const getPortfolioOverlap = (
  portfolio1: HoldingWithOverlap[],
  portfolio2: HoldingWithOverlap[],
): number => calculatePortfolioOverlap(portfolio1, portfolio2);

/**
 * Get overlap analysis between multiple fund holdings
 */
export function analyzeOverlapMatrix(
  portfolios: Array<{ name: string; holdings: HoldingWithOverlap[] }>,
): Array<{
  portfolio1: string;
  portfolio2: string;
  overlapPercentage: number;
  commonSchemes: string[];
}> {
  const results: Array<{
    portfolio1: string;
    portfolio2: string;
    overlapPercentage: number;
    commonSchemes: string[];
  }> = [];

  for (let i = 0; i < portfolios.length; i++) {
    for (let j = i + 1; j < portfolios.length; j++) {
      const codes1 = new Set(portfolios[i].holdings.map((h) => h.schemeCode));
      const codes2 = new Set(portfolios[j].holdings.map((h) => h.schemeCode));

      const commonSchemes = [...codes1].filter((code) => codes2.has(code));
      const overlapPercentage = calculatePortfolioOverlap(
        portfolios[i].holdings,
        portfolios[j].holdings,
      );

      results.push({
        portfolio1: portfolios[i].name,
        portfolio2: portfolios[j].name,
        overlapPercentage,
        commonSchemes,
      });
    }
  }

  return results;
}

/**
 * Clear NAV cache (useful for testing or manual refresh)
 */
export const clearNAVCache = (): void => {
  useMutualFundStore.getState().clearCache();
};

/**
 * Get cache statistics (for debugging)
 */
export const getCacheStats = (): { size: number; schemes: string[] } => {
  const cache = useMutualFundStore.getState().navCache;
  return {
    size: Object.keys(cache).length,
    schemes: Object.keys(cache),
  };
};
