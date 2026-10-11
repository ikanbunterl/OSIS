'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BadgeCheck, Check, CircleCheck, CircleX, IdCard, Loader2, Lock, ShieldCheck, UserRound, X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Checkbox, Input, PasswordInput } from '@/components/ui/Input';
import { Alert, Spinner } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { apiPost, apiGet } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import {
  errorPerField, extractPrefix, nisKeEmail, registerSchema, skorPassword,
} from '@/lib/validators';
import { cekImpersonasi, normUsername } from '@/lib/censor';
import { LIMITS, PESAN } from '@/lib/constants';
import { classNames } from '@/lib/utils';

/**
 * Halaman registrasi (PLAN Bagian 5).
 * Verifikasi NIS dilakukan 2 lapis:
 *  1. cek langsung ke /api/verify-nis saat NIS+nama sudah diisi (umpan balik cepat)
 *  2. dicek ulang di /api/register saat submit (penegakan sesungguhnya)
 */
function FormDaftar() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/home';

  const [prefixes, setPrefixes] = useState([]);
  const [form, setForm] = useState({
    nis: '',
    nama: '',
    username: '',
    password: '',
    konfirmasiPassword: '',
    setuju: false,
  });
  const [error, setError] = useState({});
  const [cekNis, setCekNis] = useState({ status: 'idle', pesan: '', info: null }); // idle|cek|ok|gagal
  const [cekUsername, setCekUsername] = useState({ status: 'idle', pesan: '' });
  const [sibuk, setSibuk] = useState(false);
  const timerNis = useRef(null);
  const timerUsername = useRef(null);
  const namaRef = useRef(null);

  /* ---- ambil prefix angkatan yang dibuka ---- */
  useEffect(() => {
    (async () => {
      const res = await apiGet('/api/verify-nis', { auth: false });
      if (res.ok && Array.isArray(res.data?.prefixes)) {
        setPrefixes(res.data.prefixes);
      } else {
        // fallback: baca langsung pakai anon key (RLS mengizinkan select publik)
        const { data } = await getSupabaseBrowser()
          .from('academic_years')
          .select('prefix, tahun_ajaran, active');
        setPrefixes(data || []);
      }
    })();
  }, []);

  const prefixAktif = useMemo(
    () => prefixes.filter((p) => p.active).map((p) => String(p.prefix).trim()),
    [prefixes],
  );

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  /* ---- cek NIS + nama otomatis (debounce 700ms) ---- */
  useEffect(() => {
    clearTimeout(timerNis.current);
    const nis = form.nis;
    const nama = form.nama.trim();

    if (nis.length !== 8) {
      setCekNis({ status: 'idle', pesan: '', info: null });
      return;
    }
    if (prefixAktif.length && !prefixAktif.includes(extractPrefix(nis))) {
      setCekNis({
        status: 'gagal',
        pesan: `${PESAN.prefixNonaktif} Prefix yang dibuka: ${prefixAktif.join(', ')}.`,
      });
      return;
    }
    if (nama.length < 3) {
      setCekNis({ status: 'idle', pesan: 'Tulis nama lengkapmu untuk mengecek NIS.', info: null });
      return;
    }

    setCekNis({ status: 'cek', pesan: 'Mencocokkan dengan data sekolah…', info: null });
    timerNis.current = setTimeout(async () => {
      const res = await apiPost('/api/verify-nis', { nis, nama }, { auth: false });
      if (!res.ok && res.status === 0) {
        setCekNis({ status: 'gagal', pesan: PESAN.jaringan });
        return;
      }
      const d = res.data || {};
      if (d.tersedia) {
        setCekNis({
          status: 'ok',
          pesan: `Cocok! ${d.siswa?.kelas ? `Kelas ${d.siswa.kelas}` : ''} ${
            d.siswa?.tahun_ajaran ? `· TA ${d.siswa.tahun_ajaran}` : ''
          }`.trim(),
          info: d.siswa,
        });
      } else {
        setCekNis({ status: 'gagal', pesan: d.message || PESAN.nisTakTerdaftar, kode: d.kode });
      }
    }, 700);

    return () => clearTimeout(timerNis.current);
  }, [form.nis, form.nama, prefixAktif]);

  /* ---- cek username otomatis (debounce 600ms) ---- */
  useEffect(() => {
    clearTimeout(timerUsername.current);
    const u = normUsername(form.username);
    if (u.length < LIMITS.usernameMin) {
      setCekUsername({ status: 'idle', pesan: '' });
      return;
    }
    const imp = cekImpersonasi(u);
    if (!imp.ok) {
      setCekUsername({ status: 'gagal', pesan: imp.alasan });
      return;
    }
    setCekUsername({ status: 'cek', pesan: 'Memeriksa ketersediaan…' });
    timerUsername.current = setTimeout(async () => {
      const { count, error } = await getSupabaseBrowser()
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('username', u);
      if (error) {
        setCekUsername({ status: 'gagal', pesan: 'Tidak bisa memeriksa username sekarang.' });
        return;
      }
      setCekUsername(
        count > 0
          ? { status: 'gagal', pesan: PESAN.usernameDipakai }
          : { status: 'ok', pesan: `@${u} tersedia` },
      );
    }, 600);
    return () => clearTimeout(timerUsername.current);
  }, [form.username]);

  const skor = skorPassword(form.password);
  const labelSkor = ['Sangat lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][skor];
  const warnaSkor = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'][skor];

  /* ---- submit ---- */
  async function submit(e) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const err = errorPerField(parsed);
      setError(err);
      toast.warning(err._form || Object.values(err)[0] || 'Periksa lagi isianmu.');
      return;
    }
    if (cekNis.status === 'gagal') {
      setError({ nis: cekNis.pesan });
      toast.error(cekNis.pesan);
      return;
    }
    setError({});
    setSibuk(true);

    const res = await apiPost('/api/register', parsed.data, { auth: false });
    if (!res.ok) {
      setSibuk(false);
      const field = res.data?.field || (res.data?.kode === 'NIS_SUDAH_DIPAKAI' ? 'nis' : null);
      if (field) setError({ [field]: res.message });
      else if (res.errors) setError(res.errors);
      else setError({ _form: res.message });
      toast.error(res.message || 'Pendaftaran gagal.');
      return;
    }

    // langsung login supaya tidak perlu isi ulang
    const sb = getSupabaseBrowser();
    const { error: errLogin } = await sb.auth.signInWithPassword({
      email: nisKeEmail(parsed.data.nis),
      password: parsed.data.password,
    });

    setSibuk(false);
    if (errLogin) {
      toast.sukses('Akun dibuat. Silakan login dengan NIS & password-mu.');
      router.replace('/login?terdaftar=1');
      return;
    }
    toast.sukses('Selamat datang! Akunmu sudah terverifikasi.');
    router.replace(next.startsWith('/') ? next : '/home');
    router.refresh();
  }

  return (
    <>
      <div className="kartu p-5">
        <div className="mb-1 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-accent-500" />
          <h1 className="text-xl font-black tracking-tight">Daftar akun siswa</h1>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">
          Data kamu dicocokkan langsung dengan data siswa dari sekolah. Kalau NIS belum ada di
          sistem, minta wali kelas / admin OSIS mengimpornya dulu.
        </p>

        {prefixAktif.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Angkatan dibuka:
            </span>
            {prefixes.map((p) => (
              <span
                key={p.prefix}
                className={classNames(
                  'chip',
                  p.active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'opacity-50 line-through',
                )}
                title={p.tahun_ajaran}
              >
                {p.prefix}
              </span>
            ))}
          </div>
        ) : null}

        {error._form ? (
          <Alert jenis="bahaya" className="mt-4">
            {error._form}
          </Alert>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Input
            label="NIS"
            name="nis"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCapitalize="none"
            placeholder="8 digit, contoh 26270001"
            maxLength={8}
            icon={IdCard}
            value={form.nis}
            onChange={(e) => setForm((f) => ({ ...f, nis: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
            error={error.nis}
            required
            hint={form.nis.length === 8 ? `Prefix angkatan: ${extractPrefix(form.nis)}` : '4 digit pertama = kode angkatan'}
          />

          <Input
            ref={namaRef}
            label="Nama lengkap (sesuai data sekolah)"
            name="nama"
            autoComplete="name"
            placeholder="Contoh: Bintang Arya Pratama"
            maxLength={80}
            icon={UserRound}
            value={form.nama}
            onChange={set('nama')}
            error={error.nama}
            required
            hint="Harus sama dengan data di TU. Singkatan boleh, tapi jangan ganti nama."
          />

          {/* status pengecekan NIS */}
          {cekNis.status !== 'idle' ? (
            <div
              className={classNames(
                'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed',
                cekNis.status === 'ok' &&
                  'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200',
                cekNis.status === 'gagal' &&
                  'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200',
                cekNis.status === 'cek' && 'border-line bg-surface-sunken text-ink-muted',
              )}
              role="status"
            >
              {cekNis.status === 'cek' ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : cekNis.status === 'ok' ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CircleX className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                <b>{cekNis.pesan}</b>
                {cekNis.status === 'gagal' && cekNis.kode === 'NAMA_TIDAK_COCOK' ? (
                  <span className="mt-1 block">
                    Tips: tulis nama persis seperti di rapor/absen. Gelar, "Alm.", dan tanda baca
                    diabaikan otomatis.
                  </span>
                ) : null}
                {cekNis.status === 'gagal' && cekNis.kode === 'NIS_TAK_TERDAFTAR' ? (
                  <span className="mt-1 block">
                    Kirim NIS & nama lengkapmu ke pengurus OSIS agar diimpor ke sistem.
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}

          <div className="divider" />

          <Input
            label="Username"
            name="username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="contoh: bintang.arya"
            maxLength={LIMITS.usernameMax}
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                username: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9._]/g, '')
                  .slice(0, LIMITS.usernameMax),
              }))
            }
            error={error.username}
            hint={
              cekUsername.pesan ||
              `${LIMITS.usernameMin}–${LIMITS.usernameMax} karakter: huruf kecil, angka, titik, garis bawah`
            }
            required
            suffix={
              cekUsername.status === 'ok' ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : cekUsername.status === 'gagal' ? (
                <X className="h-4 w-4 text-rose-500" />
              ) : cekUsername.status === 'cek' ? (
                <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
              ) : null
            }
          />
          {cekUsername.status === 'gagal' ? (
            <p className="-mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{cekUsername.pesan}</p>
          ) : cekUsername.status === 'ok' ? (
            <p className="-mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{cekUsername.pesan}</p>
          ) : null}

          <div>
            <PasswordInput
              label="Password"
              name="password"
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              value={form.password}
              onChange={set('password')}
              error={error.password}
              required
            />
            {form.password ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex h-1.5 flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={classNames('h-full flex-1 rounded-full transition', i < skor ? warnaSkor : 'bg-line')}
                    />
                  ))}
                </div>
                <span className="w-24 text-right text-[11px] font-bold text-ink-muted">{labelSkor}</span>
              </div>
            ) : null}
          </div>

          <PasswordInput
            label="Ulangi password"
            name="konfirmasiPassword"
            autoComplete="new-password"
            placeholder="Ketik ulang password"
            value={form.konfirmasiPassword}
            onChange={set('konfirmasiPassword')}
            error={error.konfirmasiPassword}
            required
          />

          <Checkbox
            checked={form.setuju}
            onChange={set('setuju')}
            error={error.setuju}
            label={
              <>
                Saya menyetujui <b className="text-ink">aturan komunitas</b>: tidak menyebarkan
                data pribadi, tidak memfitnah, dan siap menerima sanksi bila melanggar.
              </>
            }
          />

          <Button
            type="submit"
            ukuran="lg"
            className="w-full"
            loading={sibuk}
            disabled={sibuk || cekNis.status !== 'ok' || cekUsername.status === 'gagal'}
          >
            {!sibuk ? <ShieldCheck className="h-[18px] w-[18px]" /> : null}
            {sibuk ? 'Membuat akun…' : 'Daftar & verifikasi otomatis'}
          </Button>

          {cekNis.status !== 'ok' && !sibuk ? (
            <p className="text-center text-[11px] leading-relaxed text-ink-faint">
              Tombol aktif setelah NIS + nama cocok dengan data sekolah dan username tersedia.
            </p>
          ) : null}
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-ink-muted">
        Sudah punya akun?{' '}
        <Link href="/login" className="link-teks">
          Masuk di sini
        </Link>
      </p>

      <div className="mt-5 rounded-xl border border-line bg-surface-raised p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Lock className="h-3.5 w-3.5" /> Kenapa tidak pakai email?
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
          Tidak semua siswa punya email aktif. Karena itu login cukup pakai NIS + password.
          NIS-mu dipakai sebagai identitas internal dan tidak pernah ditampilkan ke siswa lain
          tanpa izin.
        </p>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <FormDaftar />
    </Suspense>
  );
}
