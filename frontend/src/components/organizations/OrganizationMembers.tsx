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
import { HiPlus, HiUsers } from "react-icons/hi2";
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
  pendingInvitationsRef?: React.RefObject<PendingInvitationsRef>; // Add ref prop
}

export default function OrganizationMembers({
  organizationId,
  members,
  currentUserRole,
  onMembersChange,
  organization,
  pendingInvitationsRef,
}: OrganizationMembersProps) {
  const { updatedOrganizationMemberRole, removeOrganizationMember } =
    useOrganization();
  const { getCurrentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] =
    useState<OrganizationMember | null>(null);
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

  const canManageMembers =
    currentUserRole === OrganizationRole.SUPER_ADMIN ||
    currentUserRole === OrganizationRole.MANAGER ||
    OrganizationRole.OWNER;

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

  const handleRoleChange = async (
    memberId: string,
    newRole: OrganizationRole
  ) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }
    try {
      await updatedOrganizationMemberRole(
        memberId,
        { role: newRole as any },
        currentUser.id
      );
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
      const errorMessage =
        error?.response?.data?.message || "Failed to send invitation";
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
        <div className="organizations-members-header-content">
          <div className="organizations-members-header-info">
            <CardTitle className="flex  gap-2 text-md">
              <HiUsers className="organizations-members-title-icon" />
              Members ({members.length})
            </CardTitle>
            <p className="organizations-members-subtitle">
              Manage organization members and their roles
            </p>
          </div>
          {canManageMembers && (
            <Button
              onClick={() => setShowInviteModal(true)}
              className="organizations-members-invite-button"
            >
              <HiPlus className="w-4 h-4" />
              Invite Member
            </Button>
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
            const isOwner = member.role === OrganizationRole.OWNER;
            const canUpdateMember = canManageMembers && !isOwner;

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
                    {canUpdateMember ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member.id, value as OrganizationRole)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger
                          className="h-7 text-xs border-none shadow-none bg-background text-[var(--foreground)]"
                          onFocus={(e) => {
                            e.currentTarget.style.boxShadow = "none";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-none bg-[var(--card)]">
                          {currentUserRole === "OWNER" && (
                            <SelectItem
                              value={OrganizationRole.OWNER}
                              className="hover:bg-[var(--hover-bg)]"
                            >
                              Owner
                            </SelectItem>
                          )}
                          <SelectItem
                            value={OrganizationRole.MANAGER}
                            className="hover:bg-[var(--hover-bg)]"
                          >
                            Manager
                          </SelectItem>
                          <SelectItem
                            value={OrganizationRole.MEMBER}
                            className="hover:bg-[var(--hover-bg)]"
                          >
                            Member
                          </SelectItem>
                          <SelectItem
                            value={OrganizationRole.VIEWER}
                            className="hover:bg-[var(--hover-bg)]"
                          >
                            Viewer
                          </SelectItem>
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
                    {canUpdateMember && (
                      <Tooltip
                        content={"Remove Member"}
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
              <h3 className="organizations-members-empty-title">
                No members found
              </h3>
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
                onChange={(e) =>
                  setInviteData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="mt-1 border-none bg-background text-[var(--foreground)]"
                placeholder="Enter email address"
                required
              />
              {inviteData.email &&
                !invitationApi.validateEmail(inviteData.email) && (
                  <p className="text-xs text-[var(--destructive)] mt-1">
                    Please enter a valid email address
                  </p>
                )}
            </div>

            <div>
              <Label className="text-sm font-medium text-[var(--foreground)]">
                Role
              </Label>
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
                      <span className="text-[var(--foreground)]">
                        {inviteData.role}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-none bg-[var(--card)]">
                  {availableRoles.map((r) => (
                    <SelectItem
                      key={r.id}
                      value={r.name}
                      className="hover:bg-[var(--hover-bg)]"
                    >
                      <div className="flex flex-col items-start py-1">
                        <span className="font-medium text-[var(--foreground)]">
                          {r.name}
                        </span>
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
                  isLoading ||
                  !inviteData.email ||
                  !invitationApi.validateEmail(inviteData.email)
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
          title="Remove Member"
          message={`Are you sure you want to remove ${
            memberToRemove.user?.firstName && memberToRemove.user?.lastName
              ? `${memberToRemove.user.firstName} ${memberToRemove.user.lastName}`
              : memberToRemove.user?.username || "this member"
          } from the organization?`}
          confirmText="Remove"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}
