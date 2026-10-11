/**
 * /api/feed?slug=osis|aspirasi|talent&limit=20&before=<iso>
 * GET publik: hanya post berstatus 'published' (dijamin juga oleh RLS).
 * Untuk staff, tambahkan header Authorization supaya ikut melihat hidden/pending.
 */
import 'server-only';
import { konteksUser, serviceClient, serverClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SELECT_POST = `
  id, channel_id, author_id, is_anonymous, title, content, media_urls, status,
  pinned, comment_count, like_count, created_at, updated_at,
  author:profiles!posts_author_id_fkey(id, username, nama_lengkap, avatar_url, role, nis),
  channel:channels!posts_channel_id_fkey(id, slug, name, type)
`;

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const sp = new URL(req.url).searchParams;
  const slug = sp.get('slug');
  const limit = Math.min(Number(sp.get('limit') || 20), 50);
  const before = sp.get('before');
  const semua = sp.get('semua') === '1';

  const ctx = await konteksUser(req).catch(() => ({ ok: false }));
  const db = ctx.ok ? serviceClient() : serverClient();

  let q = db.from('posts').select(SELECT_POST).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(limit);

  if (slug) {
    const { data: ch } = await db.from('channels').select('id').eq('slug', slug).maybeSingle();
    if (!ch) return ok({ posts: [], channel: null });
    q = q.eq('channel_id', ch.id);
    const { data: channel } = await db
      .from('channels')
      .select('id, slug, name, description, type, can_post, force_anon')
      .eq('id', ch.id)
      .single();
    if (before) q = q.lt('created_at', before);
    if (!semua || !ctx.staff) q = q.eq('status', 'published');
    const { data, error } = await q;
    if (error) return gagal(error.message, 500);
    return ok({ posts: data || [], channel });
  }

  if (before) q = q.lt('created_at', before);
  if (!semua || !ctx.staff) q = q.eq('status', 'published');
  const { data, error } = await q;
  if (error) return gagal(error.message, 500);
  return ok({ posts: data || [] });
}
