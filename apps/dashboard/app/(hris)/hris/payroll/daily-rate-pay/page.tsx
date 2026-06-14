import DailyRatePayClient from './DailyRatePayClient';

export default function DailyRatePayPage() {
  return <DailyRatePayClient initialNow={new Date().toISOString()} />;
}
