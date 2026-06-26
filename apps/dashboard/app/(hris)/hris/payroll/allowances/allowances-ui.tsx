'use client';

import type { ComponentType } from 'react';
import type { SetupTone } from '../employee-salary-setup/salary-setup-ui';
import { setupToneStyles } from '../employee-salary-setup/salary-setup-ui';

export function AllowanceGovernanceWorkflow({
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
  ribbon: { slaBreaches: number; avgTime: string; longestWaiting: string; estimatedCompletion: string };
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#0F172A]">Allowance Governance Workflow</h3>
        <p className="text-xs text-[#64748B]">Definition, assignment, validation, and payroll posting pipeline</p>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[880px] items-start gap-0">
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
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-xs md:grid-cols-4">
        <div>
          <span className="font-semibold text-[#94A3B8]">SLA BREACHES</span>
          <p className="font-bold text-red-600">{ribbon.slaBreaches}</p>
        </div>
        <div>
          <span className="font-semibold text-[#94A3B8]">AVG. TIME AT STAGE</span>
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
      </div>
    </div>
  );
}

export function AiAllowanceInsights({
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
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#0F172A]">AI Compensation Insights</h3>
        <button type="button" className="text-xs font-semibold text-[#2563EB] hover:underline">
          View All
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5"
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

export function ValidationCenter({
  items,
}: {
  items: Array<{ label: string; count: number; tone: SetupTone }>;
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#0F172A]">Validation Center</h3>
      <p className="mt-1 text-xs text-[#64748B]">Policy, tax, and payroll readiness blockers</p>
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

export function TripleLineChart({
  labels,
  seriesA,
  seriesB,
  seriesC,
  nameA,
  nameB,
  nameC,
}: {
  labels: string[];
  seriesA: number[];
  seriesB: number[];
  seriesC: number[];
  nameA: string;
  nameB: string;
  nameC: string;
}) {
  const all = [...seriesA, ...seriesB, ...seriesC];
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const toY = (v: number) => 100 - ((v - min) / range) * 80 - 10;
  const toX = (i: number) => (labels.length <= 1 ? 50 : (i / (labels.length - 1)) * 100);
  const path = (series: number[]) => series.map((value, index) => `${toX(index)},${toY(value)}`).join(' ');

  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-44 w-full" preserveAspectRatio="none">
        <polyline fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" points={path(seriesA)} />
        <polyline fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" points={path(seriesB)} />
        <polyline fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" points={path(seriesC)} />
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-[#64748B]">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
          {nameA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
          {nameB}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" />
          {nameC}
        </span>
      </div>
    </div>
  );
}

export function GradeUtilizationDonut({
  underutilized,
  optimal,
  overutilized,
  noEmployees,
}: {
  underutilized: number;
  optimal: number;
  overutilized: number;
  noEmployees: number;
}) {
  const total = underutilized + optimal + overutilized + noEmployees;
  const rows = [
    { label: 'Underutilized', value: underutilized, color: '#F59E0B' },
    { label: 'Optimal', value: optimal, color: '#10B981' },
    { label: 'Overutilized', value: overutilized, color: '#EF4444' },
    { label: 'No Employees', value: noEmployees, color: '#94A3B8' },
  ];
  let acc = 0;
  const stops = rows
    .filter((row) => row.value > 0)
    .map((row) => {
      const start = acc;
      const pct = total ? (row.value / total) * 100 : 0;
      acc += pct;
      return `${row.color} ${start}% ${acc}%`;
    })
    .join(', ');

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops || '#e2e8f0 0% 100%'})` }}>
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <span className="text-lg font-bold text-[#0F172A]">{total}</span>
          <span className="text-[10px] font-semibold text-[#64748B]">Grades</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-medium text-[#64748B]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              {row.label}
            </span>
            <span className="font-semibold text-[#0F172A]">{row.value}</span>
          </div>
        ))}
      </div>
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
