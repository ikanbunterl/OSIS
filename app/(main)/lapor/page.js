'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight, History, Lock, PhoneCall, Search, ShieldCheck, Ticket, Trash2,
} from 'lucide-react';
import Header from '@/components/Header';
import TicketForm from '@/components/TicketForm';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, EmptyState, Skeleton, TabBar } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { apiGet } from '@/lib/api-client';
import { ambilJson } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { KATEGORI_LAPOR_MAP, STATUS_TIKET } from '@/lib/constants';
import { classNames, waktuRelatif } from '@/lib/utils';

const TAB = [
  { id: 'buat', label: 'Buat Laporan' },
  { id: 'lacak', label: 'Lacak Kode' },
  { id: 'riwayat', label: 'Riwayat Saya' },
];

/**
 * /lapor - layanan lapor rahasia (PLAN Bagian 6).
 * Tiga tab: buat tiket, lacak pakai kode (tanpa login pun bisa), riwayat milik sendiri.
 */
function LaporInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const profile = useStore((s) => s.profile);
  const [tab, setTab] = useState(sp.get('tab') || 'buat');

  useEffect(() => {
    const t = sp.get('tab');
    if (t && TAB.some((x) => x.id === t)) setTab(t);
  }, [sp]);

  return (
    <>
      <Header
        judul="Lapor"
        subtitle="Rahasia · dapat kode tiket · ditindaklanjuti OSIS & pembina"
        kanan={
          <Link
            href="/admin"
            className={classNames(
              'flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-[11px] font-bold text-ink-muted',
              !['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role) && 'hidden',
            )}
          >
            <Ticket className="h-3.5 w-3.5" /> Kelola tiket
          </Link>
        }
      />

      <TabBar
        tabs={TAB}
        aktif={tab}
        onChange={(id) => {
          setTab(id);
          router.replace(`/lapor?tab=${id}`, { scroll: false });
        }}
        className="sticky top-14 z-20 border-b border-line bg-surface/90 backdrop-blur-md"
      />

      <div className="px-4 pb-8 pt-4">
        {tab === 'buat' ? <TabBuat /> : null}
        {tab === 'lacak' ? <TabLacak /> : null}
        {tab === 'riwayat' ? <TabRiwayat /> : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
function TabBuat() {
  return (
    <div className="space-y-4">
      <TicketForm />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function TabLacak() {
  const [kode, setKode] = useState('');
  const [hasil, setHasil] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const disimpan = JSON.parse(localStorage.getItem('osis-tiket') || '[]');
      if (disimpan?.[0]?.kode) setKode(disimpan[0].kode);
    } catch { /* ignore */ }
  }, []);

  async function cek(e) {
    e?.preventDefault();
    const k = kode.trim().toUpperCase();
    if (k.length < 7) return toast.warning('Kode tiket formatnya LPR-XXXXXX.');
    setLoading(true);
    setHasil(null);
    const res = await apiGet(`/api/tickets/${encodeURIComponent(k)}`, { auth: false });
    setLoading(false);
    if (!res.ok) {
      setHasil({ error: res.message });
      return;
    }
    setHasil(res.data);
  }

  return (
    <div className="space-y-4">
      <div className="kartu p-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <Search className="h-4 w-4 text-primary-500" /> Lacak status laporan
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Masukkan kode tiket yang kamu dapat saat membuat laporan. Halaman ini bisa dibuka{' '}
          <b>tanpa login</b> selama kodenya benar — jadi simpan kodenya baik-baik.
        </p>

        <form onSubmit={cek} className="mt-3 flex gap-2">
          <Input
            label=""
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase().slice(0, 12))}
            placeholder="LPR-7F3K9A"
            aria-label="Kode tiket"
            className="font-mono tracking-[0.1em]"
            wrapperClass="flex-1"
          />
          <Button type="submit" loading={loading} className="mt-0 shrink-0">
            Cek
          </Button>
        </form>
      </div>

      {hasil?.error ? (
        <Alert jenis="bahaya" judul="Tidak ditemukan">
          {hasil.error}
        </Alert>
      ) : null}

      {hasil?.ticket ? <KartuTiket ticket={hasil.ticket} messages={hasil.messages} bisaBalas={hasil.bisaBalas} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function TabRiwayat() {
  const profile = useStore((s) => s.profile);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tersimpan, setTersimpan] = useState([]);

  async function muat() {
    setLoading(true);
    try {
      const res = await apiGet('/api/tickets');
      setData(res.ok ? res.data : { error: res.message });
    } catch (e) {
      setData({ error: e.message });
    } finally {
      setLoading(false);
    }
    try {
      setTersimpan(JSON.parse(localStorage.getItem('osis-tiket') || '[]'));
    } catch { setTersimpan([]); }
  }

  useEffect(() => {
    muat();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
      </div>
    );
  }

  const tiket = data?.tickets || [];

  if (data?.error) {
    return (
      <Alert jenis="bahaya" judul="Gagal memuat riwayat">
        {data.error}
      </Alert>
    );
  }

  if (!tiket.length && !tersimpan.length) {
    return (
      <EmptyState
        icon={History}
        judul="Belum ada laporan"
        pesan="Laporan yang kamu buat akan tercatat di sini beserta status penanganannya."
      />
    );
  }

  return (
    <div className="space-y-3">
      {tiket.map((t) => (
        <Link
          key={t.id}
          href={`/lapor/${t.kode_tiket}`}
          className="kartu block p-3.5 transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] font-bold tracking-wider text-primary-600 dark:text-primary-300">
                {t.kode_tiket}
              </p>
              <h3 className="mt-0.5 truncate text-sm font-bold">{t.judul}</h3>
              <p className="mt-0.5 text-[11.5px] text-ink-muted">
                {KATEGORI_LAPOR_MAP[t.kategori]?.label || t.kategori} · {waktuRelatif(t.created_at)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className={classNames('inline-block rounded-full px-2 py-1 text-[10.5px] font-bold', STATUS_TIKET[t.status]?.warna)}>
                {STATUS_TIKET[t.status]?.label || t.status}
              </span>
              {t.unread_reporter > 0 ? (
                <p className="mt-1 text-[10.5px] font-bold text-rose-500">{t.unread_reporter} balasan baru</p>
              ) : null}
            </div>
          </div>
          <span className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-300">
            Buka percakapan <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      ))}

      {tersimpan.length ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
              Kode tersimpan di perangkat ini
            </h2>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('osis-tiket');
                setTersimpan([]);
                toast.info('Daftar kode di perangkat ini dihapus.');
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500"
            >
              <Trash2 className="h-3 w-3" /> Bersihkan
            </button>
          </div>
          <div className="kartu divide-y divide-line">
            {tersimpan.map((t) => (
              <Link key={t.kode} href={`/lapor/${t.kode}`} className="flex items-center gap-3 px-3.5 py-2.5">
                <Ticket className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="flex-1 font-mono text-xs font-bold tracking-wider">{t.kode}</span>
                <span className="text-[10.5px] text-ink-faint">{waktuRelatif(t.ts)}</span>
                <ArrowRight className="h-4 w-4 text-ink-faint" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line bg-surface-raised p-3.5">
        <PhoneCall className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
        <p className="text-[11.5px] leading-relaxed text-ink-muted">
          <b className="text-ink">Butuh penanganan hari ini juga?</b> Lapor lewat aplikasi tetap
          diproses, tapi untuk kasus kekerasan atau pelecehan segera temui guru BK / pembina OSIS
          secara langsung supaya bisa ditindak saat itu juga.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** Kartu ringkas status tiket (dipakai di tab Lacak). */
export function KartuTiket({ ticket, messages = [], bisaBalas = false }) {
  const router = useRouter();
  const status = STATUS_TIKET[ticket.status] || STATUS_TIKET.baru;
  const langkah = ['baru', 'diproses', 'selesai'];
  const idx = langkah.indexOf(ticket.status);

  return (
    <div className="kartu overflow-hidden">
      <div className="border-b border-line bg-surface-sunken px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-black tracking-[0.12em] text-primary-700 dark:text-primary-300">
            {ticket.kode_tiket}
          </span>
          <span className={classNames('rounded-full px-2.5 py-1 text-[11px] font-bold', status.warna)}>
            {status.label}
          </span>
        </div>

        {/* progress */}
        <div className="mt-3 flex items-center gap-1.5">
          {langkah.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1.5">
              <span
                className={classNames(
                  'h-1.5 flex-1 rounded-full',
                  ticket.status === 'ditolak'
                    ? 'bg-rose-300 dark:bg-rose-500/40'
                    : i <= idx
                      ? 'bg-emerald-500'
                      : 'bg-line',
                )}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-bold text-ink-faint">
          <span>Baru</span>
          <span>Diproses</span>
          <span>Selesai</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <h3 className="text-sm font-bold">{ticket.judul}</h3>
        <p className="mt-0.5 text-[11.5px] text-ink-muted">
          Kategori: {KATEGORI_LAPOR_MAP[ticket.kategori]?.label || ticket.kategori} · dibuat{' '}
          {waktuRelatif(ticket.created_at)}
        </p>

        {messages?.length ? (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Percakapan ({messages.length})
            </p>
            {messages.slice(-3).map((m) => (
              <div
                key={m.id}
                className={classNames(
                  'rounded-xl px-3 py-2 text-xs leading-relaxed',
                  m.is_admin
                    ? 'border border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-primary-100'
                    : 'bg-surface-sunken text-ink-muted',
                )}
              >
                <p className="mb-0.5 text-[10.5px] font-bold">
                  {m.is_admin ? 'Balasan OSIS/Admin' : 'Kamu'} · {waktuRelatif(m.created_at)}
                </p>
                {m.content}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line px-4 py-3">
        <Button
          className="w-full"
          onClick={() => router.push(`/lapor/${ticket.kode_tiket}`)}
        >
          <ShieldCheck className="h-4 w-4" />
          {bisaBalas ? 'Buka & balas laporan' : 'Lihat detail lengkap'}
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10.5px] text-ink-faint">
          <Lock className="h-3 w-3" /> Hanya kamu, OSIS, pembina, dan admin yang bisa membaca tiket ini
        </p>
      </div>
    </div>
  );
}

export default function LaporPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-4"><Skeleton className="h-40 w-full rounded-2xl" /></div>}>
      <LaporInner />
    </Suspense>
  );
}
