import { APP } from '@/lib/constants';

/**
 * PWA manifest (PLAN Bagian 9).
 * Next.js App Router mengonversi file ini jadi /manifest secara otomatis,
 * jadi cukup export default sebuah objek (bukan route handler).
 */
export default function manifest() {
  return {
    name: APP.nama,
    short_name: APP.namaPendek,
    description: APP.deskripsi,
    id: '/',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#f8fafc',
    theme_color: '#0f172a',
    orientation: 'portrait',
    lang: 'id',
    dir: 'ltr',
    categories: ['education', 'social'],
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      {
        name: 'Buat Aspirasi',
        short_name: 'Aspirasi',
        description: 'Kirim pendapat anonim ke OSIS',
        url: '/aspirasi',
        icons: [{ src: '/icons/192.png', sizes: '192x192' }],
      },
      {
        name: 'Lapor',
        short_name: 'Lapor',
        description: 'Buat laporan rahasia',
        url: '/lapor',
        icons: [{ src: '/icons/192.png', sizes: '192x192' }],
      },
      {
        name: 'Chat',
        short_name: 'Chat',
        description: 'Buka ruang obrolan siswa',
        url: '/chat',
        icons: [{ src: '/icons/192.png', sizes: '192x192' }],
      },
    ],
  };
}
