'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { BenefitClaim, BenefitsPayload, EmployeeBenefitProfile } from '@/lib/benefits-management-types';
import { benefitSectionFromPage } from '@/lib/benefits-routes';
import { BenefitsManagementEnterpriseView } from './BenefitsManagementEnterpriseView';
import type { BenefitPageId } from './benefits-management-ui';
import type { BenefitsPageContext } from './benefits-pages';
import { BenefitsActionModal, type BenefitActionKind } from './benefits-action-modal';
type BenefitsRole =
  | 'Benefits Administrator'
  | 'HR Officer'
  | 'HR Manager'
  | 'Payroll Officer'
  | 'Finance Controller'
  | 'Super Administrator';

type ApiResponse<T> = { status: 'success' | 'error'; data?: T; error?: string };

const roles: BenefitsRole[] = [
  'Benefits Administrator',
  'HR Officer',
  'HR Manager',
  'Payroll Officer',
  'Finance Controller',
  'Super Administrator',
];

export default function BenefitsManagementClient({
  initialNow,
  initialPage = 'overview',
}: {
  initialNow: string;
  initialPage?: BenefitPageId;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [payload, setPayload] = useState<BenefitsPayload | null>(null);
  const [role, setRole] = useState<BenefitsRole>('Benefits Administrator');
  const [page, setPage] = useState<BenefitPageId>(initialPage);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<BenefitsPayload['settings'] | null>(null);
  const [actionKind, setActionKind] = useState<BenefitActionKind | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/hris/benefits-management', {
        headers: { 'x-hris-role': role },
        cache: 'no-store',
      });
      const json = (await response.json()) as ApiResponse<BenefitsPayload>;
      if (json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to load benefits data.');
      setPayload(json.data);
      setSettingsDraft(json.data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Benefits Management.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load, initialNow]);

  const selectedClaim = useMemo<BenefitClaim | null>(() => {
    if (!payload) return null;
    const id = selectedClaimId || payload.claims[0]?.id;
    return payload.claims.find((c) => c.id === id) || null;
  }, [payload, selectedClaimId]);

  const selectedProfile = useMemo<EmployeeBenefitProfile | null>(() => {
    if (!payload) return null;
    if (selectedEmployeeId) {
      return payload.employeeProfiles.find((p) => p.employeeId === selectedEmployeeId) || payload.employeeProfiles[0] || null;
    }
    return payload.employeeProfiles[0] || null;
  }, [payload, selectedEmployeeId]);

  const visibleRowIds = useMemo(() => {
    if (!payload) return [] as string[];
    if (page === 'claims' || page === 'claim-details') return payload.claims.map((c) => c.id);
    if (page === 'approvals') return payload.approvals.map((a) => a.id);
    if (page === 'enrollment') return payload.enrollments.slice(0, 50).map((e) => e.id);
    if (PLAN_PAGES.has(page)) return payload.plans.map((p) => p.id);
    return [];
  }, [payload, page]);

  const allSelected = visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedIds.has(id));

  const onToggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      return new Set(visibleRowIds);
    });
  }, [allSelected, visibleRowIds]);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  const onNavigate = useCallback((next: BenefitPageId, meta?: { claimId?: string; employeeId?: string }) => {
    setPage(next);
    setQuery('');
    setStatusFilter('All');
    setTypeFilter('All');
    setSelectedIds(new Set());
    if (meta?.claimId) setSelectedClaimId(meta.claimId);
    if (meta?.employeeId) setSelectedEmployeeId(meta.employeeId);
    const section = benefitSectionFromPage(next);
    if (section) router.push(`/hris/benefits/${section}`);
  }, [router]);

  const postAction = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    try {
      const response = await fetch('/api/hris/benefits-management', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-hris-role': role },
        body: JSON.stringify({ action, ...body }),
      });
      const json = (await response.json()) as ApiResponse<{ message: string; payload: BenefitsPayload }>;
      if (json.status !== 'success' || !json.data) throw new Error(json.error || 'Action failed.');
      setPayload(json.data.payload);
      setSettingsDraft(json.data.payload.settings);
      setToast(json.data.message);
      window.setTimeout(() => setToast(''), 3500);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      return false;
    }
  }, [role]);

  const onExport = useCallback(() => {
    window.open(`/api/hris/benefits-management?format=csv&role=${encodeURIComponent(role)}`, '_blank');
  }, [role]);

  const onSaveSettings = useCallback(() => {
    void postAction('save-settings', { settings: settingsDraft || undefined });
  }, [postAction, settingsDraft]);

  const onSyncSage = useCallback((overwrite = false) => {
    void postAction('sync-sage', { overwriteExisting: overwrite });
  }, [postAction]);

  const onApprove = useCallback((id: string) => {
    void postAction('approve', { id });
  }, [postAction]);

  const onReject = useCallback((id: string) => {
    void postAction('reject', { id });
  }, [postAction]);

  const onOpenAction = useCallback((kind: BenefitActionKind) => {
    setActionKind(kind);
  }, []);

  const onBulkApprove = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      setError('Select at least one approval request to bulk approve.');
      return;
    }
    void postAction('bulk-approve', { ids });
  }, [postAction, selectedIds]);

  const onActionSubmit = useCallback(async (kind: BenefitActionKind, data: Record<string, string>) => {
    setActionBusy(true);
    const ok = await postAction(kind, data);
    setActionBusy(false);
    if (ok) setActionKind(null);
  }, [postAction]);

  const onSettingsChange = useCallback((patch: Partial<BenefitsPayload['settings']>) => {
    setSettingsDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const pageContext = useMemo<BenefitsPageContext | null>(() => {
    if (!payload || !settingsDraft) return null;
    return {
      payload,
      page,
      query,
      onQueryChange: setQuery,
      statusFilter,
      onStatusFilterChange: setStatusFilter,
      typeFilter,
      onTypeFilterChange: setTypeFilter,
      selectedIds,
      onToggleRow,
      onToggleAll,
      allSelected,
      onNavigate,
      selectedClaim,
      selectedProfile,
      onExport,
      settingsDraft,
      onSettingsChange,
      onSaveSettings,
      onSyncSage,
      onApprove,
      onReject,
      onOpenAction,
      onBulkApprove,
      toast,
    };
  }, [
    payload,
    settingsDraft,
    page,
    query,
    statusFilter,
    typeFilter,
    selectedIds,
    onToggleRow,
    onToggleAll,
    allSelected,
    onNavigate,
    selectedClaim,
    selectedProfile,
    onExport,
    onSettingsChange,
    onSaveSettings,
    onSyncSage,
    onApprove,
    onReject,
    onOpenAction,
    onBulkApprove,
    toast,
  ]);

  return (
    <>
      <BenefitsManagementEnterpriseView
      loading={loading}
      error={error}
      toast={toast}
      payload={payload || undefined}
      role={role}
      roles={roles}
      onRoleChange={(value) => setRole(value as BenefitsRole)}
      onRefresh={() => void load()}
      page={page}
      onPageChange={(next) => onNavigate(next)}
      pageContext={
        pageContext || {
          payload: {
            generatedAt: new Date().toISOString(),
            source: 'Loading',
            role: 'Benefits Administrator',
            dataSource: { source: 'Loading', databaseAvailable: false, warning: null, employeeCount: 0 },
            summary: { totalEmployees: 0, totalPlans: 0, activeEnrollments: 0, enrolledEmployees: 0, pendingClaims: 0, totalBenefitCostYtd: 0, periodBenefitCost: 0, pendingApprovals: 0, complianceScore: 0 },
            analytics: {
              costByPlanType: [],
              enrollmentByType: [],
              costTrend: { labels: [], employerSeries: [], employeeSeries: [] },
              enrollmentTrend: { labels: [], totalSeries: [], newSeries: [] },
            },
            plans: [],
            enrollments: [],
            claims: [],
            approvals: [],
            eligibilityRules: [],
            providers: [],
            compliance: [],
            employeeProfiles: [],
            settings: { benefitYear: '2026', currency: 'NGN', autoAssign: true, selfEnrollment: false, requireApproval: true, notifyRenewals: true, contributionType: '', approvalWorkflow: '' },
          },
          page,
          query,
          onQueryChange: setQuery,
          statusFilter,
          onStatusFilterChange: setStatusFilter,
          typeFilter,
          onTypeFilterChange: setTypeFilter,
          selectedIds,
          onToggleRow,
          onToggleAll,
          allSelected,
          onNavigate,
          selectedClaim: null,
          selectedProfile: null,
          onExport,
          settingsDraft: settingsDraft || { benefitYear: '2026', currency: 'NGN', autoAssign: true, selfEnrollment: false, requireApproval: true, notifyRenewals: true, contributionType: '', approvalWorkflow: '' },
          onSettingsChange,
          onSaveSettings,
          onSyncSage,
          onApprove,
          onReject,
          onOpenAction: () => {},
          onBulkApprove: () => {},
          toast,
        }
      }
      pendingApprovals={payload?.summary.pendingApprovals || 0}
    />
      <BenefitsActionModal
        kind={actionKind}
        open={Boolean(actionKind)}
        busy={actionBusy}
        onClose={() => setActionKind(null)}
        onSubmit={onActionSubmit}
      />
    </>
  );
}

const PLAN_PAGES = new Set<BenefitPageId>(['plans', 'medical', 'insurance', 'pension', 'welfare', 'allowance']);
