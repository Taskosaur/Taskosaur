import React, { ReactNode, RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HiFolder, HiCube } from "react-icons/hi2";
import { HiOfficeBuilding } from "react-icons/hi";
import MembersList, { Member, Role } from "./MembersList";
import RoleDistribution from "./RoleDistribution";
import DynamicPendingInvitations, {
  DynamicPendingInvitationsRef,
} from "./DynamicPendingInvitations";

// Entity types
export interface BaseEntity {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Organization extends BaseEntity {
  avatar?: string;
  website?: string;
  settings?: any;
  ownerId?: string;
  memberCount?: number;
  workspaceCount?: number;
}

export interface Workspace extends BaseEntity {
  organizationId?: string;
}

export interface Project extends BaseEntity {
  workspaceId?: string;
  createdBy?: string;
}

type EntityType = "organization" | "workspace" | "project";
type Entity = Organization | Workspace | Project;

interface EntityInfoData {
  label: string;
  value: string | number;
}

interface MembersManagementLayoutProps {
  // Entity configuration
  entityType: EntityType;
  entity: Entity | null;
  parentEntity?: Entity | null; // For projects (workspace) or workspaces (organization)

  // Members data
  members: Member[];
  loading: boolean;
  error?: string | null;

  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;

  // Member actions
  onRoleUpdate?: (memberId: string, newRole: string) => Promise<void>;
  onRemoveMember?: (member: Member) => void;
  canUpdateMemberRole: (member: Member) => boolean;
  canRemoveMember: (member: Member) => boolean;
  getAvailableRolesForMember: (member: Member) => Role[];

  // Loading states
  updatingMember: string | null;
  removingMember: string | null;

  // User context
  currentUserId: string;
  hasManagementAccess: boolean;

  // Invitations
  pendingInvitationsRef?: RefObject<DynamicPendingInvitationsRef>;
  fetchInvitations?: (entityType: EntityType, entityId: string) => Promise<any>;
  onResendInvite?: (inviteId: string) => Promise<any>;

  // Optional customization
  roles?: Role[];
  additionalInfoCards?: ReactNode;
  hideRoleDistribution?: boolean;
  hidePendingInvitations?: boolean;
  customEmptyState?: {
    title: string;
    description: string;
  };
}

const MembersManagementLayout: React.FC<MembersManagementLayoutProps> = ({
  entityType,
  entity,
  parentEntity,
  members,
  loading,
  error,
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
  hasManagementAccess,
  pendingInvitationsRef,
  fetchInvitations,
  onResendInvite,
  roles,
  additionalInfoCards,
  hideRoleDistribution = false,
  hidePendingInvitations = false,
  customEmptyState,
}) => {
  // Get entity icon
  const getEntityIcon = () => {
    switch (entityType) {
      case "organization":
        return <HiOfficeBuilding className="w-5 h-5 text-[var(--muted-foreground)]" />;
      case "workspace":
        return <HiCube className="w-5 h-5 text-[var(--muted-foreground)]" />;
      case "project":
        return <HiFolder className="w-5 h-5 text-[var(--muted-foreground)]" />;
    }
  };

  // Get entity info items
  const getEntityInfoItems = (): EntityInfoData[] => {
    const items: EntityInfoData[] = [];

    if (!entity) return items;

    // Common items
    items.push({
      label: "Members:",
      value: members.length,
    });

    items.push({
      label: "Active Members:",
      value: members.filter((m) => m.status === "ACTIVE").length,
    });

    // Entity-specific items
    switch (entityType) {
      case "organization":
        const org = entity as Organization;
        if (org.slug) {
          items.push({
            label: "Slug:",
            value: org.slug,
          });
        }
        if (org.website) {
          items.push({
            label: "Website:",
            value: org.website,
          });
        }
        break;

      case "workspace":
        if (parentEntity) {
          items.unshift({
            label: "Organization:",
            value: parentEntity.name || "Unknown",
          });
        }
        break;

      case "project":
        if (parentEntity) {
          items.unshift({
            label: "Workspace:",
            value: parentEntity.name || "Unknown",
          });
        }
        break;
    }

    return items;
  };

  const getEntityLabel = () => {
    return entityType.charAt(0).toUpperCase() + entityType.slice(1);
  };

  // Format value for display
  const formatInfoValue = (value: string | number): string => {
    if (typeof value === "number") {
      return value.toString();
    }
    // Check if it's a URL
    if (value.startsWith("http")) {
      const url = new URL(value);
      return url.hostname;
    }
    return value;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Members List - Takes most space */}
      <div className="lg:col-span-2">
        <MembersList
          entityType={entityType}
          entityName={entity?.name}
          members={members}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          onRoleUpdate={onRoleUpdate}
          onRemoveMember={onRemoveMember}
          canUpdateMemberRole={canUpdateMemberRole}
          canRemoveMember={canRemoveMember}
          getAvailableRolesForMember={getAvailableRolesForMember}
          updatingMember={updatingMember}
          removingMember={removingMember}
          currentUserId={currentUserId}
          emptyStateTitle={customEmptyState?.title}
          emptyStateDescription={customEmptyState?.description}
        />
      </div>

      {/* Sidebar - Info Cards */}
      <div className="lg:col-span-1 space-y-4">
        {/* Entity Info Card */}
        <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
              {getEntityIcon()}
              {getEntityLabel()} Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {entity?.name || `Unknown ${getEntityLabel()}`}
                </p>
                {entity?.description && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {entity.description}
                  </p>
                )}
              </div>

              {/* Info Items */}
              {getEntityInfoItems().map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs text-[var(--muted-foreground)]"
                >
                  <span>{item.label}</span>
                  <span
                    className={`font-medium text-[var(--foreground)] ${
                      item.label === "Slug:" ? "font-mono" : ""
                    }`}
                  >
                    {formatInfoValue(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution Card */}
        {!hideRoleDistribution && (
          <RoleDistribution entityType={entityType} members={members} roles={roles} />
        )}

        {/* Additional custom info cards */}
        {additionalInfoCards}

        {/* Pending Invitations */}
        {hasManagementAccess && !hidePendingInvitations && fetchInvitations && (
          <DynamicPendingInvitations
            ref={pendingInvitationsRef}
            entity={entity}
            entityType={entityType}
            members={members}
            fetchInvitations={fetchInvitations}
            onResendInvite={onResendInvite}
            height="270px"
          />
        )}
      </div>
    </div>
  );
};

export default MembersManagementLayout;
