import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HiCog } from "react-icons/hi2";

interface RoleConfig {
  name: string;
  variant?: string;
  label?: string;
  color?: string;
}

interface RoleDistributionProps {
  entityType: "organization" | "workspace" | "project";
  members: Array<{ role: string; status?: string }>;
  roles?: RoleConfig[];
  title?: string;
  icon?: React.ReactNode;
}

const defaultOrganizationRoles: RoleConfig[] = [
  { name: "OWNER", variant: "default", label: "Owner" },
  { name: "MANAGER", variant: "success", label: "Manager" },
  { name: "MEMBER", variant: "info", label: "Member" },
  { name: "VIEWER", variant: "secondary", label: "Viewer" },
];

const defaultProjectRoles: RoleConfig[] = [
  { name: "OWNER", variant: "default", label: "Owner" },
  { name: "MANAGER", variant: "success", label: "Manager" },
  { name: "DEVELOPER", variant: "info", label: "Developer" },
  { name: "VIEWER", variant: "secondary", label: "Viewer" },
];

const defaultWorkspaceRoles: RoleConfig[] = [
  { name: "OWNER", variant: "default", label: "Owner" },
  { name: "ADMIN", variant: "success", label: "Admin" },
  { name: "MEMBER", variant: "info", label: "Member" },
  { name: "GUEST", variant: "secondary", label: "Guest" },
];

export const RoleDistribution: React.FC<RoleDistributionProps> = ({
  entityType,
  members,
  roles,
  title = "Role Distribution",
  icon,
}) => {
  // Determine which roles to use based on entity type
  const getDefaultRoles = (): RoleConfig[] => {
    switch (entityType) {
      case "organization":
        return defaultOrganizationRoles;
      case "project":
        return defaultProjectRoles;
      case "workspace":
        return defaultWorkspaceRoles;
      default:
        return defaultOrganizationRoles;
    }
  };

  const rolesConfig = roles || getDefaultRoles();

  // Count members by role (excluding pending members)
  const getRoleCount = (roleName: string): number => {
    return members.filter((m) => m.role === roleName && m.status?.toLowerCase() !== "pending")
      .length;
  };

  // Get badge styling based on role
  const getBadgeClass = (variant?: string): string => {
    // Using the existing color system from theme
    switch (variant) {
      case "default":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "success":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "info":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "secondary":
        return "bg-[var(--muted)] text-[var(--muted-foreground)]";
      default:
        return "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20";
    }
  };

  // Calculate total active members
  const totalActiveMembers = members.filter((m) => m.status?.toLowerCase() !== "pending").length;

  return (
    <Card className="bg-[var(--card)] rounded-[var(--card-radius)] border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
          {icon || <HiCog className="w-5 h-5 text-[var(--muted-foreground)]" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Role breakdown */}
          {rolesConfig.map((role) => {
            const count = getRoleCount(role.name);
            const percentage =
              totalActiveMembers > 0 ? Math.round((count / totalActiveMembers) * 100) : 0;

            return (
              <div key={role.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">{role.label || role.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={role.variant as any}
                      className={`h-5 px-2 text-xs border-none ${getBadgeClass(role.variant)}`}
                    >
                      {count}
                    </Badge>
                    {totalActiveMembers > 0 && (
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        ({percentage}%)
                      </span>
                    )}
                  </div>
                </div>
                {/* Optional progress bar */}
                {totalActiveMembers > 0 && (
                  <div className="w-full bg-[var(--muted)]/30 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        role.variant === "default"
                          ? "bg-purple-500/50"
                          : role.variant === "success"
                            ? "bg-green-500/50"
                            : role.variant === "info"
                              ? "bg-blue-500/50"
                              : "bg-[var(--muted-foreground)]/50"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary section */}
          <div className="pt-3 mt-3 border-t border-[var(--border)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--muted-foreground)] font-medium">
                Total Active Members
              </span>
              <span className="font-semibold text-[var(--foreground)]">{totalActiveMembers}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoleDistribution;
