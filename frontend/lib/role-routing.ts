import { ROLES, type Role } from "@/lib/constants"

const roleDashboards: Partial<Record<Role, string>> = {
  [ROLES.SUPER_ADMIN]: "/admin/dashboard",
  [ROLES.OWNER]: "/owner/dashboard",
  [ROLES.MANAGER]: "/staff/manager/dashboard",
  [ROLES.HOST]: "/staff/host",
  [ROLES.WAITER]: "/staff/waiter",
  [ROLES.CHEF]: "/staff/chef/kitchen",
  [ROLES.CASHIER]: "/staff/cashier",
  [ROLES.CUSTOMER]: "/customer/home",
  [ROLES.DELIVERY_PARTNER]: "/delivery",
}

const defaultDashboard = "/"

const staffHostRoles: Role[] = [ROLES.HOST, ROLES.MANAGER, ROLES.OWNER]
const staffWaiterRoles: Role[] = [ROLES.WAITER, ROLES.MANAGER, ROLES.OWNER]
const staffChefRoles: Role[] = [ROLES.CHEF, ROLES.MANAGER, ROLES.OWNER]
const staffCashierRoles: Role[] = [ROLES.CASHIER, ROLES.MANAGER, ROLES.OWNER]
const staffRoles: Role[] = [ROLES.MANAGER, ROLES.HOST, ROLES.WAITER, ROLES.CHEF, ROLES.CASHIER, ROLES.OWNER]

export function getRoleDashboard(role?: Role) {
  if (!role) return defaultDashboard
  return roleDashboards[role] ?? defaultDashboard
}

export function isAllowedRedirect(path: string, role?: Role) {
  if (!role) return false
  if (!path.startsWith("/") || path.startsWith("//")) return false
  if (path.startsWith("/admin")) return role === ROLES.SUPER_ADMIN
  if (path.startsWith("/owner")) return role === ROLES.OWNER
  if (path.startsWith("/staff/manager")) return role === ROLES.MANAGER || role === ROLES.OWNER
  if (path.startsWith("/staff/host")) return staffHostRoles.includes(role)
  if (path.startsWith("/staff/waiter")) return staffWaiterRoles.includes(role)
  if (path.startsWith("/staff/chef")) return staffChefRoles.includes(role)
  if (path.startsWith("/staff/cashier")) return staffCashierRoles.includes(role)
  if (path.startsWith("/staff")) return staffRoles.includes(role)
  if (path.startsWith("/customer")) return role === ROLES.CUSTOMER
  if (path.startsWith("/delivery")) return role === ROLES.DELIVERY_PARTNER
  return true
}
