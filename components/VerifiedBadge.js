'use client';

import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { ROLES } from '@/lib/constants';
import { classNames } from '@/lib/utils';

/**
 * Centang emas untuk role OSIS / staff (PLAN Bagian 8).
 * Muncul otomatis kalau profiles.role = 'osis' (atau admin/pembina).
 */
export default function VerifiedBadge({ role, className, tampilkanLabel = false, ukuran = 'sm' }) {
  const info = ROLES[role] || ROLES.siswa;
  if (!info?.staff) return null;

  const Ikon = role === 'osis' ? BadgeCheck : ShieldCheck;
  const warna =
    role === 'osis'
      ? 'text-accent-500'
      : role === 'pembina' || role === 'super_admin'
        ? 'text-violet-500'
        : 'text-primary-500';

  return (
    <span
      className={classNames('inline-flex items-center gap-1 align-middle', className)}
      title={info.label}
      aria-label={`Terverifikasi sebagai ${info.label}`}
    >
      <Ikon
        className={classNames(warna, ukuran === 'sm' ? 'h-[15px] w-[15px]' : 'h-5 w-5')}
        aria-hidden="true"
      />
      {tampilkanLabel ? (
        <span className={classNames('font-bold', ukuran === 'sm' ? 'text-[11px]' : 'text-xs', warna)}>
          {info.label}
        </span>
      ) : (
        <span className="sr-only">{info.label}</span>
      )}
    </span>
  );
}
