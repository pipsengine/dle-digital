'use client';

import type { SetupTone } from '../employee-salary-setup/salary-setup-ui';
import { setupToneStyles } from '../employee-salary-setup/salary-setup-ui';

export function DailyPayWorkflow({
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
        <h3 className="text-base font-semibold text-[#0F172A]">Daily Pay Workflow</h3>
        <p className="text-xs text-[#64748B]">Timesheet capture through finance posting</p>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[900px] items-start gap-0">
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

export function AiDailyPayValidation({
  items,
}: {
  items: Array<{ label: string; count: number; severity: 'critical' | 'high' | 'medium' | 'low' }>;
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
        <h3 className="text-base font-semibold text-[#0F172A]">AI Validation &amp; Insights</h3>
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

export function ReadinessGauge({
  score,
  readyDays,
  issuesFound,
  blockingIssues,
}: {
  score: number;
  readyDays: number;
  issuesFound: number;
  blockingIssues: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone = clamped >= 80 ? '#10B981' : clamped >= 50 ? '#F59E0B' : '#EF4444';
  const size = 100;
  const circumference = 2 * Math.PI * (size / 2 - 8);
  const dash = (clamped / 100) * circumference;

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
      <p className="text-sm font-semibold text-[#0F172A]">Readiness</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={size / 2 - 8} fill="none" stroke="#E5E7EB" strokeWidth="8" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 8}
              fill="none"
              stroke={tone}
              strokeWidth="8"
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-[#0F172A]">{Math.round(clamped)}%</span>
            <span className="text-[10px] font-semibold text-[#64748B]">Score</span>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#64748B]">Ready Days</span>
            <span className="font-bold text-[#0F172A]">{readyDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">Issues Found</span>
            <span className="font-bold text-amber-600">{issuesFound}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">Blocking Issues</span>
            <span className="font-bold text-red-600">{blockingIssues}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReadinessIssueList({ issues, tone }: { issues: string[]; tone: SetupTone }) {
  const styles = setupToneStyles[tone];
  if (!issues.length) {
    return (
      <p className={`rounded-xl border px-3 py-2 text-xs font-semibold ${styles.chip}`}>
        Ready for daily payroll calculation.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li key={issue} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {issue}
        </li>
      ))}
    </ul>
  );
}
