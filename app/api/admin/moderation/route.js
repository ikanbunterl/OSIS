/**
 * /api/admin/moderation  (staff)
 * PATCH { action, target_type, target_id, reason? }
 *   action: 'hide' | 'unhide' | 'delete_post' | 'delete_comment' | 'delete_chat' | 'restore'
 * PATCH { action:'report_status', report_id, status }   -> update status laporan
 */
import 'server-only';
import { catatAudit, wajibStaff, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schemaAksi = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['hide', 'unhide', 'delete_post', 'restore']),
    target_type: z.literal('post'),
    target_id: z.string().uuid(),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.enum(['delete_comment']),
    target_type: z.literal('comment'),
    target_id: z.string().uuid(),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.enum(['delete_chat', 'restore_chat']),
    target_type: z.literal('chat'),
    target_id: z.string().uuid(),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal('report_status'),
    report_id: z.string().uuid(),
    status: z.enum(['open', 'reviewed', 'resolved', 'rejected']),
    reason: z.string().trim().max(300).optional(),
  }),
]);

export async function PATCH(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibStaff(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const parsed = schemaAksi.safeParse(await bacaJson(req));
  if (!parsed.success) {
    return gagal(parsed.error?.issues?.[0]?.message || 'Aksi tidak dikenali', 422);
  }
  const body = parsed.data;
  const db = serviceClient();

  if (body.action === 'report_status') {
    const { data, error } = await db
      .from('reports')
      .update({
        status: body.status,
        handled_by: ctx.profil.id,
        handled_at: new Date().toISOString(),
      })
      .eq('id', body.report_id)
      .select('id, status')
      .maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Laporan tidak ditemukan.', 404);
    await catatAudit(ctx.profil.id, 'report.status', data.id, { status: data.status });
    return ok({ message: 'Status laporan diperbarui.', report: data });
  }

  if (body.target_type === 'post') {
    const status = body.action === 'hide' ? 'hidden'
      : body.action === 'unhide' || body.action === 'restore' ? 'published'
      : 'deleted';
    const { data, error } = await db
      .from('posts')
      .update({ status })
      .eq('id', body.target_id)
      .select('id, status, author_id, is_anonymous')
      .maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Post tidak ditemukan.', 404);
    await catatAudit(ctx.profil.id, `moderation.post_${body.action}`, data.id, {
      status: data.status,
      anonim: data.is_anonymous,
      reason: body.reason || null,
    });
    return ok({ message: `Post ditandai "${status}".`, post: data });
  }

  if (body.target_type === 'comment') {
    const { data, error } = await db
      .from('comments')
      .delete()
      .eq('id', body.target_id)
      .select('id, author_id, post_id')
      .maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Komentar tidak ditemukan.', 404);
    await catatAudit(ctx.profil.id, 'moderation.comment_delete', data.id, {
      post: data.post_id,
      reason: body.reason || null,
    });
    return ok({ message: 'Komentar dihapus.' });
  }

  if (body.target_type === 'chat') {
    const patch = body.action === 'delete_chat'
      ? { deleted_at: new Date().toISOString(), deleted_by: ctx.profil.id }
      : { deleted_at: null, deleted_by: null };
    const { data, error } = await db
      .from('chat_messages')
      .update(patch)
      .eq('id', body.target_id)
      .select('id, author_id, room_id')
      .maybeSingle();
    if (error) return gagal(error.message, 500);
    if (!data) return gagal('Pesan tidak ditemukan.', 404);
    await catatAudit(ctx.profil.id, `moderation.chat_${body.action}`, data.id, {
      reason: body.reason || null,
    });
    return ok({ message: body.action === 'delete_chat' ? 'Pesan ditarik.' : 'Pesan dipulihkan.' });
  }

  return gagal('Aksi tidak dikenali.', 400);
}
