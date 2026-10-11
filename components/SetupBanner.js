import { Database, Terminal } from 'lucide-react';
import { envServerSiap } from '@/lib/supabase/server';

/**
 * Banner panduan setup yang muncul HANYA kalau env Supabase belum diisi.
 * Berguna saat repo baru di-clone: langsung kelihatan apa yang kurang,
 * dan otomatis hilang setelah konfigurasi benar.
 */
export default function SetupBanner() {
  if (envServerSiap()) return null;

  return (
    <div className="border-b-2 border-amber-400 bg-amber-50 px-4 py-4 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
      <div className="mx-auto max-w-shell">
        <p className="flex items-center gap-2 text-sm font-black">
          <Database className="h-4 w-4" />
          Setup belum selesai — Supabase belum dihubungkan
        </p>
        <p className="mt-1.5 text-xs leading-relaxed">
          Halaman tetap tampil supaya UI-nya bisa dilihat, tapi semua fitur yang butuh data
          (login, feed, chat, lapor) belum berfungsi.
        </p>

        <ol className="mt-3 space-y-1.5 text-xs leading-relaxed">
          <li>
            <b>1.</b> Buat project di{' '}
            <span className="font-mono">supabase.com</span>, jalankan{' '}
            <span className="font-mono">supabase/01_schema.sql</span> →{' '}
            <span className="font-mono">02_seed.sql</span> →{' '}
            <span className="font-mono">03_admin_setup.sql</span> lewat SQL Editor.
          </li>
          <li>
            <b>2.</b> Salin <span className="font-mono">.env.example</span> →{' '}
            <span className="font-mono">.env.local</span>, isi 3 kunci dari{' '}
            <i>Project Settings → API</i>.
          </li>
          <li>
            <b>3.</b> Matikan <i>Confirm email</i> di <i>Authentication → Providers → Email</i>.
          </li>
          <li>
            <b>4.</b> Jalankan ulang <span className="font-mono">npm run dev</span>.
          </li>
        </ol>

        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
{`cp .env.example .env.local
# isi:
#   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
npm run dev`}
        </pre>

        <p className="mt-2.5 flex items-center gap-1.5 text-[11px]">
          <Terminal className="h-3.5 w-3.5" />
          Panduan lengkap: <b>README.md</b> (bagian 3) dan <b>DEPLOY.md</b> (tahap 1–4).
        </p>
      </div>
    </div>
  );
}
