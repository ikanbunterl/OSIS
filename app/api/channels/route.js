/**
 * /api/channels - daftar channel aktif (dipakai feed & composer)
 * GET publik (RLS: hanya channel aktif yang terlihat oleh non-staff)
 */
import 'server-only';
import { serverClient } from '@/lib/supabase/server';
import { gagal, ok } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const { data, error } = await serverClient()
    .from('channels')
    .select('id, slug, name, description, type, can_post, force_anon')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) return gagal(error.message, 500);
  return ok({ channels: data || [] });
}
