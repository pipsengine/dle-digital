/** Lightweight verification for leave allowance payroll inclusion logic. */
const isLeaveAllowancePaymentCode = (code) => /^LEAVEALLOW$/i.test(String(code || '').trim());
const isLeaveAllowanceLine = (line) =>
  isLeaveAllowancePaymentCode(line.code) || /\bLEAVE ALLOWANCE\b/i.test(String(line.name || ''));
const normalizePayrollMatchKey = (value) => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return '';
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';
  const permanentStaffMatch = compact.match(/^P0*(\d+)$/);
  if (permanentStaffMatch) {
    const digits = permanentStaffMatch[1].replace(/^0+/, '');
    return digits || permanentStaffMatch[1];
  }
  const numericOnly = compact.replace(/^0+/, '');
  return numericOnly || compact;
};

const events = [
  { id: 'sage-2026-06-459-LEAVEALLOW', employeeId: '0459', employeeCode: '0459', period: '2026-06', amount: 289274.95, status: 'Paid', code: 'LEAVEALLOW' },
  { id: 'sage-2026-06-460-LEAVEALLOW', employeeId: '0460', employeeCode: '0460', period: '2026-06', amount: 591127.13, status: 'Paid', code: 'LEAVEALLOW' },
];

const leaveAllowanceEventsForEmployeePeriod = (employee, period) => {
  const employeeKeys = [employee.employeeId, employee.employeeCode].map(normalizePayrollMatchKey).filter(Boolean);
  return events.filter((event) => {
    if (!/^LEAVEALLOW$/i.test(event.code) || event.amount <= 0) return false;
    if (!['Approved', 'Posted', 'Paid'].includes(event.status)) return false;
    if (event.period !== period) return false;
    const eventKeys = [event.employeeId, event.employeeCode].map(normalizePayrollMatchKey).filter(Boolean);
    return eventKeys.some((key) => employeeKeys.includes(key));
  });
};

const leavePayrollEventLines = (employee, existingLines, period) => {
  if (existingLines.some(isLeaveAllowanceLine)) return [];
  return leaveAllowanceEventsForEmployeePeriod(employee, period).map((event) => ({
    code: event.code,
    name: 'Leave Allowance',
    amount: event.amount,
  }));
};

const profileLines = [
  { code: 'SNR_BASIC', name: 'BASIC SALARY', amount: 320390 },
  { code: 'SNR_LEAVE', name: 'LEAVE', amount: 24500, runFrequency: 'leave-period' },
];

const employees = [
  { employeeId: 'P0459', employeeCode: 'P0459' },
  { employeeId: 'P0460', employeeCode: 'P0460' },
];

const results = employees.map((employee) => {
  const lines = leavePayrollEventLines(employee, profileLines, '2026-06');
  const gross = profileLines.reduce((sum, line) => sum + line.amount, 0) + lines.reduce((sum, line) => sum + line.amount, 0);
  return {
    employeeId: employee.employeeId,
    leaveLines: lines,
    grossWithLeaveAllowance: gross,
    pass: lines.length === 1 && lines[0].amount > 0,
  };
});

const guardChecks = {
  snrLeaveBlocksPayment: isLeaveAllowanceLine({ code: 'SNR_LEAVE', name: 'LEAVE' }),
  leaveAllowDetected: isLeaveAllowanceLine({ code: 'LEAVEALLOW', name: 'Leave Allowance' }),
};

console.log(JSON.stringify({ guardChecks, results }, null, 2));
const failed = results.filter((item) => !item.pass);
if (failed.length || guardChecks.snrLeaveBlocksPayment) process.exit(1);
