import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { formatDateForDisplay, formatDateTimeForDisplay } from "@/utils/date";
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
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function OrgDetailContent() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const { id } = router.query;
  const [org, setOrg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transferTarget, setTransferTarget] = useState<string>("");

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    const fetch = async () => {
      try {
        const data = await adminApi.getOrganizationDetail(id);
        setOrg(data);
      } catch (error) {
        console.error("Failed to fetch organization:", error);
        toast.error(t("common.error_loading"));
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [id, t]);

  const handleToggleArchive = async () => {
    try {
      const updated = await adminApi.toggleOrganizationArchive(org.id);
      setOrg((prev: any) => ({ ...prev, archive: updated.archive }));
      toast.success(t("common.success"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("common.confirmation.title"))) {
      return;
    }
    try {
      await adminApi.deleteOrganization(org.id);
      toast.success(t("common.success"));
      router.push("/admin/organizations");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) return;
    if (!window.confirm(t("organizations.actions.transfer_confirmation"))) {
      return;
    }
    try {
      const updated = await adminApi.transferOrganizationOwnership(org.id, transferTarget);
      setOrg((prev: any) => ({ ...prev, owner: updated.owner }));
      setTransferTarget("");
      toast.success(t("common.success"));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-[var(--card)] border-none shadow-sm">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-12 w-12 rounded-md" />
          <Skeleton className="h-5 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (!org) {
    return <p className="text-sm text-[var(--muted-foreground)]">{t("common.no_results") as string}</p>;
  }

  // Members eligible for ownership transfer (exclude current owner)
  const transferCandidates = org.members?.filter(
    (m: any) => m.user.id !== org.owner?.id
  ) || [];

  return (
    <>
      {/* Org Info + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-[var(--card)] border-none shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4 text-[var(--foreground)]">{t("organizations.details.information") as string}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t("organizations.table.owner"), value: org.owner ? `${org.owner.firstName} ${org.owner.lastName}` : "—", sub: org.owner?.email },
                { label: t("organizations.details.members"), value: org._count?.members || 0 },
                { label: t("organizations.details.workspaces"), value: org._count?.workspaces || 0 },
                { label: t("organizations.table.created"), value: formatDateForDisplay(org.createdAt) },
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-xs text-[var(--muted-foreground)]">{item.label}</span>
                  <p className="text-sm font-medium text-[var(--foreground)]">{item.value}</p>
                  {"sub" in item && item.sub && (
                    <p className="text-xs text-[var(--muted-foreground)]">{item.sub}</p>
                  )}
                </div>
              ))}
            </div>
            {org.description && (
              <p className="text-xs text-[var(--muted-foreground)] mt-4">{org.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Actions Panel */}
        <Card className="bg-[var(--card)] border-none shadow-sm">
          <CardContent className="p-6 space-y-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("users.details.actions") as string}</h3>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs text-[var(--muted-foreground)]">{t("users.table.status") as string}</label>
              <div className="flex items-center gap-3">
                <Badge className={`text-xs px-2 py-1 rounded-md border ${
                  org.archive
                    ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                    : "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                }`}>
                  {org.archive ? t("users.status.suspended") as string : t("users.status.active") as string}
                </Badge>
                <Button
                  variant="outline"
                  className={`h-7 text-xs border-none transition-all duration-200 ${
                    org.archive
                      ? "bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-400"
                      : "bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)]"
                  }`}
                  onClick={handleToggleArchive}
                >
                  {org.archive ? t("users.actions.activate") as string : t("users.actions.suspend") as string}
                </Button>
              </div>
            </div>

            {/* Transfer Ownership */}
            {transferCandidates.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-[var(--muted-foreground)]">{t("organizations.actions.transfer_ownership") as string}</label>
                <Select value={transferTarget} onValueChange={setTransferTarget}>
                  <SelectTrigger className="h-9 border-none bg-[var(--background)] shadow-sm">
                    <SelectValue placeholder={t("organizations.actions.select_new_owner") as string} />
                  </SelectTrigger>
                  <SelectContent className="border-none bg-[var(--popover)]">
                    {transferCandidates.map((m: any) => (
                      <SelectItem key={m.user.id} value={m.user.id}>
                        {m.user.firstName} {m.user.lastName} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {transferTarget && (
                  <Button
                    className="h-9 w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-all duration-200 font-medium rounded-lg shadow-none border-none"
                    onClick={handleTransferOwnership}
                  >
                    {t("organizations.actions.transfer") as string}
                  </Button>
                )}
              </div>
            )}

            {/* Delete */}
            <div className="space-y-2 pt-3 border-t border-[var(--border)]">
              <label className="text-xs text-[var(--muted-foreground)]">{t("organizations.details.danger_zone") as string}</label>
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

      {/* Members */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("organizations.details.members") as string} ({org.members?.length || 0})</h3>
        <Card className="bg-[var(--card)] border-none shadow-sm">
          <CardContent className="p-0">
            {org.members?.length > 0 ? (
              <div>
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <div className="grid grid-cols-12 gap-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                    <div className="col-span-5">{t("users.table.user") as string}</div>
                    <div className="col-span-3">{t("users.table.role") as string}</div>
                    <div className="col-span-2">{t("users.table.status") as string}</div>
                    <div className="col-span-2">{t("users.table.created") as string}</div>
                  </div>
                </div>
                {org.members.map((m: any) => (
                  <div
                    key={m.user.id}
                    className="px-4 py-3 hover:bg-[var(--accent)]/30 cursor-pointer transition-colors border-b border-[var(--border)] last:border-b-0"
                    onClick={() => router.push(`/admin/users/${m.user.id}`)}
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-xs font-semibold text-[var(--primary)]">
                          {m.user.firstName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--foreground)] truncate">
                            {m.user.firstName} {m.user.lastName}
                            {m.user.id === org.owner?.id && (
                              <span className="ml-1 text-[10px] text-[var(--primary)]">({t("organizations.table.owner") as string})</span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)] truncate">{m.user.email}</p>
                        </div>
                      </div>
                      <div className="col-span-3">
                        <Badge className="text-xs px-2 py-1 rounded-md border-none bg-[var(--accent)] text-[var(--accent-foreground)]">
                          {m.role}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Badge className={`text-xs px-2 py-1 rounded-md border ${
                          m.user.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                            : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                        }`}>
                          {t(`users.status.${m.user.status.toLowerCase()}`, m.user.status) as string}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-xs text-[var(--muted-foreground)]">
                        {formatDateForDisplay(m.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">{t("common.no_results") as string}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Workspaces */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("organizations.details.workspaces") as string} ({org.workspaces?.length || 0})</h3>
        {org.workspaces?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {org.workspaces.map((ws: any) => (
              <Card key={ws.id} className="bg-[var(--card)] border-none shadow-sm">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{ws.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{ws.slug}</p>
                  <div className="flex gap-4 mt-2 text-xs text-[var(--muted-foreground)]">
                    <span>{ws._count?.projects || 0} {t("organizations.details.projects") as string}</span>
                    <span>{ws._count?.members || 0} {t("organizations.details.members") as string}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">{t("common.no_results") as string}</p>
        )}
      </div>
    </>
  );
}

export default function AdminOrgDetailPage() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const { id } = router.query;

  return (
    <AdminLayout
      breadcrumbs={[
        { label: t("navigation.organizations") as string, href: "/admin/organizations" },
        { label: typeof id === "string" ? t("users.actions.view_details") as string : "..." },
      ]}
    >
      <OrgDetailContent />
    </AdminLayout>
  );
}
