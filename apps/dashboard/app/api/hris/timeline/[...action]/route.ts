import { NextResponse } from 'next/server';

type Role =
  | 'Super Admin'
  | 'HR Director'
  | 'HR Manager'
  | 'HR Officer'
  | 'Admin Officer'
  | 'Department Head'
  | 'Line Manager'
  | 'Payroll Officer'
  | 'HSE Officer'
  | 'Compliance Officer'
  | 'Auditor'
  | 'Employee'
  | 'Executive Management'
  | 'IT Administrator'
  | 'Legal Officer';

type Severity = 'high' | 'medium' | 'low';
type Visibility = 'HR Only' | 'Manager Visible' | 'Employee Visible' | 'Audit Only' | 'Executive Visible';
type ApprovalStatus = 'Not Applicable' | 'Pending' | 'Approved' | 'Rejected';
type EventCategory =
  | 'Employment'
  | 'Job Information'
  | 'Department Assignment'
  | 'Reporting Line'
  | 'Contract'
  | 'Status Change'
  | 'Emergency Contact'
  | 'Next of Kin'
  | 'Documents'
  | 'Leave'
  | 'Attendance'
  | 'Payroll'
  | 'Performance'
  | 'Training'
  | 'Assets'
  | 'Disciplinary'
  | 'Medical / HSE'
  | 'Compliance'
  | 'System Access'
  | 'Audit';

