/**
 * /api/admin/sanction  (staff untuk warn/mute, admin untuk suspend/ban)
 * POST { user_id, action, reason, days? }
 *   action: 'warn' | 'mute' | 'suspend' | 'ban' | 'unban' | 'unmute'
 *
 * Efek:
 *   warn    -> hanya tercatat (audit + moderation_actions)
 *   mute    -> muted_until  = now + hours  (default 24 jam)
 *   suspend -> banned_until = now + days   (default 7 hari)
 *   ban     -> banned_until = now + 100 tahun (permanen)
 *   unban/unmute -> dibersihkan
 */
import 'server-only';
import { catatAudit, konteksUser, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  user_id: z.string().uuid(),
  action: z.enum(['warn', 'mute', 'suspend', 'ban', 'unban', 'unmute']),
  reason: z.string().trim().min(3, 'Tulis alasan tindakan').max(300),
  hours: z.number().int().min(1).max(24 * 90).optional(),
  days: z.number().int().min(1).max(3650).optional(),
});

const BUTUH_ADMIN = new Set(['suspend', 'ban', 'unban']);

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);
  if (!ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);

  const { user_id, action, reason, hours, days } = parsed.data;
  if (BUTUH_ADMIN.has(action) && !ctx.isAdmin) {
    return gagal('Tindakan suspend/ban hanya bisa dilakukan admin atau pembina.', 403);
  }

  const db = serviceClient();
  const { data: target } = await db
    .from('profiles')
    .select('id, username, nama_lengkap, role, nis')
    .eq('id', user_id)
    .maybeSingle();
  if (!target) return gagal('User tidak ditemukan.', 404);

  // lindungi hierarki: staff tidak boleh menghukum admin/super_admin
  const urutan = { siswa: 0, osis: 1, pembina: 2, admin: 3, super_admin: 4 };
  if ((urutan[target.role] ?? 0) >= (urutan[ctx.profil.role] ?? 0)) {
    return gagal('Tidak bisa memberi sanksi ke akun dengan level sama/lebih tinggi.', 403);
  }

  const now = Date.now();
  const patch = {};
  let expires_at = null;

  if (action === 'mute') {
    const jam = hours || 24;
    expires_at = new Date(now + jam * 3600 * 1000).toISOString();
    patch.muted_until = expires_at;
  } else if (action === 'suspend') {
    const hari = days || 7;
    expires_at = new Date(now + hari * 86400 * 1000).toISOString();
    patch.banned_until = expires_at;
  } else if (action === 'ban') {
    expires_at = new Date(now + 100 * 365 * 86400 * 1000).toISOString();
    patch.banned_until = expires_at;
  } else if (action === 'unban') {
    patch.banned_until = null;
    patch.muted_until = null;
  } else if (action === 'unmute') {
    patch.muted_until = null;
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from('profiles').update(patch).eq('id', user_id);
    if (error) return gagal(error.message, 500);
  }

  const { error: eAct } = await db.from('moderation_actions').insert({
    admin_id: ctx.profil.id,
    target_user: user_id,
    action,
    reason,
    expires_at,
  });
  if (eAct) return gagal(eAct.message, 500);

  await catatAudit(ctx.profil.id, `sanction.${action}`, user_id, {
    username: target.username,
    reason,
    expires_at,
  });

  const label = {
    warn: 'Peringatan tercatat',
    mute: `User dibisukan ${hours || 24} jam`,
    suspend: `User disuspend ${days || 7} hari`,
    ban: 'User diblokir permanen',
    unban: 'Blokir dicabut',
    unmute: 'Bisukan dicabut',
  }[action];

  return ok({ message: `${label}: @${target.username}`, target });
}
