import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { MODELS } from './providers/models';
import type { ExtractedBrand } from './types';

const SYS_PROMPT = `You extract brand/product mentions from LLM answers.

Rules:
- Output JSON ONLY. No prose, no markdown fences.
- Schema: {"brands":[{"brand_name":string,"position":number,"sentiment":"positive"|"neutral"|"negative","context_snippet":string}]}
- "brand_name": the actual brand/product name as mentioned (e.g. "Britannia Bourbon", "Oreo").
- "position": 1-indexed order of appearance in the answer (first recommended = 1).
- "sentiment": tone the answer uses about that brand. Default to "neutral" if unsure.
- "context_snippet": a verbatim phrase from the answer describing the brand (≤25 words).
- Only include actual brand/product names that are recommended or named in the answer. Skip generic terms.
- If the answer lists the same brand twice, keep only the first occurrence.
- If no brands found, return {"brands":[]}.`;

function tryParseJson(s: string): any | null {
  if (!s) return null;
  let t = s.trim();
  // Strip code fences
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  // Find first { or [
  const start = t.search(/[\[{]/);
  if (start > 0) t = t.slice(start);
  try {
    return JSON.parse(t);
  } catch {
    // Try to truncate trailing junk by finding the last } or ]
    const lastClose = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (lastClose > 0) {
      try {
        return JSON.parse(t.slice(0, lastClose + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeBrands(raw: any): ExtractedBrand[] {
  if (!raw || !Array.isArray(raw.brands)) return [];
  const seen = new Set<string>();
  const out: ExtractedBrand[] = [];
  for (const b of raw.brands) {
    const brand_name = String(b?.brand_name ?? '').trim();
    if (!brand_name) continue;
    const norm = brand_name.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    const position = Number.isFinite(Number(b?.position)) ? Number(b.position) : out.length + 1;
    let sentiment = String(b?.sentiment ?? 'neutral').toLowerCase();
    if (!['positive', 'neutral', 'negative'].includes(sentiment)) sentiment = 'neutral';
    const context_snippet = String(b?.context_snippet ?? '').trim().slice(0, 240);
    out.push({
      brand_name,
      position,
      sentiment: sentiment as ExtractedBrand['sentiment'],
      context_snippet,
    });
  }
  // Re-rank by reported position, then by insertion order
  return out
    .map((b, i) => ({ ...b, _i: i }))
    .sort((a, b) => a.position - b.position || a._i - b._i)
    .map((b, i) => ({
      brand_name: b.brand_name,
      position: i + 1,
      sentiment: b.sentiment,
      context_snippet: b.context_snippet,
    }));
}

export async function extractBrands(answer: string): Promise<ExtractedBrand[]> {
  if (!answer || !answer.trim()) return [];

  const userMsg = `Answer to analyze:\n\n"""\n${answer.slice(0, 8000)}\n"""\n\nReturn the JSON now.`;

  // Prefer Claude if available, fallback to OpenAI.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await client.messages.create({
        model: MODELS.extractor,
        max_tokens: 1024,
        system: SYS_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      });
      const txt = res.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('\n');
      const parsed = tryParseJson(txt);
      const brands = sanitizeBrands(parsed);
      if (brands.length || parsed) return brands;
    } catch {
      // fall through to openai
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYS_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.1,
      });
      const txt = res.choices[0]?.message?.content ?? '';
      return sanitizeBrands(tryParseJson(txt));
    } catch {
      return [];
    }
  }

  return [];
}

export function normalizeBrand(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isOurBrandMatch(brand: string, ourBrand: string): boolean {
  if (!ourBrand) return false;
  const a = normalizeBrand(brand);
  const b = normalizeBrand(ourBrand);
  if (!a || !b) return false;
  if (a === b) return true;
  // Allow substring match on core tokens (e.g., "Britannia Bourbon" matches "Britannia").
  const tokens = b.split(' ').filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.some((t) => a.includes(t));
}
