'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Flag, MessageCircle, Send, Sparkles } from 'lucide-react';
import Header from '@/components/Header';
import PostCard, { SheetLapor } from '@/components/PostCard';
import { KomentarItem } from '@/components/ChatBubble';
import Button from '@/components/ui/Button';
import { Avatar, EmptyState, Skeleton, Spinner } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { censor } from '@/lib/censor';
import { buatPembatas } from '@/lib/useQuery';
import { LIMITS, RATE_LIMITS } from '@/lib/constants';
import { classNames, waktuRelatif } from '@/lib/utils';

const batasKomentar = buatPembatas(RATE_LIMITS.komentarPer5Menit, 5 * 60 * 1000);

/**
 * /post/[id] - detail post + seluruh komentar.
 * Komentar di channel Aspirasi otomatis ikut anonim.
 */
export default function DetailPost({ id }) {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);

  const [post, setPost] = useState(null);
  const [komentar, setKomentar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [kirim, setKirim] = useState(false);
  const [lapor, setLapor] = useState(false);
  const [audit, setAudit] = useState(false);
  const [reaksiSaya, setReaksiSaya] = useState(null);
  const inputRef = useRef(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sb = getSupabaseBrowser();
      const { data: p, error: e } = await sb
        .from('posts')
        .select(`id, channel_id, author_id, is_anonymous, title, content, media_urls, status, pinned,
                 comment_count, like_count, created_at,
                 author:profiles!posts_author_id_fkey(id, username, nama_lengkap, avatar_url, role, nis),
                 channel:channels!posts_channel_id_fkey(id, slug, name, type)`)
        .eq('id', id)
        .maybeSingle();

      if (e) throw new Error(e.message);
      if (!p) {
        setError('Post tidak ditemukan atau sudah dihapus.');
        setLoading(false);
        return;
      }
      setPost(p);

      const res = await apiGet(`/api/comments?post_id=${id}&limit=100`);
      setKomentar(res.ok ? res.data.comments || [] : []);

      if (profile) {
        const r = await apiGet(`/api/reactions?post_ids=${id}`);
        if (r.ok) setReaksiSaya(r.data.reaksi?.[id] || null);
      }
    } catch (e2) {
      setError(e2.message || 'Gagal memuat post.');
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function kirimKomentar(e) {
    e?.preventDefault();
    const teks = draft.trim();
    if (!teks) return;
    if (!profile) {
      toast.info('Login dulu untuk berkomentar.');
      return router.push(`/login?next=${encodeURIComponent(`/post/${id}`)}`);
    }
    const cek = batasKomentar();
    if (!cek.ok) return toast.warning(`Tunggu ${cek.tunggu} detik lagi (maks ${RATE_LIMITS.komentarPer5Menit} komentar/5 menit).`);

    setKirim(true);
    const anonim = post?.is_anonymous || post?.channel?.type === 'aspirasi';
    const res = await apiPost('/api/comments', {
      post_id: id,
      content: censor(teks),
      is_anonymous: anonim,
    });
    setKirim(false);
    if (!res.ok) {
      toast.error(res.message || 'Gagal mengirim komentar.');
      return;
    }
    setDraft('');
    setKomentar((arr) => [...arr, res.data.comment]);
    setPost((p) => ({ ...p, comment_count: (p?.comment_count || 0) + 1 }));
  }

  async function hapusKomentar(k) {
    const res = await apiDelete(`/api/comments/${k.id}`);
    if (!res.ok) return toast.error(res.message || 'Gagal menghapus komentar.');
    setKomentar((arr) => arr.filter((x) => x.id !== k.id));
    setPost((p) => ({ ...p, comment_count: Math.max(0, (p?.comment_count || 1) - 1) }));
    toast.sukses('Komentar dihapus.');
  }

  if (loading) {
    return (
      <>
        <Header judul="Memuat…" back hrefBack="/home" />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </>
    );
  }

  if (error || !post) {
    return (
      <>
        <Header judul="Post" back hrefBack="/home" />
        <EmptyState
          judul="Tidak bisa dibuka"
          pesan={error}
          icon={EyeOff}
          aksi={<Button onClick={() => router.push('/home')}>Kembali ke Home</Button>}
        />
      </>
    );
  }

  return (
    <>
      <Header
        judul={post.channel?.name || 'Post'}
        subtitle={waktuRelatif(post.created_at)}
        back
        kanan={
          <div className="flex items-center gap-1">
            {isStaff && post.is_anonymous ? (
              <button
                type="button"
                onClick={() => setAudit((v) => !v)}
                aria-pressed={audit}
                className={classNames(
                  'flex min-h-touch-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold',
                  audit ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200' : 'border border-line text-ink-muted',
                )}
                title="Lihat identitas penulis anonim (audit)"
              >
                <Sparkles className="h-3.5 w-3.5" /> {audit ? 'Audit ON' : 'Audit'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLapor(true)}
              aria-label="Laporkan post"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
            >
              <Flag className="h-[18px] w-[18px]" />
            </button>
          </div>
        }
      />

      <div className="space-y-3 px-4 pb-4 pt-3">
        <PostCard
          post={{ ...post, channel: post.channel }}
          channelSlug={post.channel?.slug}
          auditMode={audit}
          reaksiAwal={reaksiSaya}
          tampilkanIsi
          onRefresh={muat}
        />

        {/* komentar */}
        <section className="kartu overflow-hidden">
          <h2 className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-extrabold">
            <MessageCircle className="h-4 w-4 text-primary-500" />
            Komentar
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-ink-muted">
              {komentar.length}
            </span>
            {post.is_anonymous || post.channel?.type === 'aspirasi' ? (
              <span className="ml-auto text-[10.5px] font-bold text-ink-faint">mode anonim</span>
            ) : null}
          </h2>

          {!komentar.length ? (
            <p className="px-4 py-6 text-center text-xs text-ink-muted">
              Belum ada komentar. Jadilah yang pertama menanggapi.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {komentar.map((k) => (
                <KomentarItem key={k.id} komentar={k} onHapus={hapusKomentar} auditMode={audit} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* input komentar sticky */}
      <div
        className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface-raised/95 px-3 py-2 backdrop-blur"
        style={{ marginBottom: 'calc(-4.25rem - env(safe-area-inset-bottom))' }}
      >
        <form onSubmit={kirimKomentar} className="flex items-end gap-2">
          <Avatar
            nama={post.is_anonymous ? 'A' : profile?.nama_lengkap || profile?.username}
            src={post.is_anonymous ? null : profile?.avatar_url}
            anonim={post.is_anonymous || post.channel?.type === 'aspirasi'}
            ukuran={34}
          />
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, LIMITS.komentarKarakter))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  kirimKomentar(e);
                }
              }}
              rows={1}
              placeholder={
                profile
                  ? post.is_anonymous || post.channel?.type === 'aspirasi'
                    ? 'Komentar sebagai Anonim…'
                    : 'Tulis komentar…'
                  : 'Login untuk berkomentar'
              }
              aria-label="Tulis komentar"
              className="input-dasar max-h-28 min-h-[44px] resize-none py-2.5 text-[15px]"
              disabled={kirim}
            />
          </div>
          <Button
            type="submit"
            ukuran="ikon"
            aria-label="Kirim komentar"
            disabled={!draft.trim() || kirim}
            className="h-11 w-11 rounded-xl"
          >
            {kirim ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-[18px] w-[18px]" />}
          </Button>
        </form>
        <p className="mt-1 text-center text-[10px] text-ink-faint">
          Tekan Enter untuk kirim · maks {RATE_LIMITS.komentarPer5Menit} komentar / 5 menit · kata kasar disensor
        </p>
      </div>

      <SheetLapor terbuka={lapor} onClose={() => setLapor(false)} targetType="post" targetId={post.id} onSuccess={muat} />
    </>
  );
}
