import type { DleEmployeeDirectoryRow } from './dle-enterprise-db';
import { readPayrollEmployees } from './payroll-employee-source';

export type ExitRisk = 'Low' | 'Medium' | 'High';
export type ExitStage = 'Active Monitoring' | 'Due Soon' | 'In Clearance' | 'Payroll Closure' | 'Closed';
export type ClearanceStatus = 'Not Started' | 'In Progress' | 'Pending Payroll' | 'Complete' | 'Overdue';

export type EmployeeExitStatusRecord = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  jobTitle: string;
  department: string;
  division: string;
  businessUnit: string;
  costCenter: string;
  location: string;
  managerName: string;
  hrBusinessPartner: string;
  employmentType: string;
  currentStatus: string;
  exitCategory: string;
  exitStage: ExitStage;
  exitDate: string | null;
  noticeDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  daysToExit: number | null;
  daysSinceExit: number | null;
  clearanceStatus: ClearanceStatus;
  payrollStatus: 'Active' | 'Monitor' | 'Final Settlement Due' | 'Closed';
  accessStatus: 'Active' | 'Review Required' | 'Restricted';
  documentStatus: 'Missing' | 'Partial' | 'Complete';
  risk: ExitRisk;
  riskReason: string;
  serviceYears: number;
  documentCount: number;
  emergencyContactCount: number;
  lastUpdated: string;
};

export type EmployeeExitStatusPayload = {
  generatedAt: string;
  source: string;
  records: EmployeeExitStatusRecord[];
  summary: {
    totalMonitored: number;
    exitedEmployees: number;
    dueSoon: number;
    pendingClearance: number;
    finalSettlementDue: number;
    overdueClearance: number;
    closed: number;
    highRisk: number;
  };
  filterOptions: {
    departments: string[];
    locations: string[];
    categories: string[];
    stages: ExitStage[];
    risks: ExitRisk[];
  };
  insights: Array<{ id: string; tone: ExitRisk; title: string; detail: string }>;
};

const EXIT_STATUSES = new Set(['terminated', 'resigned', 'retired', 'exited', 'deceased', 'inactive']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dateOnly = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const daysBetween = (from: Date, to: Date) => Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);

const titleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const classifyCategory = (row: DleEmployeeDirectoryRow, hasExitStatus: boolean) => {
  const status = row.status.toLowerCase();
  if (status.includes('resign')) return 'Resignation';
  if (status.includes('terminat')) return 'Termination';
  if (status.includes('retir')) return 'Retirement';
  if (status.includes('deceased')) return 'Deceased';
  if (status.includes('inactive') || status.includes('exit')) return 'Exited';
  if (row.contractEndDate && !hasExitStatus) return 'Contract Expiry';
  return 'Active Monitoring';
};

const deriveRecord = (row: DleEmployeeDirectoryRow, now: Date): EmployeeExitStatusRecord | null => {
  const status = row.status || 'Inactive';
  const hasExitStatus = EXIT_STATUSES.has(status.toLowerCase());
  const contractEnd = dateOnly(row.contractEndDate);
  const contractEndDate = contractEnd ? new Date(`${contractEnd}T00:00:00.000Z`) : null;
  const contractDays = contractEndDate ? daysBetween(now, contractEndDate) : null;
  const shouldMonitorContract = contractDays !== null && contractDays <= 90;

  if (!hasExitStatus && !shouldMonitorContract) return null;

  const exitDate = hasExitStatus ? dateOnly(row.modifiedAt) || contractEnd || dateOnly(row.createdAt) : contractEnd;
  const exitDateObject = exitDate ? new Date(`${exitDate}T00:00:00.000Z`) : null;
  const daysToExit = exitDateObject ? Math.max(0, daysBetween(now, exitDateObject)) : null;
  const daysSinceExit = exitDateObject ? Math.max(0, daysBetween(exitDateObject, now)) : null;
  const isPastExit = Boolean(exitDateObject && exitDateObject.getTime() <= now.getTime());
  const isDueSoon = !isPastExit && daysToExit !== null && daysToExit <= 30;

  let clearanceStatus: ClearanceStatus = 'Not Started';
  if (isPastExit && daysSinceExit !== null) {
    if (daysSinceExit > 45 && row.documentCount > 0) clearanceStatus = 'Complete';
    else if (daysSinceExit > 14 && row.documentCount === 0) clearanceStatus = 'Overdue';
    else if (daysSinceExit > 7) clearanceStatus = 'Pending Payroll';
    else clearanceStatus = 'In Progress';
  } else if (isDueSoon) {
    clearanceStatus = 'In Progress';
  }

  const payrollStatus =
    clearanceStatus === 'Complete' ? 'Closed' : isPastExit ? 'Final Settlement Due' : isDueSoon ? 'Monitor' : 'Active';
  const accessStatus = isPastExit ? (clearanceStatus === 'Complete' ? 'Restricted' : 'Review Required') : 'Active';
  const documentStatus = row.documentCount <= 0 ? 'Missing' : row.documentCount < 3 ? 'Partial' : 'Complete';

  let exitStage: ExitStage = 'Active Monitoring';
  if (clearanceStatus === 'Complete') exitStage = 'Closed';
  else if (payrollStatus === 'Final Settlement Due' || clearanceStatus === 'Pending Payroll') exitStage = 'Payroll Closure';
  else if (isPastExit || clearanceStatus === 'In Progress' || clearanceStatus === 'Overdue') exitStage = 'In Clearance';
  else if (isDueSoon) exitStage = 'Due Soon';

  let risk: ExitRisk = 'Low';
  let riskReason = 'Exit record is within expected monitoring controls.';
  if (clearanceStatus === 'Overdue' || (isPastExit && payrollStatus !== 'Closed') || documentStatus === 'Missing') {
    risk = 'High';
    riskReason = clearanceStatus === 'Overdue' ? 'Clearance is overdue.' : documentStatus === 'Missing' ? 'Exit documents are missing.' : 'Final settlement is still open.';
  } else if (isDueSoon || clearanceStatus === 'In Progress' || documentStatus === 'Partial') {
    risk = 'Medium';
    riskReason = isDueSoon ? 'Exit or contract end is due within 30 days.' : 'Clearance evidence is still being completed.';
  }

  return {
    id: row.employeeId,
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    employeeName: row.fullName,
    jobTitle: row.jobTitle,
    department: row.department,
    division: row.division,
    businessUnit: row.businessUnit,
    costCenter: row.costCenter || 'Not recorded',
    location: row.location,
    managerName: row.managerName || 'Not assigned',
    hrBusinessPartner: row.hrBusinessPartner || 'Not assigned',
    employmentType: row.employmentType,
    currentStatus: status,
    exitCategory: classifyCategory(row, hasExitStatus),
    exitStage,
    exitDate,
    noticeDate: hasExitStatus ? dateOnly(row.modifiedAt) : null,
    contractStartDate: dateOnly(row.contractStartDate),
    contractEndDate: contractEnd,
    daysToExit: exitDateObject && exitDateObject.getTime() > now.getTime() ? daysToExit : null,
    daysSinceExit: exitDateObject && exitDateObject.getTime() <= now.getTime() ? daysSinceExit : null,
    clearanceStatus,
    payrollStatus,
    accessStatus,
    documentStatus,
    risk,
    riskReason,
    serviceYears: row.yearsOfService,
    documentCount: row.documentCount,
    emergencyContactCount: row.emergencyContactCount,
    lastUpdated: row.modifiedAt || row.createdAt,
  };
};

