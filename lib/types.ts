export type AgentConfig = {
  id: string;
  is_active: boolean;
  frequency_days: number;
  our_brand: string;
  category: string;
  last_activated_at: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
};

export type Prompt = {
  id: string;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
};

export type Recipient = {
  id: string;
  email: string;
  created_at: string;
};

export type Provider = 'openai' | 'perplexity' | 'gemini' | 'claude';

export type ExtractedBrand = {
  brand_name: string;
  position: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  context_snippet: string;
};

export type PerProviderMetric = {
  provider: Provider;
  sov: number;
  our_avg_position: number | null;
  our_mentions: number;
  total_mentions: number;
};

export type CompetitorMetric = {
  brand: string;
  mentions: number;
  avg_position: number | null;
};

export type PromptResult = {
  prompt: string;
  byProvider: Record<Provider, { position: number | null; appeared: boolean }>;
};

export type RunSummary = {
  run_id: string;
  status: 'running' | 'completed' | 'failed';
  our_brand: string;
  overall_sov: number;
  prev_sov: number | null;
  our_avg_position: number | null;
  total_brands: number;
  total_mentions: number;
  per_provider: PerProviderMetric[];
  competitors: CompetitorMetric[];
  sentiment: { positive: number; neutral: number; negative: number };
  snippets: { brand: string; provider: Provider; sentiment: string; snippet: string }[];
  prompt_results: PromptResult[];
  delta_sov: number | null;
  errors: { provider: Provider; prompt: string; error: string }[];
  emailed_to: string[];
  started_at: string;
  completed_at: string | null;
};

export const PROVIDERS: Provider[] = ['openai', 'perplexity', 'gemini', 'claude'];
