import PayrollProcessingClient from './PayrollProcessingClient';

export default function PayrollProcessingPage() {
  return <PayrollProcessingClient initialNow={new Date().toISOString()} />;
}
