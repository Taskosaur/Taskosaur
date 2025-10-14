import { useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Button } from "@/components/ui";
import UserAvatar from "@/components/ui/avatars/UserAvatar";
import { HiEnvelope, HiArrowPath } from "react-icons/hi2";
import { useOrganization } from "@/contexts/organization-context";
import { invitationApi } from "@/utils/api/invitationsApi";
import { toast } from "sonner";
import Tooltip from "@/components/common/ToolTip";

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

interface PendingInvitationsProps {
  entity: Entity | null;
  entityType: EntityType;
  members: any[];
}

export interface PendingInvitationsRef {
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

const PendingInvitations = forwardRef<PendingInvitationsRef, PendingInvitationsProps>(
  ({ entity, entityType, members }, ref) => {
    const { showPendingInvitations } = useOrganization();
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);

    const fetchInvites = async () => {
      if (!entity?.id) return;
      setLoading(true);
      try {
        const data = await showPendingInvitations(entityType, entity.id);
        setInvitations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching invitations:", err);
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
      try {
        setResendingId(inviteId);
        const result = await invitationApi.resendInvitation(inviteId);

        if (result.emailSent) {
          toast.success("Invitation resent successfully - email sent");
        } else {
          toast.warning("Invitation updated but email failed to send. The invitee can still use the updated invitation link.");
          console.warn("Email delivery failed:", result.emailError);
        }

        await fetchInvites(); // Refresh the list
      } catch (error: any) {
        const errorMessage = error?.message || "Failed to resend invitation";
        toast.error(errorMessage);
      } finally {
        setResendingId(null);
      }
    };

    const pendingInvites = invitations.filter((i) => i.status === "PENDING");
    const declinedInvites = invitations.filter((i) => i.status === "DECLINED");

  const totalInvites = pendingInvites.length + declinedInvites.length;

  return (
    <Card className="bg-[var(--card)]  border-none shadow-sm">
      <CardHeader className="px-4 py-0">
        <CardTitle className="text-md font-semibold text-[var(--foreground)] flex items-center gap-2">
          <HiEnvelope className="w-5 h-5 text-[var(--muted-foreground)]" />
          Invitations ({totalInvites})
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-center text-[var(--muted-foreground)]">
            Loading invitations...
          </div>
        ) : totalInvites === 0 ? (
          <div className="p-4 text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--muted)] flex items-center justify-center">
              <HiEnvelope className="w-6 h-6 text-[var(--muted-foreground)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
              No pending or declined invitations
            </h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              Invitations to this {entityType} will appear here until they’re
              accepted or declined.
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="px-4 py-3 bg-[var(--muted)]/30 border-b border-[var(--border)]">
              <div className="grid grid-cols-12 gap-3 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                <div className="col-span-5">Invitee</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Invited</div>
                <div className="col-span-2">Actions</div>
              </div>
            </div>

            {/* Invitations List */}
            <div className="divide-y divide-[var(--border)]">
              {[...pendingInvites, ...declinedInvites].map((invite) => (
                <div
                  key={invite.id}
                  className="px-4 py-3  transition-colors"
                >
                  <div className="grid grid-cols-12 gap-3 items-center">
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
                          <div className="text-xs text-[var(--muted-foreground)] truncate">
                            Invited by{" "}
                            {invite.inviter?.firstName
                              ? `${invite.inviter.firstName} ${invite.inviter.lastName || ""}`
                              : "Unknown"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <Badge
                        variant="outline"
                        className={`text-xs bg-transparent px-2 py-1 rounded-md border-none ${getStatusBadgeClass(
                          invite.status
                        )}`}
                      >
                        {invite.status}
                      </Badge>
                    </div>

                    {/* Invited Date */}
                    <div className="col-span-3">
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatDate(invite.createdAt)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-2">
                      {invite.status === "PENDING" && (
                        <Tooltip content={resendingId === invite.id ? "Sending..." : "Resend invitation"}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleResendInvite(invite.id)}
                            disabled={resendingId === invite.id}
                          >
                            <HiArrowPath
                              className={`w-4 h-4 ${resendingId === invite.id ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

PendingInvitations.displayName = "PendingInvitations";

export default PendingInvitations;
