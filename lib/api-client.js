/**
 * Helper pemanggilan API dari browser.
 * Selalu menyertakan header Authorization dari session Supabase,
 * lalu menerjemahkan respons jadi { ok, data, status, message }.
 */
'use client';

import { getSupabaseBrowser } from './supabase/client';

export async function apiToken() {
  const { data } = await getSupabaseBrowser().auth.getSession();
  return data?.session?.access_token || '';
}

export async function api(path, { method = 'GET', body, formData, auth = true } = {}) {
  const headers = {};
  let payload;

  if (formData) {
    payload = formData; // browser otomatis set multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (auth) headers.Authorization = `Bearer ${await apiToken()}`;

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: 'Tidak ada koneksi internet. Periksa jaringanmu lalu coba lagi.',
      error: e?.message,
    };
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      data,
      message: data?.message || data?.error || `Gagal (${res.status})`,
      errors: data?.errors || null,
      kode: data?.kode || null,
    };
  }

  return { ok: true, status: res.status, data, message: data?.message || null };
}

export const apiGet = (p, o) => api(p, { ...o, method: 'GET' });
export const apiPost = (p, body, o) => api(p, { ...o, method: 'POST', body });
export const apiPatch = (p, body, o) => api(p, { ...o, method: 'PATCH', body });
export const apiDelete = (p, o) => api(p, { ...o, method: 'DELETE' });
