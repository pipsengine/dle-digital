import { promises as fs } from 'fs';
import path from 'path';
import type { DleEmployeeDirectoryRow } from '@/lib/dle-enterprise-db';
import { payrollDataSourceInfo, readPayrollEmployees } from '@/lib/payroll-employee-source';

export type VehicleStatus = 'Available' | 'Assigned' | 'In Maintenance' | 'Grounded' | 'Retired';
export type WorkflowStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Closed';

export type FleetVehicle = {
  id: string;
  assetCode: string;
  plateNumber: string;
  vehicleType: string;
  makeModel: string;
  year: number;
  department: string;
  location: string;
  custodian: string;
  status: VehicleStatus;
  odometerKm: number;
  nextServiceKm: number;
  insuranceExpiry: string;
  roadWorthinessExpiry: string;
};

export type FleetDriver = {
  id: string;
  employeeCode: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  issuingAuthority: string;
  medicalCertificateStatus: 'Missing' | 'Valid' | 'Expired' | 'Rejected';
  defensiveDrivingCertificate: 'Missing' | 'Valid' | 'Expired' | 'Rejected';
  driverCategory: 'Company Driver' | 'Pool Driver' | 'Executive Driver' | 'Project Driver' | 'Relief Driver';
  availabilityStatus: 'Available' | 'Assigned' | 'On Trip' | 'Off Duty' | 'On Leave' | 'Suspended' | 'Inactive';
  assignedVehicleId: string;
  status: 'Draft' | 'Active' | 'Available' | 'Assigned' | 'On Trip' | 'Off Duty' | 'On Leave' | 'Suspended' | 'License Expired' | 'Compliance Blocked' | 'Inactive';
  complianceStatus: 'Compliant' | 'Expiring Soon' | 'Expired' | 'Missing Documents' | 'Blocked';
  safetyScore: number;
  registeredAt: string;
  approvalStatus: WorkflowStatus;
};

export type FleetTrip = {
  id: string;
  requestNo: string;
  vehicleId: string;
  driverId: string;
  requester: string;
  requesterDepartment: string;
  requesterLocation: string;
  origin: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  projectCode: string;
  costCenter: string;
  status: WorkflowStatus | 'Dispatched' | 'Completed';
  approvedBy?: string;
};

export type MaintenanceRecord = {
  id: string;
  vehicleId: string;
  maintenanceType: string;
  vendor: string;
  scheduledDate: string;
  completedDate?: string;
  cost: number;
  status: WorkflowStatus | 'Scheduled' | 'Completed';
  notes: string;
};

export type FuelRecord = {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  litres: number;
  amount: number;
  odometerKm: number;
  station: string;
  projectCode: string;
};

export type ComplianceRecord = {
  id: string;
  vehicleId: string;
  driverId?: string;
  documentType: string;
  reference: string;
  issueDate: string;
  expiryDate: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
};

export type VehicleAssignmentRecord = {
  id: string;
  driverId: string;
  vehicleId: string;
  action: 'Assigned' | 'Reassigned' | 'Unassigned' | 'Ended';
  effectiveDate: string;
  endedAt?: string;
  reason: string;
  performedBy: string;
};

export type FleetRequest = {
  id: string;
  requestType: string;
  requester: string;
  department: string;
  details: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical';
  status: WorkflowStatus;
  createdAt: string;
};

export type FleetAudit = {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  details: string;
};

export type LogisticsFleetData = {
  generatedAt: string;
  vehicles: FleetVehicle[];
  drivers: FleetDriver[];
  trips: FleetTrip[];
  maintenance: MaintenanceRecord[];
  fuel: FuelRecord[];
  compliance: ComplianceRecord[];
  assignmentHistory: VehicleAssignmentRecord[];
  requests: FleetRequest[];
  auditTrail: FleetAudit[];
};

export type LogisticsEntity = 'vehicle' | 'driver' | 'trip' | 'maintenance' | 'fuel' | 'compliance' | 'request';

