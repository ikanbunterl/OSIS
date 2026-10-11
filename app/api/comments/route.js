/**
 * /api/posts  - ambil banyak post sekaligus (dipakai detail komentar, dsb.)
 * /api/comments?post_id=  - daftar komentar sebuah post
 *
 * File ini khusus komentar; CRUD post ada di /api/posts/[id].
 */
import 'server-only';
import { konteksUser, serviceClient, serverClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { gagal, gagalValidasi, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { komentarSchema } from '@/lib/validators';
import { censor } from '@/lib/censor';
import { catatAudit } from '@/lib/supabase/server';
import { LIMITS, RATE_LIMITS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const sp = new URL(req.url).searchParams;
  const postId = sp.get('post_id');
  const limit = Math.min(Number(sp.get('limit') || 50), 100);
  if (!postId) return gagal('post_id wajib diisi.', 400);

  const ctx = await konteksUser(req).catch(() => ({ ok: false }));
  const db = ctx.ok ? serviceClient() : serverClient();

  const { data: post } = await db
    .from('posts')
    .select('id, status, channel_id, author_id, is_anonymous')
    .eq('id', postId)
    .maybeSingle();

  if (!post) return gagal('Post tidak ditemukan.', 404);
  if (post.status !== 'published' && !(ctx.ok && (ctx.staff || ctx.profil.id === post.author_id))) {
    return gagal('Post ini tidak tersedia.', 404);
  }

  const { data, error } = await db
    .from('comments')
    .select(`id, post_id, author_id, is_anonymous, content, created_at,
             author:profiles!comments_author_id_fkey(id, username, nama_lengkap, avatar_url, role, nis)`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return gagal(error.message, 500);
  return ok({ comments: data || [] });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);
  if (!ctx.terverifikasi) return gagal('Akunmu belum terverifikasi.', 403);
  if (ctx.dimute) return gagal('Kamu sedang dibisukan sementara, jadi belum bisa berkomentar.', 403);

  const limit = rateLimit(
    `komentar:${ctx.profil.id}`,
    RATE_LIMITS.komentarPer5Menit,
    5 * 60 * 1000,
  );
  if (!limit.ok) return gagal('Terlalu banyak komentar dalam 5 menit terakhir. Tunggu sebentar.', 429);

  const parsed = komentarSchema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagalValidasi(parsed);
  const { post_id, content, is_anonymous } = parsed.data;

  const db = serviceClient();
  const { data: post } = await db
    .from('posts')
    .select('id, status, is_anonymous, channel_id, channel:channels!posts_channel_id_fkey(force_anon)')
    .eq('id', post_id)
    .maybeSingle();

  if (!post || post.status === 'deleted') return gagal('Post tidak ditemukan.', 404);

  // kalau post-nya anonim (channel aspirasi), komentarnya ikut anonim
  const paksaAnonim = post.is_anonymous || post.channel?.force_anon;

  const { data, error } = await db
    .from('comments')
    .insert({
      post_id,
      author_id: ctx.profil.id,
      is_anonymous: paksaAnonim ? true : Boolean(is_anonymous),
      content: censor(content).slice(0, LIMITS.komentarKarakter),
    })
    .select(`id, post_id, author_id, is_anonymous, content, created_at,
             author:profiles!comments_author_id_fkey(id, username, nama_lengkap, avatar_url, role)`)
    .single();

  if (error) return gagal(error.message, 500);
  await catatAudit(ctx.profil.id, 'comment.create', data.id, { post_id, anonim: data.is_anonymous });

  return ok({ comment: data, message: 'Komentar terkirim.' }, 201);
}
