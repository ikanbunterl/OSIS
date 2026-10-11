'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { classNames } from '@/lib/utils';

/** Input teks dengan label, pesan error, hint, dan ikon opsional. */
export const Input = forwardRef(function Input(
  { label, error, hint, className, wrapperClass, icon: Icon, suffix, id, required, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={classNames('w-full', wrapperClass)}>
      {label ? (
        <label className="label-form" htmlFor={inputId}>
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
          className={classNames(
            'input-dasar',
            Icon && 'pl-10',
            suffix && 'pr-11',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/25 dark:border-rose-500/60',
            className,
          )}
          {...props}
        />
        {suffix ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{suffix}</div> : null}
      </div>
      {error ? (
        <p id={`${inputId}-err`} className="mt-1.5 flex items-start gap-1 text-sm text-rose-600 dark:text-rose-400">
          <span aria-hidden="true">•</span>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/** Input password dengan tombol lihat/sembunyikan. */
export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, hint, className, wrapperClass, id, ...props },
  ref,
) {
  const [lihat, setLihat] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={classNames('w-full', wrapperClass)}>
      {label ? (
        <label className="label-form" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={lihat ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          className={classNames(
            'input-dasar pr-12',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/25',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setLihat((v) => !v)}
          aria-label={lihat ? 'Sembunyikan password' : 'Lihat password'}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-sunken"
        >
          {lihat ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-sm text-rose-600 dark:text-rose-400">
          <span aria-hidden="true">•</span>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
});

/** Textarea dengan penghitung karakter. */
export const Textarea = forwardRef(function Textarea(
  { label, error, hint, maxLength, className, wrapperClass, id, hitung = true, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={classNames('w-full', wrapperClass)}>
      {label ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label className="label-form mb-0" htmlFor={inputId}>
            {label}
          </label>
          {hitung && maxLength ? (
            <span className="text-xs text-ink-faint tabular-nums">{maxLength}</span>
          ) : null}
        </div>
      ) : null}
      <textarea
        ref={ref}
        id={inputId}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        className={classNames(
          'input-dasar resize-y leading-relaxed',
          error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/25',
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-sm text-rose-600 dark:text-rose-400">
          <span aria-hidden="true">•</span>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
});

/** Select / dropdown native (paling andal di mobile). */
export const Select = forwardRef(function Select(
  { label, error, hint, children, className, wrapperClass, id, placeholder, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className={classNames('w-full', wrapperClass)}>
      {label ? (
        <label className="label-form" htmlFor={selectId}>
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={classNames(
          'input-dasar appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-10',
          error && 'border-rose-400',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children}
      </select>
      {error ? (
        <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
});

/** Kotak centang dengan label yang bisa diklik. */
export function Checkbox({ label, error, className, id, children, ...props }) {
  const autoId = useId();
  const boxId = id || autoId;
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-2.5 py-1" htmlFor={boxId}>
        <input
          id={boxId}
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-line text-primary-600 accent-primary-600"
          {...props}
        />
        <span className="text-sm leading-snug text-ink-muted">
          {label}
          {children}
        </span>
      </label>
      {error ? <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}
