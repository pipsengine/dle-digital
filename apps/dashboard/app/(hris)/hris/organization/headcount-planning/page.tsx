import WorkforcePlanningClient from '../workforce-planning/WorkforcePlanningClient';

export default function HeadcountPlanningPage() {
  return (
    <WorkforcePlanningClient
      pageTitle="Headcount Planning"
      pageDescription="Plan approved headcount, staffing gaps, vacancy pressure, and coverage readiness across business units and departments."
      breadcrumbLabel="Headcount Planning"
    />
  );
}
