'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pengganti TanStack Query yang super-ringan (keputusan: stack ringan, full JS).
 *
 * @param {Function} fn       () => Promise<data>
 * @param {Object}   opts     { deps: [], awal: null, tunda: false }
 * @returns {{data, loading, error, refresh, setData}}
 */
export function useQuery(fn, { deps = [], awal = null, tunda = false } = {}) {
  const [data, setData] = useState(awal);
  const [loading, setLoading] = useState(!tunda && !awal);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const idRef = useRef(0);

  const jalankan = useCallback(async () => {
    const id = ++idRef.current;
    setLoading(true);
    setError(null);
    try {
      const hasil = await fnRef.current();
      if (id === idRef.current) setData(hasil);
    } catch (e) {
      if (id === idRef.current) setError(e?.message || 'Gagal memuat data');
    } finally {
      if (id === idRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tunda) return;
    jalankan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refresh: jalankan, setData };
}

/** Fetch JSON sederhana dengan opsi tanpa cache. */
export async function ambilJson(url, opts = {}) {
  const res = await fetch(url, { cache: 'no-store', ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Gagal memuat (${res.status})`);
  return data;
}

/** Rate limit di sisi client (pelengkap server-side limit). */
export function buatPembatas(maks, jendelaMs) {
  const catatan = [];
  return function cek() {
    const now = Date.now();
    while (catatan.length && now - catatan[0] > jendelaMs) catatan.shift();
    if (catatan.length >= maks) {
      const tunggu = Math.ceil((jendelaMs - (now - catatan[0])) / 1000);
      return { ok: false, tunggu };
    }
    catatan.push(now);
    return { ok: true };
  };
}
