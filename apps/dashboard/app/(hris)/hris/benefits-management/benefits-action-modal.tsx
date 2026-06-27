'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { inputClass } from './benefits-management-ui';

export type BenefitActionKind =
  | 'create-plan'
  | 'create-enrollment'
  | 'create-claim'
  | 'create-rule'
  | 'create-provider';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'select'; options?: string[]; required?: boolean };

const actionFields: Record<BenefitActionKind, { title: string; fields: Field[] }> = {
  'create-plan': {
    title: 'Add Benefit Plan',
    fields: [
      { key: 'name', label: 'Plan Name', required: true },
      { key: 'type', label: 'Plan Type', type: 'select', options: ['Medical', 'Insurance', 'Pension', 'Welfare', 'Allowance'], required: true },
      { key: 'provider', label: 'Provider', required: true },
      { key: 'eligibility', label: 'Eligibility', required: true },
    ],
  },
  'create-enrollment': {
    title: 'Enroll Employee',
    fields: [
      { key: 'employeeId', label: 'Employee ID', required: true },
      { key: 'planName', label: 'Plan Name', required: true },
      { key: 'planType', label: 'Plan Type', type: 'select', options: ['Medical', 'Insurance', 'Pension', 'Welfare', 'Allowance'], required: true },
    ],
  },
  'create-claim': {
    title: 'Submit Benefit Claim',
    fields: [
      { key: 'employeeId', label: 'Employee ID', required: true },
      { key: 'planName', label: 'Plan Name', required: true },
      { key: 'claimType', label: 'Claim Type', required: true },
      { key: 'amount', label: 'Amount (NGN)', type: 'number', required: true },
      { key: 'description', label: 'Description', required: true },
    ],
  },
  'create-rule': {
    title: 'Add Eligibility Rule',
    fields: [
      { key: 'name', label: 'Rule Name', required: true },
      { key: 'criteria', label: 'Criteria', required: true },
      { key: 'appliesTo', label: 'Applies To', required: true },
    ],
  },
  'create-provider': {
    title: 'Add Provider',
    fields: [
      { key: 'name', label: 'Provider Name', required: true },
      { key: 'type', label: 'Provider Type', required: true },
      { key: 'contactPerson', label: 'Contact Person' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ],
  },
};

export function BenefitsActionModal({
  kind,
  open,
  busy,
  onClose,
  onSubmit,
}: {
  kind: BenefitActionKind | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (kind: BenefitActionKind, data: Record<string, string>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && kind) setForm({});
  }, [open, kind]);

  if (!open || !kind) return null;
  const config = actionFields[kind];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-[20px] border border-[#E5E7EB] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">{config.title}</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Saved to DLE_Enterprise HRIS database.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E5E7EB] p-2 text-[#6B7280] hover:bg-[#F8FAFC]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          {config.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-sm font-medium text-[#374151]">{field.label}</span>
              {field.type === 'select' ? (
                <select
                  className={inputClass}
                  value={form[field.key] || field.options?.[0] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                >
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  className={inputClass}
                  value={form[field.key] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#6B7280] hover:bg-[#F8FAFC]">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const missing = config.fields.filter((field) => field.required && !String(form[field.key] || '').trim());
              if (missing.length) return;
              onSubmit(kind, form);
            }}
            className="h-11 rounded-xl bg-[#4F46E5] px-4 text-sm font-semibold text-white hover:bg-[#4338CA] disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
