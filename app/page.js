import { redirect } from 'next/navigation';

/**
 * Halaman depan: langsung lempar ke /home.
 * /home sendiri yang memutuskan apakah perlu login (lewat AuthGate).
 */
export default function Index() {
  redirect('/home');
}
