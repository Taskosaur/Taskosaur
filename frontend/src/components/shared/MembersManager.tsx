import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useProjectContext } from "@/contexts/project-context";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useAuth } from "@/contexts/auth-context";
import { useGlobalFetchPrevention } from "@/hooks/useGlobalFetchPrevention";
import { invitationApi } from "@/utils/api/invitationsApi";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { HiPlus } from "react-icons/hi2";
import { HiTrash } from "react-icons/hi2";
import { HiUserPlus } from "react-icons/hi2";
import { HiChevronDown } from "react-icons/hi2";
import { HiCheck } from "react-icons/hi2";
import { HiUsers } from "react-icons/hi2";

export interface Member {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

export interface OrganizationMember {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

export interface MemberRole {
  value: string;
  label: string;
  variant: "default" | "success" | "warning" | "info" | "secondary";
}

interface MembersManagerProps {
  type: "workspace" | "project";
  entityId: string;
  organizationId: string;
  workspaceId?: string;
  className?: string;
  title?: string;
}

const MembersManagerComponent = memo(function MembersManager({
  type,
  entityId,
  organizationId,
  workspaceId,
  className = "",
  title,
}: MembersManagerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOrgMembers, setIsLoadingOrgMembers] = useState(false);
  const [isLoadingWorkspaceMembers, setIsLoadingWorkspaceMembers] = useState(false);
  const [orgMembersLoaded, setOrgMembersLoaded] = useState(false);
  const [workspaceMembersLoaded, setWorkspaceMembersLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(type === "workspace" ? "MEMBER" : "DEVELOPER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const lastFetchParamsRef = useRef<string>("");
  const mountedRef = useRef(true);

  const {
    shouldPreventFetch,
    markFetchStart,
    markFetchComplete,
    markFetchError,
    getCachedData,
    reset,
  } = useGlobalFetchPrevention();

  const projectContext = useProjectContext();
  const workspaceContext = useWorkspaceContext();
  const { getCurrentUser } = useAuth();

  const workspaceRoles: MemberRole[] = [
    { value: "SUPER_ADMIN", label: "Super Admin", variant: "secondary" },
    { value: "MANAGER", label: "Manager", variant: "default" },
    { value: "MEMBER", label: "Member", variant: "default" },
    { value: "VIEWER", label: "Viewer", variant: "secondary" },
  ];

  const projectRoles: MemberRole[] = [
    { value: "SUPER_ADMIN", label: "Super Admin", variant: "secondary" },
    { value: "DEVELOPER", label: "Developer", variant: "default" },
    { value: "MANAGER", label: "Manager", variant: "default" },
    { value: "VIEWER", label: "Viewer", variant: "secondary" },
  ];

  const roles = type === "workspace" ? workspaceRoles : projectRoles;

  const getRoleLabel = (role: string) => {
    const roleConfig = roles.find((r) => r.value === role);
    return roleConfig?.label || role;
  };

  const fetchMembers = useCallback(async () => {
    const fetchKey = `${type}-${entityId}-${organizationId}`;

    if (shouldPreventFetch(fetchKey)) return;

    const cachedData = getCachedData(fetchKey);
    if (cachedData) {
      setMembers(cachedData as Member[]);
      setIsLoading(false);
      setIsFetchingMembers(false);
      return;
    }

    if (!entityId || !mountedRef.current) return;

    try {
      markFetchStart(fetchKey);
      setIsFetchingMembers(true);
      setIsLoading(true);
      lastFetchParamsRef.current = fetchKey;

      let membersData;
      if (type === "workspace") {
        membersData = (await workspaceContext.getWorkspaceMembers?.(entityId)) || [];
      } else {
        membersData = await projectContext.getProjectMembers(entityId);
      }

      const normalized = (membersData || []).map((member: any) => ({
        id: member.id,
        role: member.role,
        userId: member.userId || member.user?.id || "",
        user: {
          id: member.user?.id || member.userId || "",
          firstName: member.user?.firstName || "",
          lastName: member.user?.lastName || "",
          email: member.user?.email || member.email || "",
          avatar: member.user?.avatar || undefined,
        },
      }));

      if (mountedRef.current) {
        setMembers(normalized);
        markFetchComplete(fetchKey, normalized);
      }
    } catch (error: any) {
      markFetchError(fetchKey, error);
      if (mountedRef.current) {
        setError(error?.message || `Failed to load ${type} members`);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsFetchingMembers(false);
      }
    }
  }, [
    type,
    entityId,
    organizationId,
    shouldPreventFetch,
    getCachedData,
    markFetchStart,
    markFetchComplete,
    markFetchError,
    workspaceContext,
    projectContext,
  ]);

  const fetchOrganizationMembers = useCallback(async () => {
    if (orgMembersLoaded || isLoadingOrgMembers) return;

    try {
      setIsLoadingOrgMembers(true);
      const orgMembersData = await projectContext.getOrganizationMembers(organizationId);
      const normalized = (orgMembersData || []).map((orgMember: any) => ({
        id: orgMember.id,
        role: orgMember.role,
        user: {
          id: orgMember.user?.id || "",
          firstName: orgMember.user?.firstName || "",
          lastName: orgMember.user?.lastName || "",
          email: orgMember.user?.email || orgMember.email || "",
          avatar: orgMember.user?.avatar || undefined,
        },
      }));
      setOrganizationMembers(normalized);
      setOrgMembersLoaded(true);
    } catch (error: any) {
      setError(error?.message || "Failed to load organization members");
    } finally {
      setIsLoadingOrgMembers(false);
    }
  }, [orgMembersLoaded, isLoadingOrgMembers, organizationId, projectContext]);

  const fetchWorkspaceMembers = useCallback(async () => {
    if (workspaceMembersLoaded || isLoadingWorkspaceMembers) return;

    try {
      setIsLoadingWorkspaceMembers(true);

      let targetWorkspaceId = "";
      if (type === "project") {
        targetWorkspaceId = workspaceId || "";
      } else {
        targetWorkspaceId = entityId;
      }

      if (!targetWorkspaceId) return;

      const workspaceMembersData = await workspaceContext.getWorkspaceMembers?.(targetWorkspaceId);

      const transformedMembers: Member[] = workspaceMembersData.data.map((wsMember: any) => ({
        id: wsMember.id,
        role: wsMember.role,
        userId: wsMember.userId || wsMember.user?.id || "",
        user: {
          id: wsMember.user?.id || wsMember.userId || "",
          firstName: wsMember.user?.firstName || "",
          lastName: wsMember.user?.lastName || "",
          email: wsMember.user?.email || "",
          avatar: wsMember.user?.avatar || undefined,
        },
      }));

      setWorkspaceMembers(transformedMembers);
      setWorkspaceMembersLoaded(true);
    } catch (error: any) {
      setError(error?.message || "Failed to load workspace members");
    } finally {
      setIsLoadingWorkspaceMembers(false);
    }
  }, [
    workspaceMembersLoaded,
    isLoadingWorkspaceMembers,
    type,
    workspaceId,
    entityId,
    workspaceContext,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    if (!entityId || !organizationId || isFetchingMembers) return;

    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        fetchMembers();
      }
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (isFetchingMembers) {
        setIsFetchingMembers(false);
      }
    };
  }, [entityId, organizationId, type, isFetchingMembers]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      const fetchKey = `${type}-${entityId}-${organizationId}`;
      reset(fetchKey);
      lastFetchParamsRef.current = "";
    };
  }, [reset, type, entityId, organizationId]);

