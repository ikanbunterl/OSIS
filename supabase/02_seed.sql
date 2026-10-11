-- ==========================================================================
--  02_seed.sql  -  DATA DUMMY (FASE A: DEVELOPMENT)
--  40 NIS palsu: prefix 2425 (20 siswa) & 2627 (20 siswa)
--  Aman dijalankan berkali-kali (idempotent).
--
--  Nanti saat data asli dari TU sudah di-import (FASE B), matikan dummy ini:
--     update public.students set active = false where nis ~ '^(2425|2627)[0-9]{4}$';
--  atau hapus bersih:
--     delete from public.students where nis ~ '^(2425|2627)[0-9]{4}$';
-- ==========================================================================

-- 1. Prefix angkatan yang AKTIF untuk pendaftaran
insert into public.academic_years (prefix, tahun_ajaran, active) values
  ('2425', '2024/2025', true),
  ('2627', '2026/2027', true)
on conflict (prefix) do update
  set tahun_ajaran = excluded.tahun_ajaran, active = excluded.active;

-- contoh angkatan DITUTUP -> untuk menguji pesan "Angkatan belum dibuka pendaftaran"
insert into public.academic_years (prefix, tahun_ajaran, active) values
  ('2324', '2023/2024', false)
on conflict (prefix) do update set tahun_ajaran = excluded.tahun_ajaran, active = excluded.active;

-- 2. Channel
insert into public.channels (slug, name, description, type, can_post, force_anon, is_active) values
  ('osis',     'OSIS Official', 'Pengumuman & info resmi dari OSIS SMK Tri Dharma 2 Bogor', 'osis',     'staff',    false, true),
  ('aspirasi', 'Aspirasi',      'Sampaikan pendapatmu secara anonim - dibaca langsung oleh OSIS', 'aspirasi', 'verified', true,  true),
  ('talent',   'Talent',        'Pamerkan karya & bakatmu: desain, foto, musik, coding, dll', 'talent',   'verified', false, true)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      type = excluded.type,
      can_post = excluded.can_post,
      force_anon = excluded.force_anon;

-- 3. Room chat
insert into public.chat_rooms (slug, name, description, is_active) values
  ('townhall', 'Townhall', 'Obrolan umum seluruh siswa (identitas terlihat)', true),
  ('bantuan',  'Bantuan',  'Tanya jawab pelajaran & info sekolah',            true)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, is_active = excluded.is_active;

