import OvertimePayClient from './OvertimePayClient';

export default function OvertimePayPage() {
  return <OvertimePayClient initialNow={new Date().toISOString()} />;
}
