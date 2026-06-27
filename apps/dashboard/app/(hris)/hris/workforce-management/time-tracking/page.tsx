import TimeTrackingClient from './TimeTrackingClient';

export default function TimeTrackingPage() {
  return <TimeTrackingClient initialNow={new Date().toISOString()} />;
}
