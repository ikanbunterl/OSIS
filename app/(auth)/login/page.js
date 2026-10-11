'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fingerprint, Lock, ShieldAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, PasswordInput } from '@/components/ui/Input';
import { Alert, Spinner } from '@/components/ui/index';
import { apiGet } from '@/lib/api-client';
import { toast } from '@/components/ui/Toast';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { loginSchema, nisKeEmail, extractPrefix } from '@/lib/validators';
import { errorPerField } from '@/lib/validators';
import { PESAN, RATE_LIMITS } from '@/lib/constants';

const KUNCI_LOCK = 'osis-login-lock';
const KUNCI_GAGAL = 'osis-login-gagal';

/**
 * Halaman login: NIS + password (PLAN Bagian 5).
 * - NIS dipetakan ke email pseudo <nis>@siswa.local
 * - ada lockout lokal 5x gagal / 15 menit (pelengkap rate limit server)
 * - NIS nonaktif ditolak dengan pesan yang jelas
 */
function FormLogin() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/home';
  const nisRef = useRef(null);
  const clear = useStore((s) => s.clear);
  const refreshProfile = useStore((s) => s.refreshProfile);

  const [form, setForm] = useState({ nis: '', password: '' });
  const [error, setError] = useState({});
  const [sibuk, setSibuk] = useState(false);
  const [terkunci, setTerkunci] = useState(0); // detik tersisa
  const [pesanLock, setPesanLock] = useState('');

  useEffect(() => {
    nisRef.current?.focus();
    if (sp.get('terdaftar')) toast.sukses('Pendaftaran berhasil! Silakan login.');
  }, [sp]);

  // hitung mundur lockout
  useEffect(() => {
    if (!terkunci) return undefined;
    const t = setInterval(() => {
      setTerkunci((s) => {
        const sisa = s - 1;
        if (sisa <= 0) {
          localStorage.removeItem(KUNCI_LOCK);
          localStorage.removeItem(KUNCI_GAGAL);
          setPesanLock('');
          return 0;
        }
        return sisa;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [terkunci]);

  // pulihkan lock kalau halaman dibuka ulang
  useEffect(() => {
    try {
      const sampai = Number(localStorage.getItem(KUNCI_LOCK) || 0);
      if (sampai > Date.now()) {
        setTerkunci(Math.ceil((sampai - Date.now()) / 1000));
        setPesanLock(PESAN.loginTerkunci);
      }
    } catch { /* ignore */ }
  }, []);

  async function cekNisAktif(nis) {
    // NIS 8 digit: 4 digit awal = prefix angkatan. Cek juga status siswa di DB.
    const sb = getSupabaseBrowser();
    const { data } = await sb.from('academic_years').select('prefix, active').eq('prefix', extractPrefix(nis)).maybeSingle();
    if (data && !data.active) {
      return { ok: false, pesan: PESAN.prefixNonaktif, field: 'nis' };
    }
    return { ok: true };
  }

  async function submit(e) {
    e.preventDefault();
    if (terkunci) return;

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setError(errorPerField(parsed));
      return;
    }
    setError({});
    setSibuk(true);

    const { nis, password } = parsed.data;

    const cek = await cekNisAktif(nis);
    if (!cek.ok) {
      setSibuk(false);
      setError({ [cek.field || 'nis']: cek.pesan });
      return;
    }

    const sb = getSupabaseBrowser();
    const { data, error: err } = await sb.auth.signInWithPassword({
      email: nisKeEmail(nis),
      password,
    });

    if (err || !data?.session) {
      // catat kegagalan untuk lockout lokal
      let gagal = [];
      try {
        gagal = JSON.parse(localStorage.getItem(KUNCI_GAGAL) || '[]');
      } catch { gagal = []; }
      gagal.push(Date.now());
      gagal = gagal.filter((t) => Date.now() - t < RATE_LIMITS.loginJendelaMenit * 60 * 1000);
      localStorage.setItem(KUNCI_GAGAL, JSON.stringify(gagal));

      if (gagal.length >= RATE_LIMITS.loginGagalMaksimal) {
        const sampai = Date.now() + RATE_LIMITS.loginLockMenit * 60 * 1000;
        localStorage.setItem(KUNCI_LOCK, String(sampai));
        setTerkunci(RATE_LIMITS.loginLockMenit * 60);
        setPesanLock(PESAN.loginTerkunci);
        toast.error(PESAN.loginTerkunci);
      } else {
        const sisa = RATE_LIMITS.loginGagalMaksimal - gagal.length;
        const pesan =
          err?.message?.toLowerCase().includes('invalid login')
            ? `${PESAN.loginGagal} Sisa percobaan: ${sisa}.`
            : err?.message || PESAN.loginGagal;
        setError({ password: pesan });
        toast.error(pesan);
      }
      setSibuk(false);
      return;
    }

    // sukses -> bersihkan lock
    localStorage.removeItem(KUNCI_GAGAL);
    localStorage.removeItem(KUNCI_LOCK);

    // Cek status akun ke server: NIS masih aktif? tidak diblokir?
    // (tabel `students` hanya bisa dibaca staff, jadi browser tidak bisa cek sendiri)
    const guard = await apiGet('/api/auth/guard');
    if (guard.ok && guard.data?.boleh === false) {
      await sb.auth.signOut();
      clear();
      setSibuk(false);
      setError({ nis: guard.data.message });
      toast.error(guard.data.message);
      return;
    }
    if (guard.ok && guard.data?.dimute) {
      toast.warning(guard.data.message, { durasi: 6000 });
    }

    clear();
    await refreshProfile();
    setSibuk(false);
    toast.sukses('Berhasil masuk. Selamat datang kembali!');
    router.replace(next.startsWith('/') ? next : '/home');
    router.refresh();
  }

  const mm = String(Math.floor(terkunci / 60)).padStart(2, '0');
  const ss = String(terkunci % 60).padStart(2, '0');

  return (
    <>
      <div className="kartu p-5">
        <h1 className="text-xl font-black tracking-tight">Masuk</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gunakan NIS 8 digit dan password yang kamu buat saat mendaftar.
        </p>

        {pesanLock && terkunci ? (
          <Alert jenis="bahaya" judul={`Terkunci sementara (${mm}:${ss})`} className="mt-4">
            Terlalu banyak percobaan gagal. Tunggu sampai hitungan selesai, atau minta reset password
            ke admin OSIS.
          </Alert>
        ) : null}

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <Input
            ref={nisRef}
            label="NIS"
            name="nis"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="username"
            autoCapitalize="none"
            placeholder="Contoh: 26270001"
            maxLength={8}
            icon={Fingerprint}
            value={form.nis}
            onChange={(e) => setForm((f) => ({ ...f, nis: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
            error={error.nis}
            hint={form.nis.length === 8 ? `Angkatan terdeteksi: prefix ${extractPrefix(form.nis)}` : '8 digit angka'}
            disabled={Boolean(terkunci)}
            required
          />

          <PasswordInput
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Masukkan password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={error.password}
            disabled={Boolean(terkunci)}
            required
          />

          <Button type="submit" ukuran="lg" className="w-full" loading={sibuk} disabled={Boolean(terkunci)}>
            {!sibuk ? <Lock className="h-4 w-4" /> : null}
            {sibuk ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">belum punya akun</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Link
          href={`/register${next !== '/home' ? `?next=${encodeURIComponent(next)}` : ''}`}
          className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border-2 border-primary-600 px-4 text-sm font-bold text-primary-700 transition hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
        >
          <ShieldAlert className="h-4 w-4" /> Daftar dengan NIS sekolah
        </Link>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-ink-muted">
        Lupa password? Minta reset ke admin OSIS / pembina — mereka bisa membuatkan password baru
        lewat dashboard admin.
      </p>
    </>
  );
}


export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <FormLogin />
    </Suspense>
  );
}
