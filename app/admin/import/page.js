'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp, Info, Upload, XCircle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Checkbox, Textarea } from '@/components/ui/Input';
import { Alert, Baris, GrupBaris, Skeleton, TombolSalin } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import EnvKurang from '@/components/EnvKurang';
import { apiToken } from '@/lib/api-client';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { toCsv } from '@/lib/utils';

/**
 * /admin/import - FASE B: import data siswa dari CSV/Excel.
 * Mendukung upload file ATAU tempel teks CSV langsung (lebih gampang di HP).
 */
export default function AdminImport() {
  const profile = useStore((s) => s.profile);
  const isAdmin = ['pembina', 'admin', 'super_admin'].includes(profile?.role);

  const { data, loading, error } = useQuery(() => ambilJson('/api/admin/import'), { deps: [profile?.id] });

  const [mode, setMode] = useState('siswa');
  const [timpa, setTimpa] = useState(false);
  const [teks, setTeks] = useState('');
  const [namaFile, setNamaFile] = useState('');
  const [berkas, setBerkas] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState(null);

  function pilihFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error('File terlalu besar (maks 2 MB).');
      e.target.value = '';
      return;
    }
    if (/\.(xlsx|xls|numbers)$/i.test(f.name)) {
      toast.error('Format .xlsx belum didukung langsung. Buka di Excel → Save As → "CSV UTF-8 (Comma delimited)".', { durasi: 8000 });
    }
    setBerkas(f);
    setNamaFile(f.name);
    const reader = new FileReader();
    reader.onload = () => setTeks(String(reader.result || ''));
    reader.readAsText(f);
  }

  function unduhTemplate() {
    const isi =
      mode === 'osis'
        ? data?.templateOsis ||
          toCsv(['nis', 'nama', 'kelas', 'angkatan', 'username', 'password'], [
            { nis: '24250001', nama: 'Ahmad Fauzan Ridwan', kelas: 'XII RPL 1', angkatan: '2425', username: 'osis.fauzan', password: '' },
          ])
        : data?.templateSiswa ||
          toCsv(['nis', 'nama', 'kelas', 'angkatan'], [
            { nis: '26270001', nama: 'Bintang Arya Pratama', kelas: 'X RPL 1', angkatan: '2627' },
          ]);

    const blob = new Blob([`\uFEFF${isi}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'osis' ? 'template-import-osis.csv' : 'template-import-siswa.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function unggah() {
    if (!teks.trim() && !berkas) {
      toast.warning('Pilih file CSV atau tempel isinya dulu.');
      return;
    }
    setSibuk(true);
    setHasil(null);

    const fd = new FormData();
    const file = berkas || new File([teks], namaFile || 'tempel.csv', { type: 'text/csv' });
    fd.append('file', file, file.name || 'data.csv');
    fd.append('mode', mode);
    if (timpa) fd.append('timpa', '1');

    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await apiToken()}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({}));
    setSibuk(false);

    if (!res.ok) {
      setHasil({ gagal: true, message: json.message || 'Import gagal.', ...json });
      toast.error(json.message || 'Import gagal.');
      return;
    }
    setHasil({ gagal: false, ...json });
    toast.sukses(json.message || 'Import selesai.');
  }

  return (
    <div className="space-y-5">
      <EnvKurang error={error} loading={loading} />
      <div>
        <h1 className="text-xl font-black tracking-tight">Import Siswa</h1>
        <p className="mt-0.5 text-xs text-ink-muted">
          Fase B: masukkan data asli dari TU / wali kelas supaya siswa bisa mendaftar.
        </p>
      </div>

      {loading && !data ? <Skeleton className="h-24 w-full rounded-2xl" /> : null}

      {/* ringkasan database */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <div className="kartu p-3.5">
          <p className="text-[11px] font-bold text-ink-muted">Total siswa di DB</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{data?.total ?? '-'}</p>
        </div>
        <div className="kartu p-3.5">
          <p className="text-[11px] font-bold text-ink-muted">Prefix terdaftar</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(data?.prefixes || []).map((p) => (
              <span
                key={p.prefix}
                className={
                  p.active
                    ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-ink-faint line-through'
                }
                title={p.tahun_ajaran}
              >
                {String(p.prefix).trim()}
              </span>
            ))}
          </div>
        </div>
        <div className="kartu p-3.5 sm:col-span-1 col-span-2">
          <p className="text-[11px] font-bold text-ink-muted">Aturan validasi</p>
          <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-ink-muted">
            {(data?.aturan || []).slice(0, 4).map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      </div>

      {mode === 'osis' && !isAdmin ? (
        <Alert jenis="warning" judul="Butuh hak admin">
          Import mode OSIS membuat akun & mengubah role, jadi hanya bisa dilakukan admin/pembina.
        </Alert>
      ) : null}

      {/* form import */}
      <div className="kartu p-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <FileUp className="h-4 w-4 text-primary-500" /> Unggah data
        </h2>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { id: 'siswa', judul: 'Data siswa (CSV dari TU)', ket: 'Masukkan NIS, nama, kelas, angkatan. Siswa jadi bisa mendaftar.' },
            { id: 'osis', judul: 'Anggota OSIS (buat akun)', ket: 'Sekalian membuat akun ber-role OSIS dengan badge emas.' },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                if (o.id === 'osis' && !isAdmin) return toast.error('Hanya admin/pembina.');
                setMode(o.id);
              }}
              className={
                mode === o.id
                  ? 'rounded-xl border-2 border-primary-500 bg-primary-50 p-3 text-left dark:bg-primary-500/10'
                  : 'rounded-xl border border-line bg-surface-raised p-3 text-left hover:border-primary-300'
              }
              aria-pressed={mode === o.id}
            >
              <p className="text-[13px] font-bold">{o.judul}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{o.ket}</p>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-h-touch flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 text-sm font-bold text-ink-muted hover:border-primary-400 hover:text-primary-600 sm:flex-none">
            <Upload className="h-4 w-4" />
            {namaFile || 'Pilih file CSV'}
            <input type="file" accept=".csv,text/csv,text/plain" onChange={pilihFile} className="hidden" />
          </label>
          <Button varian="sekunder" ukuran="sm" onClick={unduhTemplate}>
            <Download className="h-3.5 w-3.5" /> Unduh template
          </Button>
        </div>

        <div className="mt-3">
          <Textarea
            label="Atau tempel isi CSV di sini"
            value={teks}
            onChange={(e) => {
              setTeks(e.target.value);
              setNamaFile('tempel-manual.csv');
              setBerkas(null);
            }}
            rows={7}
            className="font-mono text-[12px]"
            placeholder={'nis,nama,kelas,angkatan\n26270001,Bintang Arya Pratama,X RPL 1,2627\n26270002,Kayla Nur Aisyah,X RPL 1,2627'}
            hitung={false}
            hint="Baris pertama = header. Pemisah koma, titik-koma, atau TAB terdeteksi otomatis."
          />
        </div>

        <div className="mt-3">
          <Checkbox
            checked={timpa}
            onChange={(e) => setTimpa(e.target.checked)}
            label={
              <>
                <b className="text-ink">Mode timpa:</b> NIS yang sudah ada di-update (nama/kelas/angkatan)
                dan diaktifkan kembali. Kalau tidak dicentang, NIS duplikat akan <b>ditolak</b>.
              </>
            }
          />
        </div>

        <Button className="mt-3 w-full" ukuran="lg" onClick={unggah} loading={sibuk} disabled={sibuk}>
          {!sibuk ? <FileSpreadsheet className="h-4 w-4" /> : null}
          {sibuk ? 'Memvalidasi & menyimpan…' : `Import ${mode === 'osis' ? 'data OSIS' : 'data siswa'}`}
        </Button>
      </div>

      {/* hasil */}
      {hasil ? (
        <div className="space-y-3">
          <Alert
            jenis={hasil.gagal ? 'bahaya' : 'sukses'}
            judul={hasil.gagal ? 'Import gagal' : 'Import selesai'}
          >
            {hasil.message}
            {!hasil.gagal ? (
              <span className="mt-1.5 block text-[11.5px]">
                Total baris: {hasil.total} · baru: {hasil.inserted} · diperbarui: {hasil.updated} · ditolak: {hasil.ditolak}
              </span>
            ) : null}
          </Alert>

          {hasil.errors?.length ? (
            <GrupBaris judul={`Baris ditolak (${hasil.errors.length})`}>
              {hasil.errors.slice(0, 60).map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">
                      Baris {e.baris} · NIS {e.nis}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">{e.pesan}</p>
                  </div>
                </div>
              ))}
              {hasil.errors.length > 60 ? (
                <p className="px-4 py-3 text-center text-[11px] text-ink-faint">
                  …dan {hasil.errors.length - 60} baris lainnya tidak ditampilkan.
                </p>
              ) : null}
            </GrupBaris>
          ) : null}

          {hasil.akunDibuat?.length ? (
            <GrupBaris judul={`Akun OSIS dibuat (${hasil.akunDibuat.length})`}>
              {hasil.akunDibuat.map((a) => (
                <div key={a.nis} className="flex items-center gap-3 px-4 py-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      {a.nama} · @{a.username}
                    </p>
                    <p className="font-mono text-[11px] text-ink-muted">
                      NIS {a.nis} · pass: {a.password}
                    </p>
                  </div>
                  <TombolSalin teks={`NIS: ${a.nis}\nUsername: ${a.username}\nPassword: ${a.password}`} label="Salin" />
                </div>
              ))}
            </GrupBaris>
          ) : null}

          {hasil.akunError?.length ? (
            <GrupBaris judul={`Akun OSIS gagal dibuat (${hasil.akunError.length})`}>
              {hasil.akunError.map((a, i) => (
                <Baris key={i} icon={AlertTriangle} judul={`${a.nama} (@${a.username})`} deskripsi={a.pesan} bahaya />
              ))}
            </GrupBaris>
          ) : null}

          {hasil.passwordSementara ? (
            <Alert jenis="warning" judul="Password sementara dipakai">
              Pola: <code className="rounded bg-slate-900/10 px-1 font-mono">{hasil.passwordSementara}</code>.
              Bagikan lewat jalur tertutup (jangan di grup publik) dan minta segera diganti.
            </Alert>
          ) : null}
        </div>
      ) : null}

      {/* panduan */}
      <div className="kartu p-4">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <Info className="h-4 w-4 text-primary-500" /> Cara menyiapkan file dari Excel
        </h2>
        <ol className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-ink-muted">
          <li>1. Minta file absensi/data siswa ke TU atau wali kelas (kolom: NIS, Nama, Kelas).</li>
          <li>2. Buka di Excel/Google Sheets → rapikan: NIS harus 8 digit angka, tanpa spasi/tanda baca.</li>
          <li>
            3. Tambahkan kolom <b>angkatan</b> = 4 digit pertama NIS (boleh dikosongkan, sistem
            mengambilnya otomatis dari NIS).
          </li>
          <li>4. <b>File → Save As → CSV UTF-8 (Comma delimited) (*.csv)</b>.</li>
          <li>5. Unggah di sini tanpa mode timpa dulu, baca daftar baris yang ditolak, perbaiki, ulangi.</li>
          <li>6. Setelah semua masuk, siswa bisa langsung mendaftar di <b>/register</b>.</li>
        </ol>
        <p className="mt-2.5 rounded-lg bg-surface-sunken p-2.5 text-[11px] leading-relaxed text-ink-muted">
          <b>Google Sheets:</b> File → Download → Comma-separated values (.csv, current sheet).
        </p>
      </div>
    </div>
  );
}
