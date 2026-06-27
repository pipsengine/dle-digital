'use client';

import type { ComponentType, ReactNode } from 'react';
import {
  ChevronDown,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const benefitsColors = {
  primary: '#4F46E5',
  primaryHover: '#4338CA',
  primaryLight: '#EEF2FF',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  purple: '#8B5CF6',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  pageBg: '#F8FAFC',
  cardShadow: '0 6px 24px rgba(15,23,42,0.08)',
};

export type BenefitPageId =
  | 'overview'
  | 'plans'
  | 'medical'
  | 'insurance'
  | 'pension'
  | 'welfare'
  | 'allowance'
  | 'eligibility'
  | 'enrollment'
  | 'employee-profile'
  | 'claims'
  | 'claim-details'
  | 'approvals'
  | 'providers'
  | 'compliance'
  | 'reports'
  | 'settings';

export const BENEFIT_PAGES: Array<{ id: BenefitPageId; label: string; group?: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'plans', label: 'All Plans', group: 'plans' },
  { id: 'medical', label: 'Medical', group: 'plans' },
  { id: 'insurance', label: 'Insurance', group: 'plans' },
  { id: 'pension', label: 'Pension', group: 'plans' },
  { id: 'welfare', label: 'Staff Welfare', group: 'plans' },
  { id: 'allowance', label: 'Allowance', group: 'plans' },
  { id: 'enrollment', label: 'Enrollment' },
  { id: 'claims', label: 'Claims' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'providers', label: 'Providers' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

export const MAIN_TABS: Array<{ id: BenefitPageId | 'plans-group'; label: string; target?: BenefitPageId }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'plans-group', label: 'Plans', target: 'plans' },
  { id: 'enrollment', label: 'Enrollment' },
  { id: 'claims', label: 'Claims' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'providers', label: 'Providers' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

export const PLAN_SUB_TABS: BenefitPageId[] = ['plans', 'medical', 'insurance', 'pension', 'welfare', 'allowance'];

export function BenefitsPageIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <span
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] text-white shadow-[0_6px_24px_rgba(79,70,229,0.35)]"
      style={{ background: `linear-gradient(135deg, ${benefitsColors.primary} 0%, ${benefitsColors.purple} 100%)` }}
    >
      <Icon className="h-7 w-7" />
    </span>
  );
}

export function BenefitKpiCard({
  label,
  value,
  subtitle,
  trend,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  trend?: number | null;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <article
      className="flex min-h-[148px] flex-col rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
      style={{ borderTopWidth: 4, borderTopColor: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#6B7280]">{label}</p>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${accent}18`, color: accent }}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-[32px] font-bold leading-none text-[#111827]">{value}</p>
      <div className="mt-auto flex items-center justify-between pt-3">
        <p className="text-xs font-medium text-[#6B7280]">{subtitle}</p>
        {trend !== undefined && trend !== null ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        ) : null}
      </div>
    </article>
  );
}

const statusStyles: Record<string, string> = {
  Active: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
  Approved: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
  Compliant: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
  Paid: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
  Draft: 'border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]',
  Pending: 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]',
  'Pending Approval': 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]',
  'In Review': 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
  Rejected: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  Inactive: 'border-[#E5E7EB] bg-[#F8FAFC] text-[#9CA3AF]',
  Expired: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  'At Risk': 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]',
  Overdue: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  High: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]',
  Medium: 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]',
  Low: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
};

