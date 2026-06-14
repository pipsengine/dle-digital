import PensionClient from './PensionClient';

export default function PensionPage() {
  return <PensionClient initialNow={new Date().toISOString()} />;
}
