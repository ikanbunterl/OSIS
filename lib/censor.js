/**
 * Sensor kata kasar + pengecekan username impersonasi.
 * Dipakai di client (umpan balik instan) DAN di server (penegakan).
 */
import { BAD_WORDS, IMPERSONATION_KEYWORDS, RESERVED_USERNAMES } from './constants';

/**
 * Susun regex per kata:
 *  - selalu pakai batas kata di DEPAN  -> "anjurkan" tidak ikut kena "anju…"
 *  - batas kata di BELAKANG hanya untuk kata tanpa kelas karakter,
 *    supaya variasi seperti "memekq"/"kontolnya" tetap tersensor.
 */
function bikinPola(w) {
  const adaKelasKarakter = /[\[(]/.test(w);
  return new RegExp(`\\b${w}${adaKelasKarakter ? '' : '\\b'}`, 'gi');
}

const polaTersusun = BAD_WORDS.map(bikinPola);

/** 'kamu anjing' -> 'kamu ******' */
export function censor(teks = '') {
  let out = String(teks ?? '');
  for (const re of polaTersusun) {
    out = out.replace(re, (m) => '*'.repeat(m.length));
  }
  return out;
}

/** Berapa kata kasar yang ditemukan (untuk logging moderasi). */
export function hitungKataKasar(teks = '') {
  const src = String(teks ?? '');
  let n = 0;
  for (const re of polaTersusun) {
    const m = src.match(re);
    if (m) n += m.length;
  }
  return n;
}

export function adaKataKasar(teks = '') {
  return hitungKataKasar(teks) > 0;
}

/** Normalisasi username untuk perbandingan: huruf kecil, hanya alfanumerik. */
export function normUsername(u = '') {
  return String(u).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Cek username mencoba menyamar jadi akun resmi.
 * Return: { ok: boolean, alasan?: string }
 */
export function cekImpersonasi(username = '') {
  const norm = normUsername(username);
  if (!norm) return { ok: false, alasan: 'Username kosong.' };

  if (RESERVED_USERNAMES.includes(norm)) {
    return { ok: false, alasan: 'Username ini dicadangkan untuk akun resmi sekolah.' };
  }

  for (const kata of IMPERSONATION_KEYWORDS) {
    const k = normUsername(kata);
    if (k && norm.includes(k)) {
      return {
        ok: false,
        alasan: `Username tidak boleh mengandung "${kata}" supaya tidak menyerupai akun resmi.`,
      };
    }
  }
  return { ok: true };
}

/** Cek username sudah "mirip" akun resmi yang sudah ada di DB. */
export function cekMiripUsernameResmi(username, daftarUsernameResmi = []) {
  const norm = normUsername(username);
  for (const resmi of daftarUsernameResmi) {
    const r = normUsername(resmi);
    if (!r) continue;
    if (r === norm) return { ok: false, alasan: 'Username sudah dipakai akun resmi.' };
    // beda 1 karakter (typo-squatting): osis -> o5is, admin -> adrnin
    if (Math.abs(r.length - norm.length) <= 1 && jarakLevenshtein(r, norm) <= 1) {
      return { ok: false, alasan: 'Username terlalu mirip dengan akun resmi sekolah.' };
    }
  }
  return { ok: true };
}

export function jarakLevenshtein(a = '', b = '') {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = new Array(t.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= s.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= t.length; j += 1) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[t.length];
}
