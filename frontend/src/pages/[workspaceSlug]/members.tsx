import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  HiMagnifyingGlass,
  HiPlus,
  HiUsers,
  HiChevronDown,
  HiCheck,
  HiUserPlus,
  HiXMark,
  HiCog,
} from "react-icons/hi2";
import Loader from "@/components/common/Loader";
import ErrorState from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui";
import { invitationApi } from "@/utils/api/invitationsApi";
import { X } from "lucide-react";
import InviteModal from "@/components/modals/InviteModal";
import Tooltip from "@/components/common/ToolTip";
import { roles } from "@/utils/data/projectData";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { ProjectMember } from "@/types";
import PendingInvitations, { PendingInvitationsRef } from "@/components/common/PendingInvitations";
import WorkspaceMembersSkeleton from "@/components/skeletons/WorkspaceMembersSkeleton";

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joinedAt: string;
  avatar?: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="text-center py-8 flex flex-col items-center justify-center">
    <Icon className="w-12 h-12 mx-auto text-[var(--muted-foreground)] mb-4" />
    <p className="text-sm font-medium text-[var(--foreground)] mb-2">{title}</p>
    <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
  </div>
);

function WorkspaceMembersContent() {
  const router = useRouter();
  const { workspaceSlug } = router.query;

  const {
    getWorkspaceBySlug,
    getWorkspaceMembers,
    updateMemberRole,
    removeMemberFromWorkspace,
  } = useWorkspace();
  const { isAuthenticated, getCurrentUser, getUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [userAccess, setUserAccess] = useState(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const [searchLoading, setSearchLoading] = useState(false);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string>("");
  const currentSlugRef = useRef<string>("");
  const isInitializedRef = useRef(false);
  const pendingInvitationsRef = useRef<PendingInvitationsRef>(null);
  const contextFunctionsRef = useRef({
    getWorkspaceBySlug,
    getWorkspaceMembers,
    isAuthenticated,
  });

  const [data, setData] = useState(null);

  useEffect(() => {
    if (!workspace?.id) return;
    getUserAccess({ name: "workspace", id: workspace?.id })
      .then((data) => {
        setData(data);
        // console.log("Access data:", data?.role, data?.canChange);
        setHasAccess(data?.canChange || data?.role === "OWNER" || data?.role === "MANAGER");
        setUserAccess(data)
      })
      .catch((error) => {
        console.error("Error fetching user access:", error);
      });
  }, [workspace]);
  // console.log(hasAccess, "hasAccess");

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "organizations-status-badge-active";
      case "PENDING":
        return "organizations-status-badge-pending";
      case "INACTIVE":
        return "organizations-status-badge-inactive";
      case "SUSPENDED":
        return "organizations-status-badge-suspended";
      default:
        return "organizations-status-badge-inactive";
    }
  };

  const getRoleLabel = (role: string) => {
    if (!Array.isArray(roles)) return role;
    const roleConfig = roles.find((r) => r.name === role);
    return roleConfig?.name || role;
  };

  // Get current user's role for permission checks
  const getCurrentUserRole = () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;

    const userMember = members.find((m) => m.email === currentUser.email);
    return userMember?.role || null;
  };

  const canInviteMembers = () => {
    const userRole = getCurrentUserRole();
    return (
      userRole === "SUPER_ADMIN" ||
      userRole === "MANAGER" ||
      data?.role === "OWNER"
    );
  };

  useEffect(() => {
    contextFunctionsRef.current = {
      getWorkspaceBySlug,
      getWorkspaceMembers,
      isAuthenticated,
    };
  }, [getWorkspaceBySlug, getWorkspaceMembers, isAuthenticated]);

  const fetchMembers = useCallback(
    async (searchValue = "") => {
      const pageKey = `${workspaceSlug}/members`;
      const requestId = `${pageKey}-${Date.now()}-${Math.random()}`;

      if (!isMountedRef.current) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      requestIdRef.current = requestId;
      currentSlugRef.current = pageKey;

      if (!workspaceSlug || !contextFunctionsRef.current.isAuthenticated()) {
        setError("Authentication required");
        setLoading(false);
        setSearchLoading(false);
        return;
      }

      try {
        if (!workspace) {
          setLoading(true);
        } else {
          setSearchLoading(true);
        }
        setError(null);

        if (requestIdRef.current !== requestId || !isMountedRef.current) {
          return;
        }

        const workspaceData =
          workspace ||
          (await contextFunctionsRef.current.getWorkspaceBySlug(
            workspaceSlug as string
          ));

        if (requestIdRef.current !== requestId || !isMountedRef.current) {
          return;
        }

        if (!workspaceData) {
          setError("Workspace not found");
          setLoading(false);
          setSearchLoading(false);
          return;
        }

        if (!workspace) {
          setWorkspace(workspaceData);
        }

        const membersData =
          await contextFunctionsRef.current.getWorkspaceMembers(
            workspaceData.id,
            searchValue
          );

        if (requestIdRef.current !== requestId || !isMountedRef.current) {
          return;
        }

        const processedMembers = (membersData || []).map((member: any) => ({
          id: member.id,
          name:
            `${member.user?.firstName || ""} ${member.user?.lastName || ""
              }`.trim() || "Unknown User",
          email: member.user?.email || "",
          role: member.role || "Member",
          status: member.user?.status || "Active",
          joinedAt: member.createdAt || new Date().toISOString(),
          avatar: member.user?.avatar || "",
        }));

        setMembers(processedMembers);
        isInitializedRef.current = true;
      } catch (err) {
        if (requestIdRef.current === requestId && isMountedRef.current) {
          setError(err instanceof Error ? err.message : "An error occurred");
          isInitializedRef.current = false;
        }
      } finally {
        if (requestIdRef.current === requestId && isMountedRef.current) {
          setLoading(false);
          setSearchLoading(false);
        }
      }
    },
    [workspaceSlug, workspace]
  );

  useEffect(() => {
    const initializeData = async () => {
      if (!isInitializedRef.current) {
        await fetchMembers();
      }
    };

    const pageKey = `${workspaceSlug}/members`;
    if (currentSlugRef.current !== pageKey) {
      isInitializedRef.current = false;
      setWorkspace(null);
      setMembers([]);
      setError(null);
    }

    const timeoutId = setTimeout(() => {
      initializeData();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [workspaceSlug, fetchMembers]);

  useEffect(() => {
    if (isInitializedRef.current) {
      fetchMembers(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, fetchMembers]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isInitializedRef.current = false;
      currentSlugRef.current = "";
      requestIdRef.current = "";

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const activeMembers = members.filter(
    (member) => member.status?.toLowerCase() !== "pending"
  );

  const refreshMembers = async () => {
    if (!workspace) return;

    try {
      const membersData = await contextFunctionsRef.current.getWorkspaceMembers(
        workspace.id,
        searchTerm
      );

      const processedMembers = (membersData || []).map((member: any) => ({
        id: member.id,
        name:
          `${member.user?.firstName || ""} ${member.user?.lastName || ""
            }`.trim() || "Unknown User",
        email: member.user?.email || "",
        role: member.role || "Member",
        status: member.user?.status || "Active",
        joinedAt: member.createdAt || new Date().toISOString(),
        avatar: member.user?.avatar || "",
      }));

      setMembers(processedMembers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    }
  };

  const retryFetch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    isInitializedRef.current = false;
    currentSlugRef.current = "";
    requestIdRef.current = "";
    setMembers([]);
    setWorkspace(null);
    setError(null);
    setLoading(true);
  };

  function updateLocalStorageUser(newRole: string) {
    const tampUser = localStorage.getItem("user");
    const updateRole = JSON.parse(tampUser);
    const finalUser = {
      ...updateRole,
      role: newRole,
    };
    localStorage.setItem("user", JSON.stringify(finalUser));
  }

  const handleRoleUpdate = async (memberId: string, newRole: string) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }

    try {
      setUpdatingMember(memberId);
      await updateMemberRole(
        memberId,
        { role: newRole as any },
        currentUser.id
      );
      await refreshMembers();
      updateLocalStorageUser(newRole); // Update the new role
      toast.success("Member role updated successfully");
    } catch (err) {
      const errorMessage = err.message || "Failed to update role";
      toast.error(errorMessage);
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setError("User not authenticated");
      return;
    }

    try {
      setRemovingMember(member?.id);
      await removeMemberFromWorkspace(member?.id, currentUser.id);
      await refreshMembers();
      setMemberToRemove(null);
      toast.success("Member removed successfully");
    } catch (err) {
      const errorMessage = err.message
        ? err.message
        : "Failed to remove member";
      setError(errorMessage);
      setMemberToRemove(null);
      toast.error(errorMessage);
    } finally {
      setRemovingMember(null);
    }
  };

  const handleInvite = async (email: string, role: string) => {
    if (!workspace) {
      toast.error("Workspace not found");
      throw new Error("Workspace not found");
    }

    const validation = invitationApi.validateInvitationData({
      inviteeEmail: email,
      workspaceId: workspace.id,
      role: role,
    });

    if (!validation.isValid) {
      validation.errors.forEach((error) => toast.error(error));
      throw new Error("Validation failed");
    }

    try {
      await invitationApi.createInvitation({
        inviteeEmail: email,
        workspaceId: workspace.id,
        role: role,
      });

      toast.success(`Invitation sent to ${email}`);
      
    
      if (pendingInvitationsRef.current) {
        await pendingInvitationsRef.current.refreshInvitations();
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send invitation";
      toast.error(errorMessage);
      console.error("Invite member error:", error);
      throw error;
    }
  };

  const handleInviteWithLoading = async (email: string, role: string) => {
    setInviteLoading(true);
    try {
      await handleInvite(email, role);
    } finally {
      setInviteLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return <WorkspaceMembersSkeleton />;
  }

  if (error && !members.length) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <ErrorState
          error="Error loading workspace members"
          onRetry={retryFetch}
        />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="dashboard-container px-[1rem]">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Workspace not found
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container pt-0">
      {/* Header - Compact */}
      <PageHeader
        title={workspace ? `${workspace.name} Members` : "Workspace Members"}
        description="Manage members and their permissions in this workspace."
        actions={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {hasAccess && (
              <Button
                onClick={() => setShowInviteModal(true)}
                disabled={inviteLoading}
                className="h-9 px-4 border-none bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviteLoading ? (
                  <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <HiPlus className="size-4" />
                )}
                Invite Member
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
            <CardHeader className="px-4 py-0">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <HiUsers className="w-5 h-5 text-[var(--muted-foreground)]" />
                  Members ({activeMembers.length})
                </CardTitle>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HiMagnifyingGlass className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </div>

                  <Input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 w-64 border-input bg-background text-[var(--foreground)]"
                    placeholder="Search members..."
                  />

                  {searchLoading && (
                    <div className="absolute inset-y-0 right-10 pr-3 flex items-center">
                      <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {searchTerm && !searchLoading && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                    >
                      <HiXMark size={16} />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="px-4 py-3 bg-[var(--muted)]/30 border-b border-[var(--border)]">
                <div className="grid grid-cols-12 gap-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  <div className="col-span-4">Member</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Joined</div>
                  <div className="col-span-2">Role</div>
                  <div className="col-span-2">Action</div>
                </div>
              </div>

              {/* Table Content */}
              {activeMembers.length === 0 && !loading ? (
                <EmptyState
                  icon={HiUserPlus}
                  title={
                    searchTerm
                      ? "No members found matching your search"
                      : "No members found in this workspace"
                  }
                  description={
                    searchTerm
                      ? "Try adjusting your search terms"
                      : "Start by inviting team members to collaborate on this project"
                  }
                />
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {activeMembers.map((member) => (
                    <div
                      key={member.id}
                      className="px-4 py-3 hover:bg-[var(--accent)]/30 transition-colors"
                    >
                      <div className="grid grid-cols-12 gap-3 items-center">
                        {/* Member Info */}
                        <div className="col-span-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={{
                                firstName: member.name.split(" ")[0] || "",
                                lastName: member.name.split(" ")[1] || "",
                                avatar: member.avatar,
                              }}
                              size="sm"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-[var(--foreground)] truncate">
                                {member.name}
                              </div>
                              <div className="text-xs text-[var(--muted-foreground)] truncate">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="col-span-2">
                          <Badge
                            variant="outline"
                            className={`text-xs bg-transparent px-2 py-1 rounded-md border-none ${getStatusBadgeClass(
                              member.status || "ACTIVE"
                            )}`}
                          >
                            {member.status || "ACTIVE"}
                          </Badge>
                        </div>

                        {/* Joined Date */}
                        <div className="col-span-2">
                          <span className="text-sm text-[var(--muted-foreground)]">
                            {member.joinedAt
                              ? formatDate(
                                new Date(member.joinedAt).toISOString()
                              )
                              : "N/A"}
                          </span>
                        </div>

                        {/* Role */}
                        <div className="col-span-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="h-8 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 text-xs"
                                disabled={
                                  updatingMember === member.id || !hasAccess
                                }
                              >
                                {updatingMember === member.id ? (
                                  <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <>
                                    {getRoleLabel(member.role)}
                                    <HiChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="z-50 border-none bg-[var(--card)] rounded-lg shadow-lg">
                              {roles.filter((role) => !(userAccess?.role === "MANAGER" && role?.name === "OWNER")).map((role) => (
                                <DropdownMenuItem
                                  key={role.id}
                                  onClick={() =>
                                    handleRoleUpdate(member.id, role.name)
                                  }
                                  className="text-[var(--foreground)] hover:bg-[var(--primary)]/10 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    {role.name}
                                    {member.role === role.name && (
                                      <HiCheck className="w-4 h-4 text-[var(--primary)]" />
                                    )}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Action */}
                        <div className="col-span-2">
                          <Tooltip
                            content="Remove Member"
                            position="top"
                            color="danger"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMemberToRemove(member)}
                              disabled={
                                removingMember === member.id || !hasAccess
                              }
                              className="h-7 border-none bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)] transition-all duration-200"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>




        <div className="lg:col-span-1 space-y-4">
          {/* Workspace Info Card */}
          <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
                <HiUsers className="w-5 h-5 text-[var(--muted-foreground)]" />
                Workspace Info
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {workspace?.name || "Unknown Workspace"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {workspace?.description || "No description available"}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>Members:</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {members.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                  <span>Active Members:</span>
                  <span className="font-medium text-[var(--foreground)]">
                    {members.filter((m) => m.status === "ACTIVE").length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Role Distribution Card */}
          <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
                <HiCog className="w-5 h-5 text-[var(--muted-foreground)]" />
                Role Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {roles.map((role) => {
                  // Only count active members
                  const count = members.filter(
                    (m) => m.role === role.name && m.status?.toLowerCase() !== "pending"
                  ).length;

                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-[var(--muted-foreground)]">{role.name}</span>
                      <Badge
                        variant={role.variant}
                        className="h-5 px-2 text-xs border-none bg-[var(--primary)]/10 text-[var(--primary)]"
                      >
                        {count}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          {/* Pending Invitations*/}
          {hasAccess && <PendingInvitations ref={pendingInvitationsRef} entity={workspace} entityType="workspace" members={members} />}

        </div>
      </div>

      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteWithLoading}
        availableRoles={roles}
      />

      {memberToRemove && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setMemberToRemove(null)}
          onConfirm={() => handleRemoveMember(memberToRemove)}
          title="Remove Member"
          message="Are you sure you want to remove this member from the Workspace?"
          confirmText="Remove"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}

export default function WorkspaceMembersPage() {
  return <WorkspaceMembersContent />;
}
