'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, FileText, ImagePlus, Info, Loader2, Lock, Paperclip, ShieldCheck, Ticket, X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { TombolSalin } from '@/components/ui/index';
import { apiPost } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { tiketSchema } from '@/lib/validators';
import { errorPerField } from '@/lib/validators';
import { KATEGORI_LAPOR, LIMITS, MAX_FILE_BYTES, MIME_LAMPIRAN } from '@/lib/constants';
import { censor } from '@/lib/censor';
import { classNames, formatByte, uid } from '@/lib/utils';

/**
 * Form buat tiket lapor (PLAN Bagian 6).
 * Setelah sukses -> tampilkan kode tiket dengan sangat menonjol + tombol simpan.
 */
export default function TicketForm({ onSelesai }) {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const [form, setForm] = useState({ kategori: '', judul: '', deskripsi: '', lokasi: '', kontak: '' });
  const [berkas, setBerkas] = useState([]);
  const [error, setError] = useState({});
  const [kirim, setKirim] = useState(false);
  const [hasil, setHasil] = useState(null); // { kode_tiket }
  const [setuju, setSetuju] = useState(false);
  const inputBerkas = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const kategoriInfo = useMemo(
    () => KATEGORI_LAPOR.find((k) => k.id === form.kategori),
    [form.kategori],
  );

  function pilihBerkas(e) {
    const daftar = Array.from(e.target.files || []);
    e.target.value = '';
    const sisa = LIMITS.lampiranTiket - berkas.length;
    for (const f of daftar.slice(0, Math.max(0, sisa))) {
      if (!MIME_LAMPIRAN.includes(f.type)) {
        toast.error(`"${f.name}" harus JPG/PNG/WebP/PDF.`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" ${formatByte(f.size)} — maksimal ${LIMITS.ukuranFileMB} MB.`);
        continue;
      }
      setBerkas((b) => [...b, { file: f, id: uid('f'), nama: f.name, url: URL.createObjectURL(f) }]);
    }
  }

  async function unggahBukti() {
    const sb = getSupabaseBrowser();
    const jalur = [];
    for (const b of berkas) {
      const ext = (b.file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${profile.id}/lapor/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: e } = await sb.storage.from('attachments').upload(path, b.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: b.file.type,
      });
      if (e) throw new Error(`Gagal mengunggah ${b.nama}: ${e.message}`);
      jalur.push({ path, nama: b.nama });
    }
    return jalur;
  }

  async function submit(e) {
    e?.preventDefault();
    if (!profile) {
      toast.error('Kamu harus login dulu untuk membuat laporan.');
      router.push('/login');
      return;
    }
    const kandidat = {
      kategori: form.kategori,
      judul: form.judul,
      deskripsi: form.deskripsi,
      lokasi: form.lokasi,
      kontak: form.kontak,
    };
    const parsed = tiketSchema.safeParse(kandidat);
    if (!parsed.success) {
      setError(errorPerField(parsed));
      toast.warning('Periksa lagi isian yang ditandai merah.');
      return;
    }
    if (!setuju) {
      toast.warning('Centang pernyataan bahwa laporan ini dibuat dengan jujur.');
      return;
    }

    setError({});
    setKirim(true);
    try {
      let lampiran = [];
      if (berkas.length) {
        lampiran = await unggahBukti();
      }

      const res = await apiPost('/api/tickets', {
        ...parsed.data,
        judul: censor(parsed.data.judul),
        deskripsi: censor(parsed.data.deskripsi),
        lampiran: lampiran.map((l) => l.path),
        lampiran_nama: lampiran.map((l) => l.nama),
      });

      if (!res.ok) {
        toast.error(res.message || 'Gagal mengirim laporan.');
        if (res.errors) setError(res.errors);
        return;
      }

      setHasil(res.data.ticket || { kode_tiket: res.data.kode_tiket });
      toast.sukses('Laporan terkirim ke OSIS/admin.');
      onSelesai?.(res.data.ticket);
    } catch (err) {
      toast.error(err?.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setKirim(false);
    }
  }

  /* --------- layar sukses: kode tiket --------- */
  if (hasil) {
    return (
      <div className="kartu overflow-hidden">
        <div className="border-b border-line bg-emerald-50 px-4 py-5 text-center dark:bg-emerald-500/10">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-extrabold text-emerald-900 dark:text-emerald-200">Laporan terkirim</h2>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-300/80">
            Simpan kode tiket ini. Tanpa login pun kamu bisa mengecek statusnya lewat menu Lacak Tiket.
          </p>
        </div>

        <div className="px-4 py-5">
          <p className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-ink-faint">
            Kode tiket kamu
          </p>
          <div className="rounded-2xl border-2 border-dashed border-primary-400 bg-primary-50 px-4 py-4 text-center dark:border-primary-500/40 dark:bg-primary-500/10">
            <p className="font-mono text-2xl font-black tracking-[0.12em] text-primary-700 dark:text-primary-300">
              {hasil.kode_tiket}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <TombolSalin teks={hasil.kode_tiket} label="Salin kode" />
            <Button
              varian="sekunder"
              ukuran="sm"
              onClick={() => {
                try {
                  const list = JSON.parse(localStorage.getItem('osis-tiket') || '[]');
                  localStorage.setItem(
                    'osis-tiket',
                    JSON.stringify([{ kode: hasil.kode_tiket, ts: Date.now() }, ...list].slice(0, 20)),
                  );
                  toast.sukses('Kode disimpan di perangkat ini.');
                } catch {
                  toast.error('Browser tidak mengizinkan penyimpanan lokal.');
                }
              }}
            >
              <FileText className="h-4 w-4" /> Simpan di perangkat
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => router.push(`/lapor/${hasil.kode_tiket}`)}>
              <Ticket className="h-4 w-4" /> Lacak laporan ini
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              varian="sekunder"
              className="flex-1"
              onClick={() => {
                setHasil(null);
                setForm({ kategori: '', judul: '', deskripsi: '', lokasi: '', kontak: '' });
                setBerkas([]);
                setSetuju(false);
              }}
            >
              Buat laporan lain
            </Button>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface-sunken p-3 text-[11.5px] leading-relaxed text-ink-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            Laporan ini hanya bisa dibaca oleh kamu, OSIS, pembina, dan admin. Identitasmu tidak
            ditampilkan ke siswa lain, dan tidak akan diumumkan tanpa persetujuanmu.
          </p>
        </div>
      </div>
    );
  }

  /* --------- form --------- */
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="flex items-start gap-2.5 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-500/25 dark:bg-primary-500/10">
        <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary-600 dark:text-primary-300" />
        <p className="text-xs leading-relaxed text-primary-900 dark:text-primary-100">
          <span className="font-bold">Rahasia & aman.</span> Laporan hanya dibaca OSIS, pembina, dan
          admin. Untuk kasus darurat (kekerasan/pelecehan), laporkan juga langsung ke guru BK agar
          bisa ditangani hari itu juga.
        </p>
      </div>

      <Select
        label="Kategori laporan"
        value={form.kategori}
        onChange={set('kategori')}
        error={error.kategori}
        placeholder="Pilih kategori…"
        required
      >
        {KATEGORI_LAPOR.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </Select>

      {kategoriInfo?.prioritasDefault === 'tinggi' ? (
        <p className="-mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <ShieldCheck className="h-4 w-4" /> Kategori ini otomatis ditandai <b>prioritas tinggi</b> dan
          didahulukan penanganannya.
        </p>
      ) : null}

      <Input
        label="Judul singkat"
        value={form.judul}
        onChange={set('judul')}
        error={error.judul}
        placeholder="Contoh: Keran air toilet lantai 2 bocor"
        maxLength={120}
        required
      />

      <Textarea
        label="Ceritakan detailnya"
        value={form.deskripsi}
        onChange={set('deskripsi')}
        error={error.deskripsi}
        rows={6}
        maxLength={3000}
        placeholder={
          'Jelaskan apa yang terjadi, kapan, di mana, dan siapa saja yang terlibat (inisial boleh).\n\n' +
          'Semakin detail, semakin mudah OSIS menindaklanjuti.'
        }
        hint={`${form.deskripsi.length}/3000 karakter · kata kasar otomatis disensor`}
        hitung={false}
        required
      />

      {censor(form.deskripsi) !== form.deskripsi ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
          Tercatat ada kata kasar — akan disensor otomatis sebelum sampai ke admin.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Lokasi kejadian"
          value={form.lokasi}
          onChange={set('lokasi')}
          error={error.lokasi}
          placeholder="Contoh: Toilet lantai 2 gedung B"
          maxLength={120}
        />
        <Input
          label="Kontak yang bisa dihubungi"
          value={form.kontak}
          onChange={set('kontak')}
          error={error.kontak}
          placeholder="Opsional — hanya terlihat admin"
          maxLength={120}
          hint="Kalau dikosongkan, admin tetap bisa membalas lewat tiket ini."
        />
      </div>

      {/* lampiran */}
      <div>
        <span className="label-form">
          Bukti / lampiran <span className="font-normal text-ink-faint">(opsional, maks {LIMITS.lampiranTiket})</span>
        </span>
        <input
          ref={inputBerkas}
          type="file"
          accept={MIME_LAMPIRAN.join(',')}
          multiple
          onChange={pilihBerkas}
          className="hidden"
        />
        {berkas.length ? (
          <ul className="mb-2 space-y-1.5">
            {berkas.map((b) => (
              <li key={b.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface-raised px-3 py-2">
                {b.file.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
                    <FileText className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{b.nama}</span>
                  <span className="block text-[11px] text-ink-faint">{formatByte(b.file.size)} · tersimpan privat</span>
                </span>
                <button
                  type="button"
                  onClick={() => setBerkas((arr) => arr.filter((x) => x.id !== b.id))}
                  aria-label={`Hapus lampiran ${b.nama}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-surface-sunken hover:text-rose-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => inputBerkas.current?.click()}
          disabled={berkas.length >= LIMITS.lampiranTiket || kirim}
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-ink-muted transition hover:border-primary-400 hover:text-primary-600 disabled:opacity-50"
        >
          <Paperclip className="h-4 w-4" /> Tambah foto / PDF bukti
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface-sunken p-3">
        <input
          type="checkbox"
          checked={setuju}
          onChange={(e) => setSetuju(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
        />
        <span className="text-xs leading-relaxed text-ink-muted">
          Saya menyatakan laporan ini <b className="text-ink">benar dan dibuat dengan jujur</b>. Saya
          paham laporan palsu/fitnah dapat dikenai sanksi sesuai aturan sekolah.
        </span>
      </label>

      <Button type="submit" ukuran="lg" className="w-full" loading={kirim} disabled={kirim}>
        {!kirim ? <ShieldCheck className="h-[18px] w-[18px]" /> : null}
        {kirim ? 'Mengirim laporan…' : 'Kirim laporan rahasia'}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-ink-faint">
        Batas: 1 laporan per 10 menit. Semua tindakan admin tercatat di audit log.
      </p>
    </form>
  );
}
