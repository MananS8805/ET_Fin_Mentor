import Tesseract from 'tesseract.js';
import { SalarySlipParseResult, Form16ParseResult, CAMSParseResult } from './GeminiService';
import { AppConfig } from '../config';

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

async function requestGeminiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  if (!AppConfig.isGeminiConfigured()) {
    throw new Error("Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY to .env.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${AppConfig.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini Vision request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("").trim() ?? "";
}

export const OCRService = {
  async extractText(imageBase64: string, mimeType: string): Promise<string> {
    try {
      const dataUri = `data:${mimeType};base64,${imageBase64}`;
      const { data } = await Tesseract.recognize(dataUri, 'eng');
      if (data.confidence < 60) {
        throw new Error("NOISY_DATA_MANUAL_ENTRY");
      }
      return data.text;
    } catch (error) {
      console.warn("[OCRService] Extraction failed", error);
      throw new Error("NOISY_DATA_MANUAL_ENTRY");
    }
  },

  async parseSalarySlip(imageBase64: string, mimeType: string): Promise<SalarySlipParseResult> {
    const text = await this.extractText(imageBase64, mimeType);
    const netPayMatch = text.match(/(?:net|take home)\s*(?:pay|salary|income)?\s*[rs\.]*\s*([\d,]+)/i);
    const grossPayMatch = text.match(/(?:gross)\s*(?:pay|salary|income)?\s*[rs\.]*\s*([\d,]+)/i);
    if (!netPayMatch && !grossPayMatch) {
      throw new Error("NOISY_DATA_MANUAL_ENTRY");
    }
    const cleanNum = (str: string) => parseInt(str.replace(/,/g, ''), 10);
    return {
      monthlyIncome: netPayMatch ? cleanNum(netPayMatch[1]) : (grossPayMatch ? cleanNum(grossPayMatch[1]) : null),
      notes: "Parsed via lightweight OCR"
    };
  },

  async parseForm16(imageBase64: string, mimeType: string): Promise<Form16ParseResult> {
    const text = await this.extractText(imageBase64, mimeType);
    const grossMatch = text.match(/gross\s*salary\s*.*?([\d,]+)/i);
    const taxMatch = text.match(/tax\s*payable\s*.*?([\d,]+)/i);
    if (!grossMatch) {
      throw new Error("NOISY_DATA_MANUAL_ENTRY");
    }
    const cleanNum = (str: string) => parseInt(str.replace(/,/g, ''), 10);
    return {
      annualIncome: cleanNum(grossMatch[1]),
      taxDeducted: taxMatch ? cleanNum(taxMatch[1]) : null,
      notes: "Parsed via lightweight OCR"
    };
  },

  async parseCAMS(imageBase64: string, mimeType: string): Promise<CAMSParseResult> {
    const prompt = `You are analyzing a CAMS or KFintech mutual fund consolidated account statement screenshot.

Extract all fund holdings visible in the image and return ONLY valid JSON — no markdown fences, no explanation, no preamble.

Return this exact structure:
{
  "holdings": [
    {
      "name": "Full scheme name as shown",
      "category": "large_cap | mid_cap | small_cap | elss | debt | hybrid | liquid | other",
      "units": 123.456,
      "nav": 45.67,
      "currentValue": 5678.90,
      "purchaseValue": 5000.00,
      "transactions": [
        { "date": "2023-01-15", "amount": 5000 }
      ]
    }
  ],
  "notes": "Brief description of what was found or any caveats"
}

Rules:
- category must be exactly one of: large_cap, mid_cap, small_cap, elss, debt, hybrid, liquid, other
- All numeric fields must be numbers, not strings
- dates must be "YYYY-MM-DD" format
- If a field is not visible in the image, use 0 for numbers and [] for transactions
- If no holdings are visible or the image is unclear, return { "holdings": [], "notes": "Could not extract holdings — please try a clearer screenshot" }
- Do NOT invent data — only extract what is visible`;

    let rawText: string;
    try {
      rawText = await requestGeminiVision(imageBase64, mimeType, prompt);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Unable to analyze the statement image. Please check your connection and try again."
      );
    }

    if (!rawText) {
      throw new Error("No response from Gemini. Please try again with a clearer image.");
    }

    // Strip any accidental markdown fences
    const cleaned = rawText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed: CAMSParseResult;
    try {
      parsed = JSON.parse(cleaned) as CAMSParseResult;
    } catch {
      console.warn("[OCRService] Gemini returned non-JSON for CAMS:", rawText.slice(0, 200));
      throw new Error(
        "The image was analyzed but the result could not be read. Try a clearer, full-screen screenshot of the statement summary page."
      );
    }

    if (!Array.isArray(parsed.holdings)) {
      throw new Error("Unexpected response format. Please try again.");
    }

    // Sanitize: ensure all numeric fields are actually numbers
    parsed.holdings = parsed.holdings.map((h) => ({
      ...h,
      units: Number(h.units) || 0,
      nav: Number(h.nav) || 0,
      currentValue: Number(h.currentValue) || 0,
      purchaseValue: Number(h.purchaseValue) || h.currentValue || 0,
      transactions: (h.transactions ?? []).map((t) => ({
        date: t.date,
        amount: Number(t.amount) || 0,
      })),
    }));

    return parsed;
  },
};