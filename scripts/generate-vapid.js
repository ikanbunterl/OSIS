#!/usr/bin/env node
/**
 * Generate pasangan kunci VAPID untuk Web Push.
 *   npm run vapid
 * Lalu salin hasilnya ke .env.local / Environment Variables Vercel.
 */
const crypto = require('crypto');

let webpush = null;
try {
  // eslint-disable-next-line global-require
  webpush = require('web-push');
} catch {
  webpush = null;
}

function dariWebpush() {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  return { publicKey, privateKey };
}

/** Fallback tanpa dependency: ECDH P-256 manual. */
function dariCrypto() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const privateKey = ecdh.getPrivateKey('base64url');
  const publicKey = ecdh.getPublicKey('base64url');
  return { publicKey, privateKey };
}

const keys = webpush ? dariWebpush() : dariCrypto();

console.log('\n=== VAPID KEYS (Web Push) ===\n');
console.log('# .env.local / Vercel Env');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:osis@smktridharma2bogor.sch.id');
console.log('\nCatatan:');
console.log('- NEXT_PUBLIC_VAPID_PUBLIC_KEY boleh terlihat publik (dipakai browser).');
console.log('- VAPID_PRIVATE_KEY RAHASIA, hanya di server.');
console.log('- Ganti kunci = semua langganan push lama harus daftar ulang.\n');
