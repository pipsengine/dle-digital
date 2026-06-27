'use client';

import {
  Activity,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Landmark,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { AnalyticsCard } from '../payroll/overtime-pay/overtime-pay-ui';
import { DonutChart, HorizontalBarChart, MetadataPill } from '../payroll/employee-salary-setup/salary-setup-ui';
import { DualLineChart, HealthScoreRing } from '../payroll/salary-structure/salary-structure-ui';
import type {
  ApprovalRequest,
  BenefitClaim,
  BenefitPlan,
  BenefitPlanType,
  BenefitsPayload,
  ComplianceItem,
  EligibilityRule,
  EmployeeBenefitProfile,
  EnrollmentRecord,
} from '@/lib/benefits-management-types';
import { formatBenefitMoney } from '@/lib/benefits-management-types';
import {
  BackLink,
  BenefitDataTable,
  BenefitKpiCard,
  BenefitPanel,
  BenefitSelect,
  BenefitStatusBadge,
  BenefitToolbar,
  EmployeeAvatar,
  RowActionsMenu,
  ToggleSwitch,
  inputClass,
  type BenefitPageId,
} from './benefits-management-ui';
import type { BenefitActionKind } from './benefits-action-modal';

export type BenefitsPageContext = {
  payload: BenefitsPayload;
  page: BenefitPageId;
  query: string;
  onQueryChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onNavigate: (page: BenefitPageId, meta?: { claimId?: string; employeeId?: string }) => void;
  selectedClaim?: BenefitClaim | null;
  selectedProfile?: EmployeeBenefitProfile | null;
  onExport: () => void;
  settingsDraft: BenefitsPayload['settings'];
  onSettingsChange: (patch: Partial<BenefitsPayload['settings']>) => void;
  onSaveSettings: () => void;
  onSyncSage: (overwrite?: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onOpenAction: (kind: BenefitActionKind) => void;
  onBulkApprove: () => void;
  toast: string;
};

const planTypeIcon: Record<BenefitPlanType, typeof HeartPulse> = {
  Medical: HeartPulse,
  Insurance: Shield,
  Pension: Landmark,
  Welfare: Users,
  Allowance: Wallet,
};

const planTypeAccent: Record<BenefitPlanType, string> = {
  Medical: '#10B981',
  Insurance: '#3B82F6',
  Pension: '#8B5CF6',
  Welfare: '#F59E0B',
  Allowance: '#4F46E5',
};

function filterText(value: string, query: string) {
  if (!query.trim()) return true;
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function filterPlans(plans: BenefitPlan[], ctx: BenefitsPageContext, type?: BenefitPlanType) {
  return plans.filter((plan) => {
    if (type && plan.type !== type) return false;
    if (ctx.statusFilter !== 'All' && plan.status !== ctx.statusFilter) return false;
    if (ctx.typeFilter !== 'All' && plan.type !== ctx.typeFilter) return false;
    const hay = `${plan.name} ${plan.provider} ${plan.eligibility} ${plan.type}`;
    return filterText(hay, ctx.query);
  });
}

function PlansTable({ plans, ctx, primaryLabel }: { plans: BenefitPlan[]; ctx: BenefitsPageContext; primaryLabel: string }) {
  const headers = [
    { id: 'select', label: '' },
    { id: 'plan', label: 'Plan Name' },
    { id: 'type', label: 'Type' },
    { id: 'provider', label: 'Provider' },
    { id: 'eligibility', label: 'Eligibility' },
    { id: 'enrolled', label: 'Enrolled' },
    { id: 'employer', label: 'Employer' },
    { id: 'employee', label: 'Employee' },
    { id: 'renewal', label: 'Renewal' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '' },
  ];
  const rows = plans.map((plan) => ({
    id: plan.id,
    cells: [
      <div key="plan">
        <p className="font-semibold text-[#111827]">{plan.name}</p>
        <p className="text-xs text-[#6B7280]">Effective {plan.effectiveDate}</p>
      </div>,
      <BenefitStatusBadge key="type" label={plan.type} />,
      plan.provider,
      plan.eligibility,
      plan.enrolled.toLocaleString(),
      plan.employerContribution,
      plan.employeeContribution,
      plan.renewalDate,
      <BenefitStatusBadge key="status" label={plan.status} />,
      <RowActionsMenu key="actions" />,
    ],
  }));
  return (
    <BenefitPanel
      title="Benefit Plans Register"
      subtitle={`${plans.length} plan(s) in current view`}
      actions={
        <button type="button" onClick={() => ctx.onOpenAction('create-plan')} className="rounded-xl bg-[#4F46E5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4338CA]">
          Add Plan
        </button>
      }
    >
      <BenefitToolbar
        query={ctx.query}
        onQueryChange={ctx.onQueryChange}
        onExport={ctx.onExport}
        primaryLabel={primaryLabel}
        onPrimaryClick={() => ctx.onOpenAction('create-plan')}
        filters={
          <>
            <BenefitSelect value={ctx.statusFilter} onChange={ctx.onStatusFilterChange} options={['All', 'Active', 'Draft', 'Inactive', 'Pending', 'Expired']} label="Status" />
            <BenefitSelect value={ctx.typeFilter} onChange={ctx.onTypeFilterChange} options={['All', 'Medical', 'Insurance', 'Pension', 'Welfare', 'Allowance']} label="Type" />
          </>
        }
      />
      <BenefitDataTable
        headers={headers}
        rows={rows}
        emptyMessage="No benefit plans match your filters."
        selectable
        selectedIds={ctx.selectedIds}
        onToggleAll={ctx.onToggleAll}
        onToggleRow={ctx.onToggleRow}
        allSelected={ctx.allSelected}
      />
    </BenefitPanel>
  );
}

function CategoryHero({ title, subtitle, type, plans }: { title: string; subtitle: string; type: BenefitPlanType; plans: BenefitPlan[] }) {
  const Icon = planTypeIcon[type];
  const active = plans.filter((p) => p.status === 'Active').length;
  const enrolled = plans.reduce((sum, p) => sum + p.enrolled, 0);
  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto]">
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,0.08)]">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: planTypeAccent[type] }}>
            <Icon className="h-7 w-7" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">{title}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetadataPill label="Plans" value={String(plans.length)} />
        <MetadataPill label="Active" value={String(active)} />
        <MetadataPill label="Enrolled" value={enrolled.toLocaleString()} />
      </div>
    </div>
  );
}

