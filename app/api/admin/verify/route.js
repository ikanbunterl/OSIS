/**
 * /api/admin/verify  (staff)
 * GET   ?q=        -> daftar akun: belum terverifikasi, anggota OSIS, diblokir
 * POST  { action }
 *   action: 'verify'      { nis }                     -> set verified_at (akun sudah ada)
 *   action: 'unverify'    { user_id }                 -> cabut verifikasi
 *   action: 'create_osis' { nis, username, password? } -> buatkan akun OSIS lengkap
 *   action: 'reset_password' { nis, password }        -> reset password akun siswa
 */
import 'server-only';
import { catatAudit, konteksUser, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';
import { cekImpersonasi, normUsername } from '@/lib/censor';
import { namaCocok } from '@/lib/validators';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify'), nis: z.string().trim().regex(/^\d{8}$/) }),
  z.object({ action: z.literal('unverify'), user_id: z.string().uuid() }),
  z.object({
    action: z.literal('create_osis'),
    nis: z.string().trim().regex(/^\d{8}$/, 'NIS 8 digit'),
    username: z.string().trim().toLowerCase().min(3).max(20),
    password: z.string().min(8, 'Password minimal 8 karakter').optional(),
    nama: z.string().trim().max(80).optional(),
  }),
  z.object({
    action: z.literal('reset_password'),
    nis: z.string().trim().regex(/^\d{8}$/),
    password: z.string().min(8, 'Password minimal 8 karakter').max(72),
  }),
]);

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  const db = serviceClient();

  const select = 'id, nis, username, nama_lengkap, role, verified_at, banned_until, muted_until, created_at';
  const [belum, osis, diblokir, siswaTanpaAkun] = await Promise.all([
    db.from('profiles').select(select).is('verified_at', null).order('created_at', { ascending: false }).limit(50),
    db.from('profiles').select(select).eq('role', 'osis').order('created_at').limit(100),
    db.from('profiles').select(select).not('banned_until', 'is', null).order('banned_until', { ascending: false }).limit(30),
    db.from('students').select('nis, nama, kelas, angkatan, active').eq('active', true).limit(500),
  ]);

  const nisPunyaAkun = new Set(
    [...(belum.data || []), ...(osis.data || []), ...(diblokir.data || [])]
      .map((p) => p.nis)
      .filter(Boolean),
  );
  // daftar NIS yang belum punya akun (perlu di-query penuh terpisah)
  const { data: semuaProfil } = await db.from('profiles').select('nis').not('nis', 'is', null);
  const sudah = new Set((semuaProfil || []).map((p) => p.nis));
  const belumDaftar = (siswaTanpaAkun.data || [])
    .filter((s) => !sudah.has(s.nis))
    .filter((s) => !q || s.nama.toLowerCase().includes(q.toLowerCase()) || s.nis.includes(q))
    .slice(0, 50);

  void nisPunyaAkun;

  const filterQ = (arr) =>
    !q
      ? arr
      : (arr || []).filter((p) =>
          [p.username, p.nama_lengkap, p.nis].some((v) => String(v || '').toLowerCase().includes(q.toLowerCase())),
        );

  return ok({
    belumTerverifikasi: filterQ(belum.data || []),
    anggotaOsis: filterQ(osis.data || []),
    diblokir: filterQ(diblokir.data || []),
    siswaBelumDaftar: belumDaftar,
    isAdmin: ctx.isAdmin,
  });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);
  const body = parsed.data;
  const db = serviceClient();

  /* ---- verify manual by NIS ---- */
  if (body.action === 'verify') {
    const { data: profil } = await db.from('profiles').select('id, username, nis, verified_at')
      .eq('nis', body.nis).maybeSingle();
    if (!profil) return gagal('Belum ada akun dengan NIS itu. Suruh yang bersangkutan daftar dulu, atau pakai "Buat akun OSIS".', 404);

    const { error } = await db.from('profiles')
      .update({ verified_at: new Date().toISOString() }).eq('id', profil.id);
    if (error) return gagal(error.message, 500);

    await catatAudit(ctx.profil.id, 'admin.verify_manual', profil.id, { nis: body.nis });
    return ok({ message: `Akun @${profil.username} diverifikasi manual.` });
  }

  /* ---- cabut verifikasi ---- */
  if (body.action === 'unverify') {
    if (!ctx.isAdmin) return gagal('Hanya admin yang bisa mencabut verifikasi.', 403);
    const { data, error } = await db.from('profiles')
      .update({ verified_at: null }).eq('id', body.user_id)
      .select('id, username').maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Akun tidak ditemukan.', 404);
    await catatAudit(ctx.profil.id, 'admin.unverify', data.id, {});
    return ok({ message: `Verifikasi @${data.username} dicabut.` });
  }

  /* ---- reset password siswa ---- */
  if (body.action === 'reset_password') {
    if (!ctx.isAdmin) return gagal('Hanya admin yang bisa mereset password.', 403);
    const { data: profil } = await db.from('profiles').select('id, username').eq('nis', body.nis).maybeSingle();
    if (!profil) return gagal('Akun dengan NIS itu tidak ditemukan.', 404);

    const { error } = await db.auth.admin.updateUserById(profil.id, { password: body.password });
    if (error) return gagal(error.message, 500);
    await catatAudit(ctx.profil.id, 'admin.reset_password', profil.id, { nis: body.nis });
    return ok({ message: `Password @${profil.username} direset. Sampaikan lewat jalur tertutup.` });
  }

  /* ---- buat akun OSIS ---- */
  if (body.action === 'create_osis') {
    if (!ctx.isAdmin) return gagal('Hanya admin/pembina yang bisa membuat akun OSIS.', 403);

    const uname = normUsername(body.username);
    const { data: siswa } = await db.from('students').select('nis, nama, kelas, active')
      .eq('nis', body.nis).maybeSingle();
    if (!siswa) return gagal('NIS tidak ada di data siswa. Import/tambahkan dulu datanya.', 404);
    if (!siswa.active) return gagal('Siswa ini berstatus nonaktif.', 400);

    const { data: sudahAda } = await db.from('profiles').select('id, username').eq('nis', body.nis).maybeSingle();
    if (sudahAda) {
      // akun sudah ada -> naikkan role jadi OSIS
      const { error } = await db.auth.admin.updateUserById(sudahAda.id, {
        app_metadata: { role: 'osis', jenis: 'staff' },
      });
      if (error) return gagal(error.message, 500);
      await db.from('profiles').update({ role: 'osis', verified_at: new Date().toISOString() }).eq('id', sudahAda.id);
      await catatAudit(ctx.profil.id, 'admin.promote_osis', sudahAda.id, { nis: body.nis });
      return ok({ message: `@${sudahAda.username} sudah punya akun - role dinaikkan jadi OSIS. Minta login ulang.` });
    }

    const { data: unameCek } = await db.from('profiles').select('id').eq('username', uname).maybeSingle();
    if (unameCek) return gagal(`Username "${uname}" sudah dipakai.`, 409);
    const imp = cekImpersonasi(uname);
    if (!imp.ok && !uname.startsWith('osis')) return gagal(imp.alasan, 400);

    if (body.nama && !namaCocok(body.nama, siswa.nama)) {
      return gagal('Nama tidak cocok dengan data sekolah. Kosongkan saja kolom nama.', 400);
    }

    const password = body.password || `Td2-${body.nis}-Os!s`;
    const { data: dibuat, error: eAuth } = await db.auth.admin.createUser({
      email: `${body.nis}@siswa.local`,
      password,
      email_confirm: true,
      user_metadata: { nis: body.nis, username: uname, nama: siswa.nama, display_name: siswa.nama },
      app_metadata: { role: 'osis', jenis: 'staff' },
    });
    if (eAuth || !dibuat?.user) return gagal(eAuth?.message || 'Gagal membuat akun.', 500);

    const { error: eProfil } = await db.rpc('create_profile_for_new_user', {
      p_user_id: dibuat.user.id,
      p_username: uname,
      p_nama: siswa.nama,
      p_role: 'osis',
    });
    if (eProfil) {
      await db.auth.admin.deleteUser(dibuat.user.id);
      return gagal(eProfil.message, 500);
    }

    await db.from('profiles')
      .update({ nis: body.nis, nama_lengkap: siswa.nama, verified_at: new Date().toISOString() })
      .eq('id', dibuat.user.id);

    await catatAudit(ctx.profil.id, 'admin.create_osis', dibuat.user.id, { nis: body.nis, username: uname });

    return ok({
      message: `Akun OSIS @${uname} dibuat untuk ${siswa.nama}.`,
      kredensial: {
        nis: body.nis,
        nama: siswa.nama,
        username: uname,
        password: body.password ? '(sesuai yang kamu isi)' : password,
        catatan: 'Login di /login pakai NIS + password. Wajib ganti password setelah login pertama.',
      },
    }, 201);
  }

  return gagal('Aksi tidak dikenali.', 400);
}
