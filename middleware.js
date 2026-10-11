import { NextResponse } from 'next/server';

/**
 * Middleware - auth guard ringan (PLAN Bagian 2).
 *
 * PENTING: ini hanya penghalang UX. Keamanan sesungguhnya ada di
 * Row Level Security Supabase + API routes (yang memakai service role
 * dan memeriksa role sendiri). Cookie Supabase bisa saja kedaluwarsa
 * padahal session masih valid, jadi jangan pernah mengandalkan
 * middleware sebagai satu-satunya penjaga.
 */

const COOKIE_PREFIXES = ['sb-'];

function adaCookieAuth(req) {
  const nama = req.cookies.getAll().map((c) => c.name);
  return nama.some((n) => COOKIE_PREFIXES.some((p) => n.startsWith(p)) && n.includes('auth-token'));
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // halaman yang selalu terbuka
  const publik = [
    '/login',
    '/register',
    '/offline',
    '/manifest',
    '/sw.js',
    '/logo.svg',
    '/favicon.ico',
  ];
  if (publik.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/icons/') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const login = adaCookieAuth(req);

  // /admin butuh login (cek role dilakukan di AuthGate + API)
  if (pathname.startsWith('/admin') && !login) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // lacak tiket boleh tanpa login
  if (/^\/lapor\/[A-Za-z0-9-]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // halaman siswa butuh login
  const butuhLogin = ['/home', '/chat', '/talent', '/aspirasi', '/lapor', '/profil', '/post'];
  if (butuhLogin.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !login) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // sudah login tapi masih di /login -> lempar ke home
  if ((pathname === '/login' || pathname === '/register') && login) {
    const url = req.nextUrl.clone();
    url.pathname = '/home';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // jalankan di semua path kecuali aset statis & API
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|logo.svg|sw.js|api/).*)'],
};
