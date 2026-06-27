export type BenefitRoutePageId =
  | 'overview'
  | 'plans'
  | 'medical'
  | 'insurance'
  | 'pension'
  | 'welfare'
  | 'allowance'
  | 'eligibility'
  | 'enrollment'
  | 'employee-profile'
  | 'claims'
  | 'claim-details'
  | 'approvals'
  | 'providers'
  | 'compliance'
  | 'reports'
  | 'settings';

const normalize = (value: string) => value.toLowerCase().replace(/_/g, '-').trim();

export const benefitSectionToPage: Record<string, BenefitRoutePageId> = {
  overview: 'overview',
  'benefits-overview': 'overview',
  'benefit-plans': 'plans',
  'medical-benefits': 'medical',
  'insurance-benefits': 'insurance',
  'pension-benefits': 'pension',
  'staff-welfare': 'welfare',
  'allowance-benefits': 'allowance',
  'benefit-eligibility': 'eligibility',
  'benefit-enrollment': 'enrollment',
  'employee-benefit-profile': 'employee-profile',
  'benefit-claims': 'claims',
  'claim-details': 'claim-details',
  'benefit-approval': 'approvals',
  'benefit-approvals': 'approvals',
  'providers-and-vendors': 'providers',
  providers: 'providers',
  compliance: 'compliance',
  'benefit-reports': 'reports',
  'reports-and-analytics': 'reports',
  'benefits-settings': 'settings',
};

export const benefitPageToSection: Partial<Record<BenefitRoutePageId, string>> = {
  overview: 'overview',
  plans: 'benefit-plans',
  medical: 'medical-benefits',
  insurance: 'insurance-benefits',
  pension: 'pension-benefits',
  welfare: 'staff-welfare',
  allowance: 'allowance-benefits',
  eligibility: 'benefit-eligibility',
  enrollment: 'benefit-enrollment',
  claims: 'benefit-claims',
  approvals: 'benefit-approval',
  providers: 'providers-and-vendors',
  compliance: 'compliance',
  reports: 'benefit-reports',
  settings: 'benefits-settings',
};

export function benefitPageFromSection(section?: string | null): BenefitRoutePageId {
  if (!section) return 'overview';
  return benefitSectionToPage[normalize(section)] || 'overview';
}

export function benefitSectionFromPage(page: BenefitRoutePageId): string | null {
  return benefitPageToSection[page] || null;
}
