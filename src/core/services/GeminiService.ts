import { AppConfig } from "../config";
import {
  LifeEventAdvice,
  LifeEventKey,
  TaxWizardSnapshot,
  UserProfileData,
  formatINR,
  getFinancialSnapshot,
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

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"] as const;
const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"] as const;
const warnedKeys = new Set<string>();
const featureCooldownUntil = new Map<string, number>();
const featurePreferGroqUntil = new Map<string, number>();
type ProviderUsed = "none" | "router" | "gemini" | "groq";
let lastProviderUsed: ProviderUsed = "none";

const FEATURE_COOLDOWN_MS = 60_000;
const FEATURE_PREFER_GROQ_MS = 5 * 60_000;

type RequestOptions = {
  feature?: string;
};

function warnOnce(key: string, message: string) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

function getFeatureKey(options?: RequestOptions): string {
  return options?.feature?.trim() || "general";
}

function isWithinWindow(until?: number): boolean {
  return typeof until === "number" && Date.now() < until;
}

function ensureFeatureNotCoolingDown(feature: string) {
  const until = featureCooldownUntil.get(feature);
  if (isWithinWindow(until)) {
    const remainingSec = Math.ceil(((until as number) - Date.now()) / 1000);
    throw new Error(`AI temporarily cooling down for '${feature}'. Please retry in ${remainingSec}s.`);
  }
}

function setFeatureCooldown(feature: string, durationMs = FEATURE_COOLDOWN_MS) {
  featureCooldownUntil.set(feature, Date.now() + durationMs);
}

function setPreferGroq(feature: string, durationMs = FEATURE_PREFER_GROQ_MS) {
  featurePreferGroqUntil.set(feature, Date.now() + durationMs);
}

function shouldPreferGroq(feature: string): boolean {
  return isWithinWindow(featurePreferGroqUntil.get(feature));
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function scrubPII(input: string): string {
  return input
    // Aadhaar — 12 digit and 16 digit VID format
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}(\s?\d{4})?\b/g, "[AADHAAR]")
    // PAN
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[PAN]")
    // IFSC
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, "[IFSC]")
    // Email addresses — before mobile so overlapping patterns don't conflict
    .replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, "[EMAIL]")
    // Indian mobile numbers with or without +91 prefix
    .replace(/(?:\+91[\s\-]?)?[6-9]\d{9}\b/g, "[MOBILE]")
    // Bank account numbers — tightened to 11-18 digits to reduce false positives
    // Excludes anything already caught above by requiring word boundaries
    .replace(/\b\d{11,18}\b/g, "[ACCOUNT]");
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

function decodeStreamChunk(value?: Uint8Array, decoder?: { decode: (input?: Uint8Array, options?: { stream?: boolean }) => string } | null): string {
  if (!value || value.length === 0) return "";
  if (decoder) {
    return decoder.decode(value, { stream: true });
  }
  // Expo Go + Hermes may not expose TextDecoder.
  let fallback = "";
  for (let i = 0; i < value.length; i += 1) {
    fallback += String.fromCharCode(value[i]);
  }
  return fallback;
}

function extractCandidateText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

async function ensureGeminiAccess() {
  const sessionState = await AuthService.ensureValidSession();

  if (!sessionState) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!AppConfig.isGeminiConfigured() && !AppConfig.isGroqConfigured()) {
    throw new Error("No AI API key configured. Add EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GROQ_API_KEY to .env.");
  }
}

// ─── Rate limiting ────────────────────────────────────────────────────────
// SECURITY NOTE: The Gemini & Groq API keys are currently embedded in the client
// bundle via EXPO_PUBLIC_GEMINI_API_KEY and EXPO_PUBLIC_GROQ_API_KEY. This is
// acceptable for hackathon demos but MUST be moved to a Supabase Edge Function
// or server proxy before any real-user deployment. Anyone who decompiles the
// APK can extract and abuse these keys.
//
// TODO before production:
// 1. Create a Supabase Edge Function that proxies Gemini/Groq calls
// 2. Remove API keys from .env
// 3. Call your Edge Function URL instead of APIs directly

