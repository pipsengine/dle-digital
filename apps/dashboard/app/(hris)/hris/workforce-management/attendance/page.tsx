import AttendanceActivityClient from './AttendanceActivityClient';

export default function WorkforceAttendancePage() {
  return <AttendanceActivityClient initialNow={new Date().toISOString()} />;
}