export type LogisticsEmployeeOption = {
  employeeCode: string;
  employeeId: string;
  fullName: string;
  jobTitle: string;
  department: string;
  location: string;
  phone: string;
  status: string;
};

const dataDir = path.join(process.cwd(), 'data', 'enterprise');
const dataFile = path.join(dataDir, 'logistics-fleet.json');

const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyData = (): LogisticsFleetData => ({
  generatedAt: new Date().toISOString(),
  vehicles: [],
  drivers: [],
  trips: [],
  maintenance: [],
  fuel: [],
  compliance: [],
  assignmentHistory: [],
  requests: [],
  auditTrail: [],
});

const readRaw = async () => {
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8')) as LogisticsFleetData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const initial = emptyData();
    await writeLogisticsFleetData(initial);
    return initial;
  }
};

export const writeLogisticsFleetData = async (data: LogisticsFleetData) => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify({ ...data, generatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
};

export const readLogisticsFleetData = async () => {
  const [data, employeeSource] = await Promise.all([readRaw(), readPayrollEmployees()]);
  const hydratedData = hydrateDriverLifecycle(normalizeData(data), employeeSource.employees);
  return {
    ...hydratedData,
    generatedAt: new Date().toISOString(),
    employees: employeeSource.employees.map(toEmployeeOption),
    employeeSource: payrollDataSourceInfo(employeeSource),
    summary: buildSummary(hydratedData),
  };
};

const toEmployeeOption = (employee: DleEmployeeDirectoryRow): LogisticsEmployeeOption => ({
  employeeCode: employee.employeeCode || employee.employeeId,
  employeeId: employee.employeeId,
  fullName: employee.fullName,
  jobTitle: employee.jobTitle || employee.designation || '',
  department: employee.department || employee.businessUnit || '',
  location: employee.workLocation || employee.location || employee.officeLocation || '',
  phone: employee.primaryPhone || employee.phone || employee.alternatePhone || '',
  status: employee.status || '',
});

const activeEmployee = (employee: DleEmployeeDirectoryRow) => !String(employee.status || '').toLowerCase().match(/terminated|resigned|retired|inactive|deceased|suspended/);
const assignableEmployee = (employee: DleEmployeeDirectoryRow) => !String(employee.status || '').toLowerCase().match(/inactive|suspended|terminated|resigned|exited|retired|long-term leave|long term leave/);

const findEmployee = (employees: DleEmployeeDirectoryRow[], code: string) => {
  const target = String(code || '').trim().toLowerCase();
  if (!target) return null;
  return employees.find((employee) => [employee.employeeCode, employee.employeeId, employee.sourceEmployeeId, employee.officialEmail, employee.email].some((value) => String(value || '').trim().toLowerCase() === target)) || null;
};

const employeeDisplay = (employee: DleEmployeeDirectoryRow) => `${employee.fullName} (${employee.employeeCode || employee.employeeId})`;

const normalizeData = (data: LogisticsFleetData): LogisticsFleetData => ({
  ...emptyData(),
  ...data,
  vehicles: Array.isArray(data.vehicles) ? data.vehicles : [],
  drivers: Array.isArray(data.drivers) ? data.drivers : [],
  trips: Array.isArray(data.trips) ? data.trips : [],
  maintenance: Array.isArray(data.maintenance) ? data.maintenance : [],
  fuel: Array.isArray(data.fuel) ? data.fuel : [],
  compliance: Array.isArray(data.compliance) ? data.compliance : [],
  assignmentHistory: Array.isArray(data.assignmentHistory) ? data.assignmentHistory : [],
  requests: Array.isArray(data.requests) ? data.requests : [],
  auditTrail: Array.isArray(data.auditTrail) ? data.auditTrail : [],
});

const expiryState = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { expired: false, expiringSoon: false };
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return { expired: days < 0, expiringSoon: days >= 0 && days <= 30 };
};

