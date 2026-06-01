import { NextResponse } from 'next/server';
import type { StructureInsight } from '@/lib/organization-data';
import { buildBaseAttendanceRecords, type AttendanceStatus, type BaseAttendanceRecord, type Shift } from '@/lib/attendance-data';

type AttendanceRecord = BaseAttendanceRecord;

type AttendanceSegment = {
  id: string;
  label: string;
  location: string;
  site: string;
  headcount: number;
  present: number;
  late: number;
  absent: number;
  remote: number;
  onLeave: number;
  attendanceRatePct: number;
  punctualityPct: number;
  overtimeHours: number;
  shiftCoverage: Array<{ shift: Shift; planned: number; present: number }>;
  health: 'Healthy' | 'Needs Attention' | 'Critical';
  lead: string;
};

type DailyAttendancePayload = {
  generatedAt: string;
  permissions: {
    actor: string;
    role: string;
    canEdit: boolean;
    canExport: boolean;
    canViewAudit: boolean;
  };
  summary: {
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
    remote: number;
    onLeave: number;
    attendanceRatePct: number;
    punctualityPct: number;
    overtimeHours: number;
    flaggedSites: number;
  };
  filterOptions: {
    businessUnits: string[];
    locations: string[];
    sites: string[];
    shifts: Shift[];
    statuses: AttendanceStatus[];
  };
  segments: AttendanceSegment[];
  records: AttendanceRecord[];
  insights: StructureInsight[];
};

const ok = <T,>(data: T) => NextResponse.json({ status: 'success', data });

const attendanceRate = (records: AttendanceRecord[]) => {
  if (!records.length) return 0;
  const available = records.filter((item) => item.status !== 'On Leave' && item.status !== 'Excused');
  if (!available.length) return 100;
  const effectivePresent = available.filter((item) => item.status === 'Present' || item.status === 'Late' || item.status === 'Remote').length;
  return Math.round((effectivePresent / available.length) * 1000) / 10;
};

const punctualityRate = (records: AttendanceRecord[]) => {
  const checkedIn = records.filter((item) => item.status === 'Present' || item.status === 'Late');
  if (!checkedIn.length) return 100;
  const punctual = checkedIn.filter((item) => item.minutesLate <= 5).length;
  return Math.round((punctual / checkedIn.length) * 1000) / 10;
};

const buildPayload = (): DailyAttendancePayload => {
  const records: AttendanceRecord[] = buildBaseAttendanceRecords();

  const segmentMap = records.reduce<Map<string, AttendanceRecord[]>>((acc, record) => {
    const key = `${record.location}||${record.site}`;
    const current = acc.get(key) || [];
    current.push(record);
    acc.set(key, current);
    return acc;
  }, new Map());

  const segments: AttendanceSegment[] = Array.from(segmentMap.entries()).map(([key, group], index) => {
    const [location, site] = key.split('||');
    const present = group.filter((item) => item.status === 'Present').length;
    const late = group.filter((item) => item.status === 'Late').length;
    const absent = group.filter((item) => item.status === 'Absent').length;
    const remote = group.filter((item) => item.status === 'Remote').length;
    const onLeave = group.filter((item) => item.status === 'On Leave').length;
    const rate = attendanceRate(group);
    const punctuality = punctualityRate(group);
    const overtime = Math.round(group.reduce((sum, item) => sum + item.overtimeHours, 0) * 10) / 10;
    const shifts: Shift[] = ['Day', 'Night', 'Rotational'];
    const health = absent > 1 || rate < 80 ? 'Critical' : late > 1 || rate < 90 ? 'Needs Attention' : 'Healthy';

    return {
      id: `seg-${index + 1}`,
      label: `${site} Attendance`,
      location,
      site,
      headcount: group.length,
      present,
      late,
      absent,
      remote,
      onLeave,
      attendanceRatePct: rate,
      punctualityPct: punctuality,
      overtimeHours: overtime,
      shiftCoverage: shifts.map((shift) => {
        const members = group.filter((item) => item.shift === shift);
        const presentCount = members.filter((item) => item.status === 'Present' || item.status === 'Late' || item.status === 'Remote').length;
        return {
          shift,
          planned: members.length,
          present: presentCount,
        };
      }),
      health,
      lead: group[0]?.supervisor || 'Unassigned',
    };
  });

  const worstSegment = [...segments].sort((a, b) => a.attendanceRatePct - b.attendanceRatePct)[0];
  const highestAbsence = [...segments].sort((a, b) => b.absent - a.absent)[0];
  const highestLate = [...segments].sort((a, b) => b.late - a.late)[0];

  const insights: StructureInsight[] = [
    {
      id: 'att-ins-1',
      severity: worstSegment && worstSegment.attendanceRatePct < 85 ? 'high' : 'medium',
      title: `${worstSegment?.site || 'A site'} has the weakest attendance rate`,
      recommendation: 'Escalate supervisor follow-up, confirm roster adherence, and validate transport or access constraints affecting daily turn-up.',
    },
    {
      id: 'att-ins-2',
      severity: highestAbsence && highestAbsence.absent >= 2 ? 'high' : 'medium',
      title: `${highestAbsence?.site || 'A site'} is carrying the highest absence exposure`,
      recommendation: 'Review exception reasons, secure temporary cover for operational roles, and trigger attendance exception management where required.',
    },
    {
      id: 'att-ins-3',
      severity: highestLate && highestLate.late >= 2 ? 'medium' : 'low',
      title: `${highestLate?.site || 'A site'} shows the highest lateness pressure`,
      recommendation: 'Monitor gate access timing, shift handover discipline, and reporting-time compliance for the affected team.',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    permissions: {
      actor: 'Attendance Control Desk',
      role: 'HR Officer',
      canEdit: false,
      canExport: true,
      canViewAudit: false,
    },
    summary: {
      totalEmployees: records.length,
      present: records.filter((item) => item.status === 'Present').length,
      late: records.filter((item) => item.status === 'Late').length,
      absent: records.filter((item) => item.status === 'Absent').length,
      remote: records.filter((item) => item.status === 'Remote').length,
      onLeave: records.filter((item) => item.status === 'On Leave').length,
      attendanceRatePct: attendanceRate(records),
      punctualityPct: punctualityRate(records),
      overtimeHours: Math.round(records.reduce((sum, item) => sum + item.overtimeHours, 0) * 10) / 10,
      flaggedSites: segments.filter((segment) => segment.health !== 'Healthy').length,
    },
    filterOptions: {
      businessUnits: Array.from(new Set(records.map((item) => item.businessUnit))).sort((a, b) => a.localeCompare(b)),
      locations: Array.from(new Set(records.map((item) => item.location))).sort((a, b) => a.localeCompare(b)),
      sites: Array.from(new Set(records.map((item) => item.site))).sort((a, b) => a.localeCompare(b)),
      shifts: ['Day', 'Night', 'Rotational'],
      statuses: ['Present', 'Late', 'Absent', 'On Leave', 'Remote', 'Excused'],
    },
    segments: segments.sort((a, b) => a.attendanceRatePct - b.attendanceRatePct),
    records: records.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    insights,
  };
};

export async function GET() {
  return ok(buildPayload());
}
