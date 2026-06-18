import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { defaultRoleForEmployee, enterpriseRoles, permissionsForRoles, roleDefinitions } from '@/lib/auth/rbac';
import type { SessionUser } from '@/lib/auth/session';
import { passwordPolicyErrors } from '@/lib/auth/session';
import { effectivePermissionsForRoles, effectivePermissionsForUser } from '@/lib/auth/access-control-store';

export type UserStatus = 'Active' | 'Inactive' | 'Disabled' | 'Locked' | 'Pending First Login' | 'Password Reset Required';

export type UserAccount = {
  id: string;
  username: string;
  employeeId: string;
  employeeCode: string;
  fullName: string;
  surname: string;
  email: string;
  department: string;
  unit: string;
  jobTitle: string;
  grade: string;
  location: string;
  employmentStatus: string;
  reportingManager: string;
  passwordHash: string;
  passwordSalt: string;
  status: UserStatus;
  roles: string[];
  permissions: string[];
  departmentAccess: string[];
  moduleAccess: string[];
  firstLoginRequired: boolean;
  passwordResetRequired: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  disabledAt?: string | null;
  deleted?: boolean;
};

export type SecurityAudit = {
  id: string;
  user: string;
  action: string;
  at: string;
  ipAddress: string;
  device: string;
  oldValue?: string | null;
  newValue?: string | null;
  performedBy: string;
};

export type LoginHistory = {
  id: string;
  userId: string;
  username: string;
  at: string;
  logoutAt?: string | null;
  ipAddress: string;
  device: string;
  status: 'Success' | 'Failed' | 'Blocked' | 'Logout';
  reason?: string;
};

type GlobalAdminState = {
  username: 'Admin';
  passwordHash: string;
  passwordSalt: string;
  firstLoginRequired: boolean;
  passwordResetRequired: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  updatedAt: string;
};

const resolveDashboardRoot = () => {
  const cwd = process.cwd();
  const dashboardSuffix = path.join('apps', 'dashboard');
  return cwd.endsWith(dashboardSuffix) ? cwd : path.join(cwd, dashboardSuffix);
};

const DATA_DIR = path.join(resolveDashboardRoot(), 'data', 'auth');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const AUDIT_PATH = path.join(DATA_DIR, 'security-audit.json');
const LOGIN_PATH = path.join(DATA_DIR, 'login-history.json');
const GLOBAL_ADMIN_PATH = path.join(DATA_DIR, 'global-admin.json');
const LOCKOUT_LIMIT = 5;
const LOCKOUT_MINUTES = 30;

const nowIso = () => new Date().toISOString();
const compact = (value: unknown) => String(value || '').trim();
const lower = (value: unknown) => compact(value).toLowerCase();
const activeEmployee = (employee: DleEmployeeDirectoryRow) => !lower(employee.status).match(/exited|suspended|terminated|inactive|disabled|resigned|retired/);

const ensure = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  for (const [file, fallback] of [[USERS_PATH, []], [AUDIT_PATH, []], [LOGIN_PATH, []]] as const) {
    try {
      await access(file);
    } catch {
      await writeFile(file, JSON.stringify(fallback, null, 2), 'utf8');
    }
  }
};

const readJson = async <T,>(file: string, fallback: T): Promise<T> => {
  await ensure();
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
};

const writeJson = async (file: string, value: unknown) => {
  await ensure();
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
};

export const hashPassword = (password: string, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex'),
});

const verifyPassword = (password: string, hash: string, salt: string) => {
  const next = hashPassword(password, salt).hash;
  return crypto.timingSafeEqual(Buffer.from(next, 'hex'), Buffer.from(hash, 'hex'));
};

const surnameOf = (employee: DleEmployeeDirectoryRow) => compact(employee.lastName || employee.fullName.split(/\s+/).slice(-1)[0] || employee.employeeCode);

const userFromEmployee = (employee: DleEmployeeDirectoryRow): UserAccount => {
  const password = surnameOf(employee);
  const hashed = hashPassword(password);
  const role = defaultRoleForEmployee(employee.jobTitle || employee.designation, employee.department);
  const username = employee.employeeCode || employee.employeeId;
  const status: UserStatus = activeEmployee(employee) ? 'Pending First Login' : 'Inactive';
  const roles = [role];
  return {
    id: `usr-${username}`,
    username,
    employeeId: employee.employeeId,
    employeeCode: employee.employeeCode || employee.employeeId,
    fullName: employee.fullName,
    surname: surnameOf(employee),
    email: employee.officialEmail || employee.email || employee.personalEmail || '',
    department: employee.department || '',
    unit: employee.businessUnit || employee.division || '',
    jobTitle: employee.jobTitle || employee.designation || '',
    grade: employee.salaryGrade || employee.jobGrade || '',
    location: employee.workLocation || employee.location || employee.officeLocation || '',
    employmentStatus: employee.status || 'Active',
    reportingManager: employee.managerName || employee.functionalManager || employee.departmentHead || '',
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    status,
    roles,
    permissions: permissionsForRoles(roles),
    departmentAccess: [employee.department || ''].filter(Boolean),
    moduleAccess: [],
    firstLoginRequired: true,
    passwordResetRequired: false,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    disabledAt: null,
    deleted: false,
  };
};