const driverComplianceStatus = (driver: FleetDriver): FleetDriver['complianceStatus'] => {
  const license = expiryState(driver.licenseExpiry);
  if (license.expired) return 'Expired';
  if (driver.medicalCertificateStatus !== 'Valid' || driver.defensiveDrivingCertificate !== 'Valid') return 'Missing Documents';
  if (license.expiringSoon) return 'Expiring Soon';
  return 'Compliant';
};

const deriveDriverStatus = (driver: FleetDriver, employee: DleEmployeeDirectoryRow | null, trips: FleetTrip[]): FleetDriver['status'] => {
  if (!employee || !assignableEmployee(employee)) return 'Inactive';
  if (driver.status === 'Suspended' || driver.availabilityStatus === 'Suspended') return 'Suspended';
  if (expiryState(driver.licenseExpiry).expired) return 'License Expired';
  const compliance = driverComplianceStatus(driver);
  if (compliance === 'Expired' || compliance === 'Missing Documents' || compliance === 'Blocked') return 'Compliance Blocked';
  if (trips.some((trip) => [driver.id, driver.employeeCode].includes(trip.driverId) && ['Approved', 'Dispatched'].includes(trip.status))) return 'On Trip';
  if (driver.assignedVehicleId) return 'Assigned';
  if (driver.approvalStatus !== 'Approved') return 'Draft';
  return driver.availabilityStatus === 'Off Duty' || driver.availabilityStatus === 'On Leave' ? driver.availabilityStatus : 'Available';
};

const hydrateDriverLifecycle = (data: LogisticsFleetData, employees: DleEmployeeDirectoryRow[]): LogisticsFleetData => ({
  ...data,
  drivers: data.drivers.map((driver) => {
    const normalized: FleetDriver = {
      ...driver,
      licenseClass: driver.licenseClass || '',
      issuingAuthority: driver.issuingAuthority || '',
      medicalCertificateStatus: driver.medicalCertificateStatus || 'Missing',
      defensiveDrivingCertificate: driver.defensiveDrivingCertificate || 'Missing',
      driverCategory: driver.driverCategory || 'Company Driver',
      availabilityStatus: driver.availabilityStatus || 'Available',
      complianceStatus: driver.complianceStatus || 'Missing Documents',
      registeredAt: driver.registeredAt || new Date().toISOString(),
      approvalStatus: driver.approvalStatus || 'Submitted',
    };
    const employee = findEmployee(employees, normalized.employeeCode);
    const compliance = driverComplianceStatus(normalized);
    return { ...normalized, complianceStatus: compliance, status: deriveDriverStatus({ ...normalized, complianceStatus: compliance }, employee, data.trips) };
  }),
});

const ensureNoActiveDriver = (data: LogisticsFleetData, employeeCode: string) => {
  const existing = data.drivers.find((driver) => driver.employeeCode.toLowerCase() === employeeCode.toLowerCase() && !['Inactive', 'Suspended'].includes(driver.status));
  if (existing) throw new Error('Employee is already assigned as an active driver');
};

const assertDriverCanOperate = (driver: FleetDriver) => {
  if (['Inactive', 'Suspended', 'License Expired', 'Compliance Blocked'].includes(driver.status)) throw new Error(`Driver cannot be assigned while status is ${driver.status}`);
  if (expiryState(driver.licenseExpiry).expired) throw new Error('Driver license is expired');
};

const assertVehicleAvailable = (data: LogisticsFleetData, vehicleId: string, currentDriverId?: string) => {
  const vehicle = data.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) throw new Error('Vehicle not found');
  if (!['Available', 'Assigned'].includes(vehicle.status)) throw new Error(`Vehicle is unavailable while status is ${vehicle.status}`);
  const assigned = data.drivers.find((driver) => driver.assignedVehicleId === vehicleId && driver.id !== currentDriverId && !['Inactive', 'Suspended'].includes(driver.status));
  if (assigned) throw new Error('Vehicle already has an active driver assignment');
  return vehicle;
};

