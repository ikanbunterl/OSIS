'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, Eye, Image as ImageIcon, MessageCircle, Palette, Plus, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import VerifiedBadge from '@/components/VerifiedBadge';
import { Avatar, EmptyState, Fab, Skeleton } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { ambilJson } from '@/lib/useQuery';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { CHANNEL } from '@/lib/constants';
import { classNames, waktuRelatif } from '@/lib/utils';

/**
 * /talent - grid karya siswa (PLAN Bagian 7: "Grid media, lazy load").
 * Klik kartu -> detail post + komentar.
 */
export default function TalentPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mediaMap, setMediaMap] = useState({}); // postId -> url gambar pertama
  const bukaComposer = useStore((s) => s.bukaComposer);
  const profile = useStore((s) => s.profile);

  async function muat() {
    setLoading(true);
    try {
      const res = await ambilJson(`/api/feed?slug=${CHANNEL.TALENT}&limit=60`);
      setPosts(res.posts || []);
      await muatGambar(res.posts || []);
    } catch (e) {
      toast.error(e.message || 'Gagal memuat galeri.');
    } finally {
      setLoading(false);
    }
  }

  async function muatGambar(daftar) {
    const sb = getSupabaseBrowser();
    const peta = {};
    await Promise.all(
      daftar.map(async (p) => {
        const path = p.media_urls?.[0];
        if (!path) return;
        if (/^https?:\/\//.test(path)) {
          peta[p.id] = path;
          return;
        }
        const bersih = path.replace(/^media\//, '');
        peta[p.id] = sb.storage.from('media').getPublicUrl(bersih).data.publicUrl;
      }),
    );
    setMediaMap(peta);
  }

  useEffect(() => {
    muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tanpaGambar = posts.filter((p) => !p.media_urls?.length);

  return (
    <>
      <Header
        judul="Talent"
        subtitle="Galeri karya & bakat warga TD2"
        kanan={
          <button
            type="button"
            onClick={muat}
            aria-label="Muat ulang galeri"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
          >
            <RefreshCw className={classNames('h-[18px] w-[18px]', loading && 'animate-spin')} />
          </button>
        }
      />

      <section className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
          <Palette className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight">Punya karya? Pamerkan di sini.</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">
            Desain poster, foto kegiatan, cover lagu, sampai proyek coding — semua boleh.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!profile) return toast.info('Login dulu ya.');
            bukaComposer('talent');
          }}
          className="shrink-0 rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white"
        >
          Unggah
        </button>
      </section>

      <div className="px-4 pb-6 pt-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
            ))}
          </div>
        ) : null}

        {!loading && !posts.length ? (
          <EmptyState
            icon={ImageIcon}
            judul="Galeri masih kosong"
            pesan="Unggah karya pertamamu supaya teman-teman bisa melihat dan mengapresiasi."
            aksi={
              <button
                type="button"
                onClick={() => bukaComposer('talent')}
                className="min-h-touch inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Unggah karya
              </button>
            }
          />
        ) : null}

        {posts.length ? (
          <div className="grid grid-cols-2 gap-2.5">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-sunken"
                aria-label={`Karya: ${p.title || p.content.slice(0, 40)}`}
              >
                {mediaMap[p.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaMap[p.id]}
                    alt={p.title || 'Karya siswa'}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary-700 to-primary-900 p-3 text-center text-white">
                    <Palette className="h-5 w-5 opacity-80" />
                    <p className="potong-2 text-[11px] font-semibold leading-snug opacity-90">
                      {p.title || p.content.slice(0, 60)}
                    </p>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent px-2.5 pb-2 pt-8">
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      nama={p.is_anonymous ? 'A' : p.author?.nama_lengkap || p.author?.username}
                      src={p.is_anonymous ? null : p.author?.avatar_url}
                      anonim={p.is_anonymous}
                      ukuran={20}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">
                      {p.is_anonymous ? 'Anonim' : p.author?.nama_lengkap || p.author?.username}
                    </span>
                    <VerifiedBadge role={p.is_anonymous ? 'siswa' : p.author?.role} />
                  </div>
                  <div className="mt-1 flex items-center gap-2.5 text-[10.5px] font-semibold text-white/80">
                    <span className="inline-flex items-center gap-0.5">
                      <ArrowUp className="h-3 w-3" /> {p.like_count || 0}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <MessageCircle className="h-3 w-3" /> {p.comment_count || 0}
                    </span>
                    <span className="ml-auto">{waktuRelatif(p.created_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {tanpaGambar.length && !loading ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-faint">
            <Eye className="h-3 w-3" /> {tanpaGambar.length} karya tanpa gambar tampil sebagai kartu teks
          </p>
        ) : null}
      </div>

      <Fab
        icon={Plus}
        label="Unggah karya"
        onClick={() => {
          if (!profile) {
            toast.info('Login dulu ya.');
            return;
          }
          bukaComposer('talent');
        }}
      />
    </>
  );
}
