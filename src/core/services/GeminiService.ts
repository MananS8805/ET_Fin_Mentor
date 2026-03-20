import { AppConfig } from "../config";
import {
  LifeEventAdvice,
  LifeEventKey,
  TaxWizardSnapshot,
  UserProfileData,
  formatINR,
  getFinancialSnapshot,
  getMonthlyPassiveIncome,
} from "../models/UserProfile";
import { AuthService } from "./AuthService";
import { TemplateService } from "./TemplateService";
import { ChatRouter } from "./ChatRouter";
import { OCRService } from "./OCRService";

export type ChatRole = "user" | "model";
export type ChatMessageKind = "standard" | "welcome" | "system" | "error";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  kind?: ChatMessageKind;
}

export interface SalarySlipParseResult {
  name?: string | null;
  monthlyIncome?: number | null;
  annualIncome?: number | null;
  annualPF?: number | null;
  annual80C?: number | null;
  annualNPS?: number | null;
  annualHRA?: number | null;
  employerName?: string | null;
  notes?: string | null;
}

export interface Form16ParseResult {
  name?: string | null;
  employerName?: string | null;
  annualIncome?: number | null;
  basicSalary?: number | null;
  annualHRAReceived?: number | null;
  annualPF?: number | null;
  annual80C?: number | null;
  annualNPS?: number | null;
  taxDeducted?: number | null;
  notes?: string | null;
}

export interface HealthTipResponse {
  tips: string[];
}

export interface FutureYouNarrativeInput {
  targetAge: number;
  sipMultiplier: number;
  cagr: number;
  projectedCorpus: number;
  fireTarget: number;
}

export interface TaxBattleNarrativeInput {
  annualIncome: number;
  oldTax: number;
  newTax: number;
  betterRegime: "old" | "new";
  taxSaving: number;
}

export interface LifeEventAdviceResponse extends LifeEventAdvice {}

export interface CAMSHolding {
  name: string;
  category: string;
  units: number;
  nav: number;
  currentValue: number;
  purchaseValue: number;
  transactions: Array<{ date: string; amount: number }>; // negative = investment, positive = redemption
}

export interface CAMSParseResult {
  holdings: CAMSHolding[];
  notes?: string | null;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function scrubPII(input: string): string {
  return input
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[AADHAAR]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[PAN]")
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, "[IFSC]")
    .replace(/(?:\+91[\s-]?)?[6-9]\d{9}\b/g, "[MOBILE]")
    .replace(/\b\d{9,18}\b/g, "[ACCOUNT]");
}

function buildSystemInstruction(profile: UserProfileData): string {
  const snapshot = getFinancialSnapshot(profile);

  return [
    "You are FinMentor - a friendly CA and personal finance advisor for India.",
    "- Speak like a knowledgeable friend, not a textbook",
    "- Always use the user's exact \u20B9 numbers in advice",
    "- Give specific fund categories (Nifty 50 index, ELSS, liquid funds) - no stock picks",
    "- Keep responses under 150 words unless asked for detail",
    '- End complex advice with "Next step:" - one clear action',
    `- Format amounts Indian style like ${formatINR(1234567)}`,
    "- Occasional Hinglish is fine if user writes in Hindi",
    "",
    `Financial snapshot: ${JSON.stringify(snapshot)}`,
  ].join("\n");
}

function toGeminiContents(history: ChatMessage[]) {
  return history
    .filter((message) => (message.kind ?? "standard") === "standard")
    .map((message) => ({
    role: message.role,
    parts: [{ text: message.role === "user" ? scrubPII(message.text) : message.text }],
    }));
}

function stripJsonFence(rawText: string): string {
  return rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function extractCandidateText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

async function ensureGeminiAccess() {
  const sessionState = await AuthService.ensureValidSession();

  if (!sessionState) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!AppConfig.isGeminiConfigured()) {
    throw new Error("Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY to .env.");
  }
}

async function requestGemini(body: Record<string, unknown>) {
  await ensureGeminiAccess();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AppConfig.geminiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  return (await response.json()) as GeminiResponse;
}

