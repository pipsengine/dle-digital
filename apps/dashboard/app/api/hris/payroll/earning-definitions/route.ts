import { NextResponse } from 'next/server';
import {
  CONTRACT_DAY_RATE_EARNING_DEFINITIONS,
  CONTRACT_DAY_RATE_SUPPLEMENTAL_EARNINGS,
  CONTRACT_LUMPSUM_SUPPLEMENTAL_EARNINGS,
  JUNIOR_OVERTIME_RULES,
  PAYROLL_EARNING_PROFILES,
  PERMANENT_SUPPLEMENTAL_EARNINGS,
  SENIOR_FIXED_MONTHLY_EARNING_DEFINITIONS,
} from '@/lib/payroll-earnings-engine';

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });

export async function GET() {
  return ok({
    generatedAt: new Date().toISOString(),
    source: 'DLE approved payroll earning definitions',
    profiles: Object.entries(PAYROLL_EARNING_PROFILES).map(([id, profile]) => ({
      id,
      name: profile.name,
      totalPercentOfGross: profile.definitions.reduce((sum, item) => sum + item.percentOfGross, 0),
      definitions: profile.definitions.map((definition) => ({
        ...definition,
        percentOfGross: Math.round(definition.percentOfGross * 10000) / 100,
      })),
    })),
    overtimeRules: Object.entries(JUNIOR_OVERTIME_RULES).map(([dayType, rule]) => ({
      dayType,
      ...rule,
      formula: `(Basic/${rule.divisor})*${rule.multiplier}*No of hrs`,
    })),
    supplementalEarnings: PERMANENT_SUPPLEMENTAL_EARNINGS,
    seniorFixedMonthlyEarnings: SENIOR_FIXED_MONTHLY_EARNING_DEFINITIONS.map((definition) => ({
      ...definition,
      fixedMonthlyAmount: definition.code === 'PER_MEAL' ? 22000 : 15000,
    })),
    contractLumpsumSupplementalEarnings: CONTRACT_LUMPSUM_SUPPLEMENTAL_EARNINGS,
    contractDayRateEarningDefinitions: CONTRACT_DAY_RATE_EARNING_DEFINITIONS,
    contractDayRateSupplementalEarnings: CONTRACT_DAY_RATE_SUPPLEMENTAL_EARNINGS,
    deductionDefinitions: [
      { code: 'PAYE', name: 'PAYE', taxableBasis: 'All paid taxable permanent earning components', calculation: 'Charged on taxable earning components when paid in payroll period' },
      { code: 'PENSION_EMPLOYEE', name: 'Pension Employee Contribution', taxableBasis: 'BHT', calculation: '8% of Basic + Housing + Transport' },
      { code: 'NHF', name: 'National Housing Fund', taxableBasis: 'Basic', calculation: '2.5% of Basic' },
      { code: 'JNR_UNION_DUES', name: 'Junior Union Dues', taxableBasis: 'Basic', calculation: '3% of Basic Earning' },
      { code: 'SNR_UNION_DUES', name: 'Senior Union Dues', taxableBasis: 'Monthly Salary', calculation: '(Monthly Salary * 26%) * 4%' },
      { code: 'OTHER_DEDUCTION', name: 'Other Deduction', taxableBasis: 'Configured deduction', calculation: 'Configured amount' },
      { code: 'LOAN_DEDUCTION', name: 'Loan Deduction', taxableBasis: 'Approved loan schedule', calculation: 'Loan recovery schedule' },
      { code: 'SUSPENSION', name: 'Suspension', taxableBasis: 'Suspension record', calculation: 'Configured payroll impact' },
    ],
    companyContributionDefinitions: [
      { code: 'PENSION_EMPLOYER', name: 'Employer Pension Contribution', basis: 'BHT', calculation: '10% of Basic + Housing + Transport', appliesTo: 'Permanent staff' },
      { code: 'NSITF', name: 'Nigeria Social Insurance Trust Fund', basis: 'Configured statutory basis', calculation: 'Configured employer statutory contribution', appliesTo: 'Configured workforce scope' },
      { code: 'ITF', name: 'Industrial Training Fund', basis: 'Configured statutory basis', calculation: 'Configured employer statutory contribution', appliesTo: 'Configured workforce scope' },
    ],
    contractLumpsumDeductionDefinitions: [
      { code: 'PAYE', name: 'PAYE', calculation: 'Charged on taxable lump-sum amount' },
      { code: 'OTHER_DEDUCTION', name: 'Other Deduction', calculation: 'Configured amount' },
      { code: 'LOAN_DEDUCTION', name: 'Loan Deduction', calculation: 'Loan recovery schedule' },
      { code: 'SUSPENSION', name: 'Suspension', calculation: 'Configured payroll impact' },
    ],
    contractDayRateDeductionDefinitions: [
      { code: 'PAYE', name: 'PAYE', calculation: 'Charged on taxable day-rate earnings' },
      { code: 'OTHER_DEDUCTION', name: 'Other Deduction', calculation: 'Configured amount' },
      { code: 'LOAN_DEDUCTION', name: 'Loan Deduction', calculation: 'Loan recovery schedule' },
      { code: 'SUSPENSION', name: 'Suspension', calculation: 'Configured payroll impact' },
    ],
  });
}
