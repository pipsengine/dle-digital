'use client';

import { Download, Printer } from 'lucide-react';
import Image from 'next/image';

const workflowImage = '/payroll/payroll-computation-approval-workflow.png';

export default function PayrollWorkflowClient() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 sm:p-6 print:bg-white print:p-0">
      <section className="mx-auto max-w-[1800px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-black tracking-normal text-slate-950">Payroll Computation & Approval Workflow</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">End-to-end payroll process with multi-level approval and audit control.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={workflowImage}
              download="payroll-computation-approval-workflow.png"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-800"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <Image
            src={workflowImage}
            alt="Payroll computation and approval workflow infographic"
            width={1536}
            height={1024}
            priority
            sizes="100vw"
            className="mx-auto h-auto w-full max-w-none rounded-lg print:rounded-none"
          />
        </div>
      </section>
    </main>
  );
}
