'use client';

import type { ComponentType } from 'react';
import { Clock, MoreHorizontal, Sparkles } from 'lucide-react';
import type { SetupTone } from '../../payroll/employee-salary-setup/salary-setup-ui';
import { setupToneStyles } from '../../payroll/employee-salary-setup/salary-setup-ui';

export function TimePageIcon() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2563EB] text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)]">
      <Clock className="h-6 w-6" />
    </span>
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

export function RowActionsButton() {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
      aria-label="Row actions"
    >
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}

const attendanceTone = (value: string): SetupTone => {
  const text = value.toLowerCase();
  if (text.includes('present') || text.includes('remote')) return 'green';
  if (text.includes('late')) return 'amber';
  if (text.includes('leave')) return 'blue';
  if (text.includes('absent') || text.includes('not captured')) return 'red';
  return 'slate';
};

const workflowTone = (value: string): SetupTone => {
  const text = value.toLowerCase();
  if (text.includes('ready') || text.includes('posted') || text.includes('approved')) return 'green';
  if (text.includes('pending') || text.includes('review') || text.includes('submitted')) return 'amber';
  if (text.includes('reject') || text.includes('block')) return 'red';
  return 'blue';
};

export function TimeStatusBadge({ label, kind = 'attendance' }: { label: string; kind?: 'attendance' | 'workflow' | 'payroll' }) {
  const tone = kind === 'attendance' ? attendanceTone(label) : kind === 'payroll' ? workflowTone(label) : workflowTone(label);
  const styles = setupToneStyles[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles.chip}`}>{label}</span>;
}

export function TimeTrackingWorkflow({
  stages,
  overallPct,
}: {
  stages: Array<{ id: string; label: string; pct: number; count: string; owner: string; status: 'completed' | 'waiting' | 'pending' }>;
  overallPct: number;
}) {
  const nodeColor = (status: string, pct: number) => {
    if (status === 'completed' || pct >= 100) return 'bg-[#10B981] border-[#A7F3D0]';
    if (status === 'waiting' || pct >= 40) return 'bg-[#F59E0B] border-[#FCD34D]';
    return 'bg-[#CBD5E1] border-[#E5E7EB]';
  };

  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">Workflow Timeline</h3>
          <p className="text-xs text-[#64748B]">Time capture through payroll posting pipeline</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Overall Completion</p>
          <p className="text-2xl font-bold text-[#2563EB]">{overallPct.toFixed(1)}%</p>
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[920px] items-start">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex flex-1 items-start">
              <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[10px] font-bold text-white ${nodeColor(stage.status, stage.pct)}`}>
                  {stage.pct >= 100 ? '✓' : `${stage.pct}%`}
                </span>
                <p className="mt-2 text-xs font-semibold text-[#0F172A]">{stage.label}</p>
                <p className="mt-0.5 text-[10px] font-medium text-[#64748B]">{stage.count}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#94A3B8]">{stage.owner}</p>
              </div>
              {index < stages.length - 1 ? <div className="mt-5 h-0.5 w-full min-w-[12px] flex-1 bg-[#E5E7EB]" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LiveWorkforceStatus({
  items,
}: {
  items: Array<{ label: string; count: number; pct: number; tone: SetupTone }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <h3 className="text-base font-semibold text-[#0F172A]">Live Workforce Status</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const styles = setupToneStyles[item.tone];
          return (
            <div key={item.label} className="rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: styles.accent }} />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{item.label}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-[#0F172A]">{item.count}</p>
              <p className="text-xs font-medium text-[#64748B]">{item.pct}% of workforce</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AiOperationsCenter({
  items,
}: {
  items: Array<{ label: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low' }>;
}) {
  const severityStyles = {
    critical: 'bg-red-50 text-red-800 border-red-200',
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    low: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#7C3AED]" />
          <h3 className="text-base font-semibold text-[#0F172A]">AI Operations Center</h3>
        </div>
        <span className="rounded-full bg-[#EF4444] px-2 py-0.5 text-[10px] font-bold text-white">
          {items.reduce((sum, item) => sum + item.count, 0)}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5">
            <span className="min-w-0 flex-1 text-xs font-medium text-[#475569]">{item.label}</span>
            <span className="shrink-0 text-sm font-bold text-[#0F172A]">{item.count}</span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${severityStyles[item.severity]}`}>
              {item.severity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AttendanceSourceStatus({
  items,
}: {
  items: Array<{ label: string; status: string; tone: SetupTone }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <h3 className="text-base font-semibold text-[#0F172A]">Attendance Source Status</h3>
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const styles = setupToneStyles[item.tone];
          return (
            <li key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#EDF2F7] bg-[#F8FAFC] px-3 py-2.5">
              <span className="text-sm font-medium text-[#475569]">{item.label}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles.chip}`}>{item.status}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WorkforceUtilizationPanel({
  utilizationPct,
  metrics,
}: {
  utilizationPct: number;
  metrics: Array<{ label: string; value: string }>;
}) {
  const circumference = 2 * Math.PI * 42;
  const dash = (utilizationPct / 100) * circumference;
  const tone = utilizationPct >= 80 ? '#10B981' : utilizationPct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <h3 className="text-base font-semibold text-[#0F172A]">Workforce Utilization</h3>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-28 w-28 shrink-0">
          <svg width={112} height={112} className="-rotate-90">
            <circle cx={56} cy={56} r={42} fill="none" stroke="#E5E7EB" strokeWidth="10" />
            <circle cx={56} cy={56} r={42} fill="none" stroke={tone} strokeWidth="10" strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-[#0F172A]">{utilizationPct}%</span>
            <span className="text-[10px] font-semibold text-[#64748B]">Utilization</span>
          </div>
        </div>
        <ul className="grid flex-1 grid-cols-2 gap-2 text-xs">
          {metrics.map((item) => (
            <li key={item.label} className="rounded-lg border border-[#EDF2F7] bg-[#F8FAFC] px-3 py-2">
              <p className="font-semibold text-[#94A3B8]">{item.label}</p>
              <p className="mt-0.5 font-bold text-[#0F172A]">{item.value}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BulkActionToolbar({
  selectedCount,
  onAction,
  busy,
}: {
  selectedCount: number;
  onAction: (action: string) => void;
  busy?: string;
}) {
  if (!selectedCount) return null;
  const actions = [
    { id: 'validate', label: 'Validate', className: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]' },
    { id: 'approve', label: 'Approve', className: 'bg-[#10B981] text-white hover:bg-[#059669]' },
    { id: 'correct', label: 'Correct Time', className: 'bg-[#F97316] text-white hover:bg-[#EA580C]' },
    { id: 'assign-project', label: 'Assign Project', className: 'bg-[#7C3AED] text-white hover:bg-[#6D28D9]' },
    { id: 'assign-cost', label: 'Assign Cost Centre', className: 'border border-[#2563EB] bg-white text-[#2563EB] hover:bg-[#EFF6FF]' },
    { id: 'payroll', label: 'Generate Payroll', className: 'bg-[#0F172A] text-white hover:bg-[#1E293B]' },
  ];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#93C5FD] bg-[#EFF6FF] px-4 py-3">
      <span className="text-sm font-semibold text-[#1D4ED8]">{selectedCount} selected</span>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onAction(action.id)}
          className={`inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold disabled:opacity-50 ${action.className}`}
        >
          {busy === action.id ? 'Processing…' : action.label}
        </button>
      ))}
    </div>
  );
}

export function ExceptionCountBadge({ count }: { count: number }) {
  if (!count) return <span className="text-xs text-[#94A3B8]">—</span>;
  return (
    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#FEF2F2] px-1.5 text-[11px] font-bold text-[#B91C1C] ring-1 ring-[#FECACA]">
      {count}
    </span>
  );
}

export function TimeKpiStrip({
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
      {items.map((item) => {
        const styles = setupToneStyles[item.tone];
        return (
          <article
            key={item.label}
            className={`group flex min-h-[148px] flex-col rounded-[18px] border p-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${styles.card}`}
            style={{ borderTopWidth: 4, borderTopColor: styles.accent }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[#64748B]">{item.label}</p>
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}>
                <item.icon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 truncate text-[32px] font-bold leading-none text-[#0F172A]">{item.value}</p>
            <p className="mt-auto pt-3 text-xs font-medium text-[#64748B]">{item.subtitle}</p>
          </article>
        );
      })}
    </div>
  );
}
