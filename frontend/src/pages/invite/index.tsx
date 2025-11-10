// pages/invite/index.tsx
import { useEffect } from "react";
import { useRouter } from "next/router";
import { HiArrowPath } from "react-icons/hi2";

import { invitationApi } from "@/utils/api/invitationsApi";
import { useAuth } from "@/contexts/auth-context";

export default function InviteRedirect() {
  const router = useRouter();
  const { token } = router.query;
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

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
        if (res.inviteeExists) {
          // invited email already has an account
          if (isAuthenticated()) {
            // logged-in → straight to dashboard
            await invitationApi.acceptInvitation(token as string).catch(() => {});
            router.replace("/dashboard");
          } else {
            // not logged-in → go to login with email pre-filled
            router.replace(`/login?email=${encodeURIComponent(inviteeEmail)}`);
          }
        } else {
          // no account yet → sign-up
          router.replace(`/signup?email=${encodeURIComponent(inviteeEmail)}`);
        }
      } catch {
        router.replace("/");
      }
    })();
  }, [token, router, isAuthenticated]);

  /* Minimal spinner while everything happens */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <HiArrowPath className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );
}
