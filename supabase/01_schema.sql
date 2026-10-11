-- ==========================================================================
--  OSIS SMK TRI DHARMA 2 BOGOR - SCHEMA + RLS + TRIGGER
--  Jalankan di Supabase: SQL Editor -> New query -> paste -> Run
--  Urutan: 01_schema.sql  ->  02_seed.sql  ->  03_admin_setup.sql
-- ==========================================================================

create extension if not exists pgcrypto;

-- ==========================================================================
-- 0. HELPER ROLE (dipakai RLS biar policy pendek & cepat)
-- ==========================================================================
create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$ select * from public.profiles where id = auth.uid() $$;

create or replace function public.is_verified()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select verified_at is not null
                   from public.profiles
                   where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('osis','admin','pembina','super_admin')
                   from public.profiles
                   where id = auth.uid()), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role in ('admin','super_admin')
                   from public.profiles
                   where id = auth.uid()), false)
$$;

-- ==========================================================================
-- 1. REFERENSI
-- ==========================================================================
create table if not exists public.academic_years (
  prefix       char(4) primary key,              -- '2425', '2627'
  tahun_ajaran text not null,                    -- '2024/2025'
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ==========================================================================
-- 2. DATA SISWA (diinput admin / import CSV)
-- ==========================================================================
create table if not exists public.students (
  nis        char(8) primary key,
  nama       text not null,
  kelas      text,
  angkatan   char(4) references public.academic_years(prefix) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_nis_format check (nis ~ '^[0-9]{8}$'),
  constraint students_nama_ada   check (btrim(nama) <> '')
);

create index if not exists idx_students_angkatan on public.students(angkatan);
create index if not exists idx_students_nama     on public.students(lower(btrim(nama)));

-- ==========================================================================
-- 3. AKUN & ROLE
-- ==========================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nis          char(8) unique references public.students(nis) on delete set null,
  username     text unique not null,
  nama_lengkap text,
  avatar_url   text,
  bio          text,
  role         text not null default 'siswa'
               check (role in ('siswa','osis','admin','pembina','super_admin')),
  verified_at  timestamptz,
  muted_until  timestamptz,
  banned_until timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9._]{3,20}$')
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_nis  on public.profiles(nis);

-- ==========================================================================
-- 4. CHANNEL, POST, KOMENTAR, REAKSI
-- ==========================================================================
create table if not exists public.channels (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,               -- 'osis','aspirasi','talent'
  name       text not null,
  description text,
  type       text not null check (type in ('osis','aspirasi','talent','custom')),
  -- siapa yang boleh posting: 'staff' = OSIS/admin saja, 'verified' = semua siswa terverifikasi
  can_post   text not null default 'verified' check (can_post in ('staff','verified')),
  -- paksa anonim untuk semua post di channel ini
  force_anon boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.channels(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  is_anonymous boolean not null default false,
  title        text,
  content      text not null,
  media_urls   text[] not null default '{}',
  status       text not null default 'published'
               check (status in ('published','pending','hidden','deleted')),
  pinned       boolean not null default false,
  comment_count int not null default 0,
  like_count    int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint posts_content_ada check (btrim(content) <> ''),
  constraint posts_content_max check (char_length(content) <= 5000)
);

create index if not exists idx_posts_channel  on public.posts(channel_id, created_at desc);
create index if not exists idx_posts_author   on public.posts(author_id);
create index if not exists idx_posts_status   on public.posts(status);

create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  is_anonymous boolean not null default false,
  content      text not null,
  created_at   timestamptz not null default now(),
  constraint comments_content_ada check (btrim(content) <> ''),
  constraint comments_content_max check (char_length(content) <= 1000)
);

create index if not exists idx_comments_post on public.comments(post_id, created_at);

create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'like' check (type in ('like','upvote','love','support')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, type)
);

create index if not exists idx_reactions_user on public.reactions(user_id);

-- ==========================================================================
-- 5. TIKET LAPOR (PRIVAT)
-- ==========================================================================
create table if not exists public.tickets (
  id           uuid primary key default gen_random_uuid(),
  kode_tiket   text unique,                      -- diisi trigger: 'LPR-7F3K9A'
  author_id    uuid references public.profiles(id) on delete set null,
  kategori     text not null,
  judul        text not null,
  deskripsi    text not null default '',
  kontak       text,                             -- opsional, dari pelapor
  lokasi       text,
  status       text not null default 'baru'
               check (status in ('baru','diproses','selesai','ditolak')),
  priority     text not null default 'normal'
               check (priority in ('rendah','normal','tinggi')),
  unread_admin    int not null default 0,
  unread_reporter int not null default 0,
  closed_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_judul_ada check (btrim(judul) <> '')
);

