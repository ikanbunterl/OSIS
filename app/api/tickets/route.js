/**
 * /api/tickets
 *  POST  -> buat tiket lapor (wajib login & terverifikasi). Balasan: kode tiket.
 *  GET   -> daftar tiket milik saya (auth) ATAU seluruh tiket (staff)
 */
import 'server-only';
import { catatAudit, konteksUser, serviceClient } from '@/lib/supabase/server';
import { rateLimit, ipKlien, detik } from '@/lib/rate-limit';
import { gagal, gagalValidasi, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { tiketSchema } from '@/lib/validators';
import { censor } from '@/lib/censor';
import { KATEGORI_LAPOR_MAP } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const db = serviceClient();

  let q = db
    .from('tickets')
    .select(
      `id, kode_tiket, kategori, judul, status, priority, unread_admin, unread_reporter,
       created_at, updated_at, author_id,
       author:profiles!tickets_author_id_fkey(username, nama_lengkap, role, nis)`,
    )
    .order('updated_at', { ascending: false })
    .limit(100);

  if (!ctx.staff) q = q.eq('author_id', ctx.profil.id);
  if (status && status !== 'semua') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return gagal(error.message, 500);
  return ok({ tickets: data || [] });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ip = ipKlien(req);
  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);
  if (!ctx.terverifikasi) return gagal('Akunmu belum terverifikasi.', 403);

  // 1 tiket / 10 menit / akun  (+ per IP utk nahan akun ganda)
  const l1 = rateLimit(`tiket:${ctx.profil.id}`, 1, 10 * 60 * 1000);
  if (!l1.ok) {
    return gagal(
      `Kamu baru saja membuat laporan. Tunggu ${Math.ceil(detik(l1.resetMs) / 60)} menit lagi supaya tidak dobel.`,
      429,
      { retryAfter: detik(l1.resetMs), kode: 'RATE_LIMIT' },
    );
  }
  const l2 = rateLimit(`tiket-ip:${ip}`, 3, 10 * 60 * 1000);
  if (!l2.ok) return gagal('Terlalu banyak laporan dari perangkat ini. Coba nanti.', 429);

  const parsed = tiketSchema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagalValidasi(parsed);

  const input = parsed.data;
  const kat = KATEGORI_LAPOR_MAP[input.kategori];
  const db = serviceClient();

  const { data: ticket, error } = await db
    .from('tickets')
    .insert({
      author_id: ctx.profil.id,
      kategori: input.kategori,
      judul: censor(input.judul).slice(0, 120),
      deskripsi: censor(input.deskripsi).slice(0, 3000),
      kontak: input.kontak ? censor(input.kontak).slice(0, 120) : null,
      lokasi: input.lokasi ? censor(input.lokasi).slice(0, 120) : null,
      priority: kat?.prioritasDefault || 'normal',
      status: 'baru',
    })
    .select('id, kode_tiket, kategori, judul, status, priority, created_at')
    .single();

  if (error || !ticket) {
    return gagal('Gagal membuat laporan. Coba lagi.', 500, { detail: error?.message });
  }

  // pesan pertama di timeline = deskripsi laporan
  await db.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_id: ctx.profil.id,
    is_admin: false,
    content: ticket.deskripsi || input.deskripsi,
  });

  // lampiran (sudah di-upload client ke bucket privat 'attachments')
  if (Array.isArray(input.lampiran) && input.lampiran.length) {
    const rows = input.lampiran.map((path, i) => ({
      ticket_id: ticket.id,
      sender_id: ctx.profil.id,
      is_admin: false,
      content: '📎 Lampiran bukti',
      attachment: path,
      attachment_name: input.lampiran_nama?.[i] || path.split('/').pop(),
    }));
    await db.from('ticket_messages').insert(rows);
  }

  await catatAudit(ctx.profil.id, 'ticket.create', ticket.id, {
    kode: ticket.kode_tiket,
    kategori: ticket.kategori,
    priority: ticket.priority,
    jumlahLampiran: input.lampiran?.length || 0,
  });

  return ok(
    {
      message: 'Laporan terkirim. Simpan kode tiket ini untuk melacak statusnya.',
      ticket,
      kode_tiket: ticket.kode_tiket,
    },
    201,
  );
}
