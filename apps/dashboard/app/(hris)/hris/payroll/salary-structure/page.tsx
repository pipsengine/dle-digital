import type { Metadata } from 'next';
import SalaryStructureClient from './SalaryStructureClient';

export const metadata: Metadata = {
  title: 'Salary Structure Command Center',
};

export default function SalaryStructurePage() {
  return <SalaryStructureClient />;
}
