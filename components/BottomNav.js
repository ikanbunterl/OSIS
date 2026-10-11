'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, MessageCircle, Palette, Inbox, User } from 'lucide-react';
import { classNames } from '@/lib/utils';
import { useStore } from '@/lib/store';

const MENU = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/chat', label: 'Chat', Icon: MessageCircle, badgeKey: 'chat' },
  { href: '/talent', label: 'Talent', Icon: Palette },
  { href: '/lapor', label: 'Lapor', Icon: Inbox, badgeKey: 'lapor' },
  { href: '/profil', label: 'Profil', Icon: User },
];

/**
 * Bottom navigation 5 tab (PLAN Bagian 7).
 * - target sentuh >= 44px
 * - aman untuk notch/home indicator iPhone (env(safe-area-inset-bottom))
 * - badge notifikasi di Chat & Lapor
 */
export default function BottomNav() {
  const pathname = usePathname() || '';
  const badge = useStore((s) => s.badge);

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex w-full max-w-shell items-stretch justify-between">
        {MENU.map(({ href, label, Icon, badgeKey }) => {
          const aktif = pathname === href || pathname.startsWith(`${href}/`);
          const jumlah = badgeKey ? badge[badgeKey] || 0 : 0;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={aktif ? 'page' : undefined}
                className={classNames(
                  'relative flex min-h-touch flex-col items-center justify-center gap-0.5 py-1.5 transition',
                  aktif ? 'text-primary-600 dark:text-primary-300' : 'text-ink-faint hover:text-ink-muted',
                )}
              >
                <span className="relative">
                  <Icon className={classNames('h-[22px] w-[22px]', aktif && 'stroke-[2.4]')} aria-hidden="true" />
                  {jumlah > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                      {jumlah > 9 ? '9+' : jumlah}
                    </span>
                  ) : null}
                </span>
                <span className={classNames('text-[10.5px] font-semibold leading-none', aktif && 'font-bold')}>
                  {label}
                </span>
                {aktif ? (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
