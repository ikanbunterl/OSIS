/**
 * Util kecil: format tanggal Indonesia, parser CSV, sleep, dsb.
 * Semua fungsi aman dipanggil di client maupun server.
 */

/** '2026-10-11T03:00:00Z' -> '11 Okt 2026, 10.00' */
export function tanggalPanjang(input) {
  const d = toDate(input);
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** '11 Okt 2026' */
export function tanggalPendek(input) {
  const d = toDate(input);
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** Jam saja: '10.05' */
export function jam(input) {
  const d = toDate(input);
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** 'baru saja', '5 mnt lalu', '3 jam lalu', '2 hari lalu', lalu jatuh ke tanggal */
export function waktuRelatif(input, sekarang = Date.now()) {
  const d = toDate(input);
  if (!d) return '-';
  const diff = Math.max(0, sekarang - d.getTime());
  const menit = Math.floor(diff / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari lalu`;
  return tanggalPendek(d);
}

/** Label tanggal chat: 'Hari ini' / 'Kemarin' / 'Senin, 11 Okt' */
export function labelHariChat(input) {
  const d = toDate(input);
  if (!d) return '';
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const selisihHari = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (selisihHari === 0) return 'Hari ini';
  if (selisihHari === 1) return 'Kemarin';
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function toDate(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sisa waktu dalam bentuk manusiawi, dipakai untuk pesan ban/mute. */
export function sisaWaktu(input) {
  const d = toDate(input);
  if (!d) return '';
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'sudah berakhir';
  const menit = Math.floor(ms / 60000);
  if (menit < 60) return `${menit} menit lagi`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lagi`;
  return `${Math.floor(jam / 24)} hari lagi`;
}

export function inisial(nama = '?') {
  const parts = String(nama).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Warna avatar deterministik dari teks (biar stabil antar render). */
export function warnaDariTeks(teks = '') {
  const palet = [
    'bg-primary-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-violet-500', 'bg-sky-500', 'bg-teal-500', 'bg-orange-500',
  ];
  let h = 0;
  for (let i = 0; i < teks.length; i += 1) h = (h * 31 + teks.charCodeAt(i)) >>> 0;
  return palet[h % palet.length];
}

export function formatByte(byte = 0) {
  if (!byte) return '0 B';
  const unit = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(byte) / Math.log(1024)), unit.length - 1);
  return `${(byte / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${unit[i]}`;
}

export function slugify(teks = '') {
  return String(teks)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function maskNis(nis = '') {
  const s = String(nis);
  if (s.length < 8) return s;
  return `${s.slice(0, 4)}••${s.slice(-2)}`;
}

export function sleep(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}

export function arrayBufferKeBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Parser CSV sederhana tapi benar:
 * - mendukung tanda kutip ganda ("..."), kutip di dalam kutip (""),
 *   koma di dalam kutip, dan newline di dalam kutip
 * - mendukung delimiter , ; dan TAB
 * - mendeteksi & membuang BOM
 */
export function parseCsv(teks, opts = {}) {
  const delimiter = opts.delimiter || deteksiDelimiter(teks);
  const src = String(teks || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      if (src[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // buang baris kosong / baris yang seluruh selnya kosong
  const bersih = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c !== ''));

  if (!bersih.length) return { header: [], rows: [] };

  const header = bersih[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  return { header, rows: bersih.slice(1) };
}

function deteksiDelimiter(teks = '') {
  const baris = String(teks).split(/\r?\n/).find((l) => l.trim() !== '') || '';
  const kandidat = [
    { d: ',', n: baris.split(',').length },
    { d: ';', n: baris.split(';').length },
    { d: '\t', n: baris.split('\t').length },
  ];
  kandidat.sort((a, b) => b.n - a.n);
  return kandidat[0].n > 1 ? kandidat[0].d : ',';
}

/** Ubah array objek -> string CSV (untuk unduh template). */
export function toCsv(header, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.map(esc).join(','), ...rows.map((r) => header.map((h) => esc(r[h])).join(','))].join('\n');
}
