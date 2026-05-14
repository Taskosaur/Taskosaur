import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { formatDateForDisplay } from "@/utils/date";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import Pagination from "@/components/common/Pagination";
import { Badge } from "@/components/ui/badge";
import { HiXMark, HiEllipsisVertical, HiEye, HiPause, HiPlay, HiTrash, HiBuildingOffice2 } from "react-icons/hi2";
import { HiSearch } from "react-icons/hi";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

function AdminOrganizationsContent() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchOrgs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await adminApi.getOrganizations(params);
      setOrganizations(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleToggleArchive = async (orgId: string, orgName: string, isArchived: boolean) => {
    try {
      await adminApi.toggleOrganizationArchive(orgId);
      toast.success(t("common.success"));
      fetchOrgs();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleDelete = async (orgId: string, orgName: string) => {
    if (!window.confirm(t("common.confirmation.title"))) {
      return;
    }
    try {
      await adminApi.deleteOrganization(orgId);
      toast.success(t("common.success"));
      fetchOrgs();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setPage(1);
  }, []);

  return (
    <>
      <p className="text-sm text-[var(--muted-foreground)]">{t("organizations.total_count", { count: total }) as string}</p>

      {/* Search Bar */}
      <div className="relative w-full sm:max-w-xs">
        <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <Input
          type="text"
          placeholder={t("organizations.search_placeholder") as string}
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          className="pl-10 rounded-md border border-[var(--border)]"
        />
        {searchInput && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            <HiXMark size={16} />
          </button>
        )}
      </div>

      {/* Organizations Table */}
      <Card className="bg-[var(--card)] border-none shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-8 h-8 rounded-md" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          ) : organizations.length === 0 ? (
            <div className="p-12 text-center">
              <HiBuildingOffice2 className="w-10 h-10 mx-auto text-[var(--muted-foreground)]/50 mb-3" />
              <p className="text-sm font-medium text-[var(--foreground)]">{t("common.no_results") as string}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {debouncedSearch ? t("common.try_adjusting") as string : t("organizations.no_orgs") as string}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  <div className="col-span-3">{t("organizations.table.organization") as string}</div>
                  <div className="col-span-3">{t("organizations.table.owner") as string}</div>
                  <div className="col-span-1">{t("users.table.status") as string}</div>
                  <div className="col-span-1">{t("organizations.table.users") as string}</div>
                  <div className="col-span-1">{t("organizations.table.workspaces") as string}</div>
                  <div className="col-span-2">{t("organizations.table.created") as string}</div>
                  <div className="col-span-1">{t("organizations.table.actions") as string}</div>
                </div>
              </div>
              {/* Rows */}
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="px-4 py-3 hover:bg-[var(--accent)]/30 transition-colors cursor-pointer border-b border-[var(--border)] last:border-b-0"
                  onClick={() => router.push(`/admin/organizations/${org.id}`)}
                >
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/80 flex items-center justify-center text-[var(--primary-foreground)] text-xs font-semibold flex-shrink-0">
                        {org.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--foreground)] truncate capitalize">
                          {org.name}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate">{org.slug}</p>
                      </div>
                    </div>
                    <div className="col-span-3 min-w-0">
                      {org.owner ? (
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--foreground)] truncate">
                            {org.owner.firstName} {org.owner.lastName}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)] truncate">{org.owner.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <Badge className={`text-xs px-2 py-1 rounded-md border ${
                        org.archive
                          ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                          : "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                      }`}>
                        {org.archive ? t("users.status.suspended") as string : t("users.status.active") as string}
                      </Badge>
                    </div>
                    <div className="col-span-1 text-xs text-[var(--muted-foreground)]">
                      {org._count?.members || 0}
                    </div>
                    <div className="col-span-1 text-xs text-[var(--muted-foreground)]">
                      {org._count?.workspaces || 0}
                    </div>
                    <div className="col-span-2 text-xs text-[var(--muted-foreground)]">
                      {formatDateForDisplay(org.createdAt)}
                    </div>
                    <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-[var(--accent)]">
                            <HiEllipsisVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-none bg-[var(--popover)] shadow-lg min-w-[170px] p-1">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/organizations/${org.id}`)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                          >
                            <HiEye className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            <span className="text-sm">{t("users.actions.view_details") as string}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleToggleArchive(org.id, org.name, org.archive)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                          >
                            {org.archive ? (
                              <>
                                <HiPlay className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-sm text-green-600">{t("users.actions.activate") as string}</span>
                              </>
                            ) : (
                              <>
                                <HiPause className="w-3.5 h-3.5 text-orange-500" />
                                <span className="text-sm text-orange-500">{t("users.actions.suspend") as string}</span>
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(org.id, org.name)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--destructive)]/10"
                          >
                            <HiTrash className="w-3.5 h-3.5 text-[var(--destructive)]" />
                            <span className="text-sm text-[var(--destructive)]">{t("users.actions.delete") as string}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination
          pagination={{
            currentPage: page,
            totalPages,
            totalCount: total,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          }}
          pageSize={limit}
          onPageChange={setPage}
          itemType="organizations"
        />
      )}
    </>
  );
}

export default function AdminOrganizationsPage() {
  return (
    <AdminLayout>
      <AdminOrganizationsContent />
    </AdminLayout>
  );
}
