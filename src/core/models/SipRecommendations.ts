import {
  RiskProfile,
  UserProfileData,
  getDebtToIncomeRatio,
  getEmergencyFundMonths,
} from "./UserProfile";

export type SipSchemeCategory =
  | "index_large_cap"
  | "index_next_50"
  | "flexi_cap"
  | "large_cap"
  | "large_midcap"
  | "small_cap"
  | "balanced_advantage"
  | "elss"
  | "short_term_debt"
  | "ultra_short_term";

export type SipSchemeRisk = "low" | "moderate" | "moderately_high" | "high" | "very_high";
export type SipRole = "Core" | "Satellite" | "Tax Saver" | "Stability";

export interface SipScheme {
  id: string;
  name: string;
  amc: string;
  category: SipSchemeCategory;
  categoryLabel: string;
  risk: SipSchemeRisk;
  idealHorizonYears: string;
  minimumHorizonYears: number;
  lockInYears: number;
  taxBenefit: boolean;
  role: SipRole;
  bestFor: string;
  compareNote: string;
  sourceUrl: string;
}

export interface SipRecommendation {
  scheme: SipScheme;
  fitScore: number;
  fitReason: string;
  caution: string;
}

export interface SipBucketMix {
  label: string;
  percentage: number;
  helper: string;
}

export const SIP_SCHEME_LIBRARY_UPDATED_AT = "2026-03-18";

