/**
 * Supabase client untuk SERVER (API routes + server components).
 *
 *  - serverClient()      : anon key + RLS aktif (dipakai bila tidak butuh hak khusus)
 *  - serviceClient()     : SERVICE ROLE key -> MELEWATI RLS.
 *                          HANYA boleh di-import dari file server ('server-only').
 *                          JANGAN PERNAH dikirim ke browser.
 *  - userClient(token)   : anon key + JWT user -> bertindak sebagai user itu (RLS jalan)
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** URL dianggap sah kalau benar-benar https://xxx.supabase.co (bukan placeholder). */
export function urlSah(u = url) {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    return /supabase\.(co|in|red)$|\.supabase\./.test(parsed.hostname) || parsed.hostname.includes('supabase');
  } catch {
    return false;
  }
}

let _server = null;
let _service = null;

export function envServerSiap() {
  return Boolean(urlSah() && anonKey && serviceKey);
}

export const PANDUAN_ENV =
  'Konfigurasi Supabase belum lengkap. Salin .env.example menjadi .env.local lalu isi ' +
  'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY ' +
  '(ambil dari Supabase Dashboard -> Project Settings -> API), kemudian jalankan ulang server. ' +
  'Panduan lengkap: README.md bagian 3 dan DEPLOY.md tahap 1.';

export function assertEnv() {
  if (!urlSah()) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL belum valid (sekarang: "${url || '(kosong)'}"). ` + PANDUAN_ENV,
    );
  }
  if (!anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY belum diset. ' + PANDUAN_ENV);
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset (wajib untuk API register/tiket/import). ' + PANDUAN_ENV);
  }
}

export function serverClient() {
  if (!_server) {
    if (!urlSah() || !anonKey) throw new Error(PANDUAN_ENV);
    _server = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _server;
}

export function serviceClient() {
  if (!_service) {
    assertEnv();
    _service = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _service;
}

/** Client yang bertindak sebagai user tertentu (RLS tetap berlaku). */
export function userClient(accessToken) {
  if (!urlSah() || !anonKey) throw new Error(PANDUAN_ENV);
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
}

/** Ambil session user dari header Authorization sebuah request. */
export async function sessionDariRequest(req) {
  const header = req.headers?.get?.('authorization') || req.headers?.get?.('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { data, error } = await serviceClient().auth.getUser(token);
    if (error || !data?.user) return null;
    return { user: data.user, token };
  } catch {
    return null;
  }
}

/** Profil + status akses user (dipakai hampir semua API route). */
export async function konteksUser(req) {
  const sesi = await sessionDariRequest(req);
  if (!sesi) return { ok: false, kode: 401, pesan: 'Kamu harus login dulu.' };

  const { data: profil, error } = await serviceClient()
    .from('profiles')
    .select('id, nis, username, nama_lengkap, avatar_url, role, verified_at, muted_until, banned_until')
    .eq('id', sesi.user.id)
    .maybeSingle();

  if (error || !profil) {
    return { ok: false, kode: 403, pesan: 'Profil tidak ditemukan. Hubungi admin OSIS.' };
  }
  if (profil.banned_until && new Date(profil.banned_until) > new Date()) {
    return {
      ok: false,
      kode: 403,
      pesan: `Akun kamu diblokir sampai ${new Date(profil.banned_until).toLocaleString('id-ID')}.`,
      profil,
      user: sesi.user,
    };
  }
  const dimute = profil.muted_until && new Date(profil.muted_until) > new Date();
  return {
    ok: true,
    profil,
    user: sesi.user,
    token: sesi.token,
    dimute: Boolean(dimute),
    staff: ['osis', 'pembina', 'admin', 'super_admin'].includes(profil.role),
    isAdmin: ['pembina', 'admin', 'super_admin'].includes(profil.role),
    terverifikasi: Boolean(profil.verified_at),
  };
}

export async function wajibLogin(req) {
  const ctx = await konteksUser(req);
  if (!ctx.ok) return ctx;
  return ctx;
}

export async function wajibStaff(req) {
  const ctx = await konteksUser(req);
  if (!ctx.ok) return ctx;
  if (!ctx.staff) return { ok: false, kode: 403, pesan: 'Khusus OSIS / admin.' };
  return ctx;
}

export async function wajibAdmin(req) {
  const ctx = await konteksUser(req);
  if (!ctx.ok) return ctx;
  if (!ctx.isAdmin) return { ok: false, kode: 403, pesan: 'Khusus admin / pembina.' };
  return ctx;
}

/** Tulis audit log (dipanggil dari API route dengan service role). */
export async function catatAudit(actorId, action, target, metadata = {}) {
  try {
    await serviceClient().from('audit_logs').insert({
      actor_id: actorId || null,
      action,
      target: target ? String(target) : null,
      metadata,
    });
  } catch (e) {
    // audit tidak boleh membuat request utama gagal
    console.error('[audit] gagal mencatat', action, e?.message);
  }
}