create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_author on public.tickets(author_id);
create index if not exists idx_tickets_kode   on public.tickets(kode_tiket);

create table if not exists public.ticket_messages (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  sender_id     uuid references public.profiles(id) on delete set null,
  is_admin      boolean not null default false,
  content       text not null,
  attachment    text,                            -- path di bucket privat 'attachments'
  attachment_name text,
  created_at    timestamptz not null default now(),
  constraint ticket_messages_content_ada check (btrim(content) <> '' or attachment is not null)
);

create index if not exists idx_ticket_messages_ticket on public.ticket_messages(ticket_id, created_at);

-- ==========================================================================
-- 6. CHAT GLOBAL
-- ==========================================================================
create table if not exists public.chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,               -- 'townhall','bantuan'
  name       text not null,
  description text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.chat_rooms(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  content    text not null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_ada check (btrim(content) <> ''),
  constraint chat_messages_content_max check (char_length(content) <= 500)
);

create index if not exists idx_chat_room_time on public.chat_messages(room_id, created_at desc);

-- ==========================================================================
-- 7. MODERASI
-- ==========================================================================
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post','comment','chat','profile','ticket')),
  target_id   uuid not null,
  reason      text not null,
  detail      text,
  status      text not null default 'open'
              check (status in ('open','reviewed','resolved','rejected')),
  handled_by  uuid references public.profiles(id) on delete set null,
  handled_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_reports_status on public.reports(status, created_at desc);

create table if not exists public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles(id) on delete set null,
  target_user uuid references public.profiles(id) on delete cascade,
  action      text not null check (action in ('warn','mute','suspend','ban','unban','unmute')),
  reason      text,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_moderation_target on public.moderation_actions(target_user, created_at desc);

-- ==========================================================================
-- 8. AUDIT LOG
-- ==========================================================================
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  target     text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_logs(created_at desc);

-- ==========================================================================
-- 9. PUSH SUBSCRIPTION (Web Push / VAPID)
-- ==========================================================================
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text unique not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_user on public.push_subscriptions(user_id);

-- ==========================================================================
-- 10. TRIGGER
-- ==========================================================================

-- 10.1 update updated_at otomatis
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_students_updated on public.students;
create trigger trg_students_updated before update on public.students
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_posts_updated on public.posts;
create trigger trg_posts_updated before update on public.posts
  for each row execute function public.tg_set_updated_at();

drop trigger if exists trg_tickets_updated on public.tickets;
create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.tg_set_updated_at();

-- 10.2 buat profil otomatis saat user baru daftar (dipanggil dari API register)
create or replace function public.create_profile_for_new_user(
  p_user_id uuid,
  p_username text,
  p_nama text default null,
  p_role text default 'siswa'
)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  insert into public.profiles (id, username, nama_lengkap, role, verified_at)
  values (
    p_user_id,
    lower(btrim(p_username)),
    nullif(btrim(coalesce(p_nama, '')), ''),
    p_role,
    case when p_role in ('admin','super_admin','pembina','osis') then now() else null end
  )
  on conflict (id) do update
    set username = excluded.username,
        nama_lengkap = coalesce(excluded.nama_lengkap, public.profiles.nama_lengkap)
  returning * into v_profile;
  return v_profile;
end $$;

revoke all on function public.create_profile_for_new_user(uuid, text, text, text) from public;
grant execute on function public.create_profile_for_new_user(uuid, text, text, text) to service_role;

-- 10.3 generate kode tiket LPR-XXXXXX
create or replace function public.tg_ticket_code()
returns trigger language plpgsql as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- tanpa I,O,0,1 (biar gak salah baca)
  v_code text;
  i int;
begin
  if new.kode_tiket is not null then
    return new;
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    v_code := 'LPR-' || v_code;
    exit when not exists (select 1 from public.tickets where kode_tiket = v_code);
  end loop;
  new.kode_tiket := v_code;
  return new;
end $$;

drop trigger if exists trg_ticket_code on public.tickets;
create trigger trg_ticket_code before insert on public.tickets
  for each row execute function public.tg_ticket_code();

-- 10.4 counter komentar & like di posts (biar list feed gak perlu count(*) tiap baris)
create or replace function public.tg_comment_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_comment_count on public.comments;
create trigger trg_comment_count after insert or delete on public.comments
  for each row execute function public.tg_comment_count();

create or replace function public.tg_reaction_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_reaction_count on public.reactions;
create trigger trg_reaction_count after insert or delete on public.reactions
  for each row execute function public.tg_reaction_count();

