/**
 * /api/comments/[id] - hapus komentar
 * DELETE: penulis sendiri (komentar non-anonim) atau staff
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
  const { data: komentar } = await db
    .from('comments')
    .select('id, author_id, is_anonymous, post_id')
    .eq('id', id)
    .maybeSingle();
  if (!komentar) return gagal('Komentar tidak ditemukan.', 404);

  const pemilik = komentar.author_id === ctx.profil.id;
  if (!ctx.staff && !(pemilik && !komentar.is_anonymous)) {
    return gagal('Komentar anonim hanya bisa dihapus oleh moderator.', 403);
  }

  const { error } = await db.from('comments').delete().eq('id', id);
  if (error) return gagal(error.message, 500);

  await catatAudit(ctx.profil.id, pemilik ? 'comment.delete_own' : 'comment.delete_staff', id, {
    post: komentar.post_id,
    anonim: komentar.is_anonymous,
  });

  return ok({ message: 'Komentar dihapus.' });
}
