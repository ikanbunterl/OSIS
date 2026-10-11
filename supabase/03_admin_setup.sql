-- ==========================================================================
--  03_admin_setup.sql  -  AKUN ADMIN PERTAMA + UTILITAS OPSIONAL
--  Dijalankan SETELAH 01_schema.sql dan 02_seed.sql
-- ==========================================================================

-- --------------------------------------------------------------------------
-- CARA 1 (DISARANKAN): buat akun admin dari aplikasi
-- --------------------------------------------------------------------------
-- 1. Daftarkan 1 akun siswa biasa lewat halaman /register (pakai NIS asli/dummy).
-- 2. Ambil UUID user-nya:
--       select id, email, raw_user_meta_data->>'username' as username
--       from auth.users order by created_at desc limit 5;
-- 3. Naikkan jadi super_admin (role disinkron otomatis ke profiles oleh trigger):
--       select public.set_user_role('<UUID_USER>', 'super_admin');
-- 4. Logout -> login ulang. Menu /admin akan muncul.
--
-- Catatan: auth.admin.updateUserById() dari API route /api/admin/roles juga
-- melakukan hal yang sama, jadi langkah 3 bisa dilakukan dari dashboard admin
-- (menu Verifikasi & Akun) tanpa buka SQL Editor.

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_role not in ('siswa','osis','admin','pembina','super_admin') then
    raise exception 'role tidak dikenal: %', p_role;
  end if;

  -- update auth.users -> trigger tg_sync_role_from_auth menyalin ke profiles
  update auth.users
     set raw_app_meta_data = jsonb_set(
           coalesce(raw_app_meta_data, '{}'::jsonb),
           '{role}',
           to_jsonb(p_role::text)
         )
   where id = p_user_id;

  -- jaga-jaga kalau trigger belum terpasang
  update public.profiles
     set role = p_role,
         verified_at = coalesce(verified_at, now())
   where id = p_user_id;

  insert into public.audit_logs (actor_id, action, target, metadata)
  values (auth.uid(), 'sql.set_user_role', p_user_id::text,
          jsonb_build_object('role', p_role));
end $$;

revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated, service_role;

-- trigger: auth.users.raw_app_meta_data.role  ->  profiles.role
create or replace function public.tg_sync_role_from_auth()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_app_meta_data->>'role', 'siswa');
  if v_role not in ('siswa','osis','admin','pembina','super_admin') then
    v_role := 'siswa';
  end if;

  update public.profiles
     set role = v_role,
         verified_at = coalesce(verified_at, now())
   where id = new.id
     and role is distinct from v_role;
  return new;
end $$;

drop trigger if exists tg_sync_role_from_auth on auth.users;
create trigger tg_sync_role_from_auth
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function public.tg_sync_role_from_auth();

-- --------------------------------------------------------------------------
-- CARA 2 (DARURAT, kalau belum ada satu pun akun):
-- buat user admin langsung lewat Supabase Dashboard
-- --------------------------------------------------------------------------
-- Dashboard -> Authentication -> Users -> "Add user" -> Invite user
--   Email    : pembina@smktridharma2bogor.sch.id   (email asli, biar bisa reset password)
--   Password : isi manual / dari email undangan
-- Lalu jalankan:
--   select public.create_profile_for_new_user(
--     (select id from auth.users where email = 'pembina@smktridharma2bogor.sch.id'),
--     'pembina.official',
--     'Pembina OSIS',
--     'admin'
--   );
--   update public.profiles set verified_at = now() where username = 'pembina.official';
--
-- Catatan: email non-@siswa.local TIDAK bisa dipakai login lewat form NIS,
-- tapi bisa lewat Supabase Dashboard / atau pakai API login dengan email.

-- ==========================================================================
-- UTILITAS TAMBAHAN (opsional, aman dijalankan)
-- ==========================================================================

-- Bersihkan chat lama otomatis (> 30 hari). Jadwalkan lewat Supabase Cron /
-- Edge Function, atau panggil manual:  select public.cleanup_old_chat(30);
create or replace function public.cleanup_old_chat(p_days int default 30)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  delete from public.chat_messages
   where created_at < now() - (p_days || ' days')::interval
     and deleted_at is not null;
  get diagnostics v_count = row_count;

  insert into public.audit_logs (action, target, metadata)
  values ('cron.cleanup_old_chat', null, jsonb_build_object('terhapus', v_count, 'hari', p_days));

  return v_count;
end $$;

-- Rekap statistik untuk dashboard admin
create or replace function public.admin_stats()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'siswa_total',      (select count(*) from public.students where active),
    'siswa_dummy',      (select count(*) from public.students where nis ~ '^(2425|2627)[0-9]{4}$'),
    'akun_total',       (select count(*) from public.profiles),
    'akun_terverifikasi',(select count(*) from public.profiles where verified_at is not null),
    'akun_osis',        (select count(*) from public.profiles where role = 'osis'),
    'akun_dibanned',    (select count(*) from public.profiles where banned_until is not null and banned_until > now()),
    'post_total',       (select count(*) from public.posts where status <> 'deleted'),
    'post_menunggu',    (select count(*) from public.posts where status = 'pending'),
    'tiket_baru',       (select count(*) from public.tickets where status = 'baru'),
    'tiket_diproses',   (select count(*) from public.tickets where status = 'diproses'),
    'tiket_selesai',    (select count(*) from public.tickets where status = 'selesai'),
    'laporan_open',     (select count(*) from public.reports where status = 'open'),
    'chat_24jam',       (select count(*) from public.chat_messages where created_at > now() - interval '24 hours')
  )
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated, service_role;

-- ==========================================================================
-- CHECKLIST SETELAH SEMUA SQL DIJALANKAN
-- ==========================================================================
-- [ ] select * from public.academic_years;   -> 2425 & 2627 active = true
-- [ ] select count(*) from public.students;  -> 40
-- [ ] select slug, can_post, force_anon from public.channels;  -> 3 baris
-- [ ] select count(*) from pg_policies where schemaname = 'public'; -> >= 40
-- [ ] Dashboard -> Storage -> bucket 'media' (public) & 'attachments' (private) ada
-- [ ] Dashboard -> Authentication -> Providers -> Email: ENABLED,
--     "Confirm email" = OFF (kita pakai NIS@siswa.local, tidak ada inbox)
-- [ ] Dashboard -> Authentication -> URL Configuration -> Site URL = domain Vercel
-- ==========================================================================
