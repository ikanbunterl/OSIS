# Panduan Deploy — Portal OSIS SMK TRI DHARMA 2 BOGOR

Target: **Rp 0/bulan**, bisa diakses dari HP siswa, terpasang sebagai aplikasi (PWA).

---

## Tahap 0 — Prasyarat (sekali saja)

| Kebutuhan | Keterangan |
|---|---|
| Akun GitHub | gratis, untuk menaruh kode |
| Akun Vercel | gratis (Hobby), login pakai GitHub |
| Akun Supabase | gratis (Free tier), login pakai GitHub |
| Email sekolah/admin | untuk `VAPID_SUBJECT` & pemulihan akun Supabase |

Catatan Free tier Supabase: 500 MB database, 1 GB storage, 50.000 user, 2 GB bandwidth,
**project di-pause kalau tidak ada aktivitas 7 hari**. Untuk aplikasi sekolah yang dipakai harian
ini aman; kalau sempat mati, tinggal buka Dashboard → *Restore project*.

---

## Tahap 1 — Siapkan Supabase

1. **New project** → Organization: pilih yang gratis → Region: **Southeast Asia (Singapore)**.
   Simpan password database (tidak dipakai aplikasi, tapi jangan hilang).
2. Tunggu ± 2 menit sampai project siap.
3. **SQL Editor → New query**, tempel & **Run** berurutan:
   1. `supabase/01_schema.sql` → buat tabel, trigger, RLS, bucket storage
   2. `supabase/02_seed.sql` → 40 NIS dummy + 3 channel + 2 room chat + contoh post
   3. `supabase/03_admin_setup.sql` → fungsi `set_user_role`, trigger sinkron role, `admin_stats`

   Jalankan satu per satu, jangan digabung, supaya kalau ada error gampang dilacak.
4. **Authentication → Providers → Email**
   - Enable Email provider: **ON**
   - Confirm email: **OFF**  ← penting, karena email siswa bersifat pseudo
   - Secure email change: boleh ON
5. **Authentication → URL Configuration**
   - Site URL: `https://<nama-project>.vercel.app`
   - Redirect URLs: tambahkan URL Vercel **dan** `http://localhost:3000`
6. **Storage** → pastikan ada bucket:
   - `media` — **Public**
   - `attachments` — **Private**
7. **Project Settings → API** → salin 3 nilai:
   - Project URL
   - `anon` `public` key
   - `service_role` key (**jangan pernah dibagikan / di-commit**)

### Verifikasi cepat (opsional tapi disarankan)

```sql
select count(*) from public.students;                 -- 40
select slug, can_post, force_anon from public.channels;  -- osis/aspirasi/talent
select count(*) from pg_policies where schemaname='public';  -- >= 40
select * from public.admin_stats();                   -- JSON ringkasan
```

---

## Tahap 2 — Jalankan lokal dulu

```bash
cd osis-app
npm install
cp .env.example .env.local
# isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Buka <http://localhost:3000> → akan diarahkan ke `/login`.

**Uji alur lengkap (5 menit):**

1. `/register` → NIS `26270001`, Nama `Bintang Arya Pratama`, username `bintang.arya`, password bebas ≥ 8.
   - Perhatikan: indikator "Cocok! Kelas X RPL 1 · TA 2026/2027" harus muncul hijau.
   - Coba NIS `23240001` → harus ditolak "Angkatan ini belum dibuka pendaftarannya".
   - Coba nama salah → harus ditolak "Nama tidak sesuai data sekolah".
2. Setelah daftar → otomatis login → `/home` (tab OSIS berisi post selamat datang).
3. Tab **Aspirasi** → tombol **+** → tulis aspirasi → kirim → muncul sebagai **Anonim**.
4. **Chat** → kirim pesan → buka browser kedua/incognito dengan akun lain → pesan muncul realtime.
5. **Lapor** → isi form → dapat kode `LPR-XXXXXX` → salin → buka `/lapor/<kode>` di **mode incognito**
   (tanpa login) → status tiket tetap terbaca.
6. **Talent** → unggah gambar → muncul di grid.
7. **Profil** → ganti bio & avatar → logout.

---

## Tahap 3 — Buat akun admin pertama

1. Login dengan akun siswa yang baru dibuat.
2. Supabase → **SQL Editor**:
   ```sql
   select id, email, raw_user_meta_data->>'username' as username, created_at
   from auth.users order by created_at desc limit 5;
   ```
3. Naikkan jadi super_admin:
   ```sql
   select public.set_user_role('<UUID_USER>', 'super_admin');
   ```
4. Di aplikasi: **logout → login ulang** → buka `/admin`.

Selanjutnya admin bisa membuat akun pembina/OSIS lain dari `/admin/verifikasi`
(tanpa perlu buka SQL lagi).

---

## Tahap 4 — Deploy ke Vercel

### Opsi A: CLI (cepat)

```bash
npm i -g vercel
vercel login
vercel            # deploy preview, jawab pertanyaan sesuai default
vercel --prod     # deploy produksi
```

### Opsi B: Dashboard (disarankan untuk jangka panjang)

1. Push repo ke GitHub:
   ```bash
   git init && git add -A && git commit -m "Portal OSIS SMK Tri Dharma 2 Bogor"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
   ⚠️ Pastikan `.env.local` **tidak** ikut (sudah ada di `.gitignore`). Cek dengan `git status`.
2. <https://vercel.com/new> → Import repo → Framework: **Next.js** (otomatis terdeteksi).
3. **Environment Variables** (Production + Preview):
   | Nama | Nilai |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | *(opsional)* dari `npm run vapid` |
   | `VAPID_PRIVATE_KEY` | *(opsional)* |
   | `VAPID_SUBJECT` | `mailto:osis@...` |
