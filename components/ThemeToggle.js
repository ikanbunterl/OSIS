'use client';

import { useEffect } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useStore } from '@/lib/store';
import { classNames } from '@/lib/utils';

const OPSI = [
  { id: 'system', label: 'Ikut sistem', Icon: Monitor },
  { id: 'light', label: 'Terang', Icon: Sun },
  { id: 'dark', label: 'Gelap', Icon: Moon },
];

/**
 * Pengalih tema. Default: ikut `prefers-color-scheme` (PLAN Bagian 7 - Aksesibilitas).
 * Pilihan disimpan di localStorage dan diterapkan dengan class `dark` di <html>.
 */
export default function ThemeToggle({ className }) {
  const { tema, setTema } = useStore();

  useEffect(() => {
    let tersimpan = null;
    try {
      tersimpan = localStorage.getItem('osis-tema');
    } catch { /* private mode */ }
    const nilai = tersimpan || 'system';
    setTema(nilai);
    terapkan(nilai);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const now = localStorage.getItem('osis-tema') || 'system';
      if (now === 'system') terapkan('system');
    };
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [setTema]);

  function pilih(id) {
    setTema(id);
    try {
      localStorage.setItem('osis-tema', id);
    } catch { /* ignore */ }
    terapkan(id);
  }

  return (
    <div className={classNames('inline-flex rounded-xl border border-line bg-surface-sunken p-1', className)} role="radiogroup" aria-label="Tema tampilan">
      {OPSI.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={tema === id}
          onClick={() => pilih(id)}
          title={label}
          className={classNames(
            'flex min-h-touch-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition sm:px-3',
            tema === id ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function terapkan(mode) {
  const root = document.documentElement;
  const gelap =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', gelap);
  root.style.colorScheme = gelap ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', gelap ? '#090c18' : '#f8fafc');
}

export { terapkan as terapkanTema };
