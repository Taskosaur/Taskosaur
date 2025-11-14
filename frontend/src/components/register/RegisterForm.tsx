import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image";
import {
  Eye,
  EyeOff,
  AlertCircle,
  UserPlus,
  Loader2,
  Mail,
  Lock,
  User,
  CheckCircle2,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export function RegisterForm() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const searchParams = useSearchParams();
  const { register } = useAuth();
  const initialEmail = searchParams.get("email") ?? "";
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: initialEmail,
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
      if (error) setError("");
    },
    [error]
  );

  // Password validation helpers
  const isPasswordLongEnough = formData.password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(formData.password);
  const hasLowerCase = /[a-z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const passwordsMatch =
    formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
  const isPasswordValid = isPasswordLongEnough && hasUpperCase && hasLowerCase && hasNumber;

  // All required fields check
  const allFieldsFilled = [
    formData.firstName,
    formData.lastName,
    formData.email,
    formData.password,
    formData.confirmPassword,
  ].every((field) => typeof field === "string" && field.trim().length > 0);

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

    if (!formData.acceptTerms) {
      setError("You must accept the terms and conditions");
      setIsLoading(false);
      return;
    }

    try {
      const userData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      };

      const response = await register(userData);

      if (response.access_token) {
        router.push("/dashboard");
      } else {
        router.push("/login?message=Registration successful! Please log in.");
      }
    } catch (err: any) {
      if (err.message) {
        setError(err.message);
      } else {
        setError("An error occurred during registration. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="signup-form-container"
    >
      {/* Header */}
      <div className="signup-form-header">
        {/* Mobile Logo */}
        <div className="signup-mobile-logo">
          <div className="signup-mobile-logo-icon">
            <Image
              src="/taskosaur-logo.svg"
              alt="Taskosaur Logo"
              width={50}
              height={50}
              className={`size-10 ${
                resolvedTheme === "light" ? " filter invert brightness-200" : ""
              }`}
            />
          </div>
        </div>

        <h1 className="signup-form-title">Create Account</h1>
        <p className="signup-form-subtitle">Join thousands of teams using Taskosaur</p>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="mb-6"
        >
          <Alert variant="destructive" className="signup-error-alert">
            <AlertCircle className="signup-error-icon" />
            <AlertDescription className="font-medium">
              <span className="signup-error-title">Registration Failed</span>
              <span className="signup-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="signup-form">
        {/* Name Fields */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="signup-name-fields"
        >
          <div className="signup-field-container">
            <Label htmlFor="firstName" className="signup-field-label">
              <User className="signup-field-icon" />
              <span>First Name</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
              className="signup-input"
            />
          </div>
          <div className="signup-field-container">
            <Label htmlFor="lastName" className="signup-field-label-simple">
              Last Name
            </Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              className="signup-input"
            />
          </div>
        </motion.div>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="signup-field-container"
        >
          <Label htmlFor="email" className="signup-field-label">
            <Mail className="signup-field-icon" />
            <span>Email Address</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="john.doe@company.com"
            className="signup-input"
          />
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="signup-field-container"
        >
          <Label htmlFor="password" className="signup-field-label">
            <Lock className="signup-field-icon" />
            <span>Password</span>
          </Label>
          <div className="signup-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              className={`signup-password-input ${
                formData.password && !isPasswordValid ? "border-red-500 ring-1 ring-red-500" : ""
              }`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="signup-password-toggle"
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
                <Shield className="signup-field-icon" />
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
          transition={{ duration: 0.5, delay: 0.4 }}
          className="signup-field-container"
        >
          <Label htmlFor="confirmPassword" className="signup-field-label">
            <Lock className="signup-field-icon" />
            <span>Confirm Password</span>
          </Label>
          <div className="signup-password-container">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              className={`signup-password-input ${
                formData.confirmPassword && !passwordsMatch
                  ? "border-red-500 ring-1 ring-red-500"
                  : ""
              }`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="signup-password-toggle"
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

        {/* Terms Checkbox */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="signup-terms-container"
        >
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            checked={formData.acceptTerms}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                acceptTerms: Boolean(checked),
              }))
            }
            required
            className="signup-terms-checkbox"
          />
          <Label htmlFor="acceptTerms" className="signup-terms-label">
            I agree to the{" "}
            <Link href="/terms-of-service" className="signup-terms-link">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="signup-terms-link">
              Privacy Policy
            </Link>
          </Label>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Button
            type="submit"
            disabled={
              isLoading ||
              !allFieldsFilled ||
              !isPasswordValid ||
              !passwordsMatch ||
              !formData.acceptTerms
            }
            className="signup-submit-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="signup-loading-spinner" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight className="signup-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="signup-divider-container"
      >
        <div className="signup-divider-inner">
          <div className="signup-divider-line">
            <div className="signup-divider-border" />
          </div>
          <div className="signup-divider-text-container">
            <span className="signup-divider-text">Already have an account?</span>
          </div>
        </div>
      </motion.div>

      {/* Sign In Link */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Link href="/login">
          <Button variant="outline" className="signup-signin-button">
            Log In to Existing Account
            <ArrowRight className="signup-button-arrow" />
          </Button>
        </Link>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="signup-footer"
      >
        <p className="signup-footer-text">
          By creating an account, you agree to our{" "}
          <Link href="/terms-of-service" className="signup-footer-link">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="signup-footer-link">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