export const SIP_SCHEME_LIBRARY: SipScheme[] = [
  {
    id: "uti-nifty-50-index",
    name: "UTI Nifty 50 Index Fund",
    amc: "UTI Mutual Fund",
    category: "index_large_cap",
    categoryLabel: "Large-cap index",
    risk: "high",
    idealHorizonYears: "5+ years",
    minimumHorizonYears: 5,
    lockInYears: 0,
    taxBenefit: false,
    role: "Core",
    bestFor: "Low-cost core equity exposure through the Nifty 50.",
    compareNote: "Broad large-cap core for long-horizon wealth creation.",
    sourceUrl: "https://uat-cms.utimf.com/uti-nifty-50-index-fund",
  },
  {
    id: "icici-nifty-next-50-index",
    name: "ICICI Prudential Nifty Next 50 Index Fund",
    amc: "ICICI Prudential Mutual Fund",
    category: "index_next_50",
    categoryLabel: "Next 50 index",
    risk: "very_high",
    idealHorizonYears: "7+ years",
    minimumHorizonYears: 7,
    lockInYears: 0,
    taxBenefit: false,
    role: "Satellite",
    bestFor: "Higher-growth large-cap satellite exposure beyond the Nifty 50.",
    compareNote: "Useful satellite fund if you already have a plain Nifty 50 core.",
    sourceUrl:
      "https://www.icicipruamc.com/blob/sebi-repo/Advertisements/2026/January/Filing%20date%2020-02-2026/Release%20date%2018-02-2026/Advertisements/Annexure%205%20-%20Index%20Fund%20Bluebook.pdf",
  },
  {
    id: "parag-parikh-flexi-cap",
    name: "Parag Parikh Flexi Cap Fund",
    amc: "PPFAS Mutual Fund",
    category: "flexi_cap",
    categoryLabel: "Flexi cap",
    risk: "high",
    idealHorizonYears: "5+ years",
    minimumHorizonYears: 5,
    lockInYears: 0,
    taxBenefit: false,
    role: "Core",
    bestFor: "Investors wanting an active all-cap core with long-term orientation.",
    compareNote: "Active diversified core for investors comfortable with market volatility.",
    sourceUrl: "https://amc.ppfas.com/pltvf/",
  },
  {
    id: "mirae-large-cap",
    name: "Mirae Asset Large Cap Fund",
    amc: "Mirae Asset Mutual Fund",
    category: "large_cap",
    categoryLabel: "Large cap",
    risk: "high",
    idealHorizonYears: "5+ years",
    minimumHorizonYears: 5,
    lockInYears: 0,
    taxBenefit: false,
    role: "Core",
    bestFor: "Investors who want a large-cap heavy active core fund.",
    compareNote: "Large-cap heavy core option for steadier equity exposure than mid/small-cap funds.",
    sourceUrl:
      "https://www.miraeassetmf.co.in/mutual-fund-scheme/equity-fund/mirae-asset-large-cap-fund",
  },
  {
    id: "mirae-large-midcap",
    name: "Mirae Asset Large & Midcap Fund",
    amc: "Mirae Asset Mutual Fund",
    category: "large_midcap",
    categoryLabel: "Large & mid cap",
    risk: "very_high",
    idealHorizonYears: "7+ years",
    minimumHorizonYears: 7,
    lockInYears: 0,
    taxBenefit: false,
    role: "Satellite",
    bestFor: "Long-term investors who can handle higher volatility for growth.",
    compareNote: "Adds more mid-cap growth potential than a pure large-cap fund.",
    sourceUrl:
      "https://www.miraeassetmf.co.in/digitalfactsheets/2024_jan/innerpages/Large-and-Midcap.html",
  },
  {
    id: "nippon-small-cap",
    name: "Nippon India Small Cap Fund",
    amc: "Nippon India Mutual Fund",
    category: "small_cap",
    categoryLabel: "Small cap",
    risk: "very_high",
    idealHorizonYears: "8+ years",
    minimumHorizonYears: 8,
    lockInYears: 0,
    taxBenefit: false,
    role: "Satellite",
    bestFor: "Experienced investors with long runway and high risk tolerance.",
    compareNote: "Use only as a smaller satellite allocation because the volatility is high.",
    sourceUrl: "https://mf.nipponindiaim.com/FundsAndPerformance/Pages/NipponIndia-Small-Cap-Fund.aspx",
  },
  {
    id: "hdfc-balanced-advantage",
    name: "HDFC Balanced Advantage Fund",
    amc: "HDFC Mutual Fund",
    category: "balanced_advantage",
    categoryLabel: "Balanced advantage",
    risk: "moderately_high",
    idealHorizonYears: "4+ years",
    minimumHorizonYears: 4,
    lockInYears: 0,
    taxBenefit: false,
    role: "Stability",
    bestFor: "Users who want equity participation with built-in asset allocation shifts.",
    compareNote: "Useful when you want smoother rides than pure equity SIPs.",
    sourceUrl: "https://www.hdfcfund.com/product-solutions/overview/hdfc-balanced-advantage-fund/regular",
  },
  {
    id: "sbi-long-term-equity",
    name: "SBI Long Term Equity Fund",
    amc: "SBI Mutual Fund",
    category: "elss",
    categoryLabel: "ELSS tax saver",
    risk: "very_high",
    idealHorizonYears: "5+ years",
    minimumHorizonYears: 5,
    lockInYears: 3,
    taxBenefit: true,
    role: "Tax Saver",
    bestFor: "Users with 80C room left who can accept equity volatility.",
    compareNote: "Tax-saving equity option with 3-year lock-in under Section 80C.",
    sourceUrl: "https://www.sbimf.com/tax-planning",
  },
  {
    id: "parag-parikh-elss",
    name: "Parag Parikh ELSS Tax Saver Fund",
    amc: "PPFAS Mutual Fund",
    category: "elss",
    categoryLabel: "ELSS tax saver",
    risk: "very_high",
    idealHorizonYears: "5+ years",
    minimumHorizonYears: 5,
    lockInYears: 3,
    taxBenefit: true,
    role: "Tax Saver",
    bestFor: "Users wanting 80C tax relief through an equity-linked tax-saving scheme.",
    compareNote: "Another ELSS option when tax benefit matters and lock-in is acceptable.",
    sourceUrl:
      "https://amc.ppfas.com/downloads/digital-factsheet/2023/november-2023/definitions.php",
  },
  {
    id: "hdfc-short-term-debt",
    name: "HDFC Short Term Debt Fund",
    amc: "HDFC Mutual Fund",
    category: "short_term_debt",
    categoryLabel: "Short term debt",
    risk: "moderate",
    idealHorizonYears: "1-3 years",
    minimumHorizonYears: 1,
    lockInYears: 0,
    taxBenefit: false,
    role: "Stability",
    bestFor: "Parking near-term goals or stabilizing a cautious SIP mix.",
    compareNote: "Useful for lower-risk buckets and shorter goal timelines.",
    sourceUrl: "https://www.hdfcfund.com/explore/mutual-funds/hdfc-short-term-debt-fund/direct",
  },
  {
    id: "hdfc-ultra-short-term",
    name: "HDFC Ultra Short Term Fund",
    amc: "HDFC Mutual Fund",
    category: "ultra_short_term",
    categoryLabel: "Ultra short term debt",
    risk: "low",
    idealHorizonYears: "0-1 year",
    minimumHorizonYears: 0,
    lockInYears: 0,
    taxBenefit: false,
    role: "Stability",
    bestFor: "Users who need a holding area for very short-term or emergency parking.",
    compareNote: "Best suited for parking money, not for long-term wealth creation.",
    sourceUrl: "https://www.hdfcfund.com/product-solutions/overview/hdfc-ultra-short-term-fund/direct",
  },
];

