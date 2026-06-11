export type ProviderResult = {
  provider: 'openai' | 'perplexity' | 'gemini' | 'claude';
  text: string | null;
  error?: string;
};
