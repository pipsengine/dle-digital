'use client';

import type { ComponentType } from 'react';
import type { SetupTone } from '../employee-salary-setup/salary-setup-ui';
import { setupToneStyles } from '../employee-salary-setup/salary-setup-ui';

export function OvertimeApprovalWorkflow({
  stages,
  ribbon,
}: {
  stages: Array<{
    id: string;
    label: string;
    count: number;
    owner: string;
    status: 'completed' | 'waiting' | 'pending';
    duration?: string;
  }>;
  ribbon: { slaBreaches: number; avgTime: string; longestWaiting: string; estimatedCompletion: string; escalations: number };
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#0F172A]">Overtime Approval Workflow</h3>
        <p className="text-xs text-[#64748B]">Timesheet submission through payroll posting pipeline</p>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[960px] items-start gap-0">
          {stages.map((stage, index) => {
            const statusColor =
              stage.status === 'completed'
                ? 'bg-emerald-500 border-emerald-200'
                : stage.status === 'waiting'
                  ? 'bg-amber-400 border-amber-200'
                  : 'bg-slate-200 border-slate-300';
            return (
              <div key={stage.id} className="flex flex-1 items-start">
                <div className="flex min-w-0 flex-1 flex-col items-center px-1 text-center">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold text-white ${statusColor}`}>
                    {stage.count}
                  </span>
                  <p className="mt-2 text-xs font-semibold text-[#0F172A]">{stage.label}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#64748B]">{stage.owner}</p>
                  {stage.duration ? <p className="mt-1 text-[10px] font-medium text-[#94A3B8]">{stage.duration}</p> : null}
                </div>
                {index < stages.length - 1 ? <div className="mt-5 h-0.5 w-full min-w-[12px] flex-1 bg-[#E5E7EB]" /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-xs md:grid-cols-5">
        <div>
          <span className="font-semibold text-[#94A3B8]">SLA BREACHES</span>
          <p className="font-bold text-red-600">{ribbon.slaBreaches}</p>
        </div>
        <div>
          <span className="font-semibold text-[#94A3B8]">AVG. APPROVAL TIME</span>
          <p className="font-bold text-[#0F172A]">{ribbon.avgTime}</p>
        </div>
        <div>
          <span className="font-semibold text-[#94A3B8]">LONGEST WAITING</span>
          <p className="font-bold text-[#0F172A]">{ribbon.longestWaiting}</p>
        </div>
        <div>
          <span className="font-semibold text-[#94A3B8]">EST. COMPLETION</span>
          <p className="font-bold text-[#2563EB]">{ribbon.estimatedCompletion}</p>
        </div>
        <div>
          <span className="font-semibold text-[#94A3B8]">ESCALATIONS</span>
          <p className="font-bold text-amber-600">{ribbon.escalations}</p>
        </div>
      </div>
    </div>
  );
}

export function AiOvertimeInsights({
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
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm xl:sticky xl:top-24">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#0F172A]">AI Overtime Insights</h3>
        <button type="button" className="text-xs font-semibold text-[#2563EB] hover:underline">
          View All
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5"
          >
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

export function OvertimeValidationCenter({
  items,
}: {
  items: Array<{ label: string; count: number; tone: SetupTone }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#0F172A]">AI Validation Engine</h3>
      <p className="mt-1 text-xs text-[#64748B]">Policy, attendance, and payroll conflict detection</p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const styles = setupToneStyles[item.tone];
          return (
            <li key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-2.5">
              <span className="text-xs font-medium text-[#475569]">{item.label}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${styles.chip}`}>{item.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BudgetUtilizationGauge({ utilized, budget, label }: { utilized: number; budget: number; label: string }) {
  const pct = budget > 0 ? Math.min(100, Math.round((utilized / budget) * 100)) : 0;
  const tone = pct >= 90 ? '#EF4444' : pct >= 75 ? '#F59E0B' : '#10B981';
  const circumference = 2 * Math.PI * 42;
  const dash = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-28 w-28 shrink-0">
        <svg width={112} height={112} className="-rotate-90">
          <circle cx={56} cy={56} r={42} fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle
            cx={56}
            cy={56}
            r={42}
            fill="none"
            stroke={tone}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-[#0F172A]">{pct}%</span>
          <span className="text-[10px] font-semibold text-[#64748B]">Utilized</span>
        </div>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
        <p className="mt-1 text-xs text-[#64748B]">
          Budget: <span className="font-semibold text-[#0F172A]">{budget.toLocaleString('en-NG')}</span>
        </p>
        <p className="text-xs text-[#64748B]">
          Used: <span className="font-semibold text-[#0F172A]">{utilized.toLocaleString('en-NG')}</span>
        </p>
      </div>
    </div>
  );
}

export function TopOvertimeEmployees({
  rows,
  formatValue,
}: {
  rows: Array<{ name: string; code: string; hours: number; value: number }>;
  formatValue: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.code}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-[10px] font-bold text-[#2563EB]">
                {index + 1}
              </span>
              <span className="truncate font-medium text-[#0F172A]">{row.name}</span>
            </span>
            <span className="shrink-0 font-semibold text-[#475569]">{formatValue(row.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#2563EB]" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <p className="mt-0.5 text-[10px] text-[#94A3B8]">
            {row.code} · {row.hours.toFixed(1)} hrs
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { label: string; icon: ComponentType<{ className?: string }> };
}) {
  const ActionIcon = action?.icon;
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
        {action && ActionIcon ? (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
            <ActionIcon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function MiniKpiTile({ label, value, tone }: { label: string; value: string; tone: SetupTone }) {
  const styles = setupToneStyles[tone];
  return (
    <div className={`rounded-xl border p-3 ${styles.card}`} style={{ borderTopWidth: 3, borderTopColor: styles.accent }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  );
}
