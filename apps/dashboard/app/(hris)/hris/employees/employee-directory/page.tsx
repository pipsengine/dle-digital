import EmployeeDirectoryClient from './EmployeeDirectoryClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function EmployeeDirectoryPage() {
  return <EmployeeDirectoryClient initialNow={new Date().toISOString()} />;
}

