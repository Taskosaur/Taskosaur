import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HiMagnifyingGlass, HiUsers, HiXMark } from "react-icons/hi2";
import { X } from "lucide-react";
import Tooltip from "@/components/common/ToolTip";
import { UserSource } from "@/types/users";
import {
  getUserSourceLabel,
  getUserSourceBadgeClass,
  isExternalUser,
  getAllUserSources,
} from "@/utils/userSourceHelpers";

// Types
export interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  role: string;
  status: string;
  avatarUrl?: string;
  joinedAt: string | Date;
  lastActive?: string;
  userId: string;
  projectId?: string;
  organizationId?: string;
  workspaceId?: string;
  source?: UserSource;
}

export interface Role {
  id: string;
  name: string;
  variant?: string;
}

interface MembersListProps {
  entityType: "organization" | "workspace" | "project";
  entityName?: string;
  members: Member[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onRoleUpdate?: (memberId: string, newRole: string) => Promise<void>;
  onRemoveMember?: (member: Member) => void;
  canUpdateMemberRole: (member: Member) => boolean;
  canRemoveMember: (member: Member) => boolean;
  getAvailableRolesForMember: (member: Member) => Role[];
  updatingMember: string | null;
  removingMember: string | null;
  currentUserId: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

// Helper functions
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

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case "OWNER":
      return "organizations-role-badge-super-admin";
    case "MANAGER":
      return "organizations-role-badge-manager";
    case "DEVELOPER":
    case "MEMBER":
      return "organizations-role-badge-member";
    case "VIEWER":
      return "organizations-role-badge-viewer";
    default:
      return "organizations-role-badge-viewer";
  }
};

const formatDate = (dateString: string | Date) => {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

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

export const MembersList: React.FC<MembersListProps> = ({
  entityType,
  entityName,
  members,
  loading,
  searchTerm,
  onSearchChange,
  onRoleUpdate,
  onRemoveMember,
  canUpdateMemberRole,
  canRemoveMember,
  getAvailableRolesForMember,
  updatingMember,
  removingMember,
  currentUserId,
  emptyStateTitle,
  emptyStateDescription,
}) => {
  // State for source filter
  const [sourceFilter, setSourceFilter] = useState<UserSource | "">("");

  // Filter active members (exclude pending invitations)
  const activeMembers = members.filter(
    (member) =>
      member.status?.toLowerCase() !== "pending" &&
      (!sourceFilter || member.source === sourceFilter)
  );

  const getEmptyStateContent = () => {
    if (searchTerm) {
      return {
        title: emptyStateTitle || "No members found matching your search",
        description: emptyStateDescription || "Try adjusting your search terms",
      };
    }

    return {
      title: emptyStateTitle || `No members found in this ${entityType}`,
      description:
        emptyStateDescription ||
        `Start by inviting team members to collaborate on this ${entityType}`,
    };
  };

  const getMemberActionTooltip = (member: Member, isCurrentUser: boolean, isOwner: boolean) => {
    if (isCurrentUser) {
      return `Leave ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
    }
    if (isOwner) {
      return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} owner cannot be removed`;
    }
    return "Remove Member";
  };

  return (
    <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
      <CardHeader className="pb-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
            <HiUsers className="w-5 h-5 text-[var(--muted-foreground)]" />
            Team Members ({activeMembers.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Source Filter */}
            <Select
              value={sourceFilter}
              onValueChange={(value) => setSourceFilter(value as UserSource | "")}
            >
              <SelectTrigger className="h-9 w-48 border-input bg-background text-[var(--foreground)]">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent className="border-none bg-[var(--card)]">
                <SelectItem value="" className="hover:bg-[var(--hover-bg)]">
                  All Sources
                </SelectItem>
                {getAllUserSources().map((source) => (
                  <SelectItem
                    key={source.value}
                    value={source.value}
                    className="hover:bg-[var(--hover-bg)]"
                  >
                    {source.icon} {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiMagnifyingGlass className="w-4 text-[var(--muted-foreground)]" />
              </div>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-9 w-64 border-input bg-background text-[var(--foreground)]"
                placeholder="Search members..."
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  <HiXMark size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Table Header */}
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
            icon={HiUsers}
            title={getEmptyStateContent().title}
            description={getEmptyStateContent().description}
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {activeMembers.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const canEditRole = canUpdateMemberRole(member);
              const canRemove = canRemoveMember(member);
              const availableRoles = getAvailableRolesForMember(member);
              const isOwner = member.role === "OWNER";

              return (
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
                            firstName: member.firstName,
                            lastName: member.lastName,
                            avatar: member.avatarUrl,
                          }}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[var(--foreground)] truncate">
                              {member.firstName} {member.lastName}
                              {isCurrentUser && (
                                <span className="text-xs text-[var(--muted-foreground)] ml-2">
                                  (You)
                                </span>
                              )}
                            </div>
                            {member.source && isExternalUser(member.source) && (
                              <Tooltip
                                content="External user created from shared inbox email"
                                position="top"
                              >
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 h-4 border ${getUserSourceBadgeClass(member.source)}`}
                                >
                                  📧 {getUserSourceLabel(member.source)}
                                </Badge>
                              </Tooltip>
                            )}
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
                        {formatDate(member.joinedAt)}
                      </span>
                    </div>

                    {/* Role */}
                    <div className="col-span-2">
                      {canEditRole && onRoleUpdate ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => onRoleUpdate(member.id, value)}
                          disabled={updatingMember === member.id}
                        >
                          <SelectTrigger className="h-7 text-xs border-none shadow-none bg-background text-[var(--foreground)]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-none bg-[var(--card)]">
                            {availableRoles.map((role) => (
                              <SelectItem
                                key={role.id}
                                value={role.name}
                                className="hover:bg-[var(--hover-bg)]"
                              >
                                {role.name.charAt(0) + role.name.slice(1).toLowerCase()}
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

                    {/* Action */}
                    <div className="col-span-2">
                      {canRemove && onRemoveMember && (
                        <Tooltip
                          content={getMemberActionTooltip(member, isCurrentUser, isOwner)}
                          position="top"
                          color={isOwner && !isCurrentUser ? "default" : "danger"}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRemoveMember(member)}
                            disabled={removingMember === member.id || (isOwner && !isCurrentUser)}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MembersList;
