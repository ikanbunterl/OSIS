'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell, BellOff, Camera, Check, ChevronRight, Download, FileText, IdCard, LogOut,
  MessageSquareQuote, Moon, Palette, Pencil, Save, ShieldCheck, Sparkles, Sun, Ticket, Trash2, UserRound,
} from 'lucide-react';
import Header from '@/components/Header';
import ThemeToggle from '@/components/ThemeToggle';
import VerifiedBadge from '@/components/VerifiedBadge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Avatar, Baris, GrupBaris, TombolSalin } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { logout } from '@/lib/auth';
import { profilSchema } from '@/lib/validators';
import { errorPerField } from '@/lib/validators';
import { APP, LIMITS, MAX_FILE_BYTES, ROLES } from '@/lib/constants';
import { classNames, maskNis, tanggalPendek } from '@/lib/utils';

/**
 * /profil - info akun, badge, ganti avatar, notifikasi push, tema, logout.
 */
export default function ProfilPage() {
  const router = useRouter();
  const { profile, session, refreshProfile, clear } = useStore();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ username: '', nama_lengkap: '', bio: '' });
  const [error, setError] = useState({});
  const [simpan, setSimpan] = useState(false);
  const [unggahAvatar, setUnggahAvatar] = useState(false);
  const [push, setPush] = useState({ siap: false, berlangganan: false, sibuk: false, pesan: '' });
  const inputAvatar = useRef(null);

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username || '',
        nama_lengkap: profile.nama_lengkap || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      const res = await apiGet('/api/push/subscribe');
      if (res.ok) setPush((p) => ({ ...p, siap: res.data.siap, berlangganan: res.data.berlangganan }));
      else setPush((p) => ({ ...p, siap: false }));
    })();
  }, [profile?.id]);

  async function simpanProfil() {
    const parsed = profilSchema.safeParse(form);
    if (!parsed.success) {
      setError(errorPerField(parsed));
      return;
    }
    setSimpan(true);
    const sb = getSupabaseBrowser();
    const { data, error: e } = await sb
      .from('profiles')
      .update({
        username: parsed.data.username,
        nama_lengkap: parsed.data.nama_lengkap || null,
        bio: parsed.data.bio || null,
      })
      .eq('id', profile.id)
      .select()
      .maybeSingle();

    setSimpan(false);
    if (e) {
      const msg = e.message || '';
      setError({ username: msg.includes('duplicate') || msg.includes('unique') ? 'Username sudah dipakai.' : msg });
      toast.error(msg.includes('duplicate') ? 'Username sudah dipakai orang lain.' : msg);
      return;
    }
    setError({});
    await refreshProfile();
    setEdit(false);
    toast.sukses('Profil diperbarui.');
    void data;
  }

  async function gantiAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return toast.error('Format harus JPG, PNG, atau WebP.');
    }
    if (file.size > 2 * 1024 * 1024) return toast.error('Ukuran avatar maksimal 2 MB.');

    setUnggahAvatar(true);
    try {
      const sb = getSupabaseBrowser();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profile.id}/avatar.${ext}`;
      const { error: up } = await sb.storage.from('attachments').upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600',
      });
      if (up) throw new Error(up.message);

      const { data: signed } = await sb.storage.from('attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: e2 } = await sb
        .from('profiles')
        .update({ avatar_url: signed?.signedUrl || null })
        .eq('id', profile.id);
      if (e2) throw new Error(e2.message);

      await refreshProfile();
      toast.sukses('Foto profil diperbarui.');
    } catch (err) {
      toast.error(err.message || 'Gagal mengunggah foto.');
    } finally {
      setUnggahAvatar(false);
    }
  }

  async function aktifkanPush() {
    setPush((p) => ({ ...p, sibuk: true, pesan: '' }));
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Browser ini tidak mendukung notifikasi push.');
      }
      const info = await apiGet('/api/push/subscribe');
      if (!info.ok || !info.data.siap || !info.data.vapidKey) {
        throw new Error('Notifikasi belum diaktifkan di server (VAPID kosong). Jalankan `npm run vapid` lalu isi .env.local.');
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: info.data.vapidKey,
      });

      const res = await apiPost('/api/push/subscribe', { subscription: sub.toJSON() });
      if (!res.ok) throw new Error(res.message);
      setPush({ siap: true, berlangganan: true, sibuk: false, pesan: '' });
      toast.sukses('Notifikasi aktif. Kamu akan dikabari saat ada balasan laporan.');

      // iOS: notif hanya jalan kalau aplikasi dipasang di home screen
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      if (ios && !standalone) {
        setPush((p) => ({
          ...p,
          pesan: 'Di iPhone, notifikasi baru benar-benar muncul setelah aplikasi dipasang ke Home Screen (Bagikan → Tambahkan ke Home Screen).',
        }));
      }
    } catch (err) {
      setPush((p) => ({ ...p, sibuk: false, pesan: err.message }));
      toast.error(err.message || 'Gagal mengaktifkan notifikasi.');
    }
  }

  async function matikanPush() {
    setPush((p) => ({ ...p, sibuk: true }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await apiDelete('/api/push/subscribe', { body: { endpoint: sub?.endpoint } });
      await sub?.unsubscribe();
      setPush({ siap: push.siap, berlangganan: false, sibuk: false, pesan: '' });
      toast.info('Notifikasi dimatikan.');
    } catch (err) {
      setPush((p) => ({ ...p, sibuk: false }));
      toast.error(err.message || 'Gagal mematikan notifikasi.');
    }
  }

  async function keluar() {
    await logout();
    clear();
    toast.info('Kamu sudah keluar.');
    router.replace('/login');
    router.refresh();
  }

  if (!profile) {
    return (
      <>
        <Header judul="Profil" />
        <div className="px-4 py-10 text-center text-sm text-ink-muted">Memuat profil…</div>
      </>
    );
  }

  const roleInfo = ROLES[profile.role] || ROLES.siswa;
  const dibanned = profile.banned_until && new Date(profile.banned_until) > new Date();

  return (
    <>
      <Header judul="Profil" subtitle={APP.namaPendek} />

      {/* kartu identitas */}
      <section className="px-4 pt-4">
        <div className="kartu overflow-hidden">
          <div className="h-20 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900" />
          <div className="relative px-4 pb-4">
            <div className="-mt-10 flex items-end gap-3">
              <div className="relative">
                <Avatar
                  nama={profile.nama_lengkap || profile.username}
                  src={profile.avatar_url}
                  ukuran={80}
                  className="ring-4 ring-surface-raised"
                />
                <button
                  type="button"
                  onClick={() => inputAvatar.current?.click()}
                  disabled={unggahAvatar}
                  aria-label="Ganti foto profil"
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-raised bg-primary-600 text-white shadow"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={inputAvatar}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={gantiAvatar}
                  className="hidden"
                />
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-lg font-black leading-tight">
                    {profile.nama_lengkap || profile.username}
                  </h1>
                  <VerifiedBadge role={profile.role} />
                </div>
                <p className="truncate text-xs text-ink-muted">@{profile.username}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className={classNames(
                  'chip font-bold',
                  profile.role === 'osis'
                    ? 'border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300'
                    : roleInfo.staff
                      ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
                )}
              >
                {roleInfo.staff ? <ShieldCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                {roleInfo.label}
              </span>
              <span className="chip">
                <IdCard className="h-3 w-3" /> NIS {maskNis(profile.nis || '')}
              </span>
              <span className="chip">
                {profile.verified_at ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" /> Terverifikasi {tanggalPendek(profile.verified_at)}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3 w-3 text-amber-500" /> Belum terverifikasi
                  </>
                )}
              </span>
            </div>

            {profile.bio ? (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-surface-sunken p-3 text-[13px] leading-relaxed text-ink-muted">
                {profile.bio}
              </p>
            ) : null}

            {dibanned ? (
              <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                Akun diblokir sampai {new Date(profile.banned_until).toLocaleString('id-ID')}.
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <Button varian="sekunder" ukuran="sm" className="flex-1" onClick={() => setEdit(true)}>
                <Pencil className="h-3.5 w-3.5" /> Ubah profil
              </Button>
              {roleInfo.staff ? (
                <Link href="/admin" className="flex-1">
                  <Button varian="emas" ukuran="sm" className="w-full">
                    <Sparkles className="h-3.5 w-3.5" /> Dashboard
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* konten saya */}
      <GrupBaris judul="Aktivitasku">
        <Link href="/lapor?tab=riwayat">
          <Baris icon={Ticket} judul="Laporan saya" deskripsi="Status & balasan admin" kanan={<ChevronRight className="h-4 w-4 text-ink-faint" />} />
        </Link>
        <Link href="/talent">
          <Baris icon={Palette} judul="Karya yang saya unggah" deskripsi="Galeri Talent" kanan={<ChevronRight className="h-4 w-4 text-ink-faint" />} />
        </Link>
        <Link href="/aspirasi">
          <Baris icon={MessageSquareQuote} judul="Buka Aspirasi" deskripsi="Tulis pendapat anonim" kanan={<ChevronRight className="h-4 w-4 text-ink-faint" />} />
        </Link>
      </GrupBaris>

      {/* notifikasi */}
      <GrupBaris judul="Notifikasi">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                {push.berlangganan ? <Bell className="h-4 w-4 text-emerald-500" /> : <BellOff className="h-4 w-4 text-ink-faint" />}
                Notifikasi push
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
                Kabari saya saat ada balasan laporan, pengumuman OSIS, atau pesan penting.
              </p>
              {!push.siap ? (
                <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Belum aktif di server (kunci VAPID kosong).
                </p>
              ) : null}
              {push.pesan ? <p className="mt-1 text-[11px] text-ink-muted">{push.pesan}</p> : null}
            </div>
            {push.berlangganan ? (
              <Button varian="sekunder" ukuran="sm" onClick={matikanPush} disabled={push.sibuk}>
                Matikan
              </Button>
            ) : (
              <Button ukuran="sm" onClick={aktifkanPush} loading={push.sibuk}>
                Aktifkan
              </Button>
            )}
          </div>
        </div>
      </GrupBaris>

      {/* tampilan & aplikasi */}
      <GrupBaris judul="Tampilan & aplikasi">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Moon className="h-4 w-4 text-ink-faint" /> Tema
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-muted">Default mengikuti pengaturan sistem HP.</p>
          </div>
          <ThemeToggle />
        </div>
        <Baris
          icon={Download}
          judul="Pasang aplikasi (PWA)"
          deskripsi="Buka dari layar utama, lebih cepat & bisa offline"
          kanan={<ChevronRight className="h-4 w-4 text-ink-faint" />}
          onClick={() =>
            toast.info(
              'Chrome/Android: menu ⋮ → "Tambahkan ke layar utama". iPhone/Safari: Bagikan → "Tambahkan ke Home Screen".',
              { durasi: 7000 },
            )
          }
        />
        <Baris
          icon={Sun}
          judul="Versi aplikasi"
          deskripsi={`${APP.namaPendek} · ${session?.user?.id ? `sesi aktif sejak ${tanggalPendek(session.user.created_at || new Date())}` : 'tidak ada sesi'}`}
        />
      </GrupBaris>

      {/* akun */}
      <GrupBaris judul="Akun">
        <Baris
          icon={UserRound}
          judul="Data sekolah"
          deskripsi={`NIS ${maskNis(profile.nis || '-')} · data berasal dari TU, tidak bisa diubah sendiri`}
        />
        <Baris
          icon={LogOut}
          judul="Keluar"
          bahaya
          onClick={keluar}
          kanan={<ChevronRight className="h-4 w-4 text-ink-faint" />}
        />
      </GrupBaris>

      <p className="px-6 py-6 text-center text-[11px] leading-relaxed text-ink-faint">
        {APP.nama}
        <br />
        Butuh bantuan? Hubungi pengurus OSIS atau pembina.
      </p>

      {/* modal edit */}
      <Modal
        terbuka={edit}
        onClose={() => setEdit(false)}
        judul="Ubah profil"
        footer={
          <div className="flex gap-2">
            <Button varian="sekunder" className="flex-1" onClick={() => setEdit(false)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={simpanProfil} loading={simpan}>
              <Save className="h-4 w-4" /> Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Input
            label="Username"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, LIMITS.usernameMax),
              }))
            }
            error={error.username}
            hint={`${LIMITS.usernameMin}–${LIMITS.usernameMax} karakter, huruf kecil/angka/titik/_`}
          />
          <Input
            label="Nama tampilan"
            value={form.nama_lengkap}
            onChange={(e) => setForm((f) => ({ ...f, nama_lengkap: e.target.value.slice(0, 80) }))}
            error={error.nama_lengkap}
            hint="Nama asli dari data sekolah tidak bisa diubah di sini."
          />
          <Textarea
            label="Bio"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, LIMITS.bioKarakter) }))}
            rows={3}
            error={error.bio}
            placeholder="Contoh: XI RPL 1 · suka desain poster & futsal"
            hint={`${form.bio.length}/${LIMITS.bioKarakter}`}
            hitung={false}
          />
        </div>
      </Modal>
    </>
  );
}