export function BenefitsOverviewPage({ ctx }: { ctx: BenefitsPageContext }) {
  const { summary, plans, claims, compliance, analytics } = ctx.payload;
  const enrollmentByType = analytics.enrollmentByType.map((item) => ({
    ...item,
    color: planTypeAccent[item.label as BenefitPlanType],
  }));
  const totalEnrolledEmployees = summary.enrolledEmployees;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BenefitKpiCard label="Total Employees" value={summary.totalEmployees.toLocaleString()} subtitle="Active eligible workforce" icon={Users} accent="#4F46E5" />
        <BenefitKpiCard label="Enrolled Employees" value={summary.enrolledEmployees.toLocaleString()} subtitle={`${summary.activeEnrollments.toLocaleString()} plan assignments`} icon={BadgeCheck} accent="#10B981" />
        <BenefitKpiCard label="Benefit Cost YTD" value={formatBenefitMoney(summary.totalBenefitCostYtd)} subtitle={`${formatBenefitMoney(summary.periodBenefitCost)} current period employer`} icon={Wallet} accent="#8B5CF6" />
        <BenefitKpiCard label="Pending Claims" value={String(summary.pendingClaims)} subtitle={`${summary.pendingApprovals} approvals waiting`} icon={ClipboardCheck} accent="#F59E0B" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <AnalyticsCard title="Enrollment by Category">
          <p className="mb-3 text-sm text-[#6B7280]">Unique employees with active coverage by type</p>
          <HorizontalBarChart rows={enrollmentByType} />
        </AnalyticsCard>
        <AnalyticsCard title="Cost Trend">
          <p className="mb-3 text-sm text-[#6B7280]">Current period employer vs employee contributions (₦M)</p>
          <DualLineChart labels={analytics.costTrend.labels} seriesA={analytics.costTrend.employerSeries} seriesB={analytics.costTrend.employeeSeries} nameA="Employer" nameB="Employee" />
        </AnalyticsCard>
        <AnalyticsCard title="Compliance Health">
          <p className="mb-3 text-sm text-[#6B7280]">Regulatory readiness score</p>
          <div className="flex flex-col items-center gap-4 py-2">
            <HealthScoreRing score={summary.complianceScore} size={88} />
            <p className="text-sm font-semibold text-[#6B7280]">Compliance Score</p>
            <div className="grid w-full gap-2">
              {compliance.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm">
                  <span className="font-medium text-[#111827]">{item.regulator}</span>
                  <BenefitStatusBadge label={item.status} />
                </div>
              ))}
            </div>
          </div>
        </AnalyticsCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsCard title="Plan Distribution">
          <p className="mb-3 text-sm text-[#6B7280]">Employees covered by benefit type</p>
          <DonutChart
            rows={enrollmentByType.map((item) => ({ label: item.label, value: item.value, color: item.color || '#4F46E5' }))}
            centerLabel="Employees"
            centerValue={totalEnrolledEmployees.toLocaleString()}
          />
        </AnalyticsCard>
        <AnalyticsCard title="Recent Claims Activity">
          <p className="mb-3 text-sm text-[#6B7280]">Latest submissions and status</p>
          <div className="space-y-3">
            {claims.map((claim) => (
              <button
                key={claim.id}
                type="button"
                onClick={() => ctx.onNavigate('claim-details', { claimId: claim.id })}
                className="flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-3 text-left transition hover:bg-[#F8FAFC]"
              >
                <div>
                  <p className="font-semibold text-[#111827]">{claim.employeeName}</p>
                  <p className="text-xs text-[#6B7280]">{claim.claimType} · {claim.id}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#111827]">{formatBenefitMoney(claim.amount)}</p>
                  <BenefitStatusBadge label={claim.status} />
                </div>
              </button>
            ))}
          </div>
        </AnalyticsCard>
      </div>
    </div>
  );
}

