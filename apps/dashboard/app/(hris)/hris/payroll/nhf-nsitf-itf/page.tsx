import StatutoryFundsClient from './StatutoryFundsClient';

export default function NhfNsitfItfPage() {
  return <StatutoryFundsClient initialNow={new Date().toISOString()} />;
}
