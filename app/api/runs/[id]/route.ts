import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sb = getServerSupabase();
    const [run, responses, mentions] = await Promise.all([
      sb.from('runs').select('*').eq('id', params.id).maybeSingle(),
      sb.from('llm_responses').select('*').eq('run_id', params.id),
      sb.from('brand_mentions').select('*').eq('run_id', params.id),
    ]);
    if (run.error) throw run.error;
    return NextResponse.json({
      run: run.data,
      responses: responses.data ?? [],
      mentions: mentions.data ?? [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
