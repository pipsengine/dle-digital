import type { SessionPayload } from '@/lib/auth/session';

type SessionLike = Pick<SessionPayload, 'department' | 'unit' | 'roles' | 'permissions' | 'isGlobalAdmin'>;

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';
const routePathFromRequestPath = (pathname: string) => {
  const path = normalizePath(pathname);
  if (path.startsWith('/api/hris/')) return path.replace(/^\/api\/hris/, '/hris');
  if (path === '/api/hris') return '/hris';
  return path;
};

const hasPermission = (permissions: string[], required: string) => {
  if (permissions.includes('*')) return true;
  if (permissions.includes(required)) return true;
  const [module] = required.split('.');
  return permissions.includes(`${module}.*`);
};

const hasAnyPermission = (permissions: string[], required: string[]) =>
  required.some((permission) => hasPermission(permissions, permission));

export const isHrPortalUser = (session: SessionLike) => {
  if (session.isGlobalAdmin || session.roles.includes('Super Administrator')) return true;
  const text = `${session.department || ''} ${session.unit || ''} ${session.roles.join(' ')}`.toLowerCase();
  return /\bhr\b/.test(text) || text.includes('human resources') || text.includes('human resource') || text.includes('human capital');
};

export const hrisRoutePermissionOptions = (pathname: string): string[] | null => {
  const path = normalizePath(pathname);
  if (path === '/hris/workforce-management/timesheet-entry' || path === '/hris/time-and-logs/timesheet-entry' || path === '/hris/time-and-logs/project-sites') {
    return [
      'operations.timesheets.view',
      'operations.timesheets.create',
      'operations.timesheets.edit',
      'operations.timesheets.submit',
      'operations.timesheets.approve',
      'timesheet.view',
      'timesheet.create',
      'timesheet.edit',
      'timesheet.submit',
      'timesheet.approve',
    ];
  }
  if (path === '/hris/workforce-management/timesheet-approval' || path === '/hris/time-and-logs/timesheet-approval') {
    return ['operations.timesheets.approve', 'timesheet.approve'];
  }
  if (path === '/hris/workforce-management/timesheet-reports' || path === '/hris/time-and-logs/timesheet-reports') {
    return ['operations.timesheets.view', 'operations.timesheets.export', 'timesheet.view', 'timesheet.export'];
  }
  if (path === '/hris/workforce-management/timesheet-period' || path === '/hris/time-and-logs/timesheet-period') {
    return ['timesheet.period.manage', 'timesheet.manage'];
  }
  if (path.startsWith('/hris/payroll') || path.startsWith('/hris/payroll-management')) {
    return ['payroll.view', 'page.payroll.management.view'];
  }
  return null;
};

export const canAccessHrisPath = (session: SessionLike, pathname: string) => {
  if (session.isGlobalAdmin || session.roles.includes('Super Administrator')) return true;
  const path = normalizePath(pathname);
  const explicitOptions = hrisRoutePermissionOptions(path);
  if (explicitOptions && hasAnyPermission(session.permissions, explicitOptions)) return true;
  if (!isHrPortalUser(session)) return false;
  if (path === '/hris') return hasAnyPermission(session.permissions, ['page.hris.management.view', 'hris.view']);
  if (path.startsWith('/hris/employees')) return hasAnyPermission(session.permissions, ['employees.view', 'hris.view']);
  if (path.startsWith('/hris/leave-management')) return hasAnyPermission(session.permissions, ['leave.view', 'hris.view']);
  if (path.startsWith('/hris/attendance')) return hasAnyPermission(session.permissions, ['attendance.view', 'attendance.manage', 'hris.view']);
  if (path.startsWith('/hris/organization')) return hasAnyPermission(session.permissions, ['positions.view', 'workforce.view', 'hris.view']);
  if (path.startsWith('/hris/administration')) return hasAnyPermission(session.permissions, ['admin.roles.view', 'admin.users.view', 'audit.view']);
  return hasAnyPermission(session.permissions, ['page.hris.management.view', 'hris.view']);
};

export const canAccessRoute = (session: SessionLike, pathname: string) => {
  const path = routePathFromRequestPath(pathname);
  if (path.startsWith('/hris')) return canAccessHrisPath(session, path);
  return true;
};