-- 4. Data siswa dummy (40 NIS)
insert into public.students (nis, nama, kelas, angkatan, active) values
  ('24250001', 'Ahmad Fauzan Ridwan', 'XII RPL 1', '2425'),
  ('24250002', 'Siti Nurhaliza Putri', 'XII RPL 1', '2425'),
  ('24250003', 'Bagas Dwi Prasetyo', 'XII TKJ 1', '2425'),
  ('24250004', 'Dewi Anggraini Sari', 'XII TKJ 1', '2425'),
  ('24250005', 'Rizky Ramadhan Putra', 'XII MM 1', '2425'),
  ('24250006', 'Nabila Azzahra', 'XII MM 1', '2425'),
  ('24250007', 'Fajar Nugroho Santoso', 'XII AKL 1', '2425'),
  ('24250008', 'Intan Permatasari', 'XII AKL 1', '2425'),
  ('24250009', 'Yoga Pratama Wijaya', 'XII BDP 1', '2425'),
  ('24250010', 'Rani Kusuma Wardani', 'XII BDP 1', '2425'),
  ('24250011', 'Dimas Aditya Saputra', 'XI RPL 1', '2425'),
  ('24250012', 'Ayu Lestari Ningsih', 'XI RPL 1', '2425'),
  ('24250013', 'Gilang Mahendra Putra', 'XI TKJ 1', '2425'),
  ('24250014', 'Zahra Amelia Putri', 'XI TKJ 1', '2425'),
  ('24250015', 'Firman Setiawan Hadi', 'XI MM 1', '2425'),
  ('24250016', 'Nadia Chairunnisa', 'XI MM 1', '2425'),
  ('24250017', 'Arif Budiman Hakim', 'XI AKL 1', '2425'),
  ('24250018', 'Fitri Handayani Lubis', 'XI AKL 1', '2425'),
  ('24250019', 'Rendi Kurniawan Saputra', 'XI BDP 1', '2425'),
  ('24250020', 'Salma Auliya Rahma', 'XI BDP 1', '2425'),
  ('26270001', 'Bintang Arya Pratama', 'X RPL 1', '2627'),
  ('26270002', 'Kayla Nur Aisyah', 'X RPL 1', '2627'),
  ('26270003', 'Rafael Joshua Manurung', 'X TKJ 1', '2627'),
  ('26270004', 'Aisyah Zahra Kamila', 'X TKJ 1', '2627'),
  ('26270005', 'Muhammad Farrel Akbar', 'X MM 1', '2627'),
  ('26270006', 'Aurellia Putri Maharani', 'X MM 1', '2627'),
  ('26270007', 'Kevin Sanjaya Wijaya', 'X AKL 1', '2627'),
  ('26270008', 'Syifa Aulia Ramadhani', 'X AKL 1', '2627'),
  ('26270009', 'Naufal Ghifari Alfarizi', 'X BDP 1', '2627'),
  ('26270010', 'Cantika Dewi Lestari', 'X BDP 1', '2627'),
  ('26270011', 'Reyhan Alfarizi Pratama', 'X RPL 2', '2627'),
  ('26270012', 'Tiara Anindya Putri', 'X RPL 2', '2627'),
  ('26270013', 'Satria Bagus Pamungkas', 'X TKJ 2', '2627'),
  ('26270014', 'Hana Puspita Sari', 'X TKJ 2', '2627'),
  ('26270015', 'Ilham Maulana Yusuf', 'X MM 2', '2627'),
  ('26270016', 'Gita Nurani Safitri', 'X MM 2', '2627'),
  ('26270017', 'Aditya Rizki Firmansyah', 'X AKL 2', '2627'),
  ('26270018', 'Putri Rahmadani Siregar', 'X AKL 2', '2627'),
  ('26270019', 'Fadhil Akbar Hidayat', 'X BDP 2', '2627'),
  ('26270020', 'Alya Nabila Zahwa', 'X BDP 2', '2627')
on conflict (nis) do update
  set nama     = excluded.nama,
      kelas    = excluded.kelas,
      angkatan = excluded.angkatan,
      active   = true;

-- 5. Contoh post biar feed tidak kosong saat development
with c as (select id from public.channels where slug = 'osis')
insert into public.posts (channel_id, author_id, is_anonymous, title, content, status)
select c.id, null, false,
       'Selamat Datang di Portal OSIS SMK Tri Dharma 2 Bogor',
       E'Halo warga TD2!\n\nIni portal resmi OSIS. Di sini kamu bisa:\n- Baca pengumuman resmi OSIS\n- Kirim aspirasi secara anonim\n- Pamer karya di channel Talent\n- Lapor masalah lewat menu Lapor (rahasia, dapat kode tiket)\n\nAkunmu otomatis terverifikasi karena NIS dicek ke data sekolah. Jaga etika, ya!',
       'published'
from c
where not exists (select 1 from public.posts p join c on c.id = p.channel_id);

with c as (select id from public.channels where slug = 'aspirasi')
insert into public.posts (channel_id, author_id, is_anonymous, title, content, status)
select c.id, null, true,
       'Usul: jam istirahat kedua diperpanjang 5 menit',
       'Kantin selalu penuh pas istirahat kedua, antreannya panjang banget sampai telat masuk kelas. Kalau bisa ditambah 5 menit, atau diatur bergilir per angkatan biar tidak menumpuk.',
       'published'
from c
where not exists (select 1 from public.posts p join c on c.id = p.channel_id);

with c as (select id from public.channels where slug = 'talent')
insert into public.posts (channel_id, author_id, is_anonymous, title, content, status)
select c.id, null, false,
       'Poster MPLS 2026 (hasil desain anggota OSIS)',
       'Contoh post di channel Talent. Upload karyamu lewat tombol + di kanan bawah. Format JPG/PNG/WebP maksimal 8 MB.',
       'published'
from c
where not exists (select 1 from public.posts p join c on c.id = p.channel_id);

-- 6. Verifikasi hasil seed (jalankan manual kalau mau lihat):
-- select prefix, count(*) from public.students group by prefix order by prefix;
-- select slug, name, can_post, force_anon from public.channels;
