'use client';

import Link from 'next/link';
import { Download, FileSpreadsheet, Search, X } from 'lucide-react';

export type LeaveDrilldownRow = {
  employeeId: string;
  fullName: string;
  department: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  status?: string;
  stage?: string;
  metricLabel?: string;
  metricValue?: string | number;
};

export type LeaveDrilldownPanel = {
  title: string;
  note: string;
  rows: LeaveDrilldownRow[];
} | null;

const exportRows = (rows: LeaveDrilldownRow[], format: 'csv' | 'xls') => {
  const headers = ['Employee ID', 'Full Name', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Stage', 'Metric'];
  const body = rows.map((row) => [
    row.employeeId,
    row.fullName,
    row.department,
    row.leaveType || '',
    row.startDate || '',
    row.endDate || '',
    row.days ?? '',
    row.status || '',
    row.stage || '',
    row.metricLabel ? `${row.metricLabel}: ${row.metricValue ?? ''}` : String(row.metricValue ?? ''),
  ]);
  const csv = [headers, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: format === 'xls' ? 'application/vnd.ms-excel;charset=utf-8;' : 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `leave-drilldown.${format === 'xls' ? 'xls' : 'csv'}`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function LeaveDrilldownModal({
  panel,
  query,
  onQueryChange,
  onClose,
}: {
  panel: LeaveDrilldownPanel;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
}) {
  if (!panel) return null;

  const q = query.trim().toLowerCase();
  const filteredRows = !q
    ? panel.rows
    : panel.rows.filter((row) =>
        [row.employeeId, row.fullName, row.department, row.leaveType, row.status, row.stage, row.metricLabel, row.metricValue]
          .some((value) => String(value || '').toLowerCase().includes(q)),
      );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[86vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">{panel.title}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">{panel.note}</p>
            <p className="mt-1 text-xs font-bold text-[#2563EB]">{filteredRows.length} record(s) shown</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Close drilldown">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search employees, departments, leave types..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#2563EB]"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => exportRows(filteredRows, 'csv')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4" />
              CSV
            </button>
            <button type="button" onClick={() => exportRows(filteredRows, 'xls')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
              <Download className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto">
          {filteredRows.length ? (
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs font-extrabold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Days</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, index) => (
                  <tr key={`${row.employeeId}-${row.leaveType || 'row'}-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/hris/employees/employee-profile/${encodeURIComponent(row.employeeId)}`} className="font-extrabold text-slate-900 hover:text-[#2563EB]">
                        {row.fullName}
                      </Link>
                      <div className="text-xs font-semibold text-slate-500">{row.employeeId}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.department}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.leaveType || '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {row.startDate && row.endDate ? `${row.startDate} → ${row.endDate}` : row.startDate || row.endDate || '—'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.days ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700">{row.status || '—'}</div>
                      {row.stage ? <div className="text-xs text-slate-500">{row.stage}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {row.metricLabel ? `${row.metricLabel}: ${row.metricValue ?? '—'}` : row.metricValue ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No records match this metric.</p>
              <p className="mt-1 text-xs text-slate-500">The card count is derived from DLE_Enterprise leave tables for the current date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
