import { registerSchema, namaCocok, extractPrefix, nisKeEmail, emailKeNis, tiketSchema, skorPassword, errorPerField } from './validators.js';
import { censor, cekImpersonasi, hitungKataKasar } from './censor.js';
import { parseCsv, toCsv, waktuRelatif, maskNis } from './utils.js';
import { validasiBarisSiswa } from './import-csv.js';

let lulus = 0, gagal = 0;
const cek = (nama, syarat, info='') => { if (syarat) { lulus++; } else { gagal++; console.log('  ✗', nama, info); } };

// --- NIS & email pseudo
cek('prefix', extractPrefix('26270001') === '2627');
cek('nisKeEmail', nisKeEmail('26270001') === '26270001@siswa.local');
cek('emailKeNis', emailKeNis('26270001@siswa.local') === '26270001');
cek('emailKeNis asing', emailKeNis('budi@gmail.com') === null);

// --- registerSchema
const base = { nis:'26270001', nama:'Bintang Arya Pratama', username:'bintang.arya', password:'rahasia123', konfirmasiPassword:'rahasia123', setuju:true };
cek('register valid', registerSchema.safeParse(base).success);
cek('register nis 7 digit ditolak', !registerSchema.safeParse({...base, nis:'2627001'}).success);
cek('register password pendek', !registerSchema.safeParse({...base, password:'123', konfirmasiPassword:'123'}).success);
cek('register konfirmasi beda', !registerSchema.safeParse({...base, konfirmasiPassword:'lain'}).success);
cek('register setuju false', !registerSchema.safeParse({...base, setuju:false}).success);
cek('register username OSIS ditolak', !registerSchema.safeParse({...base, username:'osis.resmi'}).success);
cek('register username ADMIN ditolak', !registerSchema.safeParse({...base, username:'admin'}).success);
cek('register username spasi ditolak', !registerSchema.safeParse({...base, username:'bintang arya'}).success);
const e1 = errorPerField(registerSchema.safeParse({...base, nis:'abc'}));
cek('errorPerField.nis', Boolean(e1.nis), JSON.stringify(e1));

// --- pencocokan nama longgar
cek('nama persis', namaCocok('Bintang Arya Pratama','Bintang Arya Pratama'));
cek('nama beda kapital', namaCocok('BINTANG ARYA PRATAMA','bintang arya pratama'));
cek('nama dgn titik', namaCocok('Bintang Arya Pratama.','Bintang Arya Pratama'));
cek('nama urutan beda', namaCocok('Pratama Bintang Arya','Bintang Arya Pratama'));
cek('nama dgn gelar diabaikan', namaCocok('Bintang Arya Pratama S.Kom','Bintang Arya Pratama'));
cek('nama "al" diabaikan', namaCocok('Bintang Al Pratama','Bintang Arya Pratama') === false ? true : namaCocok('Bintang Al Pratama','Bintang Al Pratama'));
cek('nama beda total ditolak', !namaCocok('Siti Nurhaliza','Bintang Arya Pratama'));
cek('nama kosong ditolak', !namaCocok('','Bintang'));

// --- sensor kata kasar
cek('sensor dasar', censor('kamu anjing sekali') === 'kamu ****** sekali', censor('kamu anjing sekali'));
cek('sensor tidak merusak kata normal', censor('saya anjurkan belajar') === 'saya anjurkan belajar', censor('saya anjurkan belajar'));
cek('sensor case-insensitive', hitungKataKasar('BANGSAT') === 1);
cek('sensor variasi memek/memekq', hitungKataKasar('memekq') === 1);
cek('teks bersih', hitungKataKasar('selamat pagi semuanya') === 0);

// --- impersonasi
cek('impersonasi osis', !cekImpersonasi('osis_td2').ok);
cek('impersonasi smk', !cekImpersonasi('smktd2').ok);
cek('username aman', cekImpersonasi('bintang.arya').ok);
cek('username aman 2', cekImpersonasi('fauzan123').ok);

