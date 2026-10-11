import AdminShell from './AdminShell';

export const metadata = { title: 'Dashboard Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Layout /admin - tanpa bottom nav siswa (PLAN Bagian 3).
 * Pakai navigasi admin sendiri + AuthGate role staff.
 */
export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
