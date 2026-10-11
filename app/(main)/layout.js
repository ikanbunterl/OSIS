'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import ComposerSheet from '@/components/ComposerSheet';
import AuthGate from '@/components/AuthGate';
import { useStore } from '@/lib/store';
import { getSupabaseBrowser } from '@/lib/supabase/client';

/**
 * Layout grup (main): semua halaman siswa dengan bottom nav 5 tab.
 * - gerbang login (AuthGate)
 * - composer global (dipanggil lewat store: bukaComposer('aspirasi'|'osis'|'talent'))
 * - badge notifikasi di tab Chat & Lapor (polling ringan 60 detik)
 */
export default function MainLayout({ children }) {
  const pathname = usePathname() || '';
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const profile = useStore((s) => s.profile);
  const setBadge = useStore((s) => s.setBadge);
  const composerTerbuka = useStore((s) => s.composerTerbuka);
  const composerChannel = useStore((s) => s.composerChannel);
  const tutupComposer = useStore((s) => s.tutupComposer);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  /* ---- hitung badge: tiket belum dibaca + pesan chat terakhir ---- */
  useEffect(() => {
    if (!profile?.id) {
      setBadge({ chat: 0, lapor: 0 });
      return undefined;
    }
    let berhenti = false;
    const sb = getSupabaseBrowser();

    async function hitung() {
      if (berhenti) return;
      const sejak = new Date(Date.now() - 3 * 86400000).toISOString();

      const [tiket, chat] = await Promise.all([
        sb
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', profile.id)
          .gt('unread_reporter', 0),
        sb
          .from('chat_messages')
          .select('id, created_at', { count: 'exact' })
          .gte('created_at', sejak)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (berhenti) return;
      let chatBaru = 0;
      const pesanTerakhir = chat.data?.[0];
      if (pesanTerakhir) {
        try {
          const terakhirDibaca = localStorage.getItem('osis-chat-terbaca') || '0';
          if (new Date(pesanTerakhir.created_at).getTime() > Number(terakhirDibaca)) chatBaru = 1;
        } catch { chatBaru = 0; }
      }
      setBadge({ lapor: tiket.count || 0, chat: chatBaru });
    }

    hitung();
    const interval = setInterval(hitung, 60000);
    return () => {
      berhenti = true;
      clearInterval(interval);
    };
  }, [profile?.id, setBadge]);

  return (
    <AuthGate>
      <div className="flex min-h-dvh flex-1 flex-col">
        <main
          id="konten"
          className="flex-1"
          style={{ paddingBottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </main>
        <BottomNav />
      </div>

      <ComposerSheet
        terbuka={composerTerbuka}
        onClose={tutupComposer}
        mode={composerChannel || 'aspirasi'}
      />
    </AuthGate>
  );
}
