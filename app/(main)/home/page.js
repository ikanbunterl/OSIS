import { Suspense } from 'react';
import FeedClient from '@/components/FeedClient';
import { serviceClient, envServerSiap } from '@/lib/supabase/server';
import { SkeletonKartu } from '@/components/ui/index';
import { CHANNEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

/** Ambil data awal di server supaya first paint cepat & hemat kuota. */
async function dataAwal(slug) {
  if (!envServerSiap()) return null;
  try {
    const db = serviceClient();
    const { data: ch } = await db.from('channels').select('*').eq('slug', slug).maybeSingle();
    if (!ch) return null;
    const { data: posts } = await db
      .from('posts')
      .select(
        `id, channel_id, author_id, is_anonymous, title, content, media_urls, status, pinned,
         comment_count, like_count, created_at,
         author:profiles!posts_author_id_fkey(id, username, nama_lengkap, avatar_url, role, nis),
         channel:channels!posts_channel_id_fkey(id, slug, name, type)`,
      )
      .eq('channel_id', ch.id)
      .eq('status', 'published')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(25);
    return { posts: posts || [], channel: ch };
  } catch {
    return null;
  }
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const tab = TAB_VALID.includes(sp?.tab) ? sp.tab : CHANNEL.OSIS;
  const awal = await dataAwal(tab);

  return (
    <Suspense fallback={<div className="px-4 pt-4"><SkeletonKartu jumlah={3} /></div>}>
      <FeedClient slugAwal={tab} dataAwal={awal} buat={sp?.buat === '1'} />
    </Suspense>
  );
}

const TAB_VALID = [CHANNEL.OSIS, CHANNEL.ASPIRASI, CHANNEL.TALENT];
