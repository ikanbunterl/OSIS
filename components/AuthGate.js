'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn } from 'lucide-react';
import { Spinner, EmptyState } from '@/components/ui/index';
import Button from '@/components/ui/Button';
import { useStore } from '@/lib/store';
import { ROLES } from '@/lib/constants';

/**
 * Gerbang akses untuk halaman yang butuh login / role tertentu.
 *
 * @param {boolean} butuhLogin   default true
 * @param {string[]} role        daftar role yang diizinkan, mis. ['admin','super_admin']
 * @param {boolean} butuhVerifikasi default true
 * @param {string}  kembaliKe    tujuan setelah login (default: halaman ini)
 */
export default function AuthGate({
  children,
  butuhLogin = true,
  role = null,
  butuhVerifikasi = false,
  kembaliKe,
}) {
  const router = useRouter();
  const { hydrated, session, profile, loading } = useStore();

  const tujuan = kembaliKe || (typeof window !== 'undefined' ? window.location.pathname : '/home');

  useEffect(() => {
    if (!hydrated) return;
    if (butuhLogin && !session) {
      router.replace(`/login?next=${encodeURIComponent(tujuan)}`);
    }
  }, [hydrated, session, butuhLogin, router, tujuan]);

  if (!hydrated || (butuhLogin && loading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
        <span className="sr-only">Memeriksa sesi…</span>
      </div>
    );
  }

  if (butuhLogin && !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (butuhLogin && session && !profile) {
    return (
      <EmptyState
        icon={ShieldAlert}
        judul="Profil tidak ditemukan"
        pesan="Akunmu login tapi belum punya profil. Hubungi admin OSIS untuk diperbaiki."
        aksi={
          <Button
            varian="sekunder"
            onClick={async () => {
              const { logout } = await import('@/lib/auth');
              await logout();
              router.replace('/login');
            }}
          >
            <LogIn className="h-4 w-4" /> Login dengan akun lain
          </Button>
        }
      />
    );
  }

  if (profile && role?.length && !role.includes(profile.role)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        judul="Akses ditolak"
        pesan={`Halaman ini khusus untuk ${role.map((r) => ROLES[r]?.label || r).join(' / ')}. ` +
          `Kamu masuk sebagai ${ROLES[profile.role]?.label || profile.role}.`}
        aksi={<Button varian="sekunder" onClick={() => router.replace('/home')}>Kembali ke Home</Button>}
      />
    );
  }

  if (butuhVerifikasi && profile && !profile.verified_at) {
    return (
      <EmptyState
        icon={ShieldAlert}
        judul="Akun belum terverifikasi"
        pesan="Hubungi admin OSIS untuk memverifikasi NIS-mu. Setelah itu semua fitur akan terbuka."
      />
    );
  }

  if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
    return (
      <EmptyState
        icon={ShieldAlert}
        judul="Akun diblokir"
        pesan={`Kamu tidak bisa mengakses aplikasi sampai ${new Date(profile.banned_until).toLocaleString('id-ID')}. ` +
          'Ajukan keberatan lewat pembina OSIS.'}
      />
    );
  }

  return children;
}
