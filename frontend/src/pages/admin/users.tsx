import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/admin/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import { formatDateForDisplay } from "@/utils/date";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { FilterDropdown, useGenericFilters } from "@/components/common/FilterDropdown";
import Pagination from "@/components/common/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { HiEllipsisVertical, HiXMark, HiEye, HiShieldCheck, HiShieldExclamation, HiNoSymbol, HiCheckCircle, HiKey, HiTrash, HiUsers } from "react-icons/hi2";
import { HiSearch } from "react-icons/hi";
import { ShieldCheck, Flame, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// Global user roles — only SUPER_ADMIN and MEMBER are meaningful at system level
const GLOBAL_ROLES = ["SUPER_ADMIN", "MEMBER"];
// All roles for filter display
const ALL_ROLES = ["SUPER_ADMIN", "OWNER", "MANAGER", "MEMBER", "VIEWER"];
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"];

const getRoleOptions = (t: any) => ALL_ROLES.map((r) => ({ id: r, name: t(`users.roles.${r.toLowerCase()}`, r), value: r }));
const getStatusOptions = (t: any) => STATUSES.map((s) => ({
  id: s,
  name: t(`users.status.${s.toLowerCase()}`, s),
  value: s,
  color:
    s === "ACTIVE" ? "#22c55e" :
    s === "SUSPENDED" ? "#ef4444" :
    s === "PENDING" ? "#eab308" : "#6b7280",
}));

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
    case "OWNER":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800";
    case "MANAGER":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800";
    case "MEMBER":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
    case "VIEWER":
      return "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]";
    default:
      return "bg-[var(--accent)] text-[var(--accent-foreground)]";
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
    case "INACTIVE":
      return "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]";
    case "SUSPENDED":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800";
    default:
      return "bg-[var(--accent)] text-[var(--accent-foreground)]";
  }
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

