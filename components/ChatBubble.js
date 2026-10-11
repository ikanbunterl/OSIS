'use client';

import { useState } from 'react';
import { Check, Flag, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/index';
import VerifiedBadge from '@/components/VerifiedBadge';
import { SheetLapor } from '@/components/PostCard';
import { useStore } from '@/lib/store';
import { classNames, jam, labelHariChat, waktuRelatif } from '@/lib/utils';

/**
 * Bubble chat. Identitas SELALU terlihat di chat (bukan channel anonim),
 * jadi aturan mainnya: chat = ruang publik bernama.
 */
export function ChatBubble({ pesan, sayaId, staffMode = false, onHapus }) {
  const [menu, setMenu] = useState(false);
  const [lapor, setLapor] = useState(false);
  const profile = useStore((s) => s.profile);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);

  const punyaSaya = pesan.author_id === sayaId;
  const terhapus = Boolean(pesan.deleted_at) && !staffMode;
  const optimis = Boolean(pesan._optimis);
  const gagal = Boolean(pesan._gagal);

  return (
    <>
      <div className={classNames('group flex w-full gap-2 px-3', punyaSaya ? 'flex-row-reverse' : 'flex-row')}>
        <Avatar
          nama={pesan.author?.nama_lengkap || pesan.author?.username || '?'}
          src={pesan.author?.avatar_url}
          ukuran={30}
          className="mt-auto mb-0.5"
        />

        <div className={classNames('flex max-w-[78%] flex-col', punyaSaya && 'items-end')}>
          <div className={classNames('mb-0.5 flex items-center gap-1 px-1 text-[11px] text-ink-faint')}>
            <span className="font-bold text-ink-muted">
              {pesan.author?.nama_lengkap || pesan.author?.username || 'Siswa'}
            </span>
            <VerifiedBadge role={pesan.author?.role} ukuran="sm" />
            <span aria-hidden="true">·</span>
            <time dateTime={pesan.created_at}>{jam(pesan.created_at)}</time>
            {gagal ? <span className="font-bold text-rose-500">· gagal kirim</span> : null}
          </div>

          <div
            className={classNames(
              'relative rounded-2xl px-3 py-2 text-[14.5px] leading-relaxed shadow-sm',
              punyaSaya
                ? 'rounded-br-md bg-primary-600 text-white'
                : 'rounded-bl-md border border-line bg-surface-raised text-ink',
              optimis && 'opacity-60',
              gagal && 'ring-1 ring-rose-400',
              terhapus && 'italic opacity-70',
            )}
          >
            <p className="whitespace-pre-wrap break-words">
              {terhapus ? 'Pesan ini telah ditarik oleh moderator.' : pesan.content}
            </p>

            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="Opsi pesan"
              className={classNames(
                'absolute -top-2 h-6 w-6 items-center justify-center rounded-full border border-line bg-surface-raised text-ink-faint shadow-sm',
                menu ? 'flex' : 'hidden group-hover:flex',
                punyaSaya ? '-left-7' : '-right-7',
              )}
            >
              <Flag className="h-3 w-3" />
            </button>
          </div>

          {menu ? (
            <div className="mt-1 flex gap-1 px-1">
              <button
                type="button"
                onClick={() => { setMenu(false); setLapor(true); }}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-2 py-1 text-[11px] font-semibold text-ink-muted"
              >
                <Flag className="h-3 w-3" /> Lapor
              </button>
              {(punyaSaya || isStaff) && onHapus && !pesan.deleted_at ? (
                <button
                  type="button"
                  onClick={() => { setMenu(false); onHapus(pesan); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-raised px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400"
                >
                  <Trash2 className="h-3 w-3" /> {punyaSaya ? 'Tarik pesan' : 'Hapus (moderasi)'}
                </button>
              ) : null}
              {pesan.deleted_at && isStaff ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  sudah ditarik moderator
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <SheetLapor terbuka={lapor} onClose={() => setLapor(false)} targetType="chat" targetId={pesan.id} />
    </>
  );
}

/** Pemisah tanggal di tengah percakapan. */
export function PemisahTanggal({ tanggal }) {
  return (
    <div className="my-3 flex items-center gap-3 px-4" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-ink-faint">
        {labelHariChat(tanggal)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Baris komentar di halaman detail post. */
export function KomentarItem({ komentar, onHapus, staffMode = false, auditMode = false }) {
  const [lapor, setLapor] = useState(false);
  const profile = useStore((s) => s.profile);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);
  const milikSaya = komentar.author_id === profile?.id;

  const anonim = komentar.is_anonymous;
  const nama = anonim && !(auditMode && isStaff)
    ? 'Anonim'
    : komentar.author?.nama_lengkap || komentar.author?.username || 'Akun terhapus';

  return (
    <>
      <div className="flex gap-2.5 px-4 py-2.5">
        <Avatar
          nama={nama}
          src={anonim && !(auditMode && isStaff) ? null : komentar.author?.avatar_url}
          anonim={anonim && !(auditMode && isStaff)}
          ukuran={32}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-bold">{nama}</span>
            {!anonim ? <VerifiedBadge role={komentar.author?.role} /> : null}
            <span className="shrink-0 text-[11px] text-ink-faint">{waktuRelatif(komentar.created_at)}</span>
            {milikSaya ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-primary-50 px-1 text-[10px] font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                <Check className="h-2.5 w-2.5" /> kamu
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{komentar.content}</p>
          <div className="mt-1 flex gap-3">
            <button type="button" onClick={() => setLapor(true)} className="text-[11px] font-semibold text-ink-faint hover:text-rose-500">
              Lapor
            </button>
            {(milikSaya && !anonim) || isStaff ? (
              <button
                type="button"
                onClick={() => onHapus?.(komentar)}
                className="text-[11px] font-semibold text-ink-faint hover:text-rose-500"
              >
                Hapus
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <SheetLapor terbuka={lapor} onClose={() => setLapor(false)} targetType="comment" targetId={komentar.id} />
    </>
  );
}