const SESSION_REQUEST_LIMIT = 100;
let sessionRequestCount = 0;

// ─── Groq API Support ──────────────────────────────────────────────────────
// Groq provides faster inference and is used as fallback/primary LLM
interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

async function requestGroq(
  messages: GroqMessage[],
  systemPrompt: string
): Promise<string> {
  lastProviderUsed = "groq";
  let lastError: Error | null = null;

  for (const model of GROQ_MODELS) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AppConfig.groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 450,
        stream: false,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as GroqResponse;
      return data.choices?.[0]?.message?.content ?? "";
    }

    if (response.status === 401) {
      throw new Error("Groq API key is invalid. Check EXPO_PUBLIC_GROQ_API_KEY in .env.");
    }

    if (response.status === 404 || response.status === 400) {
      warnOnce(`groq-model-${model}-${response.status}`, `[GeminiService] Groq model '${model}' rejected request (${response.status}). Trying next model...`);
      lastError = new Error(`Groq request failed with status ${response.status}.`);
      continue;
    }

    if (response.status === 429) {
      warnOnce(`groq-rate-limited-${model}`, `[GeminiService] Groq model '${model}' is rate-limited (429). Trying next model...`);
      lastError = new Error("Groq API quota exceeded. Please wait and try again.");
      continue;
    }

    lastError = new Error(`Groq request failed with status ${response.status}.`);
    break;
  }

  throw lastError ?? new Error("Groq request failed.");
}

async function requestGroqStream(
  messages: GroqMessage[],
  systemPrompt: string,
  onChunk: (delta: string) => void
): Promise<void> {
  lastProviderUsed = "groq";
  let lastError: Error | null = null;

  for (const model of GROQ_MODELS) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AppConfig.groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 450,
        stream: true,
      }),
    });

    if (response.ok) {
      const reader = response.body?.getReader();
      const decoder = typeof globalThis.TextDecoder !== "undefined" ? new globalThis.TextDecoder() : null;

      if (!reader) {
        // Expo Go can return a successful response without a stream body.
        const text = await requestGroq(messages, systemPrompt);
        if (text) onChunk(text);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decodeStreamChunk(value, decoder);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          if (line === "data: [DONE]") break;
          try {
            const json = JSON.parse(line.slice(6)) as GroqResponse;
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) onChunk(delta);
          } catch {
            // partial JSON line — skip
          }
        }
      }
      return;
    }

    if (response.status === 401) {
      throw new Error("Groq API key is invalid. Check EXPO_PUBLIC_GROQ_API_KEY in .env.");
    }

    if (response.status === 404 || response.status === 400) {
      warnOnce(`groq-stream-model-${model}-${response.status}`, `[GeminiService] Groq stream model '${model}' rejected request (${response.status}). Trying next model...`);
      lastError = new Error(`Groq stream failed with status ${response.status}.`);
      continue;
    }

    if (response.status === 429) {
      warnOnce(`groq-stream-rate-limited-${model}`, `[GeminiService] Groq stream model '${model}' is rate-limited (429). Trying next model...`);
      lastError = new Error("Groq API quota exceeded. Please wait and try again.");
      continue;
    }

    lastError = new Error(`Groq stream failed with status ${response.status}.`);
    break;
  }

  throw lastError ?? new Error("Groq stream failed.");
}

