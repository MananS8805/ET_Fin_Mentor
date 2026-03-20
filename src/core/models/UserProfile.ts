export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type TaxRegime = "old" | "new";
export type DemoPersonaKey = "rohan" | "priya" | "vikram";
export type TaxLiquidity = "high" | "medium" | "low";

export interface UserProfileData {
  id: string;
  name: string;
  age: number;
  phone: string;
  email: string;
  monthlyIncome: number;
  annualIncome: number;
  monthlyExpenses: number;
  monthlyEMI: number;
  existingCorpus: number;
  monthlySIP: number;
  emergencyFund: number;
  termInsuranceCover: number;
  healthInsuranceCover: number;
  annualPF: number;
  annual80C: number;
  annualNPS: number;
  annualHRA: number;
  riskProfile: RiskProfile;
  retirementAge: number;
  targetMonthlyExpenseRetirement: number;
  goals: string[];
  totalDebt: number;
  onboardingComplete: boolean;
  camsData?: {
    holdings: MFHolding[];
  };
}

export interface HealthScoreDimensions {
  emergency: number;
  insurance: number;
  investment: number;
  debt: number;
  tax: number;
  retirement: number;
}

export type HealthDimensionKey = keyof HealthScoreDimensions;
export type HealthScoreCategory = "Critical" | "Needs Work" | "Good" | "Excellent";

export interface HealthDimensionDetail {
  key: HealthDimensionKey;
  label: string;
  score: number;
}

export type FutureMilestoneKey = "emergency" | "halfFire" | "fullFire";

export interface FutureMilestone {
  key: FutureMilestoneKey;
  label: string;
  helper: string;
  current: number;
  target: number;
  progress: number;
  complete: boolean;
}

export interface FutureProjectionPoint {
  age: number;
  corpus: number;
  highlighted: boolean;
}

export interface AssetAllocationStage {
  label: string;
  helper: string;
  equity: number;
  debt: number;
  gold: number;
}

export interface FireProjectionPoint {
  age: number;
  projectedCorpus: number;
  targetCorpus: number;
}

export type FinancialAlertPriority = "critical" | "high";
export type FinancialAlertType =
  | "emergency_fund_low"
  | "term_cover_low"
  | "sip_missing"
  | "unused_80c"
  | "insurance_gap_high"
  | "debt_ratio_high"
  | "health_cover_missing"
  | "retirement_corpus_low";

export interface FinancialAlert {
  id: FinancialAlertType;
  title: string;
  body: string;
  action: string;
  priority: FinancialAlertPriority;
}

export type LifeEventKey = "bonus" | "marriage" | "baby" | "inheritance" | "job-switch" | "buy-home";

export interface LifeEventOption {
  key: LifeEventKey;
  label: string;
  helper: string;
}

export interface LifeEventAdvice {
  immediate: string[];
  soon: string[];
  longTerm: string[];
}

export interface MonthlyMoneyCardData {
  monthLabel: string;
  expensePct: number;
  emiPct: number;
  savingsPct: number;
  investmentPct: number;
}

export interface MFHolding {
  id: string;
  name: string;
  category: "large_cap" | "mid_cap" | "small_cap" | "elss" | "debt" | "hybrid" | "liquid" | "other";
  units: number;
  nav: number;
  currentValue: number;
  purchaseValue: number;
  xirr: number | null; // null if insufficient cashflow data
}

export interface OverlapPair {
  fund1: string;
  fund2: string;
  overlapLevel: "high" | "medium" | "low";
  reason: string;
}

export interface PortfolioXRay {
  holdings: MFHolding[];
  totalValue: number;
  totalInvested: number;
  overallXIRR: number | null;
  overlapPairs: OverlapPair[];
  expenseRatioDrag: number;   // annual ₹ lost vs index equivalent
  categoryAllocation: Record<MFHolding["category"], number>; // percentage per category
}

export interface SipCalendarMonth {
  key: string;
  label: string;
  logged: boolean;
  isCurrent: boolean;
}

export interface TaxWizardInput {
  annualIncome: number;
  basicSalary: number;
  annualHRAReceived: number;
  annualRentPaid: number;
  metroCity: boolean;
  annualPF: number;
  annual80C: number;
  annualNPS: number;
}

export interface TaxDeductionOpportunity {
  id: "hra" | "80c" | "nps";
  title: string;
  amount: number;
  helper: string;
}

export interface TaxSavingRecommendation {
  id: string;
  title: string;
  bucket: "80C" | "80CCD(1B)" | "HRA";
  suggestedAmount: number;
  risk: RiskProfile;
  liquidity: TaxLiquidity;
  helper: string;
}

export interface TaxWizardSnapshot {
  input: TaxWizardInput;
  hraExemption: number;
  oldTaxableIncome: number;
  newTaxableIncome: number;
  oldTax: number;
  newTax: number;
  betterRegime: TaxRegime;
  taxSaving: number;
  used80C: number;
  remaining80CRoom: number;
  npsDeductionUsed: number;
  remainingNpsDeductionRoom: number;
  potentialAdditionalOldRegimeSaving: number;
  deductionOpportunities: TaxDeductionOpportunity[];
  rankedRecommendations: TaxSavingRecommendation[];
}

export interface PartnerProfileData {
  name: string;
  age: number;
  monthlyIncome: number;
  annualIncome: number;
  basicSalary: number;
  annualPF: number;
  annual80C: number;
  annualNPS: number;
  annualHRA: number;
  existingCorpus: number;
  monthlySIP: number;
  termInsuranceCover: number;
  healthInsuranceCover: number;
}

export interface JointHomeLoan {
  active: boolean;
  totalPrincipalOutstandig: number;
  monthlyEMI: number;
  annualInterest: number;
  annualPrincipal: number;
}

export interface JointPortfolioSummary {
  combinedCorpus: number;
  combinedSIP: number;
  userLTCG: number; // current unrealized LTCG for user
  partnerLTCG: number; // current unrealized LTCG for partner
}

export interface JointProfileData {
  user: UserProfileData;
  partner: PartnerProfileData | null;
  homeLoan: JointHomeLoan;
  portfolio: JointPortfolioSummary;
}

export interface JointOptimizationResult {
  combinedNetWorth: number;
  hraSuggestion: {
    recommendedClaimer: "user" | "partner" | "split" | "none";
    estimatedSaving: number;
    reason: string;
  };
  npsStrategy: {
    userContribution: number;
    partnerContribution: number;
    message: string;
  };
  sipSplits: {
    userSIP: number;
    partnerSIP: number;
    reason: string;
  };
  insuranceAdvice: {
    type: "individual" | "joint-floater";
    reason: string;
    action: string;
  };
  taxHarvesting: {
    userSell: number;
    partnerSell: number;
    totalTaxFreeGain: number;
    nextStep: string;
  };
  homeLoanAdvice: {
    optimalInterestClaimer: "user" | "partner" | "split";
    optimalPrincipalClaimer: "user" | "partner" | "split";
    estimatedTaxBenefit: number;
  };
}

import { OLD_REGIME_SLABS, NEW_REGIME_SLABS } from "../config/tax";

