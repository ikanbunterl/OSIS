/**
 * /api/admin/reports  (staff) - daftar laporan konten untuk halaman moderasi.
 * Dipisah dari /api/reports supaya URL-nya konsisten dengan menu admin lainnya.
 *
 * GET ?status=open|reviewed|resolved|rejected|semua
 */
import 'server-only';
import { wajibStaff, serviceClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibStaff(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const status = new URL(req.url).searchParams.get('status') || 'open';
  const db = serviceClient();

  let q = db
    .from('reports')
    .select(
      `id, target_type, target_id, reason, detail, status, created_at, handled_at,
       reporter:profiles!reports_reporter_id_fkey(id, username, nama_lengkap, role, nis),
       handler:profiles!reports_handled_by_fkey(id, username, role)`,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'semua') q = q.eq('status', status);
  const { data: reports, error } = await q;
  if (error) return gagal(error.message, 500);

  const kelompok = { post: [], comment: [], chat: [], profile: [], ticket: [] };
  for (const r of reports || []) kelompok[r.target_type]?.push(r.target_id);

  const ambil = async (tabel, kolom, ids) =>
    ids.length ? (await db.from(tabel).select(kolom).in('id', ids)).data || [] : [];

  const [posts, comments, chats, profiles, tickets] = await Promise.all([
    ambil('posts', 'id, title, content, status, is_anonymous, created_at, channel_id, author_id, like_count, comment_count', kelompok.post),
    ambil('comments', 'id, content, post_id, is_anonymous, author_id, created_at', kelompok.comment),
    ambil('chat_messages', 'id, content, room_id, author_id, created_at, deleted_at', kelompok.chat),
    ambil('profiles', 'id, username, nama_lengkap, bio, avatar_url, role, nis, banned_until, muted_until', kelompok.profile),
    ambil('tickets', 'id, kode_tiket, judul, kategori, status, author_id', kelompok.ticket),
  ]);

  // identitas penulis konten anonim (khusus moderator)
  const authorIds = [
    ...posts.map((p) => p.author_id),
    ...comments.map((c) => c.author_id),
    ...chats.map((c) => c.author_id),
  ].filter(Boolean);
  const authors = authorIds.length
    ? (
        await db
          .from('profiles')
          .select('id, username, nama_lengkap, nis, role, avatar_url, banned_until, muted_until')
          .in('id', [...new Set(authorIds)])
      ).data || []
    : [];
  const petaAuthor = Object.fromEntries(authors.map((a) => [a.id, a]));

  const targets = {};
  for (const p of posts) targets[p.id] = { jenis: 'post', ...p, author: petaAuthor[p.author_id] || null };
  for (const c of comments) targets[c.id] = { jenis: 'comment', ...c, author: petaAuthor[c.author_id] || null };
  for (const c of chats) targets[c.id] = { jenis: 'chat', ...c, author: petaAuthor[c.author_id] || null };
  for (const p of profiles) targets[p.id] = { jenis: 'profile', ...p, author_id: p.id };
  for (const t of tickets) targets[t.id] = { jenis: 'ticket', ...t, content: t.judul };

  const jumlah = {
    open: 0,
    reviewed: 0,
    resolved: 0,
    rejected: 0,
  };
  const { data: semua } = await db.from('reports').select('status');
  for (const r of semua || []) if (r.status in jumlah) jumlah[r.status] += 1;

  return ok({ reports: reports || [], targets, jumlah });
}
