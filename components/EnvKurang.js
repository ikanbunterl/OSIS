'use client';

import { Database } from 'lucide-react';

/**
 * Dipasang di halaman yang mengambil data dari API.
 * Kalau API balas `ENV_BELUM_DIISI`, tampilkan panduan singkat alih-alih
 * error merah yang membingungkan.
 */
export default function EnvKurang({ error, loading }) {
  const kurang = typeof error === 'string' && /env|supabase belum|konfigurasi/i.test(error);
  if (loading || !kurang) return null;

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p className="flex items-center gap-2 text-sm font-black">
        <Database className="h-4 w-4" /> Supabase belum dihubungkan
      </p>
      <p className="mt-1.5 text-xs leading-relaxed">
        Halaman ini butuh data dari database. Isi dulu <code className="rounded bg-slate-900/10 px-1">.env.local</code>{' '}
        dengan <code className="rounded bg-slate-900/10 px-1">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
        <code className="rounded bg-slate-900/10 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, dan{' '}
        <code className="rounded bg-slate-900/10 px-1">SUPABASE_SERVICE_ROLE_KEY</code>, lalu restart server.
      </p>
      <p className="mt-1.5 text-xs">
        Langkah lengkap: <b>README.md bagian 3</b> · <b>DEPLOY.md tahap 1</b>.
      </p>
    </div>
  );
}
