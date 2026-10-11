'use client';

import { useState } from 'react';
import {
  BadgeCheck, KeyRound, Search, ShieldCheck, UserCheck, UserMinus, UserPlus, Users,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Alert, Baris, EmptyState, GrupBaris, Skeleton, TombolSalin } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import EnvKurang from '@/components/EnvKurang';
import { apiPost } from '@/lib/api-client';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { maskNis, waktuRelatif } from '@/lib/utils';

export default function AdminVerifikasi() {
  const profile = useStore((s) => s.profile);
  const isAdmin = ['pembina', 'admin', 'super_admin'].includes(profile?.role);
  const [cari, setCari] = useState('');
  const { data, loading, error, refresh } = useQuery(() => ambilJson(`/api/admin/verify?q=${encodeURIComponent(cari)}`), {
    deps: [cari, profile?.id],
  });

  const [buatOsis, setBuatOsis] = useState(false);
  const [detailRole, setDetailRole] = useState(null);
  const [kredensial, setKredensial] = useState(null);

  async function verifikasiManual(nis) {
    const res = await apiPost('/api/admin/verify', { action: 'verify', nis });
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    refresh();
  }

  async function cabutVerifikasi(user) {
    const res = await apiPost('/api/admin/verify', { action: 'unverify', user_id: user.id });
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    refresh();
  }

  return (
    <div className="space-y-5">
      <EnvKurang error={error} loading={loading} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Verifikasi & Akun</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            Verifikasi manual, buat akun OSIS, ubah role, dan reset password siswa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button varian="sekunder" ukuran="sm" onClick={refresh}>
            Muat ulang
          </Button>
          <Button ukuran="sm" onClick={() => setBuatOsis(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Buat akun OSIS
          </Button>
        </div>
      </div>

      {!isAdmin ? (
        <Alert jenis="warning" judul="Akses terbatas">
          Sebagai anggota OSIS kamu bisa memverifikasi manual, tapi membuat akun OSIS, mengubah
          role, dan mereset password hanya bisa dilakukan admin/pembina.
        </Alert>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari username, nama, atau NIS…"
          aria-label="Cari akun"
          className="input-dasar min-h-touch-11 pl-9"
        />
      </div>

      {loading && !data ? <Skeleton className="h-32 w-full rounded-2xl" /> : null}

      {/* ---------- akun belum terverifikasi ---------- */}
      <GrupBaris judul={`Perlu diverifikasi (${data?.belumTerverifikasi?.length ?? 0})`}>
        {(data?.belumTerverifikasi || []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">@{p.username}</p>
              <p className="truncate text-[11.5px] text-ink-muted">
                {p.nama_lengkap || '-'} · NIS {maskNis(p.nis || '-')} · daftar {waktuRelatif(p.created_at)}
              </p>
            </div>
            <Button ukuran="sm" onClick={() => verifikasiManual(p.nis)} disabled={!p.nis}>
              <UserCheck className="h-3.5 w-3.5" /> Verifikasi
            </Button>
          </div>
        ))}
        {!data?.belumTerverifikasi?.length ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">
            Semua akun sudah terverifikasi. Pendaftaran lewat NIS otomatis terverifikasi.
          </p>
        ) : null}
      </GrupBaris>

      {/* ---------- siswa belum punya akun ---------- */}
      <GrupBaris judul={`Siswa belum mendaftar (${data?.siswaBelumDaftar?.length ?? 0})`}>
        {(data?.siswaBelumDaftar || []).slice(0, 15).map((s) => (
          <Baris
            key={s.nis}
            icon={Users}
            judul={s.nama}
            deskripsi={`NIS ${s.nis} · ${s.kelas || '-'} · angkatan ${s.angkatan}`}
          />
        ))}
        {!data?.siswaBelumDaftar?.length ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">
            Semua siswa terdata sudah punya akun (atau data belum di-import).
          </p>
        ) : null}
      </GrupBaris>

      {/* ---------- anggota OSIS ---------- */}
      <GrupBaris judul={`Anggota OSIS (${data?.anggotaOsis?.length ?? 0})`}>
        {(data?.anggotaOsis || []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                @{p.username} <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-500" />
              </p>
              <p className="truncate text-[11.5px] text-ink-muted">
                {p.nama_lengkap || '-'} · NIS {maskNis(p.nis || '-')} · role {p.role}
              </p>
            </div>
            {isAdmin ? (
              <Button varian="sekunder" ukuran="sm" onClick={() => setDetailRole(p)}>
                Ubah role
              </Button>
            ) : null}
          </div>
        ))}
        {!data?.anggotaOsis?.length ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">
            Belum ada akun OSIS. Buat lewat tombol di atas, atau import CSV mode OSIS.
          </p>
        ) : null}
      </GrupBaris>

      {/* ---------- akun diblokir ---------- */}
      <GrupBaris judul={`Pernah diblokir (${data?.diblokir?.length ?? 0})`}>
        {(data?.diblokir || []).map((p) => (
          <Baris
            key={p.id}
            icon={UserMinus}
            judul={`@${p.username}`}
            deskripsi={
              p.banned_until && new Date(p.banned_until) > new Date()
                ? `Aktif diblokir sampai ${new Date(p.banned_until).toLocaleString('id-ID')}`
                : `Blokir sudah berakhir (${waktuRelatif(p.banned_until)})`
            }
            bahaya={p.banned_until && new Date(p.banned_until) > new Date()}
          />
        ))}
        {!data?.diblokir?.length ? (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">Tidak ada akun yang pernah diblokir.</p>
        ) : null}
      </GrupBaris>

      {/* ---------- modal buat akun OSIS ---------- */}
      <ModalBuatOsis
        terbuka={buatOsis}
        onClose={() => setBuatOsis(false)}
        onDone={(kred) => {
          setBuatOsis(false);
          setKredensial(kred);
          refresh();
        }}
      />

      {/* ---------- modal ubah role ---------- */}
      <ModalRole
        target={detailRole}
        onClose={() => setDetailRole(null)}
        onDone={() => {
          setDetailRole(null);
          refresh();
        }}
      />

      {/* ---------- kredensial hasil pembuatan akun ---------- */}
      <Modal
        terbuka={Boolean(kredensial)}
        onClose={() => setKredensial(null)}
        judul="Akun OSIS dibuat"
        deskripsi="Simpan & bagikan lewat jalur tertutup. Minta yang bersangkutan segera ganti password."
      >
        {kredensial ? (
          <div className="space-y-2.5">
            <div className="rounded-xl border-2 border-dashed border-accent-400 bg-accent-50 p-3.5 dark:bg-accent-500/10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent-700 dark:text-accent-300">Kredensial login</p>
              <p className="mt-2 font-mono text-sm font-bold">NIS: {kredensial.nis}</p>
              <p className="font-mono text-sm font-bold">Password: {kredensial.password}</p>
              <p className="mt-1 text-[11.5px] text-ink-muted">Username: @{kredensial.username} · {kredensial.nama}</p>
              <div className="mt-2.5 flex gap-2">
                <TombolSalin teks={`NIS ${kredensial.nis}\nPassword ${kredensial.password}`} label="Salin semua" />
              </div>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink-muted">
              Login lewat halaman <b>/login</b> memakai NIS + password di atas. Badge centang emas
              muncul otomatis setelah dia login ulang.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ModalBuatOsis({ terbuka, onClose, onDone }) {
  const [form, setForm] = useState({ nis: '', username: '', password: '', nama: '' });
  const [sibuk, setSibuk] = useState(false);
  const [acak, setAcak] = useState('');

  async function submit() {
    setSibuk(true);
    const res = await apiPost('/api/admin/verify', { action: 'create_osis', ...form });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    onDone(res.data?.kredensial);
    setForm({ nis: '', username: '', password: '', nama: '' });
  }

  return (
    <Modal
      terbuka={terbuka}
      onClose={onClose}
      judul="Buat akun OSIS"
      deskripsi="NIS harus sudah ada di data siswa. Kalau belum, import dulu."
      footer={
        <div className="flex gap-2">
          <Button varian="sekunder" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-1" onClick={submit} loading={sibuk} disabled={!form.nis || !form.username}>
            <ShieldCheck className="h-4 w-4" /> Buat akun
          </Button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Input
          label="NIS"
          value={form.nis}
          onChange={(e) => setForm((f) => ({ ...f, nis: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
          inputMode="numeric"
          placeholder="8 digit"
          maxLength={8}
        />
        <Input
          label="Username"
          value={form.username}
          onChange={(e) =>
            setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20) }))
          }
          placeholder="contoh: osis.fauzan"
          hint="Username resmi OSIS disarankan berawalan 'osis.'"
        />
        <Input
          label="Nama (opsional)"
          value={form.nama}
          onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))}
          placeholder="Kosongkan = pakai nama dari data siswa"
        />
        <div>
          <Input
            label="Password awal"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Minimal 8 karakter"
            hint="Kosongkan untuk memakai password sementara otomatis (Td2-<NIS>-Os!s)"
            suffix={
              <button
                type="button"
                onClick={() => {
                  const p = `Td2-${form.nis || '00000000'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
                  setForm((f) => ({ ...f, password: p }));
                  setAcak(p);
                }}
                aria-label="Buat password acak"
                className="flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-primary-600 dark:text-primary-300"
              >
                <KeyRound className="h-3.5 w-3.5" /> Acak
              </button>
            }
          />
          {acak ? (
            <p className="mt-1.5 flex items-center gap-2 text-[11.5px] font-bold text-ink-muted">
              {acak} <TombolSalin teks={acak} label="Salin" />
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function ModalRole({ target, onClose, onDone }) {
  const [role, setRole] = useState(target?.role || 'osis');
  const [sibuk, setSibuk] = useState(false);

  async function submit() {
    if (!target) return;
    setSibuk(true);
    const res = await apiPost('/api/admin/roles', { user_id: target.id, role });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    onDone();
  }

  return (
    <Modal
      terbuka={Boolean(target)}
      onClose={onClose}
      judul={`Ubah role @${target?.username || ''}`}
      footer={
        <div className="flex gap-2">
          <Button varian="sekunder" className="flex-1" onClick={onClose}>Batal</Button>
          <Button className="flex-1" onClick={submit} loading={sibuk}>Simpan role</Button>
        </div>
      }
    >
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="siswa">Siswa (tanpa badge)</option>
        <option value="osis">Anggota OSIS (badge emas)</option>
        <option value="pembina">Pembina OSIS (akses admin)</option>
        <option value="admin">Admin (akses penuh)</option>
        <option value="super_admin">Super Admin (bisa ubah super_admin lain)</option>
      </Select>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
        Role juga ditulis ke <code className="rounded bg-slate-900/10 px-1">auth.users.app_metadata</code>{' '}
        supaya ikut terbawa di JWT. Minta user yang bersangkutan <b>login ulang</b> agar perubahannya
        langsung terasa. Semua perubahan role tercatat di audit log.
      </p>
    </Modal>
  );
}
