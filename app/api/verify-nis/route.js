/**
 * POST /api/verify-nis
 * Dipakai halaman /register untuk cek langsung: NIS ada? nama cocok?
 * Butuh NIS + nama lengkap, jadi tidak bisa dipakai menebak-nebak NIS saja.
 *
 * GET /api/verify-nis  -> daftar prefix angkatan yang sedang dibuka
 */
import 'server-only';
import { serviceClient } from '@/lib/supabase/server';
import { rateLimit, ipKlien, detik } from '@/lib/rate-limit';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';
import { namaCocok, extractPrefix, nisKeEmail } from '@/lib/validators';
import { PESAN, PREFIX_ANGKATAN_FALLBACK } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  nis: z.string().trim().regex(/^\d{8}$/, 'NIS harus 8 digit angka'),
  nama: z.string().trim().min(3, 'Tulis nama lengkapmu'),
});

export async function GET() {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const db = serviceClient();
  const { data, error } = await db.from('academic_years').select('prefix, tahun_ajaran, active');
  if (error) return ok({ prefixes: PREFIX_ANGKATAN_FALLBACK.map((p) => ({ prefix: p, active: true })) });
  return ok({ prefixes: data || [] });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ip = ipKlien(req);
  const limit = rateLimit(`verifynis:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) {
    return gagal(
      `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(detik(limit.resetMs) / 60)} menit.`,
      429,
      { kode: 'RATE_LIMIT' },
    );
  }

  const parsed = schema.safeParse(await bacaJson(req));
  if (!parsed.success) {
    const msg = parsed.error?.issues?.[0]?.message || 'Data tidak valid';
    return gagal(msg, 422, { field: parsed.error?.issues?.[0]?.path?.[0] });
  }

  const { nis, nama } = parsed.data;
  const db = serviceClient();
  const prefix = extractPrefix(nis);

  const { data: ay } = await db.from('academic_years').select('prefix, active, tahun_ajaran')
    .eq('prefix', prefix).maybeSingle();

  const { data: siswa } = await db.from('students')
    .select('nis, nama, kelas, angkatan, active')
    .eq('nis', nis).maybeSingle();

  const { data: profil } = await db.from('profiles').select('id, username')
    .eq('nis', nis).maybeSingle();

  const { data: authUser } = await db.auth.admin.getUserByEmail(nisKeEmail(nis));

  let tersedia = true;
  let kode = 'OK';
  let pesan = 'NIS cocok dengan data sekolah. Silakan lanjut mendaftar.';

  if (!ay) {
    tersedia = false;
    kode = 'NIS_TAK_TERDAFTAR';
    pesan = PESAN.nisTakTerdaftar;
  } else if (!ay.active) {
    tersedia = false;
    kode = 'PREFIX_NONAKTIF';
    pesan = PESAN.prefixNonaktif;
  } else if (!siswa) {
    tersedia = false;
    kode = 'NIS_TAK_TERDAFTAR';
    pesan = PESAN.nisTakTerdaftar;
  } else if (!siswa.active) {
    tersedia = false;
    kode = 'NIS_NONAKTIF';
    pesan = PESAN.nisNonaktif;
  } else if (profil || authUser?.user) {
    tersedia = false;
    kode = 'NIS_SUDAH_DIPAKAI';
    pesan = PESAN.nisDipakai;
  } else if (!namaCocok(nama, siswa.nama)) {
    tersedia = false;
    kode = 'NAMA_TIDAK_COCOK';
    pesan = PESAN.namaTakCocok;
  }

  return ok({
    tersedia,
    kode,
    message: pesan,
    // data dikembalikan HANYA jika cocok, supaya tidak jadi alat enumerasi NIS
    siswa: tersedia
      ? { kelas: siswa.kelas, angkatan: siswa.angkatan, tahun_ajaran: ay.tahun_ajaran }
      : null,
  });
}
