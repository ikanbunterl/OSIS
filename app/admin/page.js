'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, BadgeCheck, ClipboardList, FileSpreadsheet, Gavel, Inbox,
  MessageCircle, RefreshCw, ShieldAlert, Users,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Alert, Baris, GrupBaris, Skeleton } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import EnvKurang from '@/components/EnvKurang';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { apiPost } from '@/lib/api-client';
import { useStore } from '@/lib/store';
import { KATEGORI_LAPOR_MAP, STATUS_TIKET } from '@/lib/constants';
import { classNames, waktuRelatif } from '@/lib/utils';

export default function AdminDashboard() {
  const profile = useStore((s) => s.profile);
  const { data, loading, error, refresh } = useQuery(() => ambilJson('/api/admin/stats'), {
    deps: [profile?.id],
  });
  const [kirimPush, setKirimPush] = useState(false);

  const stats = data?.stats || {};

  return (
    <div className="space-y-5">
      <EnvKurang error={error} loading={loading} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            Ringkasan portal OSIS {data ? `· diperbarui ${waktuRelatif(new Date().toISOString())}` : ''}
          </p>
        </div>
        <Button varian="sekunder" ukuran="sm" onClick={refresh} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </Button>
      </div>

      {error ? <Alert jenis="bahaya" judul="Gagal memuat statistik">{error}</Alert> : null}

      {/* ---------- kartu statistik ---------- */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kartu icon={Users} label="Siswa terdata" nilai={stats.siswa_total} loading={loading} ket={stats.siswa_dummy ? `${stats.siswa_dummy} di antaranya data dummy` : 'semua data asli'} />
        <Kartu icon={BadgeCheck} label="Akun terdaftar" nilai={stats.akun_terverifikasi} loading={loading} ket={`dari ${stats.akun_total ?? 0} akun`} />
        <Kartu icon={Inbox} label="Tiket baru" nilai={stats.tiket_baru} loading={loading} ket={`${stats.tiket_diproses ?? 0} sedang diproses`} warna={stats.tiket_baru > 0 ? 'bahaya' : 'netral'} />
        <Kartu icon={AlertTriangle} label="Laporan open" nilai={stats.laporan_open} loading={loading} ket="perlu ditinjau moderator" warna={stats.laporan_open > 0 ? 'warning' : 'netral'} />
        <Kartu icon={MessageCircle} label="Post total" nilai={stats.post_total} loading={loading} ket={`${stats.post_menunggu ?? 0} menunggu moderasi`} />
        <Kartu icon={Gavel} label="Anggota OSIS" nilai={stats.akun_osis} loading={loading} ket={`${stats.akun_dibanned ?? 0} akun diblokir`} />
        <Kartu icon={MessageCircle} label="Chat 24 jam" nilai={stats.chat_24jam} loading={loading} ket="pesan terkirim" />
        <Kartu icon={ClipboardList} label="Tiket selesai" nilai={stats.tiket_selesai} loading={loading} ket="total sepanjang masa" warna="sukses" />
      </div>

      {stats.siswa_dummy ? (
        <Alert jenis="warning" judul="Masih memakai data dummy (Fase A)">
          Ada <b>{stats.siswa_dummy}</b> NIS contoh (prefix 2425/2627) di database. Setelah data asli
          dari TU siap, buka <Link href="/admin/import" className="font-bold underline">Import Siswa</Link>{' '}
          lalu nonaktifkan data dummy lewat SQL di <code className="rounded bg-slate-900/10 px-1">supabase/02_seed.sql</code>.
        </Alert>
      ) : null}

      {/* ---------- grafik chat 7 hari ---------- */}
      <section className="kartu p-4">
        <h2 className="text-sm font-extrabold">Aktivitas chat 7 hari terakhir</h2>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {(data?.chat7Hari || []).map((d) => {
            const maks = Math.max(1, ...(data?.chat7Hari || []).map((x) => x.jumlah));
            const tinggi = Math.max(4, Math.round((d.jumlah / maks) * 100));
            return (
              <div key={d.tanggal} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-ink-muted">{d.jumlah}</span>
                <div className="w-full rounded-t-md bg-primary-500/80 transition-all" style={{ height: `${tinggi}%` }} />
                <span className="text-[9.5px] text-ink-faint">{d.tanggal.slice(8)}/{d.tanggal.slice(5, 7)}</span>
              </div>
            );
          })}
          {!data?.chat7Hari?.length ? <p className="text-xs text-ink-faint">Belum ada data.</p> : null}
        </div>
      </section>

      {/* ---------- aksi cepat ---------- */}
      <section className="grid gap-2.5 sm:grid-cols-2">
        <AksiCepat href="/admin/tiket" icon={Inbox} judul="Kelola tiket lapor" ket="Balas & ubah status laporan siswa" />
        <AksiCepat href="/admin/moderasi" icon={Gavel} judul="Tinjau laporan konten" ket={`${stats.laporan_open ?? 0} menunggu keputusan`} />
        <AksiCepat href="/admin/import" icon={FileSpreadsheet} judul="Import data siswa" ket="CSV dari TU / wali kelas" />
        <AksiCepat href="/admin/verifikasi" icon={UserCheckIcon} judul="Verifikasi & akun OSIS" ket="Buat akun OSIS, ubah role" />
      </section>

      {/* ---------- tiket terbaru ---------- */}
      <GrupBaris judul="Tiket terbaru" aksi={<Link href="/admin/tiket" className="text-[11px] font-bold text-primary-600 dark:text-primary-300">Lihat semua →</Link>}>
        {(data?.tiketTerbaru || []).map((t) => (
          <Link key={t.id} href={`/admin/tiket?kode=${t.kode_tiket}`}>
            <Baris
              icon={Inbox}
              judul={t.judul}
              deskripsi={`${t.kode_tiket} · ${KATEGORI_LAPOR_MAP[t.kategori]?.label || t.kategori} · ${waktuRelatif(t.created_at)}`}
              kanan={
                <span className={classNames('rounded-full px-2 py-1 text-[10.5px] font-bold', STATUS_TIKET[t.status]?.warna)}>
                  {STATUS_TIKET[t.status]?.label}
                </span>
              }
            />
          </Link>
        ))}
        {!data?.tiketTerbaru?.length ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">Belum ada tiket.</p>
        ) : null}
      </GrupBaris>

      {/* ---------- audit log ---------- */}
      <GrupBaris judul="Audit log terbaru">
        {(data?.auditTerbaru || []).map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">
                <code className="rounded bg-surface-sunken px-1 py-0.5 text-[10.5px]">{a.action}</code>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                oleh {a.actor?.username || 'sistem'} · {waktuRelatif(a.created_at)}
                {a.metadata && Object.keys(a.metadata).length ? ` · ${JSON.stringify(a.metadata).slice(0, 90)}` : ''}
              </p>
            </div>
          </div>
        ))}
        {!data?.auditTerbaru?.length ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">Belum ada aktivitas tercatat.</p>
        ) : null}
      </GrupBaris>

      {/* ---------- kirim pengumuman push ---------- */}
      <section className="kartu p-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <ShieldAlert className="h-4 w-4 text-primary-500" /> Kirim notifikasi push
        </h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
          Kirim pengumuman singkat ke HP siswa yang sudah mengaktifkan notifikasi. Perlu kunci VAPID
          di server (<code className="rounded bg-slate-900/10 px-1">npm run vapid</code>).
        </p>
        <FormPush onDone={refresh} sibuk={kirimPush} setSibuk={setKirimPush} />
      </section>
    </div>
  );
}