export const readEmployeeExitStatusFromDb = async (): Promise<EmployeeExitStatusPayload> => {
  const now = new Date();
  const employeeSource = await readPayrollEmployees();
  const employees = employeeSource.employees;
  const records = employees
    .map((row) => deriveRecord(row, now))
    .filter((row): row is EmployeeExitStatusRecord => Boolean(row))
    .sort((a, b) => {
      const riskWeight: Record<ExitRisk, number> = { High: 0, Medium: 1, Low: 2 };
      const byRisk = riskWeight[a.risk] - riskWeight[b.risk];
      if (byRisk !== 0) return byRisk;
      return (a.exitDate || '9999-12-31').localeCompare(b.exitDate || '9999-12-31');
    });

  const summary = {
    totalMonitored: records.length,
    exitedEmployees: records.filter((r) => EXIT_STATUSES.has(r.currentStatus.toLowerCase())).length,
    dueSoon: records.filter((r) => r.exitStage === 'Due Soon').length,
    pendingClearance: records.filter((r) => ['In Progress', 'Pending Payroll'].includes(r.clearanceStatus)).length,
    finalSettlementDue: records.filter((r) => r.payrollStatus === 'Final Settlement Due').length,
    overdueClearance: records.filter((r) => r.clearanceStatus === 'Overdue').length,
    closed: records.filter((r) => r.exitStage === 'Closed').length,
    highRisk: records.filter((r) => r.risk === 'High').length,
  };

  const insights: EmployeeExitStatusPayload['insights'] = [];
  if (summary.highRisk > 0) {
    insights.push({
      id: 'high-risk',
      tone: 'High',
      title: `${summary.highRisk} high-risk exit record${summary.highRisk === 1 ? '' : 's'}`,
      detail: 'Review missing documents, final settlement, and overdue clearance items first.',
    });
  }
  if (summary.dueSoon > 0) {
    insights.push({
      id: 'due-soon',
      tone: 'Medium',
      title: `${summary.dueSoon} contract or exit date${summary.dueSoon === 1 ? '' : 's'} due within 30 days`,
      detail: 'Start clearance preparation early to avoid payroll and access delays.',
    });
  }
  if (summary.finalSettlementDue > 0) {
    insights.push({
      id: 'settlement',
      tone: 'Medium',
      title: `${summary.finalSettlementDue} final settlement${summary.finalSettlementDue === 1 ? '' : 's'} still open`,
      detail: 'Coordinate HR, payroll, and finance closure before marking exit complete.',
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: 'stable',
      tone: 'Low',
      title: 'No urgent exit exceptions detected',
      detail: 'Current monitored exit records are within normal control thresholds.',
    });
  }

  return {
    generatedAt: now.toISOString(),
    source: employeeSource.source,
    records,
    summary,
    filterOptions: {
      departments: uniqueSorted(records.map((r) => r.department)),
      locations: uniqueSorted(records.map((r) => r.location)),
      categories: uniqueSorted(records.map((r) => r.exitCategory)),
      stages: ['Active Monitoring', 'Due Soon', 'In Clearance', 'Payroll Closure', 'Closed'],
      risks: ['High', 'Medium', 'Low'],
    },
    insights,
  };
};
