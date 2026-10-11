/**
 * /api/admin/students  (staff)
 * GET    ?q=&angkatan=&active=   -> cari data siswa
 * POST   { nis, nama, kelas, angkatan }  -> tambah 1 siswa manual
 * PATCH  { nis, active? , nama?, kelas?, angkatan? }  -> ubah / nonaktifkan
 * DELETE ?nis=  -> hapus permanen (butuh admin)
 */
import 'server-only';
import { catatAudit, konteksUser, wajibAdmin, serviceClient } from '@/lib/supabase/server';
import { gagal, ok, bacaJson } from '@/lib/api-helpers';
import { belumDikonfigurasi, responsBelumDikonfigurasi } from '@/lib/env-check';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schemaPost = z.object({
  nis: z.string().trim().regex(/^\d{8}$/, 'NIS harus 8 digit angka'),
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  kelas: z.string().trim().max(30).optional().or(z.literal('')),
  angkatan: z.string().trim().regex(/^\d{4}$/, 'Angkatan 4 digit').optional().or(z.literal('')),
});

const schemaPatch = z.object({
  nis: z.string().trim().regex(/^\d{8}$/),
  active: z.boolean().optional(),
  nama: z.string().trim().min(2).max(80).optional(),
  kelas: z.string().trim().max(30).optional().or(z.literal('')),
  angkatan: z.string().trim().regex(/^\d{4}$/).optional(),
});

export async function GET(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim();
  const angkatan = sp.get('angkatan');
  const active = sp.get('active');
  const db = serviceClient();

  let query = db
    .from('students')
    .select('nis, nama, kelas, angkatan, active, created_at')
    .order('angkatan', { ascending: true })
    .order('nama', { ascending: true })
    .limit(200);

  if (q) query = query.or(`nis.ilike.%${q}%,nama.ilike.%${q}%,kelas.ilike.%${q}%`);
  if (angkatan && angkatan !== 'semua') query = query.eq('angkatan', angkatan);
  if (active === 'true') query = query.eq('active', true);
  if (active === 'false') query = query.eq('active', false);

  const { data, error, count } = await query;
  if (error) return gagal(error.message, 500);

  const { data: prefixes } = await db
    .from('academic_years')
    .select('prefix, tahun_ajaran, active')
    .order('prefix');

  const { count: total } = await db.from('students').select('*', { count: 'exact', head: true });
  const { count: terdaftar } = await db.from('profiles').select('*', { count: 'exact', head: true });

  return ok({ students: data || [], prefixes: prefixes || [], total: total ?? 0, akunTerdaftar: terdaftar ?? 0, ditampilkan: count ?? (data?.length || 0) });
}

export async function POST(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const parsed = schemaPost.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);

  const db = serviceClient();
  const angkatan = parsed.data.angkatan || parsed.data.nis.slice(0, 4);

  const { data: ay } = await db.from('academic_years').select('prefix, active').eq('prefix', angkatan).maybeSingle();
  if (!ay) {
    return gagal(`Prefix angkatan "${angkatan}" belum terdaftar. Tambahkan dulu di academic_years.`, 400);
  }

  const { data, error } = await db
    .from('students')
    .insert({
      nis: parsed.data.nis,
      nama: parsed.data.nama,
      kelas: parsed.data.kelas || null,
      angkatan,
      active: true,
    })
    .select('nis, nama, kelas, angkatan, active')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return gagal('NIS sudah ada di database.', 409);
    return gagal(error.message, 500);
  }

  await catatAudit(ctx.profil.id, 'student.create', data.nis, { nama: data.nama, angkatan });
  return ok({ message: `Siswa ${data.nama} (${data.nis}) ditambahkan.`, student: data }, 201);
}

export async function PATCH(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await konteksUser(req);
  if (!ctx.ok || !ctx.staff) return gagal('Khusus OSIS / admin.', 403);

  const parsed = schemaPatch.safeParse(await bacaJson(req));
  if (!parsed.success) return gagal(parsed.error?.issues?.[0]?.message || 'Data tidak valid', 422);

  const { nis, ...patch } = parsed.data;
  const bersih = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (!Object.keys(bersih).length) return gagal('Tidak ada perubahan.', 400);
  if (bersih.kelas === '') bersih.kelas = null;

  const db = serviceClient();
  const { data, error } = await db
    .from('students')
    .update(bersih)
    .eq('nis', nis)
    .select('nis, nama, kelas, angkatan, active')
    .maybeSingle();

  if (error) return gagal(error.message, 500);
  if (!data) return gagal('NIS tidak ditemukan.', 404);

  // kalau active=false, akun terkait ditolak saat login (dicek di halaman /login)
  await catatAudit(ctx.profil.id, 'student.update', data.nis, { ...bersih });

  return ok({ message: `Data ${data.nama} diperbarui.`, student: data });
}

export async function DELETE(req) {
  if (belumDikonfigurasi()) return responsBelumDikonfigurasi();

  const ctx = await wajibAdmin(req);
  if (!ctx.ok) return gagal(ctx.pesan, ctx.kode || 403);

  const nis = new URL(req.url).searchParams.get('nis');
  if (!/^\d{8}$/.test(nis || '')) return gagal('NIS tidak valid.', 422);

  const db = serviceClient();
  const { data: dipakai } = await db.from('profiles').select('id, username').eq('nis', nis).maybeSingle();
  if (dipakai) {
    return gagal(
      `NIS ini sudah dipakai akun @${dipakai.username}. Nonaktifkan saja (active=false), jangan dihapus, supaya riwayat tetap ada.`,
      409,
    );
  }

  const { error } = await db.from('students').delete().eq('nis', nis);
  if (error) return gagal(error.message, 500);

  await catatAudit(ctx.profil.id, 'student.delete', nis, {});
  return ok({ message: `Data siswa ${nis} dihapus.` });
}
