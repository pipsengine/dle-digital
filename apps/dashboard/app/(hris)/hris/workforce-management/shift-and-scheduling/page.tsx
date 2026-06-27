import ShiftSchedulingClient from './ShiftSchedulingClient';

export default function ShiftAndSchedulingPage() {
  return <ShiftSchedulingClient initialNow={new Date().toISOString()} />;
}