4. **Deploy**. Tunggu ± 2 menit.
5. Setelah domain jadi, **update Site URL di Supabase Auth** ke domain produksi,
   lalu redeploy (env `NEXT_PUBLIC_*` ikut ter-bake saat build).

### Custom domain (opsional)

Vercel → Project → Settings → Domains → tambahkan mis. `osis.smktridharma2bogor.sch.id`,
lalu arahkan DNS (A record `76.76.21.21` atau CNAME `cname.vercel-dns.com`).
Setelah aktif, perbarui Site URL di Supabase.

---

## Tahap 5 — Aktifkan Web Push (opsional)

```bash
npm run vapid
```
Salin 3 baris output ke `.env.local` **dan** Environment Variables Vercel → redeploy.

Tanpa ini: aplikasi tetap jalan penuh, hanya notifikasi push yang tidak aktif
(tombol di `/profil` akan memberi penjelasan, bukan error).

**Catatan iPhone:** iOS baru mendukung Web Push sejak 16.4 **dan hanya untuk PWA yang
dipasang ke Home Screen** (Safari → Bagikan → "Tambahkan ke Home Screen").

---

## Tahap 6 — Pasang sebagai aplikasi (PWA)

- **Android / Chrome**: buka situs → menu ⋮ → *Tambahkan ke layar utama*, atau pakai tombol
  "Pasang aplikasi" yang muncul otomatis di dalam app.
- **iPhone / Safari**: Bagikan → *Tambahkan ke Home Screen*.

Service worker (`public/sw.js`) hanya didaftarkan di build produksi, jadi `npm run dev`
tidak akan ter-cache.

---

## Tahap 7 — FASE B: masukkan data siswa asli

1. Minta file dari TU/wali kelas: kolom **NIS, Nama, Kelas**.
2. Rapikan di Excel: NIS harus 8 digit angka; 4 digit pertama = prefix angkatan.
3. **File → Save As → CSV UTF-8 (Comma delimited)**.
4. `/admin/import` → mode *Data siswa* → unggah → **jangan centang "mode timpa"** dulu.
5. Baca daftar baris yang ditolak, perbaiki file, unggah lagi (aman diulang).
6. Kalau prefix angkatan baru belum ada, tambahkan dulu:
   ```sql
   insert into public.academic_years (prefix, tahun_ajaran, active)
   values ('2728', '2027/2028', true)
   on conflict (prefix) do update set active = true;
   ```
7. Setelah data asli lengkap, **matikan data dummy**:
   ```sql
   update public.students set active = false where nis ~ '^(2425|2627)[0-9]{4}$';
   ```
8. Buat akun OSIS: `/admin/verifikasi` → *Buat akun OSIS*, atau `/admin/import` mode **OSIS**
   (CSV dengan kolom tambahan `username`, `password`).

### Checklist sebelum diumumkan ke siswa

- [ ] Data siswa asli sudah ter-import, dummy sudah dinonaktifkan
- [ ] Prefix angkatan aktif sudah benar (cek `/admin/import`)
- [ ] Akun admin, pembina, dan seluruh anggota OSIS sudah dibuat & bisa login
- [ ] Badge emas OSIS muncul di akun pengurus (cek `/home` tab OSIS)
- [ ] Uji coba lapor → kode tiket keluar → admin balas → pelapor dapat balasan
- [ ] Uji `/lapor/<kode>` di incognito (tanpa login) tetap bisa dibuka
- [ ] Site URL Supabase = domain produksi
- [ ] Uji di HP Android + iPhone (install PWA, dark mode, safe-area)
- [ ] Sosialisasi aturan main: anonim ≠ bebas memfitnah (ada audit & sanksi)

---

## Tahap 8 — Perawatan rutin

| Kapan | Apa |
|---|---|
| Harian (5 menit) | `/admin/tiket` — balas tiket status **baru**; `/admin/moderasi` — tinjau laporan |
| Mingguan | Cek `audit_logs` untuk pola penyalahgunaan; bersihkan chat lama: `select public.cleanup_old_chat(30);` |
| Awal semester | Import data siswa baru, tambah prefix angkatan, nonaktifkan siswa lulus (`active=false`) |
| Pergantian pengurus | Turunkan role OSIS lama jadi `siswa` lewat `/admin/verifikasi` → *Ubah role* |

Backup: Supabase Free tidak punya backup otomatis harian. Sekali sebulan jalankan:

```bash
# butuh Supabase CLI + access token
supabase db dump --db-url "$DATABASE_URL" --file backup-$(date +%F).sql
```

atau **Database → Backups** di dashboard, plus export tabel `students` ke CSV dari `/admin/siswa`
(tombol *Unduh CSV*).

---

## Kalau ada masalah saat deploy

| Gejala | Cek |
|---|---|
| Build gagal `Attempted import error` | Pastikan pakai Node 20+ (`node -v`) dan `npm install` dijalankan ulang |
| Halaman putih / 500 | Vercel → Logs → cari pesan `SUPABASE_SERVICE_ROLE_KEY belum diset` |
| Registrasi gagal terus | Confirm email masih ON di Supabase Auth, atau `students` masih kosong |
| `/admin` selalu "Akses ditolak" | `set_user_role` belum dijalankan, atau belum login ulang |
| Gambar Talent tidak muncul | Bucket `media` belum di-set Public |
| Lampiran lapor tidak bisa dibuka | Normal untuk publik; hanya pemilik & staff yang dapat signed URL |
