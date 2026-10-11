/**
 * /api/admin/roles  (khusus admin/pembina/super_admin)
 * POST { user_id | nis | username, role }
 *
 * Mengubah role lewat auth.admin.updateUserById (app_metadata.role)
 * -> trigger `tg_sync_role_from_auth` menyalinnya ke profiles.role.
 * Ini cara yang benar supaya JWT user ikut membawa role terbaru.
 */
import 'server-only';
import { catatAudit, wajibAdmin, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';
import { ROLES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  user_id: z.string().uuid().optional(),
  nis: z.string().trim().regex(/^\d{8}$/).optional(),
  username: z.string().trim().toLowerCase().optional(),
  role: z.enum(['siswa', 'osis', 'pembina', 'admin', 'super_admin']),
}).refine((d) => d.user_id || d.nis || d.username, { message: 'Sebutkan user_id, nis, atau username' });

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibAdmin(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);
  const { user_id, nis, username, role } = parsed.data;

  const db = serviceClient();

  let profil = null;
  if (user_id) {
    const { data } = await db.from('profiles').select('*').eq('id', user_id).maybeSingle();
    profil = data;
  } else if (nis) {
    const { data } = await db.from('profiles').select('*').eq('nis', nis).maybeSingle();
    profil = data;
  } else if (username) {
    const { data } = await db.from('profiles').select('*').eq('username', username).maybeSingle();
    profil = data;
  }
  if (!profil) return gagal('Akun tidak ditemukan. Pastikan orangnya sudah mendaftar dulu.', 404);

  // super_admin hanya bisa diubah oleh super_admin
  if ((profil.role === 'super_admin' || role === 'super_admin') && ctx.profil.role !== 'super_admin') {
    return gagal('Hanya super_admin yang bisa mengubah level super_admin.', 403);
  }
  if (profil.id === ctx.profil.id && role !== ctx.profil.role) {
    return gagal('Kamu tidak bisa mengubah role akunmu sendiri dari sini.', 400);
  }

  const { error: eAuth } = await db.auth.admin.updateUserById(profil.id, {
    app_metadata: { role, jenis: role === 'siswa' ? 'siswa' : 'staff' },
  });
  if (eAuth) return gagal(`Gagal memperbarui auth: ${eAuth.message}`, 500);

  // sinkron langsung (jaga-jaga trigger belum terpasang / user belum pernah login)
  const { data: updated, error } = await db
    .from('profiles')
    .update({
      role,
      verified_at: profil.verified_at || new Date().toISOString(),
      banned_until: role === 'siswa' ? profil.banned_until : null,
    })
    .eq('id', profil.id)
    .select('id, username, nama_lengkap, role, nis, verified_at')
    .single();
  if (error) return gagal(error.message, 500);

  await catatAudit(ctx.profil.id, 'admin.role_change', profil.id, {
    dari: profil.role,
    ke: role,
    username: profil.username,
  });

  return ok({
    message: `@${updated.username} sekarang berperan sebagai ${ROLES[role]?.label || role}. ` +
      (role !== 'siswa' ? 'Minta yang bersangkutan login ulang agar badge-nya muncul.' : ''),
    profile: updated,
  });
}