const buildSummary = (data: LogisticsFleetData) => {
  const activeVehicles = data.vehicles.filter((vehicle) => !['Retired', 'Grounded'].includes(vehicle.status)).length;
  const availableVehicles = data.vehicles.filter((vehicle) => vehicle.status === 'Available').length;
  const openTrips = data.trips.filter((trip) => !['Completed', 'Closed', 'Rejected'].includes(trip.status)).length;
  const pendingApprovals = [...data.trips, ...data.maintenance, ...data.requests].filter((item) => item.status === 'Submitted').length + data.drivers.filter((driver) => driver.approvalStatus === 'Submitted').length;
  const expiringDocs = data.compliance.filter((item) => item.status !== 'Valid').length + data.drivers.filter((driver) => ['Expired', 'Missing Documents', 'Blocked'].includes(driver.complianceStatus)).length;
  const fuelSpend = data.fuel.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const maintenanceCost = data.maintenance.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  return { activeVehicles, availableVehicles, openTrips, pendingApprovals, expiringDocs, fuelSpend, maintenanceCost };
};

const audit = (data: LogisticsFleetData, actor: string, action: string, entity: string, details: string) => {
  data.auditTrail.unshift({ id: id('aud'), at: new Date().toISOString(), actor, action, entity, details });
};

const value = (record: Record<string, unknown>, key: string) => String(record[key] || '').trim();
const requireFields = (entity: LogisticsEntity, record: Record<string, unknown>, fields: string[]) => {
  const missing = fields.filter((field) => !value(record, field));
  if (missing.length) throw new Error(`${entity} requires ${missing.join(', ')}`);
};

const complianceStatus = (expiryDate: string): ComplianceRecord['status'] => {
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return 'Valid';
  const days = Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Valid';
};