const mergeEmployee = (user: UserAccount, employee: DleEmployeeDirectoryRow): UserAccount => {
  const employmentStatus = employee.status || user.employmentStatus;
  const inactive = !activeEmployee(employee);
  return {
    ...user,
    employeeId: employee.employeeId || user.employeeId,
    employeeCode: employee.employeeCode || user.employeeCode,
    fullName: employee.fullName || user.fullName,
    surname: surnameOf(employee) || user.surname,
    email: employee.officialEmail || employee.email || employee.personalEmail || user.email,
    department: employee.department || user.department,
    unit: employee.businessUnit || employee.division || user.unit,
    jobTitle: employee.jobTitle || employee.designation || user.jobTitle,
    grade: employee.salaryGrade || employee.jobGrade || user.grade,
    location: employee.workLocation || employee.location || employee.officeLocation || user.location,
    employmentStatus,
    reportingManager: employee.managerName || employee.functionalManager || employee.departmentHead || user.reportingManager,
    status: inactive && user.status !== 'Locked' ? 'Inactive' : user.status,
    updatedAt: nowIso(),
  };
};

export const appendAudit = async (event: Omit<SecurityAudit, 'id' | 'at'>) => {
  const audit = await readJson<SecurityAudit[]>(AUDIT_PATH, []);
  audit.unshift({ id: `sec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, at: nowIso(), ...event });
  await writeJson(AUDIT_PATH, audit.slice(0, 1000));
};

const appendLogin = async (event: Omit<LoginHistory, 'id' | 'at'>) => {
  const history = await readJson<LoginHistory[]>(LOGIN_PATH, []);
  history.unshift({ id: `login-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, at: nowIso(), ...event });
  await writeJson(LOGIN_PATH, history.slice(0, 1000));
};

export const readSecurityAudit = () => readJson<SecurityAudit[]>(AUDIT_PATH, []);
export const readLoginHistory = () => readJson<LoginHistory[]>(LOGIN_PATH, []);

export const syncUsersFromEmployeeDirectory = async () => {
  const source = await readPayrollEmployees();
  const stored = await readJson<UserAccount[]>(USERS_PATH, []);
  const byCode = new Map(stored.map((user) => [lower(user.employeeCode || user.employeeId), user]));
  const next = source.employees.map((employee) => {
    const key = lower(employee.employeeCode || employee.employeeId);
    const existing = byCode.get(key);
    return existing ? mergeEmployee(existing, employee) : userFromEmployee(employee);
  });
  await writeJson(USERS_PATH, next);
  return { users: next.filter((user) => !user.deleted), source };
};

export const readUsers = async () => {
  const stored = await readJson<UserAccount[]>(USERS_PATH, []);
  const activeUsers = stored.filter((user) => !user.deleted);
  return Promise.all(activeUsers.map(async (user) => ({ ...user, permissions: await effectivePermissionsForUser(user.id, user.roles) })));
};

const globalAdminDefault = (): GlobalAdminState => {
  const hashed = hashPassword('P@882w0rd');
  return {
    username: 'Admin',
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    firstLoginRequired: false,
    passwordResetRequired: false,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    updatedAt: nowIso(),
  };
};

const readGlobalAdmin = async () => {
  await ensure();
  try {
    await access(GLOBAL_ADMIN_PATH);
  } catch {
    await writeJson(GLOBAL_ADMIN_PATH, globalAdminDefault());
  }
  return readJson<GlobalAdminState>(GLOBAL_ADMIN_PATH, globalAdminDefault());
};

const writeGlobalAdmin = (state: GlobalAdminState) => writeJson(GLOBAL_ADMIN_PATH, state);

const client = (headers: Headers) => ({
  ip: compact(headers.get('x-forwarded-for')).split(',')[0] || compact(headers.get('x-real-ip')) || 'local',
  device: compact(headers.get('user-agent')) || 'Unknown device',
});

const publicUser = async (user: UserAccount): Promise<SessionUser> => ({
  userId: user.id,
  username: user.username,
  employeeId: user.employeeId,
  employeeCode: user.employeeCode,
  fullName: user.fullName,
  email: user.email,
  roles: user.roles,
  permissions: await effectivePermissionsForUser(user.id, user.roles),
  status: user.status,
  firstLoginRequired: user.firstLoginRequired,
  passwordResetRequired: user.passwordResetRequired,
});

