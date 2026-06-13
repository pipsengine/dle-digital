'use client';

import type { EmployeePromotionPayload, EmployeePromotionRecord, PromotionRisk } from '@/lib/employee-promotion-store';
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  RefreshCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRoundCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  initialPayload: EmployeePromotionPayload;
  initialEmployeeId?: string;
  initialError?: string | null;
};

const toneClasses: Record<PromotionRisk, string> = {
  High: 'border-rose-200 bg-rose-50 text-rose-700',
  Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  Low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not set';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

const csvEscape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const downloadCsv = (records: EmployeePromotionRecord[]) => {
  const columns: Array<[string, keyof EmployeePromotionRecord]> = [
    ['Employee ID', 'employeeId'],
    ['Employee Name', 'employeeName'],
    ['Department', 'department'],
    ['Job Title', 'jobTitle'],
    ['Grade', 'jobGrade'],
    ['Service Years', 'serviceYears'],
    ['Stage', 'stage'],
    ['Readiness', 'readiness'],
    ['Promotion Band', 'promotionBand'],
    ['Risk', 'risk'],
    ['Manager', 'managerName'],
  ];
  const csv = [
    columns.map(([label]) => csvEscape(label)).join(','),
    ...records.map((record) => columns.map(([, key]) => csvEscape(record[key])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `employee-promotion-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const MetricCard = ({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: React.ReactNode;
  tone: 'blue' | 'amber' | 'rose' | 'emerald';
}) => {
  const palette = {
    blue: 'border-sky-100 bg-sky-50/80 text-sky-700',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-700',
    rose: 'border-rose-100 bg-rose-50/80 text-rose-700',
    emerald: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold text-slate-950">{value.toLocaleString('en-NG')}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${palette}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{helper}</p>
    </div>
  );
};

export default function EmployeePromotionClient({ initialPayload, initialEmployeeId, initialError }: Props) {
  const router = useRouter();
  const [payload, setPayload] = useState(initialPayload);
  const [error, setError] = useState(initialError || '');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All');
  const [stage, setStage] = useState('All');
  const [readiness, setReadiness] = useState('All');
  const [risk, setRisk] = useState('All');
  const [grade, setGrade] = useState('All');
  const [selectedId, setSelectedId] = useState(initialEmployeeId || initialPayload.records[0]?.employeeId || '');

  const filteredRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payload.records.filter((record) => {
      const matchesQuery =
        !needle ||
        [record.employeeId, record.employeeName, record.jobTitle, record.jobGrade, record.department, record.location, record.managerName, record.stage]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return (
        matchesQuery &&
        (department === 'All' || record.department === department) &&
        (stage === 'All' || record.stage === stage) &&
        (readiness === 'All' || record.readiness === readiness) &&
        (risk === 'All' || record.risk === risk) &&
        (grade === 'All' || record.jobGrade === grade)
      );
    });
  }, [department, grade, payload.records, query, readiness, risk, stage]);

  const selected = useMemo(
    () => filteredRecords.find((record) => record.employeeId === selectedId) || filteredRecords[0] || payload.records.find((record) => record.employeeId === selectedId) || null,
    [filteredRecords, payload.records, selectedId],
  );

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/employees/employee-promotion', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Unable to refresh employee promotion records.');
      setPayload(data as EmployeePromotionPayload);
    } catch (err: any) {
      setError(err?.message || 'Unable to refresh employee promotion records.');
    } finally {
      setLoading(false);
    }
  };

  const openProfile = (employeeId: string) => router.push(`/hris/employees/employee-profile/${encodeURIComponent(employeeId)}`);
  const openStatus = (employeeId: string) => router.push(`/hris/employees/employee-status?employeeId=${encodeURIComponent(employeeId)}`);

  const checklist = selected
    ? [
        { label: 'Service eligibility', done: selected.serviceYears >= 3, detail: `${selected.serviceYears.toFixed(1)} year${selected.serviceYears === 1 ? '' : 's'} of service` },
        { label: 'Manager assigned', done: selected.managerAssigned, detail: selected.managerName },
        { label: 'Job grade available', done: selected.jobGrade !== 'Not assigned', detail: selected.jobGrade },
        { label: 'Documents available', done: selected.documentsStatus === 'Complete', detail: selected.documentsStatus },
        { label: 'HR partner assigned', done: selected.hrBusinessPartner !== 'Not assigned', detail: selected.hrBusinessPartner },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6 text-slate-900">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                <TrendingUp className="h-4 w-4" />
                HRIS / Employees
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">Employee Promotion</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                Review promotion eligibility, grade readiness, manager accountability, and supporting controls from the system HRIS database.
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Source: {payload.source} · Last refreshed {formatDate(payload.generatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => downloadCsv(filteredRecords)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button type="button" onClick={refresh} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60">
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          {error ? <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Monitored Records" value={payload.summary.totalMonitored} helper="Employees in promotion review view" icon={<BriefcaseBusiness className="h-5 w-5" />} tone="blue" />
          <MetricCard label="Eligible Review" value={payload.summary.eligibleReview} helper="3+ years service or ready for review" icon={<TrendingUp className="h-5 w-5" />} tone="amber" />
          <MetricCard label="Needs Data" value={payload.summary.incomplete} helper="Missing grade, manager, or evidence" icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
          <MetricCard label="Ready" value={payload.summary.ready} helper="Ready for promotion review" icon={<BadgeCheck className="h-5 w-5" />} tone="emerald" />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr_1fr_1fr_1fr_1fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employee, grade, department, manager..." className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100" />
            </label>
            {[
              ['Department', department, setDepartment, payload.filterOptions.departments],
              ['Stage', stage, setStage, payload.filterOptions.stages],
              ['Readiness', readiness, setReadiness, payload.filterOptions.readiness],
              ['Risk', risk, setRisk, payload.filterOptions.risks],
              ['Grade', grade, setGrade, payload.filterOptions.grades],
            ].map(([label, value, setter, options]) => (
              <label key={label as string} className="block">
                <span className="sr-only">{label as string}</span>
                <select value={value as string} onChange={(event) => (setter as (next: string) => void)(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100">
                  <option value="All">All {label as string}</option>
                  {(options as string[]).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.75fr)]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">Promotion Registry</h2>
                <p className="text-sm text-slate-500">Double-click a row to open the employee profile.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Showing {filteredRecords.length.toLocaleString('en-NG')}</span>
            </div>
            <div className="max-h-[660px] overflow-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Readiness</th>
                    <th className="px-4 py-3">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((record) => {
                    const active = selected?.employeeId === record.employeeId;
                    return (
                      <tr key={record.employeeId} onClick={() => setSelectedId(record.employeeId)} onDoubleClick={() => openProfile(record.employeeId)} className={`cursor-pointer transition ${active ? 'bg-sky-50/80' : 'hover:bg-slate-50'}`} title="Double-click to open employee profile">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-950">{record.employeeName}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{record.employeeId} · {record.jobTitle}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800">{record.department}</p>
                          <p className="mt-1 text-xs text-slate-500">{record.location}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">{record.jobGrade}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800">{record.serviceYears.toFixed(1)} years</p>
                          <p className="mt-1 text-xs text-slate-500">{record.monthsToReview > 0 ? `${record.monthsToReview} month${record.monthsToReview === 1 ? '' : 's'} to review` : 'Review due'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">{record.stage}</span>
                          <p className="mt-2 text-xs text-slate-500">{record.promotionBand}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{record.readiness}</td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClasses[record.risk]}`}>{record.risk}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-slate-500">
                          <UserRoundCheck className="h-10 w-10 text-slate-300" />
                          <p className="font-semibold text-slate-700">No promotion records match the current filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-bold text-slate-950">Promotion Detail</h2>
                <p className="text-sm text-slate-500">Selected employee readiness and review controls.</p>
              </div>
              {selected ? (
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-950">{selected.employeeName}</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{selected.employeeId} · {selected.jobTitle}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${toneClasses[selected.risk]}`}>{selected.risk}</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">Current Grade</p>
                      <p className="mt-1 font-bold text-slate-900">{selected.jobGrade}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">Date Joined</p>
                      <p className="mt-1 font-bold text-slate-900">{formatDate(selected.dateJoined)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">Manager</p>
                      <p className="mt-1 font-bold text-slate-900">{selected.managerName}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-normal text-slate-500">HR Partner</p>
                      <p className="mt-1 font-bold text-slate-900">{selected.hrBusinessPartner}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-bold">{selected.riskReason}</p>
                        <p className="mt-1">Use employee status or profile workflows to complete approvals and personnel updates.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <h4 className="text-sm font-bold text-slate-950">Readiness Checklist</h4>
                    <div className="mt-3 space-y-3">
                      {checklist.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <div className="flex items-center gap-3">
                            {item.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <FileCheck2 className="h-5 w-5 text-amber-600" />}
                            <div>
                              <p className="text-sm font-bold text-slate-800">{item.label}</p>
                              <p className="text-xs font-medium text-slate-500">{item.detail}</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.done ? 'Ready' : 'Open'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => openProfile(selected.employeeId)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:border-sky-200 hover:text-sky-700">
                      <ExternalLink className="h-4 w-4" />
                      Open Profile
                    </button>
                    <button type="button" onClick={() => openStatus(selected.employeeId)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-bold text-white hover:bg-slate-800">
                      <ShieldCheck className="h-4 w-4" />
                      Update Status
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-sm font-semibold text-slate-500">Select an employee promotion record to inspect readiness.</div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-base font-bold text-slate-950">Promotion Insights</h2>
                <p className="text-sm text-slate-500">Priority observations from system records.</p>
              </div>
              <div className="space-y-3 p-5">
                {payload.insights.map((insight) => (
                  <div key={insight.id} className={`rounded-lg border p-4 ${toneClasses[insight.tone]}`}>
                    <p className="font-bold">{insight.title}</p>
                    <p className="mt-1 text-sm opacity-90">{insight.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
