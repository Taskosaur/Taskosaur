import { useState } from "react";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import ConfirmationModal from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";
import { HiMagnifyingGlass, HiPlus, HiUsers, HiXMark } from "react-icons/hi2";
import { HiMail } from "react-icons/hi";
import { invitationApi } from "@/utils/api/invitationsApi";
import { OrganizationMember, OrganizationRole } from "@/types";
import Tooltip from "../common/ToolTip";
import { X } from "lucide-react";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/contexts/auth-context";
import { PendingInvitationsRef } from "@/components/common/PendingInvitations";

interface OrganizationMembersProps {
  organizationId: string;
  members: OrganizationMember[];
  currentUserRole: OrganizationRole;
  onMembersChange: () => void;
  organization?: any;
  pendingInvitationsRef?: React.RefObject<PendingInvitationsRef>;
  searchQuery?: string;
  onSearchChange: (query: string) => void;
}

export default function OrganizationMembers({
  organizationId,
  members,
  currentUserRole,
  onMembersChange,
  organization,
  pendingInvitationsRef,
  searchQuery,
  onSearchChange,
}: OrganizationMembersProps) {
  const { updatedOrganizationMemberRole, removeOrganizationMember } = useOrganization();
  const { getCurrentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    role: "",
    message: "",
  });

  const availableRoles = [
    {
      id: "viewer",
      name: OrganizationRole.VIEWER,
      description: "Can view organization content",
    },
    {
      id: "member",
      name: OrganizationRole.MEMBER,
      description: "Can contribute to projects",
    },
    {
      id: "manager",
      name: OrganizationRole.MANAGER,
      description: "Can manage projects and members",
    },
    {
      id: "owner",
      name: OrganizationRole.OWNER,
      description: "Can manage all aspects of the organization",
    },
  ];
  const getCurrentUserId = () => getCurrentUser()?.id;
  const isCurrentUserOwner = organization?.ownerId === getCurrentUserId();
  const canManageMembers =
    currentUserRole === OrganizationRole.SUPER_ADMIN ||
    currentUserRole === OrganizationRole.MANAGER ||
    currentUserRole === OrganizationRole.OWNER;

  const canUpdateMember = (member: OrganizationMember) => {
    const currentUserId = getCurrentUserId();
    if (member.userId === currentUserId) {
      return false;
    }

    // Only owner can modify other owners
    if (member.role === OrganizationRole.OWNER && !isCurrentUserOwner) {
      return false;
    }

    if (currentUserRole === OrganizationRole.MANAGER && member.role === OrganizationRole.MANAGER) {
      return false;
    }

    return canManageMembers;
  };
  const canRemoveMember = (member: OrganizationMember) => {
    const currentUserId = getCurrentUserId();

    // User can always remove themselves (leave organization)
    if (member.userId === currentUserId && !isCurrentUserOwner) {
      return true;
    }

    // Owner cannot be removed by others
    if (member.role === OrganizationRole.OWNER && !isCurrentUserOwner) {
      return false;
    }

    // Manager cannot remove other managers
    // if (
    //   currentUserRole === OrganizationRole.MANAGER &&
    //   member.role === OrganizationRole.MANAGER
    // ) {
    //   return false;
    // }

    return canManageMembers;
  };
  const getAvailableRolesForMember = (member: OrganizationMember) => {
    const roles = [OrganizationRole.VIEWER, OrganizationRole.MEMBER, OrganizationRole.MANAGER];
    if (isCurrentUserOwner || currentUserRole === "OWNER") {
      roles.push(OrganizationRole.OWNER);
    }
    return roles;
  };
  const getRoleBadgeClass = (role: OrganizationRole) => {
    switch (role) {
      case OrganizationRole.SUPER_ADMIN:
        return "organizations-role-badge-super-admin";
      case OrganizationRole.MANAGER:
        return "organizations-role-badge-manager";
      case OrganizationRole.MEMBER:
        return "organizations-role-badge-member";
      case OrganizationRole.VIEWER:
        return "organizations-role-badge-viewer";
      default:
        return "organizations-role-badge-viewer";
    }
  };

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

  const handleRoleChange = async (memberId: string, newRole: OrganizationRole) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }
    try {
      await updatedOrganizationMemberRole(memberId, { role: newRole as any }, currentUser.id);
      setIsLoading(true);
      toast.success("Member role updated successfully");
      onMembersChange();
    } catch (error) {
      toast.error("Failed to update member role");
      console.error("Role update error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (member: OrganizationMember) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }
    try {
      await removeOrganizationMember(member.id, currentUser.id);
      setIsLoading(true);
      toast.success("Member removed successfully");
      setMemberToRemove(null);
      onMembersChange();
    } catch (error) {
      toast.error("Failed to remove member");
      console.error("Remove member error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = invitationApi.validateInvitationData({
      inviteeEmail: inviteData.email,
      organizationId: organizationId,
      role: inviteData.role,
    });

    if (!validation.isValid) {
      validation.errors.forEach((error) => toast.error(error));
      return;
    }

    try {
      setIsLoading(true);

      await invitationApi.createInvitation({
        inviteeEmail: inviteData.email,
        organizationId: organizationId,
        role: inviteData.role,
      });

      toast.success(`Invitation sent to ${inviteData.email}`);
      setInviteData({ email: "", role: OrganizationRole.MEMBER, message: "" });
      setShowInviteModal(false);

      if (pendingInvitationsRef?.current) {
        await pendingInvitationsRef.current.refreshInvitations();
      }
    } catch (error: any) {
      console.log(error);
      const errorMessage = error?.message || "Failed to send invitation";
      toast.error(errorMessage);
      console.error("Invite member error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="organizations-members-container">
      <CardHeader className="organizations-members-header">
        <div className="organizations-members-header-content flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="organizations-members-header-info">
            <CardTitle className="flex gap-2 text-md">
              <HiUsers className="organizations-members-title-icon" />
              Members
            </CardTitle>
            <p className="organizations-members-subtitle">
              Manage organization members and their roles
            </p>
            {/* Invite button below subtitle for small screens */}
            {canManageMembers && (
              <div className="block sm:hidden mt-2">
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="organizations-members-invite-button"
                >
                  <HiPlus className="w-4 h-4" />
                  Invite Member
                </Button>
              </div>
            )}
          </div>
          {/* Invite button beside for desktop */}
          {canManageMembers && (
            <div className="flex gap-2">
              <div className="relative w-full sm:w-64">
                {/* Search Icon */}
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <HiMagnifyingGlass className="w-4 h-4 text-[var(--muted-foreground)]" />
                </div>

                {/* Input Field */}
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search members..."
                  className="pl-9 pr-9 h-9 w-full border-input bg-background text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus-visible:ring-[var(--primary)]"
                />

                {/* Loading Spinner */}
                {searchLoading && (
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}

                {/* Clear Button */}
                {!searchLoading && searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-3 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <HiXMark size={16} />
                  </button>
                )}
              </div>

              <div className="hidden sm:block">
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="organizations-members-invite-button"
                >
                  <HiPlus className="w-4 h-4" />
                  Invite Member
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <div className="organizations-members-table overflow-x-auto">
        <div className="organizations-members-table-header">
          <div className="organizations-members-table-header-grid">
            <div className="col-span-4">Member</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Actions</div>
          </div>
        </div>
        <div className="organizations-members-table-body">
          {members.map((member) => {
            const canEdit = canUpdateMember(member);
            const availableRoles = getAvailableRolesForMember(member);
            const isCurrentUser = member.userId === getCurrentUserId() && isCurrentUserOwner;
            const canRemove = canRemoveMember(member);
            return (
              <div key={member.id} className="organizations-members-row">
                <div className="organizations-members-row-grid">
                  <div className="organizations-member-info">
                    <div className="organizations-member-info-content">
                      <UserAvatar
                        user={{
                          id: member.userId,
                          firstName: member.user?.firstName || "",
                          lastName: member.user?.lastName || "",
                          avatar: member.user?.avatar || "",
                        }}
                        size="sm"
                      />
                      <div className="organizations-member-details">
                        <p className="organizations-member-name">
                          {member.user?.firstName && member.user?.lastName
                            ? `${member.user.firstName} ${member.user.lastName}`
                            : member.user?.username || "Unknown Member"}
                        </p>
                        <p className="organizations-member-email">
                          {member.user?.email || "(No email)"}
                        </p>
                      </div>
                    </div>
                  </div>

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

                  <div className="col-span-2">
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatDate(
                        typeof member.joinedAt === "string"
                          ? member.joinedAt
                          : member.joinedAt.toISOString()
                      )}
                    </span>
                  </div>
                  <div className="col-span-2">
                    {canEdit ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, value as OrganizationRole)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-7 text-xs border-none shadow-none bg-background text-[var(--foreground)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-none bg-[var(--card)]">
                          {availableRoles.map((role) => (
                            <SelectItem
                              key={role}
                              value={role}
                              className="hover:bg-[var(--hover-bg)]"
                            >
                              {role.charAt(0) + role.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        className={`text-xs px-2 py-1 rounded-md border-none ${getRoleBadgeClass(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </Badge>
                    )}
                  </div>

                  <div className="col-span-2">
                    {canRemove && (
                      <Tooltip
                        content={
                          isCurrentUser
                            ? "Leave Organization"
                            : currentUserRole === OrganizationRole.MANAGER &&
                                member.role === OrganizationRole.MANAGER
                              ? "Cannot remove other managers"
                              : "Remove Member"
                        }
                        position="top"
                        color="danger"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          disabled={isLoading}
                          className="h-7 border-none bg-[var(--destructive)]/10 hover:bg-[var(--destructive)]/20 text-[var(--destructive)] transition-all duration-200"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="px-4 py-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                <HiUsers className="w-6 h-6 text-[var(--muted-foreground)]" />
              </div>
              <h3 className="organizations-members-empty-title">No members found</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Start by inviting team members to your organization.
              </p>
              {canManageMembers && (
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium flex items-center gap-2"
                >
                  <HiPlus className="w-4 h-4" />
                  Invite Member
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="bg-[var(--card)] border-none rounded-[var(--card-radius)] shadow-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)] flex items-center gap-2">
              <HiMail className="w-5 h-5 text-[var(--primary)]" />
              Invite Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteMember} className="space-y-4">
            <div>
              <Label
                htmlFor="invite-email"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Email Address
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData((prev) => ({ ...prev, email: e.target.value }))}
                className="mt-1 border-none bg-background text-[var(--foreground)]"
                placeholder="Enter email address"
                required
              />
              {inviteData.email && !invitationApi.validateEmail(inviteData.email) && (
                <p className="text-xs text-[var(--destructive)] mt-1">
                  Please enter a valid email address
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium text-[var(--foreground)]">Role</Label>
              <Select
                value={inviteData.role}
                onValueChange={(value) =>
                  setInviteData((prev) => ({
                    ...prev,
                    role: value,
                  }))
                }
              >
                <SelectTrigger
                  className="projects-workspace-button border-none mt-1"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <SelectValue placeholder="Select a role">
                    {inviteData.role && (
                      <span className="text-[var(--foreground)]">{inviteData.role}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--muted)]">
                  {availableRoles
                    .filter((r) => {
                      // Manager cannot invite as Owner
                      if (
                        currentUserRole === OrganizationRole.MANAGER &&
                        r.name === OrganizationRole.OWNER
                      ) {
                        return false;
                      }
                      return true;
                    })
                    .map((r) => (
                      <SelectItem key={r.id} value={r.name} className="hover:bg-[var(--hover-bg)]">
                        <div className="flex flex-col items-start py-1">
                          <span className="font-medium text-[var(--foreground)]">{r.name}</span>
                          <span className="text-xs text-[var(--muted-foreground)] mt-0.5">
                            {r.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {!inviteData.role && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Please select a role for the member
                </p>
              )}
            </div>

            {/* Keep message field for UI but note it won't be sent */}
            <div>
              <Label
                htmlFor="invite-message"
                className="text-sm font-medium text-[var(--foreground)]"
              >
                Message (Optional)
              </Label>
              <Textarea
                id="invite-message"
                value={inviteData.message}
                onChange={(e) =>
                  setInviteData((prev) => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
                rows={3}
                className="mt-1 border-none bg-background text-[var(--foreground)]"
                placeholder="Personal message for the invitation..."
                maxLength={500}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-[var(--muted-foreground)]">
                  Note: Custom messages are not supported yet
                </p>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {inviteData.message.length}/500
                </span>
              </div>
            </div>

            <DialogFooter className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteData({
                    email: "",
                    role: OrganizationRole.MEMBER,
                    message: "",
                  });
                }}
                disabled={isLoading}
                className="h-8 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isLoading || !inviteData.email || !invitationApi.validateEmail(inviteData.email)
                }
                className="h-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 hover:shadow-md transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin mr-2"></div>
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setMemberToRemove(null)}
          onConfirm={() => handleRemoveMember(memberToRemove)}
          title={
            memberToRemove.userId === getCurrentUserId() ? "Leave Organization" : "Remove Member"
          }
          message={
            memberToRemove.userId === getCurrentUserId()
              ? "Are you sure you want to leave this organization? You will lose access to all organization resources."
              : `Are you sure you want to remove ${
                  memberToRemove.user?.firstName && memberToRemove.user?.lastName
                    ? `${memberToRemove.user.firstName} ${memberToRemove.user.lastName}`
                    : memberToRemove.user?.username || "this member"
                } from the organization?`
          }
          confirmText={memberToRemove.userId === getCurrentUserId() ? "Leave" : "Remove"}
          cancelText="Cancel"
        />
      )}
    </div>
  );
}
