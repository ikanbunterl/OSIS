'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUp, EyeOff, Flag, MessageCircle, MoreHorizontal, Pin, Trash2, Eye, UserRound,
} from 'lucide-react';
import Modal, { ModalKonfirmasi } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/index';
import VerifiedBadge from '@/components/VerifiedBadge';
import { toast } from '@/components/ui/Toast';
import { apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { ALASAN_REPORT } from '@/lib/constants';
import { classNames, waktuRelatif } from '@/lib/utils';

const NAMA_ANONIM = 'Anonim';

/**
 * Kartu post untuk feed (OSIS / Aspirasi / Talent).
 * - post anonim: nama & avatar disembunyikan untuk SEMUA orang kecuali staff
 *   yang menyalakan mode audit ("lihat identitas asli").
 * - penulis selalu tahu itu miliknya (badge "Postinganmu").
 */
export default function PostCard({
  post,
  channelSlug,
  auditMode = false,          // staff: tampilkan identitas post anonim
  reaksiAwal,                 // 'upvote' kalau saya sudah vote
  likeAwal,
  compact = false,
  onRefresh,
  tampilkanIsi = true,
}) {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const setReaksi = useStore((s) => s.setReaksi);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);

  const [voted, setVoted] = useState(Boolean(reaksiAwal));
  const [jumlah, setJumlah] = useState(post.like_count ?? likeAwal ?? 0);
  const [komentar, setKomentar] = useState(post.comment_count ?? 0);
  const [menu, setMenu] = useState(false);
  const [lapor, setLapor] = useState(false);
  const [hapus, setHapus] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [media, setMedia] = useState(post.media_urls?.length ? post.media_urls.slice(0, 4) : null);

  const anonim = post.is_anonymous;
  const milikSaya = profile?.id && post.author_id === profile.id;
  const tampilNama = anonim && !(auditMode && isStaff)
    ? NAMA_ANONIM
    : post.author?.nama_lengkap || post.author?.username || 'Akun terhapus';
  const tampilUsername = anonim && !(auditMode && isStaff) ? null : post.author?.username;
  const tampilRole = anonim && !(auditMode && isStaff) ? 'siswa' : post.author?.role;

  // ambil signed URL untuk lampiran privat (mis. bukti lapor) / fallback public media
  useEffect(() => {
    let batal = false;
    async function muat() {
      if (!post.media_urls?.length) return;
      const sb = getSupabaseBrowser();
      const hasil = await Promise.all(
        post.media_urls.slice(0, 4).map(async (p) => {
          if (/^https?:\/\//.test(p)) return p;
          const bucket = p.startsWith('attachments/') ? 'attachments' : 'media';
          const path = p.replace(/^(media|attachments)\//, '');
          if (bucket === 'media') return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
          const { data } = await sb.storage.from('attachments').createSignedUrl(path, 600);
          return data?.signedUrl || null;
        }),
      );
      if (!batal) setMedia(hasil.filter(Boolean));
    }
    muat();
    return () => { batal = true; };
  }, [post.media_urls]);

  async function toggleVote() {
    if (!profile) {
      toast.info('Login dulu ya, biar bisa kasih dukungan.');
      router.push('/login');
      return;
    }
    const sebelumnya = voted;
    setVoted(!sebelumnya);
    setJumlah((n) => Math.max(0, n + (sebelumnya ? -1 : 1)));
    const res = await apiPost('/api/reactions', { post_id: post.id, type: 'upvote' });
    if (!res.ok) {
      setVoted(sebelumnya);
      setJumlah((n) => Math.max(0, n + (sebelumnya ? 1 : -1)));
      toast.error(res.message || 'Gagal menyimpan dukungan.');
      return;
    }
    setReaksi(post.id, res.data.aktif ? 'upvote' : null);
    setJumlah(res.data.like_count ?? jumlah);
  }

  async function aksiModerasi(aksi) {
    setSibuk(true);
    const res = await apiPatch('/api/admin/moderation', {
      action: aksi,
      target_type: 'post',
      target_id: post.id,
      reason: 'Tindakan dari kartu post',
    });
    setSibuk(false);
    setMenu(false);
    if (!res.ok) return toast.error(res.message || 'Gagal memproses.');
    toast.sukses(res.data?.message || 'Berhasil.');
    onRefresh?.();
    router.refresh();
  }

  async function hapusPost() {
    setSibuk(true);
    const res = await apiDelete(`/api/posts/${post.id}`);
    setSibuk(false);
    setHapus(false);
    if (!res.ok) return toast.error(res.message || 'Gagal menghapus.');
    toast.sukses('Post dihapus.');
    onRefresh?.();
    router.refresh();
  }

  const status = post.status || 'published';

  return (
    <>
      <article
        className={classNames(
          'kartu relative overflow-hidden',
          status === 'hidden' && 'opacity-70 ring-1 ring-amber-400/40',
          status === 'deleted' && 'opacity-50',
        )}
      >
        {post.pinned ? (
          <div className="flex items-center gap-1.5 border-b border-line bg-accent-50 px-4 py-1.5 text-[11px] font-bold text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
            <Pin className="h-3.5 w-3.5" /> Disematkan
          </div>
        ) : null}

        {/* kepala */}
        <div className="flex items-start gap-3 px-4 pb-2 pt-3.5">
          <Avatar
            nama={anonim && !(auditMode && isStaff) ? 'A' : tampilNama}
            src={anonim && !(auditMode && isStaff) ? null : post.author?.avatar_url}
            anonim={anonim && !(auditMode && isStaff)}
            ukuran={40}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold leading-tight">{tampilNama}</span>
              <VerifiedBadge role={tampilRole} />
              {milikSaya ? (
                <span className="shrink-0 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                  Kamu
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
              {tampilUsername ? <span className="truncate">@{tampilUsername}</span> : null}
              {tampilUsername ? <span aria-hidden="true">·</span> : null}
              <time dateTime={post.created_at}>{waktuRelatif(post.created_at)}</time>
              {anonim ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5 font-semibold text-ink-muted">
                    <UserRound className="h-3 w-3" /> anonim
                  </span>
                </>
              ) : null}
              {auditMode && isStaff && anonim ? (
                <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  AUDIT: NIS {post.author?.nis || '?'}
                </span>
              ) : null}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Opsi postingan"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* isi */}
        {tampilkanIsi ? (
          <div className="px-4 pb-3">
            {post.title ? (
              <h3 className="text-[15px] font-extrabold leading-snug">{post.title}</h3>
            ) : null}
            <p className={classNames('mt-1 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink', !post.title && 'mt-0', compact && 'potong-4')}>
              {post.content}
            </p>

            {media?.length ? (
              <div className={classNames('mt-3 grid gap-1.5 overflow-hidden rounded-xl', media.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                {media.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt={post.title || `Media ${i + 1}`}
                    loading="lazy"
                    className={classNames(
                      'w-full bg-surface-sunken object-cover',
                      media.length === 1 ? 'max-h-80 rounded-xl' : 'aspect-square',
                    )}
                  />
                ))}
              </div>
            ) : null}

            {status !== 'published' ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <EyeOff className="h-3.5 w-3.5" /> Status: {status === 'hidden' ? 'disembunyikan moderator' : status}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* aksi */}
        <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
          <button
            type="button"
            onClick={toggleVote}
            aria-pressed={voted}
            aria-label={voted ? 'Batalkan dukungan' : 'Beri dukungan'}
            className={classNames(
              'flex min-h-touch-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition',
              voted ? 'text-primary-600 dark:text-primary-300' : 'text-ink-muted hover:bg-surface-sunken',
            )}
          >
            <ArrowUp className={classNames('h-[18px] w-[18px]', voted && 'fill-current')} />
            {jumlah > 0 ? jumlah : 'Dukung'}
          </button>

          <Link
            href={`/post/${post.id}`}
            className="flex min-h-touch-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-ink-muted transition hover:bg-surface-sunken"
            aria-label={`Lihat ${komentar} komentar`}
          >
            <MessageCircle className="h-[18px] w-[18px]" />
            {komentar > 0 ? komentar : 'Komentar'}
          </Link>

          <button
            type="button"
            onClick={() => setLapor(true)}
            className="flex min-h-touch-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-ink-muted transition hover:bg-surface-sunken"
            aria-label="Laporkan postingan ini"
          >
            <Flag className="h-[18px] w-[18px]" />
            <span className="sr-only sm:not-sr-only">Lapor</span>
          </button>
        </div>
      </article>

      {/* ---------- menu opsi ---------- */}
      <Modal terbuka={menu} onClose={() => setMenu(false)} judul="Opsi postingan" ukuran="sm" tanpaPadding>
        <div className="divide-y divide-line">
          <OpsiMenu icon={MessageCircle} label="Lihat detail & komentar" onClick={() => { setMenu(false); router.push(`/post/${post.id}`); }} />
          <OpsiMenu icon={Flag} label="Laporkan ke moderator" onClick={() => { setMenu(false); setLapor(true); }} />
          {isStaff ? (
            <>
              {status !== 'hidden' ? (
                <OpsiMenu icon={EyeOff} label="Sembunyikan post (moderasi)" onClick={() => aksiModerasi('hide')} sibuk={sibuk} />
              ) : (
                <OpsiMenu icon={Eye} label="Tampilkan kembali" onClick={() => aksiModerasi('unhide')} sibuk={sibuk} />
              )}
              {milikSaya || isStaff ? (
                <OpsiMenu icon={Trash2} label="Hapus permanen" bahaya onClick={() => { setMenu(false); setHapus(true); }} />
              ) : null}
            </>
          ) : null}
          {milikSaya && !anonim ? (
            <OpsiMenu icon={Trash2} label="Hapus postingan saya" bahaya onClick={() => { setMenu(false); setHapus(true); }} />
          ) : null}
        </div>
      </Modal>

      {/* ---------- lapor konten ---------- */}
      <SheetLapor
        terbuka={lapor}
        onClose={() => setLapor(false)}
        targetType="post"
        targetId={post.id}
      />

      <ModalKonfirmasi
        terbuka={hapus}
        onClose={() => setHapus(false)}
        onConfirm={hapusPost}
        loading={sibuk}
        judul="Hapus postingan?"
        pesan="Post dan seluruh komentarnya akan dihapus permanen. Tindakan ini tercatat di audit log."
        teksKonfirmasi="Hapus"
      />
    </>
  );
}

function OpsiMenu({ icon: Icon, label, onClick, bahaya, sibuk }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sibuk}
      className={classNames(
        'flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition hover:bg-surface-sunken disabled:opacity-60',
        bahaya ? 'text-rose-600 dark:text-rose-400' : 'text-ink',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 opacity-70" aria-hidden="true" />
      {label}
      {sibuk ? <span className="ml-auto text-xs text-ink-faint">…</span> : null}
    </button>
  );
}

/**
 * Sheet "Laporkan konten" - dipakai PostCard, komentar, dan pesan chat.
 */
export function SheetLapor({ terbuka, onClose, targetType, targetId, onSuccess }) {
  const [alasan, setAlasan] = useState('');
  const [detail, setDetail] = useState('');
  const [kirim, setKirim] = useState(false);
  const profile = useStore((s) => s.profile);
  const router = useRouter();

  useEffect(() => {
    if (terbuka) {
      setAlasan('');
      setDetail('');
    }
  }, [terbuka]);

  async function submit() {
    if (!profile) {
      onClose?.();
      toast.info('Login dulu untuk mengirim laporan.');
      router.push('/login');
      return;
    }
    if (!alasan) return toast.warning('Pilih alasan pelaporan dulu.');
    setKirim(true);
    const res = await apiPost('/api/reports', {
      target_type: targetType,
      target_id: targetId,
      reason: alasan,
      detail,
    });
    setKirim(false);
    if (!res.ok) return toast.error(res.message || 'Gagal mengirim laporan.');
    toast.sukses(res.data?.message || 'Laporan terkirim. Terima kasih!');
    onClose?.();
    onSuccess?.();
  }

  return (
    <Modal
      terbuka={terbuka}
      onClose={onClose}
      judul="Laporkan konten"
      deskripsi="Laporan hanya terlihat oleh OSIS & admin. Identitasmu tidak ditampilkan ke terlapor."
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch flex-1 rounded-xl border border-line bg-surface-raised px-4 text-sm font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={kirim || !alasan}
            className="min-h-touch flex-1 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {kirim ? 'Mengirim…' : 'Kirim laporan'}
          </button>
        </div>
      }
    >
      <fieldset>
        <legend className="label-form">Alasan</legend>
        <div className="space-y-1.5">
          {ALASAN_REPORT.map((a) => (
            <label
              key={a}
              className={classNames(
                'flex min-h-touch cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm transition',
                alasan === a
                  ? 'border-primary-500 bg-primary-50 font-semibold text-primary-800 dark:bg-primary-500/10 dark:text-primary-200'
                  : 'border-line bg-surface-raised text-ink-muted',
              )}
            >
              <input
                type="radio"
                name="alasan-report"
                value={a}
                checked={alasan === a}
                onChange={() => setAlasan(a)}
                className="h-4 w-4 accent-primary-600"
              />
              {a}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="label-form mt-4" htmlFor="detail-report">
        Detail tambahan <span className="font-normal text-ink-faint">(opsional)</span>
      </label>
      <textarea
        id="detail-report"
        value={detail}
        onChange={(e) => setDetail(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="Contoh: terjadi di kelas XI RPL 1 pada jam istirahat kedua…"
        className="input-dasar resize-none"
      />
    </Modal>
  );
}


