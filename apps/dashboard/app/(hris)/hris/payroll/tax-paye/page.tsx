import TaxPayeClient from './TaxPayeClient';

export default function TaxPayePage() {
  return <TaxPayeClient initialNow={new Date().toISOString()} />;
}
