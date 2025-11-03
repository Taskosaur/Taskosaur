// permissionUtils.ts
import { Role, rolePermissions } from "./roles";

export function hasPermission(
  role: Role,
  entity: keyof typeof rolePermissions,
  action: string
): boolean {
  // SUPER_ADMIN bypasses all permission checks
  if (role === "SUPER_ADMIN") return true;

  const permissions = rolePermissions[entity]?.[action];
  if (!permissions) return false;
  return permissions.includes(role);
}

export function getVisibility(role: Role) {
  return rolePermissions.visibility_rules[role];
}

export function isSuperAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN";
}
