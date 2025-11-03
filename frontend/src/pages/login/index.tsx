import { useAuth } from "@/contexts/auth-context";
import AuthRedirect from "@/components/auth/AuthRedirect";
import { ModeToggle } from "@/components/header/ModeToggle";
import { LoginContent } from "@/components/login/LoginContent";
import { LoginForm } from "@/components/login/LoginForm";

export default function LoginPage() {
  const { checkOrganizationAndRedirect } = useAuth();

  const redirectTo = async () => {
    return await checkOrganizationAndRedirect();
  };

  return (
    <AuthRedirect redirectTo={redirectTo}>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="login-container">
          <div className="login-content-panel hidden md:block">
            <LoginContent />
          </div>
          <div className="login-form-mode-toggle">
            <ModeToggle />
          </div>
          <div className="login-form-panel">
            <div className="login-form-wrapper">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
}
