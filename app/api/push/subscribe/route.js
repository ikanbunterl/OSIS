/**
 * /api/push/subscribe
 * POST   { subscription } -> simpan langganan push milik user
 * DELETE { endpoint }     -> hapus langganan (matikan notifikasi)
 * GET                   -> status: VAPID siap? sudah berlangganan?
 */
import 'server-only';
import { hapusSubscription, hapusSubscriptionUser, pushSiap, simpanSubscription } from '@/lib/push';
import { konteksUser, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { pushSubscriptionSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const ctx = await konteksUser(req);
  if (!ctx.ok) return ok({ siap: pushSiap(), vapidKey: vapid, berlangganan: false, jumlah: 0 });

  const { count } = await serviceClient()
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ctx.profil.id);

  return ok({ siap: pushSiap(), vapidKey: vapid, berlangganan: (count || 0) > 0, jumlah: count || 0 });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);
  if (!pushSiap()) {
    return gagal('Notifikasi push belum dikonfigurasi di server (VAPID kosong).', 501);
  }

  const body = await bacaJson(req);
  const parsed = pushSubscriptionSchema.safeParse(body.subscription || body);
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Subscription tidak valid', 422);

  const { error } = await simpanSubscription(
    ctx.profil.id,
    parsed.data,
    req.headers.get('user-agent') || '',
  );
  if (error) return gagal(error.message, 500);

  return ok({ message: 'Notifikasi diaktifkan untuk perangkat ini.' });
}

export async function DELETE(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 401);

  const body = await bacaJson(req);
  const endpoint = body?.endpoint;

  const { error } = endpoint
    ? await hapusSubscription(endpoint)
    : await hapusSubscriptionUser(ctx.profil.id);
  if (error) return gagal(error.message, 500);

  return ok({ message: 'Notifikasi dimatikan untuk perangkat ini.' });
}
