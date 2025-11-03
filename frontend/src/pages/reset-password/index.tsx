import { useAuth } from "@/contexts/auth-context";
import AuthRedirect from "@/components/auth/AuthRedirect";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  ArrowRight,
  Shield,
} from "lucide-react";
import { LoginContent } from "@/components/login/LoginContent";
import { ModeToggle } from "@/components/header/ModeToggle";
import { ResetPasswordData } from "@/types";

function ResetPasswordForm() {
  const router = useRouter();
  const { token } = router.query;
  const { resetPassword, validateResetToken } = useAuth();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);

  // Password validation helpers
  const isPasswordLongEnough = formData.password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(formData.password);
  const hasLowerCase = /[a-z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const passwordsMatch =
    formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
  const isPasswordValid = isPasswordLongEnough && hasUpperCase && hasLowerCase && hasNumber;

  useEffect(() => {
    // Validate token on component mount
    const checkToken = async () => {
      if (!token || typeof token !== "string") {
        setIsValidToken(false);
        setError("Invalid or missing reset token");
        return;
      }

      try {
        const response: any = await validateResetToken(token);
        if (response) {
          setIsValidToken(response?.valid);
        } else {
          setIsValidToken(false);
          setError(response.message || "Invalid or expired reset token");
        }
      } catch (err: any) {
        setIsValidToken(false);
        setError(err.message || "Failed to validate reset token");
      }
    };

    if (token) {
      checkToken();
    }
  }, [token]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      if (error) setError("");
    },
    [error]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!isPasswordValid) {
      setError("Password must meet all requirements");
      setIsLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (!token || typeof token !== "string") {
      setError("Invalid reset token");
      setIsLoading(false);
      return;
    }

    try {
      const resetData: ResetPasswordData = {
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      };

      const response = await resetPassword(resetData);

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.message || "Failed to reset password. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  if (!isValidToken) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="login-form-container"
      >
        {/* Invalid Token Header */}
        <div className="login-form-header">
          <div className="login-form-header-content">
            <h1 className="login-form-title">Invalid Reset Link</h1>
            <p className="login-form-subtitle">
              This password reset link is invalid or has expired
            </p>
          </div>
        </div>

        {/* Error Alert */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="login-error-alert">
            <AlertCircle className="login-field-icon" />
            <AlertDescription className="font-medium">
              <span className="login-error-title">Reset Link Expired</span>
              <span className="login-error-message">
                This link may have expired or been used already. Password reset links are only valid
                for 24 hours.
              </span>
            </AlertDescription>
          </Alert>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/forgot-password">
            <Button className="login-submit-button">
              Request New Reset Link
              <ArrowRight className="login-button-arrow" />
            </Button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link href="/login">
            <Button variant="outline" className="login-signup-button">
              Back to Sign In
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="login-form-container"
      >
        {/* Success Header */}
        <div className="login-form-header">
          <div className="login-form-header-content">
            <h1 className="login-form-title">Password Reset Successful</h1>
            <p className="login-form-subtitle">Your password has been successfully updated</p>
          </div>
        </div>

        {/* Success Alert */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert className="login-error-alert border-green-200 bg-green-50 text-green-800 dark:border-green-800/30 dark:bg-green-900/20">
            <CheckCircle2 className="login-field-icon text-green-600" />
            <AlertDescription className="font-medium">
              <span className="login-error-title text-green-800 dark:text-green-200">All Set!</span>
              <span className="login-error-message text-green-700 dark:text-green-300">
                Your password has been successfully reset. You can now sign in with your new
                password.
              </span>
            </AlertDescription>
          </Alert>
        </motion.div>

        {/* Sign In Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/login">
            <Button className="login-submit-button">
              Sign In Now
              <ArrowRight className="login-button-arrow" />
            </Button>
          </Link>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-footer"
        >
          <p className="login-footer-text">
            Having trouble signing in?{" "}
            <Link href="/support" className="login-footer-link">
              Contact support
            </Link>
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="login-form-container"
    >
      {/* Header */}
      <div className="login-form-header">
        <div className="login-form-header-content">
          <h1 className="login-form-title">Set New Password</h1>
          <p className="login-form-subtitle">Create a strong password for your account</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="login-error-alert">
            <AlertCircle className="login-field-icon" />
            <AlertDescription className="font-medium">
              <span className="login-error-title">Password Reset Failed</span>
              <span className="login-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="login-form">
        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="login-field-container"
        >
          <Label htmlFor="password" className="login-field-label">
            <Lock className="login-field-icon" />
            <span>New Password</span>
          </Label>
          <div className="login-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              className="login-password-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="login-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>

          {/* Password Requirements */}
          {formData.password && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="signup-password-requirements"
            >
              <p className="signup-requirements-header">
                <Shield className="login-field-icon" />
                <span>Password Requirements:</span>
              </p>
              <div className="signup-requirements-grid">
                <div
                  className={`signup-requirement-item ${
                    isPasswordLongEnough ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      isPasswordLongEnough
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>8+ characters</span>
                </div>
                <div
                  className={`signup-requirement-item ${
                    hasUpperCase ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      hasUpperCase
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>Uppercase letter</span>
                </div>
                <div
                  className={`signup-requirement-item ${
                    hasLowerCase ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      hasLowerCase
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>Lowercase letter</span>
                </div>
                <div
                  className={`signup-requirement-item ${
                    hasNumber ? "signup-requirement-valid" : "signup-requirement-invalid"
                  }`}
                >
                  <CheckCircle2
                    className={
                      hasNumber
                        ? "signup-requirement-icon-valid"
                        : "signup-requirement-icon-invalid"
                    }
                  />
                  <span>Number</span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Confirm Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-field-container"
        >
          <Label htmlFor="confirmPassword" className="login-field-label">
            <Lock className="login-field-icon" />
            <span>Confirm New Password</span>
          </Label>
          <div className="login-password-container">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your new password"
              className="login-password-input"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="login-password-toggle"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {formData.confirmPassword && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`signup-password-match ${
                passwordsMatch ? "signup-password-match-valid" : "signup-password-match-invalid"
              }`}
            >
              <CheckCircle2
                className={
                  passwordsMatch
                    ? "signup-password-match-icon-valid"
                    : "signup-password-match-icon-invalid"
                }
              />
              <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
            </motion.div>
          )}
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button
            type="submit"
            disabled={isLoading || !isPasswordValid || !passwordsMatch}
            className="login-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="login-loading-spinner" />
                Updating password...
              </>
            ) : (
              <>
                Reset Password
                <ArrowRight className="login-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="login-footer"
      >
        <p className="login-footer-text">
          Remember your password?{" "}
          <Link href="/login" className="login-footer-link">
            Back to Sign In
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  const { checkOrganizationAndRedirect } = useAuth();

  const redirectTo = async () => {
    return await checkOrganizationAndRedirect();
  };

  return (
    <AuthRedirect redirectTo={redirectTo}>
      <div className="min-h-screen bg-[var(--background)]">
        <div className="min-h-screen flex bg-[var(--background)]">
          <div className="lg:w-1/2 relative">
            <LoginContent />
          </div>
          <div className="login-form-mode-toggle">
            <ModeToggle />
          </div>
          <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
            <div className="w-full max-w-md">
              <ResetPasswordForm />
            </div>
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
}
