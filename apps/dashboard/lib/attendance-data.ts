export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Remote' | 'Excused';
export type Shift = 'Day' | 'Night' | 'Rotational';
export type BiometricSource = 'Biometric Device' | 'Mobile Check-In' | 'Supervisor Override';

export type AttendanceSeedRecord = {
  employeeId: string;
  employeeName: string;
  department: string;
  businessUnit: string;
  jobTitle: string;
  location: string;
  site: string;
  shift: Shift;
  status: AttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  minutesLate: number;
  overtimeHours: number;
  biometricSource: BiometricSource;
  supervisor: string;
};

export type BaseAttendanceRecord = AttendanceSeedRecord & {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
};

const employees: readonly AttendanceSeedRecord[] = [
  { employeeId: 'DLE-EMP-00001', employeeName: 'Amina Bello', department: 'Human Capital', businessUnit: 'DLE Corporate', jobTitle: 'HR Officer', location: 'Lagos HQ', site: 'Head Office', shift: 'Day', status: 'Present', checkInTime: '08:03', checkOutTime: '17:28', minutesLate: 3, overtimeHours: 1.2, biometricSource: 'Biometric Device', supervisor: 'B. Adeyemi' },
  { employeeId: 'DLE-EMP-00002', employeeName: 'Chinedu Okafor', department: 'Project Controls', businessUnit: 'DLE Projects', jobTitle: 'Planning Engineer', location: 'Port Harcourt', site: 'Onne Yard', shift: 'Day', status: 'Late', checkInTime: '08:31', checkOutTime: '18:06', minutesLate: 31, overtimeHours: 1.8, biometricSource: 'Biometric Device', supervisor: 'M. Ibrahim' },
  { employeeId: 'DLE-EMP-00003', employeeName: 'Ngozi Eze', department: 'Finance', businessUnit: 'DLE Corporate', jobTitle: 'Finance Analyst', location: 'Lagos HQ', site: 'Head Office', shift: 'Day', status: 'Remote', checkInTime: '08:11', checkOutTime: '17:03', minutesLate: 0, overtimeHours: 0.3, biometricSource: 'Mobile Check-In', supervisor: 'B. Adeyemi' },
  { employeeId: 'DLE-EMP-00004', employeeName: 'Tunde Adebayo', department: 'Mechanical Engineering', businessUnit: 'DLE Fabrication', jobTitle: 'Mechanical Supervisor', location: 'Warri', site: 'Fabrication Yard', shift: 'Day', status: 'Present', checkInTime: '07:48', checkOutTime: '17:42', minutesLate: 0, overtimeHours: 1.5, biometricSource: 'Biometric Device', supervisor: 'K. Johnson' },
  { employeeId: 'DLE-EMP-00005', employeeName: 'Halima Sule', department: 'HSE', businessUnit: 'DLE Projects', jobTitle: 'HSE Officer', location: 'Port Harcourt', site: 'Onne Yard', shift: 'Day', status: 'Present', checkInTime: '07:55', checkOutTime: '17:10', minutesLate: 0, overtimeHours: 0.9, biometricSource: 'Biometric Device', supervisor: 'M. Ibrahim' },
  { employeeId: 'DLE-EMP-00006', employeeName: 'Emeka Nwankwo', department: 'Quality Assurance', businessUnit: 'DLE Fabrication', jobTitle: 'QA/QC Engineer', location: 'Warri', site: 'Fabrication Yard', shift: 'Day', status: 'Late', checkInTime: '08:22', checkOutTime: '17:31', minutesLate: 22, overtimeHours: 0.8, biometricSource: 'Biometric Device', supervisor: 'K. Johnson' },
  { employeeId: 'DLE-EMP-00007', employeeName: 'Mary Johnson', department: 'IT & Support', businessUnit: 'DLE Corporate', jobTitle: 'Systems Analyst', location: 'Lagos HQ', site: 'Head Office', shift: 'Day', status: 'Present', checkInTime: '08:00', checkOutTime: '17:17', minutesLate: 0, overtimeHours: 0.5, biometricSource: 'Biometric Device', supervisor: 'B. Adeyemi' },
  { employeeId: 'DLE-EMP-00008', employeeName: 'Ibrahim Mohammed', department: 'Electrical & Instrumentation', businessUnit: 'DLE Marine', jobTitle: 'E&I Technician', location: 'Bonny', site: 'Marine Base', shift: 'Rotational', status: 'Present', checkInTime: '06:57', checkOutTime: '18:24', minutesLate: 0, overtimeHours: 2.4, biometricSource: 'Biometric Device', supervisor: 'S. Danjuma' },
  { employeeId: 'DLE-EMP-00009', employeeName: 'Grace Okoro', department: 'Procurement', businessUnit: 'DLE Corporate', jobTitle: 'Procurement Officer', location: 'Lagos HQ', site: 'Head Office', shift: 'Day', status: 'On Leave', checkInTime: null, checkOutTime: null, minutesLate: 0, overtimeHours: 0, biometricSource: 'Supervisor Override', supervisor: 'B. Adeyemi' },
  { employeeId: 'DLE-EMP-00010', employeeName: 'Samuel Ade', department: 'Civil Engineering', businessUnit: 'DLE Projects', jobTitle: 'Senior Civil Engineer', location: 'Port Harcourt', site: 'Onne Yard', shift: 'Day', status: 'Absent', checkInTime: null, checkOutTime: null, minutesLate: 0, overtimeHours: 0, biometricSource: 'Supervisor Override', supervisor: 'M. Ibrahim' },
  { employeeId: 'DLE-EMP-00011', employeeName: 'Fatima Aliyu', department: 'Executive Office', businessUnit: 'DLE Corporate', jobTitle: 'Executive Assistant', location: 'Lagos HQ', site: 'Head Office', shift: 'Day', status: 'Present', checkInTime: '07:59', checkOutTime: '17:01', minutesLate: 0, overtimeHours: 0.2, biometricSource: 'Biometric Device', supervisor: 'B. Adeyemi' },
  { employeeId: 'DLE-EMP-00012', employeeName: 'David Reyes', department: 'Operations', businessUnit: 'DLE Marine', jobTitle: 'Operations Coordinator', location: 'Bonny', site: 'Marine Base', shift: 'Night', status: 'Present', checkInTime: '19:02', checkOutTime: null, minutesLate: 2, overtimeHours: 0, biometricSource: 'Biometric Device', supervisor: 'S. Danjuma' },
  { employeeId: 'DLE-EMP-00013', employeeName: 'Rita Garcia', department: 'Legal & Compliance', businessUnit: 'DLE Corporate', jobTitle: 'Compliance Analyst', location: 'Lagos HQ', site: 'Head Office', shift: 'Day', status: 'Excused', checkInTime: null, checkOutTime: null, minutesLate: 0, overtimeHours: 0, biometricSource: 'Supervisor Override', supervisor: 'B. Adeyemi' },
  { employeeId: 'DLE-EMP-00014', employeeName: 'Ade Torres', department: 'Mechanical Engineering', businessUnit: 'DLE Fabrication', jobTitle: 'Maintenance Engineer', location: 'Warri', site: 'Fabrication Yard', shift: 'Night', status: 'Present', checkInTime: '18:54', checkOutTime: null, minutesLate: 0, overtimeHours: 0, biometricSource: 'Biometric Device', supervisor: 'K. Johnson' },
  { employeeId: 'DLE-EMP-00015', employeeName: 'Zainab Okonkwo', department: 'Project Controls', businessUnit: 'DLE Projects', jobTitle: 'Cost Controller', location: 'Port Harcourt', site: 'Onne Yard', shift: 'Day', status: 'Present', checkInTime: '08:07', checkOutTime: '17:26', minutesLate: 7, overtimeHours: 1.1, biometricSource: 'Biometric Device', supervisor: 'M. Ibrahim' },
  { employeeId: 'DLE-EMP-00016', employeeName: 'Bola Ibrahim', department: 'HSE', businessUnit: 'DLE Marine', jobTitle: 'Safety Coordinator', location: 'Bonny', site: 'Marine Base', shift: 'Rotational', status: 'Late', checkInTime: '07:19', checkOutTime: '18:08', minutesLate: 19, overtimeHours: 1.4, biometricSource: 'Mobile Check-In', supervisor: 'S. Danjuma' },
  { employeeId: 'DLE-EMP-00017', employeeName: 'Chika Mendoza', department: 'Human Capital', businessUnit: 'DLE Corporate', jobTitle: 'HR Analyst', location: 'Abuja', site: 'Liaison Office', shift: 'Day', status: 'Present', checkInTime: '08:10', checkOutTime: '17:02', minutesLate: 10, overtimeHours: 0.2, biometricSource: 'Mobile Check-In', supervisor: 'L. Yusuf' },
  { employeeId: 'DLE-EMP-00018', employeeName: 'Michael Valdez', department: 'Operations', businessUnit: 'DLE Marine', jobTitle: 'Marine Logistics Lead', location: 'Bonny', site: 'Marine Base', shift: 'Night', status: 'Absent', checkInTime: null, checkOutTime: null, minutesLate: 0, overtimeHours: 0, biometricSource: 'Supervisor Override', supervisor: 'S. Danjuma' },
  { employeeId: 'DLE-EMP-00019', employeeName: 'Kehinde Uche', department: 'Electrical & Instrumentation', businessUnit: 'DLE Projects', jobTitle: 'Instrumentation Engineer', location: 'Port Harcourt', site: 'Onne Yard', shift: 'Day', status: 'Present', checkInTime: '08:01', checkOutTime: '17:36', minutesLate: 1, overtimeHours: 1.0, biometricSource: 'Biometric Device', supervisor: 'M. Ibrahim' },
  { employeeId: 'DLE-EMP-00020', employeeName: 'Juan Dela Cruz', department: 'IT & Support', businessUnit: 'DLE Corporate', jobTitle: 'Support Engineer', location: 'Abuja', site: 'Liaison Office', shift: 'Day', status: 'Remote', checkInTime: '08:05', checkOutTime: '16:58', minutesLate: 0, overtimeHours: 0.4, biometricSource: 'Mobile Check-In', supervisor: 'L. Yusuf' },
] as const;

export const getAttendanceSeedRecords = (): AttendanceSeedRecord[] => employees.map((item) => ({ ...item }));

export const buildBaseAttendanceRecords = (): BaseAttendanceRecord[] =>
  getAttendanceSeedRecords().map((employee, index) => ({
    id: `att-${index + 1}`,
    ...employee,
    scheduledStart: employee.shift === 'Night' ? '19:00' : '07:30',
    scheduledEnd: employee.shift === 'Night' ? '07:00' : '16:30',
  }));
