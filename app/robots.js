import { APP } from '@/lib/constants';

/** robots.txt - halaman admin & API tidak boleh diindeks mesin pencari. */
export default function robots() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/lapor/', '/post/', '/profil', '/offline'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
