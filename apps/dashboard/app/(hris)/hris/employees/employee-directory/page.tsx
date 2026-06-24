import EmployeeDirectoryHub from './EmployeeDirectoryHub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function EmployeeDirectoryPage() {
  return <EmployeeDirectoryHub initialNow={new Date().toISOString()} />;
}

