import type { Metadata } from 'next';
import TaxPayeClient from './TaxPayeClient';

export const metadata: Metadata = {
  title: 'Tax PAYE',
};

export default function TaxPayePage() {
  return <TaxPayeClient initialNow={new Date().toISOString()} />;
}
