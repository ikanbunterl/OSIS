import Link from 'next/link';
import { RefreshCw, WifiOff } from 'lucide-react';

export const metadata = { title: 'Offline', robots: { index: false } };

/** Halaman fallback saat tidak ada koneksi (di-cache oleh service worker). */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-sunken text-ink-faint">
        <WifiOff className="h-10 w-10" />
      </div>
      <h1 className="text-xl font-extrabold">Kamu sedang offline</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
        Periksa koneksi internetmu, lalu muat ulang halaman. Laporan yang belum terkirim
        tidak akan hilang kalau kamu tetap di halaman ini.
      </p>
      <Link
        href="/home"
        className="mt-6 inline-flex min-h-touch items-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white"
      >
        <RefreshCw className="h-4 w-4" /> Coba lagi
      </Link>
    </main>
  );
}
