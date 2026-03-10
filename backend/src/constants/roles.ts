import { Role } from '@prisma/client';

/**
 * Role hierarchy from lowest to highest privilege
 */
export const ROLE_HIERARCHY: Role[] = [
  Role.VIEWER,
  Role.MEMBER,
  Role.MANAGER,
  Role.OWNER,
  Role.SUPER_ADMIN,
];

/**
 * Checks if the actor's role is at least the required role
 * @param actorRole The role of the user performing the action
 * @param requiredRole The minimum role required for the action
 * @returns true if actor has sufficient privileges
 */
export const hasRequiredRole = (actorRole: Role, requiredRole: Role): boolean => {
  const actorIndex = ROLE_HIERARCHY.indexOf(actorRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  if (actorIndex === -1 || requiredIndex === -1) return false;
  return actorIndex >= requiredIndex;
};

/**
 * Checks if the actor's role is strictly higher than the target role
 * @param actorRole The role of the user performing the action
 * @param targetRole The role being checked against
 * @returns true if actor's role is higher
 */
export const isRoleHigher = (actorRole: Role, targetRole: Role): boolean => {
  const actorIndex = ROLE_HIERARCHY.indexOf(actorRole);
  const targetIndex = ROLE_HIERARCHY.indexOf(targetRole);

  if (actorIndex === -1 || targetIndex === -1) return false;
  return actorIndex > targetIndex;
};
