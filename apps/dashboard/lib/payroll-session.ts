import { effectivePermissionsForUser } from '@/lib/auth/access-control-store';
import { AUTH_COOKIE, verifySessionToken } from '@/lib/auth/session';

export type PayrollSessionRole =
  | 'Super Admin'
  | 'System Administrator'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Payroll Officer'
  | 'Payroll Supervisor'
  | 'Finance Controller'
  | 'Finance Manager'
  | 'CFO'
  | 'Executive Director'
  | 'Executive Management'
  | 'Auditor'
  | 'Employee';

const cookieValue = (request: Request, name: string) => {
  const raw = request.headers.get('cookie') || '';
  for (const pair of raw.split(';')) {
    const [key, ...rest] = pair.split('=');
    if (String(key || '').trim() === name) return decodeURIComponent(rest.join('='));
  }
  return '';
};

export const roleFromSession = (session: Awaited<ReturnType<typeof verifySessionToken>>, fallback?: string): PayrollSessionRole => {
  const text = `${session?.roles?.join(' ') || ''} ${session?.permissions?.join(' ') || ''} ${fallback || ''}`;
  if (session?.isGlobalAdmin || /super administrator|global super|super admin|\*/i.test(text)) return 'Super Admin';
  if (/system administrator/i.test(text)) return 'System Administrator';
  if (/payroll supervisor/i.test(text)) return 'Payroll Supervisor';
  if (/payroll officer|payroll administrator/i.test(text)) return 'Payroll Officer';
  if (/finance manager/i.test(text)) return 'Finance Manager';
  if (/\bcfo\b/i.test(text)) return 'CFO';
  if (/executive director/i.test(text)) return 'Executive Director';
  if (/executive/i.test(text)) return 'Executive Management';
  if (/finance controller/i.test(text)) return 'Finance Controller';
  if (/hr director/i.test(text)) return 'HR Director';
  if (/hr manager/i.test(text)) return 'HR Manager';
  if (/hr officer/i.test(text)) return 'HR Officer';
  if (/auditor/i.test(text)) return 'Auditor';
  const roles: PayrollSessionRole[] = ['Super Admin', 'System Administrator', 'HR Director', 'HR Manager', 'HR Officer', 'Payroll Officer', 'Payroll Supervisor', 'Finance Controller', 'Finance Manager', 'CFO', 'Executive Director', 'Executive Management', 'Auditor', 'Employee'];
  return roles.includes(fallback as PayrollSessionRole) ? (fallback as PayrollSessionRole) : 'Employee';
};

export const payrollSessionContext = async (request: Request) => {
  const session = await verifySessionToken(cookieValue(request, AUTH_COOKIE));
  const fallbackRole = request.headers.get('x-hris-role') || '';
  const role = roleFromSession(session, fallbackRole);
  const actor = String(session?.fullName || session?.username || role).trim();
  const permissions = session?.isGlobalAdmin
    ? ['*']
    : session
      ? await effectivePermissionsForUser(session.sub, session.roles).catch(() => session.permissions)
      : [];
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
  return { session, role, actor, permissions, ip };
};

export const processingPermissions = (role: PayrollSessionRole) => ({
  canViewMoney: ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Payroll Supervisor', 'Finance Controller', 'Finance Manager', 'CFO', 'Executive Director', 'Executive Management', 'Auditor'].includes(role),
  canCalculate: ['Super Admin', 'HR Director', 'HR Manager', 'Payroll Officer', 'Payroll Supervisor', 'Finance Controller'].includes(role),
  canSubmit: ['Super Admin', 'Payroll Officer', 'Payroll Supervisor', 'HR Manager'].includes(role),
  canApproveFinance: ['Super Admin', 'Finance Controller', 'Finance Manager', 'CFO', 'Executive Director', 'Executive Management'].includes(role),
  canApproveHr: ['Super Admin', 'HR Director'].includes(role),
  canLock: ['Super Admin', 'Finance Controller', 'Finance Manager', 'CFO', 'HR Director'].includes(role),
  canExport: role !== 'Employee',
  canReopen: ['Super Admin', 'CFO', 'Executive Director'].includes(role),
});

export const managementPermissions = (role: PayrollSessionRole) => {
  const canViewMoney = ['Super Admin', 'System Administrator', 'HR Director', 'HR Manager', 'Payroll Officer', 'Payroll Supervisor', 'Finance Controller', 'Finance Manager', 'CFO', 'Executive Director', 'Executive Management', 'Auditor'].includes(role);
  const canManageRun = ['Super Admin', 'Payroll Officer', 'Payroll Supervisor', 'Finance Controller', 'Finance Manager'].includes(role);
  const canApprove = ['Super Admin', 'HR Director', 'HR Manager', 'Finance Controller', 'Finance Manager', 'CFO', 'Executive Director', 'Executive Management'].includes(role);
  const canPost = ['Super Admin', 'Payroll Officer', 'Payroll Supervisor', 'Finance Controller', 'Finance Manager'].includes(role);
  const canConfigure = ['Super Admin', 'System Administrator'].includes(role);
  const canReopen = ['Super Admin', 'CFO', 'Executive Director'].includes(role);
  const canExport = role !== 'Employee';
  return { canViewMoney, canManageRun, canApprove, canPost, canConfigure, canReopen, canExport };
};
