# Portal OSIS — SMK TRI DHARMA 2 BOGOR

PWA mobile-first untuk OSIS: pengumuman resmi, **aspirasi anonim**, **galeri Talent**, **chat siswa**, dan **layanan lapor rahasia** dengan kode tiket.

Biaya operasional: **Rp 0** (Vercel Free + Supabase Free).

---

## 1. Ringkasan teknis

| Aspek | Keputusan |
|---|---|
| Platform | PWA (Next.js 15 App Router), mobile-first, max width 480px |
| Bahasa | **JavaScript murni** (`.js` / `.jsx`) — tidak ada TypeScript |
| Hosting | Vercel (frontend) + Supabase Free (Postgres, Auth, Realtime, Storage) |
| Styling | Tailwind CSS 3 + komponen UI sendiri (`components/ui/`) |
| State | Zustand (client) + helper `useQuery` ringan (server state) |
| Validasi | Zod v4 (dipakai di client **dan** server) |
| Ikon | Lucide React |
| Auth | Supabase Auth, login **NIS + password** (email pseudo `<nis>@siswa.local`) |
| Keamanan | Row Level Security di semua tabel + API route dengan `service_role` |
| Realtime | Supabase Realtime (chat & tiket) |
| Notifikasi | Web Push (VAPID) — opsional, aplikasi tetap jalan tanpa ini |
| PWA | `app/manifest.js` + `public/sw.js` (ditulis manual, tanpa next-pwa) |

> Keputusan sadar: **shadcn/ui, TanStack Query, next-pwa, dan react-hook-form tidak dipakai** karena praktis membutuhkan TypeScript / menambah beban dependensi. Sebagai gantinya ada `components/ui/` (Button, Input, Select, Textarea, Checkbox, Modal, Badge, Avatar, Toast, Alert, Skeleton, EmptyState, Fab, TabBar, Segmen) dan `lib/useQuery.js`.

---

## 2. Struktur folder

```
osis-app/
├── app/                     # halaman + API routes (App Router)
│   ├── layout.js            # root layout (tema, toaster, PWA)
│   ├── page.js              # redirect -> /home
│   ├── manifest.js          # PWA manifest
│   ├── globals.css
│   ├── error.js  not-found.js  offline/page.js
│   ├── (auth)/              # tanpa bottom nav
│   │   ├── login/  register/
│   ├── (main)/              # dengan bottom nav 5 tab
│   │   ├── home/  chat/  talent/  aspirasi/  lapor/  profil/
│   ├── admin/               # dashboard staff (tanpa bottom nav siswa)
│   │   ├── page.js          # dashboard + statistik + push broadcast
│   │   ├── verifikasi/      # verifikasi manual, buat akun OSIS, ubah role
│   │   ├── import/          # import CSV siswa / OSIS  (FASE B)
│   │   ├── siswa/           # kelola data siswa, nonaktifkan (FASE C)
│   │   ├── moderasi/        # laporan konten + sanksi
│   │   └── tiket/           # kelola tiket lapor
│   ├── lapor/[kode]/        # lacak tiket — BISA tanpa login
│   ├── post/[id]/           # detail post + komentar
│   └── api/                 # semua endpoint server
│       ├── register/  verify-nis/  feed/  channels/
│       ├── posts/[id]/  comments/  comments/[id]/  reactions/  reports/
│       ├── tickets/  tickets/[kode]/  tickets/status/
│       ├── push/  push/subscribe/
│       └── admin/{stats,verify,roles,sanction,moderation,reports,students,import,tickets}/
├── components/
│   ├── ui/                  # Button, Input, Modal, Badge, Toast, index (Avatar dll)
│   ├── BottomNav.js  Header.js  PostCard.js  ChatBubble.js
│   ├── TicketForm.js  VerifiedBadge.js  ComposerSheet.js
│   ├── AuthGate.js  ThemeToggle.js  RegisterSW.js  FeedClient.js
├── lib/
│   ├── supabase/{client,server}.js   # browser (anon) / server (service_role)
│   ├── auth.js  api-client.js  api-helpers.js
│   ├── validators.js  censor.js  constants.js  utils.js
│   ├── rate-limit.js  import-csv.js  push.js  store.js  useQuery.js
├── public/                  # sw.js, logo.svg, favicon.ico, icons/
├── supabase/
│   ├── 01_schema.sql        # tabel + trigger + RLS + storage
│   ├── 02_seed.sql          # 40 NIS dummy (prefix 2425 & 2627) + channel + room
│   └── 03_admin_setup.sql   # akun admin pertama, set_user_role, admin_stats, cleanup
├── scripts/
│   ├── generate-vapid.js    # npm run vapid
│   └── gen-icons.py         # generate ikon PWA (butuh Pillow)
├── middleware.js            # auth guard ringan (bukan pengganti RLS)
└── .env.example
```

