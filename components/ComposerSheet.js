'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Megaphone, Send, UserRound, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Checkbox, Textarea } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { LIMITS, MAX_FILE_BYTES, MIME_GAMBAR } from '@/lib/constants';
import { censor } from '@/lib/censor';
import { classNames, formatByte, uid } from '@/lib/utils';

/**
 * Sheet pembuat post.
 *  - mode 'osis'     : hanya OSIS/admin; judul + isi + media; identitas terlihat
 *  - mode 'aspirasi' : semua siswa; WAJIB anonim (dikunci, tidak bisa dimatikan)
 *  - mode 'talent'   : semua siswa; media wajib minimal 1; identitas terlihat
 */
export default function ComposerSheet({ terbuka, onClose, mode = 'aspirasi', channel, onSuccess }) {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const tutupComposer = useStore((s) => s.tutupComposer);
  const composerChannel = useStore((s) => s.composerChannel);

  const tipe = mode || composerChannel || 'aspirasi';
  const anonimDikunci = tipe === 'aspirasi';

  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [anonim, setAnonim] = useState(anonimDikunci);
  const [berkas, setBerkas] = useState([]); // { file, url, path, nama }
  const [kirim, setKirim] = useState(false);
  const [pratinjauAnon, setPratinjauAnon] = useState(false);
  const inputBerkas = useRef(null);

  useEffect(() => {
    if (terbuka) {
      setJudul('');
      setIsi('');
      setBerkas([]);
      setAnonim(anonimDikunci);
    }
  }, [terbuka, anonimDikunci]);

  function tutup() {
    onClose?.();
    tutupComposer();
  }

  function pilihBerkas(e) {
    const daftar = Array.from(e.target.files || []);
    e.target.value = '';
    const sisa = LIMITS.mediaPost - berkas.length;
    if (sisa <= 0) return toast.warning(`Maksimal ${LIMITS.mediaPost} berkas.`);

    for (const f of daftar.slice(0, sisa)) {
      if (!MIME_GAMBAR.includes(f.type)) {
        toast.error(`"${f.name}" bukan gambar (JPG/PNG/WebP/GIF).`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`"${f.name}" terlalu besar (${formatByte(f.size)}). Maksimal ${LIMITS.ukuranFileMB} MB.`);
        continue;
      }
      setBerkas((b) => [...b, { file: f, url: URL.createObjectURL(f), nama: f.name, id: uid('f') }]);
    }
  }

  async function unggahSemua() {
    const sb = getSupabaseBrowser();
    const jalur = [];
    for (const b of berkas) {
      const ext = (b.file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, b.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: b.file.type,
      });
      if (error) throw new Error(error.message);
      jalur.push(path);
    }
    return jalur;
  }

  async function submit() {
    if (!profile) return toast.error('Kamu harus login dulu.');
    const teks = isi.trim();
    if (teks.length < 3) return toast.warning('Tulisannya masih kosong.');
    if (tipe === 'talent' && !berkas.length) {
      return toast.warning('Channel Talent wajib menyertakan minimal 1 gambar karya.');
    }

    setKirim(true);
    try {
      let mediaUrls = [];
      if (berkas.length) {
        mediaUrls = await unggahSemua();
      }

      const slug = tipe === 'osis' ? 'osis' : tipe === 'talent' ? 'talent' : 'aspirasi';
      const channelId = channel?.id || (await ambilChannelId(slug));
      if (!channelId) throw new Error('Channel tidak ditemukan. Hubungi admin.');

      const sb = getSupabaseBrowser();
      const { data, error } = await sb
        .from('posts')
        .insert({
          channel_id: channelId,
          author_id: profile.id,
          is_anonymous: anonimDikunci ? true : anonim,
          title: judul.trim() ? censor(judul.trim()).slice(0, LIMITS.postJudul) : null,
          content: censor(teks).slice(0, LIMITS.postKarakter),
          media_urls: mediaUrls,
          status: 'published',
        })
        .select('id, created_at')
        .single();

      if (error) throw new Error(error.message);

      toast.sukses(
        slug === 'aspirasi'
          ? 'Aspirasimu terkirim secara anonim. OSIS akan membacanya.'
          : 'Postingan diterbitkan.',
      );
      tutup();
      onSuccess?.(data);
      router.refresh();
    } catch (e) {
      toast.error(e?.message || 'Gagal mengirim. Coba lagi.');
    } finally {
      setKirim(false);
    }
  }

  const judulUi = {
    osis: 'Buat Pengumuman OSIS',
    talent: 'Unggah Karya',
    aspirasi: 'Sampaikan Aspirasi',
  }[tipe];

  return (
    <Modal
      terbuka={terbuka}
      onClose={tutup}
      judul={judulUi}
      deskripsi={
        tipe === 'aspirasi'
          ? 'Identitasmu disembunyikan dari semua orang. Admin tetap bisa melihat untuk keperluan audit penyalahgunaan.'
          : tipe === 'talent'
            ? 'Pamerkan hasil karyamu ke seluruh siswa. Nama kamu akan terlihat.'
            : 'Pengumuman resmi akan tampil dengan badge terverifikasi OSIS.'
      }
      footer={
        <div className="flex items-center gap-2">
          <div className="flex-1 text-[11px] leading-tight text-ink-faint">
            {isi.length}/{LIMITS.postKarakter} karakter
            {berkas.length ? ` · ${berkas.length} berkas` : ''}
          </div>
          <Button varian="sekunder" onClick={tutup} disabled={kirim}>
            Batal
          </Button>
          <Button onClick={submit} loading={kirim}>
            {!kirim ? <Send className="h-4 w-4" /> : null}
            Kirim
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        {tipe !== 'talent' ? (
          <div>
            <label className="label-form" htmlFor="judul-post">
              Judul <span className="font-normal text-ink-faint">(opsional)</span>
            </label>
            <input
              id="judul-post"
              value={judul}
              onChange={(e) => setJudul(e.target.value.slice(0, LIMITS.postJudul))}
              placeholder={tipe === 'aspirasi' ? 'Contoh: Usul perpanjangan jam istirahat' : 'Contoh: Jadwal MPLS 2026'}
              className="input-dasar"
              maxLength={LIMITS.postJudul}
            />
          </div>
        ) : null}

        <Textarea
          label={tipe === 'talent' ? 'Ceritakan karyamu' : 'Isi tulisan'}
          id="isi-post"
          value={isi}
          onChange={(e) => setIsi(e.target.value.slice(0, LIMITS.postKarakter))}
          rows={tipe === 'talent' ? 3 : 6}
          maxLength={LIMITS.postKarakter}
          placeholder={
            tipe === 'aspirasi'
              ? 'Tulis pendapat, kritik, atau usulanmu di sini. Semakin detail, semakin mudah ditindaklanjuti…'
              : 'Tulis isi pengumuman…'
          }
          hitung={false}
          className="leading-relaxed"
        />

        {/* pratinjau sensor kata kasar */}
        {censor(isi) !== isi ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            Ada kata yang akan disensor otomatis menjadi <span className="font-mono">****</span> sebelum dipublikasikan.
          </p>
        ) : null}

        {/* media */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label-form mb-0">Gambar {tipe === 'talent' ? <span className="text-rose-500">*</span> : <span className="font-normal text-ink-faint">(opsional)</span>}</span>
            <span className="text-[11px] text-ink-faint">maks {LIMITS.mediaPost} · {LIMITS.ukuranFileMB} MB/berkas</span>
          </div>

          <input
            ref={inputBerkas}
            type="file"
            accept={MIME_GAMBAR.join(',')}
            multiple={LIMITS.mediaPost > 1}
            onChange={pilihBerkas}
            className="hidden"
          />

          {berkas.length ? (
            <div className="mb-2 grid grid-cols-3 gap-2">
              {berkas.map((b) => (
                <div key={b.id} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-sunken">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.url} alt={b.nama} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBerkas((arr) => arr.filter((x) => x.id !== b.id))}
                    aria-label={`Hapus ${b.nama}`}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => inputBerkas.current?.click()}
            disabled={berkas.length >= LIMITS.mediaPost || kirim}
            className={classNames(
              'flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-ink-muted transition',
              'hover:border-primary-400 hover:text-primary-600 disabled:opacity-50',
            )}
          >
            {kirim ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {berkas.length ? 'Tambah gambar' : 'Pilih gambar dari perangkat'}
          </button>
        </div>

        {/* identitas */}
        <div className="rounded-xl border border-line bg-surface-sunken p-3">
          {anonimDikunci ? (
            <div className="flex items-start gap-2.5">
              <UserRound className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink-muted" />
              <div className="text-xs leading-relaxed text-ink-muted">
                <p className="font-bold text-ink">Kirim sebagai Anonim</p>
                <p className="mt-0.5">
                  Di channel Aspirasi semua kiriman otomatis anonim. Namamu tidak pernah ditampilkan,
                  tapi tersimpan di database agar admin bisa menindak penyalahgunaan (fitnah/bullying).
                </p>
              </div>
            </div>
          ) : (
            <Checkbox
              checked={anonim}
              onChange={(e) => setAnonim(e.target.checked)}
              label={
                <>
                  <span className="font-bold text-ink">Kirim sebagai anonim</span>
                  <br />
                  Nama & avatar kamu tidak akan terlihat.
                </>
              }
            />
          )}

          {tipe === 'osis' ? (
            <p className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[11px] font-semibold text-accent-700 dark:text-accent-300">
              <Megaphone className="h-3.5 w-3.5" /> Posting sebagai OSIS · badge terverifikasi emas
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setPratinjauAnon((v) => !v)}
          className="w-full text-center text-xs font-semibold text-ink-faint underline-offset-2 hover:text-ink-muted hover:underline"
        >
          {pratinjauAnon ? 'Sembunyikan aturan komunitas' : 'Baca aturan komunitas'}
        </button>
        {pratinjauAnon ? (
          <ul className="space-y-1 rounded-xl bg-surface-sunken p-3 text-[11.5px] leading-relaxed text-ink-muted">
            <li>• Dilarang menyebarkan data pribadi orang lain (nama lengkap + aib, foto, nomor HP).</li>
            <li>• Kritik boleh, fitnah tidak. Laporan palsu yang terbukti = sanksi ban.</li>
            <li>• Kata kasar otomatis disensor.</li>
            <li>• Maksimal {LIMITS.postKarakter} karakter dan 3 post per 10 menit.</li>
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}

async function ambilChannelId(slug) {
  const sb = getSupabaseBrowser();
  const { data } = await sb.from('channels').select('id').eq('slug', slug).maybeSingle();
  return data?.id || null;
}
