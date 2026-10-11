/**
 * Rate limiter in-memory sederhana.
 *
 * Catatan penting: di Vercel (serverless) tiap instance punya memori sendiri,
 * jadi limit ini "best effort" - cukup untuk menahan spam/abuse ringan,
 * bukan pengganti rate limiter terdistribusi. Untuk aplikasi sekolah ini
 * sudah lebih dari cukup, dan gratis.
 *
 * Kalau butuh ketat: pindah ke Supabase Edge Function + tabel `rate_limits`,
 * atau Upstash Redis free tier.
 */
import 'server-only';

/** @type {Map<string, {count:number, reset:number}>} */
const bucket = new Map();
const MAKS_ENTRI = 5000;

function bersihSesekali() {
  if (bucket.size < MAKS_ENTRI) return;
  const now = Date.now();
  for (const [k, v] of bucket) {
    if (v.reset <= now) bucket.delete(k);
  }
}

/**
 * @param {string} kunci   mis. 'tiket:uuid-user' atau 'login:1.2.3.4'
 * @param {number} maks    jumlah aksi yang diizinkan
 * @param {number} jendelaMs panjang jendela waktu dalam ms
 * @returns {{ok:boolean, sisa:number, resetMs:number}}
 */
export function rateLimit(kunci, maks, jendelaMs) {
  const now = Date.now();
  bersihSesekali();

  const entri = bucket.get(kunci);
  if (!entri || entri.reset <= now) {
    bucket.set(kunci, { count: 1, reset: now + jendelaMs });
    return { ok: true, sisa: maks - 1, resetMs: jendelaMs };
  }

  if (entri.count >= maks) {
    return { ok: false, sisa: 0, resetMs: entri.reset - now };
  }

  entri.count += 1;
  return { ok: true, sisa: maks - entri.count, resetMs: entri.reset - now };
}

export function resetRateLimit(kunci) {
  bucket.delete(kunci);
}

/** IP klien (Vercel memberi x-forwarded-for / x-real-ip). */
export function ipKlien(req) {
  const fwd = req.headers?.get?.('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return (
    req.headers?.get?.('x-real-ip') ||
    req.headers?.get?.('cf-connecting-ip') ||
    'unknown'
  );
}

/** Helper: format detik dari ms */
export function detik(ms) {
  return Math.max(1, Math.ceil(ms / 1000));
}
