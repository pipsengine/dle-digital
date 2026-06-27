import BenefitsManagementClient from '../benefits-management/BenefitsManagementClient';
import GenericHrisModulePage from '@hris/app/(dashboard)/[...slug]/page';
import { benefitPageFromSection } from '@/lib/benefits-routes';

export default async function HrisCatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  if (slug[0] === 'benefits') {
    const section = slug[1] || 'overview';
    return <BenefitsManagementClient initialNow={new Date().toISOString()} initialPage={benefitPageFromSection(section)} />;
  }

  return GenericHrisModulePage({ params });
}
