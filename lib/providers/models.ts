// Centralized model IDs — update here when providers ship new defaults.
export const MODELS = {
  openai: 'gpt-4o-mini',
  perplexity: 'sonar',
  gemini: 'gemini-1.5-flash',
  claude: 'claude-haiku-4-5-20251001',
  // Used for structured brand extraction (separate from query model)
  extractor: 'claude-haiku-4-5-20251001',
} as const;

export const PROVIDER_TIMEOUT_MS = 45_000;

export const INSTRUCTION_WRAPPER = (prompt: string) =>
  `Answer as you normally would for a consumer. Give a concrete, ranked list of specific brands or products, in order of recommendation. Be specific (use brand names, not categories).\n\nQuestion: ${prompt}`;
