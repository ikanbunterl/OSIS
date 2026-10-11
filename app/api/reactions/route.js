/**
 * /api/reactions
 * POST   { post_id, type='upvote' }  -> toggle (pasang / lepas)
 * GET    ?post_ids=a,b,c             -> reaksi milik saya untuk post-post itu
 *
 * Lewat API (bukan langsung dari browser) supaya:
 *  - like_count di-update atomik oleh trigger tanpa race
 *  - bisa di-rate-limit
 *  - post anonim tetap aman (tidak bocor lewat RLS insert policy)
 */
import 'server-only';
import { konteksUser, serviceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  post_id: z.string().uuid(),
  type: z.enum(['like', 'upvote', 'love', 'support']).default('upvote'),
});

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);

  const ids = (new URL(req.url).searchParams.get('post_ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (!ids.length) return ok({ reaksi: {} });
  const { data, error } = await serviceClient()
    .from('reactions')
    .select('post_id, type')
    .eq('user_id', ctx.profil.id)
    .in('post_id', ids);

  if (error) return gagal(error.message, 500);
  const reaksi = {};
  for (const r of data || []) reaksi[r.post_id] = r.type;
  return ok({ reaksi });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);
  if (!ctx.terverifikasi) return gagal('Akunmu belum terverifikasi.', 403);

  const limit = rateLimit(`reaksi:${ctx.profil.id}`, 30, 60 * 1000);
  if (!limit.ok) return gagal('Terlalu cepat. Tunggu sebentar.', 429);

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);

  const { post_id, type } = parsed.data;
  const db = serviceClient();

  const { data: post } = await db
    .from('posts')
    .select('id, status')
    .eq('id', post_id)
    .maybeSingle();
  if (!post || post.status === 'deleted') return gagal('Post tidak ditemukan.', 404);

  const { data: ada } = await db
    .from('reactions')
    .select('id')
    .eq('post_id', post_id)
    .eq('user_id', ctx.profil.id)
    .eq('type', type)
    .maybeSingle();

  let aktif;
  if (ada) {
    const { error } = await db.from('reactions').delete().eq('id', ada.id);
    if (error) return gagal(error.message, 500);
    aktif = false;
  } else {
    const { error } = await db.from('reactions').insert({
      post_id,
      user_id: ctx.profil.id,
      type,
    });
    if (error) return gagal(error.message, 500);
    aktif = true;
  }

  const { data: hitung } = await db
    .from('posts')
    .select('like_count')
    .eq('id', post_id)
    .single();

  return ok({ aktif, like_count: hitung?.like_count ?? 0, type });
}
