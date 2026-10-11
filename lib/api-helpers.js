/**
 * Helper jawaban API route + util khusus server.
 */
import 'server-only';
import { NextResponse } from 'next/server';

export function ok(data = {}, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}
export function gagal(message, status = 400, extra = {}) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

/** Ubah hasil safeParse Zod jadi respons 422 + daftar error per field. */
export function gagalValidasi(result, status = 422) {
  const flat = result?.error?.flatten?.() || {};
  const errors = {};
  for (const [k, v] of Object.entries(flat.fieldErrors || {})) {
    if (v?.length) errors[k] = v[0];
  }
  const message =
    flat.formErrors?.[0] ||
    Object.values(errors)[0] ||
    result?.error?.issues?.[0]?.message ||
    'Data tidak valid';
  return NextResponse.json({ ok: false, message, errors }, { status });
}

export function bacaJson(req) {
  return req.json().catch(() => ({}));
}
