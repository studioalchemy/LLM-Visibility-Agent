import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getConfigRow() {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('agent_config')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET() {
  try {
    const config = await getConfigRow();
    return NextResponse.json({ config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = getServerSupabase();
    const current = await getConfigRow();
    if (!current) return NextResponse.json({ error: 'no config row' }, { status: 404 });

    const updates: any = { updated_at: new Date().toISOString() };
    if (typeof body.our_brand === 'string') updates.our_brand = body.our_brand.trim();
    if (typeof body.category === 'string') updates.category = body.category.trim();

    const { data, error } = await sb
      .from('agent_config')
      .update(updates)
      .eq('id', current.id)
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ config: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
