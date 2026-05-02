# Implementation Plan: VIEWER Invite Feature

## Overview

Three phases: (1) backend guard on org creation, (2) threading the `redirect` param through the invite → login/register funnel, (3) stripping the sidebar and adding a guest indicator for VIEWER-role users.

The existing `hasAccess` system already hides action buttons in sprint/project views for VIEWER — those pages need no changes. Only the funnel redirect logic and sidebar create-actions need work.

---

## Phase 1: Backend — Block Org Creation for VIEWER Users

Close the gap where any authenticated user (including VIEWER) can create an organisation.

### Tasks

- [ ] Add `@Roles` decorator to `POST /organizations` endpoint

### Technical Details

**File:** `backend/src/modules/organizations/organizations.controller.ts` (line 47)

The `RolesGuard` and `JwtAuthGuard` are already applied at controller level (line 37). Only the `POST /` endpoint is missing the role decorator.

```typescript
// Before (line 47-51):
@Post()
@ApiOperation({ summary: 'Create organization' })
create(@Body() createOrganizationDto: CreateOrganizationDto, @CurrentUser() user: User) {
  return this.organizationsService.create(createOrganizationDto, user.id);
}

// After:
@Post()
@Roles(Role.MEMBER, Role.MANAGER, Role.OWNER, Role.SUPER_ADMIN)
@ApiOperation({ summary: 'Create organization' })
create(@Body() createOrganizationDto: CreateOrganizationDto, @CurrentUser() user: User) {
  return this.organizationsService.create(createOrganizationDto, user.id);
}
```

`Role` and `Roles` decorator are already imported at lines 29-30.

---

## Phase 2: Invite Funnel — Thread `redirect` Param End-to-End

Carry the target resource URL through the entire invite → auth flow so VIEWER users land on their invited resource, not `/dashboard`.

**How the redirect path is encoded in the invite link:**
- Org invite → `/orgSlug`
- Workspace invite → `/orgSlug/workspaceSlug`
- Project invite → `/orgSlug/projectSlug`
- Sprint invite → `/orgSlug/projectSlug/sprints/sprintSlug`

The invite link is crafted by the inviter and appended to the standard invite URL:
```
https://pm.maxxpro.co.za/invite?token=<TOKEN>&redirect=/maxipro/google-reviews/sprints/pre-launch-testing
```

### Tasks

- [ ] Update invite page to extract `redirect` and pass it to login/register (depends on nothing)
- [ ] Update RegisterForm to honour `redirect` param post-registration (depends on invite page task)
- [ ] Update LoginForm to honour `redirect` param and process pending invitation post-login (depends on invite page task)

### Technical Details

#### Task 1 — Invite page (`frontend/src/pages/invite/index.tsx`)

Extract `redirect` from `router.query` alongside the existing `token`, persist it in `localStorage`, and carry it forward in the login/register redirect URLs.

```typescript
// Add to query destructuring (line 11):
const { token, redirect } = router.query;

// After localStorage.setItem("pendingInvitation", ...) (line 30), add:
if (redirect) {
  localStorage.setItem("pendingRedirect", redirect as string);
}

// Change line 54 (login redirect):
router.replace(`/login?email=${encodeURIComponent(inviteeEmail)}&redirect=${encodeURIComponent(redirect as string || "")}`);

// Change line 57 (register redirect):
router.replace(`/register?email=${encodeURIComponent(inviteeEmail)}&redirect=${encodeURIComponent(redirect as string || "")}`);

// Change line 41 (already-authenticated path — currently hardcodes /dashboard):
router.replace((redirect as string) || "/dashboard");
```

#### Task 2 — RegisterForm (`frontend/src/components/register/RegisterForm.tsx`, line 124)

`searchParams` is already imported from `next/navigation` at line 2. Read the redirect and use it post-registration.

