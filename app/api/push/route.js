/**
 * /api/push  (staff) - kirim notifikasi push ke siswa
 * POST { title, body, url?, target: 'semua' | 'osis' | 'siswa' | { userIds: [] } }
 */
import 'server-only';
import { kirimPush, pushSiap } from '@/lib/push';
import { catatAudit, wajibStaff, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(60),
  body: z.string().trim().min(3, 'Isi minimal 3 karakter').max(200),
  url: z.string().trim().max(200).optional(),
  target: z.enum(['semua', 'siswa', 'osis', 'staff']).default('semua'),
  userIds: z.array(z.string().uuid()).max(200).optional(),
});

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibStaff(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const limit = rateLimit(`push-kirim:${ctx.profil.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return gagal('Batas kirim notifikasi tercapai (10/jam).', 429);

  if (!pushSiap()) {
    return gagal(
      'Web Push belum aktif: isi NEXT_PUBLIC_VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY di .env.local ' +
        '(generate dengan `npm run vapid`), lalu deploy ulang.',
      501,
    );
  }

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);
  const { title, body, url, target, userIds } = parsed.data;

  const db = serviceClient();
  let ids = userIds;
  if (!ids?.length) {
    const roleMap = {
      semua: null,
      siswa: ['siswa'],
      osis: ['osis'],
      staff: ['osis', 'pembina', 'admin', 'super_admin'],
    };
    let q = db.from('profiles').select('id');
    const roles = roleMap[target];
    if (roles) q = q.in('role', roles);
    const { data } = await q;
    ids = (data || []).map((p) => p.id);
  }

  if (!ids.length) return gagal('Tidak ada penerima yang cocok.', 400);

  const hasil = await kirimPush({
    userIds: ids,
    title,
    body,
    url: url || '/home',
    tag: 'pengumuman',
  });

  await catatAudit(ctx.profil.id, 'push.broadcast', null, {
    title,
    target,
    penerima: ids.length,
    ...hasil,
  });

  return ok({
    message: `Notifikasi terkirim ke ${hasil.dikirim} perangkat (dari ${ids.length} target).` +
      (hasil.dilewati ? ` ${hasil.dilewati} gagal/tidak aktif.` : ''),
    ...hasil,
  });
}
