export type NavigationItem = {
  label: string;
  path: string;
  icon: string;
  roles: string[];
};

const executiveRoles = [
  "administrator",
  "national_sales_manager",
  "hr",
];

const generalStaffRoles = [
  "administrator",
  "national_sales_manager",
  "hr",
  "regional_sales_manager",
  "sales_executive",
  "market_sitter",
];



// BA and VSR roles are permitted on Daily Attendance, Sales, Targets, and Visits (attendance history)
const baAllowedRoles = [
  ...generalStaffRoles,
  "brand_ambassador",
  "ba",
  "vsr",
];

// All staff roles permitted on Messages & Calls (Admin, HR, NSM, RSM, SE, BA, VSR, Market Sitter)
const allStaffRoles = [
  ...baAllowedRoles,
  "admin",
  "administrator",
  "hr",
  "national_sales_manager",
  "nsm",
  "regional_sales_manager",
  "rsm",
  "sales_executive",
  "se",
  "market_sitter",
  "brand_ambassador",
  "ba",
  "vsr",
];

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", path: "/", icon: "dashboard", roles: executiveRoles },
  { label: "Check-In & Attendance", path: "/check-in", icon: "attendance", roles: allStaffRoles },
  { label: "Sales", path: "/sales", icon: "sales", roles: baAllowedRoles },
  { label: "Targets", path: "/targets", icon: "targets", roles: baAllowedRoles },
  { label: "Outlets", path: "/outlets", icon: "outlets", roles: generalStaffRoles },
  { label: "Outlet Visits History", path: "/visits", icon: "visits", roles: baAllowedRoles },
  { label: "Reports", path: "/reports", icon: "reports", roles: generalStaffRoles },

  { label: "Field Team Performance", path: "/reports/field-performance", icon: "users", roles: generalStaffRoles },
  { label: "Team", path: "/staff", icon: "team", roles: generalStaffRoles },
  { label: "Team Activity", path: "/visits/activity", icon: "activity", roles: generalStaffRoles },
  { label: "Settings", path: "/settings", icon: "settings", roles: ["administrator"] },
  { label: "Notifications", path: "/settings/notifications", icon: "notifications", roles: ["administrator"] },
];