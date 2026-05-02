import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api, { TokenManager } from "@/lib/api";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { invitationApi } from "@/utils/api/invitationsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Sparkle, Shield } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export function LoginForm() {
  const { login, checkOrganizationAndRedirect } = useAuth();
  const router = useRouter();
  const redirectParam = router.query.redirect as string | undefined;
  const { resolvedTheme } = useTheme();

  const [formData, setFormData] = useState<FormData>({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [ssoConfig, setSsoConfig] = useState<{ enabled: boolean; configured: boolean; providerName: string } | null>(null);

  useEffect(() => {
    api.get("/auth/registration-status")
      .then((res) => setRegistrationEnabled(res.data?.enabled !== false))
      .catch(() => setRegistrationEnabled(true));

    api.get("/auth/oidc/config")
      .then((res) => setSsoConfig(res.data))
      .catch(() => setSsoConfig(null));

    // Handle SSO callback — exchange httpOnly cookie for tokens securely
    const params = new URLSearchParams(window.location.search);
    if (params.get("sso") === "callback") {
      // Clean URL immediately
      window.history.replaceState({}, document.title, "/login");

      api.post("/auth/oidc/exchange")
        .then(async (res) => {
          const { access_token, refresh_token, user } = res.data;
          if (access_token && refresh_token) {
            TokenManager.setAccessToken(access_token);
            TokenManager.setRefreshToken(refresh_token);
            if (user) localStorage.setItem("user", JSON.stringify(user));
            // Use org check to determine correct redirect (dashboard vs organization)
            const redirectPath = await checkOrganizationAndRedirect();
            window.location.href = redirectPath;
          } else {
            setError("Failed to process SSO login");
          }
        })
        .catch(() => setError("SSO authentication failed. Please try again."));
    }

    const ssoError = params.get("error");
    if (ssoError === "sso_failed" || ssoError === "sso_invalid_state") {
      window.history.replaceState({}, document.title, "/login");
      setError(params.get("message") || "SSO authentication failed. Please try again.");
    }
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await login({ email: formData.email, password: formData.password });

      // Accept pending invitation if one is waiting
      const pendingToken = localStorage.getItem("pendingInvitation");
      if (pendingToken) {
        await invitationApi.acceptInvitation(pendingToken).catch(() => {});
        localStorage.removeItem("pendingInvitation");
      }

      // Resolve redirect: URL param → localStorage fallback → org-based default
      const destination =
        redirectParam ||
        localStorage.getItem("pendingRedirect") ||
        (await checkOrganizationAndRedirect());
      localStorage.removeItem("pendingRedirect");
      router.push(destination);
    } catch (err) {
      setError("Invalid email or password. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="login-form-container"
    >
      {/* Header */}
      <div className="signup-form-header  flex justify-center items-center flex-col">
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

        <div className="login-form-header-content">
          <h1 className="login-form-title">
            {/* Show as flex row on max-md, block on md+ */}
            <div className="md:hidden">
              Welcome back to
              <span className="flex items-center justify-center ">Taskosaur </span>
            </div>

            {/* Block for md+ */}
            <span className="hidden md:block">Welcome back</span>
          </h1>
          <p className="login-form-subtitle">Login to continue your productive journey</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <Alert variant="destructive" className="login-error-alert">
            <AlertDescription className="font-medium">
              <span className="login-error-title">Authentication Failed</span>
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
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email address"
            className="login-input"
          />
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="login-field-container"
        >
          <Label htmlFor="password" className="login-field-label">
            <Lock className="login-field-icon" />
            <span>Password</span>
          </Label>
          <div className="login-password-container">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
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
        </motion.div>

        {/* Options Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="login-options-row"
        >
          <div className="login-remember-me-container">
            <Checkbox
              id="rememberMe"
              name="rememberMe"
              checked={formData.rememberMe}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  rememberMe: Boolean(checked),
                }))
              }
              className="login-remember-me-checkbox"
            />
            <Label htmlFor="rememberMe" className="login-remember-me-label">
              Remember me
            </Label>
          </div>
          <Link href="/forgot-password" className="login-forgot-password-link">
            Forgot password?
          </Link>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button type="submit" disabled={isLoading} className="login-submit-button">
            {isLoading ? (
              <>
                <Loader2 className="login-loading-spinner" />
                Logging you in...
              </>
            ) : (
              <>
                Log In
                <ArrowRight className="login-button-arrow" />
              </>
            )}
          </Button>
        </motion.div>
      </form>

      {/* SSO Login Button */}
      {ssoConfig?.enabled && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="login-divider-container"
          >
            <div className="login-divider-text-container">
              <span className="login-divider-text">Or continue with</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Button
              type="button"
              variant="outline"
              className="login-signup-button"
              disabled={!ssoConfig.configured}
              onClick={() => {
                if (ssoConfig.configured) {
                  window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api"}/auth/oidc/login`;
                }
              }}
            >
              <Shield className="w-4 h-4 mr-2" />
              {ssoConfig.providerName || "Sign in with SSO"}
              {!ssoConfig.configured && (
                <span className="text-xs ml-1 opacity-60">(not configured)</span>
              )}
            </Button>
          </motion.div>
        </>
      )}

      {/* Divider + Sign Up Link (only when registration is enabled) */}
      {registrationEnabled && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="login-divider-container"
          >
            <div className="login-divider-line">
              <div className="login-divider-border" />
            </div>
            <div className="login-divider-text-container">
              <span className="login-divider-text">New to Taskosaur?</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Link href="/register">
              <Button variant="outline" className="login-signup-button">
                Create New Account
                <ArrowRight className="login-button-arrow" />
              </Button>
            </Link>
          </motion.div>
        </>
      )}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="login-footer"
      >
        <p className="login-footer-text">
          By signing in, you agree to our{" "}
          <Link href="/terms-of-service" className="login-footer-link">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="login-footer-link">
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
