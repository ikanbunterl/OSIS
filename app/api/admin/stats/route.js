/**
 * /api/admin/stats  (staff) - data dashboard admin
 */
import 'server-only';
import { konteksUser, serviceClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const db = serviceClient();

  const [{ data: stats, error: eStats }, tiket, laporan, audit, posting, chatHarian] =
    await Promise.all([
      db.rpc('admin_stats'),
      db.from('tickets')
        .select('id, kode_tiket, kategori, judul, status, priority, created_at, unread_admin')
        .order('created_at', { ascending: false }).limit(8),
      db.from('reports')
        .select('id, target_type, reason, status, created_at')
        .eq('status', 'open').order('created_at', { ascending: false }).limit(8),
      db.from('audit_logs')
        .select('id, action, target, metadata, created_at, actor:profiles!audit_logs_actor_id_fkey(username, role)')
        .order('created_at', { ascending: false }).limit(12),
      db.from('posts')
        .select('id, title, content, status, is_anonymous, created_at, channel:channels(slug, name)')
        .order('created_at', { ascending: false }).limit(6),
      db.from('chat_messages')
        .select('created_at')
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(2000),
    ]);

  if (eStats) return gagal(eStats.message, 500);

  // histogram chat 7 hari
  const ember = {};
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    ember[d.toISOString().slice(0, 10)] = 0;
  }
  for (const c of chatHarian || []) {
    const k = new Date(c.created_at).toISOString().slice(0, 10);
    if (k in ember) ember[k] += 1;
  }

  return ok({
    stats: stats || {},
    tiketTerbaru: tiket || [],
    laporanOpen: laporan || [],
    auditTerbaru: audit || [],
    postingTerbaru: posting || [],
    chat7Hari: Object.entries(ember).map(([tanggal, jumlah]) => ({ tanggal, jumlah })),
    isAdmin: ctx.isAdmin,
    role: ctx.profil.role,
  });
}
