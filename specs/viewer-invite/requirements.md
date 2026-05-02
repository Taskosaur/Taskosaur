# Requirements: VIEWER Invite Feature

## Overview

A scoped read-only invite system that lets Robin share direct access links with external partners (e.g. clients, contractors). Invitees land on exactly the resource they were invited to view, register or log in with minimal friction, and see a stripped-down UI with zero ability to create, edit, or delete anything.

## Why

Robin needs to share a live sprint view with a business partner without giving them write access to the project management system. The existing invite system adds users as members but doesn't enforce a post-login redirect to the invited resource, and the UI doesn't strip create/edit actions for read-only users.

## Invite Scope Levels

Each invite level gives read-only access to the invited resource and everything below it:

| Invite level | Lands on | Can navigate to |
|---|---|---|
| Organisation | Org dashboard | Workspaces → Projects → Sprints → Tasks |
| Workspace | Workspace project list | Projects → Sprints → Tasks |
| Project | Project board/backlog | Sprints → Tasks |
| Sprint | Sprint task list | Tasks |

## Acceptance Criteria

### Auth & Redirect

- [ ] Clicking an invite link (e.g. `/invite?token=X&redirect=/org/project/sprints/sprint`) takes the user to the register or login page with the redirect path preserved in the URL
- [ ] After registration, the user is redirected to the path specified in the invite link (not `/dashboard`)
- [ ] After login, the user is redirected to the path specified in the invite link (not `/dashboard`)
- [ ] If the user is already logged in with the correct email when clicking the invite link, they are redirected directly to the target path
- [ ] The pending invitation is accepted during the login flow (not just during registration)

### Permissions

- [ ] A VIEWER-role user cannot create a new organisation (currently unguarded)
- [ ] A VIEWER-role user cannot create workspaces, projects, sprints, or tasks (existing guards confirmed working)

### UI — Stripped Sidebar

- [ ] The sidebar hides all "New workspace", "New project", "New sprint" buttons for VIEWER-role users
- [ ] Settings/admin links that require MEMBER+ are hidden for VIEWER-role users
- [ ] VIEWER users can still navigate freely within the scope they were invited to (the sidebar shows their accessible workspaces/projects/sprints based on membership)

### UI — Header

- [ ] A "Read-only view" chip/badge is displayed in the header for VIEWER-role users, in place of the Create button area
- [ ] The Create button is not shown for VIEWER-role users (existing `hasAccess` guard already handles this — verify)

### Existing Read-Only Guards (verify, no changes expected)

- [ ] Sprint view: no task create/import/bulk-action buttons visible to VIEWER
- [ ] Sprint list: no "Create sprint" button visible to VIEWER
- [ ] SprintCard: no edit/delete dropdown visible to VIEWER

## Dependencies

- Existing role system: `SUPER_ADMIN > OWNER > MANAGER > MEMBER > VIEWER` on `OrganizationMember`, `WorkspaceMember`, `ProjectMember`
- Existing `hasAccess` / `getUserAccess()` pattern in frontend
- Existing `pendingInvitation` localStorage flow for invite token handling
- Existing invitation backend at `invitations.controller.ts`

## Out of Scope

- `PublicTaskShare` (per-task token, no login required) — separate feature, not extended here
- Any changes to how invites are *sent* (invite email UI, admin invite management)
- New invite scope levels beyond what the existing membership models support
