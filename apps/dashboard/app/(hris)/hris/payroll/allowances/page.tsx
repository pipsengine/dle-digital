import AllowancesClient from './AllowancesClient';

export default function AllowancesPage() {
  return <AllowancesClient initialNow={new Date().toISOString()} />;
}
