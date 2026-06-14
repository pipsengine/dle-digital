import PayrollApprovalClient from './PayrollApprovalClient';

export default function PayrollApprovalPage() {
  return <PayrollApprovalClient initialNow={new Date().toISOString()} />;
}
