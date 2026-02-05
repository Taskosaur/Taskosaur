import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/common/ActionButton";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function isValidPassword(password: string) {
  return true;
  // return (
  //   password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  // );
}

const extractErrorMessage = (response: any, t: any) => {
  if (response?.message?.message) return response.message.message;
  if (typeof response?.message === "string") return response.message;
  if (Array.isArray(response?.message)) return response.message.join(", ");
  return t("password_section.failed");
};

export default function ResetPasswordSection() {
  const { t } = useTranslation("settings");
  const { changePassword } = useAuth();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });

    if (!isValidPassword(form.newPassword)) {
      setErrors((prev) => ({
        ...prev,
        newPassword: t("password_section.requirement"),
      }));
      setLoading(false);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: t("password_section.not_match"),
      }));
      setLoading(false);
      return;
    }

    try {
      const response = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      if (response.success) {
        toast.success(t("password_section.success"));
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const errorMsg = extractErrorMessage(response, t);
        if (errorMsg.toLowerCase().includes("current password")) {
          setErrors((prev) => ({ ...prev, currentPassword: errorMsg }));
        } else if (errorMsg.toLowerCase().includes("new password")) {
          setErrors((prev) => ({ ...prev, newPassword: errorMsg }));
        } else {
          toast.error(errorMsg);
        }
      }
    } catch {
      toast.error(t("password_section.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-none bg-[var(--card)] gap-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-[var(--foreground)]">
          {t("password_section.title")}
        </CardTitle>
        <CardDescription className="text-[13px] text-[var(--muted-foreground)] tracking-wide">
          {t("password_section.description")}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Current Password */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-[var(--foreground)]">
                {t("password_section.current")} <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  placeholder={t("password_section.current_placeholder")}
                  className={`h-8 text-xs bg-[var(--background)] border-[var(--border)] ${
                    errors.currentPassword ? "ring-2 ring-red-500" : ""
                  }`}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-red-500">{errors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-[var(--foreground)]">
                {t("password_section.new")} <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  placeholder={t("password_section.new_placeholder")}
                  className={`h-8 text-xs bg-[var(--background)] border-[var(--border)] ${
                    errors.newPassword ? "ring-2 ring-red-500" : ""
                  }`}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.newPassword ? (
                <p className="text-xs text-red-500">{errors.newPassword}</p>
              ) : (
                <p className="text-[13px] ml-2 text-[var(--muted-foreground)]">
                  {t("password_section.requirement")}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <Label className="text-sm font-medium text-[var(--foreground)]">
                {t("password_section.confirm")} <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder={t("password_section.confirm_placeholder")}
                  className={`h-8 text-xs bg-[var(--background)] border-[var(--border)] ${
                    errors.confirmPassword ? "ring-2 ring-red-500" : ""
                  }`}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <ActionButton
              type="submit"
              disabled={loading}
              primary
              className="h-8 px-3 text-sm border-none w-[215px]"
            >
              {loading ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {t("password_section.updating")}
                </div>
              ) : (
                t("password_section.update_button")
              )}
            </ActionButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