async function requestGeminiStream(
  body: Record<string, unknown>,
  onChunk: (delta: string) => void
): Promise<void> {
  await ensureGeminiAccess();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${AppConfig.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini stream failed with status ${response.status}.`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error("No readable stream returned.");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // SSE lines look like: data: {"candidates":[{"content":{"parts":[{"text":"hello"}]}}]}
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        const json = JSON.parse(line.slice(6)) as GeminiResponse;
        const delta = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (delta) onChunk(delta);
      } catch {
        // partial JSON line — skip
      }
    }
  }
}

const conversationHistory: ChatMessage[] = [];

const MAX_HISTORY = 50;

export const GeminiService = {
  createUserMessage(text: string): ChatMessage {
    return {
      id: createMessageId(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      kind: "standard",
    };
  },

  createModelMessage(text: string, kind: ChatMessageKind = "standard"): ChatMessage {
    return {
      id: createMessageId(),
      role: "model",
      text,
      createdAt: new Date().toISOString(),
      kind,
    };
  },

  clearHistory() {
    conversationHistory.length = 0;
  },

  getHistory() {
    return [...conversationHistory];
  },

  async sendMessage(message: string, profile: UserProfileData, history: ChatMessage[] = conversationHistory) {
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }
    const userMessage = this.createUserMessage(message);

    const localResponse = ChatRouter.routeMessage(message);
    if (localResponse) {
      const modelMessage = this.createModelMessage(localResponse);
      const newHistory = [...history, userMessage, modelMessage];
      conversationHistory.splice(0, conversationHistory.length, ...newHistory);
      return {
        userMessage,
        modelMessage,
        history: [...conversationHistory],
      };
    }

    const apiHistory = [...history, userMessage];

    const data = await requestGemini({
      system_instruction: {
        parts: [{ text: buildSystemInstruction(profile) }],
      },
      contents: toGeminiContents(apiHistory),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 450,
      },
  
    });
    const text = extractCandidateText(data);

    if (!text) {
      throw new Error(data.error?.message ?? "Gemini returned an empty response.");
    }

    const modelMessage = this.createModelMessage(text);

    conversationHistory.splice(0, conversationHistory.length, ...apiHistory, modelMessage);

    return {
      userMessage,
      modelMessage,
      history: [...conversationHistory],
    };
  },

  async streamMessage(
  message: string,
  profile: UserProfileData,
  onChunk: (delta: string) => void,
  history: ChatMessage[] = conversationHistory
): Promise<{ userMessage: ChatMessage; modelMessage: ChatMessage }> {
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
  const userMessage = this.createUserMessage(message);

  const localResponse = ChatRouter.routeMessage(message);
  if (localResponse) {
    const chunks = localResponse.split(" ");
    for (const word of chunks) {
      onChunk(word + " ");
      await new Promise(r => setTimeout(r, 20)); // Fake stream delay
    }
    const modelMessage = this.createModelMessage(localResponse);
    const newHistory = [...history, userMessage, modelMessage];
    conversationHistory.splice(0, conversationHistory.length, ...newHistory);
    return { userMessage, modelMessage };
  }

  const apiHistory = [...history, userMessage];
  let fullText = "";

  await requestGeminiStream(
    {
      system_instruction: { parts: [{ text: buildSystemInstruction(profile) }] },
      contents: toGeminiContents(apiHistory),
      generationConfig: { temperature: 0.7, maxOutputTokens: 450 },
    },
    (delta) => {
      fullText += delta;
      onChunk(delta);
    }
  );

  if (!fullText) throw new Error("Gemini stream returned no content.");

  const modelMessage = this.createModelMessage(fullText);
  conversationHistory.splice(0, conversationHistory.length, ...apiHistory, modelMessage);

  return { userMessage, modelMessage };
},

  async parseSalarySlip(imageBase64: string, mimeType = "image/jpeg") {
    return OCRService.parseSalarySlip(imageBase64, mimeType);
  },

  async parseForm16Image(imageBase64: string, mimeType = "image/jpeg") {
    return OCRService.parseForm16(imageBase64, mimeType);
  },

  async parseCAMSStatement(imageBase64: string, mimeType = "image/jpeg") {
    return OCRService.parseCAMS(imageBase64, mimeType);
  },

  async getPortfolioRebalancingPlan(
    profile: UserProfileData,
    xray: import("../models/UserProfile").PortfolioXRay
  ): Promise<string> {
    const data = await requestGemini({
      system_instruction: {
        parts: [{ text: buildSystemInstruction(profile) }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Write exactly 3 distinct, actionable bullet points for a personalized mutual fund rebalancing plan.",
                "Stay under 150 words total. Do NOT use markdown bolding or formatting bullet asterisks, just write '1. ', '2. ', '3. '.",
                "The user's current holdings are:",
                xray.holdings.map(h => `- ${h.name} (${formatINR(h.currentValue)} in ${h.category})`).join("\n"),
                `Their overall XIRR is ${xray.overallXIRR !== null ? xray.overallXIRR.toFixed(1) + '%' : 'unknown'}.`,
                `They are losing a massive ${formatINR(xray.expenseRatioDrag)}/yr individually to active fund expense ratios vs an equivalent index fund.`,
                xray.overlapPairs.length > 0 
                  ? `Significant overlaps detected: ${xray.overlapPairs.map(o => `${o.fund1} & ${o.fund2} (${o.overlapLevel} overlap)`).join(', ')}.` 
                  : "No high overlapping scheme pairs detected.",
                "Provide highly specific fund-level advice: name the exact funds to consolidate, sell, or shift SIPs toward (e.g. telling them to sell the underperforming active flexi cap and move it to a low-cost NIFTY 50 index based on the numbers). Ensure your advice accurately reflects their risk profile and data.",
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 250,
      },
    });

    const text = extractCandidateText(data);
    if (!text) {
      throw new Error(data.error?.message ?? "Gemini returned an empty rebalancing plan.");
    }

    return text;
  },

  async getHealthImprovementTips(profile: UserProfileData) {
    return TemplateService.getHealthImprovementTips(profile);
  },

  async getFutureYouNarrative(profile: UserProfileData, input: FutureYouNarrativeInput) {
    return TemplateService.getFutureYouNarrative(profile, input);
  },

  async getTaxBattleNarrative(profile: UserProfileData, input: TaxBattleNarrativeInput) {
    return TemplateService.getTaxBattleNarrative(profile, input);
  },

  async getTaxWizardSummary(profile: UserProfileData, snapshot: TaxWizardSnapshot) {
    const topRecommendations = snapshot.rankedRecommendations
      .slice(0, 2)
      .map((item) => `${item.title} (${formatINR(item.suggestedAmount)})`)
      .join(", ");

    const data = await requestGemini({
      system_instruction: {
        parts: [{ text: buildSystemInstruction(profile) }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Write exactly 3 short sentences summarizing this tax plan.",
                "Stay under 110 words total.",
                "Mention the winning regime, the biggest deduction gap, and the strongest recommended next move.",
                "No markdown bullets.",
                `Annual salary: ${formatINR(snapshot.input.annualIncome)}.`,
                `Old regime tax: ${formatINR(snapshot.oldTax)}.`,
                `New regime tax: ${formatINR(snapshot.newTax)}.`,
                `Winning regime: ${snapshot.betterRegime}.`,
                `Tax saving gap: ${formatINR(snapshot.taxSaving)}.`,
                `HRA exemption modeled: ${formatINR(snapshot.hraExemption)}.`,
                `80C room left: ${formatINR(snapshot.remaining80CRoom)}.`,
                `Modeled NPS room left: ${formatINR(snapshot.remainingNpsDeductionRoom)}.`,
                `Top recommendations: ${topRecommendations || "No extra tax products needed"}.`,
              ].join(" "),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 180,
      },
    });
    const text = extractCandidateText(data);

    if (!text) {
      throw new Error(data.error?.message ?? "Gemini returned an empty tax wizard summary.");
    }

    return text;
  },

  async getLifeEventAdvice(profile: UserProfileData, event: LifeEventKey) {
    return TemplateService.getLifeEventAdvice(profile, event);
  },

  async getJointOptimizationAdvice(
    jointData: import("../models/UserProfile").JointProfileData,
    optimization: import("../models/UserProfile").JointOptimizationResult
  ): Promise<string> {
    const { user, partner } = jointData;
    const partnerName = partner?.name ?? "Partner";

    const data = await requestGemini({
      system_instruction: { parts: [{ text: buildSystemInstruction(user) }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Write exactly 3 short, friendly sentences summarizing this joint optimization strategy for a couple.",
                "Stay under 110 words total. No markdown bullets.",
                "Mention who should claim HRA, the combined tax-free harvesting gain, and the home loan benefit if active.",
                `User: ${user.name}. Partner: ${partnerName}.`,
                `Combined Net Worth: ${formatINR(optimization.combinedNetWorth)}.`,
                `HRA Recommendation: ${optimization.hraSuggestion.recommendedClaimer} to claim (saves ${formatINR(
                  optimization.hraSuggestion.estimatedSaving
                )}).`,
                `Tax Harvesting: Book ${formatINR(optimization.taxHarvesting.totalTaxFreeGain)} combined gains tax-free.`,
                optimization.homeLoanAdvice.estimatedTaxBenefit > 0
                  ? `Home Loan Benefit: ${formatINR(optimization.homeLoanAdvice.estimatedTaxBenefit)} tax saving.`
                  : "No joint home loan modeled.",
                `SIP Strategy: ${optimization.sipSplits.reason}`,
              ].join(" "),
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.5, maxOutputTokens: 250 },
    });

    const text = extractCandidateText(data);
    if (!text) throw new Error(data.error?.message ?? "Gemini returned an empty joint advice.");
    return text;
  },

  scrubPII,
};
