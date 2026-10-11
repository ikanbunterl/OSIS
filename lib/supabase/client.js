/**
 * Supabase client untuk BROWSER (dipakai 'use client' components).
 * Hanya membawa anon key -> semua akses dibatasi Row Level Security.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client = null;
let sudahDitegur = false;

function urlSah(u) {
  try {
    const parsed = new URL(u);
    return /^https?:$/.test(parsed.protocol) && parsed.hostname.includes('supabase');
  } catch {
    return false;
  }
}

export function getSupabaseBrowser() {
  if (client) return client;

  if (!urlSah(url) || !anonKey) {
    if (!sudahDitegur && typeof window !== 'undefined') {
      sudahDitegur = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[OSIS] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. ' +
          'Salin .env.example jadi .env.local lalu isi, kemudian jalankan ulang `npm run dev`.',
      );
    }
    // Kembalikan client dengan URL palsu supaya kode tidak crash saat build/preview.
    client = createClient('http://localhost:54321', 'anon-key-belum-diisi', {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    return client;
  }

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'osis-td2-auth',
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

export const supabaseBrowser = typeof window !== 'undefined' ? getSupabaseBrowser() : null;

export function envLengkap() {
  return Boolean(url && anonKey);
}
