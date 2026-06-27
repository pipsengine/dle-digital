'use client';

import Link from 'next/link';
import { Gift, RefreshCcw } from 'lucide-react';
import type { BenefitsPayload } from '@/lib/benefits-management-types';
import {
  BenefitTabs,
  BenefitsPageIcon,
  MAIN_TABS,
  PlanSubTabs,
  type BenefitPageId,
} from './benefits-management-ui';
import { renderBenefitsPage, type BenefitsPageContext } from './benefits-pages';

export type BenefitsManagementEnterpriseViewProps = {
  loading: boolean;
  error: string;
  toast: string;
  payload?: BenefitsPayload;
  role: string;
  roles: string[];
  onRoleChange: (role: string) => void;
  onRefresh: () => void;
  page: BenefitPageId;
  onPageChange: (page: BenefitPageId) => void;
  pageContext: BenefitsPageContext;
  pendingApprovals: number;
};

const pageTitles: Record<BenefitPageId, { title: string; subtitle: string }> = {
  overview: { title: 'Benefits Overview', subtitle: 'Enterprise dashboard for plans, enrollments, claims, and compliance' },
  plans: { title: 'Benefit Plans', subtitle: 'Configure and manage all benefit programs' },
  medical: { title: 'Medical Benefits', subtitle: 'HMO and health coverage plans' },
  insurance: { title: 'Insurance Benefits', subtitle: 'Life, accident, and travel insurance' },
  pension: { title: 'Pension Benefits', subtitle: 'Retirement savings and PFAs' },
  welfare: { title: 'Staff Welfare', subtitle: 'Support funds and wellness programs' },
  allowance: { title: 'Allowance Benefits', subtitle: 'Housing, transport, and site allowances' },
  eligibility: { title: 'Benefit Eligibility', subtitle: 'Rules for automatic assignment and enrollment' },
  enrollment: { title: 'Employee Enrollment', subtitle: 'Enroll employees and manage dependents' },
  'employee-profile': { title: 'Employee Benefit Profile', subtitle: 'Individual coverage, allowances, and claims' },
  claims: { title: 'Benefit Claims', subtitle: 'Submit, review, and track benefit claims' },
  'claim-details': { title: 'Claim Details', subtitle: 'Full claim record, documents, and workflow' },
  approvals: { title: 'Benefit Approvals', subtitle: 'Pending enrollment and claim approvals' },
  providers: { title: 'Providers & Vendors', subtitle: 'HMO, insurers, and benefit partners' },
  compliance: { title: 'Compliance', subtitle: 'Regulatory obligations and audit readiness' },
  reports: { title: 'Reports & Analytics', subtitle: 'Cost, enrollment, and utilization insights' },
  settings: { title: 'Benefits Settings', subtitle: 'Workflow, notifications, and configuration' },
};

export function BenefitsManagementEnterpriseView(props: BenefitsManagementEnterpriseViewProps) {
  const meta = pageTitles[props.page];
  const activeTab = props.page === 'employee-profile' ? 'enrollment' : props.page === 'claim-details' ? 'claims' : props.page;

  return (
    <main className="min-h-screen bg-[#F8FAFC] pb-10 text-[#111827]">
      <div className="mx-auto max-w-[1680px] space-y-5 px-4 pt-4 sm:px-6">
        <section className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_6px_24px_rgba(15,23,42,0.08)]">
          <div className="border-b border-[#E5E7EB] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                <BenefitsPageIcon icon={Gift} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">HRIS · Benefits Management</p>
                  <h1 className="mt-1 text-2xl font-bold text-[#111827] sm:text-3xl">{meta.title}</h1>
                  <p className="mt-2 max-w-3xl text-sm text-[#6B7280]">{meta.subtitle}</p>
                  {props.payload ? (
                    <p className="mt-2 text-xs text-[#9CA3AF]">
                      Source: {props.payload.source} · Generated {new Date(props.payload.generatedAt).toLocaleString()}
                      {props.payload.dataSource.warning ? ` · ${props.payload.dataSource.warning}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={props.role}
                  onChange={(e) => props.onRoleChange(e.target.value)}
                  className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] outline-none focus:border-[#4F46E5]"
                >
                  {props.roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={props.onRefresh}
                  disabled={props.loading}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#6B7280] hover:bg-[#F8FAFC] disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${props.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <Link href="/hris" className="inline-flex h-11 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#6B7280] hover:bg-[#F8FAFC]">
                  HRIS Home
                </Link>
              </div>
            </div>
          </div>
          <div className="px-5 sm:px-6">
            <BenefitTabs
              active={activeTab}
              onChange={props.onPageChange}
              tabs={MAIN_TABS}
              badges={{ approvals: props.pendingApprovals || undefined }}
            />
            <PlanSubTabs active={props.page} onChange={props.onPageChange} />
          </div>
        </section>

        {props.error ? (
          <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{props.error}</div>
        ) : null}
        {props.toast && !props.pageContext.toast ? (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{props.toast}</div>
        ) : null}

        {props.loading && !props.payload ? (
          <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-12 text-center text-sm text-[#6B7280]">Loading Benefits Management workspace…</div>
        ) : props.payload ? (
          renderBenefitsPage(props.pageContext)
        ) : null}
      </div>
    </main>
  );
}
