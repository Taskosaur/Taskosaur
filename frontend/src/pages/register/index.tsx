import { useAuth } from "@/contexts/auth-context";
import AuthRedirect from "@/components/auth/AuthRedirect";
import { ModeToggle } from "@/components/header/ModeToggle";
import { RegisterContent } from "@/components/register/RegisterContent";
import { RegisterForm } from "@/components/register/RegisterForm";

export default function SignUpPage() {
  const { checkOrganizationAndRedirect } = useAuth();

  const redirectTo = async () => {
    return await checkOrganizationAndRedirect();
  };

  return (
    <AuthRedirect redirectTo={redirectTo}>
      <div className="signup-container">
        {/* Left Content Section - Exactly 50% */}
        <div className="signup-content-panel">
          <RegisterContent />
        </div>
        <div className="login-form-mode-toggle">
          <ModeToggle />
        </div>
        {/* Right Form Section - Exactly 50% */}
        <div className="signup-form-panel">
          <div className="signup-form-wrapper">
            <RegisterForm />
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
}
