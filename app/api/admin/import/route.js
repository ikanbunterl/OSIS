/**
 * /api/admin/import  (FASE B - import data siswa dari CSV/Excel)
 *
 * POST multipart/form-data:
 *   file     : CSV (atau .xlsx yang sudah di-save-as CSV / UTF-8)
 *   mode     : 'siswa' (default) | 'osis'
 *   timpa    : '1' -> NIS yang sudah ada di-UPDATE (default: ditolak)
 *
 * mode 'osis' (butuh admin): selain masuk ke `students`, tiap baris dibuatkan
 * akun + profil dengan role 'osis'. Kolom tambahan yang dibaca: username, password.
 * Kalau password kosong, dipakai password sementara yang dikembalikan di respons
 * (WAJIB dibagikan lewat jalur tertutup & segera diganti).
 *
 * GET -> template CSV + ringkasan syarat kolom
 */
import 'server-only';
import { catatAudit, konteksUser, wajibAdmin, serviceClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { parseCsv, toCsv } from '@/lib/utils';
import { simpanSiswa, validasiBarisSiswa } from '@/lib/import-csv';
import { cekImpersonasi, normUsername } from '@/lib/censor';
import { extractPrefix } from '@/lib/validators';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE = 2 * 1024 * 1024; // 2 MB teks = ± 40.000 baris, lebih dari cukup

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const db = serviceClient();
  const { data: prefixes } = await db.from('academic_years').select('prefix, tahun_ajaran, active').order('prefix');
  const { count: total } = await db.from('students').select('*', { count: 'exact', head: true });

  return ok({
    total,
    prefixes: prefixes || [],
    templateSiswa: toCsv(
      ['nis', 'nama', 'kelas', 'angkatan'],
      [
        { nis: '26270001', nama: 'Contoh Nama Siswa', kelas: 'X RPL 1', angkatan: '2627' },
        { nis: '26270002', nama: 'Contoh Nama Kedua', kelas: 'X TKJ 1', angkatan: '' },
      ],
    ),
    templateOsis: toCsv(
      ['nis', 'nama', 'kelas', 'angkatan', 'username', 'password'],
      [
        {
          nis: '24250001',
          nama: 'Ahmad Fauzan Ridwan',
          kelas: 'XII RPL 1',
          angkatan: '2425',
          username: 'fauzan.osis',
          password: '(kosongkan = dibuat password sementara)',
        },
      ],
    ),
    aturan: [
      'NIS wajib 8 digit angka, 4 digit pertama = prefix angkatan.',
      'Prefix harus terdaftar & aktif di tabel academic_years.',
      'NIS duplikat ditolak, kecuali mode "timpa" dicentang.',
      'Nama kosong ditolak.',
      'Kolom angkatan boleh kosong (otomatis diambil dari NIS).',
      'Excel: File -> Save As -> CSV UTF-8 (Comma delimited).',
    ],
  });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  let form;
  try {
    form = await req.formData();
  } catch {
    return gagal('Kirim file sebagai multipart/form-data.', 400);
  }

  const file = form.get('file');
  const mode = String(form.get('mode') || 'siswa').toLowerCase();
  const timpa = String(form.get('timpa') || '') === '1';

  if (!file || typeof file === 'string') return gagal('File CSV tidak ditemukan.', 400);
  if (file.size > MAX_FILE) return gagal(`File terlalu besar (maks ${MAX_FILE / 1024 / 1024} MB).`, 413);
  if (mode === 'osis' && !ctx.isAdmin) return gagal('Import akun OSIS hanya bisa dilakukan admin.', 403);

  let teks;
  try {
    teks = await file.text();
  } catch {
    return gagal('Gagal membaca file. Pastikan formatnya CSV/teks (bukan .xlsx mentah).', 400);
  }

  const csv = parseCsv(teks);
  if (!csv.header.length) return gagal('File kosong atau tidak terbaca sebagai CSV.', 400);

  const db = serviceClient();
  const { data: prefixes } = await db.from('academic_years').select('prefix, active');
  const { data: semua } = await db.from('students').select('nis');

  const hasil = validasiBarisSiswa({
    csv,
    prefixes: prefixes || [],
    nisSudahAda: (semua || []).map((s) => s.nis),
    timpaUpdate: timpa,
  });

  if (hasil.fatal) return gagal(hasil.fatal, 422, { total: hasil.total });
  if (!hasil.valid.length) {
    return gagal(
      `Tidak ada baris yang lolos validasi (${hasil.errors.length} baris ditolak).`,
      422,
      { errors: hasil.errors.slice(0, 50), total: hasil.total, diterima: 0 },
    );
  }

  // ---- tulis data siswa -----------------------------------------------------
  const simpan = await simpanSiswa(db, hasil.valid, {});
  if (simpan.error) {
    return gagal(`Gagal menyimpan ke database: ${simpan.error}`, 500, {
      errors: hasil.errors.slice(0, 50),
    });
  }

  // ---- mode OSIS: buat akun -------------------------------------------------
  let akunDibuat = [];
  let akunError = [];
  let passwordSementara = null;

  if (mode === 'osis') {
    const colUser = csv.header.indexOf('username');
    const colPass = csv.header.indexOf('password');
    const { data: profilAda } = await db.from('profiles').select('username, nis');
    const dipakai = new Set((profilAda || []).map((p) => normUsername(p.username)));
    const nisDipakai = new Set((profilAda || []).map((p) => p.nis).filter(Boolean));

    // baris CSV asli (untuk ambil username/password), dipetakan by NIS
    const colNis = csv.header.findIndex((h) => ['nis', 'nisn', 'nomor_induk'].includes(h));
    const mentah = new Map();
    csv.rows.forEach((r) => {
      const nis = String(r[colNis] ?? '').replace(/[^0-9]/g, '');
      if (nis) mentah.set(nis, r);
    });

    for (const row of hasil.valid) {
      const r = mentah.get(row.nis) || [];
      let uname = colUser >= 0 ? normUsername(r[colUser] || '') : '';
      if (!uname) uname = `osis.${row.nis}`;

      const masalah = [];
      const imp = cekImpersonasi(uname);
      // untuk akun OSIS resmi, kata "osis" justru diharapkan -> lewati cek impersonasi
      if (!imp.ok && !uname.startsWith('osis')) masalah.push(imp.alasan);
      if (dipakai.has(uname)) masalah.push(`Username "${uname}" sudah dipakai.`);
      if (nisDipakai.has(row.nis)) masalah.push(`NIS ${row.nis} sudah punya akun.`);

      if (masalah.length) {
        akunError.push({ nis: row.nis, nama: row.nama, username: uname, pesan: masalah.join(' ') });
        continue;
      }

      const pw =
        (colPass >= 0 && String(r[colPass] || '').trim().length >= 8
          ? String(r[colPass]).trim()
          : null) || `Td2-${row.nis}-Os!s`;
      if (!passwordSementara && !(colPass >= 0 && String(r[colPass] || '').trim().length >= 8)) {
        passwordSementara = `Td2-<NIS>-Os!s  (contoh: Td2-${row.nis}-Os!s)`;
      }

      const { data: dibuat, error: eAuth } = await db.auth.admin.createUser({
        email: `${row.nis}@siswa.local`,
        password: pw,
        email_confirm: true,
        user_metadata: { nis: row.nis, username: uname, nama: row.nama, display_name: row.nama },
        app_metadata: { role: 'osis', jenis: 'staff' },
      });
      if (eAuth || !dibuat?.user) {
        akunError.push({ nis: row.nis, nama: row.nama, username: uname, pesan: eAuth?.message || 'Gagal membuat auth user' });
        continue;
      }

      const { error: eProfil } = await db.rpc('create_profile_for_new_user', {
        p_user_id: dibuat.user.id,
        p_username: uname,
        p_nama: row.nama,
        p_role: 'osis',
      });
      if (eProfil) {
        await db.auth.admin.deleteUser(dibuat.user.id);
        akunError.push({ nis: row.nis, nama: row.nama, username: uname, pesan: eProfil.message });
        continue;
      }

      await db
        .from('profiles')
        .update({ nis: row.nis, nama_lengkap: row.nama, verified_at: new Date().toISOString() })
        .eq('id', dibuat.user.id);

      dipakai.add(uname);
      nisDipakai.add(row.nis);
      akunDibuat.push({
        nis: row.nis,
        nama: row.nama,
        username: uname,
        password: pw.startsWith('Td2-') ? pw : '(sesuai file CSV)',
      });
    }

    await catatAudit(ctx.profil.id, 'admin.import_osis', null, {
      dibuat: akunDibuat.length,
      gagal: akunError.length,
    });
  }

  await catatAudit(ctx.profil.id, 'admin.import_siswa', null, {
    file: file.name,
    total: hasil.total,
    inserted: simpan.inserted,
    updated: simpan.updated,
    ditolak: hasil.errors.length,
    mode,
  });

  return ok({
    message:
      mode === 'osis'
        ? `Import selesai: ${simpan.inserted} siswa baru, ${simpan.updated} diperbarui, ${akunDibuat.length} akun OSIS dibuat, ${akunError.length + hasil.errors.length} baris bermasalah.`
        : `Import selesai: ${simpan.inserted} siswa baru, ${simpan.updated} diperbarui, ${hasil.errors.length} baris ditolak.`,
    total: hasil.total,
    inserted: simpan.inserted,
    updated: simpan.updated,
    ditolak: hasil.errors.length,
    errors: hasil.errors.slice(0, 100),
    akunDibuat,
    akunError,
    passwordSementara,
    contohNis: hasil.valid.slice(0, 3).map((v) => `${v.nis} (${extractPrefix(v.nis)})`),
  });
}
