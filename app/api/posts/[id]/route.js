/**
 * /api/posts/[id]  - hapus post (penulis non-anonim, atau staff)
 * DELETE
 */
import 'server-only';
import { catatAudit, konteksUser, serviceClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(req, { params }) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const { id } = await params;
  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);

  const db = serviceClient();
  const { data: post } = await db
    .from('posts')
    .select('id, author_id, is_anonymous, status, channel_id')
    .eq('id', id)
    .maybeSingle();
  if (!post) return gagal('Post tidak ditemukan.', 404);

  const pemilik = post.author_id === ctx.profil.id;
  if (!ctx.staff && !(pemilik && !post.is_anonymous)) {
    return gagal('Kamu tidak berhak menghapus post ini. Post anonim hanya bisa dihapus moderator.', 403);
  }

  // soft delete untuk staff (biar masih bisa diaudit), hard delete untuk pemilik
  const hard = pemilik && !ctx.staff;
  const { error } = hard
    ? await db.from('posts').delete().eq('id', id)
    : await db.from('posts').update({ status: 'deleted' }).eq('id', id);
  if (error) return gagal(error.message, 500);

  await catatAudit(ctx.profil.id, hard ? 'post.delete_own' : 'post.delete_staff', id, {
    anonim: post.is_anonymous,
    channel: post.channel_id,
  });

  return ok({ message: hard ? 'Post dihapus.' : 'Post ditandai terhapus (masih bisa dipulihkan oleh admin).' });
}