async function requestGemini(body: Record<string, unknown>, options?: RequestOptions) {
  await ensureGeminiAccess();
  const feature = getFeatureKey(options);
  ensureFeatureNotCoolingDown(feature);

  // Diagnostic logging
  const geminiConfigured = AppConfig.isGeminiConfigured();
  const groqConfigured = AppConfig.isGroqConfigured();
  
  if (!geminiConfigured && !groqConfigured) {
    console.error(
      "[GeminiService] API Configuration Status:",
      {
        geminiKey: AppConfig.geminiApiKey ? `${AppConfig.geminiApiKey.substring(0, 10)}...` : "NOT SET",
        groqKey: AppConfig.groqApiKey ? `${AppConfig.groqApiKey.substring(0, 10)}...` : "NOT SET",
        geminiConfigured,
        groqConfigured,
      }
    );
  }

  // Soft rate limit — prevents runaway API calls in a single session
  sessionRequestCount += 1;
  if (sessionRequestCount > SESSION_REQUEST_LIMIT) {
    throw new Error(
      `Session limit of ${SESSION_REQUEST_LIMIT} AI requests reached. Please restart the app to continue.`
    );
  }

  // Try Gemini first unless this feature is temporarily pinned to Groq.
  if (AppConfig.isGeminiConfigured() && !shouldPreferGroq(feature)) {
    lastProviderUsed = "gemini";
    for (const model of GEMINI_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${AppConfig.geminiApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }
        );

        if (response.ok) {
          lastProviderUsed = "gemini";
          return (await response.json()) as GeminiResponse;
        }

        if (response.status === 404) {
          warnOnce(`gemini-model-404-${model}`, `[GeminiService] Model '${model}' is unavailable (404). Trying next model...`);
          setPreferGroq(feature);
          continue;
        }

        if (response.status === 403) {
          throw new Error("Gemini API key is invalid or has been revoked. Please check your .env file.");
        }

        if (response.status === 429) {
          warnOnce("gemini-rate-limited", "[GeminiService] Gemini is rate-limited (429), using Groq fallback.");
          setPreferGroq(feature);
          break;
        }

        warnOnce(`gemini-error-${response.status}`, `[GeminiService] Gemini returned ${response.status}. Falling back to Groq.`);
        setPreferGroq(feature);
        break;
      } catch (error) {
        warnOnce("gemini-request-failed", `[GeminiService] Gemini request failed, using Groq fallback.`);
        setPreferGroq(feature);
        if (error instanceof Error && /invalid|revoked/i.test(error.message)) {
          throw error;
        }
      }
    }
  }

  // Fallback to Groq if Gemini fails or is not configured
  if (AppConfig.isGroqConfigured()) {
    const contents = (body.contents as Array<{ role: string; parts: Array<{ text: string }> }>) || [];
    const messages: GroqMessage[] = contents.map((msg) => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.parts.map((p) => p.text).join(""),
    }));
    const systemPrompt = (body.system_instruction as { parts: Array<{ text: string }> })?.parts?.[0]?.text || "";

    try {
      const text = await requestGroq(messages, systemPrompt);
      lastProviderUsed = "groq";
      return {
        candidates: [
          {
            content: {
              parts: [{ text }],
            },
          },
        ],
      } as GeminiResponse;
    } catch (error) {
      setFeatureCooldown(feature);
      throw error;
    }
  }

  throw new Error("Neither Gemini nor Groq API is configured.");
}

