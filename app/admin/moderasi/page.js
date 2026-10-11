'use client';

import { useState } from 'react';
import {
  Ban, Check, Eye, EyeOff, Flag, Gavel, RefreshCw,
  ShieldCheck, Trash2, VolumeX, X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Alert, Avatar, Badge, EmptyState, Segmen, Skeleton } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import EnvKurang from '@/components/EnvKurang';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { ambilJson, useQuery } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { classNames, maskNis, waktuRelatif } from '@/lib/utils';

const FILTER = [
  { id: 'open', label: 'Perlu ditinjau' },
  { id: 'reviewed', label: 'Ditinjau' },
  { id: 'resolved', label: 'Selesai' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'semua', label: 'Semua' },
];

/**
 * /admin/moderasi - tinjau laporan konten + beri sanksi.
 * Identitas penulis anonim DITAMPAKKAN di sini (memang tugas moderator),
 * lengkap dengan NIS supaya bisa ditindak.
 */
export default function AdminModerasi() {
  const profile = useStore((s) => s.profile);
  const isAdmin = ['pembina', 'admin', 'super_admin'].includes(profile?.role);
  const [filter, setFilter] = useState('open');
  const { data, loading, error, refresh } = useQuery(
    () => ambilJson(`/api/admin/reports?status=${filter}`),
    { deps: [filter, profile?.id] },
  );

  const [detail, setDetail] = useState(null);
  const [sanksi, setSanksi] = useState(null);
  const [sibuk, setSibuk] = useState(false);

  const reports = data?.reports || [];
  const targets = data?.targets || {};

  async function ubahStatus(report, status) {
    setSibuk(true);
    const res = await apiPatch('/api/admin/moderation', {
      action: 'report_status',
      report_id: report.id,
      status,
    });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message || 'Status diperbarui.');
    setDetail(null);
    refresh();
  }

  async function aksiKonten(aksi, report) {
    setSibuk(true);
    const res = await apiPatch('/api/admin/moderation', {
      action: aksi,
      target_type: report.target_type,
      target_id: report.target_id,
      reason: report.reason,
    });
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message || 'Tindakan diterapkan.');
    await ubahStatus(report, 'resolved');
  }

  return (
    <div className="space-y-4">
      <EnvKurang error={error} loading={loading} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Moderasi</h1>
          <p className="mt-0.5 text-xs text-ink-muted">
            Laporan dari siswa, tindakan konten, dan sanksi akun. Semua tercatat di audit log.
          </p>
        </div>
        <Button varian="sekunder" ukuran="sm" onClick={refresh} loading={loading}>
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </Button>
      </div>

      {error ? <Alert jenis="bahaya" judul="Gagal memuat">{error}</Alert> : null}

      <Segmen opsi={FILTER} nilai={filter} onChange={setFilter} className="w-full" />

      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <b>Mode audit:</b> di halaman ini identitas penulis post/komentar anonim ditampilkan
          (termasuk NIS) supaya penyalahgunaan bisa ditindak. Gunakan hanya untuk moderasi, jangan
          disebarkan ke siswa lain.
        </span>
      </div>

      {loading && !data ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}

      {!loading && !reports.length ? (
        <EmptyState
          icon={ShieldCheck}
          judul={filter === 'open' ? 'Tidak ada laporan menunggu' : 'Kosong'}
          pesan={filter === 'open' ? 'Semua laporan sudah ditangani. Kerja bagus!' : 'Tidak ada data pada filter ini.'}
        />
      ) : null}

      <div className="space-y-2.5">
        {reports.map((r) => {
          const target = targets[r.target_id] || null;
          return (
            <article key={r.id} className="kartu overflow-hidden">
              <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                <span className={classNames(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  r.status === 'open' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10' : 'bg-surface-sunken text-ink-muted',
                )}>
                  <Flag className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{r.reason}</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-muted">
                    Dilaporkan {waktuRelatif(r.created_at)} oleh {r.reporter?.username || 'akun terhapus'}
                    {r.handler ? ` · ditangani ${r.handler.username}` : ''}
                  </p>
                </div>
                <Badge warna={r.status === 'open' ? 'bahaya' : r.status === 'resolved' ? 'sukses' : 'netral'}>
                  {r.status}
                </Badge>
              </div>

              {/* pratinjau target */}
              <div className="bg-surface-sunken/60 px-4 py-3">
                {!target ? (
                  <p className="text-xs italic text-ink-faint">Konten sudah dihapus dari database.</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Avatar nama={target.nama_lengkap || target.username || 'A'} src={target.avatar_url} ukuran={26} anonim={Boolean(target.is_anonymous)} />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold">
                        {target.is_anonymous ? 'Anonim (terlihat untuk moderator)' : target.nama_lengkap || target.username}
                      </span>
                      <Badge ukuran="xs">{r.target_type}</Badge>
                    </div>
                    {target.title ? <p className="mt-1.5 text-[13px] font-bold">{target.title}</p> : null}
                    <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-muted potong-4">
                      {target.content || target.bio || target.judul || '-'}
                    </p>
                    {target.author_id ? (
                      <p className="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        Penulis asli: id {target.author_id.slice(0, 8)}…
                        {target.status ? ` · status ${target.status}` : ''}
                      </p>
                    ) : null}
                  </>
                )}
                {r.detail ? (
                  <p className="mt-2 rounded-lg border border-line bg-surface-raised p-2 text-[11.5px] text-ink-muted">
                    <b>Keterangan pelapor:</b> {r.detail}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
                {r.target_type === 'post' ? (
                  <>
                    <Button varian="sekunder" ukuran="sm" onClick={() => aksiKonten(target?.status === 'hidden' ? 'unhide' : 'hide', r)} disabled={sibuk}>
                      {target?.status === 'hidden' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {target?.status === 'hidden' ? 'Tampilkan lagi' : 'Sembunyikan'}
                    </Button>
                    <Button varian="bahayaLembut" ukuran="sm" onClick={() => aksiKonten('delete_post', r)} disabled={sibuk}>
                      <Trash2 className="h-3.5 w-3.5" /> Hapus post
                    </Button>
                  </>
                ) : null}
                {r.target_type === 'comment' ? (
                  <Button varian="bahayaLembut" ukuran="sm" onClick={() => aksiKonten('delete_comment', r)} disabled={sibuk}>
                    <Trash2 className="h-3.5 w-3.5" /> Hapus komentar
                  </Button>
                ) : null}
                {r.target_type === 'chat' ? (
                  <Button varian="bahayaLembut" ukuran="sm" onClick={() => aksiKonten('delete_chat', r)} disabled={sibuk}>
                    <VolumeX className="h-3.5 w-3.5" /> Tarik pesan
                  </Button>
                ) : null}

                {target?.author_id ? (
                  <Button varian="sekunder" ukuran="sm" onClick={() => setSanksi({ report: r, target })} disabled={!isAdmin && r.target_type !== 'post'}>
                    <Gavel className="h-3.5 w-3.5" /> Sanksi penulis
                  </Button>
                ) : null}

                <Button varian="sekunder" ukuran="sm" onClick={() => ubahStatus(r, 'reviewed')} disabled={sibuk}>
                  <Check className="h-3.5 w-3.5" /> Tandai ditinjau
                </Button>
                <Button varian="ghost" ukuran="sm" onClick={() => ubahStatus(r, 'rejected')} disabled={sibuk}>
                  <X className="h-3.5 w-3.5" /> Tolak
                </Button>
                <Button varian="ghost" ukuran="sm" onClick={() => setDetail({ report: r, target })}>
                  Detail
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* ---------- modal detail ---------- */}
      <Modal
        terbuka={Boolean(detail)}
        onClose={() => setDetail(null)}
        judul="Detail laporan"
        ukuran="lg"
        footer={
          detail ? (
            <div className="flex flex-wrap gap-2">
              <Button varian="sekunder" className="flex-1" onClick={() => ubahStatus(detail.report, 'reviewed')}>
                Ditinjau
              </Button>
              <Button className="flex-1" onClick={() => ubahStatus(detail.report, 'resolved')}>
                Selesai
              </Button>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="space-y-3 text-sm">
            <InfoBaris label="Alasan" nilai={detail.report.reason} />
            <InfoBaris label="Keterangan pelapor" nilai={detail.report.detail || '-'} />
            <InfoBaris label="Pelapor" nilai={detail.report.reporter ? `@${detail.report.reporter.username} (${detail.report.reporter.nama_lengkap || '-'}) · NIS ${maskNis(detail.report.reporter.nis || '-')}` : '-'} />
            <InfoBaris label="Waktu" nilai={waktuRelatif(detail.report.created_at)} />
            <InfoBaris label="Tipe target" nilai={detail.report.target_type} />
            <InfoBaris label="ID target" nilai={<code className="break-all text-[11px]">{detail.report.target_id}</code>} />
            {detail.target ? (
              <div className="rounded-xl border border-line bg-surface-sunken p-3">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Isi konten</p>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                  {detail.target.content || detail.target.bio || detail.target.judul || '-'}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* ---------- modal sanksi ---------- */}
      <ModalSanksi
        data={sanksi}
        isAdmin={isAdmin}
        onClose={() => setSanksi(null)}
        onDone={() => {
          setSanksi(null);
          refresh();
        }}
      />
    </div>
  );
}

function InfoBaris({ label, nilai }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed">{nilai}</p>
    </div>
  );
}

function ModalSanksi({ data, isAdmin, onClose, onDone }) {
  const [aksi, setAksi] = useState('warn');
  const [durasi, setDurasi] = useState(24);
  const [alasan, setAlasan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const butuhAdmin = ['suspend', 'ban', 'unban'].includes(aksi);

  async function submit() {
    if (!data?.target?.author_id) return;
    if (alasan.trim().length < 3) return toast.warning('Tulis alasan sanksi (minimal 3 karakter).');
    setSibuk(true);
    const body = {
      user_id: data.target.author_id,
      action: aksi,
      reason: alasan.trim(),
    };
    if (aksi === 'mute') body.hours = Number(durasi);
    if (aksi === 'suspend') body.days = Math.max(1, Math.round(Number(durasi) / 24));

    const res = await apiPost('/api/admin/sanction', body);
    setSibuk(false);
    if (!res.ok) return toast.error(res.message);
    toast.sukses(res.data?.message);
    setAlasan('');
    onDone();
  }

  const opsiAksi = [
    { id: 'warn', label: 'Peringatan (warn)', ket: 'Hanya tercatat di riwayat moderasi' },
    { id: 'mute', label: 'Bisukan (mute)', ket: 'Tidak bisa post/chat/komentar sementara' },
    ...(isAdmin
      ? [
          { id: 'suspend', label: 'Suspend', ket: 'Tidak bisa login sementara (default 7 hari)' },
          { id: 'ban', label: 'Ban permanen', ket: 'Untuk fitnah/bullying terbukti' },
          { id: 'unban', label: 'Cabut blokir', ket: 'Pulihkan akses akun' },
        ]
      : []),
  ];

  return (
    <Modal
      terbuka={Boolean(data)}
      onClose={onClose}
      judul="Beri sanksi"
      deskripsi={data ? `Target: penulis konten (id ${data.target.author_id?.slice(0, 8)}…)` : ''}
      footer={
        <div className="flex gap-2">
          <Button varian="sekunder" className="flex-1" onClick={onClose}>Batal</Button>
          <Button varian={aksi === 'ban' ? 'bahaya' : 'primer'} className="flex-1" onClick={submit} loading={sibuk}>
            <Gavel className="h-4 w-4" /> Terapkan
          </Button>
        </div>
      }
    >
      {!isAdmin ? (
        <Alert jenis="warning" className="mb-3">
          Kamu anggota OSIS: hanya bisa memberi <b>peringatan</b> dan <b>bisukan</b>. Suspend/ban
          butuh admin atau pembina.
        </Alert>
      ) : null}

      <div className="space-y-2">
        {opsiAksi.map((o) => (
          <label
            key={o.id}
            className={classNames(
              'flex min-h-touch cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition',
              aksi === o.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                : 'border-line bg-surface-raised',
            )}
          >
            <input
              type="radio"
              name="sanksi"
              value={o.id}
              checked={aksi === o.id}
              onChange={() => setAksi(o.id)}
              className="mt-1 h-4 w-4 accent-primary-600"
            />
            <span>
              <span className="block text-[13px] font-bold">{o.label}</span>
              <span className="block text-[11.5px] text-ink-muted">{o.ket}</span>
            </span>
          </label>
        ))}
      </div>

      {aksi === 'mute' || aksi === 'suspend' ? (
        <div className="mt-3">
          <Select
            label={aksi === 'mute' ? 'Durasi bisukan' : 'Durasi suspend'}
            value={durasi}
            onChange={(e) => setDurasi(e.target.value)}
          >
            {aksi === 'mute' ? (
              <>
                <option value={6}>6 jam</option>
                <option value={24}>24 jam</option>
                <option value={72}>3 hari</option>
                <option value={168}>7 hari</option>
              </>
            ) : (
              <>
                <option value={24}>1 hari</option>
                <option value={72}>3 hari</option>
                <option value={168}>7 hari</option>
                <option value={720}>30 hari</option>
              </>
            )}
          </Select>
        </div>
      ) : null}

      <div className="mt-3">
        <Textarea
          label="Alasan (wajib, tampil di audit log)"
          value={alasan}
          onChange={(e) => setAlasan(e.target.value.slice(0, 300))}
          rows={3}
          placeholder="Contoh: menggunakan kata kasar berulang di chat Townhall setelah 2 kali peringatan."
          hitung={false}
        />
      </div>

      <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-ink-muted">
        <Ban className="mt-0.5 h-4 w-4 shrink-0" />
        Tangga sanksi yang disarankan: kata kasar → sensor otomatis; report valid → warn; 3× warn →
        mute 24 jam; spam → suspend 7 hari; fitnah/bullying terbukti → ban permanen.
      </p>
    </Modal>
  );
}
