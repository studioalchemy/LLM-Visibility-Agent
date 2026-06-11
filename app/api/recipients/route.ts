import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  try {
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from('email_recipients')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ recipients: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }
    const sb = getServerSupabase();
    const { data, error } = await sb
      .from('email_recipients')
      .insert({ email })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ recipient: data });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const status = msg.includes('duplicate') || msg.includes('unique') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const sb = getServerSupabase();
    const { error } = await sb.from('email_recipients').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
