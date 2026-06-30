import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import type { EssLeaveRequest } from '@/lib/leave-workflow-service';

type LeaveEmailEvent = 'submitted' | 'manager-approved' | 'approved' | 'rejected';

const compact = (value: unknown) => String(value || '').trim();

const smtpConfigured = () => Boolean(
  process.env.DLE_SMTP_HOST
  && process.env.DLE_SMTP_FROM
  && (process.env.DLE_SMTP_USER ? process.env.DLE_SMTP_PASSWORD : true),
);

const recipientFor = (employee?: DleEmployeeDirectoryRow | null) =>
  compact(employee?.officialEmail || employee?.email || employee?.personalEmail);

export const sendTransactionalEmail = async (input: { to: string; subject: string; text: string }) => {
  const to = compact(input.to);
  if (!to) return { sent: false, reason: 'No recipient email.' };
  if (!smtpConfigured()) {
    console.info('[mail-service] SMTP not configured. Email skipped.', { to, subject: input.subject });
    return { sent: false, reason: 'SMTP not configured.' };
  }

  const host = process.env.DLE_SMTP_HOST!;
  const port = Number(process.env.DLE_SMTP_PORT || 587);
  const user = process.env.DLE_SMTP_USER || '';
  const pass = process.env.DLE_SMTP_PASSWORD || '';
  const from = process.env.DLE_SMTP_FROM!;
  const secure = String(process.env.DLE_SMTP_SECURE || 'false') === 'true';

  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });
  await transport.sendMail({ from, to, subject: input.subject, text: input.text });
  return { sent: true };
};

export const sendLeaveWorkflowEmail = async (input: {
  event: LeaveEmailEvent;
  request: EssLeaveRequest;
  requester: DleEmployeeDirectoryRow;
  actorName?: string;
  extra?: string;
}) => {
  const to = recipientFor(input.requester);
  const subjectMap: Record<LeaveEmailEvent, string> = {
    submitted: `Leave request submitted: ${input.request.leaveType}`,
    'manager-approved': `Leave request awaiting HR approval: ${input.request.leaveType}`,
    approved: `Leave request approved: ${input.request.leaveType}`,
    rejected: `Leave request rejected: ${input.request.leaveType}`,
  };
  const text = [
    `Dear ${input.requester.fullName},`,
    '',
    subjectMap[input.event],
    `Period: ${input.request.startDate} to ${input.request.endDate}`,
    `Days: ${input.request.days}`,
    `Status: ${input.request.status}`,
    input.actorName ? `Actioned by: ${input.actorName}` : '',
    input.extra || '',
    '',
    'Dorman Long Engineering — Employee Self-Service',
  ].filter(Boolean).join('\n');
  return sendTransactionalEmail({ to, subject: subjectMap[input.event], text });
};
