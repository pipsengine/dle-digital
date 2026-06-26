'use client';

import type { SetupTone } from '../../payroll/employee-salary-setup/salary-setup-ui';
import { setupToneStyles } from '../../payroll/employee-salary-setup/salary-setup-ui';

export function WorkforceApprovalWorkflow({
  stages,
  ribbon,
}: {
  stages: Array<{
    id: string;
    label: string;
    count: number | string;
    owner: string;
    status: 'completed' | 'waiting' | 'pending';
    duration?: string;
  }>;
  ribbon: { slaBreaches: number; avgTime: string; longestWaiting: string; estimatedCompletion: string; escalations: number };
}) {
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#0F172A]">Approval Workflow</h3>
        <p className="text-xs text-[#64748B]">Attendance through payroll posting pipeline</p>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[920px] items-start gap-0">
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
                    {typeof stage.count === 'number' && stage.count > 999 ? `${Math.round(stage.count / 1000)}k` : stage.count}
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
        <div>
          <span className="font-semibold text-[#94A3B8]">ESCALATIONS</span>
          <p className="font-bold text-amber-600">{ribbon.escalations}</p>
        </div>
      </div>
    </div>
  );
}

export function AiWorkforceInsights({
  items,
  onExport,
  onAudit,
}: {
  items: Array<{ label: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low' }>;
  onExport?: () => void;
  onAudit?: () => void;
}) {
  const severityStyles = {
    critical: 'bg-red-50 text-red-800 border-red-200',
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm xl:sticky xl:top-24">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#0F172A]">AI Insights &amp; Exceptions</h3>
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
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={onExport} className="h-10 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC]">
          Export
        </button>
        <button type="button" onClick={onAudit} className="h-10 rounded-xl bg-[#2563EB] text-sm font-semibold text-white hover:bg-[#1D4ED8]">
          View Audit Trail
        </button>
      </div>
    </div>
  );
}

export function OperationalStatusGrid({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: SetupTone }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => {
        const tone = item.tone || 'slate';
        const styles = setupToneStyles[tone];
        return (
          <div key={item.label} className={`rounded-xl border p-3 ${styles.card}`} style={{ borderTopWidth: 3, borderTopColor: styles.accent }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{item.label}</p>
            <p className="mt-1 text-sm font-bold text-[#0F172A]">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}

export function ExceptionChips({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {labels.slice(0, 8).map((label) => (
        <span key={label} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
          {label}
        </span>
      ))}
    </div>
  );
}

export function WorkflowControlChips({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <span key={label} className="rounded-full border border-[#DBEAFE] bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#2563EB]">
          {label}
        </span>
      ))}
    </div>
  );
}
