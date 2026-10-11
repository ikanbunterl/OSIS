'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet, Plus, Search, ToggleLeft, ToggleRight, Trash2, UserCheck, Users,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import Modal, { ModalKonfirmasi } from '@/components/ui/Modal';
import { Alert, Badge, EmptyState, Skeleton, TombolSalin } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import EnvKurang from '@/components/EnvKurang';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { toCsv } from '@/lib/utils';

/**
 * /admin/siswa - kelola data siswa (Fase B & C).
 * Cari, tambah manual, nonaktifkan (soft), hapus (hard, khusus admin).
 */
export default function AdminSiswa() {
  const profile = useStore((s) => s.profile);
  const isAdmin = ['pembina', 'admin', 'super_admin'].includes(profile?.role);

  const [q, setQ] = useState('');
  const [angkatan, setAngkatan] = useState('semua');
  const [status, setStatus] = useState('semua');

  const { data, loading, error, refresh } = useQuery(
    () =>
      ambilJson(
        `/api/admin/students?q=${encodeURIComponent(q)}&angkatan=${angkatan}&active=${
          status === 'semua' ? '' : status === 'aktif'
        }`,
      ),
    { deps: [q, angkatan, status, profile?.id] },
  );

  const [tambah, setTambah] = useState(false);
  const [hapus, setHapus] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const students = data?.students || [];

  async function toggleAktif(s) {
    setSibuk(true);
    const res = await apiPatch('/api/admin/students', { nis: s.nis, active: !s.active });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message || 'Diperbarui.');
    refresh();
  }

  async function hapusSiswa() {
    if (!hapus) return;
    setSibuk(true);
    const res = await apiDelete(`/api/admin/students?nis=${hapus.nis}`);
    setSibuk(false);
    setHapus(null);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    refresh();
  }

  function unduhCsv() {
    const isi = toCsv(
      ['nis', 'nama', 'kelas', 'angkatan', 'active'],
      students.map((s) => ({ ...s, active: s.active ? 'true' : 'false' })),
    );
    const blob = new Blob([`\uFEFF${isi}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-siswa-${angkatan === 'semua' ? 'semua' : angkatan}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <EnvKurang error={error} loading={loading} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Data Siswa</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            {data ? `${data.total ?? 0} siswa terdata · ${data.akunTerdaftar ?? 0} akun dibuat` : 'Memuat…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button varian="sekunder" ukuran="sm" onClick={unduhCsv} disabled={!students.length}>
            Unduh CSV
          </Button>
          <Link href="/admin/import">
            <Button varian="sekunder" ukuran="sm">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Import
            </Button>
          </Link>
          <Button ukuran="sm" onClick={() => setTambah(true)}>
            <Plus className="h-3.5 w-3.5" /> Tambah siswa
          </Button>
        </div>
      </div>

      {/* filter */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari NIS / nama / kelas…"
            aria-label="Cari siswa"
            className="input-dasar min-h-touch-11 pl-9"
          />
        </div>
        <Select value={angkatan} onChange={(e) => setAngkatan(e.target.value)} aria-label="Filter angkatan" className="min-h-touch-11 py-2">
          <option value="semua">Semua angkatan</option>
          {(data?.prefixes || []).map((p) => (
            <option key={p.prefix} value={String(p.prefix).trim()}>
              {String(p.prefix).trim()} — {p.tahun_ajaran} {p.active ? '' : '(nonaktif)'}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status" className="min-h-touch-11 py-2">
          <option value="semua">Semua status</option>
          <option value="aktif">Aktif saja</option>
          <option value="false">Nonaktif saja</option>
        </Select>
      </div>

      {loading && !data ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}

      {!loading && !students.length ? (
        <EmptyState
          icon={Users}
          judul="Tidak ada data"
          pesan={
            data?.total
              ? 'Tidak ada siswa yang cocok dengan filter ini.'
              : 'Database siswa masih kosong. Import CSV dari TU lewat menu Import Siswa.'
          }
          aksi={
            <Link href="/admin/import">
              <Button>
                <FileSpreadsheet className="h-4 w-4" /> Import data siswa
              </Button>
            </Link>
          }
        />
      ) : null}

      {students.length ? (
        <div className="kartu overflow-hidden">
          {/* header tabel (desktop) */}
          <div className="hidden grid-cols-[110px_1fr_120px_90px_130px] gap-3 border-b border-line bg-surface-sunken px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint lg:grid">
            <span>NIS</span><span>Nama</span><span>Kelas</span><span>Angkatan</span><span>Aksi</span>
          </div>

          <div className="divide-y divide-line">
            {students.map((s) => (
              <div
                key={s.nis}
                className="grid gap-2 px-4 py-3 lg:grid-cols-[110px_1fr_120px_90px_130px] lg:items-center lg:gap-3"
              >
                <span className="font-mono text-xs font-bold">{s.nis}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.nama}</span>
                  <span className="lg:hidden block text-[11px] text-ink-muted">
                    {s.kelas || '-'} · angkatan {s.angkatan}
                  </span>
                </span>
                <span className="hidden text-xs text-ink-muted lg:block">{s.kelas || '-'}</span>
                <span className="hidden lg:block">
                  <Badge warna={s.active ? 'sukses' : 'netral'}>{s.angkatan}</Badge>
                </span>
                <span className="flex items-center gap-1.5">
                  {!s.active ? <Badge warna="bahaya">nonaktif</Badge> : null}
                  <button
                    type="button"
                    onClick={() => toggleAktif(s)}
                    disabled={sibuk}
                    aria-label={s.active ? `Nonaktifkan ${s.nama}` : `Aktifkan ${s.nama}`}
                    title={s.active ? 'Nonaktifkan (tidak bisa login, riwayat tetap ada)' : 'Aktifkan kembali'}
                    className={
                      s.active
                        ? 'flex h-9 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'flex h-9 items-center gap-1 rounded-lg bg-surface-sunken px-2 text-[11px] font-bold text-ink-muted'
                    }
                  >
                    {s.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {s.active ? 'Aktif' : 'Off'}
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setHapus(s)}
                      aria-label={`Hapus ${s.nama}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>

          {students.length >= 200 ? (
            <p className="border-t border-line px-4 py-3 text-center text-[11px] text-ink-faint">
              Menampilkan 200 baris pertama. Persempit filter untuk melihat lainnya.
            </p>
          ) : null}
        </div>
      ) : null}

      <Alert jenis="info" judul="Kenapa tidak ada tombol hapus untuk semua orang?">
        Menonaktifkan (<code className="rounded bg-slate-900/10 px-1">active=false</code>) lebih aman
        daripada menghapus: siswa tidak bisa login, tapi seluruh riwayat aspirasi, tiket, dan chat
        tetap tersimpan untuk audit. Hapus permanen hanya untuk data salah input dan belum pernah
        dipakai mendaftar.
      </Alert>

      <ModalTambah terbuka={tambah} onClose={() => setTambah(false)} onDone={refresh} prefixes={data?.prefixes || []} />

      <ModalKonfirmasi
        terbuka={Boolean(hapus)}
        onClose={() => setHapus(null)}
        onConfirm={hapusSiswa}
        loading={sibuk}
        judul={`Hapus ${hapus?.nama}?`}
        pesan={`NIS ${hapus?.nis} akan dihapus permanen dari data siswa. Kalau NIS ini sudah pernah dipakai mendaftar, sistem akan menolak — gunakan nonaktifkan saja.`}
        teksKonfirmasi="Hapus permanen"
      />
    </div>
  );
}