-- 10.5 penanda "belum dibaca" tiket + blokir chat saat mute/ban
create or replace function public.tg_ticket_message_meta()
returns trigger language plpgsql as $$
begin
  if new.is_admin then
    update public.tickets set unread_reporter = unread_reporter + 1, status = case when status = 'baru' then 'diproses' else status end where id = new.ticket_id;
  else
    update public.tickets set unread_admin = unread_admin + 1 where id = new.ticket_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_message_meta on public.ticket_messages;
create trigger trg_ticket_message_meta after insert on public.ticket_messages
  for each row execute function public.tg_ticket_message_meta();

create or replace function public.tg_guard_not_banned()
returns trigger language plpgsql as $$
declare
  v_banned timestamptz;
  v_muted  timestamptz;
begin
  select banned_until, muted_until into v_banned, v_muted
  from public.profiles where id = auth.uid();

  if v_banned is not null and v_banned > now() then
    raise exception 'AKUN_DIBANNED:%', v_banned using errcode = '42501';
  end if;
  if v_muted is not null and v_muted > now() then
    raise exception 'AKUN_DIMUTE:%', v_muted using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_chat_guard on public.chat_messages;
create trigger trg_chat_guard before insert on public.chat_messages
  for each row execute function public.tg_guard_not_banned();

drop trigger if exists trg_post_guard on public.posts;
create trigger trg_post_guard before insert on public.posts
  for each row execute function public.tg_guard_not_banned();

drop trigger if exists trg_comment_guard on public.comments;
create trigger trg_comment_guard before insert on public.comments
  for each row execute function public.tg_guard_not_banned();

-- 10.6 audit log otomatis untuk aksi sensitif (ban / ganti role)
create or replace function public.tg_audit_profile_change()
returns trigger language plpgsql as $$
begin
  if (old.role is distinct from new.role) then
    insert into public.audit_logs (actor_id, action, target, metadata)
    values (auth.uid(), 'profile.role_change', new.id::text,
            jsonb_build_object('dari', old.role, 'ke', new.role, 'username', new.username));
  end if;
  if (old.banned_until is distinct from new.banned_until) then
    insert into public.audit_logs (actor_id, action, target, metadata)
    values (auth.uid(), 'profile.ban_change', new.id::text,
            jsonb_build_object('dari', old.banned_until, 'ke', new.banned_until, 'username', new.username));
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_profile_change on public.profiles;
create trigger trg_audit_profile_change after update on public.profiles
  for each row execute function public.tg_audit_profile_change();

-- ==========================================================================
-- 11. ROW LEVEL SECURITY
-- ==========================================================================
alter table public.academic_years     enable row level security;
alter table public.students           enable row level security;
alter table public.profiles           enable row level security;
alter table public.channels           enable row level security;
alter table public.posts              enable row level security;
alter table public.comments           enable row level security;
alter table public.reactions          enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_messages    enable row level security;
alter table public.chat_rooms         enable row level security;
alter table public.chat_messages      enable row level security;
alter table public.reports            enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---- academic_years: publik boleh baca (dipakai validasi prefix di form register)
drop policy if exists ay_select on public.academic_years;
create policy ay_select on public.academic_years for select using (true);
drop policy if exists ay_write_staff on public.academic_years;
create policy ay_write_staff on public.academic_years for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- students: hanya staff (jangan pernah bocor ke publik!)
drop policy if exists students_staff_all on public.students;
create policy students_staff_all on public.students for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- field sensitif tidak boleh diubah sendiri lewat client
    and role = (select role from public.profiles where id = auth.uid())
    and verified_at is not distinct from (select verified_at from public.profiles where id = auth.uid())
    and banned_until is not distinct from (select banned_until from public.profiles where id = auth.uid())
    and muted_until is not distinct from (select muted_until from public.profiles where id = auth.uid())
    and nis is not distinct from (select nis from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_staff_update on public.profiles;
create policy profiles_staff_update on public.profiles for update
  using (public.is_staff());

-- ---- channels
drop policy if exists channels_select on public.channels;
create policy channels_select on public.channels for select using (is_active or public.is_staff());
drop policy if exists channels_staff_write on public.channels;
create policy channels_staff_write on public.channels for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- posts
-- Publik: hanya 'published'. Penulis & staff: lihat semuanya (buat moderasi/audit).
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select using (
  status = 'published'
  or author_id = auth.uid()
  or public.is_staff()
);

-- Post anonim TIDAK boleh di-edit siapa pun kecuali staff (identitasnya dilindungi)
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert with check (
  author_id = auth.uid()
  and public.is_verified()
  and (
    (select can_post from public.channels where id = channel_id) = 'verified'
    or public.is_staff()
  )
);

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update
  using (
    (author_id = auth.uid() and is_anonymous = false and status <> 'deleted')
    or public.is_staff()
  )
  with check (
    (author_id = auth.uid() and is_anonymous = false)
    or public.is_staff()
  );

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using ((author_id = auth.uid() and is_anonymous = false) or public.is_staff());

-- ---- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (
  author_id = auth.uid()
  or public.is_staff()
  or exists (select 1 from public.posts p where p.id = post_id and p.status = 'published')
);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (
  author_id = auth.uid() and public.is_verified()
);

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update
  using ((author_id = auth.uid() and is_anonymous = false) or public.is_staff());

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete
  using ((author_id = auth.uid() and is_anonymous = false) or public.is_staff());

-- ---- reactions
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select using (true);

drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert
  with check (user_id = auth.uid() and public.is_verified());

drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete
  using (user_id = auth.uid() or public.is_staff());

-- ---- tickets: hanya pemilik & staff
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select using (
  author_id = auth.uid() or public.is_staff()
);

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert with check (
  author_id = auth.uid() and public.is_verified()
);

drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update using (public.is_staff());
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete using (public.is_staff());

-- ---- ticket_messages
drop policy if exists ticket_messages_select on public.ticket_messages;
create policy ticket_messages_select on public.ticket_messages for select using (
  sender_id = auth.uid()
  or exists (
    select 1 from public.tickets t
    where t.id = ticket_id and (t.author_id = auth.uid() or public.is_staff())
  )
);

drop policy if exists ticket_messages_insert on public.ticket_messages;
create policy ticket_messages_insert on public.ticket_messages for insert with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.tickets t
    where t.id = ticket_id and (t.author_id = auth.uid() or public.is_staff())
  )
);

