'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft, ClipboardList, FileSpreadsheet, Gavel, LayoutDashboard,
  Menu, ShieldCheck, UserCheck, Users, X,
} from 'lucide-react';
import AuthGate from '@/components/AuthGate';
import { useStore } from '@/lib/store';
import { APP, ROLE_ADMIN, ROLE_STAFF } from '@/lib/constants';
import { classNames } from '@/lib/utils';

const MENU = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard, adminOnly: false },
  { href: '/admin/verifikasi', label: 'Verifikasi & Akun', Icon: UserCheck, adminOnly: false },
  { href: '/admin/import', label: 'Import Siswa', Icon: FileSpreadsheet, adminOnly: false },
  { href: '/admin/siswa', label: 'Data Siswa', Icon: Users, adminOnly: false },
  { href: '/admin/moderasi', label: 'Moderasi', Icon: Gavel, adminOnly: false },
  { href: '/admin/tiket', label: 'Tiket Lapor', Icon: ClipboardList, adminOnly: false },
];

export default function AdminShell({ children }) {
  const pathname = usePathname() || '';
  const profile = useStore((s) => s.profile);
  const [menuBuka, setMenuBuka] = useState(false);
  const isAdmin = ROLE_ADMIN.includes(profile?.role);

  useEffect(() => setMenuBuka(false), [pathname]);

  const daftar = MENU.filter((m) => !m.adminOnly || isAdmin);
  const aktif = (href) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  return (
    <AuthGate role={ROLE_STAFF} kembaliKe="/admin">
      <div className="flex min-h-dvh flex-col lg:flex-row">
        {/* ---------- sidebar (desktop) ---------- */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface-raised lg:flex">
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/192.png" alt="" className="h-9 w-9 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight">Admin OSIS</p>
              <p className="truncate text-[11px] text-ink-muted">{APP.namaPendek}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3" aria-label="Menu admin">
            {daftar.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={aktif(href) ? 'page' : undefined}
                className={classNames(
                  'flex min-h-touch items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition',
                  aktif(href)
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-line p-3">
            <div className="rounded-xl bg-surface-sunken p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-500" />
                {profile?.nama_lengkap || profile?.username}
              </p>
              <p className="mt-0.5 text-[10.5px] text-ink-muted">
                @{profile?.username} · {isAdmin ? 'Admin/Pembina' : 'Anggota OSIS'}
              </p>
            </div>
            <Link
              href="/home"
              className="mt-2 flex min-h-touch items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-surface-sunken"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali ke aplikasi siswa
            </Link>
          </div>
        </aside>

        {/* ---------- header mobile ---------- */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-touch-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md area-aman-atas lg:hidden">
            <button
              type="button"
              onClick={() => setMenuBuka((v) => !v)}
              aria-label={menuBuka ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={menuBuka}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-sunken"
            >
              {menuBuka ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold leading-tight">
                {daftar.find((m) => aktif(m.href))?.label || 'Admin'}
              </p>
              <p className="truncate text-[11px] text-ink-muted">
                {isAdmin ? 'Akses penuh' : 'Anggota OSIS'}
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/192.png" alt="" className="h-8 w-8 rounded-lg" />
          </header>

          {menuBuka ? (
            <nav className="z-20 grid grid-cols-2 gap-2 border-b border-line bg-surface-raised p-3 lg:hidden" aria-label="Menu admin">
              {daftar.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={classNames(
                    'flex min-h-touch items-center gap-2 rounded-xl px-3 text-xs font-bold transition',
                    aktif(href) ? 'bg-primary-600 text-white' : 'border border-line text-ink-muted',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              ))}
              <Link href="/home" className="col-span-2 flex min-h-touch items-center justify-center gap-2 rounded-xl bg-surface-sunken text-xs font-bold text-ink-muted">
                <ArrowLeft className="h-4 w-4" /> Kembali ke aplikasi siswa
              </Link>
            </nav>
          ) : null}

          <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6" style={{ maxWidth: '100%' }}>
            <div className="mx-auto w-full max-w-4xl">{children}</div>
          </main>
        </div>
      </div>

      {!isAdmin ? (
        <p className="fixed bottom-0 left-0 right-0 z-40 border-t border-accent-200 bg-accent-50 px-4 py-2 text-center text-[11px] font-semibold text-accent-800 dark:border-accent-500/25 dark:bg-accent-500/10 dark:text-accent-200">
          Kamu masuk sebagai <b>Anggota OSIS</b>: bisa memoderasi &amp; membalas tiket, tapi tidak
          bisa mengubah role / menghapus data siswa.
        </p>
      ) : null}
    </AuthGate>
  );
}