function getYearsToRetirement(profile: UserProfileData): number {
  return Math.max(0, profile.retirementAge - profile.age);
}

function getGoalText(profile: UserProfileData): string {
  return profile.goals.join(" ").toLowerCase();
}

function scoreRiskAlignment(profileRisk: RiskProfile, schemeRisk: SipSchemeRisk): number {
  const conservativeScores: Record<SipSchemeRisk, number> = {
    low: 5,
    moderate: 5,
    moderately_high: 3.5,
    high: 2,
    very_high: 0.5,
  };
  const moderateScores: Record<SipSchemeRisk, number> = {
    low: 2.5,
    moderate: 4,
    moderately_high: 5,
    high: 4.5,
    very_high: 3,
  };
  const aggressiveScores: Record<SipSchemeRisk, number> = {
    low: 1,
    moderate: 2,
    moderately_high: 4,
    high: 5,
    very_high: 5,
  };

  if (profileRisk === "conservative") {
    return conservativeScores[schemeRisk];
  }

  if (profileRisk === "moderate") {
    return moderateScores[schemeRisk];
  }

  return aggressiveScores[schemeRisk];
}

function scoreTimelineAlignment(profile: UserProfileData, scheme: SipScheme): number {
  const yearsToRetirement = getYearsToRetirement(profile);

  if (yearsToRetirement === 0) {
    return scheme.minimumHorizonYears <= 1 ? 4 : 1;
  }

  if (yearsToRetirement >= scheme.minimumHorizonYears) {
    return 4;
  }

  if (yearsToRetirement + 2 >= scheme.minimumHorizonYears) {
    return 2.5;
  }

  return 0.5;
}

function scoreSafetyNeeds(profile: UserProfileData, scheme: SipScheme): number {
  const emergencyMonths = getEmergencyFundMonths(profile);
  const debtRatio = getDebtToIncomeRatio(profile);

  if (emergencyMonths < 3 || debtRatio > 35) {
    if (scheme.role === "Stability") {
      return 5;
    }

    if (scheme.category === "balanced_advantage" || scheme.category === "index_large_cap") {
      return 3;
    }

    if (scheme.category === "small_cap") {
      return 0;
    }

    return 1.5;
  }

  if (emergencyMonths < 6 || debtRatio > 20) {
    if (scheme.role === "Stability") {
      return 4;
    }

    if (scheme.category === "small_cap") {
      return 1;
    }

    return 2.5;
  }

  if (scheme.role === "Stability") {
    return 2;
  }

  return 3.5;
}

function scoreTaxFit(profile: UserProfileData, scheme: SipScheme): number {
  const used80C = Math.min(profile.annual80C + profile.annualPF, 150_000);
  const remaining80CRoom = Math.max(0, 150_000 - used80C);

  if (scheme.taxBenefit) {
    return remaining80CRoom > 0 ? 5 : 1.5;
  }

  return remaining80CRoom > 0 ? 2 : 3;
}

function scoreGoalFit(profile: UserProfileData, scheme: SipScheme): number {
  const goalsText = getGoalText(profile);
  const yearsToRetirement = getYearsToRetirement(profile);

  if (scheme.category === "ultra_short_term" && goalsText.includes("emergency")) {
    return 5;
  }

  if (scheme.category === "short_term_debt" && (goalsText.includes("home") || goalsText.includes("vacation"))) {
    return 4;
  }

  if (
    (scheme.category === "index_large_cap" || scheme.category === "flexi_cap" || scheme.category === "large_cap") &&
    (goalsText.includes("retirement") || goalsText.includes("wealth"))
  ) {
    return 5;
  }

  if (
    (scheme.category === "large_midcap" || scheme.category === "index_next_50") &&
    (goalsText.includes("wealth") || yearsToRetirement >= 15)
  ) {
    return 4.5;
  }

  if (scheme.category === "small_cap") {
    return yearsToRetirement >= 18 && profile.riskProfile === "aggressive" ? 4 : 1.5;
  }

  if (scheme.category === "balanced_advantage") {
    return profile.riskProfile === "conservative" || yearsToRetirement < 12 ? 4 : 2.5;
  }

  return 2.5;
}

