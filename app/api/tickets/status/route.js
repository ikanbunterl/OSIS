/**
 * /api/tickets/status  (khusus staff)
 * PATCH { kode_tiket | ticket_id, status?, priority? }
 */
import 'server-only';
import { catatAudit, wajibStaff, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  ticket_id: z.string().uuid().optional(),
  kode_tiket: z.string().trim().optional(),
  status: z.enum(['baru', 'diproses', 'selesai', 'ditolak']).optional(),
  priority: z.enum(['rendah', 'normal', 'tinggi']).optional(),
}).refine((d) => d.ticket_id || d.kode_tiket, { message: 'Tiket tidak dikenali' });

export async function PATCH(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibStaff(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) {
    return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);
  }
  const { ticket_id, kode_tiket, status, priority } = parsed.data;
  const db = serviceClient();

  const patch = {};
  if (status) patch.status = status;
  if (priority) patch.priority = priority;
  if (status === 'selesai' || status === 'ditolak') patch.closed_at = new Date().toISOString();
  if (status === 'baru' || status === 'diproses') patch.closed_at = null;
  if (!Object.keys(patch).length) return gagal('Tidak ada perubahan.', 400);

  let q = db.from('tickets').update(patch).select('id, kode_tiket, status, priority, author_id');
  q = ticket_id ? q.eq('id', ticket_id) : q.eq('kode_tiket', String(kode_tiket).toUpperCase());
  const { data, error } = await q.maybeSingle();

  if (error) return gagal(error.message, 500);
  if (!data) return gagal('Tiket tidak ditemukan.', 404);

  await catatAudit(ctx.profil.id, 'ticket.status_change', data.id, {
    kode: data.kode_tiket,
    ...patch,
  });

  return ok({ message: 'Status tiket diperbarui.', ticket: data });
}