---

## 3. Setup dari nol (± 25 menit)

### A. Supabase

1. Buat project gratis di <https://supabase.com> (region **Singapore** supaya latency kecil).
2. **SQL Editor → New query**, lalu jalankan berurutan:
   - `supabase/01_schema.sql`
   - `supabase/02_seed.sql`
   - `supabase/03_admin_setup.sql`
3. **Authentication → Providers → Email**: pastikan **enabled**, lalu matikan **"Confirm email"**
   (kita pakai email pseudo `<nis>@siswa.local` yang tidak punya inbox).
4. **Authentication → URL Configuration**: isi *Site URL* dengan domain Vercel
   (mis. `https://osis-td2.vercel.app`) dan tambahkan `http://localhost:3000` di *Redirect URLs*.
5. **Storage**: cek bucket `media` (public) dan `attachments` (private) sudah terbentuk
   (dibuat otomatis oleh `01_schema.sql`).
6. Ambil kunci dari **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (**rahasia!**) → `SUPABASE_SERVICE_ROLE_KEY`

### B. Aplikasi

```bash
cd osis-app
npm install
cp .env.example .env.local      # lalu isi 3 variabel Supabase
npm run dev                     # http://localhost:3000
```

### C. Admin pertama

1. Buka `/register`, daftar pakai salah satu NIS dummy, contoh:
   - NIS `24250001`, Nama `Ahmad Fauzan Ridwan`, username bebas, password ≥ 8 karakter.
2. Ambil UUID-nya di Supabase → **Authentication → Users** (atau SQL):
   ```sql
   select id, email from auth.users order by created_at desc limit 3;
   ```
3. Jadikan super_admin:
   ```sql
   select public.set_user_role('<UUID_USER>', 'super_admin');
   ```
4. Logout → login ulang → menu `/admin` terbuka.

### D. Web Push (opsional)

```bash
npm run vapid
```
Salin `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` ke `.env.local`
(lalu ke Environment Variables Vercel). Tanpa ini aplikasi tetap jalan normal; hanya tombol
"Aktifkan notifikasi" di `/profil` yang menolak dengan pesan jelas.

### E. Deploy ke Vercel

```bash
npm i -g vercel
vercel           # preview
vercel --prod    # produksi
```
Atau push ke GitHub → import repo di Vercel → isi Environment Variables → deploy otomatis tiap push.

Panduan lengkap (termasuk checklist sebelum launching) ada di **`DEPLOY.md`**.

---

## 4. Data dummy untuk testing (FASE A)

`02_seed.sql` mengisi **40 NIS palsu**:

| Prefix | Rentang NIS | Jumlah | Contoh nama |
|---|---|---|---|
| `2425` | `24250001` – `24250020` | 20 | Ahmad Fauzan Ridwan (XII RPL 1) |
| `2627` | `26270001` – `26270020` | 20 | Bintang Arya Pratama (X RPL 1) |
| `2324` | — | 0 (prefix **nonaktif**) | untuk menguji pesan "angkatan belum dibuka" |

Contoh akun uji cepat:

| NIS | Nama (harus diisi persis-ish) | Kelas |
|---|---|---|
| `24250001` | Ahmad Fauzan Ridwan | XII RPL 1 |
| `24250011` | Dimas Aditya Saputra | XI RPL 1 |
| `26270001` | Bintang Arya Pratama | X RPL 1 |
| `26270020` | Alya Nabila Zahwa | X BDP 2 |

Pencocokan nama **longgar**: huruf besar/kecil, tanda baca, gelar (`Alm.`, `S.Pd`), `bin/binti`,
dan urutan kata diabaikan. Jadi `ahmad fauzan` atau `Ahmad Fauzan Ridwan.` sama-sama diterima,
sedangkan nama yang benar-benar beda ditolak.

**Setelah data asli masuk (FASE B), matikan dummy:**

```sql
update public.students set active = false where nis ~ '^(2425|2627)[0-9]{4}$';
-- atau hapus bersih:
delete from public.students where nis ~ '^(2425|2627)[0-9]{4}$';
```

---

## 5. Alur verifikasi NIS

