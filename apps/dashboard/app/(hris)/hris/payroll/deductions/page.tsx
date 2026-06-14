import DeductionsClient from './DeductionsClient';

export default function DeductionsPage() {
  return <DeductionsClient initialNow={new Date().toISOString()} />;
}
