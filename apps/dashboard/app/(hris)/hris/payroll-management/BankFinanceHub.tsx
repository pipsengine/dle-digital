'use client';

import type { ComponentType } from 'react';
import {
  AlertTriangle,
  Banknote,
  ChevronRight,
  CreditCard,
  Download,
  FileSpreadsheet,
  Landmark,
  RefreshCcw,
  Scale,
  Users,
} from 'lucide-react';

type FinanceException = {
  id: string;
  employeeId: string;
  employeeName: string;
  issue: string;
  severity: 'Low' | 'Medium' | 'High';
  owner: string;
};

type FinanceRun = {
  status: string;
  bankScheduleGeneratedAt?: string | null;
  postedAt?: string | null;
};

export type BankFinancePayload = {
  period: string;
  periodLabel: string;
  generatedAt: string;
  payrollComputed?: boolean;
  dataSource?: { source: string; employeeCount: number };
  periodRecord?: { status: string } | null;
  periods?: Array<{ period: string; periodLabel: string; status: string; isActive: boolean }>;
  workflow?: { currentStatus: string; nextOwner: string };
  summary: {
    totalEmployees: number;
    netPay: number | null;
  };
  exceptions: FinanceException[];
  currentRun?: FinanceRun | null;
  permissions?: { canViewMoney?: boolean; canExport?: boolean };
};

export type BankFinanceTabId =
  | 'overview'
  | 'bank-schedule'
  | 'payment-files'
  | 'payroll-journal'
  | 'reconciliation'
  | 'exceptions';

type WorkspaceId = 'bank-schedule' | 'payment-files' | 'payroll-journal' | 'reconciliation';

type Props = {
  payload: BankFinancePayload | null;
  activeTab: BankFinanceTabId;
  loading: boolean;
  lastLoaded: string;
  viewPeriod: string | null;
  canViewMoney: boolean;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onSelectTab: (tab: BankFinanceTabId) => void;
  onFixException: (id: string) => void;
  onViewAllExceptions: () => void;
  onFinanceAction: (actionId: string) => void;
  onSelectPeriod: (period: string) => void;
};

const numberFmt = new Intl.NumberFormat('en-GB');
const moneyFmt = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const fmtNum = (value: number) => numberFmt.format(value);
const fmtMoney = (value: number | null | undefined, canView: boolean, payrollComputed?: boolean) => {
  if (!payrollComputed) return 'Not computed';
  if (!canView || value == null) return 'Restricted';
  return moneyFmt.format(value);
};
const fmtDateTime = (value: string) => new Date(value).toLocaleString('en-GB');

const financeException = (issue: string) =>
  /bank|account|payment|finance|journal|gl|cost|reconcil|sort code|branch|net pay|salary payment/i.test(issue);

const workspaceIssue = (issue: string, workspace: WorkspaceId) => {
  if (workspace === 'bank-schedule') return /bank|account|payment schedule|sort code|branch|net pay missing/i.test(issue);
  if (workspace === 'payment-files') return /payment file|bank file|export|invalid account/i.test(issue);
  if (workspace === 'payroll-journal') return /journal|posting|gl|mapping|ledger/i.test(issue);
  return /reconcil|variance|mismatch|unmatched/i.test(issue);
};

const tabs: { id: BankFinanceTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bank-schedule', label: 'Bank Schedule' },
  { id: 'payment-files', label: 'Payment Files' },
  { id: 'payroll-journal', label: 'Payroll Journal' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'exceptions', label: 'Finance Exceptions' },
];

const financeStatusLabel = (run: FinanceRun | null | undefined, issueCount: number, payrollComputed?: boolean) => {
  if (!payrollComputed) return 'Awaiting Payroll';
  if (issueCount > 0) return 'Review Required';
  if (run?.postedAt && run?.bankScheduleGeneratedAt) return 'Ready for Finance';
  if (run?.bankScheduleGeneratedAt) return 'Schedule Ready';
  if (['Released', 'Locked', 'Posted', 'Published', 'Closed'].includes(run?.status || '')) return 'Ready';
  return 'Pending Release';
};

const readinessLabel = (run: FinanceRun | null | undefined, issueCount: number, payrollComputed?: boolean) => {
  if (!payrollComputed) return 'Pending';
  if (issueCount > 0) return 'Review';
  if (run?.postedAt && run?.bankScheduleGeneratedAt) return 'Ready';
  if (run?.bankScheduleGeneratedAt) return 'Ready';
  return 'Pending';
};

