/**
 * Konstanta global aplikasi OSIS SMK TRI DHARMA 2 BOGOR.
 * Semua nilai "kebijakan" dikumpulkan di sini biar gampang diubah.
 */

export const APP = {
  nama: 'OSIS SMK TRI DHARMA 2 BOGOR',
  namaPendek: 'OSIS TD2',
  deskripsi:
    'Portal resmi siswa SMK TRI DHARMA 2 BOGOR: pengumuman OSIS, aspirasi anonim, showcase talent, dan layanan lapor rahasia.',
  domainEmailSiswa: 'siswa.local', // NIS + domain ini = email login Supabase Auth
  maxLebarKonten: '30rem', // 480px, mobile-first
};

/** Prefix angkatan aktif -> sumber kebenaran ada di tabel `academic_years`.
 *  Nilai di sini hanya fallback kalau DB belum bisa dihubungi. */
export const PREFIX_ANGKATAN_FALLBACK = ['2425', '2627'];

/** Kategori laporan (menu Lapor). */
export const KATEGORI_LAPOR = [
  { id: 'bullying', label: 'Bullying / Perundungan', prioritasDefault: 'tinggi', ikon: 'shield' },
  { id: 'kekerasan', label: 'Kekerasan fisik / verbal', prioritasDefault: 'tinggi', ikon: 'alert' },
  { id: 'pelecehan', label: 'Pelecehan', prioritasDefault: 'tinggi', ikon: 'alert' },
  { id: 'fasilitas', label: 'Fasilitas sekolah rusak', prioritasDefault: 'normal', ikon: 'wrench' },
  { id: 'pungutan', label: 'Pungutan tidak jelas', prioritasDefault: 'normal', ikon: 'wallet' },
  { id: 'belajar', label: 'Kegiatan belajar mengajar', prioritasDefault: 'normal', ikon: 'book' },
  { id: 'osis', label: 'Kinerja OSIS / acara', prioritasDefault: 'normal', ikon: 'users' },
  { id: 'lainnya', label: 'Lainnya', prioritasDefault: 'normal', ikon: 'dots' },
];

export const KATEGORI_LAPOR_MAP = Object.fromEntries(
  KATEGORI_LAPOR.map((k) => [k.id, k]),
);