export function BenefitsPlansPage({ ctx, type }: { ctx: BenefitsPageContext; type?: BenefitPlanType }) {
  const plans = filterPlans(ctx.payload.plans, ctx, type);
  const titles: Record<BenefitPlanType, { title: string; subtitle: string }> = {
    Medical: { title: 'Medical Benefits', subtitle: 'HMO plans, hospital coverage, and health reimbursements' },
    Insurance: { title: 'Insurance Benefits', subtitle: 'Group life, accident, and travel coverage programs' },
    Pension: { title: 'Pension Benefits', subtitle: 'Retirement savings accounts and employer matching' },
    Welfare: { title: 'Staff Welfare', subtitle: 'Support funds, wellness, and recognition programs' },
    Allowance: { title: 'Allowance Benefits', subtitle: 'Housing, transport, hazard and site allowances' },
  };
  const labels: Partial<Record<BenefitPageId, string>> = {
    plans: 'New Plan',
    medical: 'Add Medical Plan',
    insurance: 'Add Insurance Plan',
    pension: 'Add Pension Plan',
    welfare: 'Add Welfare Program',
    allowance: 'Add Allowance',
  };
  return (
    <div>
      {type ? <CategoryHero title={titles[type].title} subtitle={titles[type].subtitle} type={type} plans={plans} /> : null}
      <PlansTable plans={plans} ctx={ctx} primaryLabel={labels[ctx.page] || 'New Plan'} />
    </div>
  );
}

export function BenefitsEnrollmentPage({ ctx }: { ctx: BenefitsPageContext }) {
  const rows = ctx.payload.enrollments.filter((item) => {
    if (ctx.statusFilter !== 'All' && item.status !== ctx.statusFilter) return false;
    const hay = `${item.employeeName} ${item.employeeId} ${item.planName} ${item.department}`;
    return filterText(hay, ctx.query);
  });
  const headers = [
    { id: 'select', label: '' },
    { id: 'employee', label: 'Employee' },
    { id: 'department', label: 'Department' },
    { id: 'plan', label: 'Plan' },
    { id: 'type', label: 'Type' },
    { id: 'dependents', label: 'Dependents' },
    { id: 'enrolled', label: 'Enrolled On' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '' },
  ];
  const tableRows = rows.slice(0, 50).map((item: EnrollmentRecord) => ({
    id: item.id,
    cells: [
      <div key="emp" className="flex items-center gap-3">
        <EmployeeAvatar name={item.employeeName} />
        <div>
          <button type="button" onClick={() => ctx.onNavigate('employee-profile', { employeeId: item.employeeId })} className="font-semibold text-[#4F46E5] hover:underline">
            {item.employeeName}
          </button>
          <p className="text-xs text-[#6B7280]">{item.employeeId}</p>
        </div>
      </div>,
      item.department,
      item.planName,
      <BenefitStatusBadge key="type" label={item.planType} />,
      String(item.dependents),
      item.enrolledOn,
      <BenefitStatusBadge key="status" label={item.status} />,
      <RowActionsMenu key="actions" />,
    ],
  }));
  return (
    <BenefitPanel title="Employee Enrollment" subtitle="Manage benefit enrollments and dependent coverage">
      <BenefitToolbar
        query={ctx.query}
        onQueryChange={ctx.onQueryChange}
        onExport={ctx.onExport}
        primaryLabel="Enroll Employee"
        onPrimaryClick={() => ctx.onOpenAction('create-enrollment')}
        filters={<BenefitSelect value={ctx.statusFilter} onChange={ctx.onStatusFilterChange} options={['All', 'Active', 'Pending', 'Inactive']} label="Status" />}
      />
      <BenefitDataTable
        headers={headers}
        rows={tableRows}
        emptyMessage="No enrollments match your filters."
        selectable
        selectedIds={ctx.selectedIds}
        onToggleAll={ctx.onToggleAll}
        onToggleRow={ctx.onToggleRow}
        allSelected={ctx.allSelected}
      />
      {rows.length > 50 ? <p className="mt-3 text-sm text-[#6B7280]">Showing 50 of {rows.length} enrollments.</p> : null}
    </BenefitPanel>
  );
}

