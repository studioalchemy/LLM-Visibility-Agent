import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ prompts: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = getServerSupabase();

    // Update existing prompt (toggle active)
    if (body.id) {
      const updates: any = {};
      if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
      if (typeof body.prompt_text === 'string') updates.prompt_text = body.prompt_text.trim();
      const { data, error } = await sb
        .from('prompts')
        .update(updates)
        .eq('id', body.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ prompt: data });
    }

    // Create
    const text = String(body.prompt_text ?? '').trim();
    if (!text) return NextResponse.json({ error: 'prompt_text required' }, { status: 400 });
    const { data, error } = await sb
      .from('prompts')
      .insert({ prompt_text: text, is_active: true })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ prompt: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const sb = getServerSupabase();
    const { error } = await sb.from('prompts').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
