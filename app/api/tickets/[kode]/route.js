/**
 * /api/tickets/[kode]
 *  GET  -> lacak tiket. Bisa TANPA LOGIN (cukup tahu kode tiket) - di-rate-limit.
 *          Kalau login, akses penuh diberikan bila dia pemilik / staff.
 *  POST -> balas tiket. Boleh admin/staff, atau pemilik tiket (termasuk yang
 *          sedang tidak login, selama kodenya benar - kode = kredensial).
 */
import 'server-only';
import { catatAudit, konteksUser, serviceClient } from '@/lib/supabase/server';
import { rateLimit, ipKlien, detik } from '@/lib/rate-limit';
import { gagal, gagalValidasi, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { balasanTiketSchema } from '@/lib/validators';
import { censor } from '@/lib/censor';
import { kirimPush } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req, { params }) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const { kode } = await params;
  const ip = ipKlien(req);
  const db = serviceClient();

  const ctx = await konteksUser(req).catch(() => ({ ok: false }));
  // publik dibatasi: 20 permintaan / 10 menit / IP
  if (!ctx.ok || !ctx.staff) {
    const limit = rateLimit(`lacak:${ip}`, 20, 10 * 60 * 1000);
    if (!limit.ok) {
      return gagal(
        `Terlalu banyak pengecekan. Coba lagi dalam ${Math.ceil(detik(limit.resetMs) / 60)} menit.`,
        429,
      );
    }
  }

  const { data: ticket, error } = await db
    .from('tickets')
    .select(
      `id, kode_tiket, kategori, judul, deskripsi, kontak, lokasi, status, priority,
       author_id, created_at, updated_at, closed_at`,
    )
    .eq('kode_tiket', String(kode || '').toUpperCase())
    .maybeSingle();

  if (error) return gagal(error.message, 500);
  if (!ticket) return gagal('Kode tiket tidak ditemukan. Periksa lagi kodenya (contoh: LPR-7F3K9A).', 404);

  const staff = ctx.ok && ctx.staff;
  const pemilik = ctx.ok && ctx.profil.id === ticket.author_id;

  // pemilik & staff melihat data lengkap; publik hanya status + judul + timeline
  const tampil = {
    kode_tiket: ticket.kode_tiket,
    kategori: ticket.kategori,
    judul: ticket.judul,
    status: ticket.status,
    priority: ticket.priority,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    lokasi: pemilik || staff ? ticket.lokasi : null,
    kontak: pemilik || staff ? ticket.kontak : null,
    pelapor: staff ? ticket.author_id : null, // identitas pelapor HANYA untuk staff
  };

  const { data: messages } = await db
    .from('ticket_messages')
    .select('id, sender_id, is_admin, content, attachment, attachment_name, created_at')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true });

  const bisaBalas = staff || pemilik;

  // kalau pemilik/staff buka, nolkan penanda belum dibaca
  if (pemilik) await db.from('tickets').update({ unread_reporter: 0 }).eq('id', ticket.id);
  if (staff) await db.from('tickets').update({ unread_admin: 0 }).eq('id', ticket.id);

  // signed URL untuk lampiran (berlaku 10 menit) - hanya owner & staff
  const keluaran = [];
  for (const m of messages || []) {
    let url = null;
    if (m.attachment && (pemilik || staff)) {
      const { data: signed } = await db.storage
        .from('attachments')
        .createSignedUrl(m.attachment, 600);
      url = signed?.signedUrl || null;
    }
    keluaran.push({ ...m, attachment_url: url });
  }

  return ok({ ticket: tampil, messages: keluaran, bisaBalas, staff, pemilik });
}

export async function POST(req, { params }) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const { kode } = await params;
  const ip = ipKlien(req);
  const db = serviceClient();
  const ctx = await konteksUser(req).catch(() => ({ ok: false }));

  const { data: ticket } = await db
    .from('tickets')
    .select('id, kode_tiket, author_id, status')
    .eq('kode_tiket', String(kode || '').toUpperCase())
    .maybeSingle();
  if (!ticket) return gagal('Kode tiket tidak ditemukan.', 404);

  const staff = ctx.ok && ctx.staff;
  const pemilik = ctx.ok && ctx.profil.id === ticket.author_id;
  if (!staff && !pemilik) {
    return gagal(
      'Kamu harus login dengan akun pembuat laporan (atau admin) untuk membalas. ' +
        'Login dulu, lalu buka lagi kode tiket ini.',
      401,
    );
  }

  const limit = rateLimit(`balas-tiket:${staff ? ctx.profil.id : ticket.id}`, 10, 5 * 60 * 1000);
  if (!limit.ok) return gagal('Terlalu cepat mengirim balasan. Tunggu sebentar.', 429);
  void ip;

  const parsed = balasanTiketSchema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagalValidasi(parsed);

  const isi = censor(parsed.data.content).slice(0, 3000);
  const { data: msg, error } = await db
    .from('ticket_messages')
    .insert({
      ticket_id: ticket.id,
      sender_id: ctx.profil.id,
      is_admin: staff,
      content: isi,
      attachment: staff && parsed.data.attachment ? parsed.data.attachment : null,
      attachment_name: staff ? parsed.data.attachment_name || null : null,
    })
    .select('id, content, is_admin, created_at')
    .single();

  if (error) return gagal(error.message, 500);

  // notifikasi ke lawan bicara
  if (staff && ticket.author_id) {
    const { data: t } = await db
      .from('tickets')
      .select('id, kode_tiket, author_id, status')
      .eq('id', ticket.id)
      .single();
    kirimPush({
      userIds: [t.author_id],
      title: `Balasan laporan ${t.kode_tiket}`,
      body: isi.slice(0, 120),
      url: `/lapor/${t.kode_tiket}`,
      tag: `tiket-${t.id}`,
    }).catch(() => {});
  }

  await catatAudit(ctx.profil.id, staff ? 'ticket.admin_reply' : 'ticket.reply', ticket.id, {
    kode: ticket.kode_tiket,
  });

  return ok({ message: 'Balasan terkirim.', message_row: msg });
}
