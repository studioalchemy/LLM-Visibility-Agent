import type { Provider, RunSummary, PerProviderMetric, CompetitorMetric, PromptResult } from './types';
import { PROVIDERS } from './types';

export type MentionRow = {
  provider: Provider;
  prompt_text: string;
  brand_name: string;
  brand_name_normalized: string;
  position: number | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  is_our_brand: boolean;
  context_snippet: string;
};

export type AggregateInput = {
  mentions: MentionRow[];
  promptsAsked: string[];
  errors: { provider: Provider; prompt: string; error: string }[];
  ourBrand: string;
  emailedTo: string[];
  runId: string;
  status: 'completed' | 'failed';
  prevSov: number | null;
  startedAt: string;
  completedAt: string | null;
};

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function aggregate(input: AggregateInput): RunSummary {
  const { mentions, promptsAsked, errors, ourBrand, emailedTo, runId, status, prevSov } = input;

  const totalMentions = mentions.length;
  const ourMentions = mentions.filter((m) => m.is_our_brand);
  const overall_sov = totalMentions === 0 ? 0 : ourMentions.length / totalMentions;
  const our_avg_position = avg(
    ourMentions.map((m) => m.position).filter((p): p is number => p != null),
  );

  // Per-provider
  const per_provider: PerProviderMetric[] = PROVIDERS.map((prov) => {
    const provMentions = mentions.filter((m) => m.provider === prov);
    const provOur = provMentions.filter((m) => m.is_our_brand);
    return {
      provider: prov,
      sov: provMentions.length === 0 ? 0 : provOur.length / provMentions.length,
      our_avg_position: avg(provOur.map((m) => m.position).filter((p): p is number => p != null)),
      our_mentions: provOur.length,
      total_mentions: provMentions.length,
    };
  });

  // Distinct brands (by normalized name)
  const brandSet = new Set(mentions.map((m) => m.brand_name_normalized));
  const total_brands = brandSet.size;

  // Competitors (top by mentions, excluding ours)
  const compMap = new Map<string, { brand: string; mentions: number; positions: number[] }>();
  for (const m of mentions) {
    if (m.is_our_brand) continue;
    const key = m.brand_name_normalized;
    if (!compMap.has(key)) {
      compMap.set(key, { brand: m.brand_name, mentions: 0, positions: [] });
    }
    const entry = compMap.get(key)!;
    entry.mentions += 1;
    if (m.position != null) entry.positions.push(m.position);
  }
  const competitors: CompetitorMetric[] = Array.from(compMap.values())
    .map((c) => ({
      brand: c.brand,
      mentions: c.mentions,
      avg_position: avg(c.positions),
    }))
    .sort((a, b) => b.mentions - a.mentions);

  // Sentiment for our brand
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const m of ourMentions) sentiment[m.sentiment] += 1;

  // Snippets — pick varied ones for our brand
  const snippets = ourMentions
    .filter((m) => m.context_snippet)
    .slice(0, 6)
    .map((m) => ({
      brand: m.brand_name,
      provider: m.provider,
      sentiment: m.sentiment,
      snippet: m.context_snippet,
    }));

  // Per-prompt × provider
  const prompt_results: PromptResult[] = promptsAsked.map((prompt) => {
    const byProvider = {} as PromptResult['byProvider'];
    for (const prov of PROVIDERS) {
      const hit = mentions.find(
        (m) => m.provider === prov && m.prompt_text === prompt && m.is_our_brand,
      );
      byProvider[prov] = {
        appeared: !!hit,
        position: hit?.position ?? null,
      };
    }
    return { prompt, byProvider };
  });

  const delta_sov = prevSov == null ? null : overall_sov - prevSov;

  return {
    run_id: runId,
    status,
    our_brand: ourBrand,
    overall_sov,
    prev_sov: prevSov,
    our_avg_position,
    total_brands,
    total_mentions: totalMentions,
    per_provider,
    competitors,
    sentiment,
    snippets,
    prompt_results,
    delta_sov,
    errors,
    emailed_to: emailedTo,
    started_at: input.startedAt,
    completed_at: input.completedAt,
  };
}
