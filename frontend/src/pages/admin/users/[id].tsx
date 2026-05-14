import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { formatDateTimeForDisplay } from "@/utils/date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { HiUser } from "react-icons/hi2";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const GLOBAL_ROLES = ["SUPER_ADMIN", "MEMBER"];

function UserDetailContent() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    const fetch = async () => {
      try {
        const data = await adminApi.getUserDetail(id);
        setUser(data);
      } catch (error) {
        console.error("Failed to fetch user:", error);
        toast.error(t("common.error_loading"));
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [id, t]);

  const handleRoleChange = async (role: string) => {
    try {
      await adminApi.updateUserRole(user.id, role);
      setUser((prev: any) => ({ ...prev, role }));
      toast.success(t("common.success"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await adminApi.updateUserStatus(user.id, newStatus);
      setUser((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(t("common.success"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleResetPassword = async () => {
    try {
      const result = await adminApi.resetUserPassword(user.id);
      if (result.resetLink) {
        await navigator.clipboard.writeText(window.location.origin + result.resetLink);
        toast.success(t("users.actions.reset_password_link_copied", { name: user.firstName }));
      } else {
        toast.success(result.message);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("users.actions.delete_confirmation", { name: `${user.firstName} ${user.lastName}` }))) {
      return;
    }
    try {
      await adminApi.deleteUser(user.id);
      toast.success(t("users.actions.user_removed", { name: user.firstName }));
      router.push("/admin/users");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-[var(--card)] border-none shadow-sm">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="bg-[var(--card)] border-none shadow-sm">
        <CardContent className="p-8 text-center">
          <HiUser className="w-10 h-10 mx-auto text-[var(--muted-foreground)] mb-3" />
          <p className="text-sm text-[var(--muted-foreground)]">{t("users.no_users")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* User Header Card */}
      <Card className="bg-[var(--card)] border-none shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 flex items-center justify-center text-[var(--primary-foreground)] text-xl font-bold flex-shrink-0">
              {user.firstName?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge className={`text-[10px] px-1.5 py-0 rounded-md border ${
                  user.role === "SUPER_ADMIN"
                    ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                    : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                }`}>
                  {t(`users.roles.${user.role.toLowerCase()}`, user.role) as string}
                </Badge>
                <Badge className={`text-[10px] px-1.5 py-0 rounded-md border ${
                  user.status === "ACTIVE"
                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                }`}>
                  {t(`users.status.${user.status.toLowerCase()}`, user.status) as string}
                </Badge>
                {user.source === "SSO" && (
                  <Badge className="text-[10px] px-1.5 py-0 rounded-md bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800">
                    SSO
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-[var(--muted-foreground)]">{t("users.details.last_login") as string}</p>
              <p className="text-xs font-medium text-[var(--foreground)]">
                {user.lastLoginAt ? formatDateTimeForDisplay(user.lastLoginAt) : t("users.details.never") as string}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Info + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-[var(--card)] border-none shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4 text-[var(--foreground)]">{t("users.details.profile_info") as string}</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: t("users.details.timezone"), value: user.timezone },
                { label: t("users.details.language"), value: user.language },
                { label: t("users.details.email_verified"), value: user.emailVerified ? t("users.details.yes") : t("users.details.no") },
                { label: t("users.details.source"), value: user.source },
                { label: t("users.table.created"), value: formatDateTimeForDisplay(user.createdAt) },
                { label: t("users.table.organizations"), value: user.organizationMembers?.length > 1 ? t("users.details.membership_count_plural", { count: user.organizationMembers?.length }) as string : t("users.details.membership_count", { count: user.organizationMembers?.length || 0 }) as string },
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-xs text-[var(--muted-foreground)]">{item.label}</span>
                  <p className="text-sm font-medium text-[var(--foreground)]">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--card)] border-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("users.details.actions") as string}</h3>
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">{t("users.table.role") as string}</label>
              <Select value={user.role} onValueChange={handleRoleChange}>
                <SelectTrigger className="h-9 border-none bg-[var(--background)] shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--popover)]">
                  {GLOBAL_ROLES.map((r) => <SelectItem key={r} value={r}>{t(`users.roles.${r.toLowerCase()}`, r) as string}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">{t("users.table.status") as string}</label>
              <div className="flex items-center gap-3">
                <Badge className={`text-xs px-2 py-1 rounded-md border ${
                  user.status === "ACTIVE"
                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                }`}>
                  {t(`users.status.${user.status.toLowerCase()}`, user.status) as string}
                </Badge>
                <Button
                  variant="outline"
                  className={`h-7 text-xs border-none transition-all duration-200 ${
                    user.status === "ACTIVE"
                      ? "bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)]"
                      : "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400"
                  }`}
                  onClick={handleStatusToggle}
                >
                  {user.status === "ACTIVE" ? t("users.actions.deactivate") as string : t("users.actions.activate") as string}
                </Button>
              </div>
            </div>

            {/* Reset Password */}
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">{t("users.actions.reset_password") as string}</label>
              <Button
                variant="outline"
                className="h-9 w-full border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
                onClick={handleResetPassword}
              >
                {t("users.actions.reset_password") as string}
              </Button>
            </div>

            {/* Delete */}
            <div className="space-y-2 pt-3 border-t border-[var(--border)]">
              <label className="text-xs text-[var(--muted-foreground)]">{t("users.details.danger_zone") as string}</label>
              <Button
                variant="outline"
                className="h-9 w-full border-none bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)] transition-all duration-200"
                onClick={handleDelete}
              >
                {t("users.actions.delete") as string}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Memberships */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {t("users.details.memberships") as string} ({user.organizationMembers?.length || 0})
        </h3>
        {user.organizationMembers?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {user.organizationMembers.map((membership: any) => (
              <Card
                key={membership.organization.id}
                className="bg-[var(--card)] border-none shadow-sm group hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => router.push(`/admin/organizations/${membership.organization.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 flex items-center justify-center text-[var(--primary-foreground)] font-semibold text-sm">
                      {membership.organization.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors truncate">
                        {membership.organization.name}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">{membership.organization.slug}</p>
                    </div>
                    <Badge className="text-xs px-2 py-1 rounded-md border-none bg-[var(--accent)] text-[var(--accent-foreground)]">
                      {membership.role}
                    </Badge>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs text-[var(--muted-foreground)]">
                    <span>{membership.organization._count?.members || 0} {t("organizations.details.members")}</span>
                    <span>{membership.organization._count?.workspaces || 0} {t("organizations.details.workspaces")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">{t("users.details.no_memberships") as string}</p>
        )}
      </div>
    </>
  );
}

export default function AdminUserDetailPage() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const { id } = router.query;

  return (
    <AdminLayout
      breadcrumbs={[
        { label: t("navigation.users") as string, href: "/admin/users" },
        { label: typeof id === "string" ? t("users.actions.view_details") as string : "..." },
      ]}
    >
      <UserDetailContent />
    </AdminLayout>
  );
}
