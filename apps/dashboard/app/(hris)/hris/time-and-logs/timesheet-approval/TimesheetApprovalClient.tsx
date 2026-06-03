'use client';

import { useEffect, useState } from 'react';
import { PageTemplate } from '@/components/layout/page-template';
import {
  CheckCircle2,
  Clock,
  Filter,
  Search,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Users,
  Calendar,
  ArrowRight,
  RefreshCcw,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import Link from 'next/link';

type TimesheetStatus = 'Draft' | 'Submitted' | 'HR_Reviewed' | 'Project_Control_Reviewed' | 'Approved' | 'Locked' | 'Rejected';

type TimesheetSummary = {
  id: string;
  timesheetDate: string;
  supervisorName: string;
  workCenterName: string;
  status: TimesheetStatus;
  totalEmployees: number;
  totalHours: number;
  submittedAt: string | null;
  lastSyncAt: string | null;
  periodName: string;
};

type ApprovalPayload = {
  pendingTimesheets: TimesheetSummary[];
  stats: {
    totalPending: number;
    hrReviewCount: number;
    projectControlCount: number;
    opsApprovalCount: number;
  };
  filterOptions: {
    workCenters: string[];
    periods: string[];
    supervisors: string[];
  };
};

export default function TimesheetApprovalClient() {
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TimesheetStatus | 'All'>('All');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hris/time-and-logs/timesheet-approval');
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Failed to load approvals');
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredTimesheets = payload?.pendingTimesheets.filter(t => {
    const matchesQuery = t.supervisorName.toLowerCase().includes(query.toLowerCase()) || 
                         t.workCenterName.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchesQuery && matchesStatus;
  }) || [];

  if (loading && !payload) {
    return (
      <PageTemplate 
        title="Timesheet Approvals" 
        description="Review and approve team timesheets."
        breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Time & Logs', href: '/hris/time-and-logs' }, { label: 'Approvals' }]}
      >
        <div className="flex h-96 items-center justify-center"><RefreshCcw className="h-8 w-8 animate-spin text-slate-400" /></div>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate
      title="Timesheet Approvals"
      description="Centralized workflow for HR, Project Controls, and Operations to review daily timesheets."
      breadcrumbs={[{ label: 'HRIS', href: '/hris' }, { label: 'Time & Logs', href: '/hris/time-and-logs' }, { label: 'Approvals' }]}
      primaryAction={{ label: 'Refresh', onClick: load, icon: RefreshCcw }}
    >
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Pending', value: payload?.stats.totalPending, color: 'indigo', icon: Clock },
            { label: 'HR Review', value: payload?.stats.hrReviewCount, color: 'amber', icon: FileText },
            { label: 'Project Control', value: payload?.stats.projectControlCount, color: 'blue', icon: ShieldCheck },
            { label: 'Ops Approval', value: payload?.stats.opsApprovalCount, color: 'emerald', icon: ThumbsUp },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className={`rounded-xl bg-${stat.color}-50 p-2.5 text-${stat.color}-600`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by supervisor or site..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" 
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['All', 'Submitted', 'HR_Reviewed', 'Project_Control_Reviewed', 'Rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === status 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Timesheet List */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Working Date & Site</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Supervisor</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Team Size</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Total Hours</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500">Status</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTimesheets.length > 0 ? (
                  filteredTimesheets.map((ts) => (
                    <tr key={ts.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900">{ts.timesheetDate}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{ts.workCenterName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 text-[10px] font-black uppercase">
                            {ts.supervisorName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-bold text-slate-700">{ts.supervisorName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 opacity-40" />
                          {ts.totalEmployees} Crew
                        </div>
                      </td>
                      <td className="px-6 py-5 font-black text-slate-900 tabular-nums">
                        {ts.totalHours}h
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter border ${
                          ts.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          ts.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                          ts.status === 'Submitted' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {ts.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Link 
                          href={`/hris/time-and-logs/timesheet-entry?date=${ts.timesheetDate}&supervisorId=${ts.supervisorName}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all shadow-sm"
                        >
                          Review <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <FileText className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">No timesheets found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}
