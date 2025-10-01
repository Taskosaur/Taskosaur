/**
 * System User ID - Used for internal operations and audit trails
 * This user:
 * - Cannot be used for authentication (status: INACTIVE, no password)
 * - Is used as fallback for audit trails when no user context is available
 * - Is created during database seeding
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
