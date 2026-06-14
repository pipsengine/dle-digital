'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { passwordPolicyErrors } from '@/lib/auth/session';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const next = useMemo(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('next') || '', []);
  const policy = passwordPolicyErrors(newPassword);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.error || 'Unable to change password.');
      window.location.assign(json.data.redirectTo || next || '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><KeyRound className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-black text-slate-950">Change Password</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">First login and password resets must be completed before accessing the application.</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {[
            ['Current Password', currentPassword, setCurrentPassword, 'current-password'],
            ['New Password', newPassword, setNewPassword, 'new-password'],
            ['Confirm New Password', confirmPassword, setConfirmPassword, 'new-password'],
          ].map(([label, value, setter, autoComplete]) => (
            <label key={String(label)} className="block">
              <span className="text-xs font-black uppercase text-slate-600">{String(label)}</span>
              <span className="mt-2 flex h-12 items-center rounded-xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                <input value={String(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} required type={show ? 'text' : 'password'} autoComplete={String(autoComplete)} className="h-full min-w-0 flex-1 rounded-xl px-4 text-sm font-bold outline-none" />
                <button type="button" onClick={() => setShow((item) => !item)} className="mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-50" aria-label={show ? 'Hide passwords' : 'Show passwords'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
          ))}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black uppercase text-slate-600">Password Policy</p>
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {['Minimum 8 characters', 'At least 1 uppercase letter', 'At least 1 lowercase letter', 'At least 1 digit', 'At least 1 special character'].map((rule) => {
                const ok = !policy.includes(rule);
                return <span key={rule} className={`inline-flex items-center gap-2 text-xs font-bold ${ok ? 'text-emerald-700' : 'text-slate-500'}`}><CheckCircle2 className="h-3.5 w-3.5" />{rule}</span>;
              })}
            </div>
          </div>
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
          <button disabled={loading || policy.length > 0 || newPassword !== confirmPassword} className="h-12 w-full rounded-xl bg-slate-950 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? 'Updating password' : 'Update Password'}
          </button>
        </form>
      </section>
    </main>
  );
}
