import BenefitsManagementClient from '../../benefits-management/BenefitsManagementClient';
import { benefitPageFromSection } from '@/lib/benefits-routes';

export default async function BenefitsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <BenefitsManagementClient initialNow={new Date().toISOString()} initialPage={benefitPageFromSection(section)} />;
}
