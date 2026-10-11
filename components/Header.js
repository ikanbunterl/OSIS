'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Settings } from 'lucide-react';
import { classNames } from '@/lib/utils';
import { useStore } from '@/lib/store';

/**
 * Header sticky dengan safe-area atas.
 * @param {string}   judul
 * @param {boolean}  back      tampilkan tombol kembali
 * @param {string}   hrefBack  tujuan kembali (default: router.back())
 * @param {React.ReactNode} kanan  slot aksi kanan
 */
export default function Header({ judul, back = false, hrefBack, kanan, subtitle, sticky = true, className }) {
  const router = useRouter();
  const badge = useStore((s) => s.badge);
  const profile = useStore((s) => s.profile);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);

  const kembali = () => {
    if (hrefBack) router.push(hrefBack);
    else if (window.history.length > 1) router.back();
    else router.push('/home');
  };

  return (
    <header
      className={classNames(
        'z-30 w-full border-b border-line bg-surface/85 backdrop-blur-md area-aman-atas',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <div className="mx-auto flex min-h-touch-14 w-full max-w-shell items-center gap-2 px-3 py-2">
        {back ? (
          <button
            type="button"
            onClick={kembali}
            aria-label="Kembali"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-sunken active:bg-surface-sunken"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold leading-tight tracking-tight">{judul}</h1>
          {subtitle ? <p className="truncate text-xs text-ink-muted">{subtitle}</p> : null}
        </div>

        {kanan ?? (
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/admin"
              aria-label="Notifikasi & admin"
              className={classNames(
                'relative flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken',
                !isStaff && 'hidden',
              )}
            >
              <Bell className="h-5 w-5" />
              {badge.chat + badge.lapor > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {badge.chat + badge.lapor}
                </span>
              ) : null}
            </Link>
            {isStaff ? (
              <Link
                href="/admin"
                aria-label="Dashboard admin"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
              >
                <Settings className="h-5 w-5" />
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
