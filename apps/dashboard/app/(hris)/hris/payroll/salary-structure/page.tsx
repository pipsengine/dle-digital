import SalaryStructureClient from './SalaryStructureClient';

export default function SalaryStructurePage() {
  return <SalaryStructureClient initialNow={new Date().toISOString()} />;
}
