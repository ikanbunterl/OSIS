/**
 * Validasi form & input (Zod v4).
 * Dipakai di client (umpan balik instan) dan di server (penegakan sesungguhnya).
 */
import { z } from 'zod';
import { APP, KATEGORI_LAPOR, LIMITS, PREFIX_ANGKATAN_FALLBACK } from './constants';
import { cekImpersonasi } from './censor';

/* ------------------------------------------------------------------ */
/* NIS                                                                 */
/* ------------------------------------------------------------------ */

export const REGEX_NIS = /^\d{8}$/;

export const nisSchema = z
  .string()
  .trim()
  .regex(REGEX_NIS, 'NIS harus 8 digit angka');

/** Ambil 4 digit pertama NIS = prefix angkatan. */
export function extractPrefix(nis = '') {
  return String(nis).slice(0, 4);
}

export function isValidPrefix(nis, activePrefixes = PREFIX_ANGKATAN_FALLBACK) {
  return activePrefixes.includes(extractPrefix(nis));
}

/** Email pseudo untuk Supabase Auth: '24250001@siswa.local' */
export function nisKeEmail(nis) {
  return `${String(nis).trim()}@${APP.domainEmailSiswa}`;
}

export function emailKeNis(email = '') {
  const [head, domain] = String(email).split('@');
  if (domain !== APP.domainEmailSiswa) return null;
  return REGEX_NIS.test(head) ? head : null;
}

/* ------------------------------------------------------------------ */
/* Username                                                            */
/* ------------------------------------------------------------------ */

export const REGEX_USERNAME = /^[a-z0-9._]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.usernameMin, `Username minimal ${LIMITS.usernameMin} karakter`)
  .max(LIMITS.usernameMax, `Username maksimal ${LIMITS.usernameMax} karakter`)
  .regex(
    REGEX_USERNAME,
    'Username hanya boleh huruf kecil, angka, titik (.) dan garis bawah (_)',
  )
  .superRefine((val, ctx) => {
    if (/\./.test(val.slice(0, 1)) || /_/.test(val.slice(0, 1))) {
      ctx.addIssue({ code: 'custom', message: 'Username tidak boleh diawali titik atau garis bawah' });
    }
    const cek = cekImpersonasi(val);
    if (!cek.ok) ctx.addIssue({ code: 'custom', message: cek.alasan });
  });