function buildRecommendationReason(profile: UserProfileData, scheme: SipScheme): string {
  const emergencyMonths = getEmergencyFundMonths(profile);
  const yearsToRetirement = getYearsToRetirement(profile);
  const used80C = Math.min(profile.annual80C + profile.annualPF, 150_000);
  const remaining80CRoom = Math.max(0, 150_000 - used80C);

  if (scheme.taxBenefit && remaining80CRoom > 0) {
    return `You still have 80C room left, so this ELSS can combine tax saving with long-term SIP investing.`;
  }

  if (scheme.role === "Stability" && emergencyMonths < 6) {
    return `Your safety buffer is still light, so a stability-oriented fund deserves a higher place in the shortlist.`;
  }

  if (scheme.category === "small_cap") {
    return `This fits only as a satellite SIP because your profile can handle a long horizon and higher volatility.`;
  }

  if (scheme.category === "balanced_advantage") {
    return `This can reduce portfolio swings while still keeping you invested for long-term goals.`;
  }

  if (scheme.role === "Core") {
    return `This works as a strong core SIP candidate for your ${yearsToRetirement}-year runway and ${profile.riskProfile} profile.`;
  }

  return scheme.compareNote;
}

function buildRecommendationCaution(profile: UserProfileData, scheme: SipScheme): string {
  if (scheme.lockInYears > 0) {
    return `This comes with a ${scheme.lockInYears}-year lock-in, so use it only for long-term money.`;
  }

  if (scheme.category === "small_cap") {
    return "Expect sharp drawdowns and do not make this your main SIP bucket.";
  }

  if (scheme.role === "Stability") {
    return "Good for stability and near-term allocation, but not the best engine for long-term equity growth.";
  }

  return "Use this as part of a mix, not as a one-fund answer for every goal.";
}

export function getRecommendedSipBucketMix(profile: UserProfileData): SipBucketMix[] {
  const emergencyMonths = getEmergencyFundMonths(profile);
  const debtRatio = getDebtToIncomeRatio(profile);
  const yearsToRetirement = getYearsToRetirement(profile);

  if (profile.riskProfile === "conservative" || yearsToRetirement < 12 || debtRatio > 35) {
    return [
      { label: "Core Equity", percentage: 35, helper: "Index, flexi-cap, and large-cap SIPs." },
      { label: "Tax Saver", percentage: 20, helper: "ELSS only if 80C room is still available." },
      { label: "Stability", percentage: 45, helper: "Balanced advantage and short-duration debt." },
    ];
  }

  if (profile.riskProfile === "moderate" || emergencyMonths < 6) {
    return [
      { label: "Core Equity", percentage: 45, helper: "Index and flexi-cap funds as the base." },
      { label: "Growth Satellite", percentage: 25, helper: "Next 50 or large-midcap for extra upside." },
      { label: "Tax Saver", percentage: 10, helper: "ELSS only if needed for 80C." },
      { label: "Stability", percentage: 20, helper: "Balanced advantage or short-term debt." },
    ];
  }

  return [
    { label: "Core Equity", percentage: 40, helper: "Index and flexi-cap core SIPs." },
    { label: "Growth Satellite", percentage: 35, helper: "Next 50, large-midcap, and selective small-cap." },
    { label: "Tax Saver", percentage: 10, helper: "ELSS only when 80C is still open." },
    { label: "Stability", percentage: 15, helper: "Keep a stabilizer bucket even in an aggressive plan." },
  ];
}

export function getTopSipRecommendations(profile: UserProfileData, limit = 10): SipRecommendation[] {
  return SIP_SCHEME_LIBRARY.map((scheme) => {
    const fitScore =
      scoreRiskAlignment(profile.riskProfile, scheme.risk) * 5 +
      scoreTimelineAlignment(profile, scheme) * 4 +
      scoreSafetyNeeds(profile, scheme) * 4 +
      scoreTaxFit(profile, scheme) * 3 +
      scoreGoalFit(profile, scheme) * 4;

    return {
      scheme,
      fitScore: Math.round(fitScore),
      fitReason: buildRecommendationReason(profile, scheme),
      caution: buildRecommendationCaution(profile, scheme),
    };
  })
    .sort((left, right) => right.fitScore - left.fitScore)
    .slice(0, limit);
}

