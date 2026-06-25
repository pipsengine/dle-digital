'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import TaxPayeCommandCenter, { type TaxPayePayload } from './TaxPayeCommandCenter';

type Role = 'Payroll Officer' | 'Finance Controller' | 'HR Director' | 'HR Manager' | 'Executive Management' | 'Auditor' | 'Employee';
type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

export default function TaxPayeClient({ initialNow }: { initialNow: string }) {
  const [role, setRole] = useState<Role>('Payroll Officer');
  const [payload, setPayload] = useState<TaxPayePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hris/payroll/tax-paye', { headers: { 'x-hris-role': role }, cache: 'no-store' });
      const json = (await res.json()) as ApiResponse<TaxPayePayload>;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || `PAYE request failed (${res.status})`);
      setPayload(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load PAYE tax engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [role]);

  return (
    <TaxPayeCommandCenter
      payload={payload}
      loading={loading}
      error={error}
      role={role}
      onRoleChange={(value) => setRole(value as Role)}
      onRefresh={() => void load()}
      onExport={() => {
        window.location.href = '/api/hris/payroll/tax-paye?format=csv';
      }}
      lastLoaded={payload?.generatedAt || initialNow}
    />
  );
}
