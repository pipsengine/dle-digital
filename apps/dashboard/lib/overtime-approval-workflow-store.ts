import crypto from 'node:crypto';
import { approvedOvertimeStatuses } from '@/lib/timesheet-overtime-config';
import sql from 'mssql';
import { getDleEnterpriseDbPool } from '@/lib/dle-enterprise-db';
import { createEnterpriseNotification } from '@/lib/enterprise-notifications-store';
import type { SessionPayload } from '@/lib/auth/session';
import { readPayrollEmployees } from '@/lib/payroll-employee-source';

export type OvertimeAuthorizationStatus =
  | 'Submitted'
  | 'Project Manager Approved'
  | 'MD Approved'
  | 'Rejected'
  | 'Cancelled';

export type OvertimeAuthorizationRequest = {
  id: string;
  projectCode: string;
  projectName: string;
  workDate: string;
  workCenter: string;
  supervisorCode: string;
  supervisorName: string;
  requestedHours: number;
  requestedHeadcount: number;
  reason: string;
  status: OvertimeAuthorizationStatus;
  currentOwnerRole: string;
  currentOwnerName: string;
  projectManagerName: string;
  projectManagerEmail: string | null;
  mdApproverName: string;
  mdApproverEmail: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OvertimeAuthorizationInput = {
  projectCode: string;
  projectName?: string | null;
  workDate: string;
  workCenter?: string | null;
  supervisorCode?: string | null;
  supervisorName?: string | null;
  requestedHours: number;
  requestedHeadcount?: number | null;
  reason?: string | null;
  projectManagerName?: string | null;
  projectManagerEmail?: string | null;
  mdApproverName?: string | null;
  mdApproverEmail?: string | null;
  portalBaseUrl?: string | null;
};

type DbAuthorizationRow = {
  Id: string;
  ProjectCode: string;
  ProjectName: string;
  WorkDate: Date | string;
  WorkCenter: string;
  SupervisorCode: string;
  SupervisorName: string;
  RequestedHours: number;
  RequestedHeadcount: number;
  Reason: string;
  WorkflowStatus: OvertimeAuthorizationStatus;
  CurrentOwnerRole: string;
  CurrentOwnerName: string;
  ProjectManagerName: string;
  ProjectManagerEmail: string | null;
  MdApproverName: string;
  MdApproverEmail: string | null;
  CreatedBy: string;
  CreatedAt: Date | string;
  UpdatedAt: Date | string;
};

const dbReady = { value: false };
const clean = (value: unknown) => String(value || '').trim();
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateOnly = (value: Date | string) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const iso = (value: Date | string) => new Date(value).toISOString();
const token = () => crypto.randomBytes(32).toString('hex');

const systemSession = (actor: string): SessionPayload => ({
  sub: 'system-overtime-workflow',
  username: 'system-overtime-workflow',
  fullName: actor || 'Overtime Workflow',
  roles: ['System'],
  permissions: ['*'],
  status: 'Active',
  firstLoginRequired: false,
  passwordResetRequired: false,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const ensureDb = async () => {
  const pool = await getDleEnterpriseDbPool();
  if (!pool) throw new Error('DLE Enterprise database is not configured. Overtime approval workflow requires HRIS database persistence.');
  if (!dbReady.value) {
    await pool.request().query(`
IF SCHEMA_ID(N'hris') IS NULL EXEC(N'CREATE SCHEMA [hris]');
IF OBJECT_ID(N'[hris].[OvertimeAuthorizationRequests]', N'U') IS NULL
CREATE TABLE [hris].[OvertimeAuthorizationRequests] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_OvertimeAuthorizationRequests] PRIMARY KEY,
  [ProjectCode] NVARCHAR(80) NOT NULL,
  [ProjectName] NVARCHAR(220) NOT NULL,
  [WorkDate] DATE NOT NULL,
  [WorkCenter] NVARCHAR(180) NOT NULL,
  [SupervisorCode] NVARCHAR(80) NOT NULL,
  [SupervisorName] NVARCHAR(220) NOT NULL,
  [RequestedHours] DECIMAL(9,2) NOT NULL,
  [RequestedHeadcount] INT NOT NULL,
  [Reason] NVARCHAR(700) NOT NULL,
  [WorkflowStatus] NVARCHAR(60) NOT NULL,
  [CurrentOwnerRole] NVARCHAR(80) NOT NULL,
  [CurrentOwnerName] NVARCHAR(220) NOT NULL,
  [ProjectManagerName] NVARCHAR(220) NOT NULL,
  [ProjectManagerEmail] NVARCHAR(320) NULL,
  [MdApproverName] NVARCHAR(220) NOT NULL,
  [MdApproverEmail] NVARCHAR(320) NULL,
  [CreatedBy] NVARCHAR(220) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_OvertimeAuthorizationRequests_CreatedAt] DEFAULT SYSUTCDATETIME(),
  [UpdatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_OvertimeAuthorizationRequests_UpdatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[OvertimeAuthorizationAudit]', N'U') IS NULL
CREATE TABLE [hris].[OvertimeAuthorizationAudit] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_OvertimeAuthorizationAudit] PRIMARY KEY,
  [RequestId] NVARCHAR(120) NOT NULL,
  [Actor] NVARCHAR(220) NOT NULL,
  [ActionName] NVARCHAR(80) NOT NULL,
  [OldStatus] NVARCHAR(60) NULL,
  [NewStatus] NVARCHAR(60) NOT NULL,
  [Comment] NVARCHAR(700) NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_OvertimeAuthorizationAudit_CreatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[OvertimeAuthorizationTokens]', N'U') IS NULL
CREATE TABLE [hris].[OvertimeAuthorizationTokens] (
  [Token] NVARCHAR(120) NOT NULL CONSTRAINT [PK_OvertimeAuthorizationTokens] PRIMARY KEY,
  [RequestId] NVARCHAR(120) NOT NULL,
  [Stage] NVARCHAR(60) NOT NULL,
  [Decision] NVARCHAR(20) NOT NULL,
  [RecipientName] NVARCHAR(220) NOT NULL,
  [RecipientEmail] NVARCHAR(320) NULL,
  [ExpiresAt] DATETIME2 NOT NULL,
  [UsedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_OvertimeAuthorizationTokens_CreatedAt] DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'[hris].[EmailNotificationOutbox]', N'U') IS NULL
CREATE TABLE [hris].[EmailNotificationOutbox] (
  [Id] NVARCHAR(120) NOT NULL CONSTRAINT [PK_EmailNotificationOutbox] PRIMARY KEY,
  [RecipientEmail] NVARCHAR(320) NULL,
  [RecipientName] NVARCHAR(220) NOT NULL,
  [Subject] NVARCHAR(300) NOT NULL,
  [HtmlBody] NVARCHAR(MAX) NOT NULL,
  [TextBody] NVARCHAR(MAX) NOT NULL,
  [ProviderStatus] NVARCHAR(60) NOT NULL,
  [ProviderResponse] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_EmailNotificationOutbox_CreatedAt] DEFAULT SYSUTCDATETIME()
);`);
    dbReady.value = true;
  }
  return pool;
};

const mapRow = (row: DbAuthorizationRow): OvertimeAuthorizationRequest => ({
  id: row.Id,
  projectCode: row.ProjectCode,
  projectName: row.ProjectName,
  workDate: dateOnly(row.WorkDate),
  workCenter: row.WorkCenter,
  supervisorCode: row.SupervisorCode,
  supervisorName: row.SupervisorName,
  requestedHours: Number(row.RequestedHours || 0),
  requestedHeadcount: Number(row.RequestedHeadcount || 0),
  reason: row.Reason,
  status: row.WorkflowStatus,
  currentOwnerRole: row.CurrentOwnerRole,
  currentOwnerName: row.CurrentOwnerName,
  projectManagerName: row.ProjectManagerName,
  projectManagerEmail: row.ProjectManagerEmail,
  mdApproverName: row.MdApproverName,
  mdApproverEmail: row.MdApproverEmail,
  createdBy: row.CreatedBy,
  createdAt: iso(row.CreatedAt),
  updatedAt: iso(row.UpdatedAt),
});

const portalBase = (input?: string | null) => clean(input || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3020').replace(/\/$/, '');

const emailForName = async (nameOrEmail: string) => {
  const value = clean(nameOrEmail);
  if (!value) return null;
  if (value.includes('@')) return value;
  const source = await readPayrollEmployees();
  const lower = value.toLowerCase();
  const employee = source.employees.find((item) =>
    [item.employeeCode, item.employeeId, item.fullName].some((field) => clean(field).toLowerCase() === lower || clean(field).toLowerCase().includes(lower)),
  );
  return clean(employee?.officialEmail || employee?.email || employee?.personalEmail) || null;
};

const writeAudit = async (requestId: string, actor: string, action: string, oldStatus: string | null, newStatus: string, comment?: string | null) => {
  const pool = await ensureDb();
  await pool.request()
    .input('Id', sql.NVarChar(120), `ota-aud-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    .input('RequestId', sql.NVarChar(120), requestId)
    .input('Actor', sql.NVarChar(220), clean(actor) || 'Overtime Workflow')
    .input('ActionName', sql.NVarChar(80), action)
    .input('OldStatus', sql.NVarChar(60), oldStatus)
    .input('NewStatus', sql.NVarChar(60), newStatus)
    .input('Comment', sql.NVarChar(700), clean(comment) || null)
    .query('INSERT INTO [hris].[OvertimeAuthorizationAudit] ([Id],[RequestId],[Actor],[ActionName],[OldStatus],[NewStatus],[Comment]) VALUES (@Id,@RequestId,@Actor,@ActionName,@OldStatus,@NewStatus,@Comment);');
};

const saveToken = async (requestId: string, stage: string, decision: 'approve' | 'reject', recipientName: string, recipientEmail: string | null) => {
  const pool = await ensureDb();
  const value = token();
  await pool.request()
    .input('Token', sql.NVarChar(120), value)
    .input('RequestId', sql.NVarChar(120), requestId)
    .input('Stage', sql.NVarChar(60), stage)
    .input('Decision', sql.NVarChar(20), decision)
    .input('RecipientName', sql.NVarChar(220), recipientName)
    .input('RecipientEmail', sql.NVarChar(320), recipientEmail)
    .query(`INSERT INTO [hris].[OvertimeAuthorizationTokens] ([Token],[RequestId],[Stage],[Decision],[RecipientName],[RecipientEmail],[ExpiresAt])
VALUES (@Token,@RequestId,@Stage,@Decision,@RecipientName,@RecipientEmail,DATEADD(day,7,SYSUTCDATETIME()));`);
  return value;
};

const deliverEmail = async (recipientEmail: string | null, recipientName: string, subject: string, html: string, text: string) => {
  const pool = await ensureDb();
  let providerStatus = recipientEmail ? 'Queued' : 'Missing Recipient Email';
  let providerResponse: string | null = null;
  const webhook = clean(process.env.EMAIL_WEBHOOK_URL);
  if (recipientEmail && webhook) {
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: recipientEmail, recipientName, subject, html, text }),
      });
      providerStatus = response.ok ? 'Sent' : 'Provider Error';
      providerResponse = await response.text().catch(() => `${response.status}`);
    } catch (error) {
      providerStatus = 'Provider Error';
      providerResponse = error instanceof Error ? error.message : 'Email provider failed';
    }
  }
  await pool.request()
    .input('Id', sql.NVarChar(120), `email-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    .input('RecipientEmail', sql.NVarChar(320), recipientEmail)
    .input('RecipientName', sql.NVarChar(220), recipientName)
    .input('Subject', sql.NVarChar(300), subject)
    .input('HtmlBody', sql.NVarChar(sql.MAX), html)
    .input('TextBody', sql.NVarChar(sql.MAX), text)
    .input('ProviderStatus', sql.NVarChar(60), providerStatus)
    .input('ProviderResponse', sql.NVarChar(sql.MAX), providerResponse)
    .query('INSERT INTO [hris].[EmailNotificationOutbox] ([Id],[RecipientEmail],[RecipientName],[Subject],[HtmlBody],[TextBody],[ProviderStatus],[ProviderResponse]) VALUES (@Id,@RecipientEmail,@RecipientName,@Subject,@HtmlBody,@TextBody,@ProviderStatus,@ProviderResponse);');
};

const notifyApprovalOwner = async (request: OvertimeAuthorizationRequest, stage: 'project-manager' | 'md', baseUrl?: string | null) => {
  const isMd = stage === 'md';
  const recipientName = isMd ? request.mdApproverName : request.projectManagerName;
  const recipientEmail = isMd ? request.mdApproverEmail : request.projectManagerEmail;
  const role = isMd ? 'Executive Management' : 'Project Manager';
  const approveToken = await saveToken(request.id, stage, 'approve', recipientName, recipientEmail);
  const rejectToken = await saveToken(request.id, stage, 'reject', recipientName, recipientEmail);
  const openLink = `${portalBase(baseUrl)}/hris/workforce-management/overtime-management?requestId=${encodeURIComponent(request.id)}`;
  const approveLink = `${portalBase(baseUrl)}/api/hris/workforce-management/overtime-management/email-action?token=${approveToken}`;
  const rejectLink = `${portalBase(baseUrl)}/api/hris/workforce-management/overtime-management/email-action?token=${rejectToken}`;
  const subject = `Overtime approval required: ${request.projectCode} on ${request.workDate}`;
  const text = `Overtime approval is waiting for ${recipientName}.
Project: ${request.projectCode} - ${request.projectName}
Date: ${request.workDate}
Supervisor: ${request.supervisorName}
Hours: ${request.requestedHours}
Reason: ${request.reason}
Approve: ${approveLink}
Reject: ${rejectLink}
Open in portal: ${openLink}`;
  const html = `<p>Overtime approval is waiting for <strong>${recipientName}</strong>.</p>
<p><strong>Project:</strong> ${request.projectCode} - ${request.projectName}<br/><strong>Date:</strong> ${request.workDate}<br/><strong>Supervisor:</strong> ${request.supervisorName}<br/><strong>Hours:</strong> ${request.requestedHours}</p>
<p>${request.reason}</p>
<p><a href="${approveLink}">Approve</a> &nbsp; <a href="${rejectLink}">Reject</a> &nbsp; <a href="${openLink}">Open in portal</a></p>`;
  await createEnterpriseNotification(systemSession(request.createdBy), {
    kind: 'Approval',
    module: 'Overtime Management',
    title: subject,
    body: `${request.requestedHours}h overtime for ${request.projectCode} requires ${role} approval.`,
    severity: 'warning',
    href: openLink.replace(portalBase(baseUrl), ''),
    recipientRoles: [role],
    channels: ['In-App', 'Email'],
    metadata: { requestId: request.id, stage },
  });
  await deliverEmail(recipientEmail, recipientName, subject, html, text);
};

const notifySupervisorApproved = async (request: OvertimeAuthorizationRequest, baseUrl?: string | null) => {
  const href = `/hris/time-and-logs/timesheet-entry?date=${encodeURIComponent(request.workDate)}&supervisorId=${encodeURIComponent(`${request.supervisorCode} - ${request.supervisorName}`)}`;
  await createEnterpriseNotification(systemSession(request.createdBy), {
    kind: 'Workflow',
    module: 'Overtime Management',
    title: `Overtime approved for ${request.projectCode}`,
    body: `${request.requestedHours}h overtime is approved. The supervisor can book it on the timesheet.`,
    severity: 'success',
    href,
    recipientEmployeeCode: request.supervisorCode || undefined,
    recipientRoles: ['Supervisor'],
    channels: ['In-App', 'Email'],
    metadata: { requestId: request.id, projectCode: request.projectCode },
  });
  await deliverEmail(
    await emailForName(request.supervisorCode || request.supervisorName),
    request.supervisorName,
    `Overtime approved: ${request.projectCode} on ${request.workDate}`,
    `<p>Overtime has been approved for <strong>${request.projectCode}</strong>.</p><p><a href="${portalBase(baseUrl)}${href}">Open Timesheet Entry</a></p>`,
    `Overtime has been approved for ${request.projectCode}. Open Timesheet Entry: ${portalBase(baseUrl)}${href}`,
  );
};

export const listOvertimeAuthorizationRequests = async () => {
  const pool = await ensureDb();
  const result = await pool.request().query<DbAuthorizationRow>('SELECT * FROM [hris].[OvertimeAuthorizationRequests] ORDER BY [WorkDate] DESC, [CreatedAt] DESC');
  return result.recordset.map(mapRow);
};

export const createOvertimeAuthorizationRequest = async (input: OvertimeAuthorizationInput, actor?: string | null) => {
  const projectCode = clean(input.projectCode);
  if (!projectCode) throw new Error('Project code is required for overtime authorization.');
  if (!clean(input.workDate)) throw new Error('Overtime work date is required.');
  const requestedHours = num(input.requestedHours);
  if (requestedHours <= 0) throw new Error('Requested overtime hours must be greater than zero.');
  const projectManagerName = clean(input.projectManagerName) || 'Project Manager';
  const mdApproverName = clean(input.mdApproverName) || 'Managing Director';
  const projectManagerEmail = clean(input.projectManagerEmail) || await emailForName(projectManagerName);
  const mdApproverEmail = clean(input.mdApproverEmail) || await emailForName(mdApproverName);
  const id = `ota-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pool = await ensureDb();
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('ProjectCode', sql.NVarChar(80), projectCode)
    .input('ProjectName', sql.NVarChar(220), clean(input.projectName) || projectCode)
    .input('WorkDate', sql.Date, clean(input.workDate))
    .input('WorkCenter', sql.NVarChar(180), clean(input.workCenter) || 'Unassigned')
    .input('SupervisorCode', sql.NVarChar(80), clean(input.supervisorCode) || clean(input.supervisorName) || 'Unassigned')
    .input('SupervisorName', sql.NVarChar(220), clean(input.supervisorName) || clean(input.supervisorCode) || 'Unassigned')
    .input('RequestedHours', sql.Decimal(9, 2), requestedHours)
    .input('RequestedHeadcount', sql.Int, Math.max(1, Math.round(num(input.requestedHeadcount) || 1)))
    .input('Reason', sql.NVarChar(700), clean(input.reason) || 'Production overtime requested.')
    .input('CurrentOwnerName', sql.NVarChar(220), projectManagerName)
    .input('ProjectManagerName', sql.NVarChar(220), projectManagerName)
    .input('ProjectManagerEmail', sql.NVarChar(320), projectManagerEmail || null)
    .input('MdApproverName', sql.NVarChar(220), mdApproverName)
    .input('MdApproverEmail', sql.NVarChar(320), mdApproverEmail || null)
    .input('CreatedBy', sql.NVarChar(220), clean(actor) || 'Production Manager')
    .query(`INSERT INTO [hris].[OvertimeAuthorizationRequests]
([Id],[ProjectCode],[ProjectName],[WorkDate],[WorkCenter],[SupervisorCode],[SupervisorName],[RequestedHours],[RequestedHeadcount],[Reason],[WorkflowStatus],[CurrentOwnerRole],[CurrentOwnerName],[ProjectManagerName],[ProjectManagerEmail],[MdApproverName],[MdApproverEmail],[CreatedBy])
VALUES (@Id,@ProjectCode,@ProjectName,@WorkDate,@WorkCenter,@SupervisorCode,@SupervisorName,@RequestedHours,@RequestedHeadcount,@Reason,'Submitted','Project Manager',@CurrentOwnerName,@ProjectManagerName,@ProjectManagerEmail,@MdApproverName,@MdApproverEmail,@CreatedBy);`);
  await writeAudit(id, clean(actor) || 'Production Manager', 'submit-authorization', null, 'Submitted', input.reason);
  const request = (await listOvertimeAuthorizationRequests()).find((item) => item.id === id)!;
  await notifyApprovalOwner(request, 'project-manager', input.portalBaseUrl);
  return request;
};

export const actOnOvertimeAuthorizationRequest = async (id: string, decision: 'approve' | 'reject', actor?: string | null, comment?: string | null, baseUrl?: string | null) => {
  const request = (await listOvertimeAuthorizationRequests()).find((item) => item.id === id);
  if (!request) throw new Error('Overtime authorization request was not found.');
  if (['Rejected', 'Cancelled', 'MD Approved'].includes(request.status)) throw new Error(`Request is already ${request.status}.`);
  const oldStatus = request.status;
  const actorText = clean(actor).toLowerCase();
  const isSuperAdministrator = actorText.includes('super administrator') || actorText.includes('global super');
  const nextStatus: OvertimeAuthorizationStatus = decision === 'reject'
    ? 'Rejected'
    : isSuperAdministrator
      ? 'MD Approved'
      : oldStatus === 'Submitted'
      ? 'Project Manager Approved'
      : 'MD Approved';
  const ownerRole = nextStatus === 'Project Manager Approved' ? 'Managing Director' : nextStatus === 'MD Approved' ? 'Supervisor' : 'Closed';
  const ownerName = nextStatus === 'Project Manager Approved' ? request.mdApproverName : nextStatus === 'MD Approved' ? request.supervisorName : 'Closed';
  const pool = await ensureDb();
  await pool.request()
    .input('Id', sql.NVarChar(120), id)
    .input('WorkflowStatus', sql.NVarChar(60), nextStatus)
    .input('CurrentOwnerRole', sql.NVarChar(80), ownerRole)
    .input('CurrentOwnerName', sql.NVarChar(220), ownerName)
    .query('UPDATE [hris].[OvertimeAuthorizationRequests] SET [WorkflowStatus]=@WorkflowStatus,[CurrentOwnerRole]=@CurrentOwnerRole,[CurrentOwnerName]=@CurrentOwnerName,[UpdatedAt]=SYSUTCDATETIME() WHERE [Id]=@Id;');
  await writeAudit(id, clean(actor) || request.currentOwnerName, isSuperAdministrator && decision === 'approve' ? 'super-admin-approve-all' : decision, oldStatus, nextStatus, comment);
  const updated = (await listOvertimeAuthorizationRequests()).find((item) => item.id === id)!;
  if (nextStatus === 'Project Manager Approved') await notifyApprovalOwner(updated, 'md', baseUrl);
  if (nextStatus === 'MD Approved') await notifySupervisorApproved(updated, baseUrl);
  return updated;
};

export const actOnOvertimeAuthorizationToken = async (tokenValue: string) => {
  const pool = await ensureDb();
  const result = await pool.request()
    .input('Token', sql.NVarChar(120), clean(tokenValue))
    .query<{ RequestId: string; Decision: 'approve' | 'reject'; RecipientName: string; UsedAt: Date | null; ExpiresAt: Date }>('SELECT [RequestId],[Decision],[RecipientName],[UsedAt],[ExpiresAt] FROM [hris].[OvertimeAuthorizationTokens] WHERE [Token]=@Token;');
  const tokenRow = result.recordset[0];
  if (!tokenRow) throw new Error('Approval link is invalid.');
  if (tokenRow.UsedAt) throw new Error('Approval link has already been used.');
  if (new Date(tokenRow.ExpiresAt).getTime() < Date.now()) throw new Error('Approval link has expired.');
  const updated = await actOnOvertimeAuthorizationRequest(tokenRow.RequestId, tokenRow.Decision, tokenRow.RecipientName, 'Email action link');
  await pool.request()
    .input('Token', sql.NVarChar(120), clean(tokenValue))
    .query('UPDATE [hris].[OvertimeAuthorizationTokens] SET [UsedAt]=SYSUTCDATETIME() WHERE [Token]=@Token;');
  return updated;
};

export const listApprovedOvertimeForSupervisor = async (
  date: string,
  supervisorValue?: string | null,
  workCenter?: string | null,
) => {
  const code = clean(supervisorValue).split(' - ')[0].toLowerCase();
  const center = clean(workCenter).toLowerCase();
  const statuses = approvedOvertimeStatuses();
  const rows = await listOvertimeAuthorizationRequests();
  return rows.filter((item) =>
    statuses.includes(item.status) &&
    item.workDate === dateOnly(date) &&
    (!code || item.supervisorCode.toLowerCase() === code || item.supervisorName.toLowerCase().includes(code)) &&
    (!center || !clean(item.workCenter) || clean(item.workCenter).toLowerCase() === center || clean(item.workCenter).toLowerCase().includes(center)),
  );
};
