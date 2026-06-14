import PayslipGenerationClient from './PayslipGenerationClient';

export default function PayslipGenerationPage() {
  return <PayslipGenerationClient initialNow={new Date().toISOString()} />;
}
