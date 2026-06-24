'use client';

import { useState } from 'react';
import { initialsFor } from '@/app/(hris)/hris/employees/employee-directory/directory-shared';

export const employeePhotoUrl = (employeeCode: string) => `/api/hris/employees/${encodeURIComponent(employeeCode)}/photo`;

export const resolveEmployeePhotoUrl = (input: {
  employeeCode?: string;
  employeeId?: string;
  photoUrl?: string;
  hasPhoto?: boolean;
  tryPhoto?: boolean;
}) => {
  if (input.photoUrl) return input.photoUrl;
  const code = input.employeeCode || input.employeeId;
  if (!code) return undefined;
  if (input.hasPhoto || input.tryPhoto) return employeePhotoUrl(code);
  return undefined;
};

const sizeClasses = {
  xs: 'h-8 w-8 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
} as const;

export default function EmployeeAvatar({
  fullName,
  employeeCode,
  employeeId,
  photoUrl,
  hasPhoto,
  tryPhoto = false,
  size = 'md',
  className = '',
}: {
  fullName: string;
  employeeCode?: string;
  employeeId?: string;
  photoUrl?: string;
  hasPhoto?: boolean;
  tryPhoto?: boolean;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = failed ? undefined : resolveEmployeePhotoUrl({ employeeCode, employeeId, photoUrl, hasPhoto, tryPhoto });
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={fullName}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${sizeClass} ${className}`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-white font-bold text-slate-700 ring-2 ring-white ${sizeClass} ${className}`}>
      {initialsFor(fullName)}
    </div>
  );
}
