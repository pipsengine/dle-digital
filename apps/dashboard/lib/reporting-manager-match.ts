import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { normalizePayrollMatchKey } from '@/lib/sage-people-payroll-store';

const clean = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const employeeCodeFromReference = (reference: string) => {
  const value = clean(reference);
  if (!value) return '';
  const prefixed = value.match(/^([A-Z]{0,5}0*\d+)\s*-/i);
  if (prefixed?.[1]) return prefixed[1].toUpperCase();
  const embedded = value.match(/\b(P\d+|L\d+|NYSC\d+|C\d+|IT\d+)\b/i);
  return embedded?.[1]?.toUpperCase() || '';
};

const nameTokensMatch = (left: string, right: string) => {
  const a = clean(left).toLowerCase();
  const b = clean(right).toLowerCase();
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

export const employeeReportsToManager = (
  employee: Pick<DleEmployeeDirectoryRow, 'managerName' | 'functionalManager' | 'departmentHead'>,
  manager: Pick<DleEmployeeDirectoryRow, 'fullName' | 'employeeCode' | 'employeeId'>,
) => {
  const managerCode = normalizePayrollMatchKey(manager.employeeCode || manager.employeeId);
  const managerName = clean(manager.fullName).toLowerCase();
  const references = [employee.managerName, employee.functionalManager, employee.departmentHead].map(clean).filter(Boolean);

  return references.some((reference) => {
    const refCode = employeeCodeFromReference(reference);
    if (refCode && managerCode && normalizePayrollMatchKey(refCode) === managerCode) return true;
    if (managerCode && normalizePayrollMatchKey(reference) === managerCode) return true;
    const embeddedName = reference.includes(' - ') ? clean(reference.split(' - ').slice(1).join(' - ')) : reference;
    return nameTokensMatch(managerName, embeddedName) || nameTokensMatch(managerName, reference);
  });
};
