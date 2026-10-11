'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { classNames, uid } from '@/lib/utils';

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={classNames('animate-spin text-ink-faint', className)} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={classNames('skeleton', className)} aria-hidden="true" />;
}

export function SkeletonKartu({ jumlah = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="kartu p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, judul, pesan, aksi }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon ? (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-sunken text-ink-faint">
          <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-base font-bold">{judul}</h3>
      {pesan ? <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">{pesan}</p> : null}
      {aksi ? <div className="mt-5">{aksi}</div> : null}
    </div>
  );
}

/** Banner peringatan di dalam halaman (bukan toast). */
export function Alert({ jenis = 'info', judul, children, className, bisaDitutup = false }) {
  const [tutup, setTutup] = useState(false);
  if (tutup) return null;
  const gaya = {
    info: 'border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-100',
    sukses: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100',
    warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100',
    bahaya: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-100',
  }[jenis];

  return (
    <div className={classNames('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm', gaya, className)} role="alert">
      <div className="min-w-0 flex-1">
        {judul ? <p className="font-bold">{judul}</p> : null}
        <div className={classNames('leading-relaxed', judul && 'mt-0.5')}>{children}</div>
      </div>
      {bisaDitutup ? (
        <button type="button" onClick={() => setTutup(true)} aria-label="Tutup" className="-mr-1 rounded p-1 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Baris daftar (dipakai di profil & admin). */
export function Baris({ icon: Icon, judul, deskripsi, kanan, onClick, bahaya = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={classNames(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition',
        onClick && 'active:bg-surface-sunken hover:bg-surface-sunken',
      )}
    >
      {Icon ? (
        <span className={classNames('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', bahaya ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10' : 'bg-surface-sunken text-ink-muted')}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={classNames('block truncate text-sm font-semibold', bahaya && 'text-rose-600 dark:text-rose-400')}>{judul}</span>
        {deskripsi ? <span className="mt-0.5 block truncate text-xs text-ink-muted">{deskripsi}</span> : null}
      </span>
      {kanan ?? null}
    </Tag>
  );
}

/** Kelompok baris dengan judul + pembatas. */
export function GrupBaris({ judul, children, aksi }) {
  return (
    <section className="mt-5">
      {judul ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">{judul}</h2>
          {aksi}
        </div>
      ) : null}
      <div className="kartu divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

/** Floating action button. */
export function Fab({ icon: Icon, label, onClick, className, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={classNames(
        'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30',
        'flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-fab',
        'transition active:scale-95 hover:bg-primary-700 disabled:opacity-50',
        className,
      )}
    >
      <Icon className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}

/** Tabs horizontal yang bisa di-scroll (dipakai di /home & /chat). */
export function TabBar({ tabs, aktif, onChange, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current?.querySelector(`[data-tab="${aktif}"]`);
    node?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [aktif]);

  return (
    <div
      ref={ref}
      role="tablist"
      className={classNames('tanpa-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5', className)}
    >
      {tabs.map((t) => {
        const on = t.id === aktif;
        return (
          <button
            key={t.id}
            data-tab={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={classNames(
              'flex min-h-touch shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition',
              on
                ? 'bg-primary-600 text-white shadow-sm'
                : 'border border-line bg-surface-raised text-ink-muted hover:text-ink',
            )}
          >
            {t.icon ? <t.icon className="h-4 w-4" aria-hidden="true" /> : null}
            {t.label}
            {t.badge ? (
              <span className={classNames('ml-0.5 rounded-full px-1.5 text-[10px] font-bold', on ? 'bg-white/25' : 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300')}>
                {t.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control kecil (filter). */
export function Segmen({ opsi, nilai, onChange, className }) {
  return (
    <div className={classNames('inline-flex rounded-xl border border-line bg-surface-sunken p-1', className)}>
      {opsi.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === nilai}
          className={classNames(
            'min-h-touch-9 flex-1 rounded-lg px-3 text-xs font-semibold transition',
            o.id === nilai ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Avatar dengan fallback inisial. */
export function Avatar({ src, nama = '?', ukuran = 40, className, anonim = false }) {
  const [gagal, setGagal] = useState(false);
  const gaya = { width: ukuran, height: ukuran, fontSize: Math.max(11, ukuran * 0.36) };
  if (anonim) {
    return (
      <span
        style={gaya}
        className={classNames('flex shrink-0 items-center justify-center rounded-full bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300', className)}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width={ukuran * 0.55} height={ukuran * 0.55} fill="currentColor">
          <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
        </svg>
      </span>
    );
  }
  if (src && !gagal) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={gaya}
        onError={() => setGagal(true)}
        className={classNames('shrink-0 rounded-full object-cover', className)}
        loading="lazy"
      />
    );
  }
  const inisial = String(nama || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const palet = ['bg-primary-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-sky-500'];
  let h = 0;
  for (let i = 0; i < String(nama).length; i += 1) h = (h * 31 + String(nama).charCodeAt(i)) >>> 0;
  return (
    <span
      style={gaya}
      className={classNames('flex shrink-0 items-center justify-center rounded-full font-bold text-white', palet[h % palet.length], className)}
      aria-hidden="true"
    >
      {inisial}
    </span>
  );
}

/** Tombol salin ke clipboard dengan umpan balik "Tersalin". */
export function TombolSalin({ teks, label = 'Salin', className }) {
  const [salin, setSalin] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = teks;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setSalin(true);
        setTimeout(() => setSalin(false), 1800);
      }}
      className={classNames(
        'inline-flex min-h-touch-9 items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-3 text-xs font-semibold text-ink-muted transition hover:text-ink',
        className,
      )}
      aria-label={`${label}: ${teks}`}
    >
      {salin ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
      {salin ? 'Tersalin' : label}
    </button>
  );
}

export { uid };

export { default as Badge } from './Badge';
export { default as Button } from './Button';
export { default as Modal } from './Modal';
