/**
 * Store global (Zustand) - session, profil, tema, badge notifikasi, cache reaksi.
 * Satu file kecil supaya gampang dipahami & di-debug.
 */
'use client';

import { create } from 'zustand';
import { getSupabaseBrowser } from './supabase/client';

const ROLE_STAFF = ['osis', 'pembina', 'admin', 'super_admin'];
const ROLE_ADMIN = ['pembina', 'admin', 'super_admin'];

async function ambilProfil(userId) {
  if (!userId) return null;
  const { data } = await getSupabaseBrowser()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
}

export const useStore = create((set, get) => ({
  /* ---------- auth ---------- */
  hydrated: false,
  loading: true,
  session: null,
  profile: null,

  hydrate: async () => {
    const sb = getSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    const session = data?.session ?? null;
    const profile = await ambilProfil(session?.user?.id);
    set({ session, profile, hydrated: true, loading: false });

    sb.auth.onAuthStateChange(async (_event, newSession) => {
      const p = await ambilProfil(newSession?.user?.id);
      set({ session: newSession ?? null, profile: p, loading: false, hydrated: true });
    });
  },

  refreshProfile: async () => {
    const session = get().session;
    const profile = await ambilProfil(session?.user?.id);
    set({ profile });
    return profile;
  },

  clear: () =>
    set({ session: null, profile: null, reaksiSaya: {}, badge: { chat: 0, lapor: 0 } }),

  /* ---------- tema ---------- */
  tema: 'system', // 'system' | 'light' | 'dark'
  setTema: (tema) => set({ tema }),

  /* ---------- reaksi (like/upvote) milik saya ---------- */
  reaksiSaya: {},
  setReaksi: (postId, type) =>
    set((s) => {
      const next = { ...s.reaksiSaya };
      if (type) next[postId] = type;
      else delete next[postId];
      return { reaksiSaya: next };
    }),
  setReaksiBanyak: (map) => set((s) => ({ reaksiSaya: { ...s.reaksiSaya, ...map } })),

  /* ---------- badge bottom nav ---------- */
  badge: { chat: 0, lapor: 0 },
  setBadge: (patch) => set((s) => ({ badge: { ...s.badge, ...patch } })),

  /* ---------- composer / sheet global ---------- */
  composerTerbuka: false,
  composerChannel: null,
  bukaComposer: (channel) => set({ composerTerbuka: true, composerChannel: channel || null }),
  tutupComposer: () => set({ composerTerbuka: false, composerChannel: null }),
}));

/* ---------------- selector helper ---------------- */
export const useSession = () => useStore((s) => s.session);
export const useProfile = () => useStore((s) => s.profile);
export const useHydrated = () => useStore((s) => s.hydrated);
export const useIsStaff = () => useStore((s) => ROLE_STAFF.includes(s.profile?.role));
export const useIsAdmin = () => useStore((s) => ROLE_ADMIN.includes(s.profile?.role));
export const useBolehKirim = () =>
  useStore((s) => {
    const p = s.profile;
    if (!p) return { ok: false, alasan: 'Kamu harus login dulu.' };
    if (!p.verified_at) return { ok: false, alasan: 'Akunmu belum terverifikasi.' };
    const now = new Date();
    if (p.banned_until && new Date(p.banned_until) > now) {
      return { ok: false, alasan: 'Akunmu sedang diblokir.' };
    }
    if (p.muted_until && new Date(p.muted_until) > now) {
      return { ok: false, alasan: 'Kamu sedang dibisukan sementara.' };
    }
    return { ok: true, alasan: '' };
  });
