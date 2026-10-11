import './globals.css';
import { Toaster } from '@/components/ui/Toast';
import RegisterSW from '@/components/RegisterSW';
import SetupBanner from '@/components/SetupBanner';
import { APP } from '@/lib/constants';

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: `${APP.namaPendek} — ${APP.nama}`,
    template: `%s · ${APP.namaPendek}`,
  },
  description: APP.deskripsi,
  applicationName: APP.namaPendek,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP.namaPendek,
    startupImage: [{ url: '/icons/512.png' }],
  },
  formatDetection: { telephone: false },
  keywords: ['OSIS', 'SMK Tri Dharma 2 Bogor', 'aspirasi siswa', 'lapor', 'forum siswa'],
  openGraph: {
    title: APP.nama,
    description: APP.deskripsi,
    type: 'website',
    locale: 'id_ID',
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#090c18' },
  ],
};

/**
 * Skrip tema dipasang SEBELUM React hydrate supaya tidak ada kedipan
 * (flash of wrong theme) saat user memakai dark mode.
 */
const skripTema = `(function(){try{var m=localStorage.getItem('osis-tema')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: skripTema }} />
        <link rel="apple-touch-icon" href="/icons/192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-dvh bg-surface text-ink">
        <SetupBanner />
        {/* pembatas lebar 480px: di HP penuh, di desktop jadi kolom tengah */}
        <div id="app-shell" className="mx-auto flex min-h-dvh w-full max-w-shell flex-col">
          {children}
        </div>
        <Toaster />
        <RegisterSW />
      </body>
    </html>
  );
}