```
Siswa buka /register
  └─ isi Nama, NIS, Username, Password
      ├─ validasi client (Zod): NIS 8 digit, prefix aktif, username 3–20 & tidak "menyerupai resmi"
      ├─ POST /api/verify-nis  -> umpan balik cepat ("Cocok! Kelas X RPL 1")
      └─ POST /api/register
           a. prefix harus ada & active di academic_years
           b. NIS harus ada & active di students
           c. nama dicocokkan longgar dengan data sekolah
           d. NIS belum dipakai di profiles / auth.users
           e. username tidak dipakai & tidak menyerupai akun resmi (levenshtein ≤ 1 ditolak)
           f. auth.admin.createUser(email = <nis>@siswa.local, app_metadata.role='siswa')
           g. rpc create_profile_for_new_user() -> profiles (verified_at = now())
           h. profiles.nis + nama_lengkap diisi dari data sekolah
           i. catat audit_logs

Setelah login, halaman /login memanggil GET /api/auth/guard untuk memastikan:
  - NIS masih `active` di data sekolah  -> kalau tidak, session dibatalkan + pesan jelas
  - akun tidak sedang di-ban            -> ditolak dengan tanggal berakhir blokir
  - akun tidak sedang di-mute           -> boleh masuk tapi hanya bisa membaca
(Hal ini tidak bisa dicek langsung dari browser karena tabel `students` hanya terbaca oleh staff.)
```

Pesan kegagalan sesuai tabel di PLAN Bagian 5:

| Kondisi | Kode | Pesan |
|---|---|---|
| NIS tidak ada | `NIS_TAK_TERDAFTAR` | "NIS belum terdaftar di data sekolah. Hubungi admin OSIS / wali kelas." |
| NIS sudah dipakai | `NIS_SUDAH_DIPAKAI` | "NIS ini sudah terdaftar…" |
| Nama tidak cocok | `NAMA_TIDAK_COCOK` | "Nama tidak sesuai data sekolah. Cek ejaan & singkatan." |
| Prefix nonaktif | `PREFIX_NONAKTIF` | "Angkatan ini belum dibuka pendaftarannya." |
| NIS dinonaktifkan admin | `NIS_NONAKTIF` | "Akun NIS ini sudah dinonaktifkan." |

---

## 6. Sistem anonim (bagaimana sebenarnya dijamin)

| Layer | Tahu identitas? | Implementasi |
|---|---|---|
| UI publik (feed, komentar, chat aspirasi) | ❌ | `is_anonymous=true` → nama "Anonim" + avatar abu-abu, `author` tidak dirender |
| Database | ✅ | `posts.author_id` tetap terisi (wajib untuk audit) |
| Admin / OSIS | ✅ | dashboard moderasi & tombol **Mode audit** di feed Aspirasi (menampilkan NIS penulis) |
| Pelapor tiket | ✅ (miliknya sendiri) | kode tiket `LPR-XXXXXX`; `/lapor/[kode]` bisa dibuka tanpa login |

Aturan tambahan yang sudah diterapkan:

- Channel `aspirasi` punya `force_anon = true` → **komentar pun ikut anonim** (dipaksa server, bukan client).
- Post anonim **tidak bisa di-edit/dihapus oleh penulisnya** lewat API publik (RLS), hanya moderator.
- Rate limit: 1 tiket / 10 menit / akun, 3 post / 10 menit, 5 komentar / 5 menit, 10 chat / menit,
  5 login gagal / 15 menit → lock 15 menit.
- Kata kasar disensor otomatis di **client dan server** (`lib/censor.js`), dengan batas kata (`\b`)
  supaya kata normal seperti "anjurkan" tidak ikut tersensor.
- Username yang menyerupai akun resmi ditolak saat registrasi (`RESERVED_USERNAMES` +
  `IMPERSONATION_KEYWORDS` + cek Levenshtein terhadap username OSIS yang sudah ada).
- Setiap tindakan admin (role, sanksi, hapus konten, import, buka tiket) masuk `audit_logs`.

---

## 7. Keamanan — baca ini

1. **`SUPABASE_SERVICE_ROLE_KEY` hanya boleh di server.** Semua file yang memakainya meng-`import 'server-only'` di baris pertama, jadi build akan gagal kalau tak sengaja dipakai di komponen client.
2. **RLS aktif di semua tabel.** Kebijakan penting:
   - `students` → **hanya staff** (data siswa tidak pernah bocor ke publik; cek NIS dilakukan lewat API route ber-service-role).
   - `posts` → publik hanya melihat `status='published'`; penulis & staff melihat semua.
   - `tickets` / `ticket_messages` → hanya pemilik & staff.
   - `chat_messages` → hanya user dengan `verified_at` terisi.
   - `profiles_update_own` → user **tidak bisa** mengubah `role`, `verified_at`, `nis`, `banned_until`, `muted_until` sendiri.