function FormPush({ sibuk, setSibuk }) {
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [target, setTarget] = useState('semua');

  async function kirim(e) {
    e.preventDefault();
    setSibuk(true);
    const res = await apiPost('/api/push', { title: judul, body: isi, target, url: '/home' });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message || 'Gagal mengirim notifikasi.');
    toast.sukses(res.data?.message || 'Notifikasi terkirim.');
    setJudul('');
    setIsi('');
  }

  return (
    <form onSubmit={kirim} className="mt-3 space-y-2.5">
      <input
        value={judul}
        onChange={(e) => setJudul(e.target.value.slice(0, 60))}
        placeholder="Judul notifikasi (maks 60 karakter)"
        className="input-dasar min-h-touch-10 py-2 text-sm"
        required
      />
      <input
        value={isi}
        onChange={(e) => setIsi(e.target.value.slice(0, 200))}
        placeholder="Isi pesan (maks 200 karakter)"
        className="input-dasar min-h-touch-10 py-2 text-sm"
        required
      />
      <div className="flex gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="input-dasar min-h-touch-10 flex-1 py-2 text-sm"
          aria-label="Target penerima"
        >
          <option value="semua">Semua siswa</option>
          <option value="siswa">Siswa saja</option>
          <option value="osis">Anggota OSIS saja</option>
          <option value="staff">Semua pengurus</option>
        </select>
        <Button type="submit" loading={sibuk} disabled={sibuk} className="shrink-0">
          Kirim
        </Button>
      </div>
    </form>
  );
}

function Kartu({ icon: Icon, label, nilai, ket, loading, warna = 'netral' }) {
  const gaya = {
    netral: 'text-primary-600 bg-primary-50 dark:text-primary-300 dark:bg-primary-500/10',
    bahaya: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
    warning: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
    sukses: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
  }[warna];

  return (
    <div className="kartu p-3.5">
      <div className="flex items-center gap-2">
        <span className={classNames('flex h-8 w-8 items-center justify-center rounded-lg', gaya)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-[11px] font-bold leading-tight text-ink-muted">{label}</p>
      </div>
      {loading && nilai === undefined ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-2 text-2xl font-black leading-none tabular-nums">{nilai ?? 0}</p>
      )}
      <p className="mt-1 text-[10.5px] leading-tight text-ink-faint">{ket}</p>
    </div>
  );
}

function AksiCepat({ href, icon: Icon, judul, ket }) {
  return (
    <Link href={href} className="kartu flex items-center gap-3 p-3.5 transition active:scale-[0.99] hover:border-primary-300">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-primary-600 dark:text-primary-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{judul}</span>
        <span className="block truncate text-[11.5px] text-ink-muted">{ket}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
    </Link>
  );
}

const UserCheckIcon = Users;