function AdminUsersContent() {
  const { t } = useTranslation("admin");
  const router = useRouter();
  const { createSection } = useGenericFilters();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedRoles.length === 1) params.role = selectedRoles[0];
      if (selectedStatuses.length === 1) params.status = selectedStatuses[0];
      const data = await adminApi.getUsers(params);
      setUsers(data.data || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, selectedRoles, selectedStatuses]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleRole = useCallback((id: string) => {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPage(1);
  }, []);

  const toggleStatus = useCallback((id: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPage(1);
  }, []);

  const totalActiveFilters = selectedRoles.length + selectedStatuses.length;

  const clearAllFilters = useCallback(() => {
    setSelectedRoles([]);
    setSelectedStatuses([]);
    setPage(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setPage(1);
  }, []);

  const roleFilters = useMemo(
    () => getRoleOptions(t).map((r) => ({
      ...r,
      selected: selectedRoles.includes(r.id),
      count: users.filter((u) => u.role === r.id).length,
    })),
    [selectedRoles, users, t]
  );

  const statusFilters = useMemo(
    () => getStatusOptions(t).map((s) => ({
      ...s,
      selected: selectedStatuses.includes(s.id),
      count: users.filter((u) => u.status === s.id).length,
    })),
    [selectedStatuses, users, t]
  );

  const filterSections = useMemo(
    () => [
      createSection({
        id: "role",
        title: t("users.table.role"),
        icon: ShieldCheck,
        data: roleFilters,
        selectedIds: selectedRoles,
        searchable: false,
        onToggle: toggleRole,
        onSelectAll: () => setSelectedRoles(ALL_ROLES),
        onClearAll: () => { setSelectedRoles([]); setPage(1); },
      }),
      createSection({
        id: "status",
        title: t("users.table.status"),
        icon: CircleDot,
        data: statusFilters,
        selectedIds: selectedStatuses,
        searchable: false,
        onToggle: toggleStatus,
        onSelectAll: () => setSelectedStatuses(STATUSES),
        onClearAll: () => { setSelectedStatuses([]); setPage(1); },
      }),
    ],
    [roleFilters, statusFilters, selectedRoles, selectedStatuses, toggleRole, toggleStatus, createSection, t]
  );

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await adminApi.updateUserRole(userId, role);
      toast.success(t("common.success"));
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleStatusChange = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await adminApi.updateUserStatus(userId, newStatus);
      toast.success(t("common.success"));
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    try {
      const result = await adminApi.resetUserPassword(userId);
      // Copy the reset link to clipboard
      if (result.resetLink) {
        await navigator.clipboard.writeText(window.location.origin + result.resetLink);
        toast.success(t("users.actions.reset_password_link_copied", { name: userName }));
      } else {
        toast.success(result.message);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(t("users.actions.delete_confirmation", { name: userName }))) {
      return;
    }
    try {
      await adminApi.deleteUser(userId);
      toast.success(t("users.actions.user_removed", { name: userName }));
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("common.error_loading"));
    }
  };

  return (
    <>
      <p className="text-sm text-[var(--muted-foreground)]">{t("users.total_count", { count: total }) as string}</p>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <Input
            type="text"
            placeholder={t("users.search_placeholder") as string}
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
        <FilterDropdown
          sections={filterSections}
          title={t("common.filters") as string}
          activeFiltersCount={totalActiveFilters}
          onClearAllFilters={clearAllFilters}
          placeholder={t("users.search_placeholder") as string}
          dropdownWidth="w-56"
          showApplyButton={false}
        />
      </div>

      {/* Users Table */}
      <Card className="bg-[var(--card)] border-none shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <HiUsers className="w-10 h-10 mx-auto text-[var(--muted-foreground)]/50 mb-3" />
              <p className="text-sm font-medium text-[var(--foreground)]">{t("common.no_results") as string}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {debouncedSearch ? t("common.try_adjusting") : t("users.no_users")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                  <div className="col-span-4">{t("users.table.user") as string}</div>
                  <div className="col-span-2">{t("users.table.role") as string}</div>
                  <div className="col-span-2">{t("users.table.status") as string}</div>
                  <div className="col-span-1">{t("users.table.organizations") as string}</div>
                  <div className="col-span-2">{t("users.table.created") as string}</div>
                  <div className="col-span-1">{t("users.table.actions") as string}</div>
                </div>
              </div>
              {users.map((user) => (
                <div
                  key={user.id}
                  className="px-4 py-3 hover:bg-[var(--accent)]/30 transition-colors cursor-pointer border-b border-[var(--border)] last:border-b-0"
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-xs font-semibold text-[var(--primary)] flex-shrink-0">
                        {user.firstName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--foreground)] truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Badge className={`text-xs px-2 py-1 rounded-md border ${getRoleBadgeClass(user.role)}`}>
                        {t(`users.roles.${user.role.toLowerCase()}`, user.role) as string}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <Badge className={`text-xs px-2 py-1 rounded-md border ${getStatusBadgeClass(user.status)}`}>
                        {t(`users.status.${user.status.toLowerCase()}`, user.status) as string}
                      </Badge>
                    </div>
                    <div className="col-span-1 text-xs text-[var(--muted-foreground)]">
                      {user._count?.organizationMembers || 0}
                    </div>
                    <div className="col-span-2 text-xs text-[var(--muted-foreground)]">
                      {formatDateForDisplay(user.createdAt)}
                    </div>
                    <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-[var(--accent)]">
                            <HiEllipsisVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-none bg-[var(--popover)] shadow-lg min-w-[180px] p-1">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                          >
                            <HiEye className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            <span className="text-sm">{t("users.actions.view_details") as string}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          {user.role !== "SUPER_ADMIN" && (
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.id, "SUPER_ADMIN")}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                            >
                              <HiShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                              <span className="text-sm">{t("users.actions.promote_super_admin") as string}</span>
                            </DropdownMenuItem>
                          )}
                          {user.role === "SUPER_ADMIN" && (
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.id, "MEMBER")}
                              className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                            >
                              <HiShieldExclamation className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-sm">{t("users.actions.remove_super_admin") as string}</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(user.id, user.status)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                          >
                            {user.status === "ACTIVE" ? (
                              <>
                                <HiNoSymbol className="w-3.5 h-3.5 text-[var(--destructive)]" />
                                <span className="text-sm text-[var(--destructive)]">{t("users.actions.deactivate") as string}</span>
                              </>
                            ) : (
                              <>
                                <HiCheckCircle className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-sm text-green-600">{t("users.actions.activate") as string}</span>
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleResetPassword(user.id, `${user.firstName} ${user.lastName}`)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-150 hover:bg-[var(--accent)]"
                          >
                            <HiKey className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                            <span className="text-sm">{t("users.actions.reset_password") as string}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user.id, `${user.firstName} ${user.lastName}`)}
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
          itemType="users"
        />
      )}
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminLayout>
      <AdminUsersContent />
    </AdminLayout>
  );
}
