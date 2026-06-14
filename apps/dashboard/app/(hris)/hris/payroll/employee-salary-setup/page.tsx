import EmployeeSalarySetupClient from './EmployeeSalarySetupClient';

export default function EmployeeSalarySetupPage() {
  return <EmployeeSalarySetupClient initialNow={new Date().toISOString()} />;
}
