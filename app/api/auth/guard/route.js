/**
 * /api/auth/guard
 * GET -> status akun yang sedang login: masih aktif di data sekolah? di-ban? di-mute?
 *
 * Dipanggil halaman /login tepat setelah signInWithPassword, karena tabel
 * `students` hanya bisa dibaca staff (RLS) sehingga browser tidak bisa
 * mengecek `active` sendiri. Ini yang menjalankan "Fase C": admin menonaktifkan
 * NIS -> siswa tidak bisa login lagi, tapi riwayatnya tetap tersimpan.
 */
import 'server-only';
import { konteksUser, serviceClient } from '@/lib/supabase/server';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { gagal, ok } from '@/lib/api-helpers';
import { PESAN } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401, { kode: ctx.kode });

  const p = ctx.profil;
  const now = new Date();

  // 1. akun diblokir / dibisukan
  if (p.banned_until && new Date(p.banned_until) > now) {
    return ok({
      boleh: false,
      kode: 'DIBANNED',
      message: `${PESAN.dibanned} Sampai ${new Date(p.banned_until).toLocaleString('id-ID')}.`,
      sampai: p.banned_until,
    });
  }

  // 2. NIS dinonaktifkan oleh admin di data siswa
  if (p.nis) {
    const { data: siswa } = await serviceClient()
      .from('students')
      .select('nis, active, nama, kelas')
      .eq('nis', p.nis)
      .maybeSingle();

    if (siswa && siswa.active === false) {
      return ok({ boleh: false, kode: 'NIS_NONAKTIF', message: PESAN.nisNonaktif });
    }
    if (p.nis && !siswa) {
      // NIS dihapus total dari data siswa -> blokir juga, tapi beri pesan beda
      return ok({
        boleh: false,
        kode: 'NIS_TIDAK_DITEMUKAN',
        message: 'NIS kamu tidak lagi ada di data sekolah. Hubungi admin OSIS / wali kelas.',
      });
    }
  }

  // 3. belum terverifikasi (mis. dicabut admin)
  if (!p.verified_at) {
    return ok({
      boleh: true,
      peringatan: 'BELUM_TERVERIFIKASI',
      message: 'Akunmu belum terverifikasi. Beberapa fitur dibatasi sampai admin memverifikasi.',
    });
  }

  return ok({
    boleh: true,
    dimute: Boolean(p.muted_until && new Date(p.muted_until) > now),
    message: p.muted_until && new Date(p.muted_until) > now
      ? `Kamu sedang dibisukan sampai ${new Date(p.muted_until).toLocaleString('id-ID')}. Masih bisa membaca.`
      : 'Akun aktif.',
    akun: {
      id: p.id,
      username: p.username,
      nama_lengkap: p.nama_lengkap,
      role: p.role,
      verified_at: p.verified_at,
    },
  });
}
