export type BenefitsRole =
  | 'Benefits Administrator'
  | 'HR Officer'
  | 'HR Manager'
  | 'Payroll Officer'
  | 'Finance Controller'
  | 'Super Administrator';

export type BenefitPlanType = 'Medical' | 'Insurance' | 'Pension' | 'Welfare' | 'Allowance';
export type BenefitStatus = 'Active' | 'Draft' | 'Inactive' | 'Pending' | 'Expired';
export type ClaimStatus = 'Pending Approval' | 'In Review' | 'Approved' | 'Rejected' | 'Paid';
export type ApprovalPriority = 'High' | 'Medium' | 'Low';

export type BenefitPlan = {
  id: string;
  name: string;
  type: BenefitPlanType;
  provider: string;
  eligibility: string;
  enrolled: number;
  employerContribution: string;
  employeeContribution: string;
  effectiveDate: string;
  renewalDate: string;
  status: BenefitStatus;
  coverageLimit?: string;
  waitingPeriod?: string;
};

export type EnrollmentRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  planId: string;
  planName: string;
  planType: BenefitPlanType;
  dependents: number;
  enrolledOn: string;
  status: BenefitStatus | 'Pending';
};

export type BenefitClaim = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  planName: string;
  claimType: string;
  amount: number;
  currency: string;
  submittedOn: string;
  status: ClaimStatus;
  description: string;
  documents: Array<{ id: string; name: string; size: string }>;
  workflow: Array<{ stage: string; owner: string; status: 'Completed' | 'Pending' | 'Waiting'; actedAt?: string }>;
};

export type ApprovalRequest = {
  id: string;
  type: string;
  employeeId: string;
  employeeName: string;
  planName: string;
  amount: number;
  submittedOn: string;
  priority: ApprovalPriority;
  status: 'Pending' | 'Approved' | 'Rejected';
};

export type EligibilityRule = {
  id: string;
  name: string;
  planTypes: BenefitPlanType[];
  criteria: string;
  appliesTo: string;
  status: BenefitStatus;
};

export type BenefitProvider = {
  id: string;
  name: string;
  type: string;
  contactPerson: string;
  email: string;
  phone: string;
  rating: number;
  contractEnd: string;
  status: BenefitStatus;
};

export type ComplianceItem = {
  id: string;
  regulator: string;
  requirement: string;
  dueDate: string;
  status: 'Compliant' | 'At Risk' | 'Overdue';
  lastAudit: string;
};

export type EmployeeBenefitProfile = {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  department: string;
  location: string;
  hireDate: string;
  plans: Array<{ name: string; type: BenefitPlanType; provider: string; coverage: string; status: BenefitStatus }>;
  allowances: Array<{ name: string; amount: string; frequency: string }>;
  dependents: Array<{ name: string; relationship: string; plan: string }>;
  beneficiaries: Array<{ name: string; relationship: string; percentage: number }>;
  recentClaims: BenefitClaim[];
};

export type BenefitsPayload = {
  generatedAt: string;
  source: string;
  role: BenefitsRole;
  dataSource: {
    source: string;
    databaseAvailable: boolean;
    warning: string | null;
    employeeCount: number;
  };
  summary: {
    totalEmployees: number;
    totalPlans: number;
    activeEnrollments: number;
    enrolledEmployees: number;
    pendingClaims: number;
    totalBenefitCostYtd: number;
    periodBenefitCost: number;
    pendingApprovals: number;
    complianceScore: number;
  };
  analytics: {
    costByPlanType: Array<{ label: string; value: number }>;
    enrollmentByType: Array<{ label: string; value: number }>;
    costTrend: { labels: string[]; employerSeries: number[]; employeeSeries: number[] };
    enrollmentTrend: { labels: string[]; totalSeries: number[]; newSeries: number[] };
  };
  plans: BenefitPlan[];
  enrollments: EnrollmentRecord[];
  claims: BenefitClaim[];
  approvals: ApprovalRequest[];
  eligibilityRules: EligibilityRule[];
  providers: BenefitProvider[];
  compliance: ComplianceItem[];
  employeeProfiles: EmployeeBenefitProfile[];
  settings: {
    benefitYear: string;
    currency: string;
    autoAssign: boolean;
    selfEnrollment: boolean;
    requireApproval: boolean;
    notifyRenewals: boolean;
    contributionType: string;
    approvalWorkflow: string;
  };
};

export const formatBenefitMoney = (value: number) => `₦${value.toLocaleString('en-NG')}`;
