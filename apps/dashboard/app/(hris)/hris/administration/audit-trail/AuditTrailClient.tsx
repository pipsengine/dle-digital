'use client';

import { useEffect, useState } from 'react';
import { History, ShieldAlert } from 'lucide-react';

type Audit = { id: string; user: string; action: string; at: string; ipAddress: string; device: string; oldValue?: string | null; newValue?: string | null; performedBy: string };
type Login = { id: string; username: string; at: string; ipAddress: string; device: string; status: string; reason?: string };

export default function AuditTrailClient() {
  const [audit, setAudit] = useState<Audit[]>([]);
  const [logins, setLogins] = useState<Login[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/audit', { cache: 'no-store' })
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (!res.ok) throw new Error(json.error || 'Unable to load audit log');
        setAudit(json.data.audit || []);
        setLogins(json.data.loginHistory || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load audit log'));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white"><ShieldAlert className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-black text-slate-950">Security Audit Trail</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">Login, logout, failed login, password, user, role, permission, and access-control security events.</p>
        </div>
      </div>
      {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /><h2 className="text-base font-black text-slate-950">Security Actions</h2></div>
        <div className="mt-4 space-y-2">
          {audit.slice(0, 200).map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-950">{item.action} / {item.user}</p>
                <span className="text-xs font-bold text-slate-500">{new Date(item.at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-600">{item.performedBy} / {item.ipAddress} / {item.device}</p>
              {item.newValue ? <p className="mt-1 text-xs font-bold text-slate-700">{item.newValue}</p> : null}
            </div>
          ))}
          {!audit.length ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No security audit records yet.</p> : null}
        </div>
      </section>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-black text-slate-950">Login History</h2>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {logins.slice(0, 200).map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700">{item.username} / {item.status} / {new Date(item.at).toLocaleString()} / {item.ipAddress} / {item.reason || 'OK'}</div>)}
          {!logins.length ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">No login records yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
