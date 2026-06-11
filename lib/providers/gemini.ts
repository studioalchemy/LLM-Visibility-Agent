import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODELS, INSTRUCTION_WRAPPER } from './models';
import type { ProviderResult } from './types';

export async function askGemini(prompt: string): Promise<ProviderResult> {
  try {
    const key = process.env.GOOGLE_GEMINI_API_KEY;
    if (!key) return { provider: 'gemini', text: null, error: 'missing GOOGLE_GEMINI_API_KEY' };
    const genai = new GoogleGenerativeAI(key);
    const model = genai.getGenerativeModel({ model: MODELS.gemini });
    const res = await model.generateContent(INSTRUCTION_WRAPPER(prompt));
    const text = res.response?.text?.() ?? null;
    return { provider: 'gemini', text };
  } catch (e: any) {
    return { provider: 'gemini', text: null, error: e?.message ?? String(e) };
  }
}
