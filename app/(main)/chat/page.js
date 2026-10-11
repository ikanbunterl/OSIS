'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Info, Send, ShieldAlert, Users } from 'lucide-react';
import Header from '@/components/Header';
import { ChatBubble, PemisahTanggal } from '@/components/ChatBubble';
import Button from '@/components/ui/Button';
import { Alert, EmptyState, Skeleton, Spinner } from '@/components/ui/index';
import { toast } from '@/components/ui/Toast';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { useStore } from '@/lib/store';
import { censor } from '@/lib/censor';
import { buatPembatas } from '@/lib/useQuery';
import { LIMITS, RATE_LIMITS } from '@/lib/constants';
import { classNames, labelHariChat, uid } from '@/lib/utils';

const batasChat = buatPembatas(RATE_LIMITS.chatPerMenit, 60 * 1000);

/**
 * /chat - ruang obrolan global (PLAN Bagian 7).
 * - Supabase Realtime untuk pesan masuk
 * - optimistic UI saat mengirim
 * - identitas TERLIHAT (chat bukan channel anonim)
 * - rate limit client 10 pesan/menit (server-side tetap ada di RLS/trigger)
 */
export default function ChatPage() {
  const sb = useMemo(() => getSupabaseBrowser(), []);
  const profile = useStore((s) => s.profile);
  const setBadge = useStore((s) => s.setBadge);

  const [rooms, setRooms] = useState([]);
  const [roomAktif, setRoomAktif] = useState(null);
  const [pesan, setPesan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [kirim, setKirim] = useState(false);
  const [tombolTurun, setTombolTurun] = useState(false);

  const ujungRef = useRef(null);
  const daftarRef = useRef(null);
  const inputRef = useRef(null);

  /* ---------- muat daftar room ---------- */
  useEffect(() => {
    (async () => {
      const { data, error } = await sb.from('chat_rooms').select('*').eq('is_active', true).order('created_at');
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      setRooms(data || []);
      setRoomAktif((r) => r || data?.[0] || null);
      if (!data?.length) setLoading(false);
    })();
  }, [sb]);

  /* ---------- muat pesan + langganan realtime ---------- */
  useEffect(() => {
    if (!roomAktif?.id) return undefined;
    let channel;
    let batal = false;

    (async () => {
      setLoading(true);
      const { data, error } = await sb
        .from('chat_messages')
        .select(`id, room_id, author_id, content, deleted_at, created_at,
                 author:profiles!chat_messages_author_id_fkey(id, username, nama_lengkap, avatar_url, role)`)
        .eq('room_id', roomAktif.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (batal) return;
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      setPesan((data || []).reverse());
      setLoading(false);
      setTimeout(() => ujungRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
      tandaiSudahDibaca();
    })();

    channel = sb
      .channel(`chat-${roomAktif.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomAktif.id}` },
        async (payload) => {
          const baris = payload.new;
          if (baris.author_id === profile?.id) return; // sudah ditambahkan optimis
          const { data: author } = await sb
            .from('profiles')
            .select('id, username, nama_lengkap, avatar_url, role')
            .eq('id', baris.author_id)
            .maybeSingle();
          setPesan((arr) => {
            if (arr.some((m) => m.id === baris.id)) return arr;
            return [...arr, { ...baris, author }].slice(-200);
          });
          setTimeout(() => {
            const node = daftarRef.current;
            if (node && node.scrollHeight - node.scrollTop - node.clientHeight < 220) {
              ujungRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else {
              setTombolTurun(true);
            }
          }, 40);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomAktif.id}` },
        (payload) => {
          setPesan((arr) => arr.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomAktif.id}` },
        (payload) => setPesan((arr) => arr.filter((m) => m.id !== payload.old?.id)),
      )
      .subscribe();

    return () => {
      batal = true;
      if (channel) sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomAktif?.id, profile?.id]);

  /* ---------- deteksi posisi scroll untuk tombol "ke bawah" ---------- */
  useEffect(() => {
    const node = daftarRef.current;
    if (!node) return undefined;
    const onScroll = () => {
      setTombolTurun(node.scrollHeight - node.scrollTop - node.clientHeight > 300);
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [loading]);

  const tandaiSudahDibaca = useCallback(() => {
    try {
      localStorage.setItem('osis-chat-terbaca', String(Date.now()));
    } catch { /* ignore */ }
    setBadge({ chat: 0 });
  }, [setBadge]);

  function tandaiSaatDibaca(e) {
    const node = e.currentTarget;
    if (node.scrollHeight - node.scrollTop - node.clientHeight < 120) tandaiSudahDibaca();
  }

  async function kirimPesan(e) {
    e?.preventDefault();
    const teks = draft.trim();
    if (!teks) return;
    if (!profile) return toast.error('Kamu harus login dulu.');
    if (!roomAktif) return toast.error('Pilih ruang obrolan dulu.');

    const cek = batasChat();
    if (!cek.ok) {
      return toast.warning(`Terlalu cepat. Tunggu ${cek.tunggu} detik lagi (maks ${RATE_LIMITS.chatPerMenit} pesan/menit).`);
    }

    const bersih = censor(teks).slice(0, LIMITS.chatKarakter);
    const idSementara = uid('tmp');
    const optimis = {
      id: idSementara,
      room_id: roomAktif.id,
      author_id: profile.id,
      content: bersih,
      created_at: new Date().toISOString(),
      author: { id: profile.id, username: profile.username, nama_lengkap: profile.nama_lengkap, avatar_url: profile.avatar_url, role: profile.role },
      _optimis: true,
    };

    setPesan((arr) => [...arr, optimis]);
    setDraft('');
    setKirim(true);
    setTimeout(() => ujungRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);

    const { data, error } = await sb
      .from('chat_messages')
      .insert({ room_id: roomAktif.id, author_id: profile.id, content: bersih })
      .select('id')
      .single();

    setKirim(false);
    if (error) {
      setPesan((arr) => arr.map((m) => (m.id === idSementara ? { ...m, _optimis: false, _gagal: true } : m)));
      const msg = error.message || '';
      toast.error(
        msg.includes('AKUN_DIMUTE')
          ? 'Kamu sedang dibisukan sementara oleh moderator.'
          : msg.includes('AKUN_DIBANNED')
            ? 'Akunmu diblokir.'
            : msg.includes('row-level security')
              ? 'Gagal mengirim: akunmu belum terverifikasi atau tidak punya izin.'
              : `Gagal mengirim: ${msg}`,
      );
      return;
    }
    setPesan((arr) => arr.map((m) => (m.id === idSementara ? { ...m, id: data.id, _optimis: false } : m)));
  }

  async function hapusPesan(p) {
    const { error } = await sb.from('chat_messages').delete().eq('id', p.id);
    if (error) {
      // fallback: kalau RLS menolak hard delete, staff pakai soft delete lewat API
      const res = await fetch('/api/admin/moderation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await sb.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'delete_chat', target_type: 'chat', target_id: p.id }),
      });
      const d = await res.json();
      if (!res.ok) return toast.error(d.message || 'Gagal menghapus pesan.');
      setPesan((arr) => arr.map((m) => (m.id === p.id ? { ...m, deleted_at: new Date().toISOString() } : m)));
      return toast.sukses('Pesan ditarik (moderasi).');
    }
    setPesan((arr) => arr.filter((m) => m.id !== p.id));
    toast.sukses('Pesan dihapus.');
  }

  const bolehKirim = Boolean(profile?.verified_at) &&
    !(profile?.banned_until && new Date(profile.banned_until) > new Date()) &&
    !(profile?.muted_until && new Date(profile.muted_until) > new Date());

  /* ---------- kelompokkan pesan per tanggal ---------- */
  const kelompok = useMemo(() => {
    const out = [];
    let tanggalAktif = null;
    for (const p of pesan) {
      const t = labelHariChat(p.created_at);
      if (t !== tanggalAktif) {
        out.push({ jenis: 'tanggal', id: `${t}-${p.id}`, tanggal: p.created_at });
        tanggalAktif = t;
      }
      out.push({ jenis: 'pesan', id: p.id, data: p });
    }
    return out;
  }, [pesan]);

  return (
    <>
      <Header
        judul="Chat Siswa"
        subtitle={roomAktif?.description || 'Ruang obrolan warga TD2'}
        kanan={
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-ink-muted">
            <Users className="h-3.5 w-3.5" /> {pesan.length} pesan
          </span>
        }
      />

      {/* pilihan room */}
      {rooms.length > 1 ? (
        <div className="tanpa-scrollbar flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2.5">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setRoomAktif(r);
                setPesan([]);
              }}
              className={classNames(
                'min-h-touch-9 shrink-0 rounded-full px-3.5 text-xs font-bold transition',
                r.id === roomAktif?.id
                  ? 'bg-primary-600 text-white'
                  : 'border border-line bg-surface-raised text-ink-muted',
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : null}

      {!bolehKirim ? (
        <div className="px-4 pt-3">
          <Alert jenis="warning" judul={profile?.muted_until ? 'Kamu sedang dibisukan' : 'Belum bisa mengirim pesan'}>
            {profile?.muted_until && new Date(profile.muted_until) > new Date()
              ? `Bisukan berakhir ${new Date(profile.muted_until).toLocaleString('id-ID')}. Kamu masih bisa membaca.`
              : profile?.banned_until && new Date(profile.banned_until) > new Date()
                ? 'Akunmu diblokir. Hubungi pembina OSIS.'
                : 'Akunmu belum terverifikasi. Hubungi admin OSIS.'}
          </Alert>
        </div>
      ) : null}

      {/* daftar pesan */}
      <div
        ref={daftarRef}
        className="scroll-halus relative max-h-[calc(100dvh-15rem)] min-h-[16rem] flex-1 overflow-y-auto pb-2 pt-2"
        onScroll={tandaiSaatDibaca}
      >
        {loading ? (
          <div className="space-y-3 px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={classNames('flex gap-2', i % 2 ? 'justify-end' : 'justify-start')}>
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className={classNames('h-14 rounded-2xl', i % 2 ? 'w-40' : 'w-56')} />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !pesan.length ? (
          <EmptyState
            icon={Send}
            judul="Belum ada pesan"
            pesan={roomAktif ? `Jadilah yang pertama menyapa di ${roomAktif.name}.` : 'Pilih ruang obrolan.'}
          />
        ) : null}

        {!loading
          ? kelompok.map((item) =>
              item.jenis === 'tanggal' ? (
                <PemisahTanggal key={item.id} tanggal={item.tanggal} />
              ) : (
                <ChatBubble
                  key={item.id}
                  pesan={item.data}
                  sayaId={profile?.id}
                  onHapus={hapusPesan}
                />
              ),
            )
          : null}
        <div ref={ujungRef} />

        {tombolTurun ? (
          <button
            type="button"
            onClick={() => {
              ujungRef.current?.scrollIntoView({ behavior: 'smooth' });
              setTombolTurun(false);
              tandaiSudahDibaca();
            }}
            aria-label="Gulir ke pesan terbaru"
            className="sticky bottom-2 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface-raised text-ink-muted shadow-card"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* input */}
      <div
        className="border-t border-line bg-surface-raised px-3 py-2"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {bolehKirim ? (
          <form onSubmit={kirimPesan} className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, LIMITS.chatKarakter))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    kirimPesan(e);
                  }
                }}
                rows={1}
                placeholder="Tulis pesan… (Enter untuk kirim)"
                aria-label="Tulis pesan"
                className="input-dasar max-h-28 min-h-[44px] resize-none py-2.5 pr-14 text-[15px]"
                style={{ minHeight: 44 }}
                disabled={kirim}
              />
              <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-ink-faint tabular-nums">
                {draft.length}/{LIMITS.chatKarakter}
              </span>
            </div>
            <Button
              type="submit"
              ukuran="ikon"
              aria-label="Kirim pesan"
              disabled={!draft.trim() || kirim}
              className="h-11 w-11 shrink-0 rounded-xl"
            >
              {kirim ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-[18px] w-[18px]" />}
            </Button>
          </form>
        ) : (
          <p className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-ink-faint">
            <ShieldAlert className="h-4 w-4" /> Mode baca-saja
          </p>
        )}
        <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[10.5px] text-ink-faint">
          <Info className="h-3 w-3" /> Chat memakai nama asli. Maksimal {RATE_LIMITS.chatPerMenit} pesan/menit · kata kasar disensor otomatis.
        </p>
      </div>
    </>
  );
}
