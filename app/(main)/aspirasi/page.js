'use client';

import { useEffect, useState } from 'react';
import { EyeOff, Lock, MessageSquareQuote, Plus, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Header from '@/components/Header';
import PostCard from '@/components/PostCard';
import { EmptyState, Fab, SkeletonKartu } from '@/components/ui/index';
import { ambilJson } from '@/lib/useQuery';
import { useStore } from '@/lib/store';
import { CHANNEL } from '@/lib/constants';
import { classNames } from '@/lib/utils';

/**
 * /aspirasi - daftar aspirasi anonim + penjelasan sistem anonim (PLAN Bagian 6).
 */
function AspirasiInner({ awal }) {
  const [data, setData] = useState(awal);
  const [loading, setLoading] = useState(!awal);
  const [cari, setCari] = useState('');
  const [bacaAturan, setBacaAturan] = useState(false);
  const profile = useStore((s) => s.profile);
  const bukaComposer = useStore((s) => s.bukaComposer);
  const isStaff = ['osis', 'pembina', 'admin', 'super_admin'].includes(profile?.role);
  const [audit, setAudit] = useState(false);

  async function muat() {
    setLoading(true);
    try {
      const res = await ambilJson(`/api/feed?slug=${CHANNEL.ASPIRASI}&limit=40`);
      setData(res);
    } catch (e) {
      setData({ posts: [], channel: null, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!awal) muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const posts = (data?.posts || []).filter((p) => {
    if (!cari.trim()) return true;
    const q = cari.toLowerCase();
    return (p.title || '').toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
  });

  return (
    <>
      <Header
        judul="Aspirasi"
        subtitle="Suara siswa · 100% anonim bagi siswa lain"
        kanan={
          <div className="flex items-center gap-1">
            {isStaff ? (
              <button
                type="button"
                onClick={() => setAudit((v) => !v)}
                aria-pressed={audit}
                className={classNames(
                  'flex min-h-touch-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold',
                  audit
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                    : 'border border-line text-ink-muted',
                )}
              >
                <Sparkles className="h-3.5 w-3.5" /> {audit ? 'Audit ON' : 'Audit'}
              </button>
            ) : null}
          </div>
        }
      />

      {/* hero penjelasan anonim */}
      <section className="mx-4 mt-3 overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-600 to-primary-800 p-4 text-white shadow-card dark:border-primary-500/25">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <MessageSquareQuote className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold leading-tight">Kritik & usul tanpa nama</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/85">
              Semua yang kamu tulis di sini tampil sebagai <b>Anonim</b>. Tidak ada siswa lain yang
              tahu siapa penulisnya. OSIS &amp; pembina tetap bisa menelusuri untuk mencegah
              penyalahgunaan.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Poin icon={EyeOff} teks="Nama disembunyikan" />
          <Poin icon={Users} teks="1 akun = 1 dukungan" />
          <Poin icon={ShieldCheck} teks="Dibaca OSIS" />
        </div>

        <button
          type="button"
          onClick={() => setBacaAturan((v) => !v)}
          className="mt-3 w-full rounded-xl bg-white/15 px-3 py-2 text-left text-[11.5px] font-bold text-white transition hover:bg-white/25"
          aria-expanded={bacaAturan}
        >
          {bacaAturan ? 'Sembunyikan batasan anonim ▲' : 'Apa batasannya? (penting dibaca) ▼'}
        </button>
        {bacaAturan ? (
          <ul className="mt-2 space-y-1.5 rounded-xl bg-slate-950/25 p-3 text-[11.5px] leading-relaxed text-white/90">
            <li>• <b>Fitnah &amp; bullying tidak dilindungi anonim.</b> Admin bisa membuka identitas penulis lewat database dan memberi sanksi sampai ban permanen.</li>
            <li>• Jangan menulis data pribadi orang lain (nama lengkap + aib, alamat, nomor HP).</li>
            <li>• Maksimal 1 aspirasi per 5 menit, 3 post per 10 menit.</li>
            <li>• Kata kasar disensor otomatis.</li>
            <li>• Untuk kasus darurat (kekerasan/pelecehan), pakai menu <b>Lapor</b> supaya ditangani tertutup dan diprioritaskan.</li>
          </ul>
        ) : null}
      </section>

      {/* pencarian */}
      <div className="sticky top-14 z-20 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari aspirasi…"
            aria-label="Cari aspirasi"
            className="input-dasar min-h-touch-10 pl-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3 px-4 pb-6 pt-3">
        {loading ? <SkeletonKartu jumlah={3} /> : null}
        {!loading && !posts.length ? (
          <EmptyState
            icon={MessageSquareQuote}
            judul={cari ? 'Tidak ada hasil' : 'Belum ada aspirasi'}
            pesan={cari ? `Tidak ada aspirasi yang cocok dengan "${cari}".` : 'Jadilah yang pertama menyampaikan pendapat ke OSIS.'}
            aksi={
              !cari ? (
                <button type="button" onClick={() => bukaComposer('aspirasi')} className="min-h-touch inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-bold text-white">
                  <Plus className="h-4 w-4" /> Tulis aspirasi
                </button>
              ) : null
            }
          />
        ) : null}

        {posts.map((p) => (
          <PostCard key={p.id} post={p} channelSlug={CHANNEL.ASPIRASI} auditMode={audit && isStaff} onRefresh={muat} />
        ))}
      </div>

      <Fab icon={Plus} label="Tulis aspirasi" onClick={() => bukaComposer('aspirasi')} />

      <div className="px-4 pb-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-faint">
          <Lock className="h-3 w-3" /> Identitas tersimpan di database, tersembunyi dari publik
        </p>
      </div>
    </>
  );
}

function Poin({ icon: Icon, teks }) {
  return (
    <div className="rounded-xl bg-white/10 p-2 text-center">
      <Icon className="mx-auto h-4 w-4" aria-hidden="true" />
      <p className="mt-1 text-[10px] font-semibold leading-tight text-white/90">{teks}</p>
    </div>
  );
}

export default function AspirasiPage() {
  return <AspirasiInner awal={null} />;
}