/* ------------------------------------------------------------------ */
/* Password                                                            */
/* ------------------------------------------------------------------ */

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Password minimal ${LIMITS.passwordMin} karakter`)
  .max(72, 'Password maksimal 72 karakter');

/** Skor 0-4 untuk indikator kekuatan password di UI. */
export function skorPassword(pw = '') {
  let skor = 0;
  if (pw.length >= 8) skor += 1;
  if (pw.length >= 12) skor += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) skor += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) skor += 1;
  return Math.min(skor, 4);
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const registerSchema = z.object({
  nis: nisSchema,
  nama: z
    .string()
    .trim()
    .min(3, 'Nama minimal 3 karakter')
    .max(80, 'Nama maksimal 80 karakter'),
  username: usernameSchema,
  password: passwordSchema,
  konfirmasiPassword: z.string(),
  setuju: z.literal(true, {
    errorMap: () => ({ message: 'Kamu harus menyetujui aturan komunitas' }),
  }),
}).refine((d) => d.password === d.konfirmasiPassword, {
  message: 'Konfirmasi password tidak sama',
  path: ['konfirmasiPassword'],
});

export const loginSchema = z.object({
  nis: nisSchema,
  password: z.string().min(1, 'Password wajib diisi'),
});

export const profilSchema = z.object({
  username: usernameSchema,
  nama_lengkap: z.string().trim().max(80, 'Maksimal 80 karakter').optional().or(z.literal('')),
  bio: z.string().trim().max(LIMITS.bioKarakter, `Bio maksimal ${LIMITS.bioKarakter} karakter`).optional().or(z.literal('')),
});

/* ------------------------------------------------------------------ */
/* Konten                                                              */
/* ------------------------------------------------------------------ */

export const postSchema = z.object({
  channel_id: z.string().uuid('Channel tidak valid'),
  title: z
    .string()
    .trim()
    .max(LIMITS.postJudul, `Judul maksimal ${LIMITS.postJudul} karakter`)
    .optional()
    .or(z.literal('')),
  content: z
    .string()
    .trim()
    .min(3, 'Isi tulisan minimal 3 karakter')
    .max(LIMITS.postKarakter, `Maksimal ${LIMITS.postKarakter} karakter`),
  is_anonymous: z.boolean().optional(),
  media_urls: z.array(z.string().trim().min(1)).max(LIMITS.mediaPost).optional(),
});

export const komentarSchema = z.object({
  post_id: z.string().uuid(),
  content: z
    .string()
    .trim()
    .min(1, 'Komentar tidak boleh kosong')
    .max(LIMITS.komentarKarakter, `Maksimal ${LIMITS.komentarKarakter} karakter`),
  is_anonymous: z.boolean().optional(),
});

export const chatSchema = z.object({
  room_id: z.string().uuid(),
  content: z
    .string()
    .trim()
    .min(1, 'Pesan tidak boleh kosong')
    .max(LIMITS.chatKarakter, `Maksimal ${LIMITS.chatKarakter} karakter`),
});

export const tiketSchema = z.object({
  kategori: z
    .string()
    .trim()
    .refine((v) => KATEGORI_LAPOR.some((k) => k.id === v), 'Pilih kategori laporan'),
  judul: z.string().trim().min(5, 'Judul minimal 5 karakter').max(120, 'Judul maksimal 120 karakter'),
  deskripsi: z
    .string()
    .trim()
    .min(20, 'Ceritakan detailnya minimal 20 karakter supaya mudah ditindaklanjuti')
    .max(3000, 'Maksimal 3000 karakter'),
  lokasi: z.string().trim().max(120).optional().or(z.literal('')),
  kontak: z.string().trim().max(120).optional().or(z.literal('')),
  lampiran: z.array(z.string().trim().min(1)).max(LIMITS.lampiranTiket).optional(),
  lampiran_nama: z.array(z.string().trim()).max(LIMITS.lampiranTiket).optional(),
});

export const balasanTiketSchema = z.object({
  content: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(3000),
  attachment: z.string().trim().optional().or(z.literal('')),
  attachment_name: z.string().trim().optional().or(z.literal('')),
});

export const reportSchema = z.object({
  target_type: z.enum(['post', 'comment', 'chat', 'profile', 'ticket']),
  target_id: z.string().uuid(),
  reason: z.string().trim().min(3, 'Pilih alasan pelaporan'),
  detail: z.string().trim().max(500).optional().or(z.literal('')),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(10),
    auth: z.string().min(10),
  }),
});

/* ------------------------------------------------------------------ */
/* Import CSV siswa                                                    */
/* ------------------------------------------------------------------ */

export const barisSiswaSchema = z.object({
  nis: nisSchema,
  nama: z.string().trim().min(2, 'Nama kosong'),
  kelas: z.string().trim().max(30).optional().or(z.literal('')),
  angkatan: z.string().trim().length(4, 'Prefix angkatan harus 4 digit').optional().or(z.literal('')),
});

/* ------------------------------------------------------------------ */
/* Helper: ubah error Zod jadi { field: pesan } untuk form              */
/* ------------------------------------------------------------------ */

export function errorPerField(result) {
  if (result?.success) return {};
  const flat = result?.error?.flatten?.() || {};
  const out = {};
  for (const [k, v] of Object.entries(flat.fieldErrors || {})) {
    if (v?.length) out[k] = v[0];
  }
  for (const item of flat.formErrors || []) {
    out._form = item;
  }
  return out;
}

/** Ambil pesan pertama dari hasil safeParse yang gagal. */
export function pesanError(result, fallback = 'Data tidak valid') {
  if (result?.success) return null;
  const issues = result?.error?.issues || [];
  return issues[0]?.message || fallback;
}

/** Normalisasi nama untuk perbandingan longgar dengan data sekolah. */
export function normNama(nama = '') {
  return String(nama)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bandingkan nama yang diinput siswa dengan nama di data sekolah.
 * Longgar: singkatan gelar diabaikan, urutan kata boleh berbeda,
 * toleransi 1 typo untuk nama panjang.
 */
export function namaCocok(input = '', dariDb = '') {
  const a = normNama(input);
  const b = normNama(dariDb);
  if (!a || !b) return false;
  if (a === b) return true;

  const stop = new Set(['al', 'bin', 'binti', 'bte', 'bt', 'alm', 'almh', 'st', 'spd', 'mr', 'mrs']);
  const tokenA = a.split(' ').filter((t) => !stop.has(t));
  const tokenB = b.split(' ').filter((t) => !stop.has(t));
  const setA = new Set(tokenA);
  const setB = new Set(tokenB);

  // semua token DB harus ada di input (atau sebaliknya)
  const bDiA = tokenB.every((t) => setA.has(t));
  const aDiB = tokenA.every((t) => setB.has(t));
  if (bDiA || aDiB) return true;

  // minimal 2 token sama persis untuk nama >= 3 kata
  const sama = tokenB.filter((t) => setA.has(t)).length;
  if (sama >= 2 && Math.min(tokenA.length, tokenB.length) >= 2) return true;

  return false;
}
