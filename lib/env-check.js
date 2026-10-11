/**
 * Jawaban standar saat env Supabase belum diisi.
 * Dibikin ramah supaya developer langsung tahu apa yang harus dilakukan,
 * bukan cuma dapat error 500 misterius.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { envServerSiap, PANDUAN_ENV as PANDUAN } from './supabase/server';

export function belumDikonfigurasi() {
  return !envServerSiap();
}

export function responsBelumDikonfigurasi() {
  return NextResponse.json(
    { ok: false, message: PANDUAN, kode: 'ENV_BELUM_DIISI' },
    { status: 503 },
  );
}

export { PANDUAN };
