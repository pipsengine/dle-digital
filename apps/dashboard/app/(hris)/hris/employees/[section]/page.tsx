import EmployeeModuleClient from '../EmployeeModuleClient';

export default async function EmployeeSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <EmployeeModuleClient initialSection={section} />;
}