function ModalTambah({ terbuka, onClose, onDone, prefixes }) {
  const [form, setForm] = useState({ nis: '', nama: '', kelas: '', angkatan: '' });
  const [sibuk, setSibuk] = useState(false);

  async function submit() {
    setSibuk(true);
    const res = await apiPost('/api/admin/students', {
      ...form,
      angkatan: form.angkatan || form.nis.slice(0, 4),
    });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    setForm({ nis: '', nama: '', kelas: '', angkatan: '' });
    onClose();
    onDone();
  }

  return (
    <Modal
      terbuka={terbuka}
      onClose={onClose}
      judul="Tambah siswa manual"
      deskripsi="Untuk perbaikan cepat 1-2 data. Untuk ratusan siswa, pakai Import CSV."
      footer={
        <div className="flex gap-2">
          <Button varian="sekunder" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-1" onClick={submit} loading={sibuk} disabled={!form.nis || !form.nama}>
            <UserCheck className="h-4 w-4" /> Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Input
          label="NIS"
          value={form.nis}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 8);
            setForm((f) => ({ ...f, nis: v, angkatan: f.angkatan || v.slice(0, 4) }));
          }}
          inputMode="numeric"
          placeholder="8 digit"
          maxLength={8}
        />
        <Input
          label="Nama lengkap"
          value={form.nama}
          onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value.slice(0, 80) }))}
          placeholder="Sesuai data sekolah"
        />
        <Input
          label="Kelas"
          value={form.kelas}
          onChange={(e) => setForm((f) => ({ ...f, kelas: e.target.value.slice(0, 30) }))}
          placeholder="Contoh: X RPL 1"
        />
        <Select
          label="Angkatan"
          value={form.angkatan}
          onChange={(e) => setForm((f) => ({ ...f, angkatan: e.target.value }))}
          hint="Otomatis diambil dari 4 digit pertama NIS kalau dikosongkan."
        >
          <option value="">— otomatis dari NIS —</option>
          {(prefixes || []).map((p) => (
            <option key={p.prefix} value={String(p.prefix).trim()}>
              {String(p.prefix).trim()} — {p.tahun_ajaran}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-sunken p-2.5">
          <span className="text-[11px] text-ink-muted">Salin NIS untuk siswa:</span>
          <TombolSalin teks={form.nis || '-'} label="Salin NIS" />
        </div>
      </div>
    </Modal>
  );
}