```typescript
// Add near line 42 (alongside initialEmail):
const redirectPath = searchParams.get("redirect") || localStorage.getItem("pendingRedirect") || "";

// Replace lines 123-125 (the checkOrganizationAndRedirect block):
const destination = redirectPath || await checkOrganizationAndRedirect();
localStorage.removeItem("pendingRedirect");
router.push(destination);
```

#### Task 3 — LoginForm (`frontend/src/components/login/LoginForm.tsx`)

Currently hardcodes `router.push("/dashboard")` at line 95 and never processes the `pendingInvitation` token.

```typescript
// Add import (alongside existing useRouter):
import { useSearchParams } from "next/navigation";

// Add inside component:
const searchParams = useSearchParams();

// Replace handleSubmit success block (around line 93-96):
await login({ email: formData.email, password: formData.password });

// Accept pending invitation if present
const pendingToken = localStorage.getItem("pendingInvitation");
if (pendingToken) {
  await invitationApi.acceptInvitation(pendingToken).catch(() => {});
  localStorage.removeItem("pendingInvitation");
}

// Resolve redirect
const redirectPath =
  searchParams.get("redirect") ||
  localStorage.getItem("pendingRedirect") ||
  (await checkOrganizationAndRedirect());
localStorage.removeItem("pendingRedirect");
router.push(redirectPath);
```

Also import `invitationApi` at the top of LoginForm:
```typescript
import { invitationApi } from "@/utils/api/invitationsApi";
```

And add `checkOrganizationAndRedirect` to the `useAuth()` destructure.

---

## Phase 3: Frontend — Stripped VIEWER UI

Hide all create/edit/settings actions in the sidebar for VIEWER-role users, and show a "Read-only view" indicator in the header.

**Key insight:** VIEWER users are only added as members at the invited scope level, so the sidebar's membership-based data fetching naturally limits what resources they see. Only the action buttons need to be removed.

### Tasks

- [ ] Strip create/settings actions from Sidebar for VIEWER role
- [ ] Add "Read-only view" chip to Header for VIEWER role

### Technical Details

#### Task 1 — Sidebar (`frontend/src/components/layout/Sidebar.tsx`)

The global `role` is already used at line 190 (`currentUser?.role === "SUPER_ADMIN"`). Add an `isViewer` flag and conditionally suppress create actions.

```typescript
// Add near the SUPER_ADMIN check (line ~190):
const isViewer = currentUser?.role === "VIEWER";
```

Then wrap each create action with `{!isViewer && ...}`:
- "New workspace" button
- "New project" button  
- "New sprint" button
- Settings/admin navigation items that require MEMBER+
- Any org-level management links

Search for the button labels ("New workspace", "New project", "New sprint") in the file to find exact lines.

#### Task 2 — Header (`frontend/src/components/layout/Header.tsx`)

The Create button is already hidden at line 283 via `hasAccess`. Add a read-only badge that appears in its place for VIEWERs.

```tsx
// Add near the hasAccess/Create button block (~line 280):
{currentUser?.role === "VIEWER" && (
  <span className="text-xs px-2 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]">
    Read-only view
  </span>
)}
```

`currentUser` is already available in the Header component via `useAuth()`.

---

## Immediate Test Case

After all three phases are complete, verify with the real use case:

```
Invite link: https://pm.maxxpro.co.za/invite?token=<TOKEN>&redirect=/maxipro/google-reviews/sprints/pre-launch-testing
Sprint ID: 77960131-027f-4e57-af0b-bcd5594f5381
Sprint slug: pre-launch-testing
```

1. Open invite link in incognito
2. Verify lands on `/register?email=...&redirect=/maxipro/google-reviews/sprints/pre-launch-testing`
3. Register → verify lands on the sprint, sidebar visible, no create buttons
4. Header shows "Read-only view" chip
5. Sidebar: can navigate into project/sprints but no "New sprint" / "New project" buttons
6. Log out, click invite again → lands on `/login?email=...&redirect=...`
7. Login → same sprint landing
8. `POST /organizations` as VIEWER → returns 403
