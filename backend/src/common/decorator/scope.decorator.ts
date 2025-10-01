import { SetMetadata } from '@nestjs/common';
export const SCOPE_KEY = 'scope';
export type ScopeType = 'ORGANIZATION' | 'WORKSPACE' | 'PROJECT';
export const Scope = (type: ScopeType, idParam: string) =>
  SetMetadata(SCOPE_KEY, { type, idParam });