export function BenefitsEmployeeProfilePage({ ctx }: { ctx: BenefitsPageContext }) {
  const profile = ctx.selectedProfile || ctx.payload.employeeProfiles[0];
  if (!profile) return <p className="text-sm text-[#6B7280]">No employee profile selected.</p>;
  return (
    <div className="space-y-5">
      <BackLink label="Back to Enrollment" onClick={() => ctx.onNavigate('enrollment')} />
      <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 shadow-[0_6px_24px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <EmployeeAvatar name={profile.employeeName} />
            <div>
              <h2 className="text-2xl font-bold text-[#111827]">{profile.employeeName}</h2>
              <p className="text-sm text-[#6B7280]">{profile.jobTitle} · {profile.department}</p>
              <p className="mt-1 text-sm text-[#6B7280]">{profile.location} · Hired {profile.hireDate}</p>
            </div>
          </div>
          <MetadataPill label="Employee ID" value={profile.employeeId} />
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <BenefitPanel title="Enrolled Plans" subtitle="Active benefit coverage">
          <div className="space-y-3">
            {profile.plans.map((plan) => (
              <div key={plan.name} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111827]">{plan.name}</p>
                  <p className="text-xs text-[#6B7280]">{plan.provider} · {plan.coverage}</p>
                </div>
                <BenefitStatusBadge label={plan.status} />
              </div>
            ))}
          </div>
        </BenefitPanel>
        <BenefitPanel title="Allowances" subtitle="Recurring benefit payments">
          <div className="space-y-3">
            {profile.allowances.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#111827]">{item.name}</p>
                  <p className="text-xs text-[#6B7280]">{item.frequency}</p>
                </div>
                <p className="font-semibold text-[#111827]">{item.amount}</p>
              </div>
            ))}
          </div>
        </BenefitPanel>
        <BenefitPanel title="Dependents" subtitle="Covered family members">
          <BenefitDataTable
            headers={[
              { id: 'name', label: 'Name' },
              { id: 'relationship', label: 'Relationship' },
              { id: 'plan', label: 'Plan' },
            ]}
            rows={profile.dependents.map((d, i) => ({ id: `dep-${i}`, cells: [d.name, d.relationship, d.plan] }))}
            emptyMessage="No dependents on file."
          />
        </BenefitPanel>
        <BenefitPanel title="Beneficiaries" subtitle="Insurance and pension designations">
          <BenefitDataTable
            headers={[
              { id: 'name', label: 'Name' },
              { id: 'relationship', label: 'Relationship' },
              { id: 'pct', label: 'Share' },
            ]}
            rows={profile.beneficiaries.map((b, i) => ({ id: `ben-${i}`, cells: [b.name, b.relationship, `${b.percentage}%`] }))}
            emptyMessage="No beneficiaries recorded."
          />
        </BenefitPanel>
      </div>
      {profile.recentClaims.length ? (
        <BenefitPanel title="Recent Claims" subtitle="Employee benefit claim history">
          <div className="space-y-2">
            {profile.recentClaims.map((claim) => (
              <button
                key={claim.id}
                type="button"
                onClick={() => ctx.onNavigate('claim-details', { claimId: claim.id })}
                className="flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-3 text-left hover:bg-[#F8FAFC]"
              >
                <span className="font-medium text-[#111827]">{claim.claimType}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{formatBenefitMoney(claim.amount)}</span>
                  <BenefitStatusBadge label={claim.status} />
                </span>
              </button>
            ))}
          </div>
        </BenefitPanel>
      ) : null}
    </div>
  );
}

