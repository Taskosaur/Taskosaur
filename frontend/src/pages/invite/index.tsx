// pages/invite/index.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";
import { HiArrowPath } from "react-icons/hi2";

import { invitationApi } from "@/utils/api/invitationsApi";
import { useAuth } from "@/contexts/auth-context";

export default function InviteRedirect() {
  const router = useRouter();
  const { token } = router.query;
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    if (!token || isLoading) return;

    (async () => {
      try {
        /* 1 ▸ ask backend if token is valid + whether user exists */
        const res = await invitationApi.verifyInvitation(token as string);

        if (!res.isValid) {
          router.replace(
            `/invite/invalid?msg=${encodeURIComponent(res.message ?? "Invalid invitation")}`
          );
          return;
        }

        /* 2 ▸ save token so login / signup can finish the flow */
        localStorage.setItem("pendingInvitation", token as string);

        const inviteeEmail = res.invitation.email;

        /* 3 ▸ decide where to send the browser */
        if (isAuthenticated()) {
          // User is logged in - check if email matches
          if (user?.email?.toLowerCase() === inviteeEmail.toLowerCase()) {
            // Email matches → accept and go to dashboard
            await invitationApi.acceptInvitation(token as string).catch(() => {});
            localStorage.removeItem("pendingInvitation");
            router.replace("/dashboard");
          } else {
            // Email mismatch → clear the token so the modal doesn't persist
            localStorage.removeItem("pendingInvitation");
            // Go to invalid page with specific message
            router.replace(
              `/invite/invalid?msg=${encodeURIComponent(
                `This invitation was sent to ${inviteeEmail}, but you are currently logged in as ${user?.email}. Please log out and use the correct account.`
              )}`
            );
          }
        } else if (res.inviteeExists) {
          // invited email already has an account but not logged in
          router.replace(`/login?email=${encodeURIComponent(inviteeEmail)}`);
        } else {
          // no account yet → register
          router.replace(`/register?email=${encodeURIComponent(inviteeEmail)}`);
        }
      } catch (err) {
        localStorage.removeItem("pendingInvitation");
        router.replace("/");
      }
    })();
  }, [token, router, isAuthenticated, user, isLoading]);

  /* Minimal spinner while everything happens */
  return (
    <div className="py-20 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <HiArrowPath className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-[var(--muted-foreground)]">Verifying invitation...</p>
      </div>
    </div>
  );
}
