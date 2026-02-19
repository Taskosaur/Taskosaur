// pages/invite/invalid.tsx
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  LogOut,
  Home
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { motion } from "framer-motion";

export default function InvalidInvitePage() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { msg } = router.query;
  const { isAuthenticated, logout } = useAuth();

  const errorMessage = (msg as string) || t("invite.invalidMessage");

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[var(--background)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[420px] space-y-8"
      >
        {/* Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-12 w-12 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-[var(--destructive)]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
              {t("invite.invalidTitle")}
            </h1>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              {errorMessage}
            </p>
          </div>
        </div>

        {/* Separator / Divider */}
        <div className="h-px w-full bg-[var(--border)]" />

        {/* Explanation */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {t("invite.whyHappened")}
          </p>
          <ul className="space-y-2">
            {[
              t("invite.reasonExpired"),
              t("invite.reasonEmail"),
              t("invite.reasonUsed")
            ].map((item, index) => (
              <li
                key={index}
                className="text-sm text-[var(--muted-foreground)] flex items-start gap-2"
              >
                <span className="w-1 h-1 rounded-full bg-[var(--muted-foreground)] mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {isAuthenticated() ? (
            <Button
              onClick={handleLogout}
              className="w-full h-10 font-medium"
              variant="default"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {t("invite.logout")}
            </Button>
          ) : (
            <Button
              onClick={() => router.push("/login")}
              className="w-full h-10 font-medium"
              variant="default"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("invite.login")}
            </Button>
          )}

          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="w-full h-10 font-medium bg-transparent border-[var(--border)] hover:bg-[var(--muted)]"
          >
            <Home className="h-4 w-4 mr-2" />
            {t("invite.home")}
          </Button>
        </div>
      </motion.div>

    </div>
  );
}