const globalSessionUser = (state: GlobalAdminState): SessionUser => ({
  userId: 'global-admin',
  username: 'Admin',
  fullName: 'Global Super Administrator',
  roles: ['Super Administrator'],
  permissions: ['*'],
  status: 'Active',
  firstLoginRequired: false,
  passwordResetRequired: false,
  isGlobalAdmin: true,
});

export const authenticate = async (login: string, password: string, headers: Headers) => {
  const username = compact(login);
  const { ip, device } = client(headers);
  if (lower(username) === 'admin') {
    const state = await readGlobalAdmin();
    if (state.lockedUntil && new Date(state.lockedUntil) > new Date()) {
      await appendLogin({ userId: 'global-admin', username: 'Admin', ipAddress: ip, device, status: 'Blocked', reason: 'Account locked' });
      throw new Error('Account is locked. Contact a security administrator.');
    }
    if (!verifyPassword(password, state.passwordHash, state.passwordSalt)) {
      const failedAttempts = state.failedAttempts + 1;
      state.failedAttempts = failedAttempts;
      state.lockedUntil = failedAttempts >= LOCKOUT_LIMIT ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : null;
      await writeGlobalAdmin(state);
      await appendLogin({ userId: 'global-admin', username: 'Admin', ipAddress: ip, device, status: 'Failed', reason: 'Invalid password' });
      await appendAudit({ user: 'Admin', action: 'Failed login', ipAddress: ip, device, performedBy: 'System', newValue: `Failed attempts: ${failedAttempts}` });
      throw new Error('Invalid username or password.');
    }
    state.failedAttempts = 0;
    state.lockedUntil = null;
    state.lastLoginAt = nowIso();
    await writeGlobalAdmin(state);
    await appendLogin({ userId: 'global-admin', username: 'Admin', ipAddress: ip, device, status: 'Success' });
    await appendAudit({ user: 'Admin', action: 'Login', ipAddress: ip, device, performedBy: 'Admin' });
    return globalSessionUser(state);
  }

  let users = await readUsers();
  let user = users.find((item) => [item.username, item.employeeCode, item.employeeId, item.email].map(lower).includes(lower(username)));
  if (!user) {
    users = (await syncUsersFromEmployeeDirectory()).users;
    user = users.find((item) => [item.username, item.employeeCode, item.employeeId, item.email].map(lower).includes(lower(username)));
  }
  if (!user || user.deleted) {
    await appendLogin({ userId: 'unknown', username, ipAddress: ip, device, status: 'Failed', reason: 'Unknown user' });
    throw new Error('Invalid username or password.');
  }
  if (['Inactive', 'Disabled'].includes(user.status) || lower(user.employmentStatus).match(/exited|suspended|terminated|inactive|disabled|resigned|retired/)) {
    await appendLogin({ userId: user.id, username: user.username, ipAddress: ip, device, status: 'Blocked', reason: `Status: ${user.status} / ${user.employmentStatus}` });
    throw new Error('This account is not active.');
  }
  if (user.status === 'Locked' || (user.lockedUntil && new Date(user.lockedUntil) > new Date())) {
    await appendLogin({ userId: user.id, username: user.username, ipAddress: ip, device, status: 'Blocked', reason: 'Account locked' });
    throw new Error('Account is locked. Contact an administrator.');
  }
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    const nextUsers = users.map((item) => {
      if (item.id !== user.id) return item;
      const failedAttempts = item.failedAttempts + 1;
      return {
        ...item,
        failedAttempts,
        status: failedAttempts >= LOCKOUT_LIMIT ? 'Locked' as UserStatus : item.status,
        lockedUntil: failedAttempts >= LOCKOUT_LIMIT ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString() : item.lockedUntil,
        updatedAt: nowIso(),
      };
    });
    await writeJson(USERS_PATH, nextUsers);
    await appendLogin({ userId: user.id, username: user.username, ipAddress: ip, device, status: 'Failed', reason: 'Invalid password' });
    await appendAudit({ user: user.username, action: 'Failed login', ipAddress: ip, device, performedBy: 'System', newValue: `Failed attempts: ${user.failedAttempts + 1}` });
    throw new Error('Invalid username or password.');
  }
  const nextUsers = users.map((item) => item.id === user.id ? { ...item, failedAttempts: 0, lockedUntil: null, lastLoginAt: nowIso(), status: item.status === 'Pending First Login' ? item.status : 'Active' as UserStatus, updatedAt: nowIso() } : item);
  await writeJson(USERS_PATH, nextUsers);
  const fresh = nextUsers.find((item) => item.id === user.id) || user;
  await appendLogin({ userId: user.id, username: user.username, ipAddress: ip, device, status: 'Success' });
  await appendAudit({ user: user.username, action: 'Login', ipAddress: ip, device, performedBy: user.username });
  return publicUser(fresh);
};

