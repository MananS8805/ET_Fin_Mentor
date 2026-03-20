import Tesseract from 'tesseract.js';
import { SalarySlipParseResult, Form16ParseResult, CAMSParseResult } from './GeminiService';

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
    
    // Basic heuristic parsing for OCR text
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
    
    // Form 16 specifically might have "Gross Salary" and "80C"
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

};
