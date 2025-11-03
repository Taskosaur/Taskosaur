import { useAuth } from "@/contexts/auth-context";
import AuthRedirect from "@/components/auth/AuthRedirect";
import { useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { LoginContent } from "@/components/login/LoginContent";
import { ModeToggle } from "@/components/header/ModeToggle";
import { ForgotPasswordData } from "@/types";

function ForgotPasswordForm() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const requestData: ForgotPasswordData = {
        email: email.trim(),
      };

      const response = await forgotPassword(requestData);

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.message || "Failed to send reset email. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      if (error) setError("");
    },
    [error]
  );

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
            <h1 className="login-form-title">Check your email</h1>
            <p className="login-form-subtitle">We've sent a password reset link to {email}</p>
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
              <span className="login-error-title text-green-800 dark:text-green-200">
                Email Sent Successfully
              </span>
              <span className="login-error-message text-green-700 dark:text-green-300">
                Please check your inbox and click the reset link.
              </span>
            </AlertDescription>
          </Alert>
        </motion.div>

        {/* Back to Login */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Link href="/login">
            <Button variant="outline" className="login-signup-button">
              <ArrowLeft className="login-button-arrow" />
              Back to Sign In
            </Button>
          </Link>
        </motion.div>

        {/* Try Different Email */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            variant="outline"
            onClick={() => {
              setIsSuccess(false);
              setEmail("");
              setError("");
            }}
            className="login-signup-button"
          >
            Try Different Email
            <ArrowRight className="login-button-arrow" />
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="login-footer"
        >
          <p className="login-footer-text">
            Didn't receive the email? Check your spam folder or{" "}
            <Link href="/support" className="login-footer-link">
              contact support
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
          <h1 className="login-form-title">Reset your password</h1>
          <p className="login-form-subtitle">
            Enter your email address and we'll send you a reset link
          </p>
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
              <span className="login-error-title">Reset Failed</span>
              <span className="login-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="login-form">
        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="login-field-container"
        >
          <Label htmlFor="email" className="login-field-label">
            <Mail className="login-field-icon" />
            <span>Email Address</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={handleChange}
            placeholder="Enter your email address"
            className="login-input"
          />
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="login-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="login-loading-spinner" />
                Sending reset link...
              </>
            ) : (
              <>
                Send Reset Link
                <ArrowRight className="login-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="login-divider-container"
      >
        <div className="login-divider-line">
          <div className="login-divider-border" />
        </div>
        <div className="login-divider-text-container">
          <span className="login-divider-text">Remember your password?</span>
        </div>
      </motion.div>

      {/* Back to Login Link */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Link href="/login">
          <Button variant="outline" className="login-signup-button">
            <ArrowLeft className="login-button-arrow" />
            Back to Sign In
          </Button>
        </Link>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="login-footer"
      >
        <p className="login-footer-text">
          Need help?{" "}
          <Link href="/support" className="login-footer-link">
            Contact our support team
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function ForgotPasswordPage() {
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
              <ForgotPasswordForm />
            </div>
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
}
