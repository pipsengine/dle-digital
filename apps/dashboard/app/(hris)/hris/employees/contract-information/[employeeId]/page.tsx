import ContractInformationClient from '../ContractInformationClient';

export default async function ContractInformationByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <ContractInformationClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

