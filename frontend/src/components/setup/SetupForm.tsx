import { useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { authApi } from "@/utils/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  User,
  CheckCircle,
  ArrowRight,
  Shield,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { SetupAdminData } from "@/types";

export function SetupForm() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const [formData, setFormData] = useState<SetupAdminData>({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    username: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (field: keyof SetupAdminData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (error) setError(null);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (error) setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      return "Please fill in all required fields";
    }

    if (formData.password.length < 8) {
      return "Password must be at least 8 characters long";
    }

    if (!confirmPassword) {
      return "Please confirm your password";
    }

    if (formData.password !== confirmPassword) {
      return "Passwords do not match";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email address";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.setupSuperAdmin(formData);

      if (response.access_token) {
        router.push("/dashboard");
      } else {
        router.push("/login?message=Registration successful! Please log in.");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to create super admin";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Success State
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="setup-success-container"
      >
        <div className="setup-success-content">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <CheckCircle className="setup-success-icon" />
          </motion.div>
          <h2 className="setup-success-title">Setup Complete!</h2>
          <p className="setup-success-message">
            Super admin account has been created successfully.
          </p>
          <div className="setup-success-redirect">
            <Loader2 className="setup-redirect-spinner" />
            <span>Redirecting to login page...</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="setup-form-container"
    >
      {/* Header */}
      <div className="setup-form-header flex justify-center items-center flex-col">
        {/* Mobile Logo */}
        <div className="setup-mobile-logo">
          <div className="setup-mobile-logo-icon">
            <Image
              src="/taskosaur-logo.svg"
              alt="Taskosaur Logo"
              width={50}
              height={50}
              className={`size-10 ${
                resolvedTheme === "light" ? "filter invert brightness-200" : ""
              }`}
            />
          </div>
        </div>

        <div className="setup-form-header-content">
          <div className="setup-shield-icon-container">
            <Shield className="setup-shield-icon" />
          </div>
          <h1 className="setup-form-title">
            <div className="md:hidden">
              Welcome to
              <span className="flex items-center justify-center">Taskosaur</span>
            </div>
            <span className="hidden md:block">First-Time Setup</span>
          </h1>
          <p className="setup-form-subtitle">Create your super admin account to get started</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="setup-error-alert">
            <AlertDescription className="font-medium">
              <span className="setup-error-title">Setup Failed</span>
              <span className="setup-error-message">{error}</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="setup-form">
        {/* Name Fields Row */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="setup-name-fields-row"
        >
          <div className="setup-field-container">
            <Label htmlFor="firstName" className="setup-field-label">
              <User className="setup-field-icon" />
              <span>First Name</span>
            </Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder="John"
              className="setup-input"
              disabled={isLoading}
            />
          </div>

          <div className="setup-field-container">
            <Label htmlFor="lastName" className="setup-field-label">
              <User className="setup-field-icon" />
              <span>Last Name</span>
            </Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Doe"
              className="setup-input"
              disabled={isLoading}
            />
          </div>
        </motion.div>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="setup-field-container"
        >
          <Label htmlFor="email" className="setup-field-label">
            <Mail className="setup-field-icon" />
            <span>Email Address</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="admin@company.com"
            className="setup-input"
            disabled={isLoading}
          />
        </motion.div>

        {/* Username Field (Optional) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="setup-field-container"
        >
          <Label htmlFor="username" className="setup-field-label">
            <User className="setup-field-icon" />
            <span>Username (Optional)</span>
          </Label>
          <Input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={(e) => handleInputChange("username", e.target.value)}
            placeholder="admin"
            className="setup-input"
            disabled={isLoading}
          />
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="setup-field-container"
        >
          <Label htmlFor="password" className="setup-field-label">
            <Lock className="setup-field-icon" />
            <span>Password</span>
          </Label>
          <div className="setup-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              placeholder="Enter a secure password"
              className="setup-password-input"
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPassword(!showPassword)}
              className="setup-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="setup-password-hint">Password must be at least 8 characters long</p>
        </motion.div>

        {/* Confirm Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="setup-field-container"
        >
          <Label htmlFor="confirmPassword" className="setup-field-label">
            <Lock className="setup-field-icon" />
            <span>Confirm Password</span>
          </Label>
          <div className="setup-password-container">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => handleConfirmPasswordChange(e.target.value)}
              placeholder="Re-enter your password"
              className="setup-password-input"
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="setup-password-toggle"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              disabled={isLoading}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Button type="submit" disabled={isLoading} className="setup-submit-button">
            {isLoading ? (
              <>
                <Loader2 className="setup-loading-spinner" />
                Creating Admin Account...
              </>
            ) : (
              <>
                Create Super Admin Account
                <ArrowRight className="setup-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="setup-footer"
      >
        <p className="setup-footer-text">
          This will create the first administrative user for your Taskosaur instance.
        </p>
      </motion.div>
    </motion.div>
  );
}
