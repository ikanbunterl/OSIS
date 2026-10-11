import Link from 'next/link';
import { Compass } from 'lucide-react';

export const metadata = { title: 'Halaman tidak ditemukan' };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-sunken text-ink-faint">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-black">404 — Halaman tidak ada</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-muted">
        Mungkin tautannya salah ketik atau halamannya sudah dipindah.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/home" className="min-h-touch rounded-xl bg-primary-600 px-5 text-sm font-bold text-white">
          Ke Home
        </Link>
        <Link href="/lapor" className="min-h-touch rounded-xl border border-line px-5 text-sm font-bold text-ink-muted">
          Buat laporan
        </Link>
      </div>
    </main>
  );
}