export function BenefitStatusBadge({ label }: { label: string }) {
  const style = statusStyles[label] || 'border-[#E5E7EB] bg-[#F8FAFC] text-[#6B7280]';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style}`}>{label}</span>;
}

export function BenefitPanel({ title, subtitle, children, actions }: { title: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_6px_24px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function BenefitTabs({
  active,
  onChange,
  tabs,
  badges,
}: {
  active: BenefitPageId | 'plans-group';
  onChange: (id: BenefitPageId) => void;
  tabs: typeof MAIN_TABS;
  badges?: Partial<Record<string, number>>;
}) {
  const isActive = (tab: (typeof MAIN_TABS)[number]) => {
    if (tab.id === 'plans-group') return PLAN_SUB_TABS.includes(active as BenefitPageId);
    return active === tab.id;
  };
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#E5E7EB]">
      {tabs.map((tab) => {
        const selected = isActive(tab);
        const badge = badges?.[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.target || (tab.id as BenefitPageId))}
            className={`relative px-4 py-3 text-sm font-semibold transition-colors ${selected ? 'text-[#4F46E5]' : 'text-[#6B7280] hover:text-[#111827]'}`}
          >
            <span className="inline-flex items-center gap-2">
              {tab.label}
              {badge ? <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
            </span>
            {selected ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#4F46E5]" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function PlanSubTabs({ active, onChange }: { active: BenefitPageId; onChange: (id: BenefitPageId) => void }) {
  if (!PLAN_SUB_TABS.includes(active)) return null;
  const labels: Record<BenefitPageId, string> = {
    plans: 'All Plans',
    medical: 'Medical',
    insurance: 'Insurance',
    pension: 'Pension',
    welfare: 'Staff Welfare',
    allowance: 'Allowance',
  } as Record<BenefitPageId, string>;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {PLAN_SUB_TABS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
            active === id ? 'bg-[#4F46E5] text-white shadow-sm' : 'border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F8FAFC]'
          }`}
        >
          {labels[id]}
        </button>
      ))}
    </div>
  );
}

export function BenefitToolbar({
  query,
  onQueryChange,
  onExport,
  primaryLabel,
  onPrimaryClick,
  filters,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onExport?: () => void;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
  filters?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-[240px] flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search..."
          className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-3 text-sm font-medium outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF2FF]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters}
        {onExport ? (
          <button type="button" onClick={onExport} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#6B7280] hover:bg-[#F8FAFC]">
            <Download className="h-4 w-4" />
            Export
          </button>
        ) : null}
        {primaryLabel ? (
          <button type="button" onClick={onPrimaryClick} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white hover:bg-[#4338CA]">
            <Plus className="h-4 w-4" />
            {primaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function BenefitDataTable({
  headers,
  rows,
  emptyMessage,
  selectable,
  selectedIds,
  onToggleAll,
  onToggleRow,
  allSelected,
}: {
  headers: Array<{ id: string; label: string; className?: string }>;
  rows: Array<{ id: string; cells: ReactNode[] }>;
  emptyMessage: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleAll?: () => void;
  onToggleRow?: (id: string) => void;
  allSelected?: boolean;
}) {
  const colSpan = headers.length + (selectable ? 0 : 0);
  return (
    <div className="overflow-x-auto rounded-[16px] border border-[#E5E7EB]">
      <table className="min-w-full text-left">
        <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-[13px] font-semibold uppercase tracking-wide text-[#6B7280]">
          <tr>
            {selectable ? (
              <th className="w-10 px-3 py-3">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="rounded border-[#CBD5E1]" aria-label="Select all" />
              </th>
            ) : null}
            {headers.map((head) => (
              <th key={head.id} className={`px-4 py-3 ${head.className || ''}`}>
                {head.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB] bg-white text-[14px]">
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-[#F8FAFC]">
              {selectable ? (
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selectedIds?.has(row.id)} onChange={() => onToggleRow?.(row.id)} className="rounded border-[#CBD5E1]" />
                </td>
              ) : null}
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${headers[index]?.id || index}`} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={colSpan + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-sm text-[#6B7280]">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function RowActionsMenu() {
  return (
    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F8FAFC]" aria-label="Actions">
      <MoreHorizontal className="h-4 w-4" />
    </button>
  );
}

export function EmployeeAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-bold text-[#4F46E5]">{initials || '?'}</span>
  );
}

export function BenefitSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 min-w-[140px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111827] outline-none focus:border-[#4F46E5]">
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt === 'All' ? label : opt}</option>
      ))}
    </select>
  );
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5] hover:underline">
      <ChevronDown className="h-4 w-4 -rotate-90" />
      {label}
    </button>
  );
}

export const inputClass = 'h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#111827] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#EEF2FF]';

export function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
      <span className="text-sm font-medium text-[#111827]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-[#4F46E5]' : 'bg-[#CBD5E1]'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}
