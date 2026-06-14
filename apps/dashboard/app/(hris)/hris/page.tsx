import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarCheck,
  Clock,
  FileText,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';

const quickLinks = [
  { title: 'Executive HR Dashboard', href: '/hris/dashboard/executive-hr-dashboard', icon: BarChart3, detail: 'Strategic workforce metrics and HR risk signals' },
  { title: 'HR Operations Dashboard', href: '/hris/dashboard/hr-operations-dashboard', icon: ShieldCheck, detail: 'Operational workload, compliance, attendance, and employee actions' },
  { title: 'Employee Directory', href: '/hris/employees/employee-directory', icon: Users, detail: 'Search employee records, departments, locations, and job details' },
  { title: 'Employee Profile', href: '/hris/employees/employee-profile', icon: UserRound, detail: 'Open personal, job, contact, document, and payroll profile records' },
  { title: 'Attendance Register', href: '/hris/attendance/attendance-register', icon: CalendarCheck, detail: 'Daily attendance, review status, payroll readiness, and exceptions' },
  { title: 'Timesheet Entry', href: '/hris/time-and-logs/timesheet-entry', icon: Clock, detail: 'Project time, overtime, employee self-service entries, and approvals' },
  { title: 'Payroll Dashboard', href: '/hris/payroll/payroll-dashboard', icon: Banknote, detail: 'Payroll setup, processing, approval, payslips, tax, and deductions' },
  { title: 'Documents', href: '/hris/employees/employee-documents', icon: FileText, detail: 'Employee documents, expiries, evidence, and controlled records' },
];

export default function HRISHomePage() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
              <Building2 className="h-4 w-4" />
              Human Resources Information System
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">HRIS Portal</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Fast access to HR dashboards, employee records, attendance, time logs, payroll, organization setup, and controlled HR workflows.
            </p>
          </div>
          <Link href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 hover:bg-slate-50">
            Enterprise Home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Fast Entry', 'No live data wait on portal open'],
          ['RBAC Ready', 'Access follows HRIS permissions'],
          ['Integrated', 'Payroll, attendance, documents, and workflows'],
          ['Operational', 'Jump directly to the work area you need'],
        ].map(([label, detail]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-normal text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-slate-700">{detail}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-950">Open HRIS Module</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Choose a work area. Heavy dashboards load only when selected.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-white">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-slate-200">
                  <item.icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600" />
              </div>
              <p className="mt-4 text-sm font-black text-slate-950 group-hover:text-blue-700">{item.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
