'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { classNames } from '@/lib/utils';

/**
 * Modal / bottom-sheet mobile-first.
 * - tampil sebagai sheet dari bawah di layar kecil, dialog di tengah pada desktop
 * - tutup dengan Escape, klik backdrop, atau tombol X
 * - fokus dikunci di dalam dialog (trap sederhana) + scroll body dikunci
 */
export default function Modal({
  terbuka = false,
  onClose,
  judul,
  deskripsi,
  children,
  footer,
  ukuran = 'md',
  tanpaPadding = false,
  className,
}) {
  useEffect(() => {
    if (!terbuka) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Tab') {
        // fokus trap sederhana
        const node = document.getElementById('isi-modal');
        if (!node) return;
        const fokus = node.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!fokus.length) return;
        const pertama = fokus[0];
        const terakhir = fokus[fokus.length - 1];
        if (e.shiftKey && document.activeElement === pertama) {
          e.preventDefault();
          terakhir.focus();
        } else if (!e.shiftKey && document.activeElement === terakhir) {
          e.preventDefault();
          pertama.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [terbuka, onClose]);

  if (!terbuka) return null;

  const lebar = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' }[ukuran];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={typeof judul === 'string' ? judul : 'Dialog'}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="isi-modal"
        className={classNames(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface-raised',
          'rounded-t-3xl animate-sheet-up sm:rounded-2xl sm:animate-slide-up sm:shadow-2xl',
          lebar,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 pb-3 pt-4 area-aman-atas sm:pt-4">
          <div className="min-w-0">
            {judul ? <h2 className="text-base font-bold leading-tight">{judul}</h2> : null}
            {deskripsi ? <p className="mt-0.5 text-xs text-ink-muted">{deskripsi}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={classNames(
            'scroll-halus flex-1 overflow-y-auto overscroll-contain',
            !tanpaPadding && 'px-4 py-4',
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="border-t border-line bg-surface px-4 py-3 area-aman-bawah">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/** Dialog konfirmasi singkat (ganti window.confirm yang jelek di mobile). */
export function ModalKonfirmasi({
  terbuka,
  onClose,
  onConfirm,
  judul = 'Yakin?',
  pesan,
  teksKonfirmasi = 'Ya, lanjutkan',
  varian = 'bahaya',
  loading = false,
}) {
  return (
    <Modal
      terbuka={terbuka}
      onClose={onClose}
      judul={judul}
      ukuran="sm"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch flex-1 rounded-xl border border-line bg-surface-raised px-4 text-sm font-semibold hover:bg-surface-sunken"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={classNames(
              'min-h-touch flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60',
              varian === 'bahaya' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700',
            )}
          >
            {loading ? 'Memproses…' : teksKonfirmasi}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-ink-muted">{pesan}</p>
    </Modal>
  );
}