const nextActionFor = (
  run: FinanceRun | null | undefined,
  workspaces: Array<{ id: WorkspaceId; issues: FinanceException[]; status: string }>,
) => {
  const blocked = workspaces.find((item) => item.issues.some((issue) => issue.severity === 'High'));
  if (blocked) {
    return { title: `Resolve ${blocked.id.replace('-', ' ')} issues`, workspace: blocked.id as BankFinanceTabId };
  }
  if (!run?.bankScheduleGeneratedAt) {
    return { title: 'Generate Bank Schedule', workspace: 'bank-schedule' as BankFinanceTabId };
  }
  const paymentIssues = workspaces.find((item) => item.id === 'payment-files');
  if ((paymentIssues?.issues.length || 0) > 0) {
    return { title: 'Review payment file validation issues', workspace: 'payment-files' as BankFinanceTabId };
  }
  if (!run?.postedAt) {
    return { title: 'Post Payroll Journal', workspace: 'payroll-journal' as BankFinanceTabId };
  }
  const reconIssues = workspaces.find((item) => item.id === 'reconciliation');
  if ((reconIssues?.issues.length || 0) > 0) {
    return { title: 'Run payroll reconciliation', workspace: 'reconciliation' as BankFinanceTabId };
  }
  return { title: 'Finance outputs are ready', workspace: 'reconciliation' as BankFinanceTabId };
};

