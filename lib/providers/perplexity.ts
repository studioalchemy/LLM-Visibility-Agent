import OpenAI from 'openai';
import { MODELS, PROVIDER_TIMEOUT_MS, INSTRUCTION_WRAPPER } from './models';
import type { ProviderResult } from './types';

export async function askPerplexity(prompt: string): Promise<ProviderResult> {
  try {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) return { provider: 'perplexity', text: null, error: 'missing PERPLEXITY_API_KEY' };
    const client = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.perplexity.ai',
      timeout: PROVIDER_TIMEOUT_MS,
    });
    const res = await client.chat.completions.create({
      model: MODELS.perplexity,
      messages: [{ role: 'user', content: INSTRUCTION_WRAPPER(prompt) }],
      temperature: 0.4,
    });
    const text = res.choices[0]?.message?.content ?? null;
    return { provider: 'perplexity', text };
  } catch (e: any) {
    return { provider: 'perplexity', text: null, error: e?.message ?? String(e) };
  }
}
