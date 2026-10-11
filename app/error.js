'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function Error({ error, reset }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-black">Terjadi kesalahan</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
        {error?.message || 'Ada masalah tak terduga saat memuat halaman ini.'}
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={() => reset?.()}>Coba lagi</Button>
        <Link href="/home">
          <Button varian="sekunder">Ke Home</Button>
        </Link>
      </div>
    </main>
  );
}
