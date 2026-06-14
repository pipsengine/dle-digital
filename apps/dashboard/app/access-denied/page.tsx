import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700"><ShieldAlert className="h-7 w-7" /></span>
        <h1 className="mt-5 text-2xl font-black text-slate-950">Access Denied</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Your current role does not have permission to access this page or enterprise function.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">Enterprise Home</Link>
          <Link href="/api/auth/logout" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">Switch Account</Link>
        </div>
      </section>
    </main>
  );
}
