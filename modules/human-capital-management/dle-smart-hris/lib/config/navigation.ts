import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Clock,
  CalendarOff,
  Banknote,
  Gift,
  Target,
  GraduationCap,
  UserPlus,
  UserCheck,
  LogOut,
  Files,
  BarChart4,
  Megaphone,
  UserCog,
  ShieldCheck,
  Settings2,
  FileKey,
  Webhook,
  Bot,
  Scale,
  HelpCircle,
  FileSignature
} from 'lucide-react';

export interface SubMenu {
  title: string;
  slug: string;
  route: string;
  permissionKey: string;
}

export interface NavItem {
  id: string;
  label: string;
  slug: string;
  icon: any; // using any for Lucide icon component type simplicity
  group: 'main' | 'administration' | 'support';
  route?: string;
  subItems?: SubMenu[];
  permissionKey: string;
  badgeCount?: number;
}

export const navigationConfig: NavItem[] = [
  // MAIN MODULES
  {
    id: 'dashboard',
    label: 'Dashboard',
    slug: 'dashboard',
    icon: LayoutDashboard,
    group: 'main',
    permissionKey: 'view_dashboard',
    subItems: [
      { title: 'Executive HR Dashboard', slug: 'executive-hr-dashboard', route: '/dashboard/executive-hr-dashboard', permissionKey: 'view_exec_dashboard' },
      { title: 'HR Operations Dashboard', slug: 'hr-operations-dashboard', route: '/dashboard/hr-operations-dashboard', permissionKey: 'view_ops_dashboard' },
      { title: 'Employee Workforce Summary', slug: 'employee-workforce-summary', route: '/dashboard/employee-workforce-summary', permissionKey: 'view_dashboard' },
      { title: 'Pending Approvals', slug: 'pending-approvals', route: '/dashboard/pending-approvals', permissionKey: 'view_dashboard' },
    ]
  },
  {
    id: 'employees',
    label: 'Employees',
    slug: 'employees',
    icon: Users,
    group: 'main',
    permissionKey: 'view_employees',
    subItems: [
      { title: 'Employee Directory', slug: 'employee-directory', route: '/employees/employee-directory', permissionKey: 'view_employees' },
      { title: 'Add New Employee', slug: 'add-new-employee', route: '/employees/add-new-employee', permissionKey: 'create_employee' },
      { title: 'Employee Timeline', slug: 'employee-timeline', route: '/employees/employee-timeline', permissionKey: 'view_employees' },
    ]
  },
  {
    id: 'organization',
    label: 'Organization',
    slug: 'organization',
    icon: Building2,
    group: 'main',
    permissionKey: 'view_organization',
    subItems: [
      { title: 'Company Structure', slug: 'company-structure', route: '/organization/company-structure', permissionKey: 'view_organization' },
      { title: 'Departments', slug: 'departments', route: '/organization/departments', permissionKey: 'view_organization' },
      { title: 'Organogram', slug: 'organogram', route: '/organization/organogram', permissionKey: 'view_organization' },
      { title: 'Workforce Planning', slug: 'workforce-planning', route: '/organization/workforce-planning', permissionKey: 'manage_organization' },
    ]
  },
  {
    id: 'attendance',
    label: 'Attendance',
    slug: 'attendance',
    icon: CalendarCheck,
    group: 'main',
    permissionKey: 'view_attendance',
    subItems: [
      { title: 'Daily Attendance', slug: 'daily-attendance', route: '/attendance/daily-attendance', permissionKey: 'view_attendance' },
      { title: 'Shift Attendance', slug: 'shift-attendance', route: '/attendance/shift-attendance', permissionKey: 'view_attendance' },
      { title: 'Attendance Approval', slug: 'attendance-approval', route: '/attendance/attendance-approval', permissionKey: 'approve_attendance' },
    ]
  },
  {
    id: 'time-logs',
    label: 'Time & Logs',
    slug: 'time-logs',
    icon: Clock,
    group: 'main',
    permissionKey: 'view_timesheets',
    subItems: [
      { title: 'Timesheet Entry', slug: 'timesheet-entry', route: '/time-logs/timesheet-entry', permissionKey: 'view_timesheets' },
      { title: 'Timesheet Approval', slug: 'timesheet-approval', route: '/time-logs/timesheet-approval', permissionKey: 'approve_timesheets' },
      { title: 'Overtime Logs', slug: 'overtime-logs', route: '/time-logs/overtime-logs', permissionKey: 'view_timesheets' },
    ]
  },
  {
    id: 'leave-management',
    label: 'Leave Management',
    slug: 'leave-management',
    icon: CalendarOff,
    group: 'main',
    badgeCount: 5,
    permissionKey: 'view_leave',
    subItems: [
      { title: 'Leave Dashboard', slug: 'leave-dashboard', route: '/leave-management/leave-dashboard', permissionKey: 'view_leave' },
      { title: 'Leave Application', slug: 'leave-application', route: '/leave-management/leave-application', permissionKey: 'apply_leave' },
      { title: 'Leave Approval', slug: 'leave-approval', route: '/leave-management/leave-approval', permissionKey: 'approve_leave' },
    ]
  },
  {
    id: 'payroll',
    label: 'Payroll',
    slug: 'payroll',
    icon: Banknote,
    group: 'main',
    permissionKey: 'view_payroll',
    subItems: [
      { title: 'Payroll Dashboard', slug: 'payroll-dashboard', route: '/payroll/payroll-dashboard', permissionKey: 'view_payroll' },
      { title: 'Payroll Processing', slug: 'payroll-processing', route: '/payroll/payroll-processing', permissionKey: 'process_payroll' },
      { title: 'Payslip Generation', slug: 'payslip-generation', route: '/payroll/payslip-generation', permissionKey: 'view_payroll' },
    ]
  },
  {
    id: 'benefits',
    label: 'Benefits',
    slug: 'benefits',
    icon: Gift,
    group: 'main',
    permissionKey: 'view_benefits',
    subItems: [
      { title: 'Benefit Plans', slug: 'benefit-plans', route: '/benefits/benefit-plans', permissionKey: 'view_benefits' },
      { title: 'Medical Benefits', slug: 'medical-benefits', route: '/benefits/medical-benefits', permissionKey: 'view_benefits' },
    ]
  },
  {
    id: 'performance',
    label: 'Performance',
    slug: 'performance',
    icon: Target,
    group: 'main',
    permissionKey: 'view_performance',
    subItems: [
      { title: 'Performance Dashboard', slug: 'performance-dashboard', route: '/performance/performance-dashboard', permissionKey: 'view_performance' },
      { title: 'Appraisal Cycles', slug: 'appraisal-cycles', route: '/performance/appraisal-cycles', permissionKey: 'manage_performance' },
    ]
  },
  {
    id: 'learning',
    label: 'Learning & Dev',
    slug: 'learning',
    icon: GraduationCap,
    group: 'main',
    permissionKey: 'view_learning',
    subItems: [
      { title: 'Training Dashboard', slug: 'training-dashboard', route: '/learning/training-dashboard', permissionKey: 'view_learning' },
      { title: 'Training Requests', slug: 'training-requests', route: '/learning/training-requests', permissionKey: 'view_learning' },
    ]
  },
  {
    id: 'recruitment',
    label: 'Recruitment',
    slug: 'recruitment',
    icon: UserPlus,
    group: 'main',
    permissionKey: 'view_recruitment',
    subItems: [
      { title: 'Recruitment Dashboard', slug: 'recruitment-dashboard', route: '/recruitment/recruitment-dashboard', permissionKey: 'view_recruitment' },
      { title: 'Job Requisition', slug: 'job-requisition', route: '/recruitment/job-requisition', permissionKey: 'create_requisition' },
    ]
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    slug: 'onboarding',
    icon: UserCheck,
    group: 'main',
    permissionKey: 'view_onboarding',
    subItems: [
      { title: 'Onboarding Dashboard', slug: 'onboarding-dashboard', route: '/onboarding/onboarding-dashboard', permissionKey: 'view_onboarding' },
      { title: 'New Hire Checklist', slug: 'new-hire-checklist', route: '/onboarding/new-hire-checklist', permissionKey: 'manage_onboarding' },
    ]
  },
  {
    id: 'offboarding',
    label: 'Offboarding',
    slug: 'offboarding',
    icon: LogOut,
    group: 'main',
    permissionKey: 'view_offboarding',
    subItems: [
      { title: 'Exit Clearance', slug: 'exit-clearance', route: '/offboarding/exit-clearance', permissionKey: 'manage_offboarding' },
      { title: 'Handover Checklist', slug: 'handover-checklist', route: '/offboarding/handover-checklist', permissionKey: 'view_offboarding' },
    ]
  },
  {
    id: 'documents',
    label: 'Documents & Records',
    slug: 'documents',
    icon: Files,
    group: 'main',
    permissionKey: 'view_documents',
    subItems: [
      { title: 'Employee Documents', slug: 'employee-documents', route: '/documents/employee-documents', permissionKey: 'view_documents' },
      { title: 'Contract Letters', slug: 'contract-letters', route: '/documents/contract-letters', permissionKey: 'manage_documents' },
    ]
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    slug: 'reports',
    icon: BarChart4,
    group: 'main',
    permissionKey: 'view_reports',
    subItems: [
      { title: 'Workforce Reports', slug: 'workforce-reports', route: '/reports/workforce-reports', permissionKey: 'view_reports' },
      { title: 'Custom Report Builder', slug: 'custom-report-builder', route: '/reports/custom-report-builder', permissionKey: 'manage_reports' },
    ]
  },
  {
    id: 'announcements',
    label: 'Announcements',
    slug: 'announcements',
    icon: Megaphone,
    group: 'main',
    permissionKey: 'view_announcements',
    subItems: [
      { title: 'Company Notices', slug: 'company-notices', route: '/announcements/company-notices', permissionKey: 'view_announcements' },
    ]
  },

  // ADMINISTRATION
  {
    id: 'user-management',
    label: 'User Management',
    slug: 'user-management',
    icon: UserCog,
    group: 'administration',
    permissionKey: 'manage_users',
    subItems: [
      { title: 'User Accounts', slug: 'user-accounts', route: '/administration/user-management/user-accounts', permissionKey: 'manage_users' },
    ]
  },
  {
    id: 'roles-permissions',
    label: 'Roles & Permissions',
    slug: 'roles-permissions',
    icon: ShieldCheck,
    group: 'administration',
    permissionKey: 'manage_roles',
    subItems: [
      { title: 'Role Management', slug: 'role-management', route: '/administration/roles-permissions/role-management', permissionKey: 'manage_roles' },
    ]
  },
  {
    id: 'approval-workflow',
    label: 'Approval Workflow',
    slug: 'approval-workflow',
    icon: FileSignature,
    group: 'administration',
    permissionKey: 'manage_workflows',
    subItems: [
      { title: 'Approval Matrix', slug: 'approval-matrix', route: '/administration/approval-workflow/approval-matrix', permissionKey: 'manage_workflows' },
    ]
  },
  {
    id: 'system-settings',
    label: 'System Settings',
    slug: 'system-settings',
    icon: Settings2,
    group: 'administration',
    permissionKey: 'manage_settings',
    subItems: [
      { title: 'Company Profile', slug: 'company-profile', route: '/administration/system-settings/company-profile', permissionKey: 'manage_settings' },
    ]
  },
  {
    id: 'audit-trail',
    label: 'Audit Trail',
    slug: 'audit-trail',
    icon: FileKey,
    group: 'administration',
    permissionKey: 'view_audit_logs',
    subItems: [
      { title: 'User Activity Logs', slug: 'activity-logs', route: '/administration/audit-trail/activity-logs', permissionKey: 'view_audit_logs' },
    ]
  },
  {
    id: 'integrations',
    label: 'Integrations',
    slug: 'integrations',
    icon: Webhook,
    group: 'administration',
    permissionKey: 'manage_integrations',
    subItems: [
      { title: 'ERP Integration', slug: 'erp-integration', route: '/administration/integrations/erp-integration', permissionKey: 'manage_integrations' },
    ]
  },
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    slug: 'ai-automation',
    icon: Bot,
    group: 'administration',
    permissionKey: 'manage_ai',
    subItems: [
      { title: 'HR AI Assistant', slug: 'hr-ai-assistant', route: '/administration/ai-automation/hr-ai-assistant', permissionKey: 'manage_ai' },
      { title: 'Employee Risk Prediction', slug: 'employee-risk-prediction', route: '/administration/ai-automation/employee-risk-prediction', permissionKey: 'manage_ai' },
    ]
  },
  {
    id: 'compliance',
    label: 'Compliance',
    slug: 'compliance',
    icon: Scale,
    group: 'administration',
    permissionKey: 'manage_compliance',
    subItems: [
      { title: 'Labour Law Compliance', slug: 'labour-law-compliance', route: '/administration/compliance/labour-law-compliance', permissionKey: 'manage_compliance' },
    ]
  },

  // SUPPORT
  {
    id: 'help-support',
    label: 'Help & Support',
    slug: 'help-support',
    icon: HelpCircle,
    group: 'support',
    permissionKey: 'view_support',
    route: '/support/help-desk'
  }
];