const HEALTH_DIMENSION_LABELS: Record<HealthDimensionKey, string> = {
  emergency: "Emergency",
  insurance: "Insurance",
  investment: "Investment",
  debt: "Debt",
  tax: "Tax",
  retirement: "Retirement",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const LIFE_EVENT_OPTIONS: LifeEventOption[] = [
  { key: "bonus", label: "Bonus", helper: "Use a windfall without derailing long-term goals." },
  { key: "marriage", label: "Marriage", helper: "Blend budgets, cover, and shared goals well." },
  { key: "baby", label: "Baby", helper: "Prepare for new recurring costs and protection needs." },
  { key: "inheritance", label: "Inheritance", helper: "Deploy inherited money calmly and tax-aware." },
  { key: "job-switch", label: "Job switch", helper: "Manage salary jumps, PF moves, and runway." },
  { key: "buy-home", label: "Buy home", helper: "Pressure-test EMI, down payment, and safety buffer." },
] as const;

function roundToTwo(value: number): number {
  return Number(value.toFixed(2));
}

function clampScore(value: number): number {
  return roundToTwo(Math.max(0, Math.min(100, value)));
}

function clampRatio(value: number): number {
  return roundToTwo(Math.max(0, Math.min(1, value)));
}

function clampPercent(value: number): number {
  return roundToTwo(Math.max(0, Math.min(100, value)));
}

function safeAnnualIncome(profile: UserProfileData): number {
  return profile.annualIncome > 0 ? profile.annualIncome : profile.monthlyIncome * 12;
}

function formatMonthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function shiftMonth(date: Date, deltaMonths: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + deltaMonths, 1);
}

function getBaseEquityAllocation(riskProfile: RiskProfile): number {
  switch (riskProfile) {
    case "aggressive":
      return 80;
    case "moderate":
      return 70;
    case "conservative":
    default:
      return 60;
  }
}

function getLiquidityNeed(profile: UserProfileData): TaxLiquidity {
  const emergencyMonths = getEmergencyFundMonths(profile);
  const debtRatio = getDebtToIncomeRatio(profile);

  if (emergencyMonths < 4 || debtRatio > 35) {
    return "high";
  }

  if (emergencyMonths < 6 || debtRatio > 20) {
    return "medium";
  }

  return "low";
}

function getRiskAlignmentScore(profileRisk: RiskProfile, recommendationRisk: RiskProfile): number {
  if (profileRisk === recommendationRisk) {
    return 3;
  }

  if (profileRisk === "moderate") {
    return recommendationRisk === "aggressive" ? 2 : 2.5;
  }

  if (profileRisk === "conservative") {
    return recommendationRisk === "moderate" ? 1.5 : 0.5;
  }

  return recommendationRisk === "moderate" ? 2.5 : 1;
}

function getLiquidityAlignmentScore(
  liquidityNeed: TaxLiquidity,
  recommendationLiquidity: TaxLiquidity
): number {
  if (liquidityNeed === "high") {
    if (recommendationLiquidity === "high") {
      return 3;
    }

    if (recommendationLiquidity === "medium") {
      return 2;
    }

    return 0.5;
  }

  if (liquidityNeed === "medium") {
    if (recommendationLiquidity === "medium") {
      return 3;
    }

    if (recommendationLiquidity === "high") {
      return 2.5;
    }

    return 1.5;
  }

  if (recommendationLiquidity === "low") {
    return 3;
  }

  if (recommendationLiquidity === "medium") {
    return 2;
  }

  return 1;
}

function applySlabs(taxableIncome: number, slabs: ReadonlyArray<{ upto: number; rate: number }>): number {
  if (taxableIncome <= 0) {
    return 0;
  }

  let tax = 0;
  let previousLimit = 0;

  for (const slab of slabs) {
    if (taxableIncome <= previousLimit) {
      break;
    }

    const taxableAmount = Math.min(taxableIncome, slab.upto) - previousLimit;

    if (taxableAmount > 0) {
      tax += taxableAmount * slab.rate;
    }

    previousLimit = slab.upto;
  }

  return roundToTwo(tax);
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0$/, "");
}

