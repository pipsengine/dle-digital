import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';

const compact = (value: unknown) => String(value || '').trim();

export const contractEmployeeCode = (employee: Pick<DleEmployeeDirectoryRow, 'employeeId' | 'employeeCode' | 'sourceEmployeeId'>) => {
  const code = compact(employee.employeeCode || employee.employeeId || employee.sourceEmployeeId).toUpperCase();
  return /^C\d+/.test(code);
};

export const payrollCategoryText = (employee: DleEmployeeDirectoryRow) =>
  [employee.employmentType, employee.payrollGroup, employee.paymentRun, employee.paymentType, employee.staffCategory, employee.employeeCategory]
    .map(compact)
    .join(' ')
    .toLowerCase();

/** True when the employee is on attendance-driven daily / day-rate payroll. */
export const isDailyRatePayrollEmployee = (employee: DleEmployeeDirectoryRow, profileId?: string) => {
  if (profileId === 'contract-day-rate') return true;
  const text = payrollCategoryText(employee);
  if (/\bdaily\b|day\s*rate|dle\b/.test(text)) return true;
  if (contractEmployeeCode(employee) && Number(employee.ratePerDay || 0) > 0 && !Number(employee.periodSalary || 0)) return true;
  if (contractEmployeeCode(employee) && Number(employee.ratePerDay || 0) > 0 && /\bdaily\b|day\s*rate|dle\b/.test(text)) return true;
  return false;
};

/** C-coded staff who are not on daily-rate payroll should be inactive and excluded from payroll runs. */
export const isInactiveNonDailyContractEmployee = (employee: DleEmployeeDirectoryRow, profileId?: string) =>
  contractEmployeeCode(employee) && !isDailyRatePayrollEmployee(employee, profileId);

export const markInactiveNonDailyContractEmployees = (employees: DleEmployeeDirectoryRow[]) =>
  employees.map((employee) => {
    if (!isInactiveNonDailyContractEmployee(employee)) return employee;
    return {
      ...employee,
      status: 'Inactive',
      employmentType: employee.employmentType || 'Contract',
    };
  });

export const payrollActiveEmployees = (employees: DleEmployeeDirectoryRow[]) =>
  markInactiveNonDailyContractEmployees(employees).filter((employee) => !isInactiveNonDailyContractEmployee(employee));