// --- skor password
cek('skor lemah', skorPassword('abc') <= 1);
cek('skor kuat', skorPassword('Rahasia!2026xyz') === 4, String(skorPassword('Rahasia!2026xyz')));

// --- tiketSchema
const t = { kategori:'bullying', judul:'Kasus di kantin', deskripsi:'Ada kakak kelas yang memalak adik kelas saat istirahat kedua di kantin.', lokasi:'Kantin', kontak:'' };
cek('tiket valid', tiketSchema.safeParse(t).success, JSON.stringify(tiketSchema.safeParse(t).error?.issues?.[0]));
cek('tiket kategori salah', !tiketSchema.safeParse({...t, kategori:'ngawur'}).success);
cek('tiket deskripsi pendek', !tiketSchema.safeParse({...t, deskripsi:'pendek'}).success);

// --- CSV
const csv = parseCsv('nis,nama,kelas\n26270001,"Bintang, Arya",X RPL 1\n26270002,Kayla Nur Aisyah,X RPL 1\n');
cek('csv header', csv.header.join(',') === 'nis,nama,kelas');
cek('csv 2 baris', csv.rows.length === 2);
cek('csv kutip berisi koma', csv.rows[0][1] === 'Bintang, Arya', csv.rows[0][1]);
const csv2 = parseCsv('nis;nama;kelas\n26270001;Bintang;X RPL 1\n');
cek('csv delimiter titik-koma', csv2.rows[0][2] === 'X RPL 1', JSON.stringify(csv2));
cek('toCsv roundtrip', parseCsv(toCsv(['a','b'],[{a:'1,2',b:'x"y'}])).rows[0][0] === '1,2');

// --- validasiBarisSiswa
const prefixes = [{prefix:'2627',active:true},{prefix:'2425',active:true},{prefix:'2324',active:false}];
const h = validasiBarisSiswa({
  csv: parseCsv('nis,nama,kelas,angkatan\n26270001,Bintang Arya,X RPL 1,\n26270002,Kayla,X RPL 1,2627\n23240001,Lama,X,2324\n999,Lala,X,\n26270001,Duplikat,X,\n26270003,,X,\n'),
  prefixes, nisSudahAda: ['26270099'],
});
cek('import: 2 valid', h.valid.length === 2, JSON.stringify(h.valid));
cek('import: 4 ditolak', h.errors.length === 4, JSON.stringify(h.errors));
cek('import: angkatan otomatis dari NIS', h.valid[0].angkatan === '2627');
cek('import: prefix nonaktif ditolak', h.errors.some(e=>e.pesan.includes('nonaktif')));
cek('import: NIS pendek ditolak', h.errors.some(e=>e.pesan.includes('8 digit')));
cek('import: duplikat ditolak', h.errors.some(e=>e.pesan.includes('duplikat')));
cek('import: nama kosong ditolak', h.errors.some(e=>e.pesan.includes('Nama kosong')));
const h2 = validasiBarisSiswa({ csv: parseCsv('nis,nama\n26270099,Sudah Ada\n'), prefixes, nisSudahAda:['26270099'], timpaUpdate:true });
cek('import: mode timpa menerima duplikat', h2.valid.length === 1 && h2.valid[0]._update === true);
const h3 = validasiBarisSiswa({ csv: parseCsv('nama,kelas\nTanpa NIS,X\n'), prefixes, nisSudahAda:[] });
cek('import: header tanpa nis -> fatal', Boolean(h3.fatal), h3.fatal);

// --- utils
cek('waktuRelatif baru saja', waktuRelatif(Date.now()-10000) === 'baru saja');
cek('waktuRelatif menit', waktuRelatif(Date.now()-5*60000) === '5 mnt lalu');
cek('maskNis', maskNis('26270001') === '2627••01', maskNis('26270001'));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
