// pages/invite/invalid.tsx
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HiExclamationTriangle, HiArrowLeft } from "react-icons/hi2";
import { useAuth } from "@/contexts/auth-context";
import { HiOutlineLogout } from "react-icons/hi";

export default function InvalidInvitePage() {
  const router = useRouter();
  const { msg } = router.query;
  const { isAuthenticated, logout } = useAuth();

  const errorMessage = (msg as string) || "Invalid or expired invitation link";

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="py-8 px-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <HiExclamationTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl font-bold">Invalid Invitation</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <HiExclamationTriangle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>

          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <p>This could happen if:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>The invitation was sent to a different email address</li>
              <li>The invitation link has expired</li>
              <li>The invitation has already been used or cancelled</li>
            </ul>
          </div>

          <div className="space-y-3">
            {isAuthenticated() ? (
              <Button
                onClick={handleLogout}
                variant="destructive"
                className="w-full"
              >
                <HiOutlineLogout className="h-4 w-4 mr-2" />
                Logout and Switch Account
              </Button>
            ) : (
              <Button
                onClick={() => router.push("/login")}
                variant="outline"
                className="w-full"
              >
                <HiArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            )}

            <Button
              onClick={() => router.push("/dashboard")}
              variant="ghost"
              className="w-full"
            >
              Go to Home
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact your administrator or the person who sent you the invitation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
