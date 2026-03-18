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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${AppConfig.geminiApiKey}`,
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

const conversationHistory: ChatMessage[] = [];

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
    const userMessage = this.createUserMessage(message);
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

  async parseSalarySlip(imageBase64: string, mimeType = "image/jpeg") {
    const data = await requestGemini({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Read this Indian salary slip or payslip image and return strict JSON only.",
                "Use numeric rupee amounts without commas.",
                "Prefer take-home or net monthly salary for monthlyIncome when visible; otherwise use gross monthly salary.",
                "Return keys: name, monthlyIncome, annualIncome, annualPF, annual80C, annualNPS, annualHRA, employerName, notes.",
                "If a value is missing, return null.",
              ].join(" "),
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    });
    const rawText = extractCandidateText(data);

    if (!rawText) {
      throw new Error(data.error?.message ?? "Gemini returned an empty salary slip parse.");
    }

    try {
      return JSON.parse(stripJsonFence(rawText)) as SalarySlipParseResult;
    } catch (error) {
      console.warn("[GeminiService] Salary slip parse JSON failed", error);
      throw new Error("Unable to read the salary slip cleanly. Please fill the numbers manually.");
    }
  },

  async parseForm16Image(imageBase64: string, mimeType = "image/jpeg") {
    const data = await requestGemini({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Read this Indian Form 16, tax statement, or salary structure screenshot and return strict JSON only.",
                "Use numeric rupee amounts without commas.",
                "Return keys: name, employerName, annualIncome, basicSalary, annualHRAReceived, annualPF, annual80C, annualNPS, taxDeducted, notes.",
                "If a value is missing, return null.",
                "annualIncome should be gross annual salary when visible.",
                "basicSalary should be annual basic pay when visible.",
              ].join(" "),
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 420,
        responseMimeType: "application/json",
      },
    });
    const rawText = extractCandidateText(data);

    if (!rawText) {
      throw new Error(data.error?.message ?? "Gemini returned an empty Form 16 parse.");
    }

    try {
      return JSON.parse(stripJsonFence(rawText)) as Form16ParseResult;
    } catch (error) {
      console.warn("[GeminiService] Form 16 parse JSON failed", error);
      throw new Error("Unable to read the Form 16 cleanly. Please enter the tax numbers manually.");
    }
  },

  async getHealthImprovementTips(profile: UserProfileData) {
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
                "Return JSON only in the shape {\"tips\":[...]}",
                "Give exactly 3 short, specific money-health improvement actions for this user.",
                "Use the user's exact numbers where useful.",
                "Keep each tip under 26 words.",
                "Focus on the weakest health-score areas first.",
              ].join(" "),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 220,
        responseMimeType: "application/json",
      },
    });
    const rawText = extractCandidateText(data);

    if (!rawText) {
      throw new Error(data.error?.message ?? "Gemini returned empty health tips.");
    }

    try {
      const parsed = JSON.parse(stripJsonFence(rawText)) as Partial<HealthTipResponse>;
      const tips = Array.isArray(parsed.tips) ? parsed.tips.filter((tip): tip is string => typeof tip === "string") : [];

      if (tips.length < 3) {
        throw new Error("Gemini returned fewer than three health tips.");
      }

      return tips.slice(0, 3);
    } catch (error) {
      console.warn("[GeminiService] Health tip parse failed", error);
      throw new Error("Unable to load AI improvement tips right now.");
    }
  },

  async getFutureYouNarrative(profile: UserProfileData, input: FutureYouNarrativeInput) {
    const scenarioSip = profile.monthlySIP * input.sipMultiplier;
    const passiveIncome = getMonthlyPassiveIncome(input.projectedCorpus);

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
                "Explain this future-money scenario in exactly 2 short sentences.",
                "Stay under 70 words total.",
                "Be specific with the user's numbers and age.",
                "Avoid markdown bullets.",
                `Target age: ${input.targetAge}.`,
                `Current SIP: ${formatINR(profile.monthlySIP)}.`,
                `Scenario SIP: ${formatINR(scenarioSip)}.`,
                `Assumed CAGR: ${(input.cagr * 100).toFixed(1)}%.`,
                `Projected corpus: ${formatINR(input.projectedCorpus)}.`,
                `FIRE target: ${formatINR(input.fireTarget)}.`,
                `Estimated passive income at 4% rule: ${formatINR(passiveIncome)} per month.`,
              ].join(" "),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 160,
      },
    });
    const text = extractCandidateText(data);

    if (!text) {
      throw new Error(data.error?.message ?? "Gemini returned an empty Future You narrative.");
    }

    return text;
  },

  async getTaxBattleNarrative(profile: UserProfileData, input: TaxBattleNarrativeInput) {
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
                "Write exactly 2 short sentences about this tax comparison.",
                "Stay under 70 words total.",
                "Use the numbers provided and mention the winning regime.",
                "No markdown bullets.",
                `Annual salary: ${formatINR(input.annualIncome)}.`,
                `Old regime tax: ${formatINR(input.oldTax)}.`,
                `New regime tax: ${formatINR(input.newTax)}.`,
                `Winner: ${input.betterRegime} regime.`,
                `Tax saving: ${formatINR(input.taxSaving)}.`,
              ].join(" "),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 140,
      },
    });
    const text = extractCandidateText(data);

    if (!text) {
      throw new Error(data.error?.message ?? "Gemini returned an empty tax narrative.");
    }

    return text;
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
                "Return JSON only in the shape {\"immediate\":[],\"soon\":[],\"longTerm\":[]}.",
                "Give exactly 2 bullets in each section.",
                "The event is:",
                event,
                "Immediate means 0-30 days, soon means 1-6 months, longTerm means beyond that.",
                "Use the user's numbers where useful.",
                "Keep each bullet under 24 words.",
              ].join(" "),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 260,
        responseMimeType: "application/json",
      },
    });
    const rawText = extractCandidateText(data);

    if (!rawText) {
      throw new Error(data.error?.message ?? "Gemini returned empty life-event advice.");
    }

    try {
      const parsed = JSON.parse(stripJsonFence(rawText)) as Partial<LifeEventAdviceResponse>;
      const normalize = (value: unknown) =>
        Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 2) : [];

      const immediate = normalize(parsed.immediate);
      const soon = normalize(parsed.soon);
      const longTerm = normalize(parsed.longTerm);

      if (immediate.length < 2 || soon.length < 2 || longTerm.length < 2) {
        throw new Error("Gemini returned incomplete life-event advice.");
      }

      return {
        immediate,
        soon,
        longTerm,
      } satisfies LifeEventAdvice;
    } catch (error) {
      console.warn("[GeminiService] Life event parse failed", error);
      throw new Error("Unable to load life-event advice right now.");
    }
  },

  scrubPII,
};
