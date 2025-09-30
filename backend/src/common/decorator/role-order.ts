import { Role } from '@prisma/client';

export const ROLE_RANK: Record<Role, number> = {
  SUPER_ADMIN: 5,
  OWNER: 4,
  MANAGER: 3,
  MEMBER: 2,
  VIEWER: 1,
};
