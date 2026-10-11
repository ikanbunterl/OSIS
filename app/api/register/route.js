/**
 * POST /api/register
 * Registrasi siswa: NIS + Nama harus cocok dengan tabel `students`.
 *
 * Alur (lihat PLAN Bagian 5):
 *  1. rate limit per IP
 *  2. validasi format (Zod)
 *  3. prefix angkatan harus aktif di `academic_years`
 *  4. NIS harus ada & active di `students`
 *  5. nama harus cocok (longgar) dengan data sekolah
 *  6. NIS belum dipakai akun lain
 *  7. username bebas & tidak menyerupai akun resmi
 *  8. buat user Supabase Auth (email = <nis>@siswa.local)
 *  9. buat baris `profiles` (verified_at = now()) + audit log
 */
import 'server-only';
import { catatAudit, serviceClient } from '@/lib/supabase/server';
import { rateLimit, ipKlien, detik } from '@/lib/rate-limit';
import { gagal, gagalValidasi, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { registerSchema, namaCocok, nisKeEmail, extractPrefix } from '@/lib/validators';
import { cekImpersonasi, normUsername } from '@/lib/censor';
import { PESAN } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  // dipakai halaman /register untuk tahu prefix angkatan mana yang sedang dibuka
  const db = serviceClient();
  const { data, error } = await db
    .from('academic_years')
    .select('prefix, tahun_ajaran, active')
    .order('prefix', { ascending: true });
  if (error) return ok({ prefixes: [], message: error.message });
  return ok({ prefixes: data });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ip = ipKlien(req);

  const limit = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return gagal(
      `Terlalu banyak percobaan pendaftaran dari jaringan ini. Coba lagi dalam ${detik(limit.resetMs) / 60} menit.`,
      429,
      { retryAfter: detik(limit.resetMs) },
    );
  }

  const body = await bacaJson(req);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return gagalValidasi(parsed);

  const { nis, nama, username, password } = parsed.data;
  const uname = normUsername(username);
  const db = serviceClient();

  // --- 3. prefix angkatan aktif? -------------------------------------------
  const prefix = extractPrefix(nis);
  const { data: ay } = await db
    .from('academic_years')
    .select('prefix, active')
    .eq('prefix', prefix)
    .maybeSingle();

  if (!ay) {
    return gagal(PESAN.nisTakTerdaftar, 404, { kode: 'NIS_TAK_TERDAFTAR', field: 'nis' });
  }
  if (!ay.active) {
    return gagal(PESAN.prefixNonaktif, 403, { kode: 'PREFIX_NONAKTIF', field: 'nis' });
  }

  // --- 4. NIS ada di data sekolah & aktif? ---------------------------------
  const { data: siswa, error: eSiswa } = await db
    .from('students')
    .select('nis, nama, kelas, angkatan, active')
    .eq('nis', nis)
    .maybeSingle();

  if (eSiswa) return gagal(PESAN.serverError, 500, { detail: eSiswa.message });
  if (!siswa) {
    return gagal(PESAN.nisTakTerdaftar, 404, { kode: 'NIS_TAK_TERDAFTAR', field: 'nis' });
  }
  if (!siswa.active) {
    return gagal(PESAN.nisNonaktif, 403, { kode: 'NIS_NONAKTIF', field: 'nis' });
  }

  // --- 5. nama cocok? -------------------------------------------------------
  if (!namaCocok(nama, siswa.nama)) {
    return gagal(PESAN.namaTakCocok, 400, {
      kode: 'NAMA_TIDAK_COCOK',
      field: 'nama',
      hint: `Data sekolah tercatat atas NIS ini. Periksa ejaan, singkatan, dan gelar.`,
    });
  }

  // --- 6. NIS sudah dipakai? ------------------------------------------------
  const { data: profilLama } = await db
    .from('profiles')
    .select('id, username')
    .eq('nis', nis)
    .maybeSingle();
  if (profilLama) {
    return gagal(PESAN.nisDipakai, 409, {
      kode: 'NIS_SUDAH_DIPAKAI',
      field: 'nis',
      username: profilLama.username,
    });
  }

  const email = nisKeEmail(nis);
  const { data: existing } = await db.auth.admin.getUserByEmail(email);
  if (existing?.user) {
    return gagal(PESAN.nisDipakai, 409, { kode: 'NIS_SUDAH_DIPAKAI', field: 'nis' });
  }

  // --- 7. username ----------------------------------------------------------
  const imp = cekImpersonasi(uname);
  if (!imp.ok) {
    return gagal(imp.alasan, 400, { kode: 'USERNAME_DICADANGKAN', field: 'username' });
  }
  const { data: unameLama } = await db
    .from('profiles')
    .select('id')
    .eq('username', uname)
    .maybeSingle();
  if (unameLama) {
    return gagal(PESAN.usernameDipakai, 409, { kode: 'USERNAME_DIPAKAI', field: 'username' });
  }
  // tolak username yang nyaris sama dengan akun resmi yang sudah ada
  const { data: akunResmi } = await db
    .from('profiles')
    .select('username')
    .in('role', ['osis', 'pembina', 'admin', 'super_admin'])
    .limit(100);
  const mirip = (akunResmi || []).some(
    (r) => normUsername(r.username) === uname || levenshtein(normUsername(r.username), uname) <= 1,
  );
  if (mirip) {
    return gagal('Username terlalu mirip dengan akun resmi sekolah. Pilih username lain.', 400, {
      kode: 'USERNAME_MIRIP_RESMI',
      field: 'username',
    });
  }

  // --- 8. buat auth user ----------------------------------------------------
  const { data: dibuat, error: eAuth } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // tidak ada inbox nyata untuk @siswa.local
    user_metadata: { nis, username: uname, nama, display_name: nama },
    app_metadata: { role: 'siswa', jenis: 'siswa' },
  });
  if (eAuth || !dibuat?.user) {
    return gagal(
      eAuth?.message?.includes('already') ? PESAN.nisDipakai : 'Gagal membuat akun. Coba lagi.',
      eAuth?.message?.includes('already') ? 409 : 500,
      { field: 'nis', detail: eAuth?.message },
    );
  }

  // --- 9. buat profil (verified otomatis karena NIS sudah dicek) ------------
  const { data: profil, error: eProfil } = await db.rpc('create_profile_for_new_user', {
    p_user_id: dibuat.user.id,
    p_username: uname,
    p_nama: nama,
    p_role: 'siswa',
  });

  if (eProfil) {
    // rollback: hapus auth user supaya NIS tidak "nyangkut"
    await db.auth.admin.deleteUser(dibuat.user.id);
    return gagal('Gagal membuat profil. Coba lagi atau hubungi admin OSIS.', 500, {
      detail: eProfil.message,
    });
  }

  await db
    .from('profiles')
    .update({ nis, nama_lengkap: siswa.nama, verified_at: new Date().toISOString() })
    .eq('id', dibuat.user.id);

  await catatAudit(dibuat.user.id, 'auth.register', dibuat.user.id, {
    nis,
    username: uname,
    kelas: siswa.kelas,
    angkatan: siswa.angkatan,
    profilId: profil?.id ?? null,
  });

  return ok(
    {
      message: 'Pendaftaran berhasil. Akunmu otomatis terverifikasi.',
      user: { id: dibuat.user.id, username: uname, nis, nama: siswa.nama, kelas: siswa.kelas },
    },
    201,
  );
}

function levenshtein(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