export default function BankFinanceHub({
  payload,
  activeTab,
  loading,
  lastLoaded,
  viewPeriod,
  canViewMoney,
  onRefresh,
  onExportCsv,
  onExportExcel,
  onSelectTab,
  onFixException,
  onViewAllExceptions,
  onFinanceAction,
  onSelectPeriod,
}: Props) {
  const run = payload?.currentRun;
  const payrollComputed = payload?.payrollComputed !== false;
  const financeIssues = (payload?.exceptions || []).filter((item) => financeException(item.issue));

  const workspaceDefs: Array<{
    id: WorkspaceId;
    tab: BankFinanceTabId;
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'bank-schedule',
      tab: 'bank-schedule',
      title: 'Bank Schedule',
      description: 'Generate employee payment schedules for bank processing.',
      icon: Landmark,
    },
    {
      id: 'payment-files',
      tab: 'payment-files',
      title: 'Salary Payment File',
      description: 'Generate and export payroll payment files in bank-specific formats.',
      icon: CreditCard,
    },
    {
      id: 'payroll-journal',
      tab: 'payroll-journal',
      title: 'Payroll Journal',
      description: 'Post payroll journals to Finance, ERP, and General Ledger.',
      icon: FileSpreadsheet,
    },
    {
      id: 'reconciliation',
      tab: 'reconciliation',
      title: 'Reconciliation',
      description: 'Reconcile payroll against bank payments and finance records.',
      icon: Scale,
    },
  ];

  const workspaces = workspaceDefs.map((item) => {
    const issues = financeIssues.filter((issue) => workspaceIssue(issue.issue, item.id));
    let status = 'Pending';
    let tone: 'green' | 'amber' | 'red' = 'amber';
    if (item.id === 'bank-schedule') {
      status = run?.bankScheduleGeneratedAt ? 'Ready' : issues.length ? 'Pending' : 'Ready';
      tone = run?.bankScheduleGeneratedAt ? 'green' : 'amber';
    } else if (item.id === 'payment-files') {
      status = issues.length ? 'Pending' : run?.bankScheduleGeneratedAt ? 'Ready' : 'Pending';
      tone = issues.length ? 'amber' : run?.bankScheduleGeneratedAt ? 'green' : 'amber';
    } else if (item.id === 'payroll-journal') {
      status = run?.postedAt ? 'Posted' : 'Not Posted';
      tone = run?.postedAt ? 'green' : issues.length ? 'red' : 'amber';
    } else {
      status = issues.length ? 'Pending' : run?.postedAt ? 'Ready' : 'Pending';
      tone = issues.length ? 'amber' : run?.postedAt ? 'green' : 'amber';
    }
    if (issues.some((issue) => issue.severity === 'High')) tone = 'red';
    return { ...item, issues, status, tone };
  });

  const readyCount = workspaces.filter((item) => item.tone === 'green').length;
  const pendingCount = workspaces.filter((item) => item.tone === 'amber').length;
  const blockedCount = workspaces.filter((item) => item.tone === 'red').length;
  const healthTotal = Math.max(readyCount + pendingCount + blockedCount, 1);

  const healthCards = [
    { label: 'Ready', count: readyCount, pct: Math.round((readyCount / healthTotal) * 100), color: '#10B981' },
    { label: 'Pending', count: pendingCount, pct: Math.round((pendingCount / healthTotal) * 100), color: '#F59E0B' },
    { label: 'Blocked', count: blockedCount, pct: Math.round((blockedCount / healthTotal) * 100), color: '#EF4444' },
  ];

  const nextAction = nextActionFor(run, workspaces);
  const financeStatus = financeStatusLabel(run, financeIssues.length, payrollComputed);
  const readiness = readinessLabel(run, financeIssues.length, payrollComputed);
  const workflowOwner = payload?.workflow?.nextOwner || 'Finance Manager';
  const workflowStatus = run?.status || payload?.workflow?.currentStatus || 'Ready';

  const quickActions: Array<
    | { label: string; action: string; icon: ComponentType<{ className?: string }> }
    | { label: string; export: true; icon: ComponentType<{ className?: string }> }
  > = [
    { label: 'Generate Bank Schedule', action: 'generate-bank-schedule', icon: Landmark },
    { label: 'Export Payment File', action: 'export-bank-file', icon: CreditCard },
    { label: 'Post Payroll Journal', action: 'post-run', icon: FileSpreadsheet },
    { label: 'Run Reconciliation', action: 'reconcile-bank-payment', icon: Scale },
    { label: 'Export Finance Report', export: true, icon: Download },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="border-b border-[#E5E7EB] bg-white px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white">
              <Landmark className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Bank & Finance</h1>
              <p className="mt-1 text-sm text-[#64748B]">
                Manage bank schedules, payment files, payroll journals, reconciliation, and finance outputs from one centralized workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#2563EB]">
            Period: {payload?.periodLabel || 'Loading'}
          </span>
          {(payload?.periods?.length || 0) > 0 ? (
            <label className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              <span>View</span>
              <select
                value={viewPeriod || payload?.period || ''}
                onChange={(e) => onSelectPeriod(e.target.value)}
                className="bg-transparent font-semibold focus:outline-none"
              >
                {(payload?.periods || []).map((item) => (
                  <option key={item.period} value={item.period}>
                    {item.periodLabel} ({item.status}
                    {item.isActive ? ' · active' : ''})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#10B981]">
            Source: {payload?.dataSource?.source || 'DLE Enterprise HRIS'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            Employees: {fmtNum(payload?.summary.totalEmployees || 0)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            Net Payroll: {fmtMoney(payload?.summary.netPay, canViewMoney, payrollComputed)}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              financeStatus === 'Ready for Finance' || financeStatus === 'Schedule Ready' || financeStatus === 'Ready'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            Status: {financeStatus}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            Loaded: {fmtDateTime(lastLoaded)}
          </span>
        </div>

        <nav className="mt-4 overflow-x-auto">
          <div className="flex min-w-max gap-1 rounded-xl border border-[#E5E7EB] bg-slate-50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition-colors ${
                  activeTab === tab.id ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <div className={`mx-auto max-w-[1400px] space-y-6 px-4 py-6 ${loading ? 'opacity-60' : ''}`}>
        {activeTab === 'overview' ? (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Employees"
                value={fmtNum(payload?.summary.totalEmployees || 0)}
                subtitle="Payroll population"
                tone="blue"
                icon={Users}
                actionLabel="View bank schedule"
                onAction={() => onSelectTab('bank-schedule')}
              />
              <KpiCard
                title="Net Payroll"
                value={fmtMoney(payload?.summary.netPay, canViewMoney, payrollComputed)}
                subtitle="Total net pay for period"
                tone="green"
                icon={Banknote}
                actionLabel="View journal"
                onAction={() => onSelectTab('payroll-journal')}
              />
              <KpiCard
                title="Finance Exceptions"
                value={fmtNum(financeIssues.length)}
                subtitle="Issues blocking finance outputs"
                tone="danger"
                icon={AlertTriangle}
                actionLabel="Review exceptions"
                onAction={() => onSelectTab('exceptions')}
              />
              <KpiCard
                title="Finance Readiness"
                value={readiness}
                subtitle={`${fmtNum(readyCount)} of ${fmtNum(workspaces.length)} workspaces ready`}
                tone="purple"
                icon={Scale}
                actionLabel="View finance health"
                onAction={() => onSelectTab('exceptions')}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Next Required Action</p>
                      <h2 className="mt-1 text-2xl font-bold text-[#0F172A]">{nextAction.title}</h2>
                      <p className="mt-1 text-sm text-[#64748B]">
                        Current status: <span className="font-semibold text-[#0F172A]">{workflowStatus}</span> · Next owner:{' '}
                        <span className="font-semibold text-[#0F172A]">{workflowOwner}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTab(nextAction.workspace)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0F172A] px-6 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Open Workspace
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold">Finance Health</h3>
                <div className="mt-4 space-y-3">
                  {healthCards.map((item) => (
                    <div key={item.label} className="rounded-xl border border-[#E5E7EB] bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                          <span className="text-sm font-semibold text-[#0F172A]">{item.label}</span>
                        </div>
                        <span className="text-sm font-bold text-[#0F172A]">
                          {fmtNum(item.count)} · {item.pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-white">
                        <div className="h-1.5 rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab('exceptions')}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline"
                >
                  View finance health overview
                  <ChevronRight className="h-4 w-4" />
                </button>
              </section>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">Finance Workspaces</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {workspaces.map((item) => (
                  <WorkspaceCard key={item.id} {...item} onOpen={() => onSelectTab(item.tab)} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">Finance Exceptions</h2>
                <button type="button" onClick={onViewAllExceptions} className="text-sm font-semibold text-[#2563EB] hover:underline">
                  View all exceptions
                  <ChevronRight className="ml-1 inline h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {financeIssues.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0F172A]">{item.employeeName || 'Finance Reference'}</p>
                      <p className="text-xs text-[#64748B]">{item.employeeId || 'System'}</p>
                      <p className="mt-1 text-sm text-slate-700">{item.issue}</p>
                      <p className="mt-1 text-xs font-semibold text-[#64748B]">
                        <SeverityBadge severity={item.severity} /> · {item.owner}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onFixException(item.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#2563EB] hover:bg-blue-50"
                    >
                      Fix
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {!financeIssues.length ? (
                  <p className="text-sm font-semibold text-emerald-700">No finance exceptions found.</p>
                ) : null}
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold">Quick Actions</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => ('export' in item ? onExportExcel() : onFinanceAction(item.action))}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-4 text-center text-sm font-semibold text-slate-800 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                    >
                      <Icon className="h-5 w-5 text-[#2563EB]" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        ) : activeTab === 'exceptions' ? (
          <ExceptionsPanel
            issues={financeIssues}
            onBack={() => onSelectTab('overview')}
            onFix={onFixException}
            onViewAll={onViewAllExceptions}
          />
        ) : (
          <FinanceTabPanel tab={activeTab} onBack={() => onSelectTab('overview')} onFinanceAction={onFinanceAction} />
        )}
      </div>
    </div>
  );
}

function FinanceTabPanel({
  tab,
  onBack,
  onFinanceAction,
}: {
  tab: BankFinanceTabId;
  onBack: () => void;
  onFinanceAction: (actionId: string) => void;
}) {
  const tabMeta = tabs.find((item) => item.id === tab);
  const drillDowns: Partial<Record<BankFinanceTabId, string[]>> = {
    'bank-schedule': ['Schedule Generation', 'Employee Payment Schedule', 'Validation', 'Export'],
    'payment-files': ['Bank File Generation', 'File Validation', 'Export History'],
    'payroll-journal': ['Journal Mapping', 'Journal Posting', 'Posting History'],
    reconciliation: ['Bank Reconciliation', 'Payroll Reconciliation', 'Variance Review'],
  };
  const actions: Partial<Record<BankFinanceTabId, { label: string; action: string }>> = {
    'bank-schedule': { label: 'Generate Bank Schedule', action: 'generate-bank-schedule' },
    'payment-files': { label: 'Export Payment File', action: 'export-bank-file' },
    'payroll-journal': { label: 'Post Payroll Journal', action: 'post-run' },
    reconciliation: { label: 'Run Reconciliation', action: 'reconcile-bank-payment' },
  };
  const links = drillDowns[tab] || [];
  const primary = actions[tab];

  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-[#2563EB] hover:underline">
        ← Back to Overview
      </button>
      <h2 className="mt-4 text-2xl font-semibold">{tabMeta?.label || tab}</h2>
      <p className="mt-2 text-sm text-[#64748B]">Open the full {tabMeta?.label?.toLowerCase()} workspace for operational finance controls.</p>
      {links.length ? (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {links.map((label) => (
            <div key={label} className="rounded-xl border border-[#E5E7EB] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              {label}
            </div>
          ))}
        </div>
      ) : null}
      {primary ? (
        <button
          type="button"
          onClick={() => onFinanceAction(primary.action)}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
        >
          {primary.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </section>
  );
}

function ExceptionsPanel({
  issues,
  onBack,
  onFix,
  onViewAll,
}: {
  issues: FinanceException[];
  onBack: () => void;
  onFix: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <button type="button" onClick={onBack} className="text-sm font-semibold text-[#2563EB] hover:underline">
          ← Back to Overview
        </button>
        <h2 className="mt-4 text-2xl font-semibold">Exception Register</h2>
        <p className="mt-2 text-sm text-[#64748B]">Review and resolve finance exceptions before payment release and journal posting.</p>
      </div>
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{fmtNum(issues.length)} finance exceptions</h3>
          <button type="button" onClick={onViewAll} className="text-sm font-semibold text-[#2563EB] hover:underline">
            Open resolution workflow
            <ChevronRight className="ml-1 inline h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {issues.slice(0, 20).map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#0F172A]">{item.employeeName}</p>
                <p className="text-xs text-[#64748B]">{item.employeeId}</p>
                <p className="mt-1 text-sm text-slate-700">{item.issue}</p>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">
                  <SeverityBadge severity={item.severity} /> · {item.owner}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onFix(item.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#2563EB] hover:bg-blue-50"
              >
                Fix
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!issues.length ? <p className="text-sm font-semibold text-emerald-700">No finance exceptions found.</p> : null}
        </div>
      </div>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: 'Low' | 'Medium' | 'High' }) {
  const tones = {
    High: 'bg-red-100 text-red-800',
    Medium: 'bg-amber-100 text-amber-800',
    Low: 'bg-slate-100 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tones[severity]}`}>{severity}</span>;
}

function KpiCard({
  title,
  value,
  subtitle,
  tone,
  icon: Icon,
  actionLabel,
  onAction,
}: {
  title: string;
  value: string;
  subtitle: string;
  tone: 'blue' | 'green' | 'purple' | 'danger';
  icon: ComponentType<{ className?: string }>;
  actionLabel: string;
  onAction: () => void;
}) {
  const tones = {
    blue: { accent: '#2563EB', icon: 'bg-blue-50 text-[#2563EB]' },
    green: { accent: '#10B981', icon: 'bg-emerald-50 text-[#10B981]' },
    purple: { accent: '#8B5CF6', icon: 'bg-violet-50 text-[#8B5CF6]' },
    danger: { accent: '#EF4444', icon: 'bg-red-50 text-[#EF4444]' },
  };
  const palette = tones[tone];
  return (
    <article className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm" style={{ borderTopWidth: 4, borderTopColor: palette.accent }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#64748B]">{title}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${palette.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-[#0F172A]">{value}</p>
      <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>
      <button type="button" onClick={onAction} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#2563EB] hover:underline">
        {actionLabel}
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function WorkspaceCard({
  title,
  description,
  icon: Icon,
  status,
  tone,
  issues,
  onOpen,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  status: string;
  tone: 'green' | 'amber' | 'red';
  issues: FinanceException[];
  onOpen: () => void;
}) {
  const badge =
    tone === 'green' ? 'bg-emerald-100 text-emerald-800' : tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return (
    <article className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#0F172A]">
          <Icon className="h-5 w-5" />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge}`}>{status}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-[#64748B]">{description}</p>
      <p className="mt-3 text-xs font-semibold text-[#64748B]">
        Issues: <span className={issues.length > 0 ? 'text-amber-700' : 'text-emerald-700'}>{fmtNum(issues.length)}</span>
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-[#0F172A] hover:bg-slate-100"
      >
        Open Workspace
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}
