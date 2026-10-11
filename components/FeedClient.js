'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Megaphone, MessageSquareQuote, Palette, Plus, RefreshCw, Sparkles, ArrowRight,
} from 'lucide-react';
import Header from '@/components/Header';
import PostCard from '@/components/PostCard';
import { EmptyState, SkeletonKartu, TabBar, Fab } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { CHANNEL } from '@/lib/constants';

const TAB = [
  { id: CHANNEL.OSIS, label: 'OSIS', icon: Megaphone },
  { id: CHANNEL.ASPIRASI, label: 'Aspirasi', icon: MessageSquareQuote },
  { id: CHANNEL.TALENT, label: 'Talent', icon: Palette },
];

const JUDUL = {
  osis: { judul: 'OSIS Official', sub: 'Pengumuman & info resmi' },
  aspirasi: { judul: 'Aspirasi', sub: 'Suara siswa · anonim' },
  talent: { judul: 'Talent', sub: 'Karya & bakat warga TD2' },
};

/**
 * /home - feed gabungan 3 tab (PLAN Bagian 7).
 * Data awal dikirim dari server component (app/(main)/home/page.js),
 * interaksi & refresh dilakukan di sini.
 */
export default function FeedClient({ slugAwal = 'osis', dataAwal = null, buat = false }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [slug, setSlug] = useState(slugAwal);
  const profile = useStore((s) => s.profile);
  const bukaComposer = useStore((s) => s.bukaComposer);
  const [auditMode, setAuditMode] = useState(false);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);

  const isInitial = useRef(true);

  // sinkron dengan ?tab= di URL (dipakai shortcut PWA & deep link)
  useEffect(() => {
    const t = sp.get('tab');
    if (t && TAB.some((x) => x.id === t)) setSlug(t);
    if (sp.get('buat') === '1' && isInitial.current) {
      isInitial.current = false;
      bukaComposer(slug === CHANNEL.OSIS && !isStaff ? 'aspirasi' : slug);
      router.replace('/home', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const { data, loading, error, refresh } = useQuery(
    () => ambilJson(`/api/feed?slug=${slug}&limit=25&semua=${isStaff && auditMode ? 1 : 0}`),
    { deps: [slug, auditMode, profile?.id], awal: dataAwal && dataAwal.channel?.slug === slug ? dataAwal : null },
  );

  const gantiTab = useCallback(
    (id) => {
      setSlug(id);
      router.replace(`/home?tab=${id}`, { scroll: false });
    },
    [router],
  );

  const posts = data?.posts || [];
  const channel = data?.channel || null;
  const info = JUDUL[slug] || JUDUL.osis;

  // apakah user boleh posting di channel ini
  const bolehPosting = channel
    ? channel.can_post === 'verified' || isStaff
    : slug !== CHANNEL.OSIS || isStaff;

  function onFab() {
    if (!profile) return router.push('/login');
    if (slug === CHANNEL.OSIS && !isStaff) {
      toast.info('Hanya OSIS yang bisa membuat pengumuman. Kamu diarahkan ke Aspirasi.');
      return bukaComposer('aspirasi');
    }
    bukaComposer(slug);
  }

  return (
    <>
      <Header
        judul={info.judul}
        subtitle={info.sub}
        kanan={
          <div className="flex items-center gap-1">
            {isStaff && slug === CHANNEL.ASPIRASI ? (
              <button
                type="button"
                onClick={() => setAuditMode((v) => !v)}
                aria-pressed={auditMode}
                className={
                  auditMode
                    ? 'flex min-h-touch-9 items-center gap-1.5 rounded-full bg-amber-100 px-3 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                    : 'flex min-h-touch-9 items-center gap-1.5 rounded-full border border-line px-3 text-[11px] font-bold text-ink-muted'
                }
                title="Mode audit: lihat identitas pengirim aspirasi anonim"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {auditMode ? 'Audit: ON' : 'Mode audit'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={refresh}
              aria-label="Muat ulang feed"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
            >
              <RefreshCw className={loading ? 'h-[18px] w-[18px] animate-spin' : 'h-[18px] w-[18px]'} />
            </button>
          </div>
        }
      />

      <TabBar tabs={TAB} aktif={slug} onChange={gantiTab} className="sticky top-14 z-20 border-b border-line bg-surface/90 backdrop-blur-md" />

      {isStaff && slug === CHANNEL.ASPIRASI && auditMode ? (
        <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <b>Mode audit aktif.</b> Kamu melihat identitas asli pengirim aspirasi. Gunakan hanya
          untuk menindaklanjuti laporan/penyalahgunaan — jangan disebarkan. Semua akses tercatat
          di audit log.
        </div>
      ) : null}

      <div className="space-y-3 px-4 pb-6 pt-3">
        {slug === CHANNEL.ASPIRASI ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-surface-raised p-3.5">
            <MessageSquareQuote className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary-500" />
            <div className="text-xs leading-relaxed text-ink-muted">
              <b className="text-ink">Sampaikan pendapatmu tanpa takut dinilai.</b> Semua kiriman di
              sini anonim bagi siswa lain. OSIS membaca dan menindaklanjuti setiap aspirasi.
              <Link href="/aspirasi" className="ml-1 inline-flex items-center gap-0.5 font-bold text-primary-600 dark:text-primary-300">
                Selengkapnya <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : null}

        {loading && !posts.length ? <SkeletonKartu jumlah={3} /> : null}

        {error ? (
          <EmptyState
            judul="Gagal memuat feed"
            pesan={error}
            icon={RefreshCw}
            aksi={
              <button type="button" onClick={refresh} className="min-h-touch rounded-xl bg-primary-600 px-4 text-sm font-bold text-white">
                Coba lagi
              </button>
            }
          />
        ) : null}

        {!loading && !posts.length && !error ? (
          <EmptyState
            icon={slug === CHANNEL.TALENT ? Palette : slug === CHANNEL.ASPIRASI ? MessageSquareQuote : Megaphone}
            judul={slug === CHANNEL.ASPIRASI ? 'Belum ada aspirasi' : 'Belum ada postingan'}
            pesan={
              slug === CHANNEL.ASPIRASI
                ? 'Jadilah yang pertama menyampaikan pendapat. Ketuk tombol + di kanan bawah.'
                : slug === CHANNEL.TALENT
                  ? 'Unggah karya pertamamu: desain, foto, musik, atau proyek coding.'
                  : 'Pengumuman resmi OSIS akan tampil di sini.'
            }
            aksi={
              bolehPosting ? (
                <button type="button" onClick={onFab} className="min-h-touch inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white">
                  <Plus className="h-4 w-4" /> Buat postingan
                </button>
              ) : null
            }
          />
        ) : null}

        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            channelSlug={slug}
            auditMode={auditMode && isStaff}
            onRefresh={refresh}
          />
        ))}

        {posts.length >= 25 ? (
          <p className="py-2 text-center text-xs text-ink-faint">
            Menampilkan 25 terbaru.{' '}
            <button type="button" onClick={refresh} className="font-bold text-primary-600 underline dark:text-primary-300">
              Muat ulang
            </button>
          </p>
        ) : null}
      </div>

      <Fab icon={Plus} label="Buat postingan" onClick={onFab} />
    </>
  );
}
