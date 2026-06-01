import type { PositionRecord } from '@/lib/organization-data';
import type { VacancyApprovalStatus, VacancyRequisitionStatus } from '@/lib/vacancy-management-store';

export const derivePositionStatusFromVacancy = ({
  requisitionStatus,
  approvalStatus,
}: {
  requisitionStatus: VacancyRequisitionStatus;
  approvalStatus: VacancyApprovalStatus;
}): PositionRecord['positionStatus'] => {
  if (requisitionStatus === 'Cancelled' || requisitionStatus === 'On Hold') return 'Frozen';
  if (approvalStatus !== 'Approved') return 'Under Review';
  return 'Vacant';
};

export const syncPositionWithVacancy = ({
  position,
  requisitionStatus,
  approvalStatus,
}: {
  position: PositionRecord;
  requisitionStatus: VacancyRequisitionStatus;
  approvalStatus: VacancyApprovalStatus;
}): PositionRecord => {
  if (position.positionStatus === 'Filled') return position;

  const nextStatus = derivePositionStatusFromVacancy({ requisitionStatus, approvalStatus });
  return {
    ...position,
    positionStatus: nextStatus,
    openDays: nextStatus === 'Frozen' ? position.openDays : Math.max(position.openDays, 0),
  };
};