drop policy if exists ticket_messages_delete on public.ticket_messages;
create policy ticket_messages_delete on public.ticket_messages for delete using (public.is_staff());

-- ---- chat_rooms
drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms for select using (true);
drop policy if exists chat_rooms_staff on public.chat_rooms;
create policy chat_rooms_staff on public.chat_rooms for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- chat_messages: khusus siswa terverifikasi (identitas terlihat, jadi wajib santun)
drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select using (public.is_verified());

drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert
  with check (author_id = auth.uid() and public.is_verified());

drop policy if exists chat_update on public.chat_messages;
create policy chat_update on public.chat_messages for update using (public.is_staff());

drop policy if exists chat_delete on public.chat_messages;
create policy chat_delete on public.chat_messages for delete
  using (author_id = auth.uid() or public.is_staff());

-- ---- reports
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (reporter_id = auth.uid() and public.is_verified());

drop policy if exists reports_staff on public.reports;
create policy reports_staff on public.reports for all using (public.is_staff());

-- ---- moderation_actions & audit_logs: staff only
drop policy if exists moderation_staff on public.moderation_actions;
create policy moderation_staff on public.moderation_actions for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists audit_staff on public.audit_logs;
create policy audit_staff on public.audit_logs for all
  using (public.is_staff()) with check (public.is_staff());

-- ---- push_subscriptions: milik sendiri; staff boleh baca utk broadcast
drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions for select
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete on public.push_subscriptions for delete
  using (user_id = auth.uid() or public.is_staff());

-- ==========================================================================
-- 12. REALTIME
-- ==========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ticket_messages'
  ) then
    alter publication supabase_realtime add table public.ticket_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
exception when undefined_object then
  raise notice 'publication supabase_realtime belum ada - lewati (tidak fatal)';
end $$;

-- ==========================================================================
-- 13. STORAGE BUCKET
--   media       = karya/foto talent & post  -> public read
--   attachments = bukti lapor & avatar      -> privat (signed URL)
-- ==========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif','video/mp4']),
  ('attachments', 'attachments', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- media: baca publik, tulis hanya user terverifikasi
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "media_owner_insert" on storage.objects;
create policy "media_owner_insert" on storage.objects for insert
  with check (
    bucket_id = 'media'
    and public.is_verified()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_owner_delete" on storage.objects;
create policy "media_owner_delete" on storage.objects for delete
  using (
    bucket_id = 'media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

-- attachments: privat total; owner + staff
drop policy if exists "attach_owner_select" on storage.objects;
create policy "attach_owner_select" on storage.objects for select
  using (
    bucket_id = 'attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff())
  );

drop policy if exists "attach_owner_insert" on storage.objects;
create policy "attach_owner_insert" on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and public.is_verified()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "attach_staff_delete" on storage.objects;
create policy "attach_staff_delete" on storage.objects for delete
  using (bucket_id = 'attachments' and public.is_staff());

-- ==========================================================================
-- SELESAI. Lanjut ke 02_seed.sql
-- ==========================================================================
