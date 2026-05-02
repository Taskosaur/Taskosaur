# Implementation Plan: Share Invite Button

## Overview

Build a reusable `ShareInviteModal` component and place it in the `PageHeader` actions slot on four pages: org dashboard, workspace overview, project overview, and sprint view.

---

## Phase 1: ShareInviteModal Component

Build the single reusable modal that handles all four share contexts.

### Tasks

- [ ] Create `ShareInviteModal` component with email input and invite creation flow [complex]
  - [ ] Email input + "Create Invite Link" button
  - [ ] Call `invitationApi.createInvitation()` and build the full link from response token
  - [ ] Show copyable link field with clipboard copy button
  - [ ] Show "Invitation email sent" confirmation note
  - [ ] "Share via WhatsApp" button → phone input → open `wa.me` URL

### Technical Details

**File to create:** `frontend/src/components/common/ShareInviteModal.tsx`

**Props interface:**
```tsx
interface ShareInviteModalProps {
  entityType: "organization" | "workspace" | "project"
  entityId: string       // UUID of org/workspace/project
  entityName: string     // shown in modal title e.g. "Google Reviews"
  redirectPath: string   // e.g. "/maxipro/google-reviews/sprints/pre-launch-testing"
  trigger?: ReactNode    // defaults to a "Share" button if not provided
}
```

**Invite API call:**
```ts
import { invitationApi } from "@/utils/api/invitationsApi";

const response = await invitationApi.createInvitation({
  inviteeEmail: email,
  [`${entityType}Id`]: entityId,  // → organizationId / workspaceId / projectId
  role: "VIEWER",
});

const link = `${window.location.origin}/invite?token=${response.token}&redirect=${encodeURIComponent(redirectPath)}`;
```

**Copy to clipboard:**
```ts
navigator.clipboard.writeText(link);
```

**WhatsApp link format:**
```ts
const message = `Hi! I'd like to share access to ${entityName} with you. Click this link to view it: ${link}`;
const waUrl = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
window.open(waUrl, "_blank");
```

**UI components to import:**
```ts
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

**Modal states:**
1. `idle` — show email input + "Create Invite Link" button
2. `loading` — show spinner while API call in progress
3. `success` — show generated link, copy button, email sent note, WhatsApp option
4. `whatsapp` — show phone number input under WhatsApp section
5. `error` — show error message, allow retry

---

## Phase 2: Wire Share Button into Each Page

Place the `ShareInviteModal` trigger into the `PageHeader` `actions` prop on all four pages.

### Tasks

- [ ] Add Share button to org dashboard (`OrganizationAnalytics.tsx`)
- [ ] Add Share button to workspace overview (`WorkspaceAnalytics.tsx`)
- [ ] Add Share button to project overview (`ProjectAnalytics.tsx`)
- [ ] Add Share button to sprint view (`[sprintId].tsx`) (depends on Phase 1)

### Technical Details

#### Org — `frontend/src/components/organizations/OrganizationAnalytics.tsx` (~line 472)

Data available in component:
- `organizationId` — passed as prop
- `currentOrganization.slug` — from `useOrganization()`
- `currentOrganization.name` — for `entityName`

```tsx
import { ShareInviteModal } from "@/components/common/ShareInviteModal";

// In PageHeader actions:
<ShareInviteModal
  entityType="organization"
  entityId={organizationId}
  entityName={currentOrganization?.name ?? "Organisation"}
  redirectPath={`/${currentOrganization?.slug}`}
/>
```

#### Workspace — `frontend/src/components/workspace/WorkspaceAnalytics.tsx` (~line 353)

Data available:
- `currentWorkspace.id` — from `useWorkspace()`
- `workspaceSlug` — from `useRouter()`
- `currentWorkspace.name`

```tsx
<ShareInviteModal
  entityType="workspace"
  entityId={currentWorkspace?.id}
  entityName={currentWorkspace?.name ?? "Workspace"}
  redirectPath={`/${workspaceSlug}`}
/>
```

#### Project — `frontend/src/components/projects/ProjectAnalytics.tsx` (~line 361)

Data available:
- `currentProject.id` — from project context
- `projectSlug`, `workspaceSlug` — from `useRouter()`
- `currentProject.name`

```tsx
<ShareInviteModal
  entityType="project"
  entityId={currentProject?.id}
  entityName={currentProject?.name ?? "Project"}
  redirectPath={`/${workspaceSlug}/${projectSlug}`}
/>
```

#### Sprint — `frontend/src/pages/[workspaceSlug]/[projectSlug]/sprints/[sprintId].tsx` (~line 958)

Sprint invites are project-scoped (backend limitation) but redirect to the sprint URL.

Data available:
- `project.id` — from component state
- `sprint.slug` — from component state
- `sprint.name` — for entityName
- `workspaceSlug`, `projectSlug` — from `useRouter()`

```tsx
<ShareInviteModal
  entityType="project"
  entityId={project?.id}
  entityName={sprint?.name ?? "Sprint"}
  redirectPath={`/${workspaceSlug}/${projectSlug}/sprints/${sprint?.slug}`}
/>
```

---

## Phase 3: Copy Specs to Worktree

After files are written, copy the new spec files into the active worktree so they're committed with the feature.

### Tasks

- [ ] Copy `specs/viewer-invite/share-button-requirements.md` to worktree
- [ ] Copy `specs/viewer-invite/share-button-implementation-plan.md` to worktree
- [ ] Copy `specs/viewer-invite/share-button-action-required.md` to worktree
