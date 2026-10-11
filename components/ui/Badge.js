'use client';

import { classNames } from '@/lib/utils';

const WARNA = {
  netral: 'bg-surface-sunken text-ink-muted border-line',
  primer: 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-500/15 dark:text-primary-300 dark:border-primary-500/25',
  emas: 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-500/15 dark:text-accent-300 dark:border-accent-500/25',
  sukses: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
  bahaya: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25',
  info: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25',
};

const UKURAN = {
  xs: 'px-1.5 py-0.5 text-[10px] gap-0.5',
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1',
};

/** Badge / label kecil. */
export default function Badge({
  children,
  warna = 'netral',
  ukuran = 'sm',
  className,
  icon: Icon,
  ...props
}) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
        WARNA[warna] || WARNA.netral,
        UKURAN[ukuran] || UKURAN.sm,
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
