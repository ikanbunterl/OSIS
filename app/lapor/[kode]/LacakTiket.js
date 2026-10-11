'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Inbox, Lock, LogIn, Paperclip, Send, ShieldCheck, Ticket,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton, TombolSalin } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { KATEGORI_LAPOR_MAP, PRIORITAS_TIKET, STATUS_TIKET } from '@/lib/constants';
import { censor } from '@/lib/censor';
import { classNames, jam, labelHariChat, tanggalPanjang, waktuRelatif } from '@/lib/utils';

/**
 * Detail + timeline tiket lapor.
 * Bisa dibuka tanpa login (cukup kode). Balas pesan butuh login sebagai
 * pemilik tiket atau sebagai staff.
 */
export default function LacakTiket({ kode }) {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pesanError, setPesanError] = useState('');
  const [balasan, setBalasan] = useState('');
  const [kirim, setKirim] = useState(false);
  const ujungRef = useRef(null);

  const kodeBersih = String(kode || '').toUpperCase();

  const muat = useCallback(async () => {
    setLoading(true);
    setPesanError('');
    const res = await apiGet(`/api/tickets/${encodeURIComponent(kodeBersih)}`, { auth: Boolean(profile) });
    setLoading(false);
    if (!res.ok) {
      setPesanError(res.message || 'Gagal memuat tiket.');
      setData(null);
      return;
    }
    setData(res.data);
    setTimeout(() => ujungRef.current?.scrollIntoView({ behavior: 'auto' }), 80);
  }, [kodeBersih, profile]);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (kodeBersih) muat();
  }, [kodeBersih, muat]);

  async function kirimBalasan(e) {
    e?.preventDefault();
    const teks = balasan.trim();
    if (!teks) return;
    if (!profile) {
      toast.info('Login dulu untuk membalas laporan ini.');
      router.push(`/login?next=${encodeURIComponent(`/lapor/${kodeBersih}`)}`);
      return;
    }
    setKirim(true);
    const res = await apiPost(`/api/tickets/${encodeURIComponent(kodeBersih)}`, { content: censor(teks) });
    setKirim(false);
    if (!res.ok) {
      toast.error(res.message || 'Gagal mengirim balasan.');
      return;
    }
    setBalasan('');
    toast.sukses('Balasan terkirim.');
    muat();
  }

  /* ---------------- tampilan ---------------- */
  if (loading && !data) {
    return (
      <Shell>
        <div className="space-y-3 px-4 py-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
        </div>
      </Shell>
    );
  }

  if (pesanError || !data?.ticket) {
    return (
      <Shell>
        <EmptyState
          icon={Inbox}
          judul="Tiket tidak ditemukan"
          pesan={pesanError || 'Periksa lagi kode tiketmu. Formatnya LPR- diikuti 6 huruf/angka.'}
          aksi={
            <div className="flex flex-col gap-2">
              <Link
                href="/lapor?tab=lacak"
                className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white"
              >
                <Ticket className="h-4 w-4" /> Coba kode lain
              </Link>
              <Link href="/home" className="text-xs font-bold text-ink-muted underline-offset-2 hover:underline">
                Kembali ke beranda
              </Link>
            </div>
          }
        />
      </Shell>
    );
  }

  const t = data.ticket;
  const status = STATUS_TIKET[t.status] || STATUS_TIKET.baru;
  const prioritas = PRIORITAS_TIKET[t.priority] || PRIORITAS_TIKET.normal;
  const langkah = ['baru', 'diproses', 'selesai'];
  const idx = langkah.indexOf(t.status);
  const messages = data.messages || [];

  let tanggalSebelumnya = null;

  return (
    <Shell>
      {/* kartu status */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-card">
        <div className="border-b border-line bg-gradient-to-br from-primary-700 to-primary-900 px-4 py-3.5 text-white">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">Kode tiket</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-xl font-black tracking-[0.1em]">{t.kode_tiket}</span>
            <TombolSalin teks={t.kode_tiket} label="Salin" className="border-white/25 bg-white/10 text-white hover:text-white" />
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={classNames('rounded-full px-2.5 py-1 text-[11px] font-bold', status.warna)}>{status.label}</span>
            <span className={classNames('rounded-full border border-line px-2.5 py-1 text-[11px] font-bold', prioritas.warna)}>
              Prioritas {prioritas.label}
            </span>
            <span className="rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-ink-muted">
              {KATEGORI_LAPOR_MAP[t.kategori]?.label || t.kategori}
            </span>
          </div>

          <h1 className="mt-2.5 text-[15px] font-extrabold leading-snug">{t.judul}</h1>
          <p className="mt-1 text-[11.5px] text-ink-muted">
            Dibuat {tanggalPanjang(t.created_at)} · update terakhir {waktuRelatif(t.updated_at)}
          </p>

          {t.lokasi ? (
            <p className="mt-1.5 text-[11.5px] text-ink-muted">
              <b className="text-ink">Lokasi:</b> {t.lokasi}
            </p>
          ) : null}

          {/* progres penanganan */}
          <div className="mt-3.5">
            <div className="flex items-center gap-1.5">
              {langkah.map((s, i) => (
                <span
                  key={s}
                  className={classNames(
                    'h-1.5 flex-1 rounded-full transition',
                    t.status === 'ditolak' ? 'bg-rose-400' : i <= idx ? 'bg-emerald-500' : 'bg-line',
                  )}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-bold text-ink-faint">
              <span>Baru</span><span>Diproses</span><span>Selesai</span>
            </div>
          </div>

          {t.status === 'ditolak' ? (
            <p className="mt-2.5 rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              Laporan ini ditolak/ditutup oleh admin. Baca balasan di timeline untuk alasannya.
            </p>
          ) : null}
        </div>
      </div>

      {/* timeline */}
      <div className="mx-4 mt-4">
        <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-faint">
          Timeline ({messages.length})
        </h2>
        <div className="kartu divide-y divide-line overflow-hidden">
          {messages.map((m) => {
            const tanggal = labelHariChat(m.created_at);
            const tampilkanTanggal = tanggal !== tanggalSebelumnya;
            tanggalSebelumnya = tanggal;
            return (
              <div key={m.id}>
                {tampilkanTanggal ? (
                  <p className="bg-surface-sunken px-3.5 py-1.5 text-center text-[10.5px] font-bold text-ink-faint">
                    {tanggal}
                  </p>
                ) : null}
                <div className={classNames('px-3.5 py-3', m.is_admin && 'bg-primary-50/60 dark:bg-primary-500/5')}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={classNames(
                        'inline-flex items-center gap-1 text-[11px] font-bold',
                        m.is_admin ? 'text-primary-700 dark:text-primary-300' : 'text-ink-muted',
                      )}
                    >
                      {m.is_admin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {m.is_admin ? 'OSIS / Admin' : 'Kamu (pelapor)'}
                    </span>
                    <span className="text-[10.5px] text-ink-faint">{jam(m.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.content}</p>

                  {m.attachment ? (
                    <div className="mt-2">
                      {m.attachment_url ? (
                        /\.(jpe?g|png|webp|gif)$/i.test(m.attachment) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.attachment_url}
                            alt={m.attachment_name || 'Lampiran'}
                            className="max-h-64 rounded-xl border border-line object-cover"
                          />
                        ) : (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs font-bold text-primary-600 dark:text-primary-300"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> {m.attachment_name || 'Buka lampiran'}
                          </a>
                        )
                      ) : (
                        <p className="inline-flex items-center gap-1.5 rounded-lg bg-surface-sunken px-3 py-2 text-[11px] text-ink-faint">
                          <Paperclip className="h-3.5 w-3.5" />
                          {m.attachment_name || 'Lampiran'} · login sebagai pemilik/admin untuk membuka
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* balas */}
      <div className="mx-4 mt-4 mb-6">
        {data.bisaBalas ? (
          <form onSubmit={kirimBalasan} className="kartu p-3">
            <label className="label-form" htmlFor="balasan">
              {data.staff ? 'Balas sebagai OSIS/Admin' : 'Tambah keterangan / balasan'}
            </label>
            <textarea
              id="balasan"
              value={balasan}
              onChange={(e) => setBalasan(e.target.value.slice(0, 3000))}
              rows={3}
              placeholder={
                data.staff
                  ? 'Tulis tanggapan resmi. Pelapor akan menerima notifikasi…'
                  : 'Ada informasi tambahan? Sampaikan di sini…'
              }
              className="input-dasar resize-y"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-ink-faint">{balasan.length}/3000</span>
              <Button type="submit" loading={kirim} disabled={!balasan.trim()}>
                {!kirim ? <Send className="h-4 w-4" /> : null}
                Kirim balasan
              </Button>
            </div>
          </form>
        ) : (
          <div className="kartu p-4 text-center">
            <p className="text-xs leading-relaxed text-ink-muted">
              Kamu sedang tidak login sebagai pemilik laporan ini, jadi hanya bisa melihat status.
              Login untuk bisa membalas.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/lapor/${kodeBersih}`)}`}
              className="mt-3 inline-flex min-h-touch items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 text-sm font-bold text-white"
            >
              <LogIn className="h-4 w-4" /> Login sebagai pelapor
            </Link>
          </div>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-ink-faint">
          <Lock className="h-3 w-3" /> Tiket ini privat: hanya pelapor, OSIS, pembina, dan admin yang
          bisa mengakses. Semua balasan tercatat di audit log.
        </p>
      </div>

      <div ref={ujungRef} />
    </Shell>
  );
}

/** Kerangka halaman tanpa bottom nav (bisa diakses tanpa login). */
function Shell({ children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md area-aman-atas">
        <div className="mx-auto flex min-h-touch-14 w-full max-w-shell items-center gap-2 px-3 py-2">
          <Link
            href="/lapor"
            aria-label="Kembali ke menu Lapor"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-sunken"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold leading-tight">Lacak Laporan</h1>
            <p className="truncate text-xs text-ink-muted">Rahasia · tanpa perlu login</p>
          </div>
          <Link
            href="/home"
            className="flex min-h-touch-9 items-center gap-1 rounded-full border border-line px-3 text-[11px] font-bold text-ink-muted"
          >
            Beranda <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <main className="flex-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {children}
      </main>
    </div>
  );
}
