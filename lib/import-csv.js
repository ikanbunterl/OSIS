/**
 * Import siswa dari CSV/Excel (Fase B).
 * Semua validasi di sini supaya admin dapat laporan error per-baris yang jelas.
 *
 * Kolom yang dikenali (case-insensitive, boleh pakai alias):
 *   nis      | NIS | nomor_induk
 *   nama     | nama_lengkap | name
 *   kelas    | class | rombel
 *   angkatan | prefix | tahun (opsional; kalau kosong diambil dari 4 digit awal NIS)
 */
import 'server-only';
import { extractPrefix, normNama, REGEX_NIS } from './validators';

const ALIAS = {
  nis: ['nis', 'nisn', 'nomor_induk', 'nomorinduk', 'no_induk', 'induk'],
  nama: ['nama', 'nama_lengkap', 'namalengkap', 'name', 'nama_siswa'],
  kelas: ['kelas', 'class', 'rombel', 'rombongan_belajar', 'tingkat'],
  angkatan: ['angkatan', 'prefix', 'tahun', 'tahun_angkatan', 'academic_year'],
};

function indeksKolom(header) {
  const map = {};
  for (const [field, aliasList] of Object.entries(ALIAS)) {
    const idx = header.findIndex((h) => aliasList.includes(String(h).toLowerCase().trim()));
    map[field] = idx >= 0 ? idx : null;
  }
  return map;
}

/**
 * @param {Object} params
 * @param {{header:string[], rows:string[][]}} params.csv hasil parseCsv()
 * @param {Array<{prefix:string, active:boolean}>} params.prefixes dari tabel academic_years
 * @param {string[]} params.nisSudahAda daftar NIS yang sudah ada di DB
 * @param {boolean} [params.timpaUpdate] kalau true, NIS duplikat di-update (bukannya ditolak)
 */
export function validasiBarisSiswa({ csv, prefixes, nisSudahAda, timpaUpdate = false }) {
  const { header, rows } = csv;
  const col = indeksKolom(header);
  const errors = [];

  if (col.nis === null || col.nama === null) {
    return {
      ok: false,
      fatal: `Kolom wajib tidak ditemukan. Header terdeteksi: [${header.join(', ')}]. ` +
        `Minimal harus ada kolom "nis" dan "nama".`,
      valid: [],
      errors,
      total: rows.length,
    };
  }

  const prefixAktif = new Set(prefixes.filter((p) => p.active).map((p) => String(p.prefix).trim()));
  const prefixSemua = new Set(prefixes.map((p) => String(p.prefix).trim()));
  const sudahAda = new Set(nisSudahAda.map((n) => String(n).trim()));
  const seen = new Map(); // deteksi duplikat di dalam file itu sendiri
  const valid = [];

  rows.forEach((row, i) => {
    const barisKe = i + 2; // +2 karena baris 1 = header, dan index mulai 0
    const nis = String(row[col.nis] ?? '').replace(/[^0-9]/g, '');
    const nama = String(row[col.nama] ?? '').trim();
    const kelas = col.kelas !== null ? String(row[col.kelas] ?? '').trim() : '';
    let angkatan = col.angkatan !== null ? String(row[col.angkatan] ?? '').replace(/[^0-9]/g, '') : '';

    const gagal = (pesan) => errors.push({ baris: barisKe, nis: nis || '-', pesan });

    if (!nis && !nama) return; // baris kosong, lewati diam-diam
    if (!REGEX_NIS.test(nis)) return gagal(`NIS "${row[col.nis] ?? ''}" bukan 8 digit angka.`);
    if (!nama) return gagal('Nama kosong.');
    if (nama.length < 2) return gagal('Nama terlalu pendek (minimal 2 karakter).');

    if (!angkatan) angkatan = extractPrefix(nis);
    if (!prefixSemua.has(angkatan)) {
      return gagal(`Prefix angkatan "${angkatan}" tidak terdaftar di academic_years.`);
    }
    if (!prefixAktif.has(angkatan)) {
      return gagal(`Angkatan "${angkatan}" berstatus nonaktif - pendaftaran ditutup.`);
    }
    if (angkatan !== extractPrefix(nis)) {
      return gagal(
        `Prefix NIS (${extractPrefix(nis)}) tidak sama dengan kolom angkatan (${angkatan}).`,
      );
    }
    if (seen.has(nis)) {
      return gagal(`NIS duplikat di dalam file (sudah muncul di baris ${seen.get(nis)}).`);
    }
    seen.set(nis, barisKe);

    if (sudahAda.has(nis)) {
      if (!timpaUpdate) return gagal('NIS sudah ada di database (ditolak agar tidak menimpa).');
      valid.push({ nis, nama, kelas: kelas || null, angkatan, _update: true });
      return;
    }

    valid.push({ nis, nama, kelas: kelas || null, angkatan, _update: false });
  });

  return {
    ok: errors.length === 0,
    fatal: null,
    valid,
    errors,
    total: rows.length,
    jumlahBaru: valid.filter((v) => !v._update).length,
    jumlahUpdate: valid.filter((v) => v._update).length,
  };
}

/**
 * Tulis ke database secara batch.
 * @returns {Promise<{inserted:number, updated:number, error:string|null}>}
 */
export async function simpanSiswa(db, validRows, { chunkSize = 200 } = {}) {
  const baru = validRows.filter((r) => !r._update).map(strip);
  const update = validRows.filter((r) => r._update).map(strip);
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < baru.length; i += chunkSize) {
    const part = baru.slice(i, i + chunkSize);
    const { error, count } = await db
      .from('students')
      .insert(part, { count: 'exact' });
    if (error) return { inserted, updated, error: error.message };
    inserted += count ?? part.length;
  }

  for (let i = 0; i < update.length; i += chunkSize) {
    const part = update.slice(i, i + chunkSize);
    // upsert dengan onConflict nis -> update nama/kelas/angkatan & aktifkan lagi
    const { error, count } = await db
      .from('students')
      .upsert(part.map((r) => ({ ...r, active: true })), {
        onConflict: 'nis',
        count: 'exact',
      });
    if (error) return { inserted, updated, error: error.message };
    updated += count ?? part.length;
  }

  return { inserted, updated, error: null };
}

function strip(r) {
  return { nis: r.nis, nama: r.nama, kelas: r.kelas, angkatan: r.angkatan };
}

/** Laporan hasil import dalam bentuk teks siap tempel ke UI. */
export function ringkasHasilImport({ total, valid, errors }) {
  return {
    total,
    diterima: valid.length,
    ditolak: errors.length,
    contohError: errors.slice(0, 10),
  };
}

/** Perbandingan nama untuk laporan "nama beda jauh" (opsional). */
export function cekKonsistensiNama(a, b) {
  return normNama(a) === normNama(b);
}
