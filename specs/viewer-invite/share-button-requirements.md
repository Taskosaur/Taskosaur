# Requirements: Share Invite Button

## Overview

A "Share" button at every level of the app (org, workspace, project, sprint) that generates a scoped VIEWER invite link — copyable, emailable, and shareable via WhatsApp in one modal.

## Why

The VIEWER invite redirect plumbing was built in the first phase of this feature, but there's no UI to actually create an invite and hand the link to someone. Currently Robin has to manually craft the invite link. This completes the user-facing experience.

## What It Does

Clicking the Share button at any level opens a modal that:
1. Takes the invitee's email address
2. Creates a VIEWER-role invitation scoped to the current resource
3. Builds the full invite link with `?redirect=` pre-filled to land on the current page
4. Shows a copyable link field
5. Confirms that an invitation email was auto-sent (backend handles this)
6. Offers a WhatsApp share option (asks for phone number, opens `wa.me` link)

## Acceptance Criteria

### Share button placement
- [ ] A "Share" button appears in the page header on the org dashboard
- [ ] A "Share" button appears in the page header on workspace overview
- [ ] A "Share" button appears in the page header on project overview
- [ ] A "Share" button appears in the page header on sprint view

### Modal — invite creation
- [ ] Modal has an email input and a "Create Invite Link" button
- [ ] Submitting creates a VIEWER invitation via `POST /invitations`
- [ ] The generated link includes `?redirect=<current-page-path>`
- [ ] Sprint-level share creates a project-scoped invite (backend limitation) with sprint redirect URL

### Modal — link sharing
- [ ] Generated invite link appears in a read-only input
- [ ] "Copy" button copies the link to clipboard
- [ ] A confirmation note tells the user an invite email was sent to the address

### Modal — WhatsApp
- [ ] "Share via WhatsApp" button appears after link is generated
- [ ] Clicking it reveals a phone number input
- [ ] Submitting opens `https://wa.me/{number}?text={pre-filled message with link}`
- [ ] Works on both desktop (opens WhatsApp desktop app or web) and mobile

## Dependencies

- VIEWER invite redirect feature (already shipped) — provides the `?redirect=` funnel
- Existing `invitationApi.createInvitation()` in `frontend/src/utils/api/invitationsApi.ts`
- Existing `Dialog` component in `frontend/src/components/ui/dialog.tsx`
- Backend `POST /invitations` endpoint — already supports org/workspace/project scope with VIEWER role