export function BenefitsClaimsPage({ ctx }: { ctx: BenefitsPageContext }) {
  const claims = ctx.payload.claims.filter((item) => {
    if (ctx.statusFilter !== 'All' && item.status !== ctx.statusFilter) return false;
    const hay = `${item.employeeName} ${item.id} ${item.claimType} ${item.planName}`;
    return filterText(hay, ctx.query);
  });
  const headers = [
    { id: 'select', label: '' },
    { id: 'claim', label: 'Claim ID' },
    { id: 'employee', label: 'Employee' },
    { id: 'plan', label: 'Plan' },
    { id: 'type', label: 'Type' },
    { id: 'amount', label: 'Amount' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '' },
  ];
  const rows = claims.map((claim) => ({
    id: claim.id,
    cells: [
      <button key="id" type="button" onClick={() => ctx.onNavigate('claim-details', { claimId: claim.id })} className="font-semibold text-[#4F46E5] hover:underline">
        {claim.id}
      </button>,
      <div key="emp" className="flex items-center gap-2">
        <EmployeeAvatar name={claim.employeeName} />
        <span>{claim.employeeName}</span>
      </div>,
      claim.planName,
      claim.claimType,
      formatBenefitMoney(claim.amount),
      claim.submittedOn,
      <BenefitStatusBadge key="status" label={claim.status} />,
      <RowActionsMenu key="actions" />,
    ],
  }));
  return (
    <BenefitPanel title="Benefit Claims" subtitle="Track submissions, reviews, and payouts">
      <BenefitToolbar
        query={ctx.query}
        onQueryChange={ctx.onQueryChange}
        onExport={ctx.onExport}
        primaryLabel="Submit Claim"
        onPrimaryClick={() => ctx.onOpenAction('create-claim')}
        filters={
          <BenefitSelect
            value={ctx.statusFilter}
            onChange={ctx.onStatusFilterChange}
            options={['All', 'Pending Approval', 'In Review', 'Approved', 'Rejected', 'Paid']}
            label="Status"
          />
        }
      />
      <BenefitDataTable
        headers={headers}
        rows={rows}
        emptyMessage="No claims match your filters."
        selectable
        selectedIds={ctx.selectedIds}
        onToggleAll={ctx.onToggleAll}
        onToggleRow={ctx.onToggleRow}
        allSelected={ctx.allSelected}
      />
    </BenefitPanel>
  );
}

