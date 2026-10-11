/**
 * /api/admin/tickets  (staff) - daftar semua tiket + identitas pelapor (khusus moderator)
 * GET ?status=baru|diproses|selesai|ditolak|semua&q=<kode|judul|nis|nama>
 */
import 'server-only';
import { catatAudit, wajibStaff, serviceClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibStaff(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') || 'semua';
  const q = (sp.get('q') || '').trim();
  const db = serviceClient();

  let query = db
    .from('tickets')
    .select(
      `id, kode_tiket, kategori, judul, deskripsi, lokasi, kontak, status, priority,
       unread_admin, unread_reporter, created_at, updated_at, author_id,
       author:profiles!tickets_author_id_fkey(id, username, nama_lengkap, role, nis)`,
    )
    .order('created_at', { ascending: false })
    .limit(150);

  if (status !== 'semua') query = query.eq('status', status);
  if (q) {
    query = query.or(
      `kode_tiket.ilike.%${q}%,judul.ilike.%${q}%,author.nis.ilike.%${q}%,author.nama_lengkap.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    // filter relasi (`author.nis`) tidak didukung .or() di beberapa versi -> fallback
    let fallback = db
      .from('tickets')
      .select(
        `id, kode_tiket, kategori, judul, deskripsi, lokasi, kontak, status, priority,
         unread_admin, unread_reporter, created_at, updated_at, author_id,
         author:profiles!tickets_author_id_fkey(id, username, nama_lengkap, role, nis)`,
      )
      .order('created_at', { ascending: false })
      .limit(150);
    if (status !== 'semua') fallback = fallback.eq('status', status);
    const { data: d2, error: e2 } = await fallback;
    if (e2) return gagal(e2.message, 500);
    const tersaring = q
      ? (d2 || []).filter((t) =>
          [t.kode_tiket, t.judul, t.author?.nis, t.author?.nama_lengkap, t.author?.username]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q.toLowerCase())),
        )
      : d2 || [];
    return selesai(tersaring, db, ctx);
  }

  return selesai(data || [], db, ctx);
}

async function selesai(tickets, db, ctx) {
  const { data: semua } = await db.from('tickets').select('status');
  const jumlah = { baru: 0, diproses: 0, selesai: 0, ditolak: 0 };
  for (const t of semua || []) if (t.status in jumlah) jumlah[t.status] += 1;

  // nolkan penanda "belum dibaca admin" untuk tiket yang ditampilkan
  const ids = tickets.filter((t) => t.unread_admin > 0).map((t) => t.id);
  if (ids.length) await db.from('tickets').update({ unread_admin: 0 }).in('id', ids);

  await catatAudit(ctx.profil.id, 'admin.view_tickets', null, { jumlah: tickets.length });

  return ok({ tickets, jumlah });
}
