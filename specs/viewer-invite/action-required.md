# Action Required: VIEWER Invite Feature

## Before Implementation

- [ ] **Craft test invite link with `?redirect=` param** — The invite system doesn't auto-append a redirect; the person sending the invite must manually append `&redirect=<path>` to the invite URL. Confirm the format: `https://pm.maxxpro.co.za/invite?token=<TOKEN>&redirect=/maxipro/google-reviews/sprints/pre-launch-testing`

## After Implementation

- [ ] **Send a test invite to a fresh email address as VIEWER** — Needed to verify the end-to-end flow with a real invite token before sharing with the actual business partner
- [ ] **Verify the business partner's invite** — Once the feature is live, re-send or re-use the invite for the Google Reviews sprint (`pre-launch-testing`, ID: `77960131-027f-4e57-af0b-bcd5594f5381`) with the correct redirect path

---

> **Note:** These tasks are also listed in context within `implementation-plan.md`
