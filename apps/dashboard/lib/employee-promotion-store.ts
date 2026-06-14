import type { DleEmployeeDirectoryRow } from './dle-enterprise-db';
import { readPayrollEmployees } from './payroll-employee-source';

export type PromotionRisk = 'Low' | 'Medium' | 'High';
export type PromotionStage = 'Eligible Review' | 'Due Review' | 'Not Yet Due' | 'Recently Confirmed' | 'Needs Data';
export type PromotionReadiness = 'Ready' | 'Needs Review' | 'Incomplete';

export type EmployeePromotionRecord = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  jobTitle: string;
  designation: string;
  jobGrade: string;
  department: string;
  division: string;
  businessUnit: string;
  location: string;
  managerName: string;
  hrBusinessPartner: string;
  employmentType: string;
  currentStatus: string;
  dateJoined: string | null;
  serviceYears: number;
  monthsToReview: number;
  stage: PromotionStage;
  readiness: PromotionReadiness;
  promotionBand: 'Immediate' | 'This Year' | 'Future' | 'Data Required';
  documentsStatus: 'Missing' | 'Partial' | 'Complete';
  managerAssigned: boolean;
  risk: PromotionRisk;
  riskReason: string;
  lastUpdated: string;
};

export type EmployeePromotionPayload = {
  generatedAt: string;
  source: string;
  records: EmployeePromotionRecord[];
  summary: {
    totalMonitored: number;
    eligibleReview: number;
    dueReview: number;
    ready: number;
    incomplete: number;
    highRisk: number;
    activeEmployees: number;
  };
  filterOptions: {
    departments: string[];
    locations: string[];
    stages: PromotionStage[];
    risks: PromotionRisk[];
    readiness: PromotionReadiness[];
    grades: string[];
  };
  insights: Array<{ id: string; tone: PromotionRisk; title: string; detail: string }>;
};

const ACTIVE_STATUSES = new Set(['active', 'confirmed', 'probation', 'contract active', 'reactivated', 'on leave']);

const dateOnly = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const uniqueSorted = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

const deriveRecord = (row: DleEmployeeDirectoryRow): EmployeePromotionRecord | null => {
  const status = row.status || 'Inactive';
  const isActive = ACTIVE_STATUSES.has(status.toLowerCase());
  if (!isActive) return null;

  const serviceYears = Number(row.yearsOfService || 0);
  const serviceMonths = Math.max(0, Math.round(serviceYears * 12));
  const monthsToReview = Math.max(0, 36 - serviceMonths);
  const isEligible = serviceMonths >= 36;
  const isDueSoon = serviceMonths >= 30 && serviceMonths < 36;

  let documentsStatus: EmployeePromotionRecord['documentsStatus'] = 'Missing';
  if (row.documentCount >= 3) documentsStatus = 'Complete';
  else if (row.documentCount > 0) documentsStatus = 'Partial';

  let readiness: PromotionReadiness = 'Ready';
  if (!row.hasManagerAssigned || !row.jobGrade || !row.jobTitle || documentsStatus === 'Missing') readiness = 'Incomplete';
  else if (!row.hrBusinessPartner || documentsStatus === 'Partial') readiness = 'Needs Review';

  let stage: PromotionStage = 'Not Yet Due';
  if (readiness === 'Incomplete') stage = 'Needs Data';
  else if (isEligible) stage = 'Eligible Review';
  else if (isDueSoon) stage = 'Due Review';
  else if (status.toLowerCase() === 'confirmed' && serviceMonths < 12) stage = 'Recently Confirmed';

  const promotionBand = readiness === 'Incomplete' ? 'Data Required' : isEligible ? 'Immediate' : isDueSoon ? 'This Year' : 'Future';

  let risk: PromotionRisk = 'Low';
  let riskReason = 'Promotion review controls are within expected thresholds.';
  if (isEligible && readiness === 'Incomplete') {
    risk = 'High';
    riskReason = 'Eligible employee is missing promotion review data.';
  } else if (isEligible && readiness === 'Needs Review') {
    risk = 'Medium';
    riskReason = 'Eligible employee needs HR or manager review before promotion decision.';
  } else if (isDueSoon) {
    risk = 'Medium';
    riskReason = 'Promotion review becomes due within the current review year.';
  }

  return {
    id: row.employeeId,
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    employeeName: row.fullName,
    jobTitle: row.jobTitle,
    designation: row.designation || row.jobTitle,
    jobGrade: row.jobGrade || 'Not assigned',
    department: row.department,
    division: row.division,
    businessUnit: row.businessUnit,
    location: row.location,
    managerName: row.managerName || 'Not assigned',
    hrBusinessPartner: row.hrBusinessPartner || 'Not assigned',
    employmentType: row.employmentType,
    currentStatus: status,
    dateJoined: dateOnly(row.dateJoined),
    serviceYears,
    monthsToReview,
    stage,
    readiness,
    promotionBand,
    documentsStatus,
    managerAssigned: row.hasManagerAssigned,
    risk,
    riskReason,
    lastUpdated: row.modifiedAt || row.createdAt,
  };
};