async function requestGeminiStream(
  body: Record<string, unknown>,
  onChunk: (delta: string) => void,
  options?: RequestOptions
): Promise<void> {
  await ensureGeminiAccess();
  const feature = getFeatureKey(options);
  ensureFeatureNotCoolingDown(feature);

  // Apply same session rate limit as requestGemini
  sessionRequestCount += 1;
  if (sessionRequestCount > SESSION_REQUEST_LIMIT) {
    throw new Error(
      `Session limit of ${SESSION_REQUEST_LIMIT} AI requests reached. Please restart the app to continue.`
    );
  }

  // Try Gemini first if configured, probing a small model fallback chain for 404 compatibility.
  if (AppConfig.isGeminiConfigured() && !shouldPreferGroq(feature)) {
    lastProviderUsed = "gemini";
    for (const model of GEMINI_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${AppConfig.geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        if (response.ok) {
          lastProviderUsed = "gemini";
          const reader = response.body?.getReader();
          const decoder = typeof globalThis.TextDecoder !== "undefined" ? new globalThis.TextDecoder() : null;

          if (!reader) {
            const nonStreamResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${AppConfig.geminiApiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }
            );

            if (!nonStreamResponse.ok) {
              throw new Error(`Gemini non-stream fallback failed with status ${nonStreamResponse.status}.`);
            }

            const data = (await nonStreamResponse.json()) as GeminiResponse;
            const text = extractCandidateText(data);
            if (text) onChunk(text);
            return;
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decodeStreamChunk(value, decoder);
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
          return;
        }

        if (response.status === 404) {
          warnOnce(`gemini-stream-model-404-${model}`, `[GeminiService] Stream model '${model}' is unavailable (404). Trying next model...`);
          setPreferGroq(feature);
          continue;
        }

        if (response.status === 429) {
          warnOnce("gemini-stream-rate-limited", "[GeminiService] Gemini stream is rate-limited (429), using Groq fallback.");
          setPreferGroq(feature);
          break;
        }

        warnOnce(`gemini-stream-error-${response.status}`, `[GeminiService] Gemini stream returned ${response.status}. Falling back to Groq.`);
        setPreferGroq(feature);
        break;
      } catch {
        warnOnce("gemini-stream-request-failed", "[GeminiService] Gemini stream request failed, using Groq fallback.");
        setPreferGroq(feature);
      }
    }
  }

  // Fallback to Groq if Gemini fails
  if (AppConfig.isGroqConfigured()) {
    const contents = (body.contents as Array<{ role: string; parts: Array<{ text: string }> }>) || [];
    const messages: GroqMessage[] = contents.map((msg) => ({
      role: msg.role === "model" ? "assistant" : "user",
      content: msg.parts.map((p) => p.text).join(""),
    }));
    const systemPrompt = (body.system_instruction as { parts: Array<{ text: string }> })?.parts?.[0]?.text || "";

    try {
      await requestGroqStream(messages, systemPrompt, onChunk);
      lastProviderUsed = "groq";
    } catch (error) {
      setFeatureCooldown(feature);
      throw error;
    }
    return;
  }

  throw new Error("Neither Gemini nor Groq streaming is available.");
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
    lastProviderUsed = "none";
  },

  getHistory() {
    return [...conversationHistory];
  },

  getLastProviderUsed(): ProviderUsed {
    return lastProviderUsed;
  },

  async sendMessage(message: string, profile: UserProfileData, history: ChatMessage[] = conversationHistory) {
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }
    const userMessage = this.createUserMessage(message);

    const localResponse = ChatRouter.routeMessage(message);
    if (localResponse) {
        lastProviderUsed = "router";
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
  
    }, { feature: "chat-message" });
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
    lastProviderUsed = "router";
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
    },
    { feature: "chat-stream" }
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
    const equityPct =
      (xray.categoryAllocation.large_cap ?? 0) +
      (xray.categoryAllocation.mid_cap ?? 0) +
      (xray.categoryAllocation.small_cap ?? 0) +
      (xray.categoryAllocation.elss ?? 0) +
      (xray.categoryAllocation.hybrid ?? 0);
    const debtPct = xray.categoryAllocation.debt ?? 0;
    const liquidPct = xray.categoryAllocation.liquid ?? 0;
    const elssPct = xray.categoryAllocation.elss ?? 0;
    const monthlyExpenses =
      profile.monthlyExpenses > 0 ? profile.monthlyExpenses : Math.max(0, profile.monthlyIncome * 0.5);
    const liquidAssets =
      profile.emergencyFund +
      (xray.totalValue * liquidPct) / 100 +
      ((xray.totalValue * debtPct) / 100) * 0.5;
    const emergencyMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
    const used80C = Math.min(150_000, Math.max(0, profile.annual80C + profile.annualPF));
    const remaining80C = Math.max(0, 150_000 - used80C);
    const ageGuideMaxEquity = profile.age > 0 ? Math.max(100 - profile.age, 30) : null;
    const goalsSummary = profile.goals.length > 0 ? profile.goals.map((goal) => `- ${goal}`).join("\n") : "- No explicit goals provided";
    const holdingsSummary = xray.holdings
      .map((holding) => `- ${holding.name} (${formatINR(holding.currentValue)} in ${holding.category})`)
      .join("\n");
    const overlapSummary = xray.overlapPairs.length > 0
      ? xray.overlapPairs.map((pair) => `${pair.fund1} & ${pair.fund2} (${pair.overlapLevel})`).join(", ")
      : "None";

    const contextBlock = [
      "Write exactly 3 distinct, actionable bullet points for a personalized mutual fund rebalancing plan.",
      "Stay under 150 words total. Do NOT use markdown bolding or bullet asterisks. Use only '1. ', '2. ', '3. '.",
      "Keep each point concrete and fund-level where possible.",
      "",
      "USER CONTEXT:",
      `Age: ${profile.age}`,
      `Risk profile: ${profile.riskProfile}`,
      `Monthly income: ${formatINR(profile.monthlyIncome)}`,
      `Monthly expenses: ${formatINR(monthlyExpenses)}`,
      `Tracked SIP: ${formatINR(profile.monthlySIP)}`,
      `Emergency fund (cash/liquid): ${formatINR(profile.emergencyFund)} (~${emergencyMonths.toFixed(1)} months including liquid/debt MF buffers)`,
      `80C used: ${formatINR(used80C)} / ${formatINR(150_000)} (remaining ${formatINR(remaining80C)})`,
      ageGuideMaxEquity !== null
        ? `Age-based equity guide max: ${ageGuideMaxEquity.toFixed(0)}%`
        : "Age-based equity guide max: unavailable",
      "",
      "GOALS:",
      goalsSummary,
      "",
      "PORTFOLIO STATE:",
      `Total value: ${formatINR(xray.totalValue)}`,
      `Overall XIRR: ${xray.overallXIRR !== null ? xray.overallXIRR.toFixed(1) + "%" : "unknown"}`,
      `Expense drag: ${formatINR(xray.expenseRatioDrag)}/yr`,
      `Allocation: Equity ${equityPct.toFixed(1)}%, Debt ${debtPct.toFixed(1)}%, Liquid ${liquidPct.toFixed(1)}%, ELSS ${elssPct.toFixed(1)}%`,
      `Overlap issues: ${overlapSummary}`,
      "Holdings:",
      holdingsSummary,
      "",
      "GENERATE 3 ACTIONS IN THIS ORDER:",
      "1. Overlap/concentration fix",
      "2. Risk + age + goals alignment change",
      "3. Cost or tax-efficiency optimization (80C/ELSS/direct plans)",
      "Be specific on what to reduce, hold, or increase.",
    ].join("\n");

    const data = await requestGemini({
      system_instruction: {
        parts: [{ text: buildSystemInstruction(profile) }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: contextBlock,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 260,
      },
    }, { feature: "portfolio-rebalancing" });

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
                 "Write exactly 4 short sentences summarizing this tax plan.",
                "Stay under 140 words total.",
                "Sentence 1: State the winning regime and tax saving amount.",
                "Sentence 2: Mention the biggest deduction gap the user should fill.",
                "Sentence 3: Give the strongest recommended next move with a specific rupee amount.",
                "Sentence 4: List 2-3 other exemptions NOT modeled in this tool that the user should discuss with a CA — choose from LTA, 80E education loan interest, 80G donations, gratuity exemption, meal allowance, children education allowance, 80DD disabled dependent. Keep it brief and end with 'Consult a CA to claim these.'",
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
    }, { feature: "tax-wizard-summary" });
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
    }, { feature: "joint-optimization" });

    const text = extractCandidateText(data);
    if (!text) throw new Error(data.error?.message ?? "Gemini returned an empty joint advice.");
    return text;
  },

  scrubPII,
};
export { requestGemini };
