'use client';

import { create } from 'zustand';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { classNames, uid } from '@/lib/utils';

const useToastStore = create((set) => ({
  daftar: [],
  tambah: (t) => {
    const item = { id: uid('toast'), durasi: 3800, ...t };
    set((s) => ({ daftar: [...s.daftar.slice(-2), item] }));
    if (item.durasi > 0) {
      setTimeout(() => set((s) => ({ daftar: s.daftar.filter((x) => x.id !== item.id) })), item.durasi);
    }
    return item.id;
  },
  hapus: (id) => set((s) => ({ daftar: s.daftar.filter((x) => x.id !== id) })),
}));

export const toast = {
  sukses: (pesan, opts) => useToastStore.getState().tambah({ jenis: 'sukses', pesan, ...opts }),
  error: (pesan, opts) => useToastStore.getState().tambah({ jenis: 'error', pesan, durasi: 5200, ...opts }),
  info: (pesan, opts) => useToastStore.getState().tambah({ jenis: 'info', pesan, ...opts }),
  warning: (pesan, opts) => useToastStore.getState().tambah({ jenis: 'warning', pesan, durasi: 5000, ...opts }),
};

const GAYA = {
  sukses: { Ikon: CheckCircle2, cls: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/80 dark:text-emerald-100' },
  error: { Ikon: XCircle, cls: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/80 dark:text-rose-100' },
  warning: { Ikon: AlertTriangle, cls: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-100' },
  info: { Ikon: Info, cls: 'border-primary-300 bg-primary-50 text-primary-900 dark:border-primary-500/30 dark:bg-primary-950/80 dark:text-primary-100' },
};

export function Toaster() {
  const daftar = useToastStore((s) => s.daftar);
  const hapus = useToastStore((s) => s.hapus);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-3 area-aman-atas"
      role="status"
      aria-live="polite"
    >
      {daftar.map((t) => {
        const { Ikon, cls } = GAYA[t.jenis] || GAYA.info;
        return (
          <div
            key={t.id}
            className={classNames(
              'pointer-events-auto flex w-full max-w-shell animate-slide-up items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg',
              cls,
            )}
          >
            <Ikon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm font-medium leading-snug">{t.pesan}</p>
            <button
              type="button"
              onClick={() => hapus(t.id)}
              aria-label="Tutup notifikasi"
              className="-mr-1 -mt-1 rounded-md p-1 opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Toaster;