export const changePassword = async (userId: string, currentPassword: string | undefined, newPassword: string, headers: Headers, performedBy?: string) => {
  const errors = passwordPolicyErrors(newPassword);
  if (errors.length) throw new Error(`Password policy failed: ${errors.join(', ')}`);
  const { ip, device } = client(headers);
  if (userId === 'global-admin') {
    const state = await readGlobalAdmin();
    if (currentPassword && !verifyPassword(currentPassword, state.passwordHash, state.passwordSalt)) throw new Error('Current password is not correct.');
    const hashed = hashPassword(newPassword);
    await writeGlobalAdmin({ ...state, passwordHash: hashed.hash, passwordSalt: hashed.salt, firstLoginRequired: false, passwordResetRequired: false, failedAttempts: 0, lockedUntil: null, updatedAt: nowIso() });
    await appendAudit({ user: 'Admin', action: 'Password change', ipAddress: ip, device, performedBy: performedBy || 'Admin' });
    return globalSessionUser(await readGlobalAdmin());
  }
  const users = await readUsers();
  const target = users.find((item) => item.id === userId);
  if (!target) throw new Error('User account was not found.');
  if (currentPassword && !verifyPassword(currentPassword, target.passwordHash, target.passwordSalt)) throw new Error('Current password is not correct.');
  const hashed = hashPassword(newPassword);
  const nextUsers = users.map((item) => item.id === userId ? {
    ...item,
    passwordHash: hashed.hash,
    passwordSalt: hashed.salt,
    firstLoginRequired: false,
    passwordResetRequired: false,
    status: 'Active' as UserStatus,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: nowIso(),
  } : item);
  await writeJson(USERS_PATH, nextUsers);
  await appendAudit({ user: target.username, action: 'Password change', ipAddress: ip, device, performedBy: performedBy || target.username });
  return publicUser(nextUsers.find((item) => item.id === userId) || target);
};

export const updateUser = async (userId: string, action: string, payload: any, headers: Headers, performedBy = 'Admin') => {
  const users = await readUsers();
  const target = users.find((item) => item.id === userId);
  if (!target) throw new Error('User account was not found.');
  let updated: UserAccount = target;
  const oldValue = JSON.stringify({ status: target.status, roles: target.roles, departmentAccess: target.departmentAccess, moduleAccess: target.moduleAccess });
  if (action === 'activate') updated = { ...target, status: 'Active', disabledAt: null, updatedAt: nowIso() };
  if (action === 'disable') updated = { ...target, status: 'Disabled', disabledAt: nowIso(), updatedAt: nowIso() };
  if (action === 'lock') updated = { ...target, status: 'Locked', lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString(), updatedAt: nowIso() };
  if (action === 'unlock') updated = { ...target, status: target.firstLoginRequired ? 'Pending First Login' : 'Active', failedAttempts: 0, lockedUntil: null, updatedAt: nowIso() };
  if (action === 'force-password-change') updated = { ...target, status: 'Password Reset Required', passwordResetRequired: true, updatedAt: nowIso() };
  if (action === 'reset-password') {
    const hashed = hashPassword(target.surname);
    updated = { ...target, passwordHash: hashed.hash, passwordSalt: hashed.salt, status: 'Password Reset Required', passwordResetRequired: true, failedAttempts: 0, lockedUntil: null, updatedAt: nowIso() };
  }
  if (action === 'assign-roles') {
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((item: string) => enterpriseRoles.includes(item as any)) : target.roles;
    updated = { ...target, roles, permissions: await effectivePermissionsForRoles(roles), updatedAt: nowIso() };
  }
  if (action === 'assign-access') {
    updated = {
      ...target,
      departmentAccess: Array.isArray(payload.departmentAccess) ? payload.departmentAccess.map(compact).filter(Boolean) : target.departmentAccess,
      moduleAccess: Array.isArray(payload.moduleAccess) ? payload.moduleAccess.map(compact).filter(Boolean) : target.moduleAccess,
      updatedAt: nowIso(),
    };
  }
  const nextUsers = users.map((item) => item.id === userId ? updated : item);
  await writeJson(USERS_PATH, nextUsers);
  const { ip, device } = client(headers);
  await appendAudit({ user: target.username, action: `User ${action}`, ipAddress: ip, device, oldValue, newValue: JSON.stringify({ status: updated.status, roles: updated.roles, departmentAccess: updated.departmentAccess, moduleAccess: updated.moduleAccess }), performedBy });
  return updated;
};

export const logoutAudit = async (user: string, userId: string, headers: Headers) => {
  const { ip, device } = client(headers);
  await appendLogin({ userId, username: user, ipAddress: ip, device, status: 'Logout' });
  await appendAudit({ user, action: 'Logout', ipAddress: ip, device, performedBy: user });
};

export const rolesPayload = () => roleDefinitions;
