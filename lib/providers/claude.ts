import Anthropic from '@anthropic-ai/sdk';
import { MODELS, PROVIDER_TIMEOUT_MS, INSTRUCTION_WRAPPER } from './models';
import type { ProviderResult } from './types';

export async function askClaude(prompt: string): Promise<ProviderResult> {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { provider: 'claude', text: null, error: 'missing ANTHROPIC_API_KEY' };
    const client = new Anthropic({ apiKey: key, timeout: PROVIDER_TIMEOUT_MS });
    const res = await client.messages.create({
      model: MODELS.claude,
      max_tokens: 1024,
      messages: [{ role: 'user', content: INSTRUCTION_WRAPPER(prompt) }],
    });
    const text = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();
    return { provider: 'claude', text: text || null };
  } catch (e: any) {
    return { provider: 'claude', text: null, error: e?.message ?? String(e) };
  }
}
