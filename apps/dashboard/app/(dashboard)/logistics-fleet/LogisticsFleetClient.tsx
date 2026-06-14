'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BarChart4,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  Fuel,
  Gauge,
  MapPinned,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Search,
  ShieldCheck,
  Truck,
  UserRoundCheck,
  Wrench,
  XCircle,
} from 'lucide-react';

type Vehicle = {
  id: string;
  assetCode: string;
  plateNumber: string;
  vehicleType: string;
  makeModel: string;
  year: number;
  department: string;
  location: string;
  custodian: string;
  status: string;
  odometerKm: number;
  nextServiceKm: number;
  insuranceExpiry: string;
  roadWorthinessExpiry: string;
};
type Driver = {
  id: string;
  employeeCode: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiry: string;
  issuingAuthority: string;
  medicalCertificateStatus: string;
  defensiveDrivingCertificate: string;
  driverCategory: string;
  availabilityStatus: string;
  assignedVehicleId: string;
  status: string;
  complianceStatus: string;
  safetyScore: number;
  registeredAt: string;
  approvalStatus: string;
};
type Trip = { id: string; requestNo: string; vehicleId: string; driverId: string; requester: string; requesterDepartment?: string; requesterLocation?: string; origin: string; destination: string; purpose: string; startDate: string; endDate: string; projectCode: string; costCenter: string; status: string; approvedBy?: string };
type Maintenance = { id: string; vehicleId: string; maintenanceType: string; vendor: string; scheduledDate: string; completedDate?: string; cost: number; status: string; notes: string };
type FuelRecord = { id: string; vehicleId: string; driverId: string; date: string; litres: number; amount: number; odometerKm: number; station: string; projectCode: string };
type Compliance = { id: string; vehicleId: string; driverId?: string; documentType: string; reference: string; issueDate: string; expiryDate: string; status: string };
type FleetRequest = { id: string; requestType: string; requester: string; department: string; details: string; priority: string; status: string; createdAt: string };
type Audit = { id: string; at: string; actor: string; action: string; entity: string; details: string };
type EmployeeOption = { employeeCode: string; employeeId: string; fullName: string; jobTitle: string; department: string; location: string; phone: string; status: string };
type CurrentUser = { name: string; employeeCode: string; department: string; location: string };
type Payload = {
  generatedAt: string;
  employees: EmployeeOption[];
  employeeSource: { source: string; databaseAvailable: boolean; warning: string | null; employeeCount: number };
  vehicles: Vehicle[];
  drivers: Driver[];
  trips: Trip[];
  maintenance: Maintenance[];
  fuel: FuelRecord[];
  compliance: Compliance[];
  requests: FleetRequest[];
  auditTrail: Audit[];
  summary: { activeVehicles: number; availableVehicles: number; openTrips: number; pendingApprovals: number; expiringDocs: number; fuelSpend: number; maintenanceCost: number };
};

type Tab = 'dashboard' | 'fleet' | 'trips' | 'drivers' | 'maintenance' | 'fuel' | 'compliance' | 'requests' | 'reports';
type ApiResponse = { status: 'success' | 'error'; data?: Payload; error?: string };

const tabs: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'fleet', label: 'Fleet Register', icon: Truck },
  { id: 'trips', label: 'Trip & Dispatch', icon: Route },
  { id: 'drivers', label: 'Driver Management', icon: UserRoundCheck },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'fuel', label: 'Fuel & Mileage', icon: Fuel },
  { id: 'compliance', label: 'Compliance & Documents', icon: ShieldCheck },
  { id: 'requests', label: 'Requests & Approvals', icon: ClipboardCheck },
  { id: 'reports', label: 'Reports & Audit', icon: BarChart4 },
];

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value || 0);
const dateText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusTone = (value: string) => {
  const status = value.toLowerCase();
  if (status.includes('approved') || status.includes('available') || status.includes('valid') || status.includes('completed')) return 'bg-emerald-100 text-emerald-800';
  if (status.includes('reject') || status.includes('expired') || status.includes('ground')) return 'bg-red-100 text-red-800';
  if (status.includes('submitted') || status.includes('soon') || status.includes('maintenance') || status.includes('dispatch')) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};
const vehicleName = (payload: Payload | null, vehicleId: string) => {
  const vehicle = payload?.vehicles.find((item) => item.id === vehicleId);
  return vehicle ? `${vehicle.assetCode} · ${vehicle.plateNumber}` : 'Unassigned vehicle';
};
const employeeForDriver = (payload: Payload | null, driver: Driver | undefined) => payload?.employees.find((employee) => employee.employeeCode === driver?.employeeCode || employee.employeeId === driver?.employeeCode);
const driverName = (payload: Payload | null, driverId: string) => {
  const driver = payload?.drivers.find((item) => item.id === driverId);
  const employee = employeeForDriver(payload, driver);
  const directEmployee = payload?.employees.find((item) => item.employeeCode === driverId || item.employeeId === driverId);
  return employee ? `${employee.fullName} (${employee.employeeCode})` : directEmployee ? `${directEmployee.fullName} (${directEmployee.employeeCode})` : driver?.employeeCode || 'Unassigned driver';
};

function MetricCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: any; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{detail}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 text-blue-700 ring-1 ring-slate-200"><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', options }: { label: string; value: string; onChange: (value: string) => void; type?: string; options?: Array<[string, string]> }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-500">{label}</span>
      {options ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
          <option value="">Select</option>
          {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} type={type} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
      )}
    </label>
  );
}

function ReadOnlyField({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="block">
      <span className="text-[11px] font-black uppercase text-slate-500">{label}</span>
      <div className="mt-1 min-h-10 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-black text-slate-800">{value || 'Resolved from login session'}</div>
      {detail ? <p className="mt-1 text-[11px] font-semibold text-slate-500">{detail}</p> : null}
    </div>
  );
}

function EmployeePicker({ label, value, onChange, employees, hint }: { label: string; value: string; onChange: (value: string) => void; employees: EmployeeOption[]; hint?: string }) {
  const listId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-employees`;
  const selected = employees.find((employee) => employee.employeeCode === value || employee.employeeId === value);
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-slate-500">{label}</span>
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by employee name or code"
        className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
      <datalist id={listId}>
        {employees.map((employee) => (
          <option key={employee.employeeCode || employee.employeeId} value={employee.employeeCode || employee.employeeId}>
            {employee.fullName} · {employee.jobTitle || 'No title'} · {employee.department || 'No department'}
          </option>
        ))}
      </datalist>
      <p className="mt-1 min-h-4 text-[11px] font-semibold text-slate-500">
        {selected ? `${selected.fullName} · ${selected.department || 'No department'} · ${selected.location || 'No location'}` : hint || 'Select from the employee directory.'}
      </p>
    </label>
  );
}

export default function LogisticsFleetClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [complianceFilter, setComplianceFilter] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const vehicleOptions = useMemo(() => (payload?.vehicles || []).map((vehicle) => [vehicle.id, `${vehicle.assetCode} · ${vehicle.plateNumber}`] as [string, string]), [payload]);
  const employeeOptions = payload?.employees || [];
  const departments = Array.from(new Set(employeeOptions.map((item) => item.department).filter(Boolean))).sort();
  const locations = Array.from(new Set(employeeOptions.map((item) => item.location).filter(Boolean))).sort();
  const requesterDefaults = (user = currentUser, employees = employeeOptions) => {
    const employee = employees.find((item) => item.employeeCode === user?.employeeCode || item.employeeId === user?.employeeCode);
    return {
      requesterEmployeeCode: employee?.employeeCode || user?.employeeCode || '',
      requesterDepartment: employee?.department || user?.department || '',
      requesterLocation: employee?.location || user?.location || '',
    };
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, userRes] = await Promise.all([
        fetch('/api/logistics-fleet', { cache: 'no-store' }),
        fetch('/api/current-user?context=enterprise', { cache: 'no-store' }),
      ]);
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to load logistics fleet data');
      setPayload(json.data);
      const userJson = userRes.ok ? await userRes.json() : null;
      const user = userJson?.data ? {
        name: String(userJson.data.name || ''),
        employeeCode: String(userJson.data.employeeCode || ''),
        department: String(userJson.data.department || ''),
        location: String(userJson.data.location || ''),
      } : null;
      setCurrentUser(user);
      const defaults = requesterDefaults(user, json.data.employees);
      setForm((current) => ({ ...current, ...defaults }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load logistics fleet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (entity: string) => {
    setSaving(true);
    setToast('');
    setError('');
    try {
      const res = await fetch('/api/logistics-fleet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity, record: form }) });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to save record');
      setPayload(json.data);
      setForm(requesterDefaults());
      setToast('Record saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save record');
    } finally {
      setSaving(false);
    }
  };

  const workflow = async (entity: string, id: string, action: string) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/logistics-fleet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity, id, action }) });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to update workflow');
      setPayload(json.data);
      setToast('Workflow updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update workflow');
    } finally {
      setSaving(false);
    }
  };

  const action = async (body: Record<string, string>) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/logistics-fleet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || json.status !== 'success' || !json.data) throw new Error(json.error || 'Unable to complete action');
      setPayload(json.data);
      setToast('Action completed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete action');
    } finally {
      setSaving(false);
    }
  };

  const q = query.toLowerCase();
  const matchesFilters = (driver?: Driver) => {
    if (!driver) return true;
    const employee = employeeForDriver(payload, driver);
    if (statusFilter && driver.status !== statusFilter) return false;
    if (departmentFilter && employee?.department !== departmentFilter) return false;
    if (locationFilter && employee?.location !== locationFilter) return false;
    if (complianceFilter && driver.complianceStatus !== complianceFilter) return false;
    return true;
  };
  const vehicles = (payload?.vehicles || []).filter((item) => `${item.assetCode} ${item.plateNumber} ${item.vehicleType} ${item.location} ${item.status}`.toLowerCase().includes(q));
  const trips = (payload?.trips || []).filter((item) => `${item.requestNo} ${item.origin} ${item.destination} ${item.projectCode} ${item.status}`.toLowerCase().includes(q));
  const drivers = (payload?.drivers || []).filter((item) => {
    const employee = employeeForDriver(payload, item);
    return matchesFilters(item) && `${item.employeeCode} ${employee?.fullName || ''} ${employee?.department || ''} ${employee?.location || ''} ${item.status} ${item.complianceStatus} ${item.licenseNumber}`.toLowerCase().includes(q);
  });
  const maintenance = (payload?.maintenance || []).filter((item) => `${item.maintenanceType} ${item.vendor} ${item.status}`.toLowerCase().includes(q));
  const fuel = (payload?.fuel || []).filter((item) => `${item.station} ${item.projectCode}`.toLowerCase().includes(q));
  const compliance = (payload?.compliance || []).filter((item) => `${item.documentType} ${item.reference} ${item.status}`.toLowerCase().includes(q));
  const requests = (payload?.requests || []).filter((item) => `${item.requestType} ${item.requester} ${item.department} ${item.priority} ${item.status}`.toLowerCase().includes(q));

  return (
    <div className="space-y-5 py-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">
              <Truck className="h-4 w-4" />
              Logistics & Fleet Management
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Logistics & Fleet</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Enterprise fleet register, vehicle requests, trip dispatch, driver assignment, fuel, maintenance, compliance, workflow approvals, cost tracking, audit trails, and operational reporting.
            </p>
            {payload?.employeeSource.warning ? <p className="mt-2 text-xs font-bold text-amber-700">{payload.employeeSource.warning}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setTab('drivers')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white">
              <UserRoundCheck className="h-4 w-4" />Register Employee as Driver
            </button>
            <button onClick={() => setTab('compliance')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              <FileText className="h-4 w-4" />Import Driver Compliance Records
            </button>
            <button onClick={() => setTab('drivers')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              <Truck className="h-4 w-4" />View Driver Assignments
            </button>
            <button onClick={() => setTab('compliance')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              <ShieldCheck className="h-4 w-4" />View Compliance Exceptions
            </button>
            <button onClick={() => setTab('reports')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              <BarChart4 className="h-4 w-4" />Generate Driver Report
            </button>
            <button onClick={() => setTab('reports')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
              <ClipboardList className="h-4 w-4" />View Audit Trail
            </button>
            <button onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-60">
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
            <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-black text-white">
              <Download className="h-4 w-4" />Export
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}
      {toast ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{toast}</div> : null}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active Vehicles" value={String(payload?.summary.activeVehicles || 0)} detail={`${payload?.summary.availableVehicles || 0} available for dispatch`} icon={Car} tone="border-blue-200 bg-blue-50" />
        <MetricCard label="Open Trips" value={String(payload?.summary.openTrips || 0)} detail="Submitted, approved, or dispatched" icon={MapPinned} tone="border-emerald-200 bg-emerald-50" />
        <MetricCard label="Pending Approvals" value={String(payload?.summary.pendingApprovals || 0)} detail="Trips, maintenance, and requests" icon={ClipboardCheck} tone="border-amber-200 bg-amber-50" />
        <MetricCard label="Compliance Exceptions" value={String(payload?.summary.expiringDocs || 0)} detail="Expired or expiring documents" icon={AlertTriangle} tone="border-red-200 bg-red-50" />
        <MetricCard label="Employee Directory" value={String(payload?.employeeSource.employeeCount || 0)} detail={`Source: ${payload?.employeeSource.source || 'Loading'}`} icon={UserRoundCheck} tone="border-cyan-200 bg-cyan-50" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-black ${tab === item.id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <item.icon className="h-4 w-4" />{item.label}
              </button>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 xl:w-[720px] xl:grid-cols-5">
            <div className="relative min-w-0 md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logistics records..." className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">All statuses</option>{['Draft', 'Available', 'Assigned', 'On Trip', 'Off Duty', 'On Leave', 'Suspended', 'License Expired', 'Compliance Blocked', 'Inactive'].map((item) => <option key={item}>{item}</option>)}</select>
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={complianceFilter} onChange={(event) => setComplianceFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">All compliance</option>{['Compliant', 'Expiring Soon', 'Expired', 'Missing Documents', 'Blocked'].map((item) => <option key={item}>{item}</option>)}</select>
          </div>
        </div>

        <div className="p-4">
          {tab === 'dashboard' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-base font-black text-slate-950">Operational Control Summary</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    ['Fuel Spend', money(payload?.summary.fuelSpend || 0), 'Fuel cards and station receipts'],
                    ['Maintenance Cost', money(payload?.summary.maintenanceCost || 0), 'Scheduled and submitted work orders'],
                    ['Drivers', String(payload?.drivers.length || 0), 'Assigned, available, and safety-scored'],
                    ['Last Loaded', payload ? new Date(payload.generatedAt).toLocaleString('en-GB') : '-', 'Database-backed module state'],
                  ].map(([label, value, detail]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    ['Register Employee as Driver', 'drivers', UserRoundCheck],
                    ['Create Trip Request', 'trips', Route],
                    ['Assign Vehicle', 'drivers', Truck],
                    ['Submit Fuel Request', 'fuel', Fuel],
                    ['Report Maintenance Issue', 'maintenance', Wrench],
                    ['Generate Fleet Report', 'reports', BarChart4],
                  ].map(([label, target, Icon]) => (
                    <button key={String(label)} onClick={() => setTab(target as Tab)} className="flex min-h-14 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-black text-slate-800 hover:bg-slate-50">
                      <Icon className="h-4 w-4 text-blue-600" />{String(label)}
                    </button>
                  ))}
                </div>
              </div>
              <WorkflowList payload={payload} workflow={workflow} saving={saving} setTab={setTab} />
            </div>
          ) : null}

          {tab === 'fleet' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Add Vehicle" onSave={() => void save('vehicle')} saving={saving}>
                <Field label="Asset Code" value={form.assetCode || ''} onChange={(v) => set('assetCode', v)} />
                <Field label="Plate Number" value={form.plateNumber || ''} onChange={(v) => set('plateNumber', v)} />
                <Field label="Vehicle Type" value={form.vehicleType || ''} onChange={(v) => set('vehicleType', v)} />
                <Field label="Make / Model" value={form.makeModel || ''} onChange={(v) => set('makeModel', v)} />
                <Field label="Department" value={form.department || ''} onChange={(v) => set('department', v)} />
                <Field label="Location" value={form.location || ''} onChange={(v) => set('location', v)} />
                <EmployeePicker label="Vehicle Custodian" value={form.custodianEmployeeCode || ''} onChange={(v) => set('custodianEmployeeCode', v)} employees={employeeOptions} />
                <Field label="Insurance Expiry" type="date" value={form.insuranceExpiry || ''} onChange={(v) => set('insuranceExpiry', v)} />
                <Field label="Road Worthiness Expiry" type="date" value={form.roadWorthinessExpiry || ''} onChange={(v) => set('roadWorthinessExpiry', v)} />
              </FormPanel>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{vehicles.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}</div>
            </div>
          ) : null}

          {tab === 'trips' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Create Trip Request" onSave={() => void save('trip')} saving={saving}>
                <ReadOnlyField label="Requester" value={currentUser?.name || form.requesterEmployeeCode || ''} detail="Resolved from the login session; logistics/fleet assigns vehicle and driver during approval." />
                <Field label="Requester Department" value={form.requesterDepartment || ''} onChange={(v) => set('requesterDepartment', v)} options={departments.map((item) => [item, item])} />
                <Field label="Requester Location" value={form.requesterLocation || ''} onChange={(v) => set('requesterLocation', v)} options={locations.map((item) => [item, item])} />
                <Field label="Origin" value={form.origin || ''} onChange={(v) => set('origin', v)} />
                <Field label="Destination" value={form.destination || ''} onChange={(v) => set('destination', v)} />
                <Field label="Purpose" value={form.purpose || ''} onChange={(v) => set('purpose', v)} />
                <Field label="Start Date" type="date" value={form.startDate || ''} onChange={(v) => set('startDate', v)} />
                <Field label="End Date" type="date" value={form.endDate || ''} onChange={(v) => set('endDate', v)} />
                <Field label="Project Code" value={form.projectCode || ''} onChange={(v) => set('projectCode', v)} />
                <Field label="Cost Center" value={form.costCenter || ''} onChange={(v) => set('costCenter', v)} />
              </FormPanel>
              <TripTable trips={trips} payload={payload} workflow={workflow} action={action} employees={employeeOptions} vehicles={vehicleOptions} saving={saving} />
            </div>
          ) : null}

          {tab === 'drivers' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Register Employee as Driver" onSave={() => void save('driver')} saving={saving}>
                <EmployeePicker label="Driver Employee" value={form.employeeCode || ''} onChange={(v) => set('employeeCode', v)} employees={employeeOptions} />
                <Field label="License Number" value={form.licenseNumber || ''} onChange={(v) => set('licenseNumber', v)} />
                <Field label="License Class" value={form.licenseClass || ''} onChange={(v) => set('licenseClass', v)} />
                <Field label="License Expiry" type="date" value={form.licenseExpiry || ''} onChange={(v) => set('licenseExpiry', v)} />
                <Field label="Issuing Authority" value={form.issuingAuthority || ''} onChange={(v) => set('issuingAuthority', v)} />
                <Field label="Medical Certificate" value={form.medicalCertificateStatus || ''} onChange={(v) => set('medicalCertificateStatus', v)} options={[['Missing', 'Missing'], ['Valid', 'Valid'], ['Expired', 'Expired'], ['Rejected', 'Rejected']]} />
                <Field label="Defensive Driving Certificate" value={form.defensiveDrivingCertificate || ''} onChange={(v) => set('defensiveDrivingCertificate', v)} options={[['Missing', 'Missing'], ['Valid', 'Valid'], ['Expired', 'Expired'], ['Rejected', 'Rejected']]} />
                <Field label="Driver Category" value={form.driverCategory || ''} onChange={(v) => set('driverCategory', v)} options={[['Company Driver', 'Company Driver'], ['Pool Driver', 'Pool Driver'], ['Executive Driver', 'Executive Driver'], ['Project Driver', 'Project Driver'], ['Relief Driver', 'Relief Driver']]} />
              </FormPanel>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{drivers.map((driver) => <DriverCard key={driver.id} driver={driver} payload={payload} vehicles={vehicleOptions} saving={saving} action={action} workflow={workflow} />)}</div>
            </div>
          ) : null}

          {tab === 'maintenance' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Create Maintenance Request" onSave={() => void save('maintenance')} saving={saving}>
                <Field label="Vehicle" value={form.vehicleId || ''} onChange={(v) => set('vehicleId', v)} options={vehicleOptions} />
                <Field label="Maintenance Type" value={form.maintenanceType || ''} onChange={(v) => set('maintenanceType', v)} />
                <Field label="Vendor" value={form.vendor || ''} onChange={(v) => set('vendor', v)} />
                <Field label="Scheduled Date" type="date" value={form.scheduledDate || ''} onChange={(v) => set('scheduledDate', v)} />
                <Field label="Cost" type="number" value={form.cost || ''} onChange={(v) => set('cost', v)} />
                <Field label="Notes" value={form.notes || ''} onChange={(v) => set('notes', v)} />
              </FormPanel>
              <RecordList rows={maintenance.map((item) => ({ id: item.id, title: `${item.maintenanceType} · ${vehicleName(payload, item.vehicleId)}`, detail: `${item.vendor} · ${dateText(item.scheduledDate)} · ${money(item.cost)}`, status: item.status, entity: 'maintenance' }))} workflow={workflow} saving={saving} />
            </div>
          ) : null}

          {tab === 'fuel' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Record Fuel / Mileage" onSave={() => void save('fuel')} saving={saving}>
                <Field label="Vehicle" value={form.vehicleId || ''} onChange={(v) => set('vehicleId', v)} options={vehicleOptions} />
                <EmployeePicker label="Driver" value={form.driverEmployeeCode || ''} onChange={(v) => set('driverEmployeeCode', v)} employees={employeeOptions} />
                <Field label="Date" type="date" value={form.date || ''} onChange={(v) => set('date', v)} />
                <Field label="Litres" type="number" value={form.litres || ''} onChange={(v) => set('litres', v)} />
                <Field label="Amount" type="number" value={form.amount || ''} onChange={(v) => set('amount', v)} />
                <Field label="Odometer KM" type="number" value={form.odometerKm || ''} onChange={(v) => set('odometerKm', v)} />
                <Field label="Station" value={form.station || ''} onChange={(v) => set('station', v)} />
                <Field label="Project Code" value={form.projectCode || ''} onChange={(v) => set('projectCode', v)} />
              </FormPanel>
              <RecordList rows={fuel.map((item) => ({ id: item.id, title: `${vehicleName(payload, item.vehicleId)} · ${item.litres} litres`, detail: `${driverName(payload, item.driverId)} · ${item.station} · ${money(item.amount)} · ${item.projectCode}`, status: 'Posted' }))} />
            </div>
          ) : null}

          {tab === 'compliance' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Add Compliance Document" onSave={() => void save('compliance')} saving={saving}>
                <Field label="Vehicle" value={form.vehicleId || ''} onChange={(v) => set('vehicleId', v)} options={vehicleOptions} />
                <EmployeePicker label="Driver" value={form.driverEmployeeCode || ''} onChange={(v) => set('driverEmployeeCode', v)} employees={employeeOptions} hint="Select a driver employee when this is a driver document." />
                <Field label="Document Type" value={form.documentType || ''} onChange={(v) => set('documentType', v)} options={[['Driver License', 'Driver License'], ['Medical Fitness Certificate', 'Medical Fitness Certificate'], ['Defensive Driving Certificate', 'Defensive Driving Certificate'], ['Road Safety Permit', 'Road Safety Permit'], ['Internal Driver Authorization', 'Internal Driver Authorization'], ['HSE Training Certificate', 'HSE Training Certificate'], ['Vehicle Insurance', 'Vehicle Insurance'], ['Road Worthiness', 'Road Worthiness']]} />
                <Field label="Reference" value={form.reference || ''} onChange={(v) => set('reference', v)} />
                <Field label="Issue Date" type="date" value={form.issueDate || ''} onChange={(v) => set('issueDate', v)} />
                <Field label="Expiry Date" type="date" value={form.expiryDate || ''} onChange={(v) => set('expiryDate', v)} />
              </FormPanel>
              <div className="space-y-3">
                {compliance.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{item.documentType}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{item.driverId ? driverName(payload, item.driverId) : vehicleName(payload, item.vehicleId)} · {item.reference} · Expires {dateText(item.expiryDate)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(item.status)}`}>{item.status}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={saving} onClick={() => void action({ action: 'verify-document', documentId: item.id })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Verify Document</button>
                      <button disabled={saving} onClick={() => void action({ action: 'reject-document', documentId: item.id, reason: 'Rejected from compliance review' })} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Reject Document</button>
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Set Expiry Reminder</button>
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">View Compliance Timeline</button>
                    </div>
                  </div>
                ))}
                {!compliance.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No compliance documents found.</div> : null}
              </div>
            </div>
          ) : null}

          {tab === 'requests' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
              <FormPanel title="Create Fleet Request" onSave={() => void save('request')} saving={saving}>
                <Field label="Request Type" value={form.requestType || ''} onChange={(v) => set('requestType', v)} />
                <EmployeePicker label="Requester" value={form.requesterEmployeeCode || ''} onChange={(v) => set('requesterEmployeeCode', v)} employees={employeeOptions} />
                <Field label="Department" value={form.department || ''} onChange={(v) => set('department', v)} />
                <Field label="Priority" value={form.priority || ''} onChange={(v) => set('priority', v)} options={[['Low', 'Low'], ['Normal', 'Normal'], ['High', 'High'], ['Critical', 'Critical']]} />
                <Field label="Details" value={form.details || ''} onChange={(v) => set('details', v)} />
              </FormPanel>
              <RecordList rows={requests.map((item) => ({ id: item.id, title: `${item.requestType} · ${item.requester}`, detail: `${item.department} · ${item.priority} · ${dateText(item.createdAt)}`, status: item.status, entity: 'request' }))} workflow={workflow} saving={saving} />
            </div>
          ) : null}

          {tab === 'reports' ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-base font-black text-slate-950">Reports</h2>
                <div className="mt-4 grid gap-2">
                  {['Fleet utilization report', 'Vehicle movement report', 'Fuel consumption report', 'Maintenance cost report', 'Compliance expiry report', 'Driver performance report', 'Trip approval report', 'Audit trail report'].map((item) => (
                    <button key={item} className="flex h-11 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-black text-slate-800 hover:bg-slate-50">
                      {item}<FileText className="h-4 w-4 text-blue-600" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {(payload?.auditTrail || []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-950">{item.action}</p>
                      <span className="text-xs font-bold text-slate-500">{new Date(item.at).toLocaleString('en-GB')}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{item.entity} · {item.actor} · {item.details}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FormPanel({ title, children, onSave, saving }: { title: string; children: React.ReactNode; onSave: () => void; saving: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-950">{title}</h2>
        <Plus className="h-5 w-5 text-blue-600" />
      </div>
      <div className="mt-4 grid gap-3">{children}</div>
      <button onClick={onSave} disabled={saving} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60">
        <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Record'}
      </button>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{vehicle.assetCode}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{vehicle.plateNumber} · {vehicle.vehicleType}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(vehicle.status)}`}>{vehicle.status}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
        <span className="rounded-lg bg-slate-50 p-2">Model: {vehicle.makeModel}</span>
        <span className="rounded-lg bg-slate-50 p-2">Year: {vehicle.year}</span>
        <span className="rounded-lg bg-slate-50 p-2">Location: {vehicle.location}</span>
        <span className="rounded-lg bg-slate-50 p-2">Odometer: {vehicle.odometerKm.toLocaleString()} km</span>
      </div>
    </article>
  );
}

function DriverCard({
  driver,
  payload,
  vehicles,
  saving,
  action,
  workflow,
}: {
  driver: Driver;
  payload: Payload | null;
  vehicles: Array<[string, string]>;
  saving: boolean;
  action: (body: Record<string, string>) => Promise<void>;
  workflow: (entity: string, id: string, action: string) => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState(driver.assignedVehicleId || '');
  const employee = employeeForDriver(payload, driver);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{employee?.fullName || driver.employeeCode}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{driver.employeeCode} · {employee?.jobTitle || 'Employee Directory'} · {employee?.department || 'No department'}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(driver.status)}`}>{driver.status}</span>
      </div>
      <div className="mt-4 grid gap-2 text-xs font-bold text-slate-600 md:grid-cols-2">
        <span className="rounded-lg bg-slate-50 p-2">Assigned vehicle: {vehicleName(payload, driver.assignedVehicleId)}</span>
        <span className="rounded-lg bg-slate-50 p-2">License expiry: {dateText(driver.licenseExpiry)}</span>
        <span className="rounded-lg bg-slate-50 p-2">License class: {driver.licenseClass || '-'}</span>
        <span className="rounded-lg bg-slate-50 p-2">Compliance: {driver.complianceStatus}</span>
        <span className="rounded-lg bg-slate-50 p-2">Location: {employee?.location || '-'}</span>
        <span className="rounded-lg bg-slate-50 p-2">Phone: {employee?.phone || '-'}</span>
        <span className="rounded-lg bg-slate-50 p-2">Safety score: {driver.safetyScore}/100</span>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
            <option value="">Select vehicle</option>
            {vehicles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <button disabled={saving || !vehicleId} onClick={() => void action({ action: driver.assignedVehicleId ? 'reassign-vehicle' : 'assign-vehicle', driverId: driver.id, vehicleId, reason: 'Fleet assignment from driver profile' })} className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:opacity-50">
            {driver.assignedVehicleId ? 'Reassign Vehicle' : 'Assign Vehicle'}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {driver.approvalStatus === 'Submitted' ? <button disabled={saving} onClick={() => void workflow('driver', driver.id, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Approve Registration</button> : null}
        {driver.approvalStatus === 'Submitted' ? <button disabled={saving} onClick={() => void workflow('driver', driver.id, 'reject')} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white">Reject</button> : null}
        {driver.assignedVehicleId ? <button disabled={saving} onClick={() => void action({ action: 'unassign-vehicle', driverId: driver.id, reason: 'Unassigned from driver profile' })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Unassign Vehicle</button> : null}
        {driver.status === 'Suspended' ? (
          <button disabled={saving} onClick={() => void action({ action: 'reactivate-driver', driverId: driver.id, reason: 'Driver reactivated by fleet user' })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Reactivate Driver</button>
        ) : (
          <button disabled={saving} onClick={() => void action({ action: 'suspend-driver', driverId: driver.id, reason: 'Driver suspended by fleet user' })} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white">Suspend Driver</button>
        )}
        {['View Driver Profile', 'Edit Driver Profile', 'View Trip History', 'View Compliance History', 'Upload License Document', 'Renew License', 'View Audit Trail'].map((label) => (
          <button key={label} type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">{label}</button>
        ))}
      </div>
    </article>
  );
}

function TripTable({
  trips,
  payload,
  workflow,
  action,
  employees,
  vehicles,
  saving,
}: {
  trips: Trip[];
  payload: Payload | null;
  workflow: (entity: string, id: string, action: string) => Promise<void>;
  action: (body: Record<string, string>) => Promise<void>;
  employees: EmployeeOption[];
  vehicles: Array<[string, string]>;
  saving: boolean;
}) {
  const [driverSelections, setDriverSelections] = useState<Record<string, string>>({});
  const [vehicleSelections, setVehicleSelections] = useState<Record<string, string>>({});
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
            <tr><th className="px-3 py-3">Request</th><th className="px-3 py-3">Vehicle</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3">Route</th><th className="px-3 py-3">Project</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trips.map((trip) => (
              <tr key={trip.id} className="align-top">
                <td className="px-3 py-3 font-black text-slate-950">{trip.requestNo}<p className="mt-1 text-xs font-semibold text-slate-500">{trip.requester}</p></td>
                <td className="px-3 py-3 text-xs font-bold text-slate-700">{trip.vehicleId ? vehicleName(payload, trip.vehicleId) : <span className="text-amber-700">Pending fleet assignment</span>}</td>
                <td className="px-3 py-3 text-xs font-bold text-slate-700">{trip.driverId ? driverName(payload, trip.driverId) : <span className="text-amber-700">Pending fleet assignment</span>}</td>
                <td className="px-3 py-3 text-xs font-bold text-slate-700">{trip.origin} to {trip.destination}<p className="mt-1 text-slate-500">{dateText(trip.startDate)} - {dateText(trip.endDate)}</p><p className="mt-1 text-slate-500">{trip.requesterDepartment || '-'} · {trip.requesterLocation || '-'}</p></td>
                <td className="px-3 py-3 text-xs font-bold text-slate-700">{trip.projectCode}<p className="mt-1 text-slate-500">{trip.costCenter}</p></td>
                <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(trip.status)}`}>{trip.status}</span></td>
                <td className="px-3 py-3">
                  {trip.status === 'Submitted' ? (
                    <div className="min-w-56 space-y-2">
                      <select value={vehicleSelections[trip.id] || ''} onChange={(event) => setVehicleSelections((current) => ({ ...current, [trip.id]: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700">
                        <option value="">Select vehicle for approval</option>
                        {vehicles.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                      </select>
                      <EmployeePicker label="Assign Driver on Approval" value={driverSelections[trip.id] || ''} onChange={(value) => setDriverSelections((current) => ({ ...current, [trip.id]: value }))} employees={employees} />
                      <button disabled={saving || !driverSelections[trip.id] || !vehicleSelections[trip.id]} onClick={() => void action({ action: 'assign-trip-driver', tripId: trip.id, vehicleId: vehicleSelections[trip.id], driverEmployeeCode: driverSelections[trip.id], approve: 'true' })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-black text-white disabled:opacity-50">
                        <CheckCircle2 className="h-3.5 w-3.5" />Assign Driver & Approve
                      </button>
                    </div>
                  ) : (
                    <WorkflowActions id={trip.id} entity="trip" status={trip.status} workflow={workflow} saving={saving} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordList({ rows, workflow, saving, onTripApproval }: { rows: Array<{ id: string; title: string; detail: string; status: string; entity?: string }>; workflow?: (entity: string, id: string, action: string) => Promise<void>; saving?: boolean; onTripApproval?: () => void }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-950">{row.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{row.detail}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusTone(row.status)}`}>{row.status}</span>
          </div>
          {row.entity === 'trip' && onTripApproval ? (
            <div className="mt-3"><button onClick={onTripApproval} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white">Assign Driver for Approval</button></div>
          ) : row.entity && workflow ? (
            <div className="mt-3"><WorkflowActions id={row.id} entity={row.entity} status={row.status} workflow={workflow} saving={Boolean(saving)} /></div>
          ) : null}
        </div>
      ))}
      {!rows.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No records found.</div> : null}
    </div>
  );
}

function WorkflowActions({ id, entity, status, workflow, saving }: { id: string; entity: string; status: string; workflow: (entity: string, id: string, action: string) => Promise<void>; saving: boolean }) {
  const canApprove = status === 'Submitted';
  const canDispatch = entity === 'trip' && status === 'Approved';
  const canComplete = entity === 'trip' && status === 'Dispatched';
  const canClose = ['Approved', 'Completed'].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {canApprove ? <button disabled={saving} onClick={() => void workflow(entity, id, 'approve')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-black text-white"><CheckCircle2 className="h-3.5 w-3.5" />Approve</button> : null}
      {canApprove ? <button disabled={saving} onClick={() => void workflow(entity, id, 'reject')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-black text-white"><XCircle className="h-3.5 w-3.5" />Reject</button> : null}
      {canApprove ? <button disabled={saving} onClick={() => void workflow(entity, id, 'request-correction')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-black text-amber-800">Request Correction</button> : null}
      {canApprove ? <button disabled={saving} onClick={() => void workflow(entity, id, 'escalate')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-slate-700">Escalate</button> : null}
      {canDispatch ? <button disabled={saving} onClick={() => void workflow(entity, id, 'dispatch')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-black text-white"><Route className="h-3.5 w-3.5" />Dispatch</button> : null}
      {canComplete ? <button disabled={saving} onClick={() => void workflow(entity, id, 'complete')} className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-950 px-2.5 text-xs font-black text-white"><BadgeCheck className="h-3.5 w-3.5" />Complete</button> : null}
      {canClose ? <button disabled={saving} onClick={() => void workflow(entity, id, 'close')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-black text-slate-700"><ClipboardList className="h-3.5 w-3.5" />Close</button> : null}
    </div>
  );
}

function WorkflowList({ payload, workflow, saving, setTab }: { payload: Payload | null; workflow: (entity: string, id: string, action: string) => Promise<void>; saving: boolean; setTab: (tab: Tab) => void }) {
  const rows = [
    ...(payload?.drivers || []).filter((item) => item.approvalStatus === 'Submitted').map((item) => ({ id: item.id, title: `Driver registration ${driverName(payload, item.id)}`, detail: `${item.licenseNumber} · ${item.driverCategory}`, status: item.approvalStatus, entity: 'driver' })),
    ...(payload?.trips || []).filter((item) => item.status === 'Submitted').map((item) => ({ id: item.id, title: `Trip ${item.requestNo}`, detail: `${item.origin} to ${item.destination} · driver assigned during fleet approval`, status: item.status, entity: 'trip' })),
    ...(payload?.maintenance || []).filter((item) => item.status === 'Submitted').map((item) => ({ id: item.id, title: item.maintenanceType, detail: `${vehicleName(payload, item.vehicleId)} · ${money(item.cost)}`, status: item.status, entity: 'maintenance' })),
    ...(payload?.requests || []).filter((item) => item.status === 'Submitted').map((item) => ({ id: item.id, title: item.requestType, detail: `${item.requester} · ${item.priority}`, status: item.status, entity: 'request' })),
  ];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-950">Approval Queue</h2>
        <CalendarClock className="h-5 w-5 text-amber-600" />
      </div>
      <div className="mt-4">
        <RecordList rows={rows} workflow={workflow} saving={saving} onTripApproval={() => setTab('trips')} />
      </div>
    </div>
  );
}
