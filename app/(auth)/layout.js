import Link from 'next/link';
import { APP } from '@/lib/constants';

export const metadata = { title: 'Masuk', robots: { index: false } };

/**
 * Layout grup (auth): halaman login/register.
 * Tanpa bottom nav, ada tautan bantuan, dan logo sekolah.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col area-aman-atas area-aman-bawah">
      <div className="flex flex-1 flex-col justify-center px-5 py-8">
        <div className="mb-7 text-center">
          <Link href="/home" className="inline-flex flex-col items-center gap-3" aria-label={APP.nama}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/192.png" alt="" width={72} height={72} className="rounded-2xl shadow-card" />
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-ink-faint">
                Portal resmi siswa
              </span>
              <span className="mt-0.5 block text-lg font-black leading-tight tracking-tight">
                {APP.nama}
              </span>
            </span>
          </Link>
        </div>

        <div className="mx-auto w-full max-w-sm">{children}</div>
      </div>

      <footer className="px-6 pb-6 text-center">
        <p className="text-[11px] leading-relaxed text-ink-faint">
          Akun dibuat otomatis dari NIS yang terdata di sekolah.
          <br />
          Ada masalah? Hubungi pengurus OSIS atau pembina.
        </p>
      </footer>
    </div>
  );
}
