import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Button } from "@/components/ui";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { HiEnvelope, HiArrowPath } from "react-icons/hi2";
import { BsThreeDotsVertical } from "react-icons/bs";
import { RxReset } from "react-icons/rx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import Tooltip from "@/components/common/ToolTip";
import { toast } from "sonner";

interface Invitation {
  id: string;
  inviteeEmail: string;
  inviter?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  role?: string;
  status: "PENDING" | "DECLINED" | string;
  createdAt?: string;
  expiresAt?: string;
}

interface Entity {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

type EntityType = "organization" | "workspace" | "project";

interface DynamicPendingInvitationsProps {
  entity: Entity | null;
  entityType: EntityType;
  members: any[];
  fetchInvitations: (entityType: EntityType, entityId: string) => Promise<any>;
  onResendInvite?: (inviteId: string) => Promise<any>;
  onDeclineInvite?: (inviteId: string) => Promise<any>;
  height?: string;
  showDeclineOption?: boolean;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

export interface DynamicPendingInvitationsRef {
  refreshInvitations: () => Promise<void>;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "organizations-status-badge-active";
    case "PENDING":
      return "organizations-status-badge-pending";
    case "DECLINED":
      return "organizations-status-badge-declined";
    case "INACTIVE":
      return "organizations-status-badge-inactive";
    case "SUSPENDED":
      return "organizations-status-badge-suspended";
    default:
      return "organizations-status-badge-inactive";
  }
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatTimeRemaining = (expiresAt?: string) => {
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} remaining`;
  }
  return `${hours} hour${hours > 1 ? "s" : ""} remaining`;
};

export const DynamicPendingInvitations = forwardRef<
  DynamicPendingInvitationsRef,
  DynamicPendingInvitationsProps
>(
  (
    {
      entity,
      entityType,
      members,
      fetchInvitations,
      onResendInvite,
      onDeclineInvite,
      height = "270px",
      showDeclineOption = false,
      emptyStateTitle,
      emptyStateDescription,
    },
    ref
  ) => {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [decliningId, setDecliningId] = useState<string | null>(null);

    const fetchInvites = async () => {
      if (!entity?.id) return;

      try {
        setLoading(true);
        const data = await fetchInvitations(entityType, entity.id);
        setInvitations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching invitations:", err);
        toast.error("Failed to load invitations");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchInvites();
    }, [entity, entityType]);

    // Expose refresh method to parent component
    useImperativeHandle(ref, () => ({
      refreshInvitations: fetchInvites,
    }));

    const handleResendInvite = async (inviteId: string) => {
      if (!onResendInvite) return;

      try {
        setResendingId(inviteId);
        const result = await onResendInvite(inviteId);

        if (result?.emailSent) {
          toast.success("Invitation resent successfully - email sent");
        } else {
          toast.warning(
            "Invitation updated but email failed to send. The invitee can still use the updated invitation link."
          );
          if (result?.emailError) {
            console.warn("Email delivery failed:", result.emailError);
          }
        }

        await fetchInvites(); // Refresh the list
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to resend invitation";
        toast.error(errorMessage);
      } finally {
        setResendingId(null);
      }
    };

    const handleDeclineInvite = async (inviteId: string) => {
      if (!onDeclineInvite || !showDeclineOption) return;

      try {
        setDecliningId(inviteId);
        await onDeclineInvite(inviteId);
        toast.success("Invitation declined");
        await fetchInvites(); // Refresh the list
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to decline invitation";
        toast.error(errorMessage);
      } finally {
        setDecliningId(null);
      }
    };

    const pendingInvites = invitations.filter((i) => i.status === "PENDING");
    const declinedInvites = invitations.filter((i) => i.status === "DECLINED");
    const totalInvites = pendingInvites.length + declinedInvites.length;

    const getEmptyStateContent = () => {
      return {
        title: emptyStateTitle || "No pending or declined invitations",
        description:
          emptyStateDescription ||
          `Invitations to this ${entityType} will appear here until they're accepted or declined.`,
      };
    };

    const getEntityTypeLabel = () => {
      return entityType.charAt(0).toUpperCase() + entityType.slice(1);
    };

    return (
      <Card
        className="bg-[var(--card)] border-none shadow-sm gap-0 space-y-0 flex flex-col"
        style={{ height }}
      >
        <CardHeader className="px-4 py-3 flex-shrink-0 border-b border-[var(--border)]">
          <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
            <HiEnvelope className="w-5 h-5 text-[var(--muted-foreground)]" />
            <span>Invitations</span>
            <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)] border-none text-xs">
              {totalInvites}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 overflow-y-auto flex-1">
          {loading ? (
            <div className="p-6 text-sm text-center text-[var(--muted-foreground)]">
              <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Loading invitations...
            </div>
          ) : totalInvites === 0 ? (
            <div className="p-4 text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--muted)] flex items-center justify-center">
                <HiEnvelope className="w-6 h-6 text-[var(--muted-foreground)]" />
              </div>
              <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                {getEmptyStateContent().title}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                {getEmptyStateContent().description}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {[...pendingInvites, ...declinedInvites].map((invite) => (
                <div
                  key={invite.id}
                  className="px-4 py-3 hover:bg-[var(--accent)]/20 transition-colors"
                >
                  <div className="grid grid-cols-7 gap-3 items-center">
                    {/* Invitee Info */}
                    <div className="col-span-5">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={{
                            firstName: invite.inviteeEmail?.[0]?.toUpperCase() || "",
                            lastName: "",
                            avatar: undefined,
                          }}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--foreground)] truncate">
                            {invite.inviteeEmail}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] truncate">
                            Invited by{" "}
                            {invite.inviter?.firstName
                              ? `${invite.inviter.firstName} ${invite.inviter.lastName || ""}`
                              : "Unknown"}
                            {invite.role && (
                              <span className="ml-2">
                                as <span className="font-medium">{invite.role}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-2 mt-1">
                            <span>{formatDate(invite.createdAt)}</span>
                            {invite.status === "PENDING" && invite.expiresAt && (
                              <>
                                <span>•</span>
                                <span className="text-orange-500">
                                  {formatTimeRemaining(invite.expiresAt)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] bg-transparent px-1.5 py-0.5 rounded-md border-none ${getStatusBadgeClass(
                          invite.status
                        )}`}
                      >
                        {invite.status}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex justify-end">
                      {invite.status === "PENDING" &&
                        (onResendInvite || (onDeclineInvite && showDeclineOption)) && (
                          <DropdownMenu>
                            <Tooltip content="Manage Invitation">
                              <DropdownMenuTrigger asChild className="bg-[var(--card)]">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 cursor-pointer hover:bg-[var(--accent)]"
                                  disabled={resendingId === invite.id || decliningId === invite.id}
                                >
                                  <BsThreeDotsVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </Tooltip>

                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[var(--card)] border-none shadow-md"
                            >
                              {onResendInvite && (
                                <DropdownMenuItem
                                  onClick={() => handleResendInvite(invite.id)}
                                  disabled={resendingId === invite.id}
                                  className="flex text-xs items-center gap-2 cursor-pointer hover:bg-[var(--accent)]"
                                >
                                  <HiArrowPath
                                    className={`w-4 h-4 ${
                                      resendingId === invite.id ? "animate-spin" : ""
                                    }`}
                                  />
                                  Resend Invitation
                                </DropdownMenuItem>
                              )}

                              {onDeclineInvite && showDeclineOption && (
                                <DropdownMenuItem
                                  onClick={() => handleDeclineInvite(invite.id)}
                                  disabled={decliningId === invite.id}
                                  className="flex text-xs text-red-600 items-center gap-2 cursor-pointer hover:bg-[var(--accent)]"
                                >
                                  <RxReset className="w-3 h-3" />
                                  Decline Invitation
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

DynamicPendingInvitations.displayName = "DynamicPendingInvitations";

export default DynamicPendingInvitations;
