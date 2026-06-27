'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Flame,
  LayoutGrid,
  MoreHorizontal,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { PremiumKpiCard, type SetupTone } from '../../payroll/employee-salary-setup/salary-setup-ui';

export type ShiftCellType = 'day' | 'evening' | 'night' | 'off' | 'leave' | 'holiday' | 'training';

export type ShiftCell = {
  type: ShiftCellType;
  start?: string;
  end?: string;
  label?: string;
};

export const shiftCellStyles: Record<
  ShiftCellType,
  { bg: string; border: string; text: string; defaultLabel: string }
> = {
  day: { bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8', defaultLabel: 'Day Shift' },
  evening: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', defaultLabel: 'Evening Shift' },
  night: { bg: '#F5F3FF', border: '#DDD6FE', text: '#7C3AED', defaultLabel: 'Night Shift' },
  off: { bg: '#F8FAFC', border: '#E5E7EB', text: '#94A3B8', defaultLabel: 'Off' },
  leave: { bg: '#FEF2F2', border: '#FECACA', text: '#B91C1C', defaultLabel: 'Annual Leave' },
  holiday: { bg: '#F0FDF4', border: '#BBF7D0', text: '#047857', defaultLabel: 'Holiday' },
  training: { bg: '#ECFEFF', border: '#A5F3FC', text: '#0891B2', defaultLabel: 'Training' },
};

export function ShiftPageIcon() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED] text-white shadow-[0_8px_20px_rgba(124,58,237,0.25)]">
      <CalendarDays className="h-6 w-6" />
    </span>
  );
}

export function ShiftKpiStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    subtitle: string;
    icon: ComponentType<{ className?: string }>;
    tone: SetupTone;
    trend?: number | null;
  }>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => (
        <PremiumKpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}

export function ShiftCard({ cell }: { cell: ShiftCell }) {
  const styles = shiftCellStyles[cell.type];
  const showTime = cell.type !== 'off' && cell.start && cell.end;
  return (
    <div
      className="rounded-xl border px-2 py-1.5 text-[11px] font-semibold leading-tight transition-shadow hover:shadow-sm"
      style={{ backgroundColor: styles.bg, borderColor: styles.border, color: styles.text }}
    >
      {showTime ? (
        <>
          <div>{cell.start} – {cell.end}</div>
          <div className="mt-0.5 text-[10px] font-medium opacity-90">{cell.label || styles.defaultLabel}</div>
        </>
      ) : (
        <div>{cell.label || styles.defaultLabel}</div>
      )}
    </div>
  );
}

export function EmployeeAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#2563EB]">
      {initials || '?'}
    </span>
  );
}

export function RowActionsButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
      aria-label="Row actions"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}

export function ShiftPanel({
  title,
  subtitle,
  children,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[18px] border border-[#E5E7EB] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.05)] ${className}`}>
      <div className="flex flex-col gap-2 border-b border-[#EDF2F7] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs font-medium text-[#64748B]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AiRecommendations({
  items,
}: {
  items: Array<{ label: string; count: number; tone: 'red' | 'amber' | 'blue' }>;
}) {
  const toneStyles = {
    red: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
    amber: 'bg-[#FFFBEB] text-[#B45309] border-[#FCD34D]',
    blue: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD]',
  };
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#7C3AED]" />
          <h3 className="text-base font-semibold text-[#0F172A]">AI Recommendations</h3>
        </div>
        <span className="rounded-full bg-[#EF4444] px-2 py-0.5 text-[10px] font-bold text-white">
          {items.reduce((sum, item) => sum + item.count, 0)}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium ${toneStyles[item.tone]}`}
          >
            <span className="min-w-0 flex-1">{item.label}</span>
            <span className="shrink-0 font-bold">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShiftActionsList({
  items,
}: {
  items: Array<{ label: string; icon: ComponentType<{ className?: string }>; badge?: number }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <h3 className="text-base font-semibold text-[#0F172A]">Shift Actions</h3>
      <ul className="mt-4 space-y-1">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC]"
            >
              <span className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-[#2563EB]" />
                {item.label}
              </span>
              {item.badge ? (
                <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>
              ) : (
                <ChevronRight className="h-4 w-4 text-[#CBD5E1]" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MobileRosterPreview() {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <h3 className="text-base font-semibold text-[#0F172A]">Mobile Roster Preview</h3>
      <div className="mt-4 flex flex-col items-center gap-4">
        <div className="relative h-40 w-24 rounded-[24px] border-4 border-[#0F172A] bg-[#F8FAFC] shadow-lg">
          <div className="absolute left-1/2 top-2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#0F172A]" />
          <div className="mx-2 mt-6 space-y-1.5">
            <div className="h-2 rounded bg-[#DBEAFE]" />
            <div className="h-2 rounded bg-[#FFF7ED]" />
            <div className="h-2 rounded bg-[#F8FAFC]" />
            <div className="h-2 rounded bg-[#DBEAFE]" />
          </div>
          <Smartphone className="absolute -right-3 -top-3 h-6 w-6 text-[#2563EB]" />
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
        >
          Open Mobile View
        </button>
      </div>
    </div>
  );
}

export function HolidaysTimeline({
  items,
}: {
  items: Array<{ date: string; label: string }>;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F3FF] text-[10px] font-bold text-[#7C3AED]">
            {item.date.slice(0, 2)}
          </span>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{item.label}</p>
            <p className="text-xs text-[#64748B]">{item.date}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SimpleLineChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const toY = (v: number) => 100 - ((v - min) / range) * 80 - 10;
  const toX = (i: number) => (values.length <= 1 ? 50 : (i / (values.length - 1)) * 100);
  const points = values.map((value, index) => `${toX(index)},${toY(value)}`).join(' ');
  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-40 w-full" preserveAspectRatio="none">
        <polyline fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" points={points} />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-[#64748B]">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

export const defaultShiftActionItems = [
  { label: 'Bulk Assign Shifts', icon: Users },
  { label: 'Employee Availability', icon: Clock },
  { label: 'Shift Swap Requests', icon: ArrowLeftRight, badge: 5 },
  { label: 'Time-off Requests', icon: CalendarDays, badge: 12 },
  { label: 'Coverage Heatmap', icon: Flame },
  { label: 'Shift Conflicts', icon: LayoutGrid, badge: 3 },
];
