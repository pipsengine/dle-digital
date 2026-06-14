import LoansAndSalaryAdvancesClient from './LoansAndSalaryAdvancesClient';

export default function LoansAndSalaryAdvancesPage() {
  return <LoansAndSalaryAdvancesClient initialNow={new Date().toISOString()} />;
}
