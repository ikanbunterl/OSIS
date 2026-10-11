'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { classNames } from '@/lib/utils';

/**
 * 1. Daftarkan service worker (/sw.js)
 * 2. Tangkap event `beforeinstallprompt` -> tampilkan tombol "Pasang aplikasi"
 * 3. Deteksi apakah aplikasi sudah terpasang (display-mode: standalone)
 */
export default function RegisterSW() {
  const [prompt, setPrompt] = useState(null);
  const [terpasang, setTerpasang] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const cekTerpasang = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setTerpasang(cekTerpasang());

    const onInstalled = () => {
      setTerpasang(true);
      setPrompt(null);
    };
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setPrompt(e);
    };

    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
          /* offline / tidak didukung - tidak fatal */
        });
      });
    } else if ('serviceWorker' in navigator) {
      // saat development: pastikan SW lama tidak meng-cache kode dev
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    }

    return () => {
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  if (terpasang || !prompt) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') setPrompt(null);
      }}
      className={classNames(
        'fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto',
        'flex w-[calc(100%-2rem)] max-w-shell items-center gap-2.5 rounded-2xl border border-line',
        'bg-surface-raised px-3.5 py-3 text-left shadow-card animate-slide-up',
      )}
      aria-label="Pasang aplikasi ke layar utama"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
        <Download className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-tight">Pasang aplikasi OSIS TD2</span>
        <span className="block text-[11.5px] leading-tight text-ink-muted">
          Buka lebih cepat dari layar utama & bisa diakses saat offline
        </span>
      </span>
      <span className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white">
        Pasang
      </span>
    </button>
  );
}