export const createLogisticsFleetRecord = async (entity: LogisticsEntity, record: Record<string, unknown>, actor = 'System') => {
  const [rawData, employeeSource] = await Promise.all([readRaw(), readPayrollEmployees()]);
  const data = hydrateDriverLifecycle(normalizeData(rawData), employeeSource.employees);
  const employees = employeeSource.employees.filter(assignableEmployee);
  if (entity === 'vehicle') {
    requireFields(entity, record, ['assetCode', 'plateNumber', 'vehicleType', 'makeModel', 'location', 'custodianEmployeeCode', 'insuranceExpiry']);
    const custodian = findEmployee(employees, value(record, 'custodianEmployeeCode'));
    if (!custodian) throw new Error('vehicle requires a valid custodian from the employee directory');
    const vehicle: FleetVehicle = {
      id: id('veh'),
      assetCode: value(record, 'assetCode'),
      plateNumber: value(record, 'plateNumber'),
      vehicleType: value(record, 'vehicleType'),
      makeModel: value(record, 'makeModel'),
      year: Number(record.year || new Date().getFullYear()),
      department: value(record, 'department') || custodian.department || custodian.businessUnit || 'Operations',
      location: value(record, 'location'),
      custodian: employeeDisplay(custodian),
      status: (record.status as VehicleStatus) || 'Available',
      odometerKm: Number(record.odometerKm || 0),
      nextServiceKm: Number(record.nextServiceKm || 5000),
      insuranceExpiry: value(record, 'insuranceExpiry'),
      roadWorthinessExpiry: value(record, 'roadWorthinessExpiry') || value(record, 'insuranceExpiry'),
    };
    data.vehicles.unshift(vehicle);
    audit(data, actor, 'Created vehicle', 'Fleet Register', `${vehicle.assetCode} ${vehicle.plateNumber}`);
  }
  if (entity === 'driver') {
    requireFields(entity, record, ['employeeCode', 'licenseNumber', 'licenseClass', 'licenseExpiry', 'issuingAuthority', 'driverCategory']);
    const employee = findEmployee(employees, value(record, 'employeeCode'));
    if (!employee) throw new Error('driver requires a valid employee from the employee directory');
    const employeeCode = employee.employeeCode || employee.employeeId;
    ensureNoActiveDriver(data, employeeCode);
    const driver: FleetDriver = {
      id: id('drv'),
      employeeCode,
      licenseNumber: value(record, 'licenseNumber'),
      licenseClass: value(record, 'licenseClass'),
      licenseExpiry: value(record, 'licenseExpiry'),
      issuingAuthority: value(record, 'issuingAuthority'),
      medicalCertificateStatus: (value(record, 'medicalCertificateStatus') as FleetDriver['medicalCertificateStatus']) || 'Missing',
      defensiveDrivingCertificate: (value(record, 'defensiveDrivingCertificate') as FleetDriver['defensiveDrivingCertificate']) || 'Missing',
      driverCategory: (value(record, 'driverCategory') as FleetDriver['driverCategory']) || 'Company Driver',
      availabilityStatus: 'Available',
      assignedVehicleId: '',
      status: 'Draft',
      complianceStatus: 'Missing Documents',
      safetyScore: Number(record.safetyScore || 90),
      registeredAt: new Date().toISOString(),
      approvalStatus: 'Submitted',
    };
    driver.complianceStatus = driverComplianceStatus(driver);
    data.drivers.unshift(driver);
    audit(data, actor, 'Submitted driver registration', 'Driver Management', employeeDisplay(employee));
  }
  if (entity === 'trip') {
    requireFields(entity, record, ['requesterEmployeeCode', 'requesterDepartment', 'requesterLocation', 'origin', 'destination', 'purpose', 'startDate', 'endDate', 'projectCode', 'costCenter']);
    const requester = findEmployee(employees, value(record, 'requesterEmployeeCode'));
    if (!requester) throw new Error('trip requires a valid requester from the employee directory');
    const trip: FleetTrip = {
      id: id('trp'),
      requestNo: `TRP-${new Date().getFullYear()}-${String(data.trips.length + 1).padStart(4, '0')}`,
      vehicleId: '',
      driverId: '',
      requester: employeeDisplay(requester),
      requesterDepartment: value(record, 'requesterDepartment'),
      requesterLocation: value(record, 'requesterLocation'),
      origin: value(record, 'origin'),
      destination: value(record, 'destination'),
      purpose: value(record, 'purpose'),
      startDate: value(record, 'startDate'),
      endDate: value(record, 'endDate'),
      projectCode: value(record, 'projectCode'),
      costCenter: value(record, 'costCenter'),
      status: 'Submitted',
    };
    data.trips.unshift(trip);
    audit(data, actor, 'Submitted trip request', 'Trip & Dispatch', `${trip.requestNo}: ${trip.origin} to ${trip.destination}`);
  }
  if (entity === 'maintenance') {
    requireFields(entity, record, ['vehicleId', 'maintenanceType', 'vendor', 'scheduledDate', 'cost']);
    const maintenance: MaintenanceRecord = {
      id: id('mnt'),
      vehicleId: value(record, 'vehicleId'),
      maintenanceType: value(record, 'maintenanceType'),
      vendor: value(record, 'vendor'),
      scheduledDate: value(record, 'scheduledDate'),
      completedDate: '',
      cost: Number(record.cost || 0),
      status: 'Submitted',
      notes: value(record, 'notes'),
    };
    data.maintenance.unshift(maintenance);
    audit(data, actor, 'Created maintenance request', 'Maintenance', maintenance.maintenanceType);
  }
  if (entity === 'fuel') {
    requireFields(entity, record, ['vehicleId', 'driverEmployeeCode', 'date', 'litres', 'amount', 'odometerKm', 'station', 'projectCode']);
    const driverEmployee = findEmployee(employees, value(record, 'driverEmployeeCode'));
    if (!driverEmployee) throw new Error('fuel record requires a valid driver from the employee directory');
    const driverCode = driverEmployee.employeeCode || driverEmployee.employeeId;
    const driverProfile = data.drivers.find((item) => item.employeeCode.toLowerCase() === driverCode.toLowerCase());
    if (driverProfile) assertDriverCanOperate(driverProfile);
    const fuel: FuelRecord = {
      id: id('ful'),
      vehicleId: value(record, 'vehicleId'),
      driverId: driverCode,
      date: value(record, 'date'),
      litres: Number(record.litres || 0),
      amount: Number(record.amount || 0),
      odometerKm: Number(record.odometerKm || 0),
      station: value(record, 'station'),
      projectCode: value(record, 'projectCode'),
    };
    data.fuel.unshift(fuel);
    audit(data, actor, 'Recorded fuel transaction', 'Fuel & Mileage', `${fuel.litres} litres, NGN ${fuel.amount}`);
  }
  if (entity === 'compliance') {
    requireFields(entity, record, ['documentType', 'reference', 'issueDate', 'expiryDate']);
    if (!value(record, 'vehicleId') && !value(record, 'driverEmployeeCode')) throw new Error('compliance requires a vehicle or driver reference');
    const driverEmployee = value(record, 'driverEmployeeCode') ? findEmployee(employees, value(record, 'driverEmployeeCode')) : null;
    if (value(record, 'driverEmployeeCode') && !driverEmployee) throw new Error('compliance requires a valid driver from the employee directory');
    const compliance: ComplianceRecord = {
      id: id('cmp'),
      vehicleId: value(record, 'vehicleId'),
      driverId: driverEmployee ? driverEmployee.employeeCode || driverEmployee.employeeId : undefined,
      documentType: value(record, 'documentType'),
      reference: value(record, 'reference'),
      issueDate: value(record, 'issueDate'),
      expiryDate: value(record, 'expiryDate'),
      status: complianceStatus(value(record, 'expiryDate')),
    };
    data.compliance.unshift(compliance);
    audit(data, actor, 'Added compliance document', 'Compliance & Documents', `${compliance.documentType} ${compliance.reference}`);
  }
  if (entity === 'request') {
    requireFields(entity, record, ['requestType', 'requesterEmployeeCode', 'details', 'priority']);
    const requester = findEmployee(employees, value(record, 'requesterEmployeeCode'));
    if (!requester) throw new Error('request requires a valid requester from the employee directory');
    const request: FleetRequest = {
      id: id('req'),
      requestType: value(record, 'requestType'),
      requester: employeeDisplay(requester),
      department: value(record, 'department') || requester.department || requester.businessUnit || '',
      details: value(record, 'details'),
      priority: (record.priority as FleetRequest['priority']) || 'Normal',
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    data.requests.unshift(request);
    audit(data, actor, 'Submitted fleet request', 'Requests & Approvals', request.requestType);
  }
  await writeLogisticsFleetData(data);
  return readLogisticsFleetData();
};

export const updateFleetWorkflow = async (entity: 'driver' | 'trip' | 'maintenance' | 'request', recordId: string, action: 'approve' | 'reject' | 'close' | 'dispatch' | 'complete' | 'request-correction' | 'escalate', actor = 'System') => {
  const rawData = await readRaw();
  const employeeSource = await readPayrollEmployees();
  const data = hydrateDriverLifecycle(normalizeData(rawData), employeeSource.employees);
  if (entity === 'driver') {
    const driver = data.drivers.find((item) => item.id === recordId);
    if (!driver) throw new Error('Record not found');
    if (action === 'approve') {
      assertDriverCanOperate(driver);
      driver.approvalStatus = 'Approved';
      driver.status = driver.assignedVehicleId ? 'Assigned' : 'Available';
    } else if (action === 'reject') {
      driver.approvalStatus = 'Rejected';
      driver.status = 'Inactive';
    } else if (action === 'request-correction') {
      driver.approvalStatus = 'Draft';
    } else if (action === 'escalate') {
      audit(data, actor, 'Escalated driver registration', 'Driver Management', recordId);
      await writeLogisticsFleetData(data);
      return readLogisticsFleetData();
    } else {
      throw new Error('Unsupported driver workflow action');
    }
    audit(data, actor, `${action} driver registration`, 'Driver Management', recordId);
    await writeLogisticsFleetData(data);
    return readLogisticsFleetData();
  }
  const collection = entity === 'trip' ? data.trips : entity === 'maintenance' ? data.maintenance : data.requests;
  const record = collection.find((item) => item.id === recordId);
  if (!record) throw new Error('Record not found');
  if (action === 'request-correction' || action === 'escalate') {
    audit(data, actor, `${action} workflow`, entity, recordId);
    await writeLogisticsFleetData(data);
    return readLogisticsFleetData();
  }
  const statusMap: Record<'approve' | 'reject' | 'close' | 'dispatch' | 'complete', string> = { approve: 'Approved', reject: 'Rejected', close: 'Closed', dispatch: 'Dispatched', complete: 'Completed' };
  record.status = statusMap[action] as never;
  if (entity === 'trip' && action === 'approve') {
    const trip = record as FleetTrip;
    if (!trip.driverId) throw new Error('Assign a driver before approving this trip request');
    trip.approvedBy = actor;
  }
  audit(data, actor, `${action} workflow`, entity, recordId);
  await writeLogisticsFleetData(data);
  return readLogisticsFleetData();
};

export const performFleetAction = async (
  action: 'assign-vehicle' | 'reassign-vehicle' | 'unassign-vehicle' | 'suspend-driver' | 'reactivate-driver' | 'verify-document' | 'reject-document' | 'assign-trip-driver',
  payload: Record<string, unknown>,
  actor = 'System'
) => {
  const rawData = await readRaw();
  const employeeSource = await readPayrollEmployees();
  const data = hydrateDriverLifecycle(normalizeData(rawData), employeeSource.employees);
  if (action === 'assign-vehicle' || action === 'reassign-vehicle') {
    const driver = data.drivers.find((item) => item.id === value(payload, 'driverId'));
    if (!driver) throw new Error('Driver not found');
    assertDriverCanOperate(driver);
    const vehicle = assertVehicleAvailable(data, value(payload, 'vehicleId'), driver.id);
    const previousVehicleId = driver.assignedVehicleId;
    driver.assignedVehicleId = vehicle.id;
    driver.availabilityStatus = 'Assigned';
    driver.status = 'Assigned';
    vehicle.status = 'Assigned';
    if (previousVehicleId && previousVehicleId !== vehicle.id) {
      const oldVehicle = data.vehicles.find((item) => item.id === previousVehicleId);
      if (oldVehicle && !data.drivers.some((item) => item.id !== driver.id && item.assignedVehicleId === oldVehicle.id)) oldVehicle.status = 'Available';
    }
    data.assignmentHistory.unshift({
      id: id('asg'),
      driverId: driver.id,
      vehicleId: vehicle.id,
      action: previousVehicleId ? 'Reassigned' : 'Assigned',
      effectiveDate: new Date().toISOString(),
      reason: value(payload, 'reason') || 'Operational assignment',
      performedBy: actor,
    });
    audit(data, actor, previousVehicleId ? 'Reassigned vehicle' : 'Assigned vehicle', 'Vehicle Assignment', `${driver.employeeCode} -> ${vehicle.assetCode}`);
  }
  if (action === 'assign-trip-driver') {
    const trip = data.trips.find((item) => item.id === value(payload, 'tripId'));
    if (!trip) throw new Error('Trip request not found');
    const vehicle = data.vehicles.find((item) => item.id === value(payload, 'vehicleId'));
    if (!vehicle) throw new Error('Select a vehicle before approving this trip request');
    const driverEmployee = findEmployee(employeeSource.employees.filter(assignableEmployee), value(payload, 'driverEmployeeCode'));
    if (!driverEmployee) throw new Error('Select a valid active employee as driver');
    const driverCode = driverEmployee.employeeCode || driverEmployee.employeeId;
    const driverProfile = data.drivers.find((item) => item.employeeCode.toLowerCase() === driverCode.toLowerCase());
    if (driverProfile) assertDriverCanOperate(driverProfile);
    if (data.trips.some((item) => item.id !== trip.id && [driverCode, driverProfile?.id].filter(Boolean).includes(item.driverId) && ['Approved', 'Dispatched'].includes(item.status))) throw new Error('Driver already has an active trip');
    assertVehicleAvailable(data, vehicle.id, driverProfile?.id || driverCode);
    trip.vehicleId = vehicle.id;
    trip.driverId = driverCode;
    if (value(payload, 'approve') === 'true') {
      trip.status = 'Approved';
      trip.approvedBy = actor;
    }
    audit(data, actor, value(payload, 'approve') === 'true' ? 'Assigned driver and approved trip' : 'Assigned driver to trip', 'Trip & Dispatch', `${trip.requestNo}: ${employeeDisplay(driverEmployee)}`);
  }
  if (action === 'unassign-vehicle') {
    const driver = data.drivers.find((item) => item.id === value(payload, 'driverId'));
    if (!driver) throw new Error('Driver not found');
    const previousVehicleId = driver.assignedVehicleId;
    if (!previousVehicleId) throw new Error('Driver has no active vehicle assignment');
    driver.assignedVehicleId = '';
    driver.availabilityStatus = 'Available';
    driver.status = driver.approvalStatus === 'Approved' ? 'Available' : 'Draft';
    const vehicle = data.vehicles.find((item) => item.id === previousVehicleId);
    if (vehicle && !data.drivers.some((item) => item.assignedVehicleId === vehicle.id)) vehicle.status = 'Available';
    data.assignmentHistory.unshift({ id: id('asg'), driverId: driver.id, vehicleId: previousVehicleId, action: 'Unassigned', effectiveDate: new Date().toISOString(), endedAt: new Date().toISOString(), reason: value(payload, 'reason') || 'Assignment ended', performedBy: actor });
    audit(data, actor, 'Unassigned vehicle', 'Vehicle Assignment', driver.employeeCode);
  }
  if (action === 'suspend-driver' || action === 'reactivate-driver') {
    const driver = data.drivers.find((item) => item.id === value(payload, 'driverId'));
    if (!driver) throw new Error('Driver not found');
    if (action === 'suspend-driver') {
      driver.status = 'Suspended';
      driver.availabilityStatus = 'Suspended';
    } else {
      driver.availabilityStatus = driver.assignedVehicleId ? 'Assigned' : 'Available';
      driver.status = driver.assignedVehicleId ? 'Assigned' : 'Available';
    }
    audit(data, actor, action === 'suspend-driver' ? 'Suspended driver' : 'Reactivated driver', 'Driver Management', `${driver.employeeCode}: ${value(payload, 'reason')}`);
  }
  if (action === 'verify-document' || action === 'reject-document') {
    const document = data.compliance.find((item) => item.id === value(payload, 'documentId'));
    if (!document) throw new Error('Compliance document not found');
    if (action === 'verify-document') {
      document.verifiedBy = actor;
      document.verifiedAt = new Date().toISOString();
      document.status = complianceStatus(document.expiryDate);
    } else {
      document.rejectionReason = value(payload, 'reason') || 'Rejected during compliance review';
      document.status = 'Expired';
    }
    audit(data, actor, action === 'verify-document' ? 'Verified compliance document' : 'Rejected compliance document', 'Compliance & Documents', document.reference);
  }
  await writeLogisticsFleetData(data);
  return readLogisticsFleetData();
};
