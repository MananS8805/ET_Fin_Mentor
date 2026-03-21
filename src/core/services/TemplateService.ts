import {
  UserProfileData,
  getMonthlyPassiveIncome,
  getRecommendedEmergencyFund,
  getInsuranceGap,
  formatINR,
  PortfolioXRay,
  LifeEventKey,
  LifeEventAdvice,
  JointProfileData,
  JointOptimizationResult
} from "../models/UserProfile";
import {
  FutureYouNarrativeInput,
  TaxBattleNarrativeInput,
} from "./GeminiService";

export const TemplateService = {
  getFutureYouNarrative(_profile: UserProfileData, input: FutureYouNarrativeInput): string {
    const passiveIncome = getMonthlyPassiveIncome(input.projectedCorpus);
    const gap = input.fireTarget - input.projectedCorpus;
    
    let gapText = "";
    if (gap > 0) {
      gapText = `This leaves a gap of ${formatINR(gap)} to your FIRE target.`;
    } else {
      gapText = `You are on track to exceed your FIRE target by ${formatINR(-gap)}.`;
    }

    return `At age ${input.targetAge}, your projected corpus of ${formatINR(input.projectedCorpus)} will generate ${formatINR(passiveIncome)}/month in passive income using the 4% rule. ${gapText}`;
  },

  getTaxBattleNarrative(_profile: UserProfileData, input: TaxBattleNarrativeInput): string {
    if (input.taxSaving > 0) {
       return `The ${input.betterRegime} tax regime is mathematically better for you, offering ${formatINR(input.taxSaving)} more in your pocket this year. At your current salary of ${formatINR(input.annualIncome)}, switching your regime is the optimal move.`;
    }
    return `Both regimes result in the exact same tax for your current salary of ${formatINR(input.annualIncome)}. We recommend the new regime for less compliance hassle.`;
  },

  getHealthImprovementTips(profile: UserProfileData): string[] {
    const tips: string[] = [];
    
    const recommendedEmergency = getRecommendedEmergencyFund(profile);
    if (profile.emergencyFund < recommendedEmergency) {
      tips.push(`Build your emergency fund to ${formatINR(recommendedEmergency)} to cover 6 months of expenses.`);
    }

    const insuranceGap = getInsuranceGap(profile);
    if (insuranceGap > 0) {
      tips.push(`Get an additional ${formatINR(insuranceGap)} in term life cover to protect your dependents.`);
    }

    if (profile.monthlySIP < profile.monthlyIncome * 0.2) {
      tips.push(`Try to increase your monthly SIPs. Aiming for at least 20% of your income accelerates wealth creation.`);
    }
    
    if (profile.monthlyEMI > profile.monthlyIncome * 0.4) {
      tips.push(`Your EMIs consume over 40% of your income. Focus on aggressively paying down high-interest debt.`);
    }

    if (tips.length === 0) {
      tips.push(`Consider maximizing your 80C and NPS limits to ruthlessly optimize for taxes.`);
      tips.push(`Review your portfolio for overlapping mutual funds and optimize expense ratios.`);
      tips.push(`You are in excellent financial shape. Stay the course with your current SIPs.`);
    }

    return tips.slice(0, 3);
  },

  getPortfolioRebalancingPlan(profile: UserProfileData, xray: PortfolioXRay): string {
    const lines: string[] = [];

    if (xray.overlapPairs.length > 0) {
      const topOverlap = xray.overlapPairs[0];
      if (topOverlap.overlapLevel === "high" || topOverlap.overlapLevel === "medium") {
        lines.push(`1. Consolidate Overlap: ${topOverlap.fund1} and ${topOverlap.fund2} have overlapping holdings. Consider redeeming one to avoid duplication.`);
      }
    }

    if (xray.expenseRatioDrag > profile.monthlyIncome * 0.05) {
      lines.push(`2. Reduce Expense Drag: You are losing ${formatINR(xray.expenseRatioDrag)} annually to high fees. Shift underperforming active funds to lower-cost index alternatives.`);
    }

    const equityExposure = (xray.categoryAllocation.large_cap || 0) + (xray.categoryAllocation.mid_cap || 0) + (xray.categoryAllocation.small_cap || 0) + (xray.categoryAllocation.elss || 0);
    if (profile.riskProfile === "conservative" && equityExposure > 50) {
      lines.push(`3. Rebalance Allocation: Your equity exposure (${equityExposure.toFixed(0)}%) is too high for a conservative profile. Shift profits to debt or liquid funds.`);
    } else if (profile.riskProfile === "aggressive" && equityExposure < 70) {
      lines.push(`3. Rebalance Allocation: Increase equity allocation. As an aggressive investor, you should target 70-80% in equity rather than your current ${equityExposure.toFixed(0)}%.`);
    } else {
      lines.push(`3. Maintain Course: Your asset allocation safely matches your ${profile.riskProfile} risk profile expectations.`);
    }

    if (lines.length < 3) {
      lines.push(`1. Consolidate: Ensure you hold no more than 3-4 distinct equity funds to avoid over-diversification.`);
      lines.push(`2. Boost SIP: Consider stepping up your SIPs by 10% annually to combat inflation drag.`);
    }

    return lines.slice(0, 3).join("\n");
  },

  getLifeEventAdvice(_profile: UserProfileData, event: LifeEventKey): LifeEventAdvice {
    const templates: Record<LifeEventKey, LifeEventAdvice> = {
      "bonus": {
        immediate: ["Park the entire amount in a liquid fund temporarily.", "Do not inflate your lifestyle or buy liabilities."],
        soon: ["Clear any high-interest consumer debt immediately.", "Allocate the rest directly towards your FIRE corpus."],
        longTerm: ["Rebalance your portfolio if the lump sum skewed it.", "Aim to invest 80% of all future bonuses automatically."]
      },
      "marriage": {
        immediate: ["Discuss and align on financial goals and debts.", "Update nominees on all bank and mutual fund accounts."],
        soon: ["Build a joint emergency fund for 6 months of combined expenses.", "Review and integrate your health insurance policies."],
        longTerm: ["Optimize tax savings jointly (e.g., claiming HRA).", "Plan systematically for shared milestones like a home."]
      },
      "baby": {
        immediate: ["Add the newborn to your health insurance policy.", "Build a dedicated emergency buffer for medical needs."],
        soon: ["Increase Term Life Insurance to protect the new dependent.", "Open a dedicated savings asset (like PPF/SIP) for education."],
        longTerm: ["Factor ongoing childcare costs into your monthly budget.", "Ensure your FIRE target adjusts for inflation in education."]
      },
      "inheritance": {
        immediate: ["Keep the inherited funds in secure, liquid assets while grieving.", "Consult a CA for the tax implications of the inheritance."],
        soon: ["Pay off any outstanding toxic debt.", "Create a structured deployment plan (e.g., STP into equity over 12 months)."],
        longTerm: ["Integrate the new wealth seamlessly into your existing allocation.", "Update your will and estate plan."]
      },
      "job-switch": {
        immediate: ["Initiate the EPF transfer process using your UAN.", "Check if your new employer provides a better corporate health cover."],
        soon: ["Avoid the urge to upgrade your lifestyle due to the hike.", "Re-evaluate your tax regime choice with the new salary structure."],
        longTerm: ["Commit the entire net increment amount to your monthly SIPs.", "Update your FIRE calculator with the new savings rate."]
      },
      "buy-home": {
        immediate: ["Assess if the new EMI fits safely within 30% of your net income.", "Secure a pre-approved home loan to lock in rates."],
        soon: ["Ensure the down payment doesn't deplete your critical emergency fund.", "Purchase a term plan equivalent to the home loan amount."],
        longTerm: ["Claim Section 24(b) and 80EEA tax deductions aggressively.", "Prepay the principal manually every year to reduce the burden."]
      }
    };

    return templates[event] || templates["bonus"];
  },

  getJointOptimizationAdvice(_data: JointProfileData, result: JointOptimizationResult): string {
    const lines: string[] = [];
    
    // HRA
    if (result.hraSuggestion.estimatedSaving > 0) {
      lines.push(`HRA Strategy: ${result.hraSuggestion.recommendedClaimer.toUpperCase()} should claim the maximum HRA to optimize the higher tax bracket, saving ${formatINR(result.hraSuggestion.estimatedSaving)} jointly.`);
    }

    // Tax Harvesting
    if (result.taxHarvesting.totalTaxFreeGain > 0) {
      lines.push(`Tax Harvesting: You can legally book ${formatINR(result.taxHarvesting.totalTaxFreeGain)} in tax-free LTCG gains this year across both PAN cards.`);
    }

    // Home Loan
    if (result.homeLoanAdvice.estimatedTaxBenefit > 0) {
      lines.push(`Home Loan: Co-borrowing is highly recommended. You can jointly claim up to ₹4L on interest (₹2L each under Sec 24b) saving approximately ${formatINR(result.homeLoanAdvice.estimatedTaxBenefit)}.`);
    }

    if (lines.length === 0) {
      lines.push("Your joint finances are well-structured. Keep investing systematically and review your joint term insurance coverage annually.");
    } else {
      lines.push("Review your joint term insurance and ensure both partners have adequate standalone health cover outside of corporate policies.");
    }

    return lines.join("\n\n");
  }
};
