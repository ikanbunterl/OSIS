'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { classNames } from '@/lib/utils';

const VARIAN = {
  primer:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-primary-600/50 shadow-sm',
  emas: 'bg-accent-500 text-accent-950 hover:bg-accent-400 active:bg-accent-600 font-semibold',
  sekunder:
    'bg-surface-raised text-ink border border-line hover:bg-surface-sunken active:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  bahaya: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800',
  bahayaLembut:
    'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/25',
  link: 'text-primary-600 hover:underline px-0 dark:text-primary-300',
};

const UKURAN = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'min-h-touch h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'min-h-touch h-12 px-5 text-base rounded-xl gap-2',
  ikon: 'min-h-touch h-10 w-10 rounded-full justify-center p-0',
  ikonSm: 'h-8 w-8 rounded-full justify-center p-0',
};

/**
 * Tombol utama aplikasi. Selalu min-h 44px (touch target) kecuali varian ikon kecil.
 */
const Button = forwardRef(function Button(
  { className, varian = 'primer', ukuran = 'md', loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classNames(
        'inline-flex select-none items-center justify-center font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'active:scale-[0.985]',
        VARIAN[varian] || VARIAN.primer,
        UKURAN[ukuran] || UKURAN.md,
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export default Button;