  const handleAddMember = async (userId: string) => {
    try {
      if (type === "workspace") {
        const memberData = {
          userId,
          workspaceId: entityId,
          role: selectedRole as any,
        };
        await workspaceContext.addMemberToWorkspace?.(memberData);
      } else {
        const memberData = {
          userId,
          projectId: entityId,
          role: selectedRole,
        };
        await projectContext.addMemberToProject(memberData);
      }

      await fetchMembers();
      setShowAddModal(false);
      setSelectedRole(type === "workspace" ? "MEMBER" : "DEVELOPER");
      setError(null);
    } catch (error: any) {
      setError(error?.message || `Failed to add ${type} member`);
    }
  };

  const handleInviteMember = async () => {
    try {
      if (!inviteEmail.trim()) return;

      setInviteLoading(true);
      setInviteMessage(null);
      setError(null);

      const inviteData: any = {
        inviteeEmail: inviteEmail.trim(),
        role: selectedRole,
      };

      if (type === "workspace") {
        inviteData.workspaceId = entityId;
      } else {
        inviteData.projectId = entityId;
      }

      await invitationApi.createInvitation(inviteData);

      setInviteMessage("Invitation sent successfully!");
      setInviteEmail("");
      setSelectedRole(type === "workspace" ? "MEMBER" : "DEVELOPER");

      setTimeout(() => {
        setShowInviteModal(false);
        setInviteMessage(null);
      }, 2000);

      await fetchMembers();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message;

      if (errorMessage) {
        setInviteMessage(errorMessage + " for this " + type);
      } else {
        setInviteMessage(`❌ Failed to send invitation to ${type}`);
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser?.id) return;

      if (type === "workspace") {
        await workspaceContext.removeMemberFromWorkspace?.(memberId, currentUser.id);
      } else {
        await projectContext.removeProjectMember(memberId, currentUser.id);
      }

      await fetchMembers();
      setError(null);
    } catch (error: any) {
      setError(error?.message || `Failed to remove ${type} member`);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const currentUser = getCurrentUser();
      if (!currentUser?.id) return;

      if (type === "workspace") {
        await workspaceContext.updateMemberRole?.(
          memberId,
          { role: newRole as any },
          currentUser.id
        );
      } else {
        await projectContext.updateProjectMemberRole(memberId, currentUser.id, newRole);
      }

      await fetchMembers();
      setError(null);
    } catch (error: any) {
      setError(error?.message || `Failed to update ${type} member role`);
    }
  };