export function BenefitsClaimDetailsPage({ ctx }: { ctx: BenefitsPageContext }) {
  const claim = ctx.selectedClaim || ctx.payload.claims[0];
  if (!claim) return null;
  return (
    <div className="space-y-5">
      <BackLink label="Back to Claims" onClick={() => ctx.onNavigate('claims')} />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-5">
          <BenefitPanel title={`Claim ${claim.id}`} subtitle={`${claim.claimType} · ${claim.planName}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetadataPill label="Employee" value={claim.employeeName} />
              <MetadataPill label="Department" value={claim.department} />
              <MetadataPill label="Amount" value={formatBenefitMoney(claim.amount)} />
              <MetadataPill label="Submitted" value={claim.submittedOn} />
            </div>
            <p className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 text-sm text-[#374151]">{claim.description}</p>
          </BenefitPanel>
          <BenefitPanel title="Supporting Documents" subtitle="Uploaded evidence">
            <div className="space-y-2">
              {claim.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-[#E5E7EB] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[#4F46E5]" />
                    <span className="font-medium text-[#111827]">{doc.name}</span>
                  </div>
                  <span className="text-sm text-[#6B7280]">{doc.size}</span>
                </div>
              ))}
            </div>
          </BenefitPanel>
        </div>
        <div className="space-y-5">
          <BenefitPanel title="Status" subtitle="Current claim state">
            <BenefitStatusBadge label={claim.status} />
            <div className="mt-4 space-y-3">
              {claim.workflow.map((step) => (
                <div key={step.stage} className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${step.status === 'Completed' ? 'bg-emerald-500' : step.status === 'Waiting' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <div>
                    <p className="font-semibold text-[#111827]">{step.stage}</p>
                    <p className="text-xs text-[#6B7280]">{step.owner}{step.actedAt ? ` · ${step.actedAt}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </BenefitPanel>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => ctx.onApprove(claim.id)} className="h-11 rounded-xl bg-[#10B981] text-sm font-semibold text-white hover:bg-emerald-600">
              Approve Claim
            </button>
            <button type="button" onClick={() => ctx.onReject(claim.id)} className="h-11 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-sm font-semibold text-[#B91C1C] hover:bg-red-100">
              Reject Claim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BenefitsApprovalsPage({ ctx }: { ctx: BenefitsPageContext }) {
  const items = ctx.payload.approvals.filter((item) => {
    if (ctx.statusFilter !== 'All' && item.status !== ctx.statusFilter) return false;
    return filterText(`${item.employeeName} ${item.type} ${item.planName}`, ctx.query);
  });
  const headers = [
    { id: 'select', label: '' },
    { id: 'request', label: 'Request ID' },
    { id: 'type', label: 'Type' },
    { id: 'employee', label: 'Employee' },
    { id: 'plan', label: 'Plan' },
    { id: 'amount', label: 'Amount' },
    { id: 'priority', label: 'Priority' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '' },
  ];
  const rows = items.map((item: ApprovalRequest) => ({
    id: item.id,
    cells: [
      item.id,
      item.type,
      item.employeeName,
      item.planName,
      item.amount ? formatBenefitMoney(item.amount) : '—',
      <BenefitStatusBadge key="priority" label={item.priority} />,
      item.submittedOn,
      <BenefitStatusBadge key="status" label={item.status} />,
      <div key="actions" className="flex gap-1">
        <button type="button" onClick={() => ctx.onApprove(item.id)} className="rounded-lg bg-[#10B981] px-2 py-1 text-xs font-semibold text-white">Approve</button>
        <button type="button" onClick={() => ctx.onReject(item.id)} className="rounded-lg border border-[#FECACA] px-2 py-1 text-xs font-semibold text-[#B91C1C]">Reject</button>
      </div>,
    ],
  }));
  return (
    <BenefitPanel title="Benefit Approvals" subtitle="Enrollment changes, claims, and welfare requests">
      <BenefitToolbar
        query={ctx.query}
        onQueryChange={ctx.onQueryChange}
        primaryLabel="Bulk Approve"
        onPrimaryClick={ctx.onBulkApprove}
        filters={<BenefitSelect value={ctx.statusFilter} onChange={ctx.onStatusFilterChange} options={['All', 'Pending', 'Approved', 'Rejected']} label="Status" />}
      />
      <BenefitDataTable
        headers={headers}
        rows={rows}
        emptyMessage="No approval requests."
        selectable
        selectedIds={ctx.selectedIds}
        onToggleAll={ctx.onToggleAll}
        onToggleRow={ctx.onToggleRow}
        allSelected={ctx.allSelected}
      />
    </BenefitPanel>
  );
}

export function BenefitsEligibilityPage({ ctx }: { ctx: BenefitsPageContext }) {
  const rules = ctx.payload.eligibilityRules.filter((item) => filterText(`${item.name} ${item.criteria}`, ctx.query));
  const headers = [
    { id: 'name', label: 'Rule Name' },
    { id: 'types', label: 'Plan Types' },
    { id: 'criteria', label: 'Criteria' },
    { id: 'applies', label: 'Applies To' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '' },
  ];
  const rows = rules.map((rule: EligibilityRule) => ({
    id: rule.id,
    cells: [
      rule.name,
      rule.planTypes.join(', '),
      rule.criteria,
      rule.appliesTo,
      <BenefitStatusBadge key="status" label={rule.status} />,
      <RowActionsMenu key="actions" />,
    ],
  }));
  return (
    <BenefitPanel title="Benefit Eligibility Rules" subtitle="Automated assignment and enrollment criteria">
      <BenefitToolbar query={ctx.query} onQueryChange={ctx.onQueryChange} primaryLabel="Add Rule" onPrimaryClick={() => ctx.onOpenAction('create-rule')} />
      <BenefitDataTable headers={headers} rows={rows} emptyMessage="No eligibility rules." />
    </BenefitPanel>
  );
}

export function BenefitsProvidersPage({ ctx }: { ctx: BenefitsPageContext }) {
  const providers = ctx.payload.providers.filter((item) => filterText(`${item.name} ${item.type} ${item.contactPerson}`, ctx.query));
  const headers = [
    { id: 'provider', label: 'Provider' },
    { id: 'type', label: 'Type' },
    { id: 'contact', label: 'Contact' },
    { id: 'email', label: 'Email' },
    { id: 'rating', label: 'Rating' },
    { id: 'contract', label: 'Contract End' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '' },
  ];
  const rows = providers.map((item) => ({
    id: item.id,
    cells: [
      item.name,
      item.type,
      item.contactPerson,
      item.email,
      `${item.rating} / 5`,
      item.contractEnd,
      <BenefitStatusBadge key="status" label={item.status} />,
      <RowActionsMenu key="actions" />,
    ],
  }));
  return (
    <BenefitPanel title="Providers & Vendors" subtitle="HMO, insurers, PFAs, and benefit partners">
      <BenefitToolbar query={ctx.query} onQueryChange={ctx.onQueryChange} primaryLabel="Add Provider" onPrimaryClick={() => ctx.onOpenAction('create-provider')} />
      <BenefitDataTable headers={headers} rows={rows} emptyMessage="No providers found." />
    </BenefitPanel>
  );
}

export function BenefitsCompliancePage({ ctx }: { ctx: BenefitsPageContext }) {
  const items = ctx.payload.compliance.filter((item) => {
    if (ctx.statusFilter !== 'All' && item.status !== ctx.statusFilter) return false;
    return filterText(`${item.regulator} ${item.requirement}`, ctx.query);
  });
  const headers = [
    { id: 'regulator', label: 'Regulator' },
    { id: 'requirement', label: 'Requirement' },
    { id: 'due', label: 'Due Date' },
    { id: 'status', label: 'Status' },
    { id: 'audit', label: 'Last Audit' },
    { id: 'actions', label: '' },
  ];
  const rows = items.map((item: ComplianceItem) => ({
    id: item.id,
    cells: [
      item.regulator,
      item.requirement,
      item.dueDate,
      <BenefitStatusBadge key="status" label={item.status} />,
      item.lastAudit,
      <RowActionsMenu key="actions" />,
    ],
  }));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <BenefitKpiCard label="Compliance Score" value={`${ctx.payload.summary.complianceScore}%`} subtitle="Overall readiness" icon={Shield} accent="#10B981" />
        <BenefitKpiCard label="At Risk" value={String(items.filter((i) => i.status === 'At Risk').length)} subtitle="Needs attention" icon={Activity} accent="#F59E0B" />
        <BenefitKpiCard label="Overdue" value={String(items.filter((i) => i.status === 'Overdue').length)} subtitle="Past due items" icon={ClipboardCheck} accent="#EF4444" />
      </div>
      <BenefitPanel title="Regulatory Compliance" subtitle="PenCom, NSITF, NHIA, and tax obligations">
        <BenefitToolbar
          query={ctx.query}
          onQueryChange={ctx.onQueryChange}
          filters={<BenefitSelect value={ctx.statusFilter} onChange={ctx.onStatusFilterChange} options={['All', 'Compliant', 'At Risk', 'Overdue']} label="Status" />}
        />
        <BenefitDataTable headers={headers} rows={rows} emptyMessage="No compliance items." />
      </BenefitPanel>
    </div>
  );
}

export function BenefitsReportsPage({ ctx }: { ctx: BenefitsPageContext }) {
  const { summary, plans, analytics } = ctx.payload;
  const costByType = analytics.costByPlanType.map((item) => ({
    label: item.label,
    value: item.value,
    color: planTypeAccent[item.label as BenefitPlanType],
  }));
  const enrollmentByType = analytics.enrollmentByType.map((item) => ({
    label: item.label,
    value: item.value,
    color: planTypeAccent[item.label as BenefitPlanType],
  }));
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BenefitKpiCard label="Total Plans" value={String(summary.totalPlans)} subtitle="Configured programs" icon={Building2} accent="#4F46E5" />
        <BenefitKpiCard label="Enrolled Employees" value={summary.enrolledEmployees.toLocaleString()} subtitle={`${summary.activeEnrollments.toLocaleString()} plan assignments`} icon={Users} accent="#10B981" />
        <BenefitKpiCard label="YTD Cost" value={formatBenefitMoney(summary.totalBenefitCostYtd)} subtitle={`${formatBenefitMoney(summary.periodBenefitCost)} current period`} icon={Wallet} accent="#8B5CF6" />
        <BenefitKpiCard label="Claims Volume" value={String(ctx.payload.claims.length)} subtitle="This period" icon={FileText} accent="#3B82F6" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsCard title="Cost by Benefit Type">
          <p className="mb-3 text-sm text-[#6B7280]">Year-to-date employer spend</p>
          <HorizontalBarChart rows={costByType} />
        </AnalyticsCard>
        <AnalyticsCard title="Enrollment Trend">
          <p className="mb-3 text-sm text-[#6B7280]">Unique enrolled employees and new enrollments by month</p>
          <DualLineChart labels={analytics.enrollmentTrend.labels} seriesA={analytics.enrollmentTrend.totalSeries} seriesB={analytics.enrollmentTrend.newSeries} nameA="Enrolled" nameB="New" />
        </AnalyticsCard>
      </div>
      <BenefitPanel title="Plan Utilization Report" subtitle="Enrollment vs capacity by plan">
        <BenefitDataTable
          headers={[
            { id: 'plan', label: 'Plan' },
            { id: 'type', label: 'Type' },
            { id: 'enrolled', label: 'Enrolled' },
            { id: 'employer', label: 'Employer Share' },
            { id: 'status', label: 'Status' },
          ]}
          rows={plans.map((plan) => ({
            id: plan.id,
            cells: [plan.name, plan.type, plan.enrolled.toLocaleString(), plan.employerContribution, <BenefitStatusBadge key="s" label={plan.status} />],
          }))}
          emptyMessage="No plan data."
        />
      </BenefitPanel>
    </div>
  );
}