3. **Middleware bukan penjaga keamanan.** Ia hanya cek keberadaan cookie auth untuk UX (redirect ke `/login`). Yang benar-benar menahan akses adalah RLS + API route.
4. Trigger `tg_guard_not_banned` menolak INSERT chat/post/komentar dari akun yang sedang di-ban/mute, jadi sanksi berlaku meski client mencoba menembak Supabase langsung.
5. Rate limit in-memory bersifat *best effort* di serverless (tiap instance punya memori sendiri). Untuk kebutuhan sekolah ini sudah cukup; kalau mau ketat, pindah ke tabel `rate_limits` + Edge Function atau Upstash free tier.
6. Jangan pernah men-`commit` `.env.local`. Sudah ada di `.gitignore`.

---

## 8. Peta fitur vs PLAN

| PLAN | Status | File utama |
|---|---|---|
| Bagian 1 — Bootstrap 3 fase (dummy → import → migrasi) | ✅ | `supabase/02_seed.sql`, `app/admin/import`, `app/admin/siswa` |
| Bagian 2 — Arsitektur & stack | ✅ (stack ringan, lihat catatan di atas) | — |
| Bagian 3 — Struktur folder | ✅ | — |
| Bagian 4 — Skema DB + RLS | ✅ (+ trigger kode tiket, counter, audit, storage) | `supabase/01_schema.sql` |
| Bagian 5 — Alur verifikasi NIS | ✅ | `app/api/register`, `app/api/verify-nis` |
| Bagian 6 — Sistem anonim + anti-penyalahgunaan | ✅ | `components/PostCard.js`, `lib/censor.js`, `lib/rate-limit.js` |
| Bagian 7 — UI/UX mobile-first, bottom nav 5 tab, FAB, dark mode, a11y | ✅ | `components/BottomNav.js`, `app/globals.css` |
| Bagian 8 — Moderasi & keamanan (sensor, rate limit, sanksi, badge OSIS) | ✅ | `app/admin/moderasi`, `app/api/admin/sanction` |
| Bagian 9 — PWA (manifest, SW, Web Push) | ✅ | `app/manifest.js`, `public/sw.js`, `lib/push.js` |
| OCR | ❌ (memang tidak dipakai sesuai keputusan) | — |

---

## 9. Perintah npm

| Perintah | Fungsi |
|---|---|
| `npm run dev` | development server (SW dinonaktifkan otomatis agar tidak meng-cache kode dev) |
| `npm run build` | production build |
| `npm start` | jalankan hasil build |
| `npm run lint` | ESLint bawaan Next |
| `npm run vapid` | generate kunci VAPID untuk Web Push |
| `npm test` | uji logika murni: validasi NIS, pencocokan nama, sensor kata, parser CSV, aturan import (52 kasus) |
| `python3 scripts/gen-icons.py` | regenerate ikon PWA (butuh Pillow) |

---

## 10. Troubleshooting

| Gejala | Sebab & solusi |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY belum diset` | Isi `.env.local`, **restart** `npm run dev` (env dibaca saat start). |
| Registrasi balas "Gagal membuat akun" | Supabase → Auth → Email → **Confirm email** masih ON. Matikan. |
| Login selalu gagal padahal password benar | Email pseudo tidak cocok → pastikan `APP.domainEmailSiswa` = `siswa.local` dan user dibuat lewat `/api/register`. |
| Chat tidak realtime | Supabase → Database → Replication → pastikan `chat_messages` ada di publication `supabase_realtime` (sudah dicoba otomatis oleh `01_schema.sql`). |
| Upload gambar gagal 403 | Bucket `media` belum ada / policy storage belum jalan → jalankan ulang bagian 13 `01_schema.sql`. |
| Tombol notifikasi: "VAPID kosong" | Jalankan `npm run vapid` lalu isi env & deploy ulang. |
| iPhone tidak muncul notifikasi | Normal: iOS ≥ 16.4 baru mendukung Web Push **setelah** PWA dipasang ke Home Screen. |
| `service worker` tidak aktif di dev | Disengaja. SW hanya didaftarkan saat `NODE_ENV=production`. |
| Halaman `/admin` menolak meski sudah admin | Role di JWT lama → **logout lalu login ulang** setelah `set_user_role`. |
| Feed kosong padahal sudah seed | Post seed punya `author_id = null`; pastikan query tidak memfilter penulis. Cek `select count(*) from posts`. |

---

## 11. Roadmap berikutnya (belum dikerjakan)

- [ ] Notifikasi balasan tiket via **e-mail** (butuh Resend/SMTP — di luar budget Rp 0)
- [ ] Direct message antar siswa (sekarang hanya chat ruang global)
- [ ] Polling/voting acara OSIS
- [ ] Arsip pengumuman per periode kepengurusan
- [ ] Export laporan bulanan (PDF) untuk pembina
- [ ] Rate limiter terdistribusi (Upstash) kalau pengguna > 1.000 aktif harian
