import NextOfKinClient from '../NextOfKinClient';

export default async function NextOfKinByIdPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <NextOfKinClient initialNow={new Date().toISOString()} employeeId={employeeId} />;
}

