import { redirect } from 'next/navigation';

export default function LoanApplicationPage() {
  redirect('/workforce-portal?tab=loans');
}
