'use client';

import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, ShieldCheck } from 'lucide-react';

type RoleDef = { name: string; category: string; permissions: string[]; description: string };

export default function RolesPermissionsClient() {
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/roles', { cache: 'no-store' })
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (!res.ok) throw new Error(json.error || 'Unable to load roles');
        setRoles(json.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load roles'));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return roles.filter((role) => !q || [role.name, role.category, role.description, role.permissions.join(' ')].some((value) => value.toLowerCase().includes(q)));
  }, [query, roles]);
  const categories = Array.from(new Set(filtered.map((role) => role.category)));

  return (
    <div className="min-h-screen bg-white">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck className="h-6 w-6" /></span>
        <div>
          <h1 className="text-2xl font-black text-slate-950">Roles & Permissions</h1>
          <p className="mt-1 text-sm font-semibold text-slate-600">Enterprise RBAC catalog controlling module, page, action, approval, export, import, delete, configuration, and audit permissions.</p>
        </div>
      </div>
      {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, categories, permissions..." className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-500" />
      </div>
      <div className="mt-6 space-y-6">
        {categories.map((category) => (
          <section key={category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">{category}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {filtered.filter((role) => role.category === category).map((role) => (
                <div key={role.name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-black text-slate-950">{role.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{role.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {role.permissions.slice(0, 10).map((permission) => <span key={permission} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">{permission}</span>)}
                    {role.permissions.length > 10 ? <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-800">+{role.permissions.length - 10}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
