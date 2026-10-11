'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpRight, Inbox, Lock, Paperclip, RefreshCw,
  Search, Send, ShieldCheck, Ticket,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Alert, Badge, EmptyState, Segmen, Skeleton, Spinner, TombolSalin } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import EnvKurang from '@/components/EnvKurang';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { KATEGORI_LAPOR_MAP, PRIORITAS_TIKET, STATUS_TIKET } from '@/lib/constants';
import { censor } from '@/lib/censor';
import { classNames, jam, tanggalPanjang, waktuRelatif } from '@/lib/utils';

const FILTER = [
  { id: 'baru', label: 'Baru' },
  { id: 'diproses', label: 'Diproses' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'ditolak', label: 'Ditolak' },
  { id: 'semua', label: 'Semua' },
];

/**
 * /admin/tiket - kelola semua tiket lapor: filter, baca timeline, balas,
 * ubah status & prioritas, lihat identitas pelapor.
 */
function AdminTiketInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const profile = useStore((s) => s.profile);
  const [filter, setFilter] = useState('baru');
  const [cari, setCari] = useState(sp.get('kode') || '');
  const [terbuka, setTerbuka] = useState(sp.get('kode') || null);

  const { data, loading, error, refresh } = useQuery(
    () => ambilJson(`/api/admin/tickets?status=${filter}&q=${encodeURIComponent(cari)}`),
    { deps: [filter, cari, profile?.id] },
  );

  const tickets = data?.tickets || [];

  return (
    <div className="space-y-4">
      <EnvKurang error={error} loading={loading} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Tiket Lapor</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            {data
              ? `${tickets.length} tiket ditampilkan · ${data.jumlah?.baru ?? 0} baru · ${data.jumlah?.diproses ?? 0} diproses`
              : 'Memuat…'}
          </p>
        </div>
        <Button varian="sekunder" ukuran="sm" onClick={refresh} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </Button>
      </div>

      {error ? <Alert jenis="bahaya" judul="Gagal memuat tiket">{error}</Alert> : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari kode tiket, judul, atau NIS pelapor…"
          aria-label="Cari tiket"
          className="input-dasar min-h-touch-11 pl-9"
        />
      </div>

      <Segmen opsi={FILTER} nilai={filter} onChange={setFilter} className="w-full" />

      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-raised p-3 text-[11.5px] leading-relaxed text-ink-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
        <span>
          Identitas pelapor <b className="text-ink">terlihat di sini</b> supaya laporan bisa
          ditindaklanjuti, tapi <b className="text-ink">jangan pernah diumumkan</b> ke siswa lain.
          Membuka tiket tercatat di audit log.
        </span>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : null}

      {!loading && !tickets.length ? (
        <EmptyState
          icon={Inbox}
          judul={filter === 'baru' ? 'Tidak ada tiket baru' : 'Kosong'}
          pesan={filter === 'baru' ? 'Semua laporan sudah ditangani.' : 'Tidak ada tiket pada filter ini.'}
        />
      ) : null}

      <div className="space-y-2.5">
        {tickets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTerbuka(t.kode_tiket);
              router.replace(`/admin/tiket?kode=${t.kode_tiket}`, { scroll: false });
            }}
            className={classNames(
              'kartu block w-full p-3.5 text-left transition active:scale-[0.995] hover:border-primary-300',
              t.unread_admin > 0 && 'border-primary-300 dark:border-primary-500/40',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] font-black tracking-wider text-primary-600 dark:text-primary-300">
                    {t.kode_tiket}
                  </span>
                  <Badge warna={t.priority === 'tinggi' ? 'bahaya' : 'netral'} ukuran="xs">
                    {PRIORITAS_TIKET[t.priority]?.label || t.priority}
                  </Badge>
                  {t.unread_admin > 0 ? (
                    <Badge warna="primer" ukuran="xs">{t.unread_admin} balasan baru</Badge>
                  ) : null}
                </div>
                <h3 className="mt-1 truncate text-sm font-bold">{t.judul}</h3>
                <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                  {KATEGORI_LAPOR_MAP[t.kategori]?.label || t.kategori} ·{' '}
                  {t.author?.nama_lengkap || t.author?.username || 'pelapor terhapus'}
                  {t.author?.nis ? ` (NIS ${t.author.nis})` : ''} · {waktuRelatif(t.created_at)}
                </p>
              </div>
              <span className={classNames('shrink-0 rounded-full px-2 py-1 text-[10.5px] font-bold', STATUS_TIKET[t.status]?.warna)}>
                {STATUS_TIKET[t.status]?.label}
              </span>
            </div>
          </button>
        ))}
      </div>

      <DetailTiket kode={terbuka} onClose={() => { setTerbuka(null); router.replace('/admin/tiket', { scroll: false }); refresh(); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function DetailTiket({ kode, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [balasan, setBalasan] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [kirim, setKirim] = useState(false);
  const [lampiran, setLampiran] = useState(null);
  const profile = useStore((s) => s.profile);

  useEffect(() => {
    if (!kode) {
      setData(null);
      return;
    }
    (async () => {
      setLoading(true);
      const res = await apiGet(`/api/tickets/${encodeURIComponent(kode)}`);
      setLoading(false);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setData(res.data);
      setStatus(res.data.ticket.status);
      setPriority(res.data.ticket.priority);
    })();
  }, [kode]);

  async function muatUlang() {
    if (!kode) return;
    const res = await apiGet(`/api/tickets/${encodeURIComponent(kode)}`);
    if (res.ok) setData(res.data);
  }

  async function kirimBalasan() {
    const teks = balasan.trim();
    if (!teks && !lampiran) return toast.warning('Tulis balasan dulu.');
    setKirim(true);
    try {
      let path = null;
      let nama = null;
      if (lampiran) {
        const sb = getSupabaseBrowser();
        path = `${profile.id}/balasan/${Date.now()}-${lampiran.name}`;
        const { error } = await sb.storage.from('attachments').upload(path, lampiran, {
          contentType: lampiran.type,
          cacheControl: '3600',
        });
        if (error) throw new Error(error.message);
        nama = lampiran.name;
      }
      const res = await apiPost(`/api/tickets/${encodeURIComponent(kode)}`, {
        content: censor(teks || '📎 Lampiran'),
        attachment: path,
        attachment_name: nama,
      });
      if (!res.ok) throw new Error(res.message);
      setBalasan('');
      setLampiran(null);
      toast.sukses('Balasan terkirim ke pelapor.');
      await muatUlang();
    } catch (e) {
      toast.error(e.message || 'Gagal mengirim balasan.');
    } finally {
      setKirim(false);
    }
  }

  async function ubahStatus() {
    setKirim(true);
    const res = await apiPatch('/api/tickets/status', {
      kode_tiket: kode,
      status,
      priority,
    });
    setKirim(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    await muatUlang();
  }

  const t = data?.ticket;
  const messages = data?.messages || [];

  return (
    <Modal
      terbuka={Boolean(kode)}
      onClose={onClose}
      judul={t ? `Tiket ${t.kode_tiket}` : 'Memuat tiket…'}
      deskripsi={t ? `${KATEGORI_LAPOR_MAP[t.kategori]?.label || t.kategori} · dibuat ${tanggalPanjang(t.created_at)}` : ''}
      ukuran="xl"
      tanpaPadding
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      ) : null}

      {t ? (
        <div className="space-y-4 px-4 py-4">
          {/* ringkasan */}
          <div className="rounded-xl border border-line bg-surface-sunken p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={classNames('rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS_TIKET[t.status]?.warna)}>
                {STATUS_TIKET[t.status]?.label}
              </span>
              <span className={classNames('rounded-full border border-line px-2.5 py-1 text-[11px] font-bold', PRIORITAS_TIKET[t.priority]?.warna)}>
                {PRIORITAS_TIKET[t.priority]?.label}
              </span>
              <TombolSalin teks={t.kode_tiket} label="Salin kode" />
              <a
                href={`/lapor/${t.kode_tiket}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-line bg-surface-raised px-2.5 text-[11px] font-bold text-ink-muted"
              >
                Lihat tampilan pelapor <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>

            <h3 className="mt-2.5 text-[15px] font-extrabold leading-snug">{t.judul}</h3>
            {t.lokasi ? <p className="mt-1 text-[11.5px] text-ink-muted"><b>Lokasi:</b> {t.lokasi}</p> : null}
            {t.kontak ? <p className="text-[11.5px] text-ink-muted"><b>Kontak:</b> {t.kontak}</p> : null}

            {t.pelapor ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                Pelapor (rahasia): id {String(t.pelapor).slice(0, 8)}…
              </p>
            ) : null}
          </div>

          {/* timeline */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
              Timeline ({messages.length})
            </h4>
            <div className="space-y-2.5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={classNames(
                    'flex gap-2.5',
                    m.is_admin ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  <span className={classNames(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    m.is_admin ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300' : 'bg-surface-sunken text-ink-muted',
                  )}>
                    {m.is_admin ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  <div className={classNames(
                    'max-w-[80%] rounded-2xl px-3 py-2',
                    m.is_admin
                      ? 'rounded-tr-md bg-primary-600 text-white'
                      : 'rounded-tl-md border border-line bg-surface-raised',
                  )}>
                    <p className={classNames('mb-0.5 text-[10.5px] font-bold', m.is_admin ? 'text-white/75' : 'text-ink-faint')}>
                      {m.is_admin ? 'OSIS / Admin' : 'Pelapor'} · {jam(m.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.content}</p>
                    {m.attachment_url ? (
                      /\.(jpe?g|png|webp|gif)$/i.test(m.attachment || '') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.attachment_url} alt={m.attachment_name || 'Lampiran'} className="mt-2 max-h-56 rounded-lg" />
                      ) : (
                        <a href={m.attachment_url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-black/10 px-2.5 py-1.5 text-[11px] font-bold">
                          <Paperclip className="h-3.5 w-3.5" /> {m.attachment_name || 'Lampiran'}
                        </a>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* balas */}
          <div className="rounded-xl border border-line p-3">
            <Textarea
              label="Balas pelapor"
              value={balasan}
              onChange={(e) => setBalasan(e.target.value.slice(0, 3000))}
              rows={3}
              placeholder="Tulis tanggapan resmi. Pelapor mendapat notifikasi push kalau mengaktifkannya."
              hitung={false}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 text-[11px] font-bold text-ink-muted">
                <Paperclip className="h-3.5 w-3.5" />
                {lampiran ? lampiran.name : 'Lampiran'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => setLampiran(e.target.files?.[0] || null)}
                />
              </label>
              <Button onClick={kirimBalasan} loading={kirim} className="ml-auto">
                <Send className="h-4 w-4" /> Kirim balasan
              </Button>
            </div>
          </div>

          {/* status */}
          <div className="rounded-xl border border-line p-3">
            <p className="label-form">Ubah status & prioritas</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status tiket">
                {Object.entries(STATUS_TIKET).map(([id, s]) => (
                  <option key={id} value={id}>{s.label}</option>
                ))}
              </Select>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Prioritas">
                {Object.entries(PRIORITAS_TIKET).map(([id, s]) => (
                  <option key={id} value={id}>{s.label}</option>
                ))}
              </Select>
              <Button varian="sekunder" onClick={ubahStatus} loading={kirim}>Simpan</Button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !t ? (
        <EmptyState icon={Ticket} judul="Tiket tidak ditemukan" pesan="Mungkin kodenya salah atau tiket sudah dihapus." />
      ) : null}
    </Modal>
  );
}

export default function AdminTiketPage() {
  return (
    <Suspense fallback={<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>}>
      <AdminTiketInner />
    </Suspense>
  );
}
