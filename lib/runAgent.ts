import { getServerSupabase } from './supabase';
import { loadConfig } from './config';
import { askOpenAI } from './providers/openai';
import { askPerplexity } from './providers/perplexity';
import { askGemini } from './providers/gemini';
import { askClaude } from './providers/claude';
import type { ProviderResult } from './providers/types';
import { extractBrands, normalizeBrand, isOurBrandMatch } from './extract';
import { aggregate, type MentionRow } from './metrics';
import { buildDocxReport } from './report';
import { sendReport, isEmailConfigured } from './email';
import type { Provider, RunSummary } from './types';

export type RunTrigger = 'manual' | 'scheduled';

async function askAllProviders(prompt: string): Promise<ProviderResult[]> {
  // Parallel per prompt; iterate prompts sequentially upstream.
  return Promise.all([
    askOpenAI(prompt),
    askPerplexity(prompt),
    askGemini(prompt),
    askClaude(prompt),
  ]);
}

async function loadPreviousSov(currentRunId: string): Promise<number | null> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from('runs')
    .select('our_brand_sov')
    .eq('status', 'completed')
    .neq('id', currentRunId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.our_brand_sov ?? null;
}

export async function runAgent(triggeredBy: RunTrigger): Promise<RunSummary> {
  const sb = getServerSupabase();
  const startedAt = new Date().toISOString();

  const cfg = await loadConfig();
  if (!cfg) throw new Error('agent_config row missing');

  // Load active prompts
  const { data: promptRows, error: pErr } = await sb
    .from('prompts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (pErr) throw pErr;
  const activePrompts = promptRows ?? [];

  if (activePrompts.length === 0) {
    throw new Error('no active prompts — add at least one prompt before running');
  }

  // Recipients
  const { data: recipientRows } = await sb.from('email_recipients').select('*');
  const recipients: string[] = (recipientRows ?? []).map((r: any) => r.email);

  // Create run row
  const { data: runRow, error: rErr } = await sb
    .from('runs')
    .insert({ triggered_by: triggeredBy, status: 'running' })
    .select('*')
    .single();
  if (rErr) throw rErr;
  const runId = runRow.id as string;

  const errors: { provider: Provider; prompt: string; error: string }[] = [];
  const mentions: MentionRow[] = [];
  const promptsAsked: string[] = [];

  try {
    for (const p of activePrompts) {
      const promptText = p.prompt_text;
      promptsAsked.push(promptText);

      const results = await askAllProviders(promptText);

      for (const r of results) {
        // Store llm_responses row
        const { data: respRow, error: respErr } = await sb
          .from('llm_responses')
          .insert({
            run_id: runId,
            prompt_id: p.id,
            prompt_text: promptText,
            provider: r.provider,
            raw_response: r.text,
            error: r.error ?? null,
          })
          .select('id')
          .single();
        if (respErr) throw respErr;
        const responseId = respRow.id as string;

        if (r.error || !r.text) {
          errors.push({
            provider: r.provider as Provider,
            prompt: promptText,
            error: r.error ?? 'empty response',
          });
          continue;
        }

        const extracted = await extractBrands(r.text);
        if (extracted.length === 0) continue;

        const toInsert = extracted.map((b) => {
          const normalized = normalizeBrand(b.brand_name);
          const isOur = isOurBrandMatch(b.brand_name, cfg.our_brand);
          mentions.push({
            provider: r.provider as Provider,
            prompt_text: promptText,
            brand_name: b.brand_name,
            brand_name_normalized: normalized,
            position: b.position,
            sentiment: b.sentiment,
            is_our_brand: isOur,
            context_snippet: b.context_snippet,
          });
          return {
            run_id: runId,
            response_id: responseId,
            prompt_id: p.id,
            provider: r.provider,
            brand_name: b.brand_name,
            brand_name_normalized: normalized,
            position: b.position,
            sentiment: b.sentiment,
            is_our_brand: isOur,
            context_snippet: b.context_snippet,
          };
        });

        if (toInsert.length) {
          const { error: bmErr } = await sb.from('brand_mentions').insert(toInsert);
          if (bmErr) throw bmErr;
        }
      }
    }

    const prevSov = await loadPreviousSov(runId);
    const completedAt = new Date().toISOString();

    // Build summary first (without emailed_to)
    let summary = aggregate({
      mentions,
      promptsAsked,
      errors,
      ourBrand: cfg.our_brand,
      emailedTo: [],
      runId,
      status: 'completed',
      prevSov,
      startedAt,
      completedAt,
    });

    // Build .docx and email
    let emailedTo: string[] = [];
    try {
      const buffer = await buildDocxReport(summary, cfg);
      if (recipients.length > 0 && isEmailConfigured()) {
        const filename = `agent4-sov-${new Date()
          .toISOString()
          .slice(0, 10)}.docx`;
        await sendReport({
          buffer,
          filename,
          recipients,
          subject: `[Agent 4] LLM Share of Voice — ${cfg.our_brand || 'brand'} — ${new Date()
            .toISOString()
            .slice(0, 10)}`,
          summary,
        });
        emailedTo = recipients;
      }
    } catch (e: any) {
      errors.push({ provider: 'openai', prompt: '(email)', error: `report/email: ${e?.message ?? e}` });
    }

    summary = { ...summary, emailed_to: emailedTo, errors };

    // Persist run completion
    await sb
      .from('runs')
      .update({
        status: 'completed',
        completed_at: completedAt,
        our_brand_sov: summary.overall_sov,
        prev_our_brand_sov: prevSov,
        summary,
      })
      .eq('id', runId);

    return summary;
  } catch (e: any) {
    const errMsg = e?.message ?? String(e);
    await sb
      .from('runs')
      .update({ status: 'failed', completed_at: new Date().toISOString(), error: errMsg })
      .eq('id', runId);
    throw e;
  }
}