export function BenefitsSettingsPage({ ctx }: { ctx: BenefitsPageContext }) {
  const s = ctx.settingsDraft;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <BenefitPanel title="General Settings" subtitle="Benefit year and currency">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[#374151]">Benefit Year</span>
            <input className={inputClass} value={s.benefitYear} onChange={(e) => ctx.onSettingsChange({ benefitYear: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[#374151]">Currency</span>
            <input className={inputClass} value={s.currency} onChange={(e) => ctx.onSettingsChange({ currency: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[#374151]">Contribution Type</span>
            <input className={inputClass} value={s.contributionType} onChange={(e) => ctx.onSettingsChange({ contributionType: e.target.value })} />
          </label>
        </div>
      </BenefitPanel>
      <BenefitPanel title="Workflow & Notifications" subtitle="Enrollment and approval behavior">
        <div className="space-y-3">
          <ToggleSwitch label="Auto-assign eligible benefits" checked={s.autoAssign} onChange={(v) => ctx.onSettingsChange({ autoAssign: v })} />
          <ToggleSwitch label="Allow employee self-enrollment" checked={s.selfEnrollment} onChange={(v) => ctx.onSettingsChange({ selfEnrollment: v })} />
          <ToggleSwitch label="Require manager approval" checked={s.requireApproval} onChange={(v) => ctx.onSettingsChange({ requireApproval: v })} />
          <ToggleSwitch label="Notify before plan renewals" checked={s.notifyRenewals} onChange={(v) => ctx.onSettingsChange({ notifyRenewals: v })} />
          <label className="mt-2 block">
            <span className="mb-1 block text-sm font-medium text-[#374151]">Approval Workflow</span>
            <input className={inputClass} value={s.approvalWorkflow} onChange={(e) => ctx.onSettingsChange({ approvalWorkflow: e.target.value })} />
          </label>
        </div>
      </BenefitPanel>
      <BenefitPanel title="Sage Payroll Migration" subtitle="Import benefit groups, pension PFA/PIN, allowance plans, and enrollments from DLE_JUNE">
        <p className="mb-4 text-sm text-[#6B7280]">
          Reads Sage 300 People payroll data and writes to DLE_Enterprise benefit tables and employee payroll setup. Safe to re-run; fills blank fields unless overwrite is selected.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => ctx.onSyncSage(false)} className="h-11 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white hover:bg-[#4338CA]">
            Sync from Sage
          </button>
          <button type="button" onClick={() => ctx.onSyncSage(true)} className="h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#6B7280] hover:bg-[#F8FAFC]">
            Sync & Overwrite
          </button>
        </div>
      </BenefitPanel>
      <div className="xl:col-span-2 flex justify-end">
        <button type="button" onClick={ctx.onSaveSettings} className="h-11 rounded-xl bg-[#4F46E5] px-6 text-sm font-semibold text-white hover:bg-[#4338CA]">
          Save Settings
        </button>
      </div>
      {ctx.toast ? <p className="xl:col-span-2 text-sm font-medium text-emerald-600">{ctx.toast}</p> : null}
    </div>
  );
}

export function renderBenefitsPage(ctx: BenefitsPageContext) {
  switch (ctx.page) {
    case 'overview':
      return <BenefitsOverviewPage ctx={ctx} />;
    case 'plans':
      return <BenefitsPlansPage ctx={ctx} />;
    case 'medical':
      return <BenefitsPlansPage ctx={ctx} type="Medical" />;
    case 'insurance':
      return <BenefitsPlansPage ctx={ctx} type="Insurance" />;
    case 'pension':
      return <BenefitsPlansPage ctx={ctx} type="Pension" />;
    case 'welfare':
      return <BenefitsPlansPage ctx={ctx} type="Welfare" />;
    case 'allowance':
      return <BenefitsPlansPage ctx={ctx} type="Allowance" />;
    case 'enrollment':
      return <BenefitsEnrollmentPage ctx={ctx} />;
    case 'employee-profile':
      return <BenefitsEmployeeProfilePage ctx={ctx} />;
    case 'claims':
      return <BenefitsClaimsPage ctx={ctx} />;
    case 'claim-details':
      return <BenefitsClaimDetailsPage ctx={ctx} />;
    case 'approvals':
      return <BenefitsApprovalsPage ctx={ctx} />;
    case 'eligibility':
      return <BenefitsEligibilityPage ctx={ctx} />;
    case 'providers':
      return <BenefitsProvidersPage ctx={ctx} />;
    case 'compliance':
      return <BenefitsCompliancePage ctx={ctx} />;
    case 'reports':
      return <BenefitsReportsPage ctx={ctx} />;
    case 'settings':
      return <BenefitsSettingsPage ctx={ctx} />;
    default:
      return <BenefitsOverviewPage ctx={ctx} />;
  }
}