type TimelineEvent = {
  id: string;
  employeeId: string;
  eventReferenceNo: string;
  eventCategory: EventCategory;
  eventType: string;
  eventTitle: string;
  eventDescription: string;
  eventDate: string;
  effectiveDate?: string | null;
  sourceModule: string;
  sourceRecordId?: string | null;
  relatedWorkflowId?: string | null;
  relatedDocumentId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  severity: Severity;
  visibility: Visibility;
  isSystemGenerated: boolean;
  approvalStatus: ApprovalStatus;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimelineEventComment = { id: string; eventId: string; at: string; by: string; comment: string };

const jsonOk = <T,>(data: T) => NextResponse.json({ status: 'success', data });
const jsonErr = (status: number, error: string) => NextResponse.json({ status: 'error', error }, { status });
const nowIso = () => new Date().toISOString();

const getRole = (request: Request): Role => {
  const v = request.headers.get('x-hris-role');
  const all: Role[] = [
    'Super Admin',
    'HR Director',
    'HR Manager',
    'HR Officer',
    'Admin Officer',
    'Department Head',
    'Line Manager',
    'Payroll Officer',
    'HSE Officer',
    'Compliance Officer',
    'Auditor',
    'Employee',
    'Executive Management',
    'IT Administrator',
    'Legal Officer',
  ];
  return (all.includes(v as Role) ? (v as Role) : 'HR Manager') as Role;
};

const getViewerEmployeeId = (request: Request) => {
  const v = request.headers.get('x-hris-employee-id');
  return v && v.trim() ? v.trim() : undefined;
};

const normalizeStr = (v: unknown, max: number) => {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
};

const stores = () => {
  const g = globalThis as unknown as {
    __dleHrisEmployees?: Map<string, any>;
    __dleHrisTimelineManualByEmployee?: Map<string, TimelineEvent[]>;
    __dleHrisTimelineManualById?: Map<string, TimelineEvent>;
    __dleHrisTimelineComments?: Map<string, TimelineEventComment[]>;
    __dleHrisDocumentVersions?: Map<string, any[]>;
    __dleHrisContracts?: Map<string, any>;
    __dleHrisContractsByEmployee?: Map<string, string[]>;
    __dleHrisStatusHistoryByEmployee?: Map<string, any[]>;
  };
  if (!g.__dleHrisEmployees) g.__dleHrisEmployees = new Map();
  if (!g.__dleHrisTimelineManualByEmployee) g.__dleHrisTimelineManualByEmployee = new Map();
  if (!g.__dleHrisTimelineManualById) g.__dleHrisTimelineManualById = new Map();
  if (!g.__dleHrisTimelineComments) g.__dleHrisTimelineComments = new Map();
  if (!g.__dleHrisDocumentVersions) g.__dleHrisDocumentVersions = new Map();
  if (!g.__dleHrisContracts) g.__dleHrisContracts = new Map();
  if (!g.__dleHrisContractsByEmployee) g.__dleHrisContractsByEmployee = new Map();
  if (!g.__dleHrisStatusHistoryByEmployee) g.__dleHrisStatusHistoryByEmployee = new Map();
  return {
    employees: g.__dleHrisEmployees,
    manualByEmployee: g.__dleHrisTimelineManualByEmployee,
    manualById: g.__dleHrisTimelineManualById,
    comments: g.__dleHrisTimelineComments,
    docVersions: g.__dleHrisDocumentVersions,
    contracts: g.__dleHrisContracts,
    contractsByEmployee: g.__dleHrisContractsByEmployee,
    statusHistoryByEmployee: g.__dleHrisStatusHistoryByEmployee,
  };
};

const parseEventId = (id: string) => {
  const parts = id.split('__');
  if (parts.length < 5) return null;
  if (parts[0] !== 'tl') return null;
  const employeeId = parts[1] || '';
  const moduleKey = parts[2] || '';
  const sourceId = parts[3] || '';
  const typeKey = parts.slice(4).join('__') || '';
  if (!employeeId || !moduleKey || !sourceId || !typeKey) return null;
  return { employeeId, moduleKey, sourceId, typeKey };
};

const canViewEvent = (role: Role, viewerEmployeeId: string | undefined, employeeId: string, ev: Pick<TimelineEvent, 'visibility' | 'eventCategory' | 'eventTitle'>) => {
  if (role === 'Employee') return Boolean(viewerEmployeeId && viewerEmployeeId === employeeId && ev.visibility === 'Employee Visible');
  if (role === 'Executive Management') return ev.visibility === 'Executive Visible';
  if (role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer' || role === 'Admin Officer') return true;
  if (role === 'Auditor') return true;
  if (role === 'Line Manager' || role === 'Department Head') return ev.visibility === 'Manager Visible' || ev.visibility === 'Employee Visible';
  if (role === 'Payroll Officer') return ev.eventCategory === 'Payroll';
  if (role === 'HSE Officer') return ev.eventCategory === 'Medical / HSE' || ev.eventCategory === 'Emergency Contact' || (ev.eventCategory === 'Documents' && /medical|hse/i.test(ev.eventTitle));
  if (role === 'Compliance Officer') return ev.eventCategory === 'Compliance' || ev.eventCategory === 'Audit' || (ev.eventCategory === 'Documents' && /(nin|bvn|passport|tax|pension|id)/i.test(ev.eventTitle));
  if (role === 'Legal Officer') return ev.eventCategory === 'Contract' || (ev.eventCategory === 'Documents' && /(contract|offer|employment|warning|disciplinary)/i.test(ev.eventTitle)) || ev.eventCategory === 'Audit';
  if (role === 'IT Administrator') return ev.eventCategory === 'System Access' || ev.eventCategory === 'Audit';
  return false;
};

const minimalEventFor = (employeeId: string, id: string): TimelineEvent => {
  const now = nowIso();
  return {
    id,
    employeeId,
    eventReferenceNo: `TL-${employeeId}-REF`,
    eventCategory: 'Audit',
    eventType: 'System Event',
    eventTitle: 'System event',
    eventDescription: 'Timeline event details were not found in the current in-memory store.',
    eventDate: now,
    effectiveDate: now,
    sourceModule: 'Timeline',
    sourceRecordId: id,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    previousValue: null,
    newValue: null,
    reason: null,
    severity: 'low',
    visibility: 'HR Only',
    isSystemGenerated: true,
    approvalStatus: 'Not Applicable',
    createdBy: 'System',
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

const findEvent = (eventId: string): TimelineEvent | null => {
  const s = stores();
  const parsed = parseEventId(eventId);
  if (!parsed) return null;
  const { employeeId } = parsed;
  const manual = s.manualById.get(eventId);
  if (manual) return manual;
  const rec = s.employees.get(employeeId);
  if (!rec) return null;
  const audit = Array.isArray(rec.audit) ? (rec.audit as any[]) : [];
  const docList = Array.isArray(rec.documents) ? (rec.documents as any[]) : [];
  const training = Array.isArray(rec.training) ? (rec.training as any[]) : [];
  const assets = Array.isArray(rec.assets) ? (rec.assets as any[]) : [];
  const leave = Array.isArray(rec.leaveSummary?.history) ? (rec.leaveSummary.history as any[]) : [];
  const att = Array.isArray(rec.attendanceSummary?.biometricLogs) ? (rec.attendanceSummary.biometricLogs as any[]) : [];
  const disciplinary = Array.isArray(rec.disciplinary) ? (rec.disciplinary as any[]) : [];
  const incidents = Array.isArray(rec.medicalHse?.incidentHistory) ? (rec.medicalHse.incidentHistory as any[]) : [];
  const hseCerts = Array.isArray(rec.medicalHse?.hseCertifications) ? (rec.medicalHse.hseCertifications as any[]) : [];
  const emergency = Array.isArray(rec.emergencyContacts) ? (rec.emergencyContacts as any[]) : [];
  const nok = Array.isArray(rec.nextOfKin) ? (rec.nextOfKin as any[]) : [];
  const history = Array.isArray(rec.history) ? (rec.history as any[]) : [];
  const statusHistory = s.statusHistoryByEmployee.get(employeeId) || [];
  const contractIds = s.contractsByEmployee.get(employeeId) || [];

  const byId = <T extends { id: string }>(arr: T[]) => arr.find((x) => x && x.id === parsed.sourceId) || null;

  const asIso = (v: string) => (v.includes('T') ? v : `${v}T00:00:00.000Z`);

  if (parsed.moduleKey === 'manual') {
    return s.manualById.get(eventId) || minimalEventFor(employeeId, eventId);
  }
  if (parsed.moduleKey === 'audit') {
    const a = byId(audit);
    if (!a) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-AUD-${a.id}`,
      eventCategory: 'Audit',
      eventType: String(a.action || 'Audit'),
      eventTitle: String(a.action || 'Audit event'),
      eventDescription: [a.reason ? `Reason: ${a.reason}` : null, a.oldValue ? `Old: ${a.oldValue}` : null, a.newValue ? `New: ${a.newValue}` : null].filter(Boolean).join(' • ') || 'Audit event.',
      eventDate: String(a.at || nowIso()),
      effectiveDate: String(a.at || nowIso()),
      sourceModule: 'Audit',
      sourceRecordId: String(a.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: a.oldValue ? String(a.oldValue) : null,
      newValue: a.newValue ? String(a.newValue) : null,
      reason: a.reason ? String(a.reason) : null,
      severity: String(a.action || '').toLowerCase().includes('denied') ? 'high' : String(a.action || '').toLowerCase().includes('rejected') ? 'medium' : 'low',
      visibility: 'Audit Only',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: String(a.performedBy || 'System'),
      approvedBy: null,
      approvedAt: null,
      createdAt: String(a.at || nowIso()),
      updatedAt: String(a.at || nowIso()),
    };
  }
  if (parsed.moduleKey === 'documents') {
    const docId = parsed.sourceId.split('_')[0] || parsed.sourceId;
    const d = docList.find((x) => x && x.id === docId) || null;
    if (!d) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-DOC-${docId}`,
      eventCategory: 'Documents',
      eventType: 'Document Event',
      eventTitle: `${String(d.category || 'Document')} timeline event`,
      eventDescription: `File: ${String(d.fileName || '')} • Status: ${String(d.status || '')}`,
      eventDate: String(d.uploadedAt || nowIso()),
      effectiveDate: d.issueDate ? String(d.issueDate) : null,
      sourceModule: 'Documents',
      sourceRecordId: docId,
      relatedWorkflowId: null,
      relatedDocumentId: docId,
      previousValue: null,
      newValue: String(d.status || ''),
      reason: d.notes ? String(d.notes) : null,
      severity: String(d.status || '').toLowerCase().includes('expired') ? 'high' : String(d.status || '').toLowerCase().includes('rejected') ? 'medium' : 'low',
      visibility: d.confidentialityLevel === 'Restricted' ? 'HR Only' : 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: String(d.status || '') === 'Verified' ? 'Approved' : String(d.status || '') === 'Rejected' ? 'Rejected' : String(d.status || '') === 'Pending Verification' ? 'Pending' : 'Not Applicable',
      createdBy: String(d.uploadedBy || 'System'),
      approvedBy: d.verifiedBy ? String(d.verifiedBy) : null,
      approvedAt: d.verifiedAt ? String(d.verifiedAt) : null,
      createdAt: String(d.uploadedAt || nowIso()),
      updatedAt: String(d.uploadedAt || nowIso()),
    };
  }
  if (parsed.moduleKey === 'employmenthistory') {
    const h = byId(history);
    if (!h) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-EMP-${h.id}`,
      eventCategory: 'Employment',
      eventType: String(h.type || 'Employment Event'),
      eventTitle: String(h.type || 'Employment Event'),
      eventDescription: String(h.detail || ''),
      eventDate: String(h.at || nowIso()),
      effectiveDate: String(h.at || nowIso()),
      sourceModule: 'Employment History',
      sourceRecordId: String(h.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: null,
      reason: null,
      severity: 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: String(h.actor || 'System'),
      approvedBy: null,
      approvedAt: null,
      createdAt: String(h.at || nowIso()),
      updatedAt: String(h.at || nowIso()),
    };
  }
  if (parsed.moduleKey === 'training') {
    const t = byId(training);
    if (!t) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-TRN-${t.id}`,
      eventCategory: 'Training',
      eventType: String(t.status || 'Training'),
      eventTitle: `${String(t.trainingName || 'Training')} event`,
      eventDescription: `Provider: ${String(t.provider || '')} • Status: ${String(t.status || '')}`,
      eventDate: t.completionDate ? asIso(String(t.completionDate)) : nowIso(),
      effectiveDate: t.completionDate ? String(t.completionDate) : null,
      sourceModule: 'Training',
      sourceRecordId: String(t.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(t.status || ''),
      reason: null,
      severity: String(t.status || '') === 'Expired' ? 'high' : 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: 'System',
      approvedBy: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  if (parsed.moduleKey === 'assets') {
    const a = byId(assets);
    if (!a) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-AST-${a.id}`,
      eventCategory: 'Assets',
      eventType: String(a.returnStatus || 'Assigned'),
      eventTitle: `${String(a.assetName || 'Asset')} event`,
      eventDescription: `Tag: ${String(a.assetTag || '')} • Status: ${String(a.returnStatus || '')}`,
      eventDate: asIso(String(a.assignedDate || nowIso())),
      effectiveDate: a.assignedDate ? String(a.assignedDate) : null,
      sourceModule: 'Assets',
      sourceRecordId: String(a.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(a.returnStatus || ''),
      reason: null,
      severity: 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: 'System',
      approvedBy: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  if (parsed.moduleKey === 'leave') {
    const l = byId(leave);
    if (!l) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-LVE-${l.id}`,
      eventCategory: 'Leave',
      eventType: `Leave ${String(l.status || '')}`,
      eventTitle: `${String(l.type || 'Leave')} event`,
      eventDescription: `Start: ${String(l.start || '').slice(0, 10)} • End: ${String(l.end || '').slice(0, 10)} • Days: ${String(l.days || '')}`,
      eventDate: l.start ? asIso(String(l.start)) : nowIso(),
      effectiveDate: l.start ? String(l.start) : null,
      sourceModule: 'Leave',
      sourceRecordId: String(l.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(l.status || ''),
      reason: null,
      severity: String(l.status || '') === 'Rejected' ? 'medium' : String(l.status || '') === 'Pending' ? 'medium' : 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: String(l.status || '') === 'Approved' ? 'Approved' : String(l.status || '') === 'Rejected' ? 'Rejected' : String(l.status || '') === 'Pending' ? 'Pending' : 'Not Applicable',
      createdBy: 'System',
      approvedBy: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  if (parsed.moduleKey === 'attendance') {
    const b = byId(att);
    if (!b) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-ATT-${b.id}`,
      eventCategory: 'Attendance',
      eventType: 'Attendance Log',
      eventTitle: `Biometric log: ${String(b.status || '')}`,
      eventDescription: `Source: ${String(b.source || '')} • Status: ${String(b.status || '')}`,
      eventDate: String(b.at || nowIso()),
      effectiveDate: String(b.at || nowIso()),
      sourceModule: 'Attendance',
      sourceRecordId: String(b.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(b.status || ''),
      reason: null,
      severity: String(b.status || '').toLowerCase().includes('failed') ? 'high' : 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: 'System',
      approvedBy: null,
      approvedAt: null,
      createdAt: String(b.at || nowIso()),
      updatedAt: String(b.at || nowIso()),
    };
  }
  if (parsed.moduleKey === 'disciplinary') {
    const d = byId(disciplinary);
    if (!d) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-DSP-${d.id}`,
      eventCategory: 'Disciplinary',
      eventType: `Case ${String(d.status || '')}`,
      eventTitle: `${String(d.caseType || 'Case')} event`,
      eventDescription: String(d.description || ''),
      eventDate: asIso(String(d.dateReported || nowIso())),
      effectiveDate: d.dateReported ? String(d.dateReported) : null,
      sourceModule: 'Disciplinary',
      sourceRecordId: String(d.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(d.status || ''),
      reason: d.actionTaken ? String(d.actionTaken) : null,
      severity: String(d.status || '') === 'Open' ? 'high' : 'medium',
      visibility: 'HR Only',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: 'System',
      approvedBy: d.approver ? String(d.approver) : null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  if (parsed.moduleKey === 'medical_hse') {
    const inc = byId(incidents);
    if (inc) {
      return {
        id: eventId,
        employeeId,
        eventReferenceNo: `TL-${employeeId}-HSE-${inc.id}`,
        eventCategory: 'Medical / HSE',
        eventType: 'Incident Logged',
        eventTitle: String(inc.title || 'Incident'),
        eventDescription: `Status: ${String(inc.status || '')}`,
        eventDate: String(inc.at || nowIso()),
        effectiveDate: String(inc.at || nowIso()),
        sourceModule: 'Medical / HSE',
        sourceRecordId: String(inc.id),
        relatedWorkflowId: null,
        relatedDocumentId: null,
        previousValue: null,
        newValue: String(inc.status || ''),
        reason: null,
        severity: (inc.severity as Severity) || 'medium',
        visibility: 'HR Only',
        isSystemGenerated: true,
        approvalStatus: 'Not Applicable',
        createdBy: 'System',
        approvedBy: null,
        approvedAt: null,
        createdAt: String(inc.at || nowIso()),
        updatedAt: String(inc.at || nowIso()),
      };
    }
    const cert = byId(hseCerts);
    if (cert) {
      const exp = cert.expiryDate ? asIso(String(cert.expiryDate)) : nowIso();
      return {
        id: eventId,
        employeeId,
        eventReferenceNo: `TL-${employeeId}-HSEC-${cert.id}`,
        eventCategory: 'Medical / HSE',
        eventType: 'Certification Expiry',
        eventTitle: `${String(cert.name || 'Certification')} event`,
        eventDescription: `Expiry date: ${String(cert.expiryDate || '')}`,
        eventDate: exp,
        effectiveDate: cert.expiryDate ? String(cert.expiryDate) : null,
        sourceModule: 'Medical / HSE',
        sourceRecordId: String(cert.id),
        relatedWorkflowId: null,
        relatedDocumentId: null,
        previousValue: null,
        newValue: String(cert.status || ''),
        reason: null,
        severity: String(cert.status || '') === 'Expired' ? 'high' : 'medium',
        visibility: 'HR Only',
        isSystemGenerated: true,
        approvalStatus: 'Not Applicable',
        createdBy: 'System',
        approvedBy: null,
        approvedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
    }
    return minimalEventFor(employeeId, eventId);
  }
  if (parsed.moduleKey === 'emergencycontacts') {
    const c = byId(emergency);
    if (!c) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-EC-${c.id}`,
      eventCategory: 'Emergency Contact',
      eventType: 'Emergency Contact Updated',
      eventTitle: `Emergency contact: ${String(c.fullName || '')}`,
      eventDescription: `Relationship: ${String(c.relationship || '')} • Phone: ${String(c.phoneNumber || '')}`,
      eventDate: String(c.updatedAt || nowIso()),
      effectiveDate: c.updatedAt ? String(c.updatedAt) : null,
      sourceModule: 'Emergency Contacts',
      sourceRecordId: String(c.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: c.verificationStatus ? String(c.verificationStatus) : null,
      reason: null,
      severity: String(c.verificationStatus || '') === 'Rejected' ? 'medium' : String(c.verificationStatus || '') === 'Verified' ? 'low' : 'medium',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: String(c.verificationStatus || '') === 'Verified' ? 'Approved' : String(c.verificationStatus || '') === 'Rejected' ? 'Rejected' : 'Pending',
      createdBy: c.updatedBy ? String(c.updatedBy) : 'System',
      approvedBy: c.verifiedBy ? String(c.verifiedBy) : null,
      approvedAt: c.lastVerifiedAt ? String(c.lastVerifiedAt) : null,
      createdAt: String(c.updatedAt || nowIso()),
      updatedAt: String(c.updatedAt || nowIso()),
    };
  }
  if (parsed.moduleKey === 'nextofkin') {
    const n = byId(nok);
    if (!n) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-NOK-${n.id}`,
      eventCategory: 'Next of Kin',
      eventType: 'Next of Kin Updated',
      eventTitle: `Next of kin: ${String(n.fullName || '')}`,
      eventDescription: `Relationship: ${String(n.relationship || '')} • Phone: ${String(n.primaryPhone || '')} • Primary: ${n.isPrimary ? 'Yes' : 'No'}`,
      eventDate: String(n.updatedAt || nowIso()),
      effectiveDate: n.updatedAt ? String(n.updatedAt) : null,
      sourceModule: 'Next of Kin',
      sourceRecordId: String(n.id),
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(n.verificationStatus || ''),
      reason: n.notes ? String(n.notes) : null,
      severity: String(n.verificationStatus || '') === 'Rejected' ? 'medium' : String(n.verificationStatus || '') === 'Verified' ? 'low' : 'medium',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: String(n.verificationStatus || '') === 'Verified' ? 'Approved' : String(n.verificationStatus || '') === 'Rejected' ? 'Rejected' : 'Pending',
      createdBy: n.updatedBy ? String(n.updatedBy) : 'System',
      approvedBy: n.verifiedBy ? String(n.verifiedBy) : null,
      approvedAt: n.lastVerifiedAt ? String(n.lastVerifiedAt) : null,
      createdAt: String(n.updatedAt || nowIso()),
      updatedAt: String(n.updatedAt || nowIso()),
    };
  }
  if (parsed.moduleKey === 'contracts') {
    const c = s.contracts.get(parsed.sourceId) || null;
    if (!c) return minimalEventFor(employeeId, eventId);
    const createdAt = c.createdAt ? String(c.createdAt) : nowIso();
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-CON-${parsed.sourceId}`,
      eventCategory: 'Contract',
      eventType: 'Contract Event',
      eventTitle: `Contract event: ${String(c.contractType || 'Contract')}`,
      eventDescription: `Status: ${String(c.status || c.workflowStatus || 'Draft')} • Start: ${String(c.startDate || '')} • End: ${String(c.endDate || '')}`,
      eventDate: createdAt,
      effectiveDate: c.startDate ? String(c.startDate) : null,
      sourceModule: 'Contracts',
      sourceRecordId: String(parsed.sourceId),
      relatedWorkflowId: c.id ? String(c.id) : String(parsed.sourceId),
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(c.status || c.workflowStatus || ''),
      reason: c.reason ? String(c.reason) : null,
      severity: String(c.status || '').toLowerCase().includes('expired') ? 'high' : 'low',
      visibility: 'HR Only',
      isSystemGenerated: true,
      approvalStatus: String(c.workflowStatus || '').toLowerCase().includes('approved') ? 'Approved' : String(c.workflowStatus || '').toLowerCase().includes('rejected') ? 'Rejected' : 'Pending',
      createdBy: String(c.createdBy || 'System'),
      approvedBy: c.approvedBy ? String(c.approvedBy) : null,
      approvedAt: c.approvedAt ? String(c.approvedAt) : null,
      createdAt,
      updatedAt: c.updatedAt ? String(c.updatedAt) : createdAt,
    };
  }
  if (parsed.moduleKey === 'status') {
    const row = (statusHistory as any[]).find((x) => x && String(x.id || '') === parsed.sourceId) || null;
    if (!row) return minimalEventFor(employeeId, eventId);
    const dt = row.effectiveDate || row.at || row.updatedAt || nowIso();
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-STS-${parsed.sourceId}`,
      eventCategory: 'Status Change',
      eventType: 'Status Changed',
      eventTitle: 'Employment status changed',
      eventDescription: `Previous: ${String(row.previousStatus || row.from || '—')} • New: ${String(row.newStatus || row.to || '—')}`,
      eventDate: asIso(String(dt)),
      effectiveDate: row.effectiveDate ? asIso(String(row.effectiveDate)) : asIso(String(dt)),
      sourceModule: 'Status',
      sourceRecordId: String(parsed.sourceId),
      relatedWorkflowId: row.requestId ? String(row.requestId) : null,
      relatedDocumentId: null,
      previousValue: row.previousStatus ? String(row.previousStatus) : null,
      newValue: row.newStatus ? String(row.newStatus) : null,
      reason: row.reason ? String(row.reason) : null,
      severity: String(row.newStatus || '').toLowerCase().includes('terminated') || String(row.newStatus || '').toLowerCase().includes('resigned') ? 'high' : 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: 'Approved',
      createdBy: String(row.performedBy || row.by || 'System'),
      approvedBy: row.approvedBy ? String(row.approvedBy) : null,
      approvedAt: row.approvedAt ? String(row.approvedAt) : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  if (parsed.moduleKey === 'payroll') {
    const p = rec.payrollSummary || null;
    if (!p || !p.lastPayrollProcessed) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-PAYROLL`,
      eventCategory: 'Payroll',
      eventType: 'Payslip Generated',
      eventTitle: 'Payslip generated',
      eventDescription: `Last payroll processed: ${String(p.lastPayrollProcessed)}`,
      eventDate: String(p.lastPayrollProcessed),
      effectiveDate: String(p.lastPayrollProcessed),
      sourceModule: 'Payroll',
      sourceRecordId: 'lastPayrollProcessed',
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(p.payrollStatus || ''),
      reason: null,
      severity: String(p.payrollStatus || '') === 'Pending Validation' ? 'medium' : 'low',
      visibility: 'HR Only',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: 'System',
      approvedBy: null,
      approvedAt: null,
      createdAt: String(p.lastPayrollProcessed),
      updatedAt: String(p.lastPayrollProcessed),
    };
  }
  if (parsed.moduleKey === 'performance') {
    const p = rec.performanceSummary || null;
    if (!p || !p.lastReviewAt) return minimalEventFor(employeeId, eventId);
    return {
      id: eventId,
      employeeId,
      eventReferenceNo: `TL-${employeeId}-PERF`,
      eventCategory: 'Performance',
      eventType: 'Review Completed',
      eventTitle: 'Performance review completed',
      eventDescription: `Current rating: ${String(p.currentRating || '—')}`,
      eventDate: String(p.lastReviewAt),
      effectiveDate: String(p.lastReviewAt),
      sourceModule: 'Performance',
      sourceRecordId: 'lastReviewAt',
      relatedWorkflowId: null,
      relatedDocumentId: null,
      previousValue: null,
      newValue: String(p.currentRating || ''),
      reason: null,
      severity: 'low',
      visibility: 'Employee Visible',
      isSystemGenerated: true,
      approvalStatus: 'Not Applicable',
      createdBy: 'System',
      approvedBy: null,
      approvedAt: null,
      createdAt: String(p.lastReviewAt),
      updatedAt: String(p.lastReviewAt),
    };
  }

  return minimalEventFor(employeeId, eventId);
};

export async function GET(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);

  const seg0 = action[0] || '';
  const seg1 = action[1] || '';

  if (seg0 === 'form-options') {
    const categories: EventCategory[] = [
      'Employment',
      'Job Information',
      'Department Assignment',
      'Reporting Line',
      'Contract',
      'Status Change',
      'Emergency Contact',
      'Next of Kin',
      'Documents',
      'Leave',
      'Attendance',
      'Payroll',
      'Performance',
      'Training',
      'Assets',
      'Disciplinary',
      'Medical / HSE',
      'Compliance',
      'System Access',
      'Audit',
    ];
    const severities: Severity[] = ['high', 'medium', 'low'];
    const visibilities: Visibility[] = ['HR Only', 'Manager Visible', 'Employee Visible', 'Audit Only', 'Executive Visible'];
    const approvalStatuses: ApprovalStatus[] = ['Not Applicable', 'Pending', 'Approved', 'Rejected'];
    return jsonOk({ categories, severities, visibilities, approvalStatuses });
  }

  const eventId = seg0;
  if (!eventId) return jsonErr(404, 'Not found');
  const parsed = parseEventId(eventId);
  if (!parsed) return jsonErr(404, 'Invalid eventId');
  const { employeeId } = parsed;

  const ev = findEvent(eventId);
  if (!ev) return jsonErr(404, 'Event not found');
  if (!canViewEvent(role, viewerEmployeeId, employeeId, ev)) return jsonErr(403, 'Permission denied');

  const comments = stores().comments.get(eventId) || [];
  if (!seg1) return jsonOk({ event: ev, comments: comments.slice(0, 200) });
  return jsonErr(404, 'Not found');
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const eventId = action[0] || '';
  const op = action[1] || '';
  if (!eventId || !op) return jsonErr(404, 'Not found');
  const parsed = parseEventId(eventId);
  if (!parsed) return jsonErr(404, 'Invalid eventId');
  const { employeeId } = parsed;

  const ev = findEvent(eventId);
  if (!ev) return jsonErr(404, 'Event not found');
  if (!canViewEvent(role, viewerEmployeeId, employeeId, ev)) return jsonErr(403, 'Permission denied');

  if (op === 'comment') {
    if (role === 'Executive Management') return jsonErr(403, 'Permission denied');
    const body = (await request.json().catch(() => null)) as any;
    if (!body) return jsonErr(400, 'Invalid JSON body');
    const comment = normalizeStr(body.comment, 1200);
    if (!comment) return jsonErr(400, 'Comment is required');
    const s = stores();
    const list = s.comments.get(eventId) || [];
    const row: TimelineEventComment = { id: `com-${Math.random().toString(16).slice(2)}`, eventId, at: nowIso(), by: role, comment };
    s.comments.set(eventId, [row, ...list].slice(0, 500));
    const rec = s.employees.get(employeeId);
    if (rec && Array.isArray(rec.audit)) rec.audit.unshift({ id: `aud-${Math.random().toString(16).slice(2)}`, at: nowIso(), action: 'Timeline comment added', performedBy: role, reason: eventId });
    return jsonOk(row);
  }

  return jsonErr(404, 'Not found');
}

export async function PATCH(request: Request, ctx: { params: Promise<{ action: string[] }> }) {
  const { action } = await ctx.params;
  const role = getRole(request);
  const viewerEmployeeId = getViewerEmployeeId(request);
  const eventId = action[0] || '';
  if (!eventId) return jsonErr(404, 'Not found');
  const parsed = parseEventId(eventId);
  if (!parsed) return jsonErr(404, 'Invalid eventId');
  const { employeeId } = parsed;

  const s = stores();
  const current = s.manualById.get(eventId) || null;
  if (!current) return jsonErr(400, 'System-generated events cannot be edited');
  if (!canViewEvent(role, viewerEmployeeId, employeeId, current)) return jsonErr(403, 'Permission denied');

  const canEdit = role === 'Super Admin' || role === 'HR Director' || role === 'HR Manager' || role === 'HR Officer' || role === 'Admin Officer';
  if (!canEdit) return jsonErr(403, 'Permission denied');

  const body = (await request.json().catch(() => null)) as any;
  if (!body) return jsonErr(400, 'Invalid JSON body');
  const nextTitle = normalizeStr(body.eventTitle, 220) || current.eventTitle;
  const nextDesc = normalizeStr(body.eventDescription, 2000) || current.eventDescription;
  const nextSeverity = (normalizeStr(body.severity, 20) as Severity) || current.severity;
  const nextVisibility = (normalizeStr(body.visibility, 40) as Visibility) || current.visibility;
  const nextEffective = body.effectiveDate ? normalizeStr(body.effectiveDate, 40) : '';
  const updated: TimelineEvent = {
    ...current,
    eventTitle: nextTitle,
    eventDescription: nextDesc,
    severity: nextSeverity,
    visibility: nextVisibility,
    effectiveDate: nextEffective ? (nextEffective.includes('T') ? nextEffective : `${nextEffective}T00:00:00.000Z`) : current.effectiveDate || null,
    updatedAt: nowIso(),
  };
  s.manualById.set(eventId, updated);
  const list = s.manualByEmployee.get(employeeId) || [];
  s.manualByEmployee.set(
    employeeId,
    list.map((x) => (x.id === eventId ? updated : x)).slice(0, 600)
  );
  const rec = s.employees.get(employeeId);
  if (rec && Array.isArray(rec.audit)) rec.audit.unshift({ id: `aud-${Math.random().toString(16).slice(2)}`, at: nowIso(), action: 'Manual timeline event edited', performedBy: role, reason: eventId });
  return jsonOk(updated);
}
