/**
 * Helper auth di sisi BROWSER.
 * Sumber kebenaran session = Supabase Auth; profil dibaca dari tabel profiles.
 */
'use client';

import { getSupabaseBrowser } from './supabase/client';

export const sb = () => getSupabaseBrowser();

export async function getSession() {
  const { data } = await sb().auth.getSession();
  return data?.session ?? null;
}

export async function getUser() {
  const { data } = await sb().auth.getUser();
  return data?.user ?? null;
}

export function onAuthChange(cb) {
  const { data } = sb().auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/** Ambil profil lengkap milik user yang sedang login. */
export async function getMyProfile(userId) {
  if (!userId) return null;
  const { data, error } = await sb()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[auth] gagal ambil profil', error.message);
    return null;
  }
  return data;
}

/**
 * Login pakai NIS + password.
 * NIS dipetakan ke email pseudo `<nis>@siswa.local` (lihat lib/validators.js).
 */
export async function loginDenganNis(nis, password, nisKeEmail) {
  const { data, error } = await sb().auth.signInWithPassword({
    email: nisKeEmail(nis),
    password,
  });
  return { session: data?.session ?? null, error };
}

export async function logout() {
  const { error } = await sb().auth.signOut();
  if (typeof window !== 'undefined') {
    // bersihkan cache UI
    try {
      window.localStorage.removeItem('osis-ui-cache');
    } catch { /* ignore */ }
  }
  return { error };
}

/** Perbarui profil sendiri (RLS mengizinkan field non-sensitif saja). */
export async function updateMyProfile(userId, patch) {
  const { data, error } = await sb()
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .maybeSingle();
  return { profil: data, error };
}

export function bolehKirim(profil) {
  if (!profil) return { ok: false, alasan: 'Kamu harus login dulu.' };
  if (!profil.verified_at) return { ok: false, alasan: 'Akunmu belum terverifikasi.' };
  const now = new Date();
  if (profil.banned_until && new Date(profil.banned_until) > now) {
    return { ok: false, alasan: 'Akunmu sedang diblokir.' };
  }
  if (profil.muted_until && new Date(profil.muted_until) > now) {
    return { ok: false, alasan: 'Kamu sedang dibisukan sementara.' };
  }
  return { ok: true };
}

export function roleLabel(profil) {
  return profil?.role || 'siswa';
}