export const readEmployeePromotionFromDb = async (): Promise<EmployeePromotionPayload> => {
  const now = new Date();
  const employeeSource = await readPayrollEmployees();
  const employees = employeeSource.employees;
  const activeEmployees = employees.filter((row) => ACTIVE_STATUSES.has((row.status || '').toLowerCase())).length;
  const records = employees
    .map((row) => deriveRecord(row))
    .filter((row): row is EmployeePromotionRecord => Boolean(row))
    .filter((row) => row.serviceYears >= 2 || row.stage !== 'Not Yet Due')
    .sort((a, b) => {
      const riskWeight: Record<PromotionRisk, number> = { High: 0, Medium: 1, Low: 2 };
      const byRisk = riskWeight[a.risk] - riskWeight[b.risk];
      if (byRisk !== 0) return byRisk;
      return b.serviceYears - a.serviceYears || a.employeeName.localeCompare(b.employeeName);
    });

  const summary = {
    totalMonitored: records.length,
    eligibleReview: records.filter((r) => r.stage === 'Eligible Review').length,
    dueReview: records.filter((r) => r.stage === 'Due Review').length,
    ready: records.filter((r) => r.readiness === 'Ready').length,
    incomplete: records.filter((r) => r.readiness === 'Incomplete').length,
    highRisk: records.filter((r) => r.risk === 'High').length,
    activeEmployees,
  };

  const insights: EmployeePromotionPayload['insights'] = [];
  if (summary.eligibleReview > 0) {
    insights.push({
      id: 'eligible',
      tone: summary.highRisk > 0 ? 'High' : 'Medium',
      title: `${summary.eligibleReview} employee${summary.eligibleReview === 1 ? '' : 's'} eligible for promotion review`,
      detail: 'Review grade, manager recommendation, and supporting documents before approval.',
    });
  }
  if (summary.incomplete > 0) {
    insights.push({
      id: 'incomplete',
      tone: 'High',
      title: `${summary.incomplete} promotion record${summary.incomplete === 1 ? '' : 's'} need data cleanup`,
      detail: 'Missing grade, manager assignment, job title, or documents can block a promotion decision.',
    });
  }
  if (summary.dueReview > 0) {
    insights.push({
      id: 'due-review',
      tone: 'Medium',
      title: `${summary.dueReview} employee${summary.dueReview === 1 ? '' : 's'} due for review this year`,
      detail: 'Prepare performance, training, and succession evidence before the review window.',
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: 'stable',
      tone: 'Low',
      title: 'No urgent promotion review exceptions detected',
      detail: 'Current promotion review records are within normal control thresholds.',
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
      stages: ['Eligible Review', 'Due Review', 'Not Yet Due', 'Recently Confirmed', 'Needs Data'],
      risks: ['High', 'Medium', 'Low'],
      readiness: ['Ready', 'Needs Review', 'Incomplete'],
      grades: uniqueSorted(records.map((r) => r.jobGrade)),
    },
    insights,
  };
};
