/**
 * /api/reports
 * GET  (staff) -> daftar laporan masuk, lengkap dengan isi targetnya
 * POST (siswa) -> laporkan post/komentar/pesan chat/profil
 */
import 'server-only';
import { catatAudit, konteksUser, wajibStaff, serviceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { gagal, gagalValidasi, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { reportSchema } from '@/lib/validators';

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
       reporter:profiles!reports_reporter_id_fkey(username, nama_lengkap, role, nis),
       handler:profiles!reports_handled_by_fkey(username, role)`,
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'semua') q = q.eq('status', status);
  const { data: reports, error } = await q;
  if (error) return gagal(error.message, 500);

  // ambil isi target biar moderator tidak perlu klik ke mana-mana
  const ids = { post: [], comment: [], chat: [], profile: [], ticket: [] };
  for (const r of reports || []) {
    if (ids[r.target_type]) ids[r.target_type].push(r.target_id);
  }

  const [posts, comments, chats, profiles, tickets] = await Promise.all([
    ids.post.length
      ? db.from('posts').select('id, title, content, status, is_anonymous, created_at, channel_id, author_id').in('id', ids.post)
      : Promise.resolve({ data: [] }),
    ids.comment.length
      ? db.from('comments').select('id, content, post_id, is_anonymous, author_id, created_at').in('id', ids.comment)
      : Promise.resolve({ data: [] }),
    ids.chat.length
      ? db.from('chat_messages').select('id, content, room_id, author_id, created_at, deleted_at').in('id', ids.chat)
      : Promise.resolve({ data: [] }),
    ids.profile.length
      ? db.from('profiles').select('id, username, nama_lengkap, bio, avatar_url, role, nis').in('id', ids.profile)
      : Promise.resolve({ data: [] }),
    ids.ticket.length
      ? db.from('tickets').select('id, kode_tiket, judul, kategori, status').in('id', ids.ticket)
      : Promise.resolve({ data: [] }),
  ]);

  const petaTarget = {};
  for (const p of posts.data || []) petaTarget[p.id] = { jenis: 'post', ...p };
  for (const c of comments.data || []) petaTarget[c.id] = { jenis: 'comment', ...c };
  for (const c of chats.data || []) petaTarget[c.id] = { jenis: 'chat', ...c };
  for (const p of profiles.data || []) petaTarget[p.id] = { jenis: 'profile', ...p };
  for (const t of tickets.data || []) petaTarget[t.id] = { jenis: 'ticket', ...t };

  return ok({ reports: reports || [], targets: petaTarget });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);
  if (!ctx.terverifikasi) return gagal('Akunmu belum terverifikasi.', 403);

  const limit = rateLimit(`report:${ctx.profil.id}`, 10, 10 * 60 * 1000);
  if (!limit.ok) return gagal('Terlalu banyak laporan dikirim. Coba lagi nanti.', 429);

  const parsed = reportSchema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagalValidasi(parsed);

  const { target_type, target_id, reason, detail } = parsed.data;
  const db = serviceClient();

  // cegah laporan dobel untuk target yang sama dari orang yang sama
  const { data: duplikat } = await db
    .from('reports')
    .select('id, status')
    .eq('reporter_id', ctx.profil.id)
    .eq('target_id', target_id)
    .eq('status', 'open')
    .maybeSingle();
  if (duplikat) {
    return ok({ message: 'Kamu sudah melaporkan ini. Tim OSIS sedang meninjau.', duplikat: true });
  }

  // pastikan targetnya benar-benar ada
  const tabel = { post: 'posts', comment: 'comments', chat: 'chat_messages', profile: 'profiles', ticket: 'tickets' };
  const { data: target } = await db.from(tabel[target_type]).select('id').eq('id', target_id).maybeSingle();
  if (!target) return gagal('Konten yang dilaporkan sudah tidak ada.', 404);

  const { data: dibuat, error } = await db
    .from('reports')
    .insert({
      reporter_id: ctx.profil.id,
      target_type,
      target_id,
      reason,
      detail: detail ? detail.slice(0, 500) : null,
    })
    .select('id')
    .single();

  if (error) return gagal('Gagal mengirim laporan.', 500, { detail: error.message });

  await catatAudit(ctx.profil.id, 'report.create', dibuat.id, { target_type, target_id, reason });

  return ok({ message: 'Laporan terkirim. Terima kasih sudah menjaga komunitas tetap sehat.', id: dibuat.id }, 201);
}
