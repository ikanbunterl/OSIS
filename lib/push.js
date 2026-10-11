/**
 * Web Push (VAPID) - kirim notifikasi ke perangkat siswa.
 * Jalan hanya kalau NEXT_PUBLIC_VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY diisi.
 * Kalau belum diisi, fungsi kirimPush() tetap "sukses" tapi tidak mengirim apa pun,
 * sehingga aplikasi tidak error di environment yang belum di-setup.
 */
import 'server-only';
import webpush from 'web-push';
import { serviceClient, catatAudit } from './supabase/server';

let siap = null;

export function pushSiap() {
  if (siap !== null) return siap;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    siap = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:osis@smktridharma2bogor.sch.id',
    pub,
    priv,
  );
  siap = true;
  return true;
}

/** Simpan / perbarui subscription milik user. */
export async function simpanSubscription(userId, sub, userAgent = '') {
  const { error } = await serviceClient().from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
      user_agent: String(userAgent || '').slice(0, 300),
    },
    { onConflict: 'endpoint' },
  );
  return { error };
}

export async function hapusSubscription(endpoint) {
  const { error } = await serviceClient()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);
  return { error };
}

export async function hapusSubscriptionUser(userId) {
  const { error } = await serviceClient()
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);
  return { error };
}

/**
 * Kirim push ke sekelompok user.
 * @param {Object} opts
 * @param {string[]} [opts.userIds]  target spesifik
 * @param {string[]} [opts.roles]    mis. ['siswa','osis']
 * @param {boolean}  [opts.semua]    broadcast ke semua
 * @param {string}   opts.title
 * @param {string}   opts.body
 * @param {string}   [opts.url]      halaman yang dibuka saat notif diklik
 * @param {string}   [opts.tag]
 */
export async function kirimPush(opts = {}) {
  if (!pushSiap()) {
    return { dikirim: 0, dilewati: 0, alasan: 'VAPID belum dikonfigurasi' };
  }

  const db = serviceClient();
  let query = db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');

  if (Array.isArray(opts.userIds) && opts.userIds.length) {
    query = query.in('user_id', opts.userIds);
  } else if (Array.isArray(opts.roles) && opts.roles.length) {
    const { data: profil } = await db.from('profiles').select('id').in('role', opts.roles);
    const ids = (profil || []).map((p) => p.id);
    if (!ids.length) return { dikirim: 0, dilewati: 0, alasan: 'tidak ada target' };
    query = query.in('user_id', ids);
  } else if (!opts.semua) {
    return { dikirim: 0, dilewati: 0, alasan: 'target tidak ditentukan' };
  }

  const { data: subs, error } = await query.limit(1000);
  if (error) return { dikirim: 0, dilewati: 0, alasan: error.message };
  if (!subs?.length) return { dikirim: 0, dilewati: 0, alasan: 'belum ada langganan push' };

  const payload = JSON.stringify({
    title: opts.title || 'OSIS TD2',
    body: opts.body || '',
    url: opts.url || '/home',
    tag: opts.tag || undefined,
    icon: '/icons/192.png',
    badge: '/icons/192.png',
  });

  const hasil = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      ),
    ),
  );

  let dikirim = 0;
  const endpointMati = [];
  hasil.forEach((h, i) => {
    if (h.status === 'fulfilled') dikirim += 1;
    else {
      const code = h.reason?.statusCode;
      if (code === 404 || code === 410) endpointMati.push(subs[i].endpoint);
    }
  });

  if (endpointMati.length) {
    await db.from('push_subscriptions').delete().in('endpoint', endpointMati);
  }

  return { dikirim, dilewati: subs.length - dikirim, total: subs.length };
}

export async function kirimPushBalasanTiket(ticket, pengirimNama = 'Admin OSIS') {
  if (!ticket?.author_id) return { dikirim: 0, dilewati: 0 };
  const hasil = await kirimPush({
    userIds: [ticket.author_id],
    title: `Balasan laporan ${ticket.kode_tiket || ''}`.trim(),
    body: `${pengirimNama} membalas laporanmu. Ketuk untuk membaca.`,
    url: `/lapor/${ticket.kode_tiket}`,
    tag: `tiket-${ticket.id}`,
  });
  await catatAudit(null, 'push.ticket_reply', ticket.id, {
    kode: ticket.kode_tiket,
    ...hasil,
  });
  return hasil;
}