  const getAvailableMembers = () => {
    const memberUserIds = members.map((member) => member.userId);

    if (type === "project") {
      return workspaceMembers.filter((wsMember) => !memberUserIds.includes(wsMember.userId));
    } else {
      return organizationMembers.filter((orgMember) => !memberUserIds.includes(orgMember.user.id));
    }
  };

  const isLoadingMembers = type === "project" ? isLoadingWorkspaceMembers : isLoadingOrgMembers;
  const membersLoaded = type === "project" ? workspaceMembersLoaded : orgMembersLoaded;

  const displayTitle = title || `${type === "workspace" ? "Workspace" : "Project"} Members`;

  if (isLoading) {
    return (
      <Card className={`members-manager-loading-card ${className}`}>
        <div className="members-manager-loading-container">
          <div className="members-manager-loading-title members-manager-loading-title-dark"></div>
          <div className="members-manager-loading-list">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="members-manager-loading-item">
                <div className="members-manager-loading-avatar members-manager-loading-avatar-dark"></div>
                <div className="members-manager-loading-content">
                  <div className="members-manager-loading-name members-manager-loading-name-dark"></div>
                  <div className="members-manager-loading-email members-manager-loading-email-dark"></div>
                </div>
                <div className="members-manager-loading-role members-manager-loading-role-dark"></div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`members-manager-card ${className} `}>
      {/* Header */}
      <CardHeader className="members-manager-header ">
        <div className="members-manager-header-content ">
          <div className="members-manager-header-info">
            <CardTitle className="members-manager-title">
              <HiUsers className="members-manager-title-icon" />
              {displayTitle}
            </CardTitle>
          </div>
          <div className="members-manager-actions">
            <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
              <DialogTrigger asChild>
                <Button variant="outline" className="members-manager-invite-button">
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent className="members-manager-modal">
                <DialogHeader>
                  <DialogTitle className="members-manager-modal-title">
                    Invite Member via Email
                  </DialogTitle>
                </DialogHeader>
                <div className="members-manager-modal-content">
                  <div className="members-manager-modal-field">
                    <Label htmlFor="email" className="members-manager-modal-label">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Enter email address"
                      className="members-manager-modal-input"
                      disabled={inviteLoading}
                    />
                  </div>
                  <div className="members-manager-modal-field">
                    <Label className="members-manager-modal-label">Role</Label>
                    <Select
                      value={selectedRole}
                      onValueChange={setSelectedRole}
                      disabled={inviteLoading}
                    >
                      <SelectTrigger className="members-manager-modal-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="members-manager-modal-select-content">
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Show invite message */}
                  {inviteMessage && (
                    <div
                      className={`members-manager-invite-message ${
                        inviteMessage.includes("❌")
                          ? "members-manager-invite-message-error"
                          : "members-manager-invite-message-success"
                      }`}
                    >
                      {inviteMessage}
                    </div>
                  )}
                </div>
                <div className="members-manager-modal-actions">
                  <Button
                    variant="outline"
                    className="members-manager-modal-cancel"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail("");
                      setInviteMessage(null);
                      setSelectedRole(type === "workspace" ? "MEMBER" : "DEVELOPER");
                    }}
                    disabled={inviteLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInviteMember}
                    disabled={!inviteEmail.trim() || inviteLoading}
                    className="members-manager-modal-submit"
                  >
                    {inviteLoading ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Keep the rest of the component unchanged */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
              <DialogTrigger asChild>
                <Button
                  variant="default"
                  className="members-manager-add-button"
                  onClick={() => {
                    if (type === "project") {
                      fetchWorkspaceMembers();
                    } else {
                      fetchOrganizationMembers();
                    }
                  }}
                >
                  <HiPlus className="members-manager-add-button-icon" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="members-manager-modal members-manager-modal-large">
                <DialogHeader>
                  <DialogTitle className="members-manager-modal-title">
                    Add Member to {type === "workspace" ? "Workspace" : "Project"}
                  </DialogTitle>
                </DialogHeader>
                <div className="members-manager-modal-content">
                  <div className="members-manager-modal-field">
                    <Label className="members-manager-modal-label">Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="members-manager-modal-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="members-manager-modal-select-content">
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="members-manager-modal-field">
                    <Label className="members-manager-modal-label">
                      {type === "project" ? "Workspace Members" : "Organization Members"}
                    </Label>
                    {isLoadingMembers ? (
                      <div className="members-manager-modal-loading-list">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="members-manager-modal-loading-item members-manager-modal-loading-item-dark"
                          >
                            <div className="members-manager-modal-loading-item-avatar members-manager-modal-loading-item-avatar-dark"></div>
                            <div className="members-manager-modal-loading-item-content">
                              <div className="members-manager-modal-loading-item-name members-manager-modal-loading-item-name-dark"></div>
                              <div className="members-manager-modal-loading-item-email members-manager-modal-loading-item-email-dark"></div>
                            </div>
                            <div className="members-manager-modal-loading-item-button members-manager-modal-loading-item-button-dark"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="members-manager-available-list">
                        {getAvailableMembers().map((member: any) => (
                          <div
                            key={member.id}
                            className="members-manager-available-item members-manager-available-item-dark"
                          >
                            <div className="members-manager-available-item-info">
                              <UserAvatar
                                user={{
                                  firstName: member.user?.firstName || member.firstName,
                                  lastName: member.user?.lastName || member.lastName,
                                  avatar: member.user?.avatar || member.avatar,
                                }}
                                size="sm"
                              />
                              <div className="members-manager-available-item-details">
                                <div className="members-manager-available-item-name">
                                  {member.user?.firstName || member.firstName}{" "}
                                  {member.user?.lastName || member.lastName}
                                </div>
                                <div className="members-manager-available-item-email">
                                  {member.user?.email || member.email}
                                </div>
                              </div>
                            </div>
                            <Button
                              onClick={() => handleAddMember(member.user?.id || member.userId)}
                              className="members-manager-available-item-button"
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                        {getAvailableMembers().length === 0 && membersLoaded && (
                          <div className="members-manager-empty-available">
                            <p className="members-manager-empty-available-title">
                              All {type === "project" ? "workspace" : "organization"} members are
                              already part of this {type}
                            </p>
                            <p className="members-manager-empty-available-subtitle">
                              Use the "Invite" button to invite new members via email
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    className="members-manager-modal-cancel"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      {/* Error Display */}
      {error && (
        <div className="members-manager-error">
          <p className="members-manager-error-text">{error}</p>
        </div>
      )}

      {/* Members List */}
      <CardContent className="members-manager-content">
        <div className="members-manager-list">
          {members.length === 0 ? (
            <div className="members-manager-empty">
              <HiUserPlus className="members-manager-empty-icon" />
              <p className="members-manager-empty-title">No members yet</p>
              <p className="members-manager-empty-subtitle">
                Add members to start collaborating on this {type}.
              </p>
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="members-manager-member-item">
                <div className="members-manager-member-info">
                  <UserAvatar
                    user={{
                      firstName: member.user.firstName,
                      lastName: member.user.lastName,
                      avatar: member.user.avatar,
                    }}
                    size="sm"
                  />
                  <div className="members-manager-member-details">
                    <div className="members-manager-member-name">
                      {member.user.firstName} {member.user.lastName}
                    </div>
                    <div className="members-manager-member-email">{member.user.email}</div>
                  </div>
                </div>
                <div className="members-manager-member-actions">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="members-manager-role-button">
                        {getRoleLabel(member.role)}
                        <HiChevronDown className="size-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="members-manager-role-dropdown">
                      {roles.map((role) => (
                        <DropdownMenuItem
                          key={role.value}
                          onClick={() => handleUpdateRole(member.id, role.value)}
                          className="members-manager-role-dropdown-item"
                        >
                          <div className="members-manager-role-dropdown-item-content">
                            {role.label}
                            {member.role === role.value && (
                              <HiCheck className="members-manager-role-dropdown-check" />
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member.id)}
                        className="members-manager-role-dropdown-remove"
                      >
                        <HiTrash className="members-manager-role-dropdown-remove-icon" />
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
});

MembersManagerComponent.displayName = "MembersManager";

export default MembersManagerComponent;
