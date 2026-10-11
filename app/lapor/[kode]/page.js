import LacakTiket from './LacakTiket';

export const metadata = { title: 'Lacak Laporan', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * /lapor/[kode]  —  halaman lacak tiket.
 *
 * SENGAJA berada di luar route group (main) supaya bisa dibuka TANPA LOGIN
 * (PLAN Bagian 6: "Halaman /lapor/[kode] bisa diakses tanpa auth, dengan rate limit").
 * Karena itu halaman ini tidak memakai bottom nav & AuthGate.
 */
export default async function LacakTiketPage({ params }) {
  const { kode } = await params;
  return <LacakTiket kode={kode} />;
}