/** Label status tiket. */
export const STATUS_TIKET = {
  baru: { label: 'Baru', warna: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  diproses: {
    label: 'Diproses',
    warna: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  selesai: {
    label: 'Selesai',
    warna: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  ditolak: {
    label: 'Ditolak',
    warna: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
};

export const PRIORITAS_TIKET = {
  rendah: { label: 'Rendah', warna: 'text-slate-500' },
  normal: { label: 'Normal', warna: 'text-primary-600 dark:text-primary-300' },
  tinggi: { label: 'Tinggi / Mendesak', warna: 'text-rose-600 dark:text-rose-400' },
};

/** Role & label tampilannya. */
export const ROLES = {
  siswa: { label: 'Siswa', staff: false, admin: false },
  osis: { label: 'Anggota OSIS', staff: true, admin: false },
  pembina: { label: 'Pembina OSIS', staff: true, admin: true },
  admin: { label: 'Admin', staff: true, admin: true },
  super_admin: { label: 'Super Admin', staff: true, admin: true },
};

export const ROLE_STAFF = ['osis', 'pembina', 'admin', 'super_admin'];
export const ROLE_ADMIN = ['pembina', 'admin', 'super_admin'];

/** Alasan pelaporan konten. */
export const ALASAN_REPORT = [
  'Kata kasar / tidak sopan',
  'Bullying atau pelecehan',
  'Spam / promosi',
  'Hoaks atau informasi menyesatkan',
  'Konten tidak senonoh',
  'Menyebarkan data pribadi orang lain',
  'Fitnah / tuduhan tanpa bukti',
  'Lainnya',
];

/** Daftar kata yang otomatis disensor.
 *  Ditulis dalam bentuk regex-fragment supaya variasi ejaan ikut kena.
 *  Catatan: sengaja memakai batas kata (\b) agar kata normal tidak ikut tersensor
 *  (mis. "anjurkan" tidak boleh berubah jadi "an****r"). */
export const BAD_WORDS = [
  'anjing', 'anjir', 'anying', 'asw', 'asu',
  'bangsat', 'bajingan', 'bego', 'tolol', 'goblok', 'bodoh',
  'kontol', 'kntl', 'memek', 'meme[kq]', 'ngentot', 'ngewe', 'jancok', 'jancuk',
  'cuk', 'bangke', 'kampret', 'keparat', 'lonte', 'pelacur', 'jablay',
  'babi', 'monyet', 'setan', 'iblis',
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy',
];

/** Username yang dilindungi - mencegah impersonasi akun resmi. */
export const RESERVED_USERNAMES = [
  'admin', 'administrator', 'osis', 'osisofficial', 'osisresmi', 'osissmk',
  'osistridharma', 'osis_td2', 'osistd2', 'smk', 'smktd2', 'smktridharma',
  'smktridharma2', 'tridharma', 'td2', 'sekolah', 'kepsek', 'kepala',
  'kepsekolah', 'guru', 'wali', 'walikelas', 'pembina', 'pembinaosis',
  'bk', 'bimbingan', 'kesiswaan', 'kurikulum', 'humas', 'tu', 'tatausaha',
  'official', 'verified', 'staff', 'moderator', 'mod', 'root', 'system',
  'sistem', 'superadmin', 'super', 'support', 'bantuan', 'helpdesk',
];

/** Kata kunci yang tidak boleh MUNCUL di dalam username siapa pun. */
export const IMPERSONATION_KEYWORDS = [
  'osis', 'admin', 'sekolah', 'smk', 'tridharma', 'tri.dharma', 'pembina',
  'kepsek', 'guru', 'official', 'verified',
];

/** Rate limit (per akun, kecuali login: per NIS + per IP). */
export const RATE_LIMITS = {
  chatPerMenit: 10,
  postPer10Menit: 3,
  komentarPer5Menit: 5,
  tiketPer10Menit: 1,
  aspirasiPer5Menit: 1,
  loginGagalMaksimal: 5,
  loginJendelaMenit: 15,
  loginLockMenit: 15,
  verifyNisPer10Menit: 10,
  lacakTiketPer10Menit: 20,
};

/** Batas konten. */
export const LIMITS = {
  postKarakter: 5000,
  postJudul: 120,
  komentarKarakter: 1000,
  chatKarakter: 500,
  bioKarakter: 160,
  usernameMin: 3,
  usernameMax: 20,
  passwordMin: 8,
  lampiranTiket: 3,
  mediaPost: 4,
  ukuranFileMB: 8,
};

/** Ukuran file maksimal dalam byte. */
export const MAX_FILE_BYTES = LIMITS.ukuranFileMB * 1024 * 1024;

export const MIME_GAMBAR = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MIME_LAMPIRAN = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export const BUCKET = {
  media: 'media',
  attachments: 'attachments',
};

/** Umpan balik teks kosong dsb. */
export const PESAN = {
  nisKosong: 'NIS wajib diisi.',
  nisFormat: 'NIS harus 8 digit angka, contoh 24250001.',
  nisTakTerdaftar: 'NIS belum terdaftar di data sekolah. Hubungi admin OSIS / wali kelas.',
  nisNonaktif: 'Akun NIS ini sudah dinonaktifkan. Hubungi admin OSIS.',
  nisDipakai: 'NIS ini sudah terdaftar. Kalau lupa password, minta reset ke admin OSIS.',
  namaTakCocok: 'Nama tidak sesuai data sekolah. Cek ejaan & singkatan (contoh: tulis nama lengkap sesuai rapor).',
  prefixNonaktif: 'Angkatan ini belum dibuka pendaftarannya. Hubungi admin OSIS.',
  usernameDipakai: 'Username sudah dipakai orang lain. Coba tambahkan angka.',
  usernameReserved: 'Username ini dicadangkan untuk akun resmi sekolah. Pilih username lain.',
  passwordPendek: 'Password minimal 8 karakter.',
  loginGagal: 'NIS atau password salah.',
  loginTerkunci: 'Terlalu banyak percobaan gagal. Coba lagi dalam beberapa menit.',
  belumLogin: 'Kamu harus login dulu.',
  belumVerifikasi: 'Akunmu belum terverifikasi. Hubungi admin OSIS.',
  dibanned: 'Akun kamu sedang diblokir karena melanggar aturan komunitas.',
  dimute: 'Kamu sedang dibisukan sementara, jadi belum bisa mengirim pesan.',
  bukanStaff: 'Halaman ini khusus OSIS / admin.',
  rateLimit: 'Terlalu cepat. Tunggu sebentar lalu coba lagi.',
  serverError: 'Terjadi kesalahan di server. Coba lagi beberapa saat.',
  jaringan: 'Tidak ada koneksi internet. Periksa jaringanmu lalu coba lagi.',
};

/** Channel slug yang dikenal UI. */
export const CHANNEL = {
  OSIS: 'osis',
  ASPIRASI: 'aspirasi',
  TALENT: 'talent',
};
