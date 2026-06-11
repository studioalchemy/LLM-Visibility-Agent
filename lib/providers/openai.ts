import OpenAI from 'openai';
import { MODELS, PROVIDER_TIMEOUT_MS, INSTRUCTION_WRAPPER } from './models';
import type { ProviderResult } from './types';

export async function askOpenAI(prompt: string): Promise<ProviderResult> {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { provider: 'openai', text: null, error: 'missing OPENAI_API_KEY' };
    const client = new OpenAI({ apiKey: key, timeout: PROVIDER_TIMEOUT_MS });
    const res = await client.chat.completions.create({
      model: MODELS.openai,
      messages: [{ role: 'user', content: INSTRUCTION_WRAPPER(prompt) }],
      temperature: 0.4,
    });
    const text = res.choices[0]?.message?.content ?? null;
    return { provider: 'openai', text };
  } catch (e: any) {
    return { provider: 'openai', text: null, error: e?.message ?? String(e) };
  }
}