function formatIndianDigits(value: number): string {
  const absolute = Math.round(Math.abs(value));
  const digits = absolute.toString();

  if (digits.length <= 3) {
    return digits;
  }

  const lastThree = digits.slice(-3);
  const otherDigits = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${otherDigits},${lastThree}`;
}

export function createEmptyUserProfile(overrides: Partial<UserProfileData> = {}): UserProfileData {
  return {
    id: overrides.id ?? `profile-${Date.now()}`,
    name: overrides.name ?? "",
    age: overrides.age ?? 0,
    phone: overrides.phone ?? "",
    email: overrides.email ?? "",
    monthlyIncome: overrides.monthlyIncome ?? 0,
    annualIncome: overrides.annualIncome ?? 0,
    monthlyExpenses: overrides.monthlyExpenses ?? 0,
    monthlyEMI: overrides.monthlyEMI ?? 0,
    existingCorpus: overrides.existingCorpus ?? 0,
    monthlySIP: overrides.monthlySIP ?? 0,
    emergencyFund: overrides.emergencyFund ?? 0,
    termInsuranceCover: overrides.termInsuranceCover ?? 0,
    healthInsuranceCover: overrides.healthInsuranceCover ?? 0,
    annualPF: overrides.annualPF ?? 0,
    annual80C: overrides.annual80C ?? 0,
    annualNPS: overrides.annualNPS ?? 0,
    annualHRA: overrides.annualHRA ?? 0,
    riskProfile: overrides.riskProfile ?? "moderate",
    retirementAge: overrides.retirementAge ?? 55,
    targetMonthlyExpenseRetirement: overrides.targetMonthlyExpenseRetirement ?? 0,
    goals: overrides.goals ?? [],
    totalDebt: overrides.totalDebt ?? 0,
    onboardingComplete: overrides.onboardingComplete ?? false,
  };
}

export function createTaxWizardInput(
  profile: UserProfileData,
  overrides: Partial<TaxWizardInput> = {}
): TaxWizardInput {
  const annualIncome = overrides.annualIncome ?? safeAnnualIncome(profile);

  return {
    annualIncome,
    basicSalary: overrides.basicSalary ?? roundToTwo(annualIncome * 0.4),
    annualHRAReceived: overrides.annualHRAReceived ?? profile.annualHRA,
    annualRentPaid: overrides.annualRentPaid ?? 0,
    metroCity: overrides.metroCity ?? false,
    annualPF: overrides.annualPF ?? profile.annualPF,
    annual80C: overrides.annual80C ?? profile.annual80C,
    annualNPS: overrides.annualNPS ?? profile.annualNPS,
  };
}

export function getMonthlySavings(profile: UserProfileData): number {
  return roundToTwo(profile.monthlyIncome - profile.monthlyExpenses - profile.monthlyEMI);
}

export function getSavingsRate(profile: UserProfileData): number {
  if (profile.monthlyIncome <= 0) {
    return 0;
  }

  return roundToTwo((getMonthlySavings(profile) / profile.monthlyIncome) * 100);
}

export function getEmergencyFundMonths(profile: UserProfileData): number {
  if (profile.monthlyExpenses <= 0) {
    return 0;
  }

  return roundToTwo(profile.emergencyFund / profile.monthlyExpenses);
}

export function getRecommendedEmergencyFund(profile: UserProfileData): number {
  return roundToTwo(profile.monthlyExpenses * 6);
}

export function getInsuranceMultiple(profile: UserProfileData): number {
  const annualIncome = safeAnnualIncome(profile);

  if (annualIncome <= 0) {
    return 0;
  }

  return roundToTwo(profile.termInsuranceCover / annualIncome);
}

export function getInsuranceGap(profile: UserProfileData): number {
  return roundToTwo(Math.max(0, safeAnnualIncome(profile) * 10 - profile.termInsuranceCover));
}

export function getFireCorpusTarget(profile: UserProfileData): number {
  return roundToTwo(profile.targetMonthlyExpenseRetirement * 12 * 25);
}

export function projectedCorpusAtAge(
  profile: UserProfileData,
  targetAge: number,
  cagr = 0.12
): number {
  const years = Math.max(0, targetAge - profile.age);

  if (years === 0) {
    return roundToTwo(profile.existingCorpus);
  }

  const months = years * 12;
  const monthlyRate = cagr / 12;
  const fvLump = profile.existingCorpus * Math.pow(1 + cagr, years);
  const fvSip =
    monthlyRate === 0
      ? profile.monthlySIP * months
      : profile.monthlySIP * (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate));

  return roundToTwo(fvLump + fvSip);
}

export function sipNeededFor(
  profile: UserProfileData,
  targetCorpus: number,
  targetAge: number,
  cagr = 0.12
): number {
  const years = Math.max(0, targetAge - profile.age);

  if (years === 0) {
    return 0;
  }

  const futureValueFromCorpus = profile.existingCorpus * Math.pow(1 + cagr, years);
  const remainingTarget = Math.max(0, targetCorpus - futureValueFromCorpus);
  const months = years * 12;
  const monthlyRate = cagr / 12;
  const annuityFactor =
    monthlyRate === 0
      ? months
      : ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);

  if (annuityFactor <= 0) {
    return 0;
  }

  return roundToTwo(remainingTarget / annuityFactor);
}

export interface GoalSIPAllocation {
  goal: string;
  sipAmount: number;
  targetCorpus: number;
  horizonYears: number;
}

const GOAL_HORIZON_YEARS: Record<string, number> = {
  retirement: 0,          // uses yearsToRetirement
  "buy a home": 5,
  "children education": 15,
  "parents care fund": 10,
  "emergency backup": 2,
  vacation: 3,
  "debt free": 5,
  "wealth creation": 20,
};

export function getSIPAllocationByGoal(profile: UserProfileData): GoalSIPAllocation[] {
  if (!profile.goals.length || profile.monthlySIP <= 0) return [];

  const yearsToRetirement = Math.max(1, profile.retirementAge - profile.age);

  const goalsWithHorizon = profile.goals.map((goal) => ({
    goal,
    horizonYears: goal === "retirement" ? yearsToRetirement : (GOAL_HORIZON_YEARS[goal] ?? 10),
  }));

  // Weight SIP allocation inversely by horizon — shorter goals get more monthly SIP
  const totalWeight = goalsWithHorizon.reduce((sum, g) => sum + 1 / g.horizonYears, 0);

  return goalsWithHorizon.map(({ goal, horizonYears }) => {
    const weight = 1 / horizonYears / totalWeight;
    const sipAmount = roundToTwo(profile.monthlySIP * weight);
    const targetCorpus = roundToTwo(
      sipAmount * (((Math.pow(1.12, horizonYears) - 1) / (0.12 / 12)) * (1 + 0.12 / 12))
    );
    return { goal, sipAmount, targetCorpus, horizonYears };
  });
}

export function getMonthlyPassiveIncome(corpus: number): number {
  return roundToTwo((corpus * 0.04) / 12);
}

export function createIncomeScenarioProfile(profile: UserProfileData, annualIncome: number): UserProfileData {
  return createEmptyUserProfile({
    ...profile,
    annualIncome,
    monthlyIncome: roundToTwo(annualIncome / 12),
  });
}

export function projectedCorpusForScenario(
  profile: UserProfileData,
  targetAge: number,
  sipMultiplier = 1,
  cagr = 0.12
): number {
  const scenarioProfile = createEmptyUserProfile({
    ...profile,
    monthlySIP: roundToTwo(profile.monthlySIP * sipMultiplier),
  });

  return projectedCorpusAtAge(scenarioProfile, targetAge, cagr);
}

export function getFutureProjectionPoints(
  profile: UserProfileData,
  selectedAge: number,
  sipMultiplier = 1,
  cagr = 0.12
): FutureProjectionPoint[] {
  const points = new Set<number>();
  const chartStartAge = Math.min(70, Math.max(profile.age + 5, profile.age));

  for (let age = chartStartAge; age <= 70; age += 5) {
    points.add(age);
  }

  points.add(selectedAge);

  return Array.from(points)
    .sort((left, right) => left - right)
    .map((age) => ({
      age,
      corpus: projectedCorpusForScenario(profile, age, sipMultiplier, cagr),
      highlighted: age === selectedAge,
    }));
}

export function getFutureMilestones(
  profile: UserProfileData,
  projectedCorpus: number
): FutureMilestone[] {
  const emergencyTarget = getRecommendedEmergencyFund(profile);
  const fireTarget = getFireCorpusTarget(profile);
  const halfFireTarget = fireTarget * 0.5;

  return [
    {
      key: "emergency",
      label: "Emergency fund",
      helper: "6 months of expenses",
      current: profile.emergencyFund,
      target: emergencyTarget,
      progress: clampRatio(emergencyTarget > 0 ? profile.emergencyFund / emergencyTarget : 0),
      complete: emergencyTarget > 0 && profile.emergencyFund >= emergencyTarget,
    },
    {
      key: "halfFire",
      label: "Half-FIRE",
      helper: "50% of target corpus",
      current: projectedCorpus,
      target: halfFireTarget,
      progress: clampRatio(halfFireTarget > 0 ? projectedCorpus / halfFireTarget : 0),
      complete: halfFireTarget > 0 && projectedCorpus >= halfFireTarget,
    },
    {
      key: "fullFire",
      label: "Full FIRE",
      helper: "100% of target corpus",
      current: projectedCorpus,
      target: fireTarget,
      progress: clampRatio(fireTarget > 0 ? projectedCorpus / fireTarget : 0),
      complete: fireTarget > 0 && projectedCorpus >= fireTarget,
    },
  ];
}

export function getFutureYouFallbackNarrative(
  profile: UserProfileData,
  targetAge: number,
  projectedCorpus: number,
  fireTarget: number,
  sipMultiplier = 1,
  cagr = 0.12
): string {
  const passiveIncome = getMonthlyPassiveIncome(projectedCorpus);
  const scenarioSip = roundToTwo(profile.monthlySIP * sipMultiplier);

  if (fireTarget > 0 && projectedCorpus >= fireTarget) {
    return `By age ${targetAge}, this path projects about ${formatINR(
      projectedCorpus
    )}, which can support roughly ${formatINR(
      passiveIncome
    )} a month using the 4% rule. Your current SIP pace of ${formatINR(
      scenarioSip
    )} keeps you on a FIRE-ready trajectory if you stay near ${(cagr * 100).toFixed(0)}% CAGR.`;
  }

  const gap = Math.max(0, fireTarget - projectedCorpus);

  return `By age ${targetAge}, this scenario points to about ${formatINR(
    projectedCorpus
  )}, leaving a gap of ${formatINR(gap, true)} to your FIRE goal. Moving your SIP toward ${formatINR(
    scenarioSip
  )} and staying invested near ${(cagr * 100).toFixed(0)}% CAGR meaningfully improves the odds.`;
}

export function getFireProjectionSeries(
  profile: UserProfileData,
  targetRetirementAge: number,
  targetMonthlyExpenseRetirement: number,
  cagr = 0.12
): FireProjectionPoint[] {
  const plannerProfile = createEmptyUserProfile({
    ...profile,
    retirementAge: targetRetirementAge,
    targetMonthlyExpenseRetirement,
  });
  const targetCorpus = getFireCorpusTarget(plannerProfile);
  const finalAge = Math.max(profile.age, targetRetirementAge);
  const series: FireProjectionPoint[] = [];

  for (let age = profile.age; age <= finalAge; age += 1) {
    series.push({
      age,
      projectedCorpus: projectedCorpusAtAge(plannerProfile, age, cagr),
      targetCorpus,
    });
  }

  if (!series.length) {
    series.push({
      age: profile.age,
      projectedCorpus: profile.existingCorpus,
      targetCorpus,
    });
  }

  return series;
}

export function estimateFireAge(
  profile: UserProfileData,
  targetCorpus: number,
  cagr = 0.12,
  maxAge = 75
): number | null {
  if (targetCorpus <= 0) {
    return profile.age;
  }

  for (let age = profile.age; age <= maxAge; age += 1) {
    if (projectedCorpusAtAge(profile, age, cagr) >= targetCorpus) {
      return age;
    }
  }

  return null;
}

export function getYearsToFire(
  profile: UserProfileData,
  targetCorpus: number,
  cagr = 0.12,
  maxAge = 75
): number | null {
  const fireAge = estimateFireAge(profile, targetCorpus, cagr, maxAge);
  return fireAge === null ? null : Math.max(0, fireAge - profile.age);
}

export function getFireAssetAllocationSchedule(
  profile: UserProfileData,
  targetRetirementAge: number
): AssetAllocationStage[] {
  const yearsLeft = Math.max(0, targetRetirementAge - profile.age);
  const baseEquity = getBaseEquityAllocation(profile.riskProfile);
  const growthEquity = baseEquity;
  const transitionEquity = Math.max(baseEquity - 10, 40);
  const protectionEquity = Math.max(baseEquity - 20, 30);

  if (yearsLeft <= 5) {
    return [
      {
        label: `Age ${profile.age} to ${targetRetirementAge}`,
        helper: "Capital protection with enough growth to finish the run-up.",
        equity: protectionEquity,
        debt: 100 - protectionEquity - 10,
        gold: 10,
      },
    ];
  }

  if (yearsLeft <= 10) {
    return [
      {
        label: `Age ${profile.age} to ${targetRetirementAge - 5}`,
        helper: "Balanced compounding phase while the goal is still close.",
        equity: transitionEquity,
        debt: 100 - transitionEquity - 5,
        gold: 5,
      },
      {
        label: `Final 5 years to ${targetRetirementAge}`,
        helper: "Reduce drawdown risk as you approach retirement.",
        equity: protectionEquity,
        debt: 100 - protectionEquity - 10,
        gold: 10,
      },
    ];
  }

  return [
    {
      label: `Age ${profile.age} to ${targetRetirementAge - 10}`,
      helper: "Growth-first allocation to build the corpus aggressively.",
      equity: growthEquity,
      debt: 100 - growthEquity - 5,
      gold: 5,
    },
    {
      label: `Age ${targetRetirementAge - 10} to ${targetRetirementAge - 5}`,
      helper: "Start de-risking while keeping enough equity exposure.",
      equity: transitionEquity,
      debt: 100 - transitionEquity - 5,
      gold: 5,
    },
    {
      label: `Final 5 years to ${targetRetirementAge}`,
      helper: "Protect the corpus and smooth the landing into FIRE.",
      equity: protectionEquity,
      debt: 100 - protectionEquity - 10,
      gold: 10,
    },
  ];
}

export function getFinancial911Alerts(profile: UserProfileData): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const emergencyMonths = getEmergencyFundMonths(profile);
  const insuranceMultiple = getInsuranceMultiple(profile);
  const used80C = Math.min(profile.annual80C + profile.annualPF, 150_000);
  const insuranceGap = getInsuranceGap(profile);
  const debtRatio = getDebtToIncomeRatio(profile);
  const fireTarget = getFireCorpusTarget(profile);
  const retirementProgress = fireTarget > 0 ? profile.existingCorpus / fireTarget : 0;

  if (emergencyMonths < 3) {
    alerts.push({
      id: "emergency_fund_low",
      title: "Emergency fund is below 3 months",
      body: `You currently have ${emergencyMonths.toFixed(1)} months of cover against a safer 6-month target.`,
      action: "Move fresh savings to a liquid fund until the buffer reaches at least 3 months.",
      priority: "critical",
    });
  }

  if (insuranceMultiple < 8) {
    alerts.push({
      id: "term_cover_low",
      title: "Term cover is below 8x salary",
      body: `Your term cover is only ${insuranceMultiple.toFixed(1)}x annual income right now.`,
      action: "Review a plain term plan and move closer to 10x annual income.",
      priority: "critical",
    });
  }

  if (profile.monthlySIP === 0) {
    alerts.push({
      id: "sip_missing",
      title: "No SIP is active",
      body: "Your current profile shows no monthly SIP compounding toward long-term goals.",
      action: "Start even a small index-fund SIP this month to restart the habit.",
      priority: "high",
    });
  }

  if (used80C < 100_000) {
    alerts.push({
      id: "unused_80c",
      title: "80C usage is below ₹1L",
      body: `You have used about ${formatINR(used80C)} of the ₹1.5L 80C bucket.`,
      action: "Consider EPF, PPF, ELSS, or tuition deductions before year-end.",
      priority: "high",
    });
  }

  if (insuranceGap > 5_000_000) {
    alerts.push({
      id: "insurance_gap_high",
      title: "Insurance gap is above ₹50L",
      body: `Your current protection gap is about ${formatINR(insuranceGap, true)}.`,
      action: "Close the biggest part of the gap with low-cost term insurance first.",
      priority: "critical",
    });
  }

  if (debtRatio > 40) {
    alerts.push({
      id: "debt_ratio_high",
      title: "Debt-to-income ratio is above 40%",
      body: `Your monthly EMI load is ${debtRatio.toFixed(1)}% of monthly income.`,
      action: "Prioritize prepaying the highest-interest loan before adding new commitments.",
      priority: "critical",
    });
  }

  if (profile.healthInsuranceCover <= 0) {
    alerts.push({
      id: "health_cover_missing",
      title: "No health insurance is recorded",
      body: "A medical event can hit both savings and long-term goals if cover is missing.",
      action: "Add an individual or family-floater health plan as early as possible.",
      priority: "critical",
    });
  }

  if (fireTarget > 0 && retirementProgress < 0.1) {
    alerts.push({
      id: "retirement_corpus_low",
      title: "Retirement corpus is below 10% of target",
      body: `Your current corpus covers only ${(retirementProgress * 100).toFixed(0)}% of the FIRE target.`,
      action: "Increase SIPs gradually and revisit your retirement age or lifestyle target.",
      priority: "high",
    });
  }

  return alerts;
}

export function getLifeEventFallbackAdvice(profile: UserProfileData, event: LifeEventKey): LifeEventAdvice {
  const emergencyTarget = getRecommendedEmergencyFund(profile);
  const savings = getMonthlySavings(profile);
  const insuranceGap = getInsuranceGap(profile);

  switch (event) {
    case "bonus":
      return {
        immediate: [
          `Keep at least 30% of the bonus aside for tax and cash needs before spending it.`,
          `Use the first slice to move your emergency fund toward ${formatINR(emergencyTarget)}.`,
        ],
        soon: [
          insuranceGap > 0
            ? `Close part of the protection gap of ${formatINR(insuranceGap, true)} before increasing lifestyle spend.`
            : "Increase your existing SIPs rather than starting too many new products at once.",
          "If 80C is still underused, route part of the bonus into ELSS or PPF only after liquidity is covered.",
        ],
        longTerm: [
          `Convert part of the windfall into a permanent SIP bump so monthly compounding keeps working after the bonus is gone.`,
        ],
      };
    case "marriage":
      return {
        immediate: [
          "Create a joint money map covering fixed costs, shared goals, and account responsibilities.",
          "Update nominees across bank accounts, EPF, insurance, and investments.",
        ],
        soon: [
          `Build a shared emergency fund that can cover at least ${formatINR(emergencyTarget)} of expenses.`,
          "Review term and health cover for both partners before taking on new joint obligations.",
        ],
        longTerm: [
          "Set separate SIP buckets for home, travel, and retirement so every shared goal has a timeline.",
        ],
      };
    case "baby":
      return {
        immediate: [
          "Raise health cover and confirm maternity and newborn coverage before delivery-related costs begin.",
          "Start a dedicated cash buffer for first-year medical and lifestyle expenses.",
        ],
        soon: [
          `Protect monthly savings of ${formatINR(savings)} by planning daycare, insurance, and childcare costs early.`,
          "Update nominations, wills, and guardian details once the child is added to the family.",
        ],
        longTerm: [
          "Keep child goals separate from retirement SIPs so you do not dilute your own future security.",
        ],
      };
    case "inheritance":
      return {
        immediate: [
          "Pause before reinvesting and keep inherited money in a safe parking vehicle while paperwork settles.",
          "Clear any urgent debt or insurance gaps before chasing return.",
        ],
        soon: [
          "Separate the corpus into safety, near-term goals, and long-term investing buckets.",
          "Take tax and title clarity seriously if real estate or legacy assets are involved.",
        ],
        longTerm: [
          "Invest only the long-term bucket into diversified funds aligned with your risk profile and retirement plan.",
        ],
      };
    case "job-switch":
      return {
        immediate: [
          "Avoid upgrading lifestyle until the first few salary cycles settle and probation risk passes.",
          "Track PF transfer, gratuity impact, joining bonus clauses, and insurance continuity.",
        ],
        soon: [
          `If income rises, move part of the increment straight into SIPs instead of letting expenses absorb it.`,
          "Rebuild emergency runway if the job switch came after a break or relocation cost.",
        ],
        longTerm: [
          "Treat each switch as a chance to automate a higher savings rate instead of a higher EMI burden.",
        ],
      };
    case "buy-home":
    default:
      return {
        immediate: [
          "Do not let the full home purchase wipe out your emergency fund or investment base.",
          "Keep the down payment and registration budget separate from move-in and furnishing costs.",
        ],
        soon: [
          "Stress-test the EMI against one income and higher interest rates before committing.",
          `Try to keep total EMI comfortably under 40% of income so other goals do not get crowded out.`,
        ],
        longTerm: [
          "Continue retirement SIPs even after the home loan starts so the property does not become your only asset.",
        ],
      };
  }
}

export function getMonthlyMoneyCardData(profile: UserProfileData, date = new Date()): MonthlyMoneyCardData {
  const income = Math.max(profile.monthlyIncome, 1);
  const monthlySavings = Math.max(0, getMonthlySavings(profile));

  return {
    monthLabel: formatMonthLabel(date),
    expensePct: clampPercent((profile.monthlyExpenses / income) * 100),
    emiPct: clampPercent((profile.monthlyEMI / income) * 100),
    savingsPct: clampPercent((monthlySavings / income) * 100),
    investmentPct: clampPercent((profile.monthlySIP / income) * 100),
  };
}

export function getMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export function getRecentMonthKeys(count = 12, referenceDate = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => getMonthKey(shiftMonth(referenceDate, -(count - index - 1))));
}

export function getSipStreakCount(logs: string[], referenceDate = new Date()): number {
  const logSet = new Set(logs);
  let streak = 0;
  let cursor = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

  while (logSet.has(getMonthKey(cursor))) {
    streak += 1;
    cursor = shiftMonth(cursor, -1);
  }

  return streak;
}

export function getSipCalendar(logs: string[], count = 12, referenceDate = new Date()): SipCalendarMonth[] {
  const logSet = new Set(logs);
  const currentKey = getMonthKey(referenceDate);

  return getRecentMonthKeys(count, referenceDate).map((key) => {
    const [yearString, monthString] = key.split("-");
    const date = new Date(Number(yearString), Number(monthString) - 1, 1);

    return {
      key,
      label: MONTH_NAMES[date.getMonth()],
      logged: logSet.has(key),
      isCurrent: key === currentKey,
    };
  });
}

export function getSipMilestone(streak: number): 3 | 6 | 12 | null {
  if (streak >= 12) {
    return 12;
  }

  if (streak >= 6) {
    return 6;
  }

  if (streak >= 3) {
    return 3;
  }

  return null;
}

// Newton-Raphson XIRR — pure TS, no library needed
export function calculateXIRR(
  cashflows: Array<{ date: Date; amount: number }>,
  guess = 0.1
): number | null {
  if (cashflows.length < 2) return null;

  const first = cashflows[0].date.getTime();
  const years = cashflows.map((cf) => (cf.date.getTime() - first) / (365.25 * 24 * 3600 * 1000));

  let rate = guess;

  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let dNpv = 0;

    for (let j = 0; j < cashflows.length; j++) {
      const factor = Math.pow(1 + rate, years[j]);
      npv += cashflows[j].amount / factor;
      dNpv -= (years[j] * cashflows[j].amount) / (factor * (1 + rate));
    }

    if (Math.abs(dNpv) < 1e-10) break;
    const next = rate - npv / dNpv;
    if (Math.abs(next - rate) < 1e-7) return roundToTwo(next * 100); // return as %
    rate = next;
  }

  return roundToTwo(rate * 100);
}

// Category-based overlap detection — no external data needed
export function getOverlapPairs(holdings: MFHolding[]): OverlapPair[] {
  const pairs: OverlapPair[] = [];
  const highOverlapCategories: Array<MFHolding["category"]> = ["large_cap", "elss"];

  for (let i = 0; i < holdings.length; i++) {
    for (let j = i + 1; j < holdings.length; j++) {
      const a = holdings[i];
      const b = holdings[j];

      if (a.category === b.category && highOverlapCategories.includes(a.category)) {
        pairs.push({
          fund1: a.name,
          fund2: b.name,
          overlapLevel: "high",
          reason: `Both are ${a.category.replace("_", " ")} funds — typically 60–80% stock overlap.`,
        });
      } else if (
        (a.category === "large_cap" && b.category === "elss") ||
        (a.category === "elss" && b.category === "large_cap")
      ) {
        pairs.push({
          fund1: a.name,
          fund2: b.name,
          overlapLevel: "medium",
          reason: "ELSS funds hold significant large-cap stocks — partial overlap expected.",
        });
      }
    }
  }

  return pairs;
}

// Weighted expense ratio drag vs a 0.1% index fund
export function getExpenseRatioDrag(holdings: MFHolding[]): number {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total === 0) return 0;

  // Typical category expense ratios (direct plan averages)
  const avgExpenseRatio: Record<MFHolding["category"], number> = {
    large_cap: 0.95, mid_cap: 1.2, small_cap: 1.4,
    elss: 1.1, debt: 0.5, hybrid: 1.0, liquid: 0.2, other: 1.0,
  };

  const weightedRatio = holdings.reduce((sum, h) => {
    return sum + (h.currentValue / total) * avgExpenseRatio[h.category];
  }, 0);

  const indexRatio = 0.1;
  const dragPercent = Math.max(0, weightedRatio - indexRatio);
  return roundToTwo((dragPercent / 100) * total);
}

export function getCategoryAllocation(holdings: MFHolding[]): PortfolioXRay["categoryAllocation"] {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const alloc: Partial<PortfolioXRay["categoryAllocation"]> = {};

  for (const h of holdings) {
    alloc[h.category] = roundToTwo(((alloc[h.category] ?? 0) + (total > 0 ? (h.currentValue / total) * 100 : 0)));
  }

  return alloc as PortfolioXRay["categoryAllocation"];
}

export function getDebtToIncomeRatio(profile: UserProfileData): number {
  if (profile.monthlyIncome <= 0) {
    return 0;
  }

  return roundToTwo((profile.monthlyEMI / profile.monthlyIncome) * 100);
}

export function getHealthScoreDimensions(profile: UserProfileData): HealthScoreDimensions {
  const emergency = clampScore(Math.min(getEmergencyFundMonths(profile) / 6, 1) * 100);
  const insurance = clampScore(Math.min(getInsuranceMultiple(profile) / 10, 1) * 100);
  const investmentRatio = profile.monthlyIncome > 0 ? profile.monthlySIP / profile.monthlyIncome : 0;
  const investment = clampScore(Math.min(investmentRatio / 0.2, 1) * 100);
  const debt = clampScore(Math.max(0, 1 - getDebtToIncomeRatio(profile) / 50) * 100);
  const taxBase = Math.min(profile.annual80C + profile.annualPF, 150_000);
  const tax = clampScore(Math.min(taxBase / 150_000, 1) * 100);
  const fireTarget = getFireCorpusTarget(profile);
  const retirement = clampScore(Math.min(fireTarget === 0 ? 0 : profile.existingCorpus / fireTarget, 1) * 100);

  return {
    emergency,
    insurance,
    investment,
    debt,
    tax,
    retirement,
  };
}

export function getOverallHealthScore(profile: UserProfileData): number {
  const dimensions = Object.values(getHealthScoreDimensions(profile));
  const total = dimensions.reduce((sum, item) => sum + item, 0);
  return roundToTwo(total / dimensions.length);
}

export function getHealthScoreCategory(score: number): HealthScoreCategory {
  if (score < 40) {
    return "Critical";
  }

  if (score <= 60) {
    return "Needs Work";
  }

  if (score <= 80) {
    return "Good";
  }

  return "Excellent";
}

export function getHealthDimensionDetails(profile: UserProfileData): HealthDimensionDetail[] {
  const dimensions = getHealthScoreDimensions(profile);

  return (Object.entries(dimensions) as Array<[HealthDimensionKey, number]>).map(([key, score]) => ({
    key,
    label: HEALTH_DIMENSION_LABELS[key],
    score,
  }));
}

export function getHealthShareInsights(profile: UserProfileData): string[] {
  const emergencyMonths = getEmergencyFundMonths(profile);
  const insuranceMultiple = getInsuranceMultiple(profile);
  const retirementTarget = getFireCorpusTarget(profile);
  const retirementProgress =
    retirementTarget > 0 ? Math.min((profile.existingCorpus / retirementTarget) * 100, 100) : 0;

  return [
    `Emergency ready: ${emergencyMonths.toFixed(1)}/6 months covered`,
    `Protection cover: ${insuranceMultiple.toFixed(1)}x annual income`,
    `Retirement progress: ${retirementProgress.toFixed(0)}% of FIRE target`,
  ];
}

export function getHealthImprovementFallback(profile: UserProfileData): string[] {
  const sortedDimensions = getHealthDimensionDetails(profile)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);

  return sortedDimensions.map((dimension) => {
    switch (dimension.key) {
      case "emergency":
        return `Build your emergency fund from ${formatINR(profile.emergencyFund)} to ${formatINR(
          getRecommendedEmergencyFund(profile)
        )} using a liquid fund or sweep FD.`;
      case "insurance":
        return `Increase term cover by about ${formatINR(
          getInsuranceGap(profile),
          true
        )} so protection moves closer to 10x annual income.`;
      case "investment":
        return `Raise your SIP from ${formatINR(profile.monthlySIP)} toward ${formatINR(
          profile.monthlyIncome * 0.2
        )} to invest 20% of monthly income.`;
      case "debt":
        return `Your EMI load is ${getDebtToIncomeRatio(profile).toFixed(
          1
        )}% of income; push it below 40% by prepaying expensive loans first.`;
      case "tax": {
        const used80C = Math.min(profile.annual80C + profile.annualPF, 150_000);
        return `You still have ${formatINR(
          Math.max(0, 150_000 - used80C)
        )} of 80C room left this year for ELSS, PPF, or EPF-linked savings.`;
      }
      case "retirement": {
        const fireTarget = getFireCorpusTarget(profile);
        const progress = fireTarget > 0 ? Math.min((profile.existingCorpus / fireTarget) * 100, 100) : 0;
        return `Current corpus covers ${progress.toFixed(0)}% of your FIRE goal; a SIP of about ${formatINR(
          sipNeededFor(profile, fireTarget, profile.retirementAge)
        )} can close the gap by retirement.`;
      }
      default:
        return `Keep improving your ${dimension.label.toLowerCase()} score step by step.`;
    }
  });
}

export function getOldRegimeTax(profile: UserProfileData): number {
  const annualIncome = safeAnnualIncome(profile);
  const oldRegime80C = Math.min(profile.annual80C + profile.annualPF, 150_000);
  const npsDeduction = Math.min(profile.annualNPS * 0.8, 50_000);
  const taxableIncome = Math.max(0, annualIncome - 50_000 - oldRegime80C - npsDeduction);
  return applySlabs(taxableIncome, OLD_REGIME_SLABS);
}

export function getNewRegimeTax(profile: UserProfileData): number {
  const annualIncome = safeAnnualIncome(profile);
  const taxableIncome = Math.max(0, annualIncome - 75_000);
  return applySlabs(taxableIncome, NEW_REGIME_SLABS);
}

export function getBetterRegime(profile: UserProfileData): TaxRegime {
  return getOldRegimeTax(profile) <= getNewRegimeTax(profile) ? "old" : "new";
}

export function getTaxSaving(profile: UserProfileData): number {
  return roundToTwo(Math.abs(getNewRegimeTax(profile) - getOldRegimeTax(profile)));
}

export function getHraExemption(input: TaxWizardInput): number {
  if (input.annualHRAReceived <= 0 || input.annualRentPaid <= 0 || input.basicSalary <= 0) {
    return 0;
  }

  const rentMinusBasicThreshold = Math.max(0, input.annualRentPaid - input.basicSalary * 0.1);
  const salaryCap = input.basicSalary * (input.metroCity ? 0.5 : 0.4);

  return roundToTwo(Math.max(0, Math.min(input.annualHRAReceived, rentMinusBasicThreshold, salaryCap)));
}

export function getTaxWizardSnapshot(
  profile: UserProfileData,
  overrides: Partial<TaxWizardInput> = {}
): TaxWizardSnapshot {
  const input = createTaxWizardInput(profile, overrides);
  const hraExemption = getHraExemption(input);
  const used80C = Math.min(input.annual80C + input.annualPF, 150_000);
  const remaining80CRoom = roundToTwo(Math.max(0, 150_000 - used80C));
  const npsDeductionUsed = roundToTwo(Math.min(input.annualNPS * 0.8, 50_000));
  const remainingNpsDeductionRoom = roundToTwo(Math.max(0, 50_000 - npsDeductionUsed));

  const oldTaxableIncome = roundToTwo(
    Math.max(0, input.annualIncome - 50_000 - used80C - npsDeductionUsed - hraExemption)
  );
  const newTaxableIncome = roundToTwo(Math.max(0, input.annualIncome - 75_000));
  const oldTax = applySlabs(oldTaxableIncome, OLD_REGIME_SLABS);
  const newTax = applySlabs(newTaxableIncome, NEW_REGIME_SLABS);
  const betterRegime: TaxRegime = oldTax <= newTax ? "old" : "new";
  const taxSaving = roundToTwo(Math.abs(newTax - oldTax));

  const optimizedOldTaxableIncome = roundToTwo(
    Math.max(0, input.annualIncome - 50_000 - 150_000 - 50_000 - hraExemption)
  );
  const optimizedOldTax = applySlabs(optimizedOldTaxableIncome, OLD_REGIME_SLABS);
  const potentialAdditionalOldRegimeSaving = roundToTwo(Math.max(0, oldTax - optimizedOldTax));

  const deductionOpportunities: TaxDeductionOpportunity[] = [];

  if (remaining80CRoom > 0) {
    deductionOpportunities.push({
      id: "80c",
      title: `80C room available: ${formatINR(remaining80CRoom)}`,
      amount: remaining80CRoom,
      helper: "You can still use ELSS, PPF, VPF, or tax-saver FD to move closer to the 80C cap.",
    });
  }

  if (remainingNpsDeductionRoom > 0) {
    deductionOpportunities.push({
      id: "nps",
      title: `Modeled NPS room available: ${formatINR(remainingNpsDeductionRoom)}`,
      amount: remainingNpsDeductionRoom,
      helper:
        "This app's tax model still has room under the additional NPS deduction bucket, which can improve the old-regime outcome.",
    });
  }

  if (hraExemption > 0) {
    deductionOpportunities.push({
      id: "hra",
      title: `HRA exemption modeled: ${formatINR(hraExemption)}`,
      amount: hraExemption,
      helper: "With rent and salary structure entered, this portion of HRA can reduce taxable income under the old regime.",
    });
  }

  const liquidityNeed = getLiquidityNeed(profile);
  const rawRecommendations = ([
    {
      id: "elss",
      title: "ELSS mutual fund",
      bucket: "80C",
      suggestedAmount: remaining80CRoom,
      risk: "aggressive",
      liquidity: "medium",
      helper: "Best when you want 80C tax relief with growth potential and the shortest common lock-in among tax-saving products.",
    },
    {
      id: "ppf",
      title: "Public Provident Fund (PPF)",
      bucket: "80C",
      suggestedAmount: remaining80CRoom,
      risk: "conservative",
      liquidity: "low",
      helper: "Good for low-risk long-term compounding if you do not need this money back soon.",
    },
    {
      id: "vpf",
      title: "VPF or EPF-linked top-up",
      bucket: "80C",
      suggestedAmount: remaining80CRoom,
      risk: "conservative",
      liquidity: "low",
      helper: "Useful for salaried users who want a simple payroll-linked 80C top-up with very low decision overhead.",
    },
    {
      id: "tax-saver-fd",
      title: "5-year tax-saver FD",
      bucket: "80C",
      suggestedAmount: remaining80CRoom,
      risk: "conservative",
      liquidity: "low",
      helper: "A simpler 80C option when return stability matters more than long-term upside.",
    },
    {
      id: "nps",
      title: "NPS Tier I top-up",
      bucket: "80CCD(1B)",
      suggestedAmount: remainingNpsDeductionRoom > 0 ? roundToTwo(remainingNpsDeductionRoom / 0.8) : 0,
      risk: (profile.riskProfile === "conservative" ? "moderate" : profile.riskProfile) as RiskProfile,
      liquidity: "low",
      helper: "Best for long-horizon retirement savings when you are comfortable locking money in for extra tax efficiency.",
    },
  ] satisfies TaxSavingRecommendation[])
    .filter((item) => item.suggestedAmount > 0)
    .sort((left, right) => {
      const leftScore =
        getRiskAlignmentScore(profile.riskProfile, left.risk) +
        getLiquidityAlignmentScore(liquidityNeed, left.liquidity);
      const rightScore =
        getRiskAlignmentScore(profile.riskProfile, right.risk) +
        getLiquidityAlignmentScore(liquidityNeed, right.liquidity);

      return rightScore - leftScore;
    });

  return {
    input,
    hraExemption,
    oldTaxableIncome,
    newTaxableIncome,
    oldTax,
    newTax,
    betterRegime,
    taxSaving,
    used80C: roundToTwo(used80C),
    remaining80CRoom,
    npsDeductionUsed,
    remainingNpsDeductionRoom,
    potentialAdditionalOldRegimeSaving,
    deductionOpportunities,
    rankedRecommendations: rawRecommendations.slice(0, 4),
  };
}

export function getTaxWizardFallbackSummary(
  profile: UserProfileData,
  snapshot: TaxWizardSnapshot
): string {
  const regimeLine =
    snapshot.taxSaving <= 0
      ? "Both regimes are effectively tied with your current tax inputs."
      : `Right now the ${snapshot.betterRegime} regime is ahead by about ${formatINR(snapshot.taxSaving)}.`;
  const topRecommendation = snapshot.rankedRecommendations[0];
  const liquidityNeed = getLiquidityNeed(profile);

  return [
    regimeLine,
    snapshot.remaining80CRoom > 0
      ? `You still have ${formatINR(snapshot.remaining80CRoom)} of 80C room left.`
      : "Your modeled 80C bucket is already fully used.",
    snapshot.hraExemption > 0
      ? `The entered rent and salary structure create an HRA exemption of about ${formatINR(snapshot.hraExemption)}.`
      : "No HRA exemption is being captured in the current model.",
    topRecommendation
      ? `Given your ${profile.riskProfile} profile and ${liquidityNeed} liquidity need, ${topRecommendation.title} is the strongest next tax move.`
      : "Your current tax buckets are already well utilized, so the next step is mainly regime selection.",
  ].join(" ");
}

export function formatINR(value: number, compact = false): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);

  if (!compact) {
    return `${sign}\u20B9${formatIndianDigits(absolute)}`;
  }

  if (absolute >= 10_000_000) {
    return `${sign}\u20B9${trimTrailingZero((absolute / 10_000_000).toFixed(1))}Cr`;
  }

  if (absolute >= 100_000) {
    return `${sign}\u20B9${trimTrailingZero((absolute / 100_000).toFixed(1))}L`;
  }

  if (absolute >= 1_000) {
    return `${sign}\u20B9${trimTrailingZero((absolute / 1_000).toFixed(1))}K`;
  }

  return `${sign}\u20B9${trimTrailingZero(absolute.toFixed(0))}`;
}

export function getTaxBracket(annualIncome: number): number {
  if (annualIncome > 1000000) return 0.3;
  if (annualIncome > 500000) return 0.2;
  if (annualIncome > 250000) return 0.05;
  return 0;
}

export function calculateJointOptimization(jointData: JointProfileData): JointOptimizationResult {
  const { user, partner, homeLoan, portfolio } = jointData;
  const userIncome = safeAnnualIncome(user);
  const partnerIncome = partner ? partner.annualIncome : 0;

  const userBracket = getTaxBracket(userIncome);
  const partnerBracket = getTaxBracket(partnerIncome);

  // 1. Combined Net Worth
  const combinedNetWorth =
    user.existingCorpus +
    (partner?.existingCorpus ?? 0) -
    user.totalDebt -
    (homeLoan.active ? homeLoan.totalPrincipalOutstandig : 0);

  // 2. HRA Optimization
  let hraSuggestion: JointOptimizationResult["hraSuggestion"] = {
    recommendedClaimer: "none",
    estimatedSaving: 0,
    reason: "No partner data or HRA inputs identified.",
  };

  if (partner) {
    const higherBracket = userBracket > partnerBracket ? "user" : "partner";
    const bracketDiff = Math.abs(userBracket - partnerBracket);
    const potentialHra = Math.max(user.annualHRA, partner.annualHRA);

    if (bracketDiff > 0) {
      hraSuggestion = {
        recommendedClaimer: higherBracket as any,
        estimatedSaving: potentialHra * bracketDiff,
        reason: `${higherBracket === "user" ? user.name : partner.name} is in a higher tax bracket (${(
          Math.max(userBracket, partnerBracket) * 100
        ).toFixed(0)}%). Claiming HRA here maximizes tax savings.`,
      };
    } else {
      hraSuggestion = {
        recommendedClaimer: "split",
        estimatedSaving: 0,
        reason: "Both are in the same tax bracket. You can split HRA claims as per convenience.",
      };
    }
  }

  // 3. Tax Harvesting
  const userHarvest = Math.min(portfolio.userLTCG, 125_000);
  const partnerHarvest = Math.min(portfolio.partnerLTCG, 125_000);
  const taxHarvesting: JointOptimizationResult["taxHarvesting"] = {
    userSell: userHarvest,
    partnerSell: partnerHarvest,
    totalTaxFreeGain: userHarvest + partnerHarvest,
    nextStep: `Sell units with up to ${formatINR(userHarvest)} gain for ${user.name} and ${formatINR(
      partnerHarvest
    )} for partner to use the combined ₹2.5L tax-free limit.`,
  };

  // 4. Home Loan Advice
  let homeLoanAdvice: JointOptimizationResult["homeLoanAdvice"] = {
    optimalInterestClaimer: "split",
    optimalPrincipalClaimer: "split",
    estimatedTaxBenefit: 0,
  };

  if (homeLoan.active && partner) {
    const interestLimit = 200_000;
    const optimalInterest = userBracket > partnerBracket ? "user" : partnerBracket > userBracket ? "partner" : "split";
    homeLoanAdvice = {
      optimalInterestClaimer: optimalInterest as any,
      optimalPrincipalClaimer: "split",
      estimatedTaxBenefit: Math.min(homeLoan.annualInterest, interestLimit) * Math.max(userBracket, partnerBracket),
    };
  }

  // 5. SIP Splits
  const user80CRoom = Math.max(0, 150_000 - (user.annual80C + user.annualPF));
  const partner80CRoom = partner ? Math.max(0, 150_000 - (partner.annual80C + partner.annualPF)) : 0;
  
  const sipSplits: JointOptimizationResult["sipSplits"] = {
    userSIP: user.monthlySIP,
    partnerSIP: partner?.monthlySIP ?? 0,
    reason: partner 
      ? `Allocate SIPs to fill ${user.name}'s ₹${formatIndianDigits(user80CRoom)} room and partner's ₹${formatIndianDigits(partner80CRoom)} room to maximize 80C benefits across both.`
      : "Start by adding partner data to optimize joint SIP splits.",
  };

  return {
    combinedNetWorth,
    hraSuggestion,
    taxHarvesting,
    homeLoanAdvice,
    sipSplits,
    npsStrategy: {
      userContribution: userBracket > 0 ? 50_000 : 0,
      partnerContribution: partnerBracket > 0 ? 50_000 : 0,
      message: "Utilize the additional ₹50,000 NPS deduction (80CCD 1B) for both to save up to ₹31,200 in taxes.",
    },
    insuranceAdvice: {
      type: "joint-floater",
      reason: "A joint family floater plan is usually 20-30% cheaper than two individual plans with the same total cover.",
      action: "Check premium for a ₹10L+ family floater policy for both of you.",
    },
  };
}

export function getFinancialSnapshot(profile: UserProfileData) {
  return {
    age: profile.age,
    monthlyIncome: profile.monthlyIncome,
    annualIncome: safeAnnualIncome(profile),
    monthlyExpenses: profile.monthlyExpenses,
    monthlyEMI: profile.monthlyEMI,
    monthlySavings: getMonthlySavings(profile),
    savingsRate: getSavingsRate(profile),
    existingCorpus: profile.existingCorpus,
    monthlySIP: profile.monthlySIP,
    emergencyFund: profile.emergencyFund,
    emergencyFundMonths: getEmergencyFundMonths(profile),
    recommendedEmergencyFund: getRecommendedEmergencyFund(profile),
    termInsuranceCover: profile.termInsuranceCover,
    insuranceMultiple: getInsuranceMultiple(profile),
    insuranceGap: getInsuranceGap(profile),
    retirementAge: profile.retirementAge,
    fireCorpusTarget: getFireCorpusTarget(profile),
    healthScore: getOverallHealthScore(profile),
    taxOldRegime: getOldRegimeTax(profile),
    taxNewRegime: getNewRegimeTax(profile),
    betterRegime: getBetterRegime(profile),
  };
}

export function cloneProfile(profile: UserProfileData): UserProfileData {
  return JSON.parse(JSON.stringify(profile)) as UserProfileData;
}

export const DemoProfiles: Record<DemoPersonaKey, UserProfileData> = {
  rohan: {
    id: "demo-rohan",
    name: "Rohan",
    age: 28,
    phone: "+919876543210",
    email: "rohan@etfinmentor.demo",
    monthlyIncome: 82_000,
    annualIncome: 984_000,
    monthlyExpenses: 38_000,
    monthlyEMI: 7_000,
    existingCorpus: 230_000,
    monthlySIP: 8_000,
    emergencyFund: 120_000,
    termInsuranceCover: 3_000_000,
    healthInsuranceCover: 500_000,
    annualPF: 48_000,
    annual80C: 72_000,
    annualNPS: 12_000,
    annualHRA: 144_000,
    riskProfile: "moderate",
    retirementAge: 55,
    targetMonthlyExpenseRetirement: 90_000,
    goals: ["retirement", "buy a home", "Europe trip"],
    totalDebt: 350_000,
    onboardingComplete: true,
  },
  priya: {
    id: "demo-priya",
    name: "Priya",
    age: 35,
    phone: "+919812345678",
    email: "priya@etfinmentor.demo",
    monthlyIncome: 140_000,
    annualIncome: 1_680_000,
    monthlyExpenses: 65_000,
    monthlyEMI: 10_000,
    existingCorpus: 1_200_000,
    monthlySIP: 25_000,
    emergencyFund: 420_000,
    termInsuranceCover: 10_000_000,
    healthInsuranceCover: 1_000_000,
    annualPF: 90_000,
    annual80C: 120_000,
    annualNPS: 30_000,
    annualHRA: 300_000,
    riskProfile: "aggressive",
    retirementAge: 50,
    targetMonthlyExpenseRetirement: 140_000,
    goals: ["retirement", "parents care fund", "children education"],
    totalDebt: 600_000,
    onboardingComplete: true,
  },
  vikram: {
    id: "demo-vikram",
    name: "Vikram",
    age: 45,
    phone: "+919823456789",
    email: "vikram@etfinmentor.demo",
    monthlyIncome: 210_000,
    annualIncome: 2_520_000,
    monthlyExpenses: 95_000,
    monthlyEMI: 45_000,
    existingCorpus: 4_500_000,
    monthlySIP: 30_000,
    emergencyFund: 350_000,
    termInsuranceCover: 15_000_000,
    healthInsuranceCover: 1_000_000,
    annualPF: 120_000,
    annual80C: 150_000,
    annualNPS: 50_000,
    annualHRA: 420_000,
    riskProfile: "conservative",
    retirementAge: 60,
    targetMonthlyExpenseRetirement: 175_000,
    goals: ["retirement", "debt-free living", "daughter marriage corpus"],
    totalDebt: 3_200_000,
    onboardingComplete: true,
  },
};

export function getDemoProfile(key: DemoPersonaKey = "rohan"): UserProfileData {
  return cloneProfile(DemoProfiles[key]);
}
